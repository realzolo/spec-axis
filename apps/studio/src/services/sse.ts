/**
 * Server-Sent Events (SSE) service
 * Streams analysis progress updates
 */

import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { logger } from './logger';
import { failTimedOutReport } from './reportTimeout';

interface SSEClient {
  reportId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

const clients = new Map<string, SSEClient[]>();
const pollers = new Map<string, NodeJS.Timeout>();
const lastSnapshots = new Map<string, {
  status: string | null;
  score: number | null;
  sseSeq: number | null;
  analysisProgressJson: string;
  analysisSectionsJson: string;
  tokenUsageJson: string;
  tokensUsed: number | null;
  errorMessage: string | null;
}>();

/**
 * Create SSE response
 */
export function createSSEResponse(reportId: string) {
  let clientRef: SSEClient | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (clientRef) {
      const clientList = clients.get(reportId);
      if (clientList) {
        const index = clientList.indexOf(clientRef);
        if (index > -1) {
          clientList.splice(index, 1);
        }
        if (clientList.length === 0) {
          clients.delete(reportId);
          stopPolling(reportId);
        }
      }
    }
    logger.info(`SSE client disconnected: ${reportId}`);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const client: SSEClient = { reportId, controller };
      clientRef = client;

      // Add client to list
      if (!clients.has(reportId)) {
        clients.set(reportId, []);
      }
      clients.get(reportId)!.push(client);

      logger.info(`SSE client connected: ${reportId}`);

      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Heartbeat to keep connection alive
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (err) {
          logger.warn(`Failed to send heartbeat to ${reportId}`, err instanceof Error ? err : undefined);
          cleanup();
        }
      }, 30000);

      // Handle client disconnect
      const abortHandler = () => cleanup();
      try {
        // Try abort event if supported
        const controllerWithSignal = controller as ReadableStreamDefaultController<Uint8Array> & {
          signal?: { addEventListener?: (event: string, handler: () => void) => void };
        };
        controllerWithSignal.signal?.addEventListener?.('abort', abortHandler);
      } catch {
        // Ignore if not supported
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Broadcast updates to all connected clients
 */
export function broadcastUpdate(reportId: string, data: Record<string, unknown>) {
  const clientList = clients.get(reportId);
  if (!clientList || clientList.length === 0) {
    return;
  }

  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = encoder.encode(message);

  for (let i = clientList.length - 1; i >= 0; i -= 1) {
    const client = clientList[i];
    if (!client) {
      clientList.splice(i, 1);
      continue;
    }
    try {
      client.controller.enqueue(encoded);
    } catch (err) {
      logger.warn(`Failed to send SSE message to ${reportId}`, err instanceof Error ? err : undefined);
      clientList.splice(i, 1);
    }
  }

  if (clientList.length === 0) {
    clients.delete(reportId);
    stopPolling(reportId);
  }
}

/**
 * Watch report status updates and broadcast changes
 */
export async function watchReportStatus(reportId: string) {
  if (pollers.has(reportId)) {
    return null;
  }

  const poll = async () => {
    if (!clients.has(reportId)) {
      stopPolling(reportId);
      return;
    }

    await failTimedOutReport(reportId);

    const row = await queryOne<{
      status: string | null;
      score: number | null;
      sse_seq: number | null;
      analysis_progress: unknown;
      sections: unknown;
      token_usage: unknown;
      tokens_used: number | null;
      error_message: string | null;
    }>(
      `select r.status,
              r.score,
              r.sse_seq,
              r.analysis_progress,
              r.token_usage,
              r.tokens_used,
              r.error_message,
              coalesce((
                select jsonb_agg(
                         jsonb_build_object(
                           'phase', s.phase,
                           'attempt', s.attempt,
                           'status', s.status,
                           'payload', s.payload,
                           'errorMessage', s.error_message,
                           'durationMs', s.duration_ms,
                           'tokensUsed', s.tokens_used,
                           'tokenUsage', s.token_usage,
                           'estimatedCostUsd', s.estimated_cost_usd,
                           'startedAt', s.started_at,
                           'completedAt', s.completed_at,
                           'updatedAt', s.updated_at
                         )
                         order by case s.phase
                           when 'core' then 1
                           when 'quality' then 2
                           when 'security_performance' then 3
                           when 'suggestions' then 4
                           else 99
                         end,
                         s.attempt desc
                       )
                from analysis_report_sections s
                where s.report_id = r.id
              ), '[]'::jsonb) as sections
       from analysis_reports r
       where r.id = $1`,
      [reportId]
    );

    if (!row) return;

    const analysisProgressJson = JSON.stringify(row.analysis_progress ?? null);
    const analysisSectionsJson = JSON.stringify(row.sections ?? []);
    const tokenUsageJson = JSON.stringify(row.token_usage ?? null);
    const previous = lastSnapshots.get(reportId);
    if (
      !previous ||
      previous.sseSeq !== row.sse_seq ||
      previous.status !== row.status ||
      previous.score !== row.score ||
      previous.analysisProgressJson !== analysisProgressJson ||
      previous.analysisSectionsJson !== analysisSectionsJson ||
      previous.tokenUsageJson !== tokenUsageJson ||
      previous.tokensUsed !== row.tokens_used ||
      previous.errorMessage !== row.error_message
    ) {
      lastSnapshots.set(reportId, {
        status: row.status,
        score: row.score,
        sseSeq: row.sse_seq,
        analysisProgressJson,
        analysisSectionsJson,
        tokenUsageJson,
        tokensUsed: row.tokens_used,
        errorMessage: row.error_message,
      });
      broadcastUpdate(reportId, {
        type: 'status_update',
        status: row.status,
        score: row.score,
        sequence: row.sse_seq,
        analysisProgress: row.analysis_progress ?? null,
        analysisSections: row.sections ?? [],
        tokenUsage: row.token_usage ?? null,
        tokensUsed: row.tokens_used ?? null,
        errorMessage: row.error_message ?? null,
        timestamp: new Date().toISOString(),
      });
      logger.info(`Report status updated: ${reportId} -> ${row.status}`);
    }

    if (
      row.status === 'done' ||
      row.status === 'partial_done' ||
      row.status === 'partial_failed' ||
      row.status === 'failed' ||
      row.status === 'canceled'
    ) {
      stopPolling(reportId);
    }
  };

  await poll();
  const interval = setInterval(() => {
    void poll();
  }, 2000);
  pollers.set(reportId, interval);

  return null;
}

/**
 * Cleanup all SSE connections
 */
export function cleanupSSEConnections() {
  clients.forEach((clientList) => {
    clientList.forEach((client) => {
      try {
        client.controller.close();
      } catch {
        // Ignore close errors
      }
    });
  });
  clients.clear();
}

function stopPolling(reportId: string) {
  const interval = pollers.get(reportId);
  if (interval) {
    clearInterval(interval);
  }
  pollers.delete(reportId);
  lastSnapshots.delete(reportId);
}
