-- Migration: Org-scoped rule learning
-- Restrict rule learning to org-owned rule sets and add RLS policies

-- Update rule weight adjustment to be org-scoped
create or replace function auto_adjust_rule_weights(p_org_id uuid)
returns void as $$
declare
  r record;
  new_weight int;
begin
  if p_org_id is null then
    raise exception 'org_id is required';
  end if;

  for r in
    select
      rs.rule_id,
      ru.weight as original_weight,
      rs.accuracy_score,
      rs.false_positive_count,
      rs.total_triggers
    from rule_statistics rs
    join rules ru on ru.id = rs.rule_id
    join rule_sets rset on rset.id = ru.ruleset_id
    where rset.is_global = false
      and rset.org_id = p_org_id
      and rs.total_triggers >= 10
  loop
    if r.accuracy_score < 50 then
      new_weight := greatest(r.original_weight - 20, 0);
    elsif r.accuracy_score < 70 then
      new_weight := greatest(r.original_weight - 10, 0);
    elsif r.accuracy_score > 90 then
      new_weight := least(r.original_weight + 10, 100);
    else
      new_weight := r.original_weight;
    end if;

    if r.false_positive_count::decimal / r.total_triggers::decimal > 0.3 then
      new_weight := greatest(new_weight - 15, 0);
    end if;

    if new_weight != r.original_weight then
      update rules
      set weight = new_weight
      where id = r.rule_id;
    end if;
  end loop;
end;
$$ language plpgsql;

-- RLS: rule_feedback
alter table rule_feedback enable row level security;

drop policy if exists "Org members can view rule feedback" on rule_feedback;
drop policy if exists "Org members can insert rule feedback" on rule_feedback;

create policy "Org members can view rule feedback"
  on rule_feedback for select
  using (
    exists (
      select 1
      from reports r
      join org_members m on m.org_id = r.org_id
      where r.id = rule_feedback.report_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "Org members can insert rule feedback"
  on rule_feedback for insert
  with check (
    exists (
      select 1
      from reports r
      join org_members m on m.org_id = r.org_id
      where r.id = rule_feedback.report_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- RLS: rule_statistics
alter table rule_statistics enable row level security;

drop policy if exists "Org members can view rule statistics" on rule_statistics;

create policy "Org members can view rule statistics"
  on rule_statistics for select
  using (
    exists (
      select 1
      from rules ru
      join rule_sets rs on rs.id = ru.ruleset_id
      join org_members m on m.org_id = rs.org_id
      where ru.id = rule_statistics.rule_id
        and rs.is_global = false
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- RLS: learned_patterns
alter table learned_patterns enable row level security;

drop policy if exists "Org members can view learned patterns" on learned_patterns;

create policy "Org members can view learned patterns"
  on learned_patterns for select
  using (
    exists (
      select 1
      from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = learned_patterns.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- RLS: adaptive_rule_weights
alter table adaptive_rule_weights enable row level security;

drop policy if exists "Org members can view adaptive weights" on adaptive_rule_weights;
drop policy if exists "Org admins can insert adaptive weights" on adaptive_rule_weights;
drop policy if exists "Org admins can update adaptive weights" on adaptive_rule_weights;
drop policy if exists "Org admins can delete adaptive weights" on adaptive_rule_weights;

create policy "Org members can view adaptive weights"
  on adaptive_rule_weights for select
  using (
    exists (
      select 1
      from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = adaptive_rule_weights.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "Org admins can insert adaptive weights"
  on adaptive_rule_weights for insert
  with check (
    exists (
      select 1
      from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = adaptive_rule_weights.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );

create policy "Org admins can update adaptive weights"
  on adaptive_rule_weights for update
  using (
    exists (
      select 1
      from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = adaptive_rule_weights.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );

create policy "Org admins can delete adaptive weights"
  on adaptive_rule_weights for delete
  using (
    exists (
      select 1
      from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = adaptive_rule_weights.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );
