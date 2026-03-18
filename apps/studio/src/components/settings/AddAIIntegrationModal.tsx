'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useClientDictionary } from '@/i18n/client';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface ProviderConfig {
  name: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    help?: string;
    options?: string[];
  }>;
  docs?: string;
  presets?: Array<{
    name: string;
    config: Record<string, string | number>;
  }>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default function AddAIIntegrationModal({ onClose, onSuccess }: Props) {
  const dict = useClientDictionary();
  const i18n = dict.settings.addAiModal;
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const selectedProvider = 'openai-api';
  const [selectedPreset, setSelectedPreset] = useState('');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string | number>>({});
  const [secret, setSecret] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/providers');
      const data = await res.json();
      setProviders(data.ai);
    } catch {
      toast.error(i18n.loadProvidersFailed);
    }
  }, [i18n.loadProvidersFailed]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const providerConfig = providers[selectedProvider];

  function handlePresetChange(presetName: string) {
    setSelectedPreset(presetName);
    const preset = providerConfig?.presets?.find((p) => p.name === presetName);
    if (preset) {
      setConfig(preset.config);
      setName(preset.name);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error(i18n.nameRequired);
      return;
    }

    if (!secret.trim()) {
      toast.error(i18n.apiKeyRequired);
      return;
    }

    if (!config.model) {
      toast.error(i18n.modelRequired);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ai',
          provider: selectedProvider,
          name,
          config,
          secret,
          isDefault,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || i18n.createFailed);
      }

      toast.success(i18n.createSuccess);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.createFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{i18n.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {providerConfig?.presets && providerConfig.presets.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">{i18n.quickSetup}</label>
              <Select
                {...(selectedPreset ? { value: selectedPreset } : {})}
                onValueChange={(value) => handlePresetChange(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={i18n.quickSetupPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {providerConfig.presets.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px] text-[hsl(var(--ds-text-2))] mt-1">
                {i18n.configureManually}
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">{i18n.name}</label>
            <Input
              placeholder={i18n.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">{i18n.apiKeyLabel}</label>
            <Input
              type="password"
              placeholder={i18n.apiKeyPlaceholder}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            {providerConfig?.docs && (
              <a
                href={providerConfig.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                {i18n.apiKeyDocs}
              </a>
            )}
          </div>

          {providerConfig?.fields
            .filter((f) => f.key !== 'apiKey')
            .map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium mb-1.5 block">
                  {field.label}
                  {field.required && ' *'}
                </label>
                {field.type === 'select' && field.options ? (
                  (() => {
                    const selectedValue = asString(config[field.key]);
                    return (
                      <Select
                        {...(selectedValue ? { value: selectedValue } : {})}
                        onValueChange={(value) =>
                          setConfig((prev) => ({ ...prev, [field.key]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()
                ) : field.type === 'number' ? (
                  <Input
                    type="number"
                    step={field.key === 'temperature' ? '0.1' : '1'}
                    placeholder={field.placeholder}
                    value={config[field.key] ?? ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isNaN(v)) {
                        setConfig((prev) => { const next = { ...prev }; delete next[field.key]; return next; });
                      } else {
                        setConfig((prev) => ({ ...prev, [field.key]: v }));
                      }
                    }}
                  />
                ) : (
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={String(config[field.key] ?? '')}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                )}
                {field.help && (
                  <p className="text-[12px] text-[hsl(var(--ds-text-2))] mt-1">{field.help}</p>
                )}
              </div>
            ))}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isDefault" className="text-sm">
              {i18n.setDefault}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {dict.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? i18n.creating : i18n.createAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
