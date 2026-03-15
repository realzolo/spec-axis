/**
 * Server-Sent Events (SSE) service
 * Streams analysis progress updates
 */

import { NextResponse } from 'next/server';
import { connect, type NatsConnection, StringCodec } from 'nats';
import { queryOne } from '@/lib/db';
import { logger } from './logger';

interface SSEClient {
  reportId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

const clients = new Map<string, SSEClient[]>();
const natsUrl = process.env.NATS_URL;
let natsConnPromise: Promise<NatsConnection | null> | null = null;
let natsSubscribed = false;
const pollers = new Map<string, NodeJS.Timeout>();
const lastSnapshots = new Map<string, { status: string | null; score: number | null }>();

async function getNatsConnection() {
  if (!natsUrl) return null;
  if (!natsConnPromise) {
    natsConnPromise = connect({ servers: natsUrl }).catch((err) => {
      logger.warn('Failed to connect to NATS', err instanceof Error ? err : undefined);
      natsConnPromise = null;
      return null;
    });
  }
  return natsConnPromise;
}

async function ensureNatsSubscription() {
  if (natsSubscribed || !natsUrl) return;
  const conn = await getNatsConnection();
  if (!conn) return;
  natsSubscribed = true;

  const sc = StringCodec();
  const sub = conn.subscribe('reports.*.status');
  (async () => {
    for await (const msg of sub) {
      try {
        const payload = JSON.parse(sc.decode(msg.data)) as Record<string, unknown>;
        const subjectParts = msg.subject.split('.');
        const reportId = subjectParts.length >= 2 ? subjectParts[1] : (payload.reportId as string);
        if (!reportId) continue;
        if (!payload.reportId) payload.reportId = reportId;
        broadcastUpdate(reportId, payload);
      } catch (err) {
        logger.warn('Failed to parse NATS message', err instanceof Error ? err : undefined);
      }
    }
  })().catch((err) => {
    logger.warn('NATS subscription error', err instanceof Error ? err : undefined);
  });
}

/**
 * Create SSE response
 */
export function createSSEResponse(reportId: string) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const client: SSEClient = { reportId, controller };

      // Add client to list
      if (!clients.has(reportId)) {
        clients.set(reportId, []);
      }
      clients.get(reportId)!.push(client);

      logger.info(`SSE client connected: ${reportId}`);

      // Ensure NATS subscription is active (optional)
      void ensureNatsSubscription();

      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup
      const cleanup = () => {
        clearInterval(heartbeat);
        const clientList = clients.get(reportId);
        if (clientList) {
          const index = clientList.indexOf(client);
          if (index > -1) {
            clientList.splice(index, 1);
          }
          if (clientList.length === 0) {
            clients.delete(reportId);
          }
        }
        logger.info(`SSE client disconnected: ${reportId}`);
      };

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

  clientList.forEach((client) => {
    try {
      client.controller.enqueue(encoded);
    } catch (err) {
      logger.warn(`Failed to send SSE message to ${reportId}`, err instanceof Error ? err : undefined);
    }
  });
}

/**
 * Watch report status updates and broadcast changes
 */
export async function watchReportStatus(reportId: string) {
  if (process.env.NATS_URL) {
    return null;
  }

  if (pollers.has(reportId)) {
    return null;
  }

  const poll = async () => {
    if (!clients.has(reportId)) {
      stopPolling(reportId);
      return;
    }

    const row = await queryOne<{ status: string | null; score: number | null }>(
      `select status, score from analysis_reports where id = $1`,
      [reportId]
    );

    if (!row) return;

    const previous = lastSnapshots.get(reportId);
    if (!previous || previous.status !== row.status || previous.score !== row.score) {
      lastSnapshots.set(reportId, { status: row.status, score: row.score });
      broadcastUpdate(reportId, {
        type: 'status_update',
        status: row.status,
        score: row.score,
        timestamp: new Date().toISOString(),
      });
      logger.info(`Report status updated: ${reportId} -> ${row.status}`);
    }

    if (row.status === 'done' || row.status === 'failed') {
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
