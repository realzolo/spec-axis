alter table notification_settings
  add column if not exists notify_on_pipeline_run boolean not null default true,
  add column if not exists notify_on_report_ready boolean not null default true,
  add column if not exists notify_on_report_score_below int;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'notification_settings'
      and column_name = 'notify_on_complete'
  ) then
    execute $sql$
      update notification_settings
      set
        notify_on_pipeline_run = coalesce(notify_on_complete, true),
        notify_on_report_ready = coalesce(notify_on_complete, true)
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'notification_settings'
      and column_name = 'notify_on_threshold'
  ) then
    execute $sql$
      update notification_settings
      set notify_on_report_score_below = notify_on_threshold
    $sql$;
  end if;
end $$;

alter table notification_settings
  drop column if exists slack_webhook,
  drop column if exists notify_on_complete,
  drop column if exists notify_on_critical,
  drop column if exists notify_on_threshold,
  drop column if exists daily_digest,
  drop column if exists weekly_digest;

alter table notification_settings
  drop constraint if exists notification_settings_report_score_below_check;

alter table notification_settings
  add constraint notification_settings_report_score_below_check
  check (notify_on_report_score_below between 0 and 100 or notify_on_report_score_below is null);
