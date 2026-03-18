'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useClientDictionary } from '@/i18n/client';

interface Integration {
  id: string;
  name: string;
  provider: string;
  config: AIConfigForm;
  is_default: boolean;
}

type AIConfigForm = Record<string, unknown> & {
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
};

interface Props {
  integration: Integration;
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
}

export default function EditAIIntegrationModal({ integration, onClose, onSuccess }: Props) {
  const dict = useClientDictionary();
  const i18n = dict.settings.editAiModal;
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [name, setName] = useState(integration.name);
  const [config, setConfig] = useState<AIConfigForm>(integration.config);
  const [secret, setSecret] = useState('');
  const [isDefault, setIsDefault] = useState(integration.is_default);
  const [loading, setLoading] = useState(false);

  const loadProviderConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/providers');
      const data = await res.json();
      const cfg = data.ai?.[integration.provider];
      if (cfg) setProviderConfig(cfg);
    } catch {
      // non-fatal: fall back to basic fields
    }
  }, [integration.provider]);

  useEffect(() => {
    void loadProviderConfig();
  }, [loadProviderConfig]);

  function setConfigValue(key: string, value: string | number | undefined) {
    setConfig((prev) => {
      if (value === undefined) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }

  function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error(i18n.nameRequired);
      return;
    }

    const model = typeof config.model === 'string' ? config.model.trim() : '';
    if (!model) {
      toast.error(i18n.modelRequired);
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { name, config, isDefault };
      if (secret) body.secret = secret;

      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || i18n.updateFailed);
      }

      toast.success(i18n.updateSuccess);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.updateFailed);
    } finally {
      setLoading(false);
    }
  }

  // Determine which fields to render: prefer dynamic provider config, fall back to hardcoded basics
  const fields = providerConfig?.fields ?? [
    { key: 'baseUrl', label: i18n.baseUrl, type: 'text', required: true, placeholder: 'https://api.anthropic.com' },
    { key: 'model', label: i18n.model, type: 'text', required: true, placeholder: 'claude-sonnet-4-6' },
    { key: 'maxTokens', label: i18n.maxTokensOptional, type: 'number', required: false, placeholder: '4096' },
    { key: 'temperature', label: i18n.temperatureOptional, type: 'number', required: false, placeholder: '0.7', help: i18n.temperatureHelp },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{i18n.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">{i18n.provider}</label>
            <Input value={integration.provider} disabled />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">{i18n.name}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={i18n.namePlaceholder}
            />
          </div>

          {fields
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
                        onValueChange={(value) => setConfigValue(field.key, value)}
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
                  (() => {
                    const fieldValue = config[field.key];
                    return (
                      <Input
                        type="number"
                        step={field.key === 'temperature' ? '0.1' : '1'}
                        placeholder={field.placeholder}
                        value={
                          typeof fieldValue === 'number' || typeof fieldValue === 'string'
                            ? fieldValue
                            : ''
                        }
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setConfigValue(field.key, Number.isNaN(v) ? undefined : v);
                        }}
                      />
                    );
                  })()
                ) : (
                  (() => {
                    const textValue = config[field.key];
                    return (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={
                          typeof textValue === 'string' || typeof textValue === 'number'
                            ? textValue
                            : ''
                        }
                        onChange={(e) => setConfigValue(field.key, e.target.value)}
                      />
                    );
                  })()
                )}
                {field.help && (
                  <p className="text-[12px] text-[hsl(var(--ds-text-2))] mt-1">{field.help}</p>
                )}
              </div>
            ))}

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {secret ? i18n.apiKeyLabel : i18n.apiKeyLabelWithHint}
            </label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={i18n.apiKeyPlaceholder}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <label className="text-sm">{i18n.setDefault}</label>
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              {dict.common.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? i18n.updating : i18n.updateAction}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
