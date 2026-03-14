/**
 * Server-Sent Events 推送服务
 * 用于实时推送分析进度
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
 * 创建 SSE 响应
 */
export function createSSEResponse(reportId: string) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const client: SSEClient = { reportId, controller };

      // 添加客户端到列表
      if (!clients.has(reportId)) {
        clients.set(reportId, []);
      }
      clients.get(reportId)!.push(client);

      logger.info(`SSE client connected: ${reportId}`);

      // 发送初始连接消息
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // 设置心跳，保持连接活跃
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // 清理函数
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

      // 监听客户端断开连接
      const abortHandler = () => cleanup();
      try {
        // 尝试使用 abort 事件（如果支持）
        const controllerWithSignal = controller as ReadableStreamDefaultController<Uint8Array> & {
          signal?: { addEventListener?: (event: string, handler: () => void) => void };
        };
        controllerWithSignal.signal?.addEventListener?.('abort', abortHandler);
      } catch {
        // 如果不支持，忽略错误
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
 * 向所有连接的客户端广播消息
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
 * 监听报告状态变化并推送更新
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
 * 清理所有 SSE 连接
 */
export function cleanupSSEConnections() {
  clients.forEach((clientList) => {
    clientList.forEach((client) => {
      try {
        client.controller.close();
      } catch {
        // 忽略关闭错误
      }
    });
  });
  clients.clear();
}
