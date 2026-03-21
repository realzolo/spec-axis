create table if not exists org_runtime_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  analyze_rate_window_ms int not null default 60000 check (analyze_rate_window_ms > 0),
  analyze_rate_user_project_max int not null default 6 check (analyze_rate_user_project_max > 0),
  analyze_rate_org_max int not null default 60 check (analyze_rate_org_max > 0),
  analyze_rate_ip_max int not null default 120 check (analyze_rate_ip_max > 0),
  analyze_dedupe_ttl_sec int not null default 180 check (analyze_dedupe_ttl_sec > 0),
  analyze_dedupe_lock_ttl_sec int not null default 15 check (analyze_dedupe_lock_ttl_sec > 0),
  analyze_backpressure_project_active_max int not null default 6 check (analyze_backpressure_project_active_max > 0),
  analyze_backpressure_org_active_max int not null default 60 check (analyze_backpressure_org_active_max > 0),
  analyze_backpressure_retry_after_sec int not null default 15 check (analyze_backpressure_retry_after_sec > 0),
  analyze_report_timeout_ms int not null default 3600000 check (analyze_report_timeout_ms >= 60000),
  codebase_file_max_bytes int not null default 262144 check (codebase_file_max_bytes >= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
