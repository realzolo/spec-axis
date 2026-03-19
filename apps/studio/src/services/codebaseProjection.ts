import { codebaseService } from '@/services/CodebaseService';

export type ThreadProjectionStatus = 'exact' | 'shifted' | 'ambiguous' | 'outdated' | 'missing';
export type ThreadProjectionReason =
  | 'same_commit'
  | 'same_blob'
  | 'rename_map'
  | 'diff_hunk_map'
  | 'diff_hunk_overlap'
  | 'fuzzy_context'
  | 'no_match';

export type ThreadAnchorSnapshot = {
  anchorCommitSha: string;
  anchorPath: string;
  anchorLineStart: number;
  anchorLineEnd: number;
  anchorSelectionText: string | null;
  anchorContextBefore: string | null;
  anchorContextAfter: string | null;
  anchorBlobSha: string | null;
};

export type ThreadProjectionInput = {
  orgId: string;
  projectId: string;
  repo: string;
  targetCommitSha: string;
  anchor: ThreadAnchorSnapshot;
};

export type ThreadProjectionResult = {
  projectedPath: string | null;
  projectedLineStart: number | null;
  projectedLineEnd: number | null;
  status: ThreadProjectionStatus;
  confidence: number;
  reasonCode: ThreadProjectionReason;
};

type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
};

type SelectionMatch = {
  start: number;
  end: number;
};

export async function computeThreadProjection(input: ThreadProjectionInput): Promise<ThreadProjectionResult> {
  const {
    orgId,
    projectId,
    repo,
    targetCommitSha,
    anchor,
  } = input;

  const normalizedStart = Math.max(1, Math.trunc(anchor.anchorLineStart));
  const normalizedEnd = Math.max(normalizedStart, Math.trunc(anchor.anchorLineEnd));
  const baseRef = { orgId, projectId, repo };

  if (anchor.anchorCommitSha === targetCommitSha) {
    return {
      projectedPath: anchor.anchorPath,
      projectedLineStart: normalizedStart,
      projectedLineEnd: normalizedEnd,
      status: 'exact',
      confidence: 1,
      reasonCode: 'same_commit',
    };
  }

  const rename = await resolveRenamePath(baseRef, anchor.anchorCommitSha, targetCommitSha, anchor.anchorPath);
  if (rename === null) {
    return {
      projectedPath: null,
      projectedLineStart: null,
      projectedLineEnd: null,
      status: 'missing',
      confidence: 0,
      reasonCode: 'no_match',
    };
  }
  const projectedPath = rename;

  const targetBlobSha = await codebaseService.getBlobSha(
    { ...baseRef, ref: targetCommitSha },
    projectedPath,
    { syncPolicy: 'never' },
  );
  if (!targetBlobSha) {
    return {
      projectedPath: null,
      projectedLineStart: null,
      projectedLineEnd: null,
      status: 'missing',
      confidence: 0,
      reasonCode: 'no_match',
    };
  }

  if (anchor.anchorBlobSha && targetBlobSha === anchor.anchorBlobSha) {
    return {
      projectedPath,
      projectedLineStart: normalizedStart,
      projectedLineEnd: normalizedEnd,
      status: projectedPath === anchor.anchorPath ? 'exact' : 'shifted',
      confidence: projectedPath === anchor.anchorPath ? 0.99 : 0.94,
      reasonCode: projectedPath === anchor.anchorPath ? 'same_blob' : 'rename_map',
    };
  }

  const patch = await codebaseService.diffPatchZero(
    { ...baseRef, ref: targetCommitSha },
    anchor.anchorCommitSha,
    targetCommitSha,
    [anchor.anchorPath, projectedPath],
    { syncPolicy: 'never' },
  );
  const hunks = parseHunksForPath(patch, anchor.anchorPath, projectedPath);
  const mapped = mapLineRangeByHunks(normalizedStart, normalizedEnd, hunks);

  const verified = await verifyWithContext({
    orgId,
    projectId,
    repo,
    targetCommitSha,
    projectedPath,
    mappedStart: mapped.start,
    mappedEnd: mapped.end,
    anchor,
  });

  if (verified.kind === 'missing') {
    return {
      projectedPath: null,
      projectedLineStart: null,
      projectedLineEnd: null,
      status: 'missing',
      confidence: 0,
      reasonCode: 'no_match',
    };
  }

  if (verified.kind === 'exact') {
    return {
      projectedPath,
      projectedLineStart: verified.start,
      projectedLineEnd: verified.end,
      status: mapped.overlapTouched ? 'shifted' : 'exact',
      confidence: mapped.overlapTouched ? 0.84 : 0.96,
      reasonCode: verified.reason,
    };
  }

  if (verified.kind === 'ambiguous') {
    return {
      projectedPath,
      projectedLineStart: mapped.start,
      projectedLineEnd: mapped.end,
      status: 'ambiguous',
      confidence: 0.52,
      reasonCode: mapped.overlapTouched ? 'diff_hunk_overlap' : 'fuzzy_context',
    };
  }

  if (mapped.overlapTouched) {
    return {
      projectedPath,
      projectedLineStart: null,
      projectedLineEnd: null,
      status: 'outdated',
      confidence: 0.2,
      reasonCode: 'diff_hunk_overlap',
    };
  }

  return {
    projectedPath,
    projectedLineStart: mapped.start,
    projectedLineEnd: mapped.end,
    status: 'shifted',
    confidence: 0.7,
    reasonCode: 'diff_hunk_map',
  };
}

async function resolveRenamePath(
  baseRef: { orgId: string; projectId: string; repo: string },
  fromCommit: string,
  toCommit: string,
  anchorPath: string,
): Promise<string | null> {
  const output = await codebaseService.diffNameStatus(
    { ...baseRef, ref: toCommit },
    fromCommit,
    toCommit,
    anchorPath,
    { syncPolicy: 'never' },
  );
  const lines = output.split('\n').map((item) => item.trim()).filter(Boolean);
  if (lines.length === 0) {
    const exists = await codebaseService.getBlobSha({ ...baseRef, ref: toCommit }, anchorPath, { syncPolicy: 'never' });
    return exists ? anchorPath : null;
  }

  for (const line of lines) {
    const parsed = parseNameStatus(line);
    if (!parsed) continue;
    if (parsed.kind === 'rename' && parsed.fromPath === anchorPath) {
      return parsed.toPath;
    }
    if (parsed.kind === 'modify' && parsed.path === anchorPath) {
      return anchorPath;
    }
    if (parsed.kind === 'delete' && parsed.path === anchorPath) {
      return null;
    }
  }

  const exists = await codebaseService.getBlobSha({ ...baseRef, ref: toCommit }, anchorPath, { syncPolicy: 'never' });
  return exists ? anchorPath : null;
}

function parseNameStatus(line: string):
  | { kind: 'rename'; fromPath: string; toPath: string }
  | { kind: 'modify'; path: string }
  | { kind: 'delete'; path: string }
  | null {
  const parts = line.split('\t');
  if (parts.length < 2) return null;
  const status = parts[0] ?? '';
  if (status.startsWith('R') || status.startsWith('C')) {
    const fromPath = normalizeDiffPath(parts[1] ?? '');
    const toPath = normalizeDiffPath(parts[2] ?? '');
    if (!fromPath || !toPath) return null;
    return { kind: 'rename', fromPath, toPath };
  }
  if (status.startsWith('D')) {
    return { kind: 'delete', path: normalizeDiffPath(parts[1] ?? '') };
  }
  return { kind: 'modify', path: normalizeDiffPath(parts[1] ?? '') };
}

function parseHunksForPath(diff: string, oldPath: string, newPath: string): DiffHunk[] {
  const lines = diff.split('\n');
  const hunks: DiffHunk[] = [];
  let currentOld = '';
  let currentNew = '';

  for (const line of lines) {
    if (line.startsWith('--- ')) {
      currentOld = normalizeDiffPath(line.slice(4));
      continue;
    }
    if (line.startsWith('+++ ')) {
      currentNew = normalizeDiffPath(line.slice(4));
      continue;
    }
    if (!line.startsWith('@@ ')) continue;
    const matchesCurrent = (currentOld === oldPath && currentNew === newPath)
      || (currentOld === oldPath && !currentNew && !newPath)
      || (!currentOld && currentNew === newPath);
    if (!matchesCurrent) continue;
    const hunk = parseHunkHeader(line);
    if (hunk) {
      hunks.push(hunk);
    }
  }

  return hunks.sort((a, b) => a.oldStart - b.oldStart);
}

function parseHunkHeader(line: string): DiffHunk | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;
  const oldStart = Number(match[1]);
  const oldCount = Number(match[2] ?? '1');
  const newStart = Number(match[3]);
  const newCount = Number(match[4] ?? '1');
  if (!Number.isFinite(oldStart) || !Number.isFinite(oldCount) || !Number.isFinite(newStart) || !Number.isFinite(newCount)) {
    return null;
  }
  return {
    oldStart,
    oldCount,
    newStart,
    newCount,
  };
}

