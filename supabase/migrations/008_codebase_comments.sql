-- Migration: Codebase comments
-- Adds line-level comments for codebase browsing

create table if not exists codebase_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  repo text not null,
  ref text not null,
  path text not null,
  line int not null check (line > 0),
  author_id uuid references auth.users(id) on delete set null,
  author_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_codebase_comments_project on codebase_comments(project_id);
create index if not exists idx_codebase_comments_file on codebase_comments(project_id, ref, path);
create index if not exists idx_codebase_comments_line on codebase_comments(project_id, ref, path, line);
