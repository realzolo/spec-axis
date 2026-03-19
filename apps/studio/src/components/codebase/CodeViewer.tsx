'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  highlightSpecialChars,
} from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { resolveLanguageSupportForPath } from '@/lib/codeLanguage';

export type CodeSelectionPayload = {
  lineStart: number;
  lineEnd: number;
  from: number;
  to: number;
  text: string;
  clientX: number;
  clientY: number;
};

export type CodeLineClickPayload = {
  line: number;
  shiftKey: boolean;
  clientX: number;
  clientY: number;
};

type CodeViewerProps = {
  value: string;
  language: string;
  onSelection?: (payload: CodeSelectionPayload) => void;
  onLineClick?: (payload: CodeLineClickPayload) => void;
  commentLines?: number[];
  commentLinePreviews?: Record<number, string>;
  activeCommentLine?: number | null;
  commentSelectionRange?: { from: number; to: number } | null;
  onReady?: (view: EditorView) => void;
  className?: string;
};

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: '12px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
  },
  '.cm-content': {
    padding: '10px 0',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid hsl(var(--border))',
    color: 'hsl(var(--muted-foreground))',
    paddingLeft: '8px',
    paddingRight: '8px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '40px',
    textAlign: 'right',
    cursor: 'pointer',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(var(--muted) / 0.45)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'hsl(var(--accent) / 0.25)',
  },
  '.cm-line.cm-line-commented': {
    backgroundColor: 'hsl(var(--ds-accent-7) / 0.10)',
    boxShadow: 'inset 2px 0 0 hsl(var(--ds-accent-7) / 0.60)',
  },
  '.cm-line.cm-line-comment-active': {
    backgroundColor: 'hsl(var(--ds-accent-8) / 0.16)',
    boxShadow: 'inset 3px 0 0 hsl(var(--ds-accent-8) / 0.90)',
  },
  '.cm-comment-gutter': {
    width: '10px',
  },
  '.cm-comment-gutter .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  '.cm-comment-marker': {
    width: '6px',
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'hsl(var(--ds-accent-7) / 0.75)',
  },
  '.cm-comment-marker-active': {
    width: '7px',
    height: '7px',
    borderRadius: '999px',
    backgroundColor: 'hsl(var(--ds-accent-8))',
    boxShadow: '0 0 0 2px hsl(var(--ds-accent-8) / 0.2)',
  },
  '.cm-comment-marker-empty': {
    width: '6px',
    height: '6px',
    borderRadius: '999px',
    opacity: 0,
  },
  '.cm-comment-selection': {
    textDecoration: 'underline 2px hsl(var(--ds-accent-8) / 0.95)',
    textUnderlineOffset: '2px',
    textDecorationSkipInk: 'auto',
    backgroundColor: 'hsl(var(--ds-accent-8) / 0.07)',
  },
});

const codeHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'hsl(var(--ds-text-2))', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'hsl(var(--ds-accent-8))' },
  { tag: [tags.typeName, tags.className], color: 'hsl(var(--ds-accent-9))' },
  { tag: [tags.string, tags.regexp], color: 'hsl(var(--ds-success-7))' },
  { tag: [tags.number, tags.bool, tags.null], color: 'hsl(var(--ds-warning-7))' },
  { tag: [tags.propertyName, tags.attributeName], color: 'hsl(var(--ds-accent-9))' },
  { tag: [tags.tagName], color: 'hsl(var(--ds-danger-7))' },
  { tag: [tags.variableName], color: 'hsl(var(--ds-text-1))' },
  { tag: [tags.operator, tags.punctuation], color: 'hsl(var(--ds-text-1))' },
]);

export default function CodeViewer({
  value,
  language,
  onSelection,
  onLineClick,
  commentLines = [],
  commentLinePreviews = {},
  activeCommentLine = null,
  commentSelectionRange = null,
  onReady,
  className,
}: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useMemo(() => new Compartment(), []);
  const commentVisualCompartment = useMemo(() => new Compartment(), []);
  const onSelectionRef = useRef(onSelection);
  const onLineClickRef = useRef(onLineClick);
  const onReadyRef = useRef(onReady);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onSelectionRef.current = onSelection;
  }, [onSelection]);

  useEffect(() => {
    onLineClickRef.current = onLineClick;
  }, [onLineClick]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;

    const domHandlers = EditorView.domEventHandlers({
      mouseup: (event, view) => {
        if (event.button !== 0) return false;
        const handler = onSelectionRef.current;
        if (!handler) return false;
        const selection = view.state.selection.main;
        if (selection.empty) return false;
        const text = view.state.doc.sliceString(selection.from, selection.to);
        if (!text.trim()) return false;
        const fromLine = view.state.doc.lineAt(selection.from).number;
        let toLine = view.state.doc.lineAt(selection.to).number;
        const toLineStart = view.state.doc.line(toLine).from;
        if (selection.to === toLineStart && selection.to > selection.from) {
          toLine = Math.max(fromLine, toLine - 1);
        }
        const coords = view.coordsAtPos(selection.to) ?? view.coordsAtPos(selection.from);
        if (!coords) return false;
        handler({
          lineStart: Math.min(fromLine, toLine),
          lineEnd: Math.max(fromLine, toLine),
          from: selection.from,
          to: selection.to,
          text,
          clientX: coords.left,
          clientY: coords.bottom,
        });
        return false;
      },
      click: (event, view) => {
        if (event.button !== 0) return false;
        const handler = onLineClickRef.current;
        if (!handler) return false;

        // Keep text selection behavior independent from click-to-open thread.
        if (!view.state.selection.main.empty) return false;

        const target = event.target as HTMLElement | null;
        if (!target) return false;

        // Support two click entry points:
        // 1) gutter line numbers/markers (create/open comment on line)
        // 2) highlighted comment lines in content area (open existing thread)
        const clickedGutter = Boolean(target.closest('.cm-gutters'));
        const clickedCommentedLine = Boolean(target.closest('.cm-line-commented, .cm-line-comment-active'));
        if (!clickedGutter && !clickedCommentedLine) return false;

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) return false;
        const line = view.state.doc.lineAt(pos).number;
        const linePos = view.state.doc.line(line).from;
        const coords = view.coordsAtPos(linePos);
        handler({
          line,
          shiftKey: event.shiftKey,
          clientX: coords?.left ?? event.clientX,
          clientY: coords?.bottom ?? event.clientY,
        });
        return false;
      },
    });

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        commentVisualCompartment.of([]),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        drawSelection(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        syntaxHighlighting(codeHighlightStyle, { fallback: true }),
        languageCompartment.of([]),
        domHandlers,
        editorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    onReadyRef.current?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [commentVisualCompartment, languageCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    let cancelled = false;

    const applyLanguage = async () => {
      const resolved = await resolveLanguageSupportForPath(language);
      if (cancelled) return;
      view.dispatch({
        effects: languageCompartment.reconfigure(resolved ? [resolved] : []),
      });
    };

    void applyLanguage();

    return () => {
      cancelled = true;
    };
  }, [language, languageCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const effect = commentVisualCompartment.reconfigure(
      buildCommentVisualExtension(view, {
        commentLines,
        commentLinePreviews,
        activeCommentLine,
        commentSelectionRange,
      })
    );
    view.dispatch({ effects: effect });
  }, [activeCommentLine, commentLinePreviews, commentLines, commentSelectionRange, commentVisualCompartment, value]);

  return <div ref={containerRef} className={className} />;
}

