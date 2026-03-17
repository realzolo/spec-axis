import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { query, queryOne } from '@/lib/db';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import { requireUser } from '@/services/auth';
import { requireOrgAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

export default async function OrgRootPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  if (!user) {
    redirect('/login');
  }

  try {
    await requireOrgAccess(orgId, user.id);
  } catch {
    notFound();
  }

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const [
    projectCountRow,
    openIssuesRow,
    activeRunsRow,
    avgScoreRow,
    recentReports,
    recentRuns,
  ] = await Promise.all([
    queryOne<{ count: string }>(
      `select count(*)::text as count
       from code_projects
       where org_id = $1`,
      [orgId]
    ),
    queryOne<{ count: string }>(
      `select count(*)::text as count
       from analysis_issues i
       join analysis_reports r on r.id = i.report_id
       where r.org_id = $1 and r.status = 'done' and i.status = 'open'`,
      [orgId]
    ),
    queryOne<{ count: string }>(
      `select count(*)::text as count
       from pipeline_runs
       where org_id = $1 and status in ('queued','running')`,
      [orgId]
    ),
    queryOne<{ avg: number | null }>(
      `select avg(score)::float as avg
       from analysis_reports
       where org_id = $1 and status = 'done' and score is not null`,
      [orgId]
    ),
    query<{
      id: string;
      status: 'pending' | 'analyzing' | 'done' | 'failed';
      score: number | null;
      created_at: string;
      project_id: string;
      project_name: string;
    }>(
      `select r.id, r.status, r.score, r.created_at, p.id as project_id, p.name as project_name
       from analysis_reports r
       join code_projects p on p.id = r.project_id
       where r.org_id = $1
       order by r.created_at desc
       limit 8`,
      [orgId]
    ),
    query<{
      id: string;
      status: 'queued' | 'running' | 'success' | 'failed' | 'canceled' | 'timed_out' | 'skipped';
      created_at: string;
      pipeline_id: string;
      pipeline_name: string;
      project_id: string | null;
      project_name: string | null;
      branch: string | null;
    }>(
      `select r.id, r.status, r.created_at,
              r.pipeline_id, p.name as pipeline_name,
              r.project_id, cp.name as project_name,
              r.branch
       from pipeline_runs r
       join pipelines p on p.id = r.pipeline_id
       left join code_projects cp on cp.id = r.project_id
       where r.org_id = $1
       order by r.created_at desc
       limit 8`,
      [orgId]
    ),
  ]);

  const totalProjects = Number(projectCountRow?.count ?? 0);
  const openIssues = Number(openIssuesRow?.count ?? 0);
  const activeRuns = Number(activeRunsRow?.count ?? 0);
  const averageScore = Math.round(avgScoreRow?.avg ?? 0);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  function formatDateTime(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return dateFmt.format(d);
  }

  function scoreColor(score: number) {
    if (score >= 85) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-danger';
  }

  function runStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'muted' {
    if (status === 'success') return 'success';
    if (status === 'failed' || status === 'timed_out') return 'danger';
    if (status === 'running') return 'warning';
    return 'muted';
  }

  const stats = [
    { label: dict.dashboard.totalProjects, value: String(totalProjects) },
    {
      label: dict.dashboard.averageScore,
      value: averageScore > 0 ? averageScore : '—',
      className: averageScore > 0 ? scoreColor(averageScore) : undefined,
      suffix: averageScore > 0 ? '/ 100' : undefined,
    },
    { label: dict.dashboard.openIssues, value: String(openIssues) },
    { label: dict.dashboard.activeRuns, value: String(activeRuns) },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[960px] mx-auto w-full px-6 py-8 space-y-8">

        {/* Page heading */}
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
            {dict.dashboard.overview}
          </h1>
          <p className="text-[13px] text-[hsl(var(--ds-text-2))] mt-0.5">
            {dict.dashboard.last14Days}
          </p>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="rounded-[8px] border border-border bg-[hsl(var(--ds-background-2))] px-4 py-4"
            >
              <div className="text-[12px] text-[hsl(var(--ds-text-2))] mb-1.5">{stat.label}</div>
              <div className="flex items-baseline gap-1">
                <span className={['text-[22px] font-semibold tracking-tight', stat.className].filter(Boolean).join(' ')}>
                  {stat.value}
                </span>
                {stat.suffix && (
                  <span className="text-[12px] text-[hsl(var(--ds-text-2))]">{stat.suffix}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Two-column activity */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Recent reports */}
          <div className="rounded-[8px] border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-medium text-foreground">{dict.dashboard.recentReports}</span>
              <Link
                href={`/o/${orgId}/projects`}
                className="text-[12px] text-[hsl(var(--ds-text-2))] hover:text-foreground transition-colors duration-100"
              >
                {dict.dashboard.viewAll}
              </Link>
            </div>
            {recentReports.length === 0 ? (
              <div className="px-4 py-6 text-[13px] text-[hsl(var(--ds-text-2))]">
                {dict.reports.noReportsDescription}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentReports.map(r => (
                  <Link
                    key={r.id}
                    href={`/o/${orgId}/projects/${r.project_id}/reports/${r.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[hsl(var(--ds-surface-1))] transition-colors duration-100"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">{r.project_name}</div>
                      <div className="text-[12px] text-[hsl(var(--ds-text-2))]">{formatDateTime(r.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="muted" size="sm">
                        {dict.reports.status[r.status]}
                      </Badge>
                      {r.status === 'done' && r.score != null && (
                        <span className={['text-[13px] font-semibold tabular-nums', scoreColor(r.score)].join(' ')}>
                          {r.score}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent pipeline runs */}
          <div className="rounded-[8px] border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-medium text-foreground">{dict.dashboard.recentRuns}</span>
              <Link
                href={`/o/${orgId}/projects`}
                className="text-[12px] text-[hsl(var(--ds-text-2))] hover:text-foreground transition-colors duration-100"
              >
                {dict.dashboard.viewAll}
              </Link>
            </div>
            {recentRuns.length === 0 ? (
              <div className="px-4 py-6 text-[13px] text-[hsl(var(--ds-text-2))]">
                {dict.pipelines.detail.noRuns}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentRuns.map(run => (
                  <Link
                    key={run.id}
                    href={`/o/${orgId}/projects/${run.project_id}/pipelines/${run.pipeline_id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[hsl(var(--ds-surface-1))] transition-colors duration-100"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">{run.pipeline_name}</div>
                      <div className="text-[12px] text-[hsl(var(--ds-text-2))] truncate">
                        {(run.project_name ?? dict.reports.unknownProject) + ' · ' + formatDateTime(run.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={runStatusVariant(run.status)} size="sm">
                        {dict.pipelines.status[run.status] ?? run.status}
                      </Badge>
                      {run.branch && (
                        <span className="text-[12px] text-[hsl(var(--ds-text-2))]">{run.branch}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
