/**
 * Integration management service
 */

import { query, queryOne, exec } from '@/lib/db';
import { storeSecret, updateSecret, deleteSecret } from '@/lib/vault';
import type { Integration, IntegrationType, Provider } from './types';

export interface CreateIntegrationInput {
  userId: string;
  orgId: string;
  type: IntegrationType;
  provider: Provider;
  name: string;
  config: Record<string, any>;
  secret: string; // token or apiKey
  isDefault?: boolean;
}

export interface UpdateIntegrationInput {
  name?: string;
  config?: Record<string, any>;
  secret?: string;
  isDefault?: boolean;
}

/**
 * Create a new integration
 */
export async function createIntegration(input: CreateIntegrationInput): Promise<Integration> {
  const encryptedSecret = await storeSecret('', input.secret);

  const row = await queryOne<Integration>(
    `insert into org_integrations
      (user_id, org_id, type, provider, name, config, vault_secret_name, is_default, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
     returning *`,
    [
      input.userId,
      input.orgId,
      input.type,
      input.provider,
      input.name,
      JSON.stringify(input.config ?? {}),
      encryptedSecret,
      input.isDefault ?? false,
    ]
  );

  if (!row) {
    throw new Error('Failed to create integration');
  }

  return row as Integration;
}

/**
 * Update an integration
 */
export async function updateIntegration(
  integrationId: string,
  orgId: string,
  input: UpdateIntegrationInput
): Promise<Integration> {
  const existing = await queryOne<Integration>(
    `select * from org_integrations where id = $1 and org_id = $2`,
    [integrationId, orgId]
  );

  if (!existing) {
    throw new Error('Integration not found');
  }

  const updateData: Record<string, any> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.config !== undefined) updateData.config = JSON.stringify(input.config);
  if (input.isDefault !== undefined) updateData.is_default = input.isDefault;

  if (input.secret) {
    updateData.vault_secret_name = await updateSecret(existing.vault_secret_name, input.secret);
  }

  const fields = Object.keys(updateData);
  if (fields.length === 0) {
    return existing as Integration;
  }

  const assignments = fields.map((key, idx) => `${key} = $${idx + 3}`);
  const values = fields.map((key) => updateData[key]);

  const updated = await queryOne<Integration>(
    `update org_integrations
     set ${assignments.join(', ')}, updated_at = now()
     where id = $1 and org_id = $2
     returning *`,
    [integrationId, orgId, ...values]
  );

  if (!updated) {
    throw new Error('Failed to update integration');
  }

  return updated as Integration;
}

/**
 * Delete an integration
 */
export async function deleteIntegration(integrationId: string, orgId: string): Promise<void> {
  const integration = await queryOne<Integration>(
    `select * from org_integrations where id = $1 and org_id = $2`,
    [integrationId, orgId]
  );

  if (!integration) {
    throw new Error('Integration not found');
  }

  const projects = await query(
    `select id from code_projects
     where vcs_integration_id = $1 or ai_integration_id = $1
     limit 1`,
    [integrationId]
  );

  if (projects.length > 0) {
    throw new Error('Cannot delete integration: it is being used by one or more projects');
  }

  await exec(
    `delete from org_integrations where id = $1 and org_id = $2`,
    [integrationId, orgId]
  );

  try {
    await deleteSecret(integration.vault_secret_name);
  } catch (error) {
    console.error('Failed to delete secret from vault:', error);
  }
}

/**
 * Set an integration as default
 */
export async function setDefaultIntegration(
  integrationId: string,
  orgId: string
): Promise<void> {
  const integration = await queryOne<Integration>(
    `select * from org_integrations where id = $1 and org_id = $2`,
    [integrationId, orgId]
  );

  if (!integration) {
    throw new Error('Integration not found');
  }

  await exec(
    `update org_integrations set is_default = true where id = $1 and org_id = $2`,
    [integrationId, orgId]
  );
}
