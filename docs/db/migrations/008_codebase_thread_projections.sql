-- Add immutable thread anchors + per-commit projection cache for codebase comments.

create table if not exists codebase_thread_anchors (
  thread_id uuid primary key references codebase_comment_threads(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references code_projects(id) on delete cascade,
  repo text not null,
  anchor_commit_sha text not null check (anchor_commit_sha ~* '^[0-9a-f]{7,40}$'),
  anchor_path text not null,
  anchor_line_start int not null check (anchor_line_start > 0),
  anchor_line_end int not null check (anchor_line_end >= anchor_line_start),
  anchor_selection_text text,
  anchor_context_before text,
  anchor_context_after text,
  anchor_blob_sha text,
  created_at timestamptz not null default now()
);

insert into codebase_thread_anchors (
  thread_id,
  org_id,
  project_id,
  repo,
  anchor_commit_sha,
  anchor_path,
  anchor_line_start,
  anchor_line_end,
  anchor_selection_text,
  created_at
)
select
  t.id,
  t.org_id,
  t.project_id,
  t.repo,
  t.commit_sha,
  t.path,
  t.line,
  coalesce(t.line_end, t.line),
  fc.selection_text,
  t.created_at
from codebase_comment_threads t
left join lateral (
  select c.selection_text
  from codebase_comments c
  where c.thread_id = t.id
  order by c.created_at asc
  limit 1
) fc on true
on conflict (thread_id) do nothing;

create index if not exists idx_codebase_anchors_project on codebase_thread_anchors(project_id);
create index if not exists idx_codebase_anchors_file on codebase_thread_anchors(project_id, anchor_commit_sha, anchor_path);

create table if not exists codebase_thread_projections (
  thread_id uuid not null references codebase_comment_threads(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references code_projects(id) on delete cascade,
  repo text not null,
  target_commit_sha text not null check (target_commit_sha ~* '^[0-9a-f]{7,40}$'),
  projected_path text,
  projected_line_start int,
  projected_line_end int,
  status text not null check (status in ('exact', 'shifted', 'ambiguous', 'outdated', 'missing')),
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  reason_code text not null,
  algorithm_version text not null,
  computed_at timestamptz not null default now(),
  primary key (thread_id, target_commit_sha),
  constraint codebase_thread_projections_line_check
    check (
      (projected_line_start is null and projected_line_end is null)
      or (projected_line_start is not null and projected_line_end is not null and projected_line_end >= projected_line_start)
    )
);

create index if not exists idx_codebase_projections_project_target
  on codebase_thread_projections(project_id, target_commit_sha);
create index if not exists idx_codebase_projections_path
  on codebase_thread_projections(project_id, target_commit_sha, projected_path, status);

create table if not exists codebase_thread_projection_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references code_projects(id) on delete cascade,
  repo text not null,
  target_commit_sha text not null check (target_commit_sha ~* '^[0-9a-f]{7,40}$'),
  status text not null check (status in ('running', 'completed', 'failed')),
  attempt int not null default 1 check (attempt > 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, target_commit_sha)
);

create index if not exists idx_codebase_projection_jobs_project
  on codebase_thread_projection_jobs(project_id, status);
