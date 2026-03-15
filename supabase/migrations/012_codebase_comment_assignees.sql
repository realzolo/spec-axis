-- Migration: Codebase comment assignees
-- Adds assignee mapping for codebase comments

create table if not exists codebase_comment_assignees (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references codebase_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_codebase_comment_assignees
  on codebase_comment_assignees(comment_id, user_id);

create index if not exists idx_codebase_comment_assignees_comment
  on codebase_comment_assignees(comment_id);

create index if not exists idx_codebase_comment_assignees_user
  on codebase_comment_assignees(user_id);
