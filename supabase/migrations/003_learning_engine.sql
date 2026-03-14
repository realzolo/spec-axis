-- Migration: Learning rule engine
-- Adds support for rule learning and adaptation

-- Create table for rule feedback
create table if not exists rule_feedback (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references rules(id) on delete cascade,
  report_id uuid not null references reports(id) on delete cascade,
  issue_file text not null,
  issue_line int,
  feedback_type text not null check (feedback_type in ('helpful', 'not_helpful', 'false_positive', 'too_strict', 'too_lenient')),
  user_id text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rule_feedback_rule_id on rule_feedback(rule_id);
create index if not exists idx_rule_feedback_report_id on rule_feedback(report_id);

-- Create table for rule statistics
create table if not exists rule_statistics (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references rules(id) on delete cascade unique,
  total_triggers int not null default 0,
  helpful_count int not null default 0,
  not_helpful_count int not null default 0,
  false_positive_count int not null default 0,
  accuracy_score decimal(5,2),
  last_updated timestamptz not null default now()
);

create unique index if not exists idx_rule_statistics_rule_id on rule_statistics(rule_id);

-- Create table for adaptive rule weights
create table if not exists adaptive_rule_weights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  rule_id uuid not null references rules(id) on delete cascade,
  original_weight int not null,
  adjusted_weight int not null,
  adjustment_reason text,
  last_adjusted timestamptz not null default now(),
  unique(project_id, rule_id)
);

create index if not exists idx_adaptive_weights_project on adaptive_rule_weights(project_id);
create index if not exists idx_adaptive_weights_rule on adaptive_rule_weights(rule_id);

-- Create table for pattern learning
create table if not exists learned_patterns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  pattern_type text not null check (pattern_type in ('anti_pattern', 'best_practice', 'code_smell', 'optimization')),
  pattern_name text not null,
  pattern_description text not null,
  detection_regex text,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  confidence_score decimal(5,2) not null,
  occurrence_count int not null default 1,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists idx_learned_patterns_project on learned_patterns(project_id);
create index if not exists idx_learned_patterns_enabled on learned_patterns(is_enabled);

-- Function to update rule statistics
create or replace function update_rule_statistics()
returns trigger as $$
begin
  insert into rule_statistics (rule_id, total_triggers)
  values (new.rule_id, 1)
  on conflict (rule_id) do update
  set
    total_triggers = rule_statistics.total_triggers + 1,
    helpful_count = rule_statistics.helpful_count + case when new.feedback_type = 'helpful' then 1 else 0 end,
    not_helpful_count = rule_statistics.not_helpful_count + case when new.feedback_type = 'not_helpful' then 1 else 0 end,
    false_positive_count = rule_statistics.false_positive_count + case when new.feedback_type = 'false_positive' then 1 else 0 end,
    accuracy_score = case
      when rule_statistics.total_triggers + 1 > 0 then
        ((rule_statistics.helpful_count + case when new.feedback_type = 'helpful' then 1 else 0 end)::decimal /
         (rule_statistics.total_triggers + 1)::decimal) * 100
      else 0
    end,
    last_updated = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_rule_statistics
after insert on rule_feedback
for each row
execute function update_rule_statistics();

-- Function to auto-adjust rule weights based on feedback
create or replace function auto_adjust_rule_weights()
returns void as $$
declare
  r record;
  new_weight int;
begin
  for r in
    select
      rs.rule_id,
      ru.weight as original_weight,
      rs.accuracy_score,
      rs.false_positive_count,
      rs.total_triggers
    from rule_statistics rs
    join rules ru on ru.id = rs.rule_id
    where rs.total_triggers >= 10  -- Only adjust after enough data
  loop
    -- Calculate new weight based on accuracy
    if r.accuracy_score < 50 then
      new_weight := greatest(r.original_weight - 20, 0);
    elsif r.accuracy_score < 70 then
      new_weight := greatest(r.original_weight - 10, 0);
    elsif r.accuracy_score > 90 then
      new_weight := least(r.original_weight + 10, 100);
    else
      new_weight := r.original_weight;
    end if;

    -- Penalize high false positive rate
    if r.false_positive_count::decimal / r.total_triggers::decimal > 0.3 then
      new_weight := greatest(new_weight - 15, 0);
    end if;

    -- Update if weight changed
    if new_weight != r.original_weight then
      update rules
      set weight = new_weight
      where id = r.rule_id;
    end if;
  end loop;
end;
$$ language plpgsql;