function buildCommentVisualExtension(
  view: EditorView,
  options: {
    commentLines: number[];
    commentLinePreviews: Record<number, string>;
    activeCommentLine: number | null;
    commentSelectionRange: { from: number; to: number } | null;
  }
) {
  const { commentLines, commentLinePreviews, activeCommentLine, commentSelectionRange } = options;
  const normalizedLines = Array.from(new Set(
    commentLines
      .map((line) => Math.trunc(line))
      .filter((line) => Number.isFinite(line) && line > 0)
  )).sort((a, b) => a - b);

  const lineSet = new Set(normalizedLines);
  return [
    EditorView.decorations.of(
      buildCommentLineDecorations(view, normalizedLines, activeCommentLine)
    ),
    EditorView.decorations.of(
      buildCommentSelectionDecoration(view, commentSelectionRange)
    ),
    gutter({
      class: 'cm-comment-gutter',
      markers: () => buildCommentLineMarkers(view, normalizedLines, activeCommentLine, commentLinePreviews),
      initialSpacer: () => (lineSet.size > 0 ? inactiveCommentMarker : emptyCommentMarker),
      lineMarker: (_view, blockInfo) => {
        const lineNumber = view.state.doc.lineAt(blockInfo.from).number;
        if (!lineSet.has(lineNumber)) return null;
        const preview = commentLinePreviews[lineNumber];
        return activeCommentLine === lineNumber
          ? new CommentMarker('cm-comment-marker-active', preview)
          : new CommentMarker('cm-comment-marker', preview);
      },
    }),
  ];
}

function buildCommentLineDecorations(
  view: EditorView,
  commentLines: number[],
  activeCommentLine: number | null
) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const lineNumber of commentLines) {
    if (lineNumber > view.state.doc.lines) continue;
    const line = view.state.doc.line(lineNumber);
    builder.add(
      line.from,
      line.from,
      Decoration.line({
        class: activeCommentLine === lineNumber ? 'cm-line-comment-active' : 'cm-line-commented',
      })
    );
  }

  return builder.finish();
}

function buildCommentSelectionDecoration(
  view: EditorView,
  commentSelectionRange: { from: number; to: number } | null
) {
  const builder = new RangeSetBuilder<Decoration>();
  if (!commentSelectionRange) {
    return builder.finish();
  }
  const docLength = view.state.doc.length;
  const from = clamp(commentSelectionRange.from, 0, docLength);
  const to = clamp(commentSelectionRange.to, 0, docLength);
  if (to <= from) return builder.finish();
  builder.add(from, to, Decoration.mark({ class: 'cm-comment-selection' }));
  return builder.finish();
}

function buildCommentLineMarkers(
  view: EditorView,
  commentLines: number[],
  activeCommentLine: number | null,
  commentLinePreviews: Record<number, string>
) {
  const builder = new RangeSetBuilder<GutterMarker>();
  for (const lineNumber of commentLines) {
    if (lineNumber > view.state.doc.lines) continue;
    const from = view.state.doc.line(lineNumber).from;
    const preview = commentLinePreviews[lineNumber];
    builder.add(
      from,
      from,
      activeCommentLine === lineNumber
        ? new CommentMarker('cm-comment-marker-active', preview)
        : new CommentMarker('cm-comment-marker', preview)
    );
  }
  return builder.finish();
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

class CommentMarker extends GutterMarker {
  constructor(
    private readonly markerClassName: string,
    private readonly preview?: string
  ) {
    super();
  }

  eq(other: CommentMarker) {
    return other.markerClassName === this.markerClassName && other.preview === this.preview;
  }

  toDOM() {
    const element = document.createElement('span');
    element.className = this.markerClassName;
    if (this.preview) {
      element.title = this.preview;
    }
    return element;
  }
}

const inactiveCommentMarker = new CommentMarker('cm-comment-marker');
const emptyCommentMarker = new CommentMarker('cm-comment-marker-empty');
