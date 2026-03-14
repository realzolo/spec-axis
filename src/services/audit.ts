/**
 * 审计日志服务
 * 记录所有重要操作以便追踪和合规
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from './logger';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'analyze'
  | 'export'
  | 'share'
  | 'login'
  | 'logout';

export type AuditEntityType = 'project' | 'report' | 'rule' | 'ruleset' | 'user';

export interface AuditLogEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  userId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

class AuditLogger {
  /**
   * 记录审计日志
   */
  async log(entry: AuditLogEntry) {
    try {
      const db = createAdminClient();

      const { error } = await db.from('audit_logs').insert({
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        user_id: entry.userId,
        changes: entry.changes,
        ip_address: entry.ipAddress || undefined,
        user_agent: entry.userAgent || undefined,
      });

      if (error) {
        logger.warn('Failed to log audit entry', error);
      } else {
        logger.debug(
          `Audit logged: ${entry.action} ${entry.entityType}${entry.entityId ? ` (${entry.entityId})` : ''}`
        );
      }
    } catch (err) {
      logger.error('Failed to log audit entry', err instanceof Error ? err : undefined);
    }
  }

  /**
   * 获取审计日志
   */
  async getLogs(
    entityType?: AuditEntityType,
    entityId?: string,
    limit: number = 100
  ) {
    try {
      const db = createAdminClient();

      let query = db.from('audit_logs').select('*').order('created_at', { ascending: false });

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data, error } = await query.limit(limit);

      if (error) {
        logger.warn('Failed to fetch audit logs', error);
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Failed to fetch audit logs', err instanceof Error ? err : undefined);
      return [];
    }
  }

  /**
   * 获取用户活动
   */
  async getUserActivity(userId: string, limit: number = 50) {
    try {
      const db = createAdminClient();

      const { data, error } = await db
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.warn(`Failed to fetch activity for user ${userId}`, error);
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Failed to fetch user activity', err instanceof Error ? err : undefined);
      return [];
    }
  }

  /**
   * 清理旧的审计日志（保留 90 天）
   */
  async cleanup() {
    try {
      const db = createAdminClient();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { error } = await db
        .from('audit_logs')
        .delete()
        .lt('created_at', ninetyDaysAgo.toISOString());

      if (error) {
        logger.warn('Failed to cleanup audit logs', error);
      } else {
        logger.info('Audit logs cleaned up');
      }
    } catch (err) {
      logger.error('Failed to cleanup audit logs', err instanceof Error ? err : undefined);
    }
  }
}

export const auditLogger = new AuditLogger();

/**
 * 从请求中提取客户端信息
 */
export function extractClientInfo(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  };
}
