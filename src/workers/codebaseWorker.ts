import { Worker, type ConnectionOptions } from 'bullmq';

import { codebaseService, type PreparedWorkspace } from '@/services/CodebaseService';
import { logger } from '@/services/logger';

export type CodebaseAnalyzeJob = {
  orgId: string;
  projectId: string;
  repo: string;
  ref?: string;
  reportId?: string;
  forceSync?: boolean;
};

export function startCodebaseWorker() {
  const connection = getRedisConnection();
  const concurrency = readNumberEnv('BULLMQ_CONCURRENCY', 2);

  const worker = new Worker<CodebaseAnalyzeJob>(
    'codebase-analyze',
    async (job) => {
      const workspace = await codebaseService.prepareWorkspace(
        {
          orgId: job.data.orgId,
          projectId: job.data.projectId,
          repo: job.data.repo,
          ref: job.data.ref,
        },
        { forceSync: job.data.forceSync }
      );

      try {
        await runAiAnalysis(workspace, job.data);
        return { workspaceId: workspace.workspaceId, ref: workspace.ref };
      } finally {
        await codebaseService.cleanupWorkspace(workspace);
      }
    },
    { connection, concurrency }
  );

  worker.on('completed', (job) => {
    logger.info(`BullMQ job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(
      `BullMQ job failed: ${job?.id ?? 'unknown'}`,
      err instanceof Error ? err : undefined
    );
  });

  return worker;
}

function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is required to start the BullMQ worker');
  }

  const parsed = new URL(url);
  const port = parsed.port ? Number(parsed.port) : 6379;
  const db = parsed.pathname ? Number(parsed.pathname.replace('/', '')) : undefined;

  return {
    host: parsed.hostname,
    port: Number.isFinite(port) ? port : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function runAiAnalysis(workspace: PreparedWorkspace, job: CodebaseAnalyzeJob) {
  logger.info(
    `AI analysis placeholder for ${job.repo} (${job.ref ?? 'default'}) in ${workspace.workspacePath}`
  );
  // Hook your AI pipeline here (diff extraction, embeddings, model calls, report writes, etc.).
}
