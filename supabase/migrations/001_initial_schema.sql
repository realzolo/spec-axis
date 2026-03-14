-- Migration: initial schema
-- Run this in your Supabase SQL editor

-- Projects
create table if not exists projects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  repo           text not null unique,
  description    text,
  default_branch text not null default 'main',
  ruleset_id     uuid,
  created_at     timestamptz not null default now()
);

-- Rule sets
create table if not exists rule_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_global   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Add FK after rule_sets is created
alter table projects
  add constraint fk_projects_ruleset
  foreign key (ruleset_id) references rule_sets(id) on delete set null;

-- Rules
create table if not exists rules (
  id         uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references rule_sets(id) on delete cascade,
  category   text not null check (category in ('style','security','architecture','performance','maintainability')),
  name       text not null,
  prompt     text not null,
  weight     int not null default 20 check (weight between 0 and 100),
  severity   text not null default 'warning' check (severity in ('error','warning','info')),
  is_enabled boolean not null default true,
  sort_order int not null default 0
);

-- Reports
create table if not exists reports (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  ruleset_snapshot jsonb not null default '[]',
  commits          jsonb not null default '[]',
  status           text not null default 'pending' check (status in ('pending','analyzing','done','failed')),
  score            int check (score between 0 and 100),
  category_scores  jsonb,
  issues           jsonb,
  summary          text,
  error_message    text,
  total_files      int,
  total_additions  int,
  total_deletions  int,
  created_at       timestamptz not null default now()
);

-- Indexes
create index if not exists idx_reports_project_id on reports(project_id);
create index if not exists idx_reports_created_at on reports(created_at desc);
create index if not exists idx_rules_ruleset_id on rules(ruleset_id);

-- ============================================================
-- Seed: Built-in global rule set (General)
-- ============================================================
do $$
declare
  v_ruleset_id uuid;
begin
  insert into rule_sets (name, description, is_global)
  values ('General Rules', 'General code quality rules applicable to all projects', true)
  returning id into v_ruleset_id;

  -- Style rules
  insert into rules (ruleset_id, category, name, prompt, severity, sort_order) values
  (v_ruleset_id, 'style', 'Consistent Quotes', 'All strings must use single quotes. Flag any double-quoted strings in JS/TS code.', 'warning', 10),
  (v_ruleset_id, 'style', 'Semicolons Required', 'All statements must end with a semicolon. Flag missing semicolons.', 'warning', 20),
  (v_ruleset_id, 'style', 'Indentation', 'Code must use 2-space indentation. Flag tab indentation or 4-space indentation.', 'warning', 30),
  (v_ruleset_id, 'style', 'No Unused Variables', 'Flag any imported modules or declared variables that are never used.', 'error', 40),
  (v_ruleset_id, 'style', 'English Logs Only', 'All console.log/error/warn messages must be in English. Flag any non-English log messages.', 'warning', 50);

  -- Security rules
  insert into rules (ruleset_id, category, name, prompt, severity, sort_order) values
  (v_ruleset_id, 'security', 'No Hardcoded Secrets', 'Flag any hardcoded API keys, tokens, passwords, or secrets in the code.', 'error', 10),
  (v_ruleset_id, 'security', 'No SQL Concatenation', 'Flag any SQL queries built with string concatenation. Parameterized queries must be used.', 'error', 20),
  (v_ruleset_id, 'security', 'XSS Prevention', 'Flag direct use of innerHTML or v-html without sanitization.', 'error', 30);

  -- Architecture rules
  insert into rules (ruleset_id, category, name, prompt, severity, sort_order) values
  (v_ruleset_id, 'architecture', 'API Response Format', 'Server API responses must follow the format: { success, code, data } for success and { success, code, message } for errors. Flag direct returns without this structure.', 'error', 10),
  (v_ruleset_id, 'architecture', 'No User Info in Request Params', 'User identity (userId, email) must never be passed via request body or query params. It must be extracted from the auth context/token server-side.', 'error', 20),
  (v_ruleset_id, 'architecture', 'Error Handling', 'Business errors should be returned, not thrown, from API handlers. Flag throw statements in API route handlers where a return would be appropriate.', 'warning', 30);

  -- Performance rules
  insert into rules (ruleset_id, category, name, prompt, severity, sort_order) values
  (v_ruleset_id, 'performance', 'No N+1 Queries', 'Flag database queries inside loops. Batch queries or joins should be used instead.', 'error', 10),
  (v_ruleset_id, 'performance', 'Avoid Redundant API Calls', 'Flag duplicate or redundant API calls that could be cached or deduplicated.', 'warning', 20);

  -- Maintainability rules
  insert into rules (ruleset_id, category, name, prompt, severity, sort_order) values
  (v_ruleset_id, 'maintainability', 'Function Length', 'Flag functions exceeding 60 lines. Large functions should be broken into smaller, focused units.', 'warning', 10),
  (v_ruleset_id, 'maintainability', 'Meaningful Names', 'Flag single-letter variables (except loop counters), or vague names like "data", "info", "temp" used as top-level identifiers.', 'info', 20),
  (v_ruleset_id, 'maintainability', 'No Magic Numbers', 'Flag unexplained numeric literals. Constants should be named and defined separately.', 'info', 30);
end $$;
