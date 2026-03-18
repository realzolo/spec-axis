'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Integration {
  id: string;
  name: string;
  provider: string;
  config: Record<string, unknown>;
  is_default: boolean;
}

interface Props {
  integration: Integration;
  onClose: () => void;
  onSuccess: () => void;
}

interface FieldDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help?: string;
}

// Default field definitions per provider used before provider metadata is loaded.
const DEFAULT_PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  github: [
    { key: 'baseUrl', label: 'Base URL (for Enterprise)', type: 'text', required: false, placeholder: 'https://github.company.com/api/v3', help: 'Leave empty for GitHub.com' },
    { key: 'org', label: 'Default Organization', type: 'text', required: false, placeholder: 'my-org' },
  ],
  gitlab: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://gitlab.com' },
    { key: 'org', label: 'Default Group', type: 'text', required: false, placeholder: 'my-group' },
  ],
  git: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://git.company.com' },
  ],
};

export default function EditVCSIntegrationModal({ integration, onClose, onSuccess }: Props) {
  const [fields, setFields] = useState<FieldDef[]>(DEFAULT_PROVIDER_FIELDS[integration.provider] ?? []);
  const [name, setName] = useState(integration.name);
  const [config, setConfig] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(integration.config).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : value == null ? '' : String(value),
      ])
    )
  );
  const [secret, setSecret] = useState('');
  const [isDefault, setIsDefault] = useState(integration.is_default);
  const [loading, setLoading] = useState(false);

  const loadProviderFields = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/providers');
      const data = await res.json();
      const providerCfg = data.vcs?.[integration.provider];
      if (providerCfg?.fields) {
        // Exclude the token field — handled separately as the secret input
        setFields(providerCfg.fields.filter((f: FieldDef) => f.key !== 'token'));
      }
    } catch {
      // Keep current field definitions.
    }
  }, [integration.provider]);

  useEffect(() => {
    void loadProviderFields();
  }, [loadProviderFields]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required');
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
        throw new Error(data.error || 'Failed to update integration');
      }

      toast.success('Integration updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update integration');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit VCS Integration</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Provider</label>
            <Input value={integration.provider} disabled />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My GitHub"
            />
          </div>

          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-sm font-medium mb-1.5 block">
                {field.label}
                {field.required && ' *'}
              </label>
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={config[field.key] || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
              {field.help && (
                <p className="text-[12px] text-[hsl(var(--ds-text-2))] mt-1">{field.help}</p>
              )}
            </div>
          ))}

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Access Token {secret ? '' : '(leave empty to keep current)'}
            </label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter new token to update"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <label className="text-sm">Set as default</label>
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
