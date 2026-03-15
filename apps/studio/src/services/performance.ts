/**
 * Performance monitoring service
 * Collects and records key performance metrics
 */

import { exec, query } from '@/lib/db';
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
   * Record a metric
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
   * Get metric stats
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
   * Persist metrics to database
   */
  async saveMetrics(reportId: string) {
    const metrics = this.metrics.get(reportId);
    if (!metrics || metrics.length === 0) {
      return;
    }

    try {
      const columns = ['report_id', 'metric_name', 'metric_value', 'unit'];
      const values: any[] = [];
      const placeholders = metrics.map((metric, index) => {
        const base = index * columns.length;
        values.push(metric.reportId, metric.name, metric.value, metric.unit ?? null);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });

      await exec(
        `insert into analysis_metrics (${columns.join(', ')})
         values ${placeholders.join(', ')}`,
        values
      );

      logger.info(`Saved ${metrics.length} metrics for ${reportId}`);
      this.metrics.delete(reportId);
    } catch (err) {
      logger.error('Failed to save metrics', err instanceof Error ? err : undefined);
    }
  }

  /**
   * Clear metrics
   */
  clearMetrics(reportId: string) {
    this.metrics.delete(reportId);
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Measure async operation performance
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
 * Get key performance metrics
 */
export async function getKeyMetrics(reportId: string) {
  try {
    const data = await query(
      `select metric_name, metric_value, unit
       from analysis_metrics
       where report_id = $1`,
      [reportId]
    );

    // Group by metric name
    const grouped: Record<string, number[]> = {};
    (data || []).forEach((m: Record<string, unknown>) => {
      const metricName = m.metric_name as string;
      if (!grouped[metricName]) {
        grouped[metricName] = [];
      }
      grouped[metricName].push(m.metric_value as number);
    });

    // Calculate stats
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
  } catch (err) {
    logger.warn(`Failed to get metrics for ${reportId}`, err instanceof Error ? err : undefined);
    return null;
  }
}
