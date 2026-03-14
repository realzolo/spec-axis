-- Fix severity counts in quality snapshot trigger

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
      (select count(*) from jsonb_array_elements(coalesce(new.issues, '[]'::jsonb))),
      (select count(*) from jsonb_array_elements(coalesce(new.issues, '[]'::jsonb)) where (value->>'severity')::text = 'critical'),
      (select count(*) from jsonb_array_elements(coalesce(new.issues, '[]'::jsonb)) where (value->>'severity')::text = 'high'),
      (select count(*) from jsonb_array_elements(coalesce(new.issues, '[]'::jsonb)) where (value->>'severity')::text = 'medium'),
      (select count(*) from jsonb_array_elements(coalesce(new.issues, '[]'::jsonb)) where (value->>'severity')::text = 'low')
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
