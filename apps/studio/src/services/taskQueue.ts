/**
 * Task queue service
 * Uses Postgres as a queue store with concurrency control
 */

import { exec, query, queryOne } from '@/lib/db';
import { logger } from './logger';

export interface QueuedTask {
  id: string;
  type: 'analyze' | 'export' | 'learn';
  projectId: string;
  reportId?: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number; // 1-10, 10 is highest
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
    const row = await queryOne<{ id: string }>(
      `insert into analysis_tasks
        (type, project_id, report_id, payload, status, priority, attempts, max_attempts, created_at, updated_at)
       values ($1,$2,$3,$4,'pending',$5,0,$6,now(),now())
       returning id`,
      [type, projectId, reportId ?? null, JSON.stringify(payload), priority, MAX_RETRIES]
    );

    if (!row) {
      throw new Error('Failed to enqueue task');
    }

    logger.info(`Task enqueued: ${row.id} (type: ${type}, priority: ${priority})`);
    return row.id;
  }

  async process(handler: (task: QueuedTask) => Promise<void>) {
    while (true) {
      if (this.processingTasks.size >= MAX_CONCURRENT_TASKS) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const task = await this.fetchNextTask();
      if (!task) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      const promise = this.executeTask(task, handler);
      this.processingTasks.set(task.id, promise);
      promise.finally(() => {
        this.processingTasks.delete(task.id);
      });
    }
  }

  async processOnce(handler: (task: QueuedTask) => Promise<void>): Promise<boolean> {
    const task = await this.fetchNextTask();
    if (!task) return false;
    await this.executeTask(task, handler);
    return true;
  }

  private async fetchNextTask(): Promise<QueuedTask | null> {
    const row = await queryOne<Record<string, any>>(
      `select *
       from analysis_tasks
       where status = 'pending'
       order by priority desc, created_at asc
       limit 1`
    );

    if (!row) return null;

    const updated = await queryOne<Record<string, any>>(
      `update analysis_tasks
       set status = 'processing', started_at = now(), updated_at = now()
       where id = $1 and status = 'pending'
       returning *`,
      [row.id]
    );

    if (!updated) return null;
    return mapTask(updated);
  }

  private async executeTask(task: QueuedTask, handler: (task: QueuedTask) => Promise<void>) {
    try {
      logger.setContext({ taskId: task.id, projectId: task.projectId });
      logger.info(`Processing task: ${task.type}`);

      await handler(task);

      await exec(
        `update analysis_tasks
         set status = 'completed', completed_at = now(), updated_at = now()
         where id = $1`,
        [task.id]
      );

      logger.info(`Task completed: ${task.id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`Task failed: ${task.id}`, error);

      if (task.attempts < task.maxAttempts) {
        await exec(
          `update analysis_tasks
           set status = 'pending', attempts = attempts + 1, error = $2, updated_at = now()
           where id = $1`,
          [task.id, error.message]
        );

        logger.info(`Task requeued: ${task.id} (attempt ${task.attempts + 1}/${task.maxAttempts})`);
      } else {
        await exec(
          `update analysis_tasks
           set status = 'failed', error = $2, completed_at = now(), updated_at = now()
           where id = $1`,
          [task.id, error.message]
        );

        logger.error(`Task failed permanently: ${task.id}`);
      }
    } finally {
      logger.clearContext();
    }
  }

  async getTaskStatus(taskId: string): Promise<QueuedTask | null> {
    const row = await queryOne<Record<string, any>>(
      `select * from analysis_tasks where id = $1`,
      [taskId]
    );
    return row ? mapTask(row) : null;
  }
}

export const taskQueue = new TaskQueue();

function mapTask(row: Record<string, any>): QueuedTask {
  return {
    id: row.id,
    type: row.type,
    projectId: row.project_id,
    reportId: row.report_id ?? undefined,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload ?? {},
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}
