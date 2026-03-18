'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import SettingsNav from '@/components/settings/SettingsNav';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientDictionary } from '@/i18n/client';

type NotificationSettings = {
  email_enabled: boolean;
  slack_webhook: string | null;
  notify_on_complete: boolean;
  notify_on_critical: boolean;
  notify_on_threshold: number | null;
  daily_digest: boolean;
  weekly_digest: boolean;
};

export const dynamic = 'force-dynamic';

export default function NotificationsSettingsPage() {
  const dict = useClientDictionary();
  const i18n = dict.settings.notificationsPage;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/notification-settings');
        if (!res.ok) throw new Error(i18n.loadFailed);
        const data = await res.json();
        if (!alive) return;
        setSettings(data?.settings ?? null);
      } catch {
        if (alive) toast.error(i18n.loadFailed);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [i18n.loadFailed]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(i18n.saveFailed);
      toast.success(i18n.saveSuccess);
    } catch {
      toast.error(i18n.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const disabled = loading || !settings;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr] items-start">
          <SettingsNav />

          <div className="space-y-6">
            <div>
              <div className="text-[15px] font-semibold">{i18n.title}</div>
              <div className="text-[13px] text-[hsl(var(--ds-text-2))] mt-1">
                {i18n.description}
              </div>
            </div>

            <Card>
              <CardContent className="p-5 space-y-4">
                {loading && (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-72" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                )}

                {!loading && settings && (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[13px] font-medium">{i18n.emailNotificationsTitle}</div>
                        <div className="text-[12px] text-[hsl(var(--ds-text-2))] mt-0.5">
                          {i18n.emailNotificationsDescription}
                        </div>
                      </div>
                      <Switch
                        checked={settings.email_enabled}
                        onCheckedChange={(v) => setSettings({ ...settings, email_enabled: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[13px] font-medium">{i18n.notifyCompletionTitle}</div>
                        <div className="text-[12px] text-[hsl(var(--ds-text-2))] mt-0.5">
                          {i18n.notifyCompletionDescription}
                        </div>
                      </div>
                      <Switch
                        checked={settings.notify_on_complete}
                        onCheckedChange={(v) => setSettings({ ...settings, notify_on_complete: v })}
                        disabled={!settings.email_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[13px] font-medium">{i18n.notifyCriticalTitle}</div>
                        <div className="text-[12px] text-[hsl(var(--ds-text-2))] mt-0.5">
                          {i18n.notifyCriticalDescription}
                        </div>
                      </div>
                      <Switch
                        checked={settings.notify_on_critical}
                        onCheckedChange={(v) => setSettings({ ...settings, notify_on_critical: v })}
                        disabled={!settings.email_enabled}
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="text-[13px] font-medium">{i18n.scoreThresholdTitle}</div>
                      <div className="text-[12px] text-[hsl(var(--ds-text-2))]">
                        {i18n.scoreThresholdDescription}
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={settings.notify_on_threshold ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setSettings({ ...settings, notify_on_threshold: null });
                            return;
                          }
                          const n = Number(raw);
                          setSettings({
                            ...settings,
                            notify_on_threshold: Number.isFinite(n)
                              ? Math.min(100, Math.max(0, Math.round(n)))
                              : null,
                          });
                        }}
                        disabled={!settings.email_enabled}
                        className="w-40"
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="text-[13px] font-medium">{i18n.slackWebhookTitle}</div>
                      <div className="text-[12px] text-[hsl(var(--ds-text-2))]">
                        {i18n.slackWebhookDescription}
                      </div>
                      <Input
                        value={settings.slack_webhook ?? ''}
                        onChange={(e) => setSettings({ ...settings, slack_webhook: e.target.value || null })}
                        placeholder={i18n.slackWebhookPlaceholder}
                        disabled={!settings.email_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[13px] font-medium">{i18n.dailyDigestTitle}</div>
                        <div className="text-[12px] text-[hsl(var(--ds-text-2))] mt-0.5">
                          {i18n.dailyDigestDescription}
                        </div>
                      </div>
                      <Switch
                        checked={settings.daily_digest}
                        onCheckedChange={(v) => setSettings({ ...settings, daily_digest: v })}
                        disabled={!settings.email_enabled}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[13px] font-medium">{i18n.weeklyDigestTitle}</div>
                        <div className="text-[12px] text-[hsl(var(--ds-text-2))] mt-0.5">
                          {i18n.weeklyDigestDescription}
                        </div>
                      </div>
                      <Switch
                        checked={settings.weekly_digest}
                        onCheckedChange={(v) => setSettings({ ...settings, weekly_digest: v })}
                        disabled={!settings.email_enabled}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={save} disabled={disabled || saving}>
                {saving ? i18n.saving : dict.common.save}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
