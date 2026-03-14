import { logger } from './logger';
import { QueuedTask } from './taskQueue';
import { runAnalyzeTask } from './analyzeTask';
import { updateReport } from './db';

export async function handleQueuedTask(task: QueuedTask) {
  switch (task.type) {
    case 'analyze': {
      if (!task.reportId) {
        throw new Error('分析任务缺少 reportId');
      }
      try {
        await runAnalyzeTask(task.projectId, task.payload as Parameters<typeof runAnalyzeTask>[1]);
      } catch (err) {
        const message = err instanceof Error ? err.message : '分析失败';
        await updateReport(task.reportId, { status: 'failed', error_message: message });
        throw err;
      }
      return;
    }
    case 'export':
    case 'learn':
    default:
      logger.warn(`Unhandled task type: ${task.type}`);
      return;
  }
}
