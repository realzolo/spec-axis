-- Migration: Enhanced analysis features
-- Adds support for multi-dimensional analysis, trends, and advanced features

-- Add new columns to reports table for enhanced analysis
alter table reports add column if not exists complexity_metrics jsonb;
alter table reports add column if not exists duplication_metrics jsonb;
alter table reports add column if not exists dependency_metrics jsonb;
alter table reports add column if not exists security_findings jsonb;
alter table reports add column if not exists performance_findings jsonb;
alter table reports add column if not exists ai_suggestions jsonb;
alter table reports add column if not exists code_explanations jsonb;
alter table reports add column if not exists priority_issues jsonb;
alter table reports add column if not exists context_analysis jsonb;

-- Add metadata for tracking
alter table reports add column if not exists analysis_duration_ms int;
alter table reports add column if not exists tokens_used int;
alter table reports add column if not exists model_version text;

-- Create table for issue tracking and collaboration
create table if not exists report_issues (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  file text not null,
  line int,
  severity text not null check (severity in ('critical','high','medium','low','info')),
  category text not null,
  rule text not null,
  message text not null,
  suggestion text,
  code_snippet text,
  fix_patch text,
  status text not null default 'open' check (status in ('open','fixed','ignored','false_positive','planned')),
  priority int check (priority between 1 and 5),
  impact_scope text,
  estimated_effort text,
  assigned_to text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_issues_report_id on report_issues(report_id);
create index if not exists idx_report_issues_status on report_issues(status);
create index if not exists idx_report_issues_severity on report_issues(severity);
create index if not exists idx_report_issues_priority on report_issues(priority desc);

-- Create table for issue comments/discussions
create table if not exists issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references report_issues(id) on delete cascade,
  author text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_issue_comments_issue_id on issue_comments(issue_id);

-- Create table for project quality trends
create table if not exists quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  report_id uuid references reports(id) on delete set null,
  snapshot_date date not null default current_date,
  score int check (score between 0 and 100),
  category_scores jsonb,
  total_issues int,
  critical_issues int,
  high_issues int,
  medium_issues int,
  low_issues int,
  tech_debt_score int,
  complexity_score int,
  security_score int,
  performance_score int,
  created_at timestamptz not null default now()
);

create index if not exists idx_quality_snapshots_project_id on quality_snapshots(project_id);
create index if not exists idx_quality_snapshots_date on quality_snapshots(snapshot_date desc);
create unique index if not exists idx_quality_snapshots_project_date on quality_snapshots(project_id, snapshot_date);

-- Create table for AI chat history
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  issue_id uuid references report_issues(id) on delete set null,
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_report_id on ai_conversations(report_id);

-- Create table for custom filters/saved searches
create table if not exists saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  filter_config jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_filters_user_id on saved_filters(user_id);

-- Create table for notification settings
create table if not exists notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  email_enabled boolean not null default true,
  slack_webhook text,
  notify_on_complete boolean not null default true,
  notify_on_critical boolean not null default true,
  notify_on_threshold int check (notify_on_threshold between 0 and 100),
  daily_digest boolean not null default false,
  weekly_digest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add project-level configuration
alter table projects add column if not exists ignore_patterns text[] default '{}';
alter table projects add column if not exists quality_threshold int check (quality_threshold between 0 and 100);
alter table projects add column if not exists auto_analyze boolean not null default false;
alter table projects add column if not exists webhook_url text;
alter table projects add column if not exists last_analyzed_at timestamptz;

-- Add rule customization
alter table rules add column if not exists custom_config jsonb;
alter table rules add column if not exists false_positive_patterns text[];

-- Function to auto-create quality snapshot after report completion
create or replace function create_quality_snapshot()
returns trigger as $$
begin
  if new.status = 'done' and old.status != 'done' then
    insert into quality_snapshots (
      project_id,
      report_id,
      score,
      category_scores,
      total_issues,
      critical_issues,
      high_issues,
      medium_issues,
      low_issues
    )
    values (
      new.project_id,
      new.id,
      new.score,
      new.category_scores,
      (select count(*) from jsonb_array_elements(new.issues)),
      (select count(*) from jsonb_array_elements(new.issues) where (value->>'severity')::text = 'critical'),
      (select count(*) from jsonb_array_elements(new.issues) where (value->>'severity')::text = 'high'),
      (select count(*) from jsonb_array_elements(new.issues) where (value->>'severity')::text in ('error', 'medium')),
      (select count(*) from jsonb_array_elements(new.issues) where (value->>'severity')::text in ('warning', 'low'))
    )
    on conflict (project_id, snapshot_date) do update
    set
      report_id = excluded.report_id,
      score = excluded.score,
      category_scores = excluded.category_scores,
      total_issues = excluded.total_issues,
      critical_issues = excluded.critical_issues,
      high_issues = excluded.high_issues,
      medium_issues = excluded.medium_issues,
      low_issues = excluded.low_issues;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_create_quality_snapshot
after update on reports
for each row
execute function create_quality_snapshot();
