create table analysis_rate_buckets (
  bucket_key text not null,
  window_started_at timestamptz not null,
  window_ends_at timestamptz not null,
  request_count int not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, window_started_at),
  constraint analysis_rate_buckets_window_check check (window_ends_at > window_started_at)
);

create index idx_analysis_rate_buckets_window_ends_at on analysis_rate_buckets(window_ends_at desc);
