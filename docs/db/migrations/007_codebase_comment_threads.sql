-- Introduce thread-level state for codebase comments (open/resolved) and threaded replies.

create table if not exists codebase_comment_threads (
  id uuid primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references code_projects(id) on delete cascade,
  repo text not null,
  ref text not null,
  commit_sha text not null check (commit_sha ~* '^[0-9a-f]{7,40}$'),
  path text not null,
  line int not null check (line > 0),
  line_end int,
  status text not null default 'open' check (status in ('open', 'resolved')),
  author_id uuid references auth_users(id) on delete set null,
  author_email citext,
  resolved_by uuid references auth_users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint codebase_comment_threads_line_end_check
    check (line_end is null or line_end >= line)
);

alter table codebase_comments
  add column if not exists thread_id uuid;

insert into codebase_comment_threads (
  id,
  org_id,
  project_id,
  repo,
  ref,
  commit_sha,
  path,
  line,
  line_end,
  status,
  author_id,
  author_email,
  created_at,
  updated_at
)
select
  c.id,
  c.org_id,
  c.project_id,
  c.repo,
  c.ref,
  c.commit_sha,
  c.path,
  c.line,
  c.line_end,
  'open',
  c.author_id,
  c.author_email,
  c.created_at,
  c.created_at
from codebase_comments c
on conflict (id) do nothing;

update codebase_comments
set thread_id = id
where thread_id is null;

alter table codebase_comments
  alter column thread_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'codebase_comments_thread_id_fkey'
  ) then
    alter table codebase_comments
      add constraint codebase_comments_thread_id_fkey
      foreign key (thread_id) references codebase_comment_threads(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_codebase_threads_project on codebase_comment_threads(project_id);
create index if not exists idx_codebase_threads_file on codebase_comment_threads(project_id, ref, path);
create index if not exists idx_codebase_threads_status on codebase_comment_threads(project_id, status);
create index if not exists idx_codebase_threads_line on codebase_comment_threads(project_id, ref, path, line);
create index if not exists idx_codebase_threads_commit on codebase_comment_threads(project_id, commit_sha, path);
create index if not exists idx_codebase_comments_thread on codebase_comments(thread_id);
