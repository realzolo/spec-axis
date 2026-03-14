/**
 * 性能监控服务
 * 收集和记录关键性能指标
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from './logger';

export interface PerformanceMetric {
  reportId: string;
  name: string;
  value: number;
  unit?: string;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();

  /**
   * 记录性能指标
   */
  recordMetric(reportId: string, name: string, value: number, unit?: string) {
    const key = reportId;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push({
      reportId,
      name,
      value,
      unit,
    });

    logger.debug(`Metric recorded: ${name}=${value}${unit ? ` ${unit}` : ''}`);
  }

  /**
   * 获取指标统计
   */
  getMetricStats(reportId: string, metricName: string) {
    const metrics = this.metrics.get(reportId) || [];
    const filtered = metrics.filter((m) => m.name === metricName).map((m) => m.value);

    if (filtered.length === 0) {
      return null;
    }

    return {
      count: filtered.length,
      min: Math.min(...filtered),
      max: Math.max(...filtered),
      avg: filtered.reduce((a, b) => a + b, 0) / filtered.length,
      sum: filtered.reduce((a, b) => a + b, 0),
    };
  }

  /**
   * 保存指标到数据库
   */
  async saveMetrics(reportId: string) {
    const metrics = this.metrics.get(reportId);
    if (!metrics || metrics.length === 0) {
      return;
    }

    try {
      const db = createAdminClient();
      const records = metrics.map((m) => ({
        report_id: m.reportId,
        metric_name: m.name,
        metric_value: m.value,
        unit: m.unit,
      }));

      const { error } = await db.from('performance_metrics').insert(records);

      if (error) {
        logger.warn(`Failed to save metrics for ${reportId}`, error);
      } else {
        logger.info(`Saved ${records.length} metrics for ${reportId}`);
        this.metrics.delete(reportId);
      }
    } catch (err) {
      logger.error('Failed to save metrics', err instanceof Error ? err : undefined);
    }
  }

  /**
   * 清理指标
   */
  clearMetrics(reportId: string) {
    this.metrics.delete(reportId);
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * 测量异步操作的性能
 */
export async function measurePerformance<T>(
  reportId: string,
  metricName: string,
  fn: () => Promise<T>,
  unit: string = 'ms'
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    performanceMonitor.recordMetric(reportId, metricName, duration, unit);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    performanceMonitor.recordMetric(reportId, `${metricName}_error`, duration, unit);
    throw err;
  }
}

/**
 * 获取关键性能指标
 */
export async function getKeyMetrics(reportId: string) {
  const db = createAdminClient();

  const { data, error } = await db
    .from('performance_metrics')
    .select('metric_name, metric_value, unit')
    .eq('report_id', reportId);

  if (error) {
    logger.warn(`Failed to get metrics for ${reportId}`, error);
    return null;
  }

  // 按指标名称分组
  const grouped: Record<string, number[]> = {};
  (data || []).forEach((m: Record<string, unknown>) => {
    const metricName = m.metric_name as string;
    if (!grouped[metricName]) {
      grouped[metricName] = [];
    }
    grouped[metricName].push(m.metric_value as number);
  });

  // 计算统计信息
  const stats: Record<string, Record<string, number>> = {};
  for (const [name, values] of Object.entries(grouped)) {
    stats[name] = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    };
  }

  return stats;
}
