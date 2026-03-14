/**
 * Server-Sent Events (SSE) service
 * Streams analysis progress updates
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from './logger';

interface SSEClient {
  reportId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

const clients = new Map<string, SSEClient[]>();

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
  const supabase = await createClient();

  const subscription = supabase
    .channel(`report:${reportId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'reports',
        filter: `id=eq.${reportId}`,
      },
      (payload: Record<string, unknown>) => {
        const report = (payload.new as Record<string, unknown>) || {};
        broadcastUpdate(reportId, {
          type: 'status_update',
          status: report.status,
          score: report.score,
          progress: report.progress,
          timestamp: new Date().toISOString(),
        });

        logger.info(`Report status updated: ${reportId} -> ${report.status}`);
      }
    )
    .subscribe();

  return subscription;
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
