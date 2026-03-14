-- Migration: Organizations and review runs
-- Adds org membership, invites, and PR review tracking

-- Organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_personal boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','reviewer','member')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','reviewer','member')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_org_members_user_id on org_members(user_id);
create index if not exists idx_org_members_org_id on org_members(org_id);
create index if not exists idx_org_invites_org_id on org_invites(org_id);
create index if not exists idx_org_invites_email on org_invites(email);

-- Add org_id to existing tables
alter table projects add column if not exists org_id uuid references organizations(id) on delete set null;
alter table reports add column if not exists org_id uuid references organizations(id) on delete set null;
alter table rule_sets add column if not exists org_id uuid references organizations(id) on delete set null;
alter table user_integrations add column if not exists org_id uuid references organizations(id) on delete set null;

create index if not exists idx_projects_org_id on projects(org_id);
create index if not exists idx_reports_org_id on reports(org_id);
create index if not exists idx_rule_sets_org_id on rule_sets(org_id);
create index if not exists idx_user_integrations_org_id on user_integrations(org_id);

-- Pull requests and review runs
create table if not exists pull_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  provider text not null check (provider in ('github','gitlab')),
  repo_full_name text not null,
  number int not null,
  title text,
  author text,
  url text,
  base_sha text,
  head_sha text,
  status text not null default 'open' check (status in ('open','closed','merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, repo_full_name, number)
);

create index if not exists idx_pull_requests_project_id on pull_requests(project_id);
create index if not exists idx_pull_requests_repo on pull_requests(repo_full_name);

create table if not exists review_runs (
  id uuid primary key default gen_random_uuid(),
  pull_request_id uuid references pull_requests(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  report_id uuid references reports(id) on delete set null,
  trigger text not null check (trigger in ('webhook','manual','scheduled')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  model text,
  tokens_used int,
  cost numeric(12,4),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_review_runs_pull_request_id on review_runs(pull_request_id);
create index if not exists idx_review_runs_project_id on review_runs(project_id);
create index if not exists idx_review_runs_report_id on review_runs(report_id);

create table if not exists review_comments (
  id uuid primary key default gen_random_uuid(),
  review_run_id uuid references review_runs(id) on delete cascade,
  file text,
  line int,
  severity text,
  body text,
  external_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_review_comments_review_run_id on review_comments(review_run_id);

-- Backfill orgs for existing users
do $$
declare
  u record;
  v_org_id uuid;
  v_name text;
begin
  for u in select id, email from auth.users loop
    select id into v_org_id
    from organizations
    where owner_id = u.id and is_personal = true
    limit 1;

    if v_org_id is null then
      v_name := case
        when u.email is null or split_part(u.email, '@', 1) = '' then 'Personal Org'
        else split_part(u.email, '@', 1) || ' Org'
      end;

      insert into organizations (name, slug, is_personal, owner_id)
      values (v_name, 'personal-' || u.id, true, u.id)
      returning id into v_org_id;
    end if;

    insert into org_members (org_id, user_id, role, status)
    values (v_org_id, u.id, 'owner', 'active')
    on conflict do nothing;

    update projects set org_id = v_org_id where user_id = u.id and org_id is null;
    update reports set org_id = v_org_id where user_id = u.id and org_id is null;
    update rule_sets set org_id = v_org_id where user_id = u.id and org_id is null and is_global = false;
    update user_integrations set org_id = v_org_id where user_id = u.id and org_id is null;
  end loop;
end $$;
