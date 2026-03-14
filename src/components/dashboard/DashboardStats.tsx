'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

type DashboardStats = {
  totalReports: number;
  averageScore: number;
  totalIssues: number;
  criticalIssues: number;
  recentTrend: 'up' | 'down' | 'stable';
  trendValue: number;
  pendingReports: number;
};

export default function DashboardStats({ projectId }: { projectId?: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = projectId ? `/api/projects/${projectId}/stats` : '/api/stats';
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-muted rounded-lg w-1/2 mb-4" />
            <div className="h-8 bg-muted rounded-lg w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Reports */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-muted-foreground">总报告数</div>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BarChart3 className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="text-3xl font-bold">{stats.totalReports}</div>
      </div>

      {/* Average Score */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-muted-foreground">平均评分</div>
          <div className="p-2 rounded-lg" style={{
            background: stats.recentTrend === 'up' ? 'rgb(220 252 231)' : 'rgb(254 226 226)',
          }}>
            {stats.recentTrend === 'up' ? (
              <TrendingUp className="size-4 text-green-600" />
            ) : stats.recentTrend === 'down' ? (
              <TrendingDown className="size-4 text-red-600" />
            ) : (
              <BarChart3 className="size-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold">{stats.averageScore}</div>
          <div className="text-sm text-muted-foreground">/ 100</div>
        </div>
        {stats.trendValue !== 0 && (
          <div
            className={`text-xs mt-2 font-medium ${
              stats.recentTrend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {stats.recentTrend === 'up' ? '↑' : '↓'} {Math.abs(stats.trendValue)} vs 上周
          </div>
        )}
      </div>

      {/* Total Issues */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-muted-foreground">问题总数</div>
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        <div className="text-3xl font-bold">{stats.totalIssues}</div>
        {stats.criticalIssues > 0 && (
          <div className="text-xs font-medium text-red-600 mt-2">
            {stats.criticalIssues} 个严重问题
          </div>
        )}
      </div>

      {/* Pending Reports */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-muted-foreground">待处理</div>
          <div className="p-2 rounded-lg" style={{
            background: stats.pendingReports === 0 ? 'rgb(220 252 231)' : 'rgb(219 234 254)',
          }}>
            {stats.pendingReports === 0 ? (
              <CheckCircle className="size-4 text-green-600" />
            ) : (
              <Clock className="size-4 text-blue-600" />
            )}
          </div>
        </div>
        <div className="text-3xl font-bold">{stats.pendingReports}</div>
        {stats.pendingReports === 0 && (
          <div className="text-xs font-medium text-green-600 mt-2">全部完成</div>
        )}
      </div>
    </div>
  );
}
