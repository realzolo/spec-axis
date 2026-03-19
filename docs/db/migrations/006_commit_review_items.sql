create table if not exists commit_review_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references code_projects(id) on delete cascade,
  commit_sha text not null check (commit_sha ~* '^[0-9a-f]{7,40}$'),
  path text not null,
  line int not null default 0 check (line >= 0),
  reviewer_id uuid not null references auth_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_commit_review_items
  on commit_review_items(project_id, commit_sha, path, line, reviewer_id);
create index if not exists idx_commit_review_items_commit
  on commit_review_items(project_id, commit_sha);
create index if not exists idx_commit_review_items_reviewer
  on commit_review_items(reviewer_id);
