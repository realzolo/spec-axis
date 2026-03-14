/**
 * 任务队列服务
 * 使用 Supabase 作为队列存储，支持并发控制
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from './logger';

export interface QueuedTask {
  id: string;
  type: 'analyze' | 'export' | 'learn';
  projectId: string;
  reportId?: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number; // 1-10，10 最高
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const MAX_CONCURRENT_TASKS = 3;
const MAX_RETRIES = 3;

class TaskQueue {
  private processingTasks = new Map<string, Promise<void>>();

  async enqueue(
    type: QueuedTask['type'],
    projectId: string,
    payload: Record<string, unknown>,
    priority: number = 5,
    reportId?: string
  ): Promise<string> {
    const db = createAdminClient();

    const { data, error } = await db
      .from('task_queue')
      .insert({
        type,
        project_id: projectId,
        report_id: reportId,
        payload,
        status: 'pending',
        priority,
        attempts: 0,
        max_attempts: MAX_RETRIES,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to enqueue task', error);
      throw error;
    }

    logger.info(`Task enqueued: ${data.id} (type: ${type}, priority: ${priority})`);
    return data.id;
  }

  async process(handler: (task: QueuedTask) => Promise<void>) {
    const db = createAdminClient();

    while (true) {
      // 检查是否有空闲的处理槽位
      if (this.processingTasks.size >= MAX_CONCURRENT_TASKS) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      // 获取下一个待处理任务（按优先级排序）
      const { data: tasks, error } = await db
        .from('task_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);

      if (error || !tasks || tasks.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      const task = mapTask(tasks[0]);

      // 标记为处理中
      await db
        .from('task_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      // 异步处理任务
      const promise = this.executeTask(task, handler, db);
      this.processingTasks.set(task.id, promise);

      promise.finally(() => {
        this.processingTasks.delete(task.id);
      });
    }
  }

  async processOnce(handler: (task: QueuedTask) => Promise<void>): Promise<boolean> {
    const db = createAdminClient();

    const { data: tasks, error } = await db
      .from('task_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !tasks || tasks.length === 0) {
      return false;
    }

    const task = mapTask(tasks[0]);

    const { data: updated, error: updateError } = await db
      .from('task_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .eq('status', 'pending')
      .select()
      .single();

    if (updateError || !updated) {
      return false;
    }

    await this.executeTask(task, handler, db);
    return true;
  }

  private async executeTask(
    task: QueuedTask,
    handler: (task: QueuedTask) => Promise<void>,
    db: ReturnType<typeof createAdminClient>
  ) {
    try {
      logger.setContext({ taskId: task.id, projectId: task.projectId });
      logger.info(`Processing task: ${task.type}`);

      await handler(task);

      // 标记为完成
      await db
        .from('task_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      logger.info(`Task completed: ${task.id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`Task failed: ${task.id}`, error);

      // 检查是否需要重试
      if (task.attempts < task.maxAttempts) {
        await db
          .from('task_queue')
          .update({
            status: 'pending',
            attempts: task.attempts + 1,
            error: error.message,
          })
          .eq('id', task.id);

        logger.info(`Task requeued: ${task.id} (attempt ${task.attempts + 1}/${task.maxAttempts})`);
      } else {
        // 标记为失败
        await db
          .from('task_queue')
          .update({
            status: 'failed',
            error: error.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        logger.error(`Task failed permanently: ${task.id}`);
      }
    } finally {
      logger.clearContext();
    }
  }

  async getTaskStatus(taskId: string): Promise<QueuedTask | null> {
    const db = createAdminClient();
    const { data, error } = await db
      .from('task_queue')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      logger.warn(`Failed to get task status: ${taskId}`, error);
      return null;
    }

    return data as QueuedTask;
  }
}

export const taskQueue = new TaskQueue();

function mapTask(row: Record<string, unknown>): QueuedTask {
  return {
    id: row.id as string,
    type: row.type as QueuedTask['type'],
    projectId: row.project_id as string,
    reportId: (row.report_id as string) || undefined,
    payload: (row.payload as Record<string, unknown>) || {},
    status: row.status as QueuedTask['status'],
    priority: row.priority as number,
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    error: (row.error as string) || undefined,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string) || undefined,
    completedAt: (row.completed_at as string) || undefined,
  };
}
