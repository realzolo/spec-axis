/**
 * Integration management service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { storeSecret, updateSecret, deleteSecret, generateSecretName } from '@/lib/vault';
import type { Integration, IntegrationType, Provider } from './types';

export interface CreateIntegrationInput {
  userId: string;
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
  const supabase = createAdminClient();

  // Encrypt the secret
  const encryptedSecret = await storeSecret('', input.secret);

  try {
    // Insert integration
    const { data, error } = await supabase
      .from('user_integrations')
      .insert({
        user_id: input.userId,
        type: input.type,
        provider: input.provider,
        name: input.name,
        config: input.config,
        vault_secret_name: encryptedSecret,
        is_default: input.isDefault || false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create integration: ${error.message}`);
    }

    return data as Integration;
  } catch (error) {
    throw error;
  }
}

/**
 * Update an integration
 */
export async function updateIntegration(
  integrationId: string,
  userId: string,
  input: UpdateIntegrationInput
): Promise<Integration> {
  const supabase = createAdminClient();

  // Get existing integration
  const { data: existing, error: getError } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('id', integrationId)
    .eq('user_id', userId)
    .single();

  if (getError || !existing) {
    throw new Error('Integration not found');
  }

  // Update integration
  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.config !== undefined) updateData.config = input.config;
  if (input.isDefault !== undefined) updateData.is_default = input.isDefault;
  updateData.updated_at = new Date().toISOString();

  // Update secret if provided
  if (input.secret) {
    const newEncryptedSecret = await updateSecret(existing.vault_secret_name, input.secret);
    updateData.vault_secret_name = newEncryptedSecret;
  }

  const { data, error } = await supabase
    .from('user_integrations')
    .update(updateData)
    .eq('id', integrationId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update integration: ${error.message}`);
  }

  return data as Integration;
}

/**
 * Delete an integration
 */
export async function deleteIntegration(integrationId: string, userId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get integration
  const { data: integration, error: getError } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('id', integrationId)
    .eq('user_id', userId)
    .single();

  if (getError || !integration) {
    throw new Error('Integration not found');
  }

  // Check if integration is used by any projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id')
    .or(`vcs_integration_id.eq.${integrationId},ai_integration_id.eq.${integrationId}`)
    .limit(1);

  if (projectsError) {
    throw new Error('Failed to check integration usage');
  }

  if (projects && projects.length > 0) {
    throw new Error('Cannot delete integration: it is being used by one or more projects');
  }

  // Delete integration
  const { error: deleteError } = await supabase
    .from('user_integrations')
    .delete()
    .eq('id', integrationId)
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Failed to delete integration: ${deleteError.message}`);
  }

  // Delete secret from vault
  try {
    await deleteSecret(integration.vault_secret_name);
  } catch (error) {
    console.error('Failed to delete secret from vault:', error);
    // Don't throw - integration is already deleted
  }
}

/**
 * Set an integration as default
 */
export async function setDefaultIntegration(
  integrationId: string,
  userId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Get integration
  const { data: integration, error: getError } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('id', integrationId)
    .eq('user_id', userId)
    .single();

  if (getError || !integration) {
    throw new Error('Integration not found');
  }

  // Update integration (trigger will handle unsetting other defaults)
  const { error } = await supabase
    .from('user_integrations')
    .update({ is_default: true })
    .eq('id', integrationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to set default integration: ${error.message}`);
  }
}
