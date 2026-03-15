-- Migration: Codebase comment ranges
-- Adds optional line range + selection text for codebase comments

alter table codebase_comments add column if not exists line_end int;
alter table codebase_comments add column if not exists selection_text text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'codebase_comments_line_end_check'
  ) then
    alter table codebase_comments
      add constraint codebase_comments_line_end_check
      check (line_end is null or line_end >= line);
  end if;
end $$;

create index if not exists idx_codebase_comments_line_end
  on codebase_comments(project_id, ref, path, line_end);