function mapLineRangeByHunks(start: number, end: number, hunks: DiffHunk[]) {
  let delta = 0;
  let overlapTouched = false;
  for (const hunk of hunks) {
    const oldStart = hunk.oldStart;
    const oldCount = hunk.oldCount;
    const newCount = hunk.newCount;
    if (oldCount === 0) {
      if (start >= oldStart) {
        delta += newCount;
      }
      continue;
    }
    const oldEnd = oldStart + oldCount - 1;
    if (end < oldStart) {
      continue;
    }
    if (start > oldEnd) {
      delta += newCount - oldCount;
      continue;
    }
    overlapTouched = true;
    delta += newCount - oldCount;
  }
  const mappedStart = Math.max(1, start + delta);
  const mappedEnd = Math.max(mappedStart, end + delta);
  return {
    start: mappedStart,
    end: mappedEnd,
    overlapTouched,
  };
}

async function verifyWithContext(args: {
  orgId: string;
  projectId: string;
  repo: string;
  targetCommitSha: string;
  projectedPath: string;
  mappedStart: number;
  mappedEnd: number;
  anchor: ThreadAnchorSnapshot;
}): Promise<
  | { kind: 'missing' }
  | { kind: 'exact'; start: number; end: number; reason: ThreadProjectionReason }
  | { kind: 'ambiguous' }
  | { kind: 'none' }
> {
  const file = await codebaseService.readFile(
    {
      orgId: args.orgId,
      projectId: args.projectId,
      repo: args.repo,
      ref: args.targetCommitSha,
    },
    args.projectedPath,
    { syncPolicy: 'never' },
  );
  if (file.isBinary || file.truncated) return { kind: 'none' };
  if (!file.content && file.size > 0) return { kind: 'missing' };
  const lines = file.content.split('\n');
  const mappedStart = clamp(args.mappedStart, 1, Math.max(1, lines.length));
  const mappedEnd = clamp(args.mappedEnd, mappedStart, Math.max(mappedStart, lines.length));

  const selection = args.anchor.anchorSelectionText?.trim() ?? '';
  if (selection) {
    const matches = findSelectionMatches(lines, selection);
    if (matches.length > 1) {
      return { kind: 'ambiguous' };
    }
    if (matches.length === 1) {
      const match = matches[0];
      if (match) {
        return { kind: 'exact', start: match.start, end: match.end, reason: 'fuzzy_context' };
      }
    }
  }

  const beforeScore = compareContextBefore(lines, mappedStart, args.anchor.anchorContextBefore);
  const afterScore = compareContextAfter(lines, mappedEnd, args.anchor.anchorContextAfter);
  const contextScore = beforeScore + afterScore;
  if (contextScore >= 0.9) {
    return { kind: 'exact', start: mappedStart, end: mappedEnd, reason: 'fuzzy_context' };
  }
  if (contextScore >= 0.45) {
    return { kind: 'exact', start: mappedStart, end: mappedEnd, reason: 'diff_hunk_map' };
  }
  return { kind: 'none' };
}

function findSelectionMatches(lines: string[], selectionText: string): SelectionMatch[] {
  const selectionLines = selectionText.split('\n');
  const window = selectionLines.map((line) => normalizeLine(line));
  if (window.length === 0 || window.every((line) => !line)) return [];

  const matches: SelectionMatch[] = [];
  const maxStart = lines.length - window.length;
  for (let i = 0; i <= maxStart; i += 1) {
    let same = true;
    for (let j = 0; j < window.length; j += 1) {
      if (normalizeLine(lines[i + j] ?? '') !== window[j]) {
        same = false;
        break;
      }
    }
    if (same) {
      matches.push({ start: i + 1, end: i + window.length });
      if (matches.length > 3) {
        break;
      }
    }
  }
  return matches;
}

function compareContextBefore(lines: string[], startLine: number, context: string | null): number {
  if (!context) return 0;
  const contextLines = context.split('\n').map((line) => normalizeLine(line)).filter(Boolean);
  if (contextLines.length === 0) return 0;
  const from = Math.max(0, startLine - 1 - contextLines.length);
  const actual = lines.slice(from, startLine - 1).map((line) => normalizeLine(line));
  return arraysEqual(contextLines, actual) ? 0.5 : 0;
}

function compareContextAfter(lines: string[], endLine: number, context: string | null): number {
  if (!context) return 0;
  const contextLines = context.split('\n').map((line) => normalizeLine(line)).filter(Boolean);
  if (contextLines.length === 0) return 0;
  const actual = lines.slice(endLine, endLine + contextLines.length).map((line) => normalizeLine(line));
  return arraysEqual(contextLines, actual) ? 0.5 : 0;
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function normalizeDiffPath(pathToken: string) {
  const value = pathToken.trim();
  if (value === '/dev/null') return '';
  if (value.startsWith('a/') || value.startsWith('b/')) return value.slice(2);
  return value;
}

function normalizeLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
