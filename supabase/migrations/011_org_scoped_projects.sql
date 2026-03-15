-- Migration: Org-scoped project repository uniqueness
-- Allow same repo across organizations; enforce uniqueness per org

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'projects_repo_key'
  ) then
    alter table projects drop constraint projects_repo_key;
  end if;
end $$;

alter table projects
  add constraint projects_org_repo_key unique (org_id, repo);

create index if not exists idx_projects_org_repo on projects(org_id, repo);
