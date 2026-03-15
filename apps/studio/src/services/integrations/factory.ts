/**
 * Integration factory and resolver
 */

import { query, queryOne } from '@/lib/db';
import { readSecret } from '@/lib/vault';
import type {
  Integration,
  VCSClient,
  AIClient,
  VCSConfigWithSecret,
  AIConfig,
  AIConfigWithSecret,
  VCSProvider,
  AIProvider,
} from './types';
import { GitHubClient, GitLabClient, GenericGitClient } from './vcs-clients';
import { OpenAICompatibleClient } from './ai-clients';

function normalizeIntegration(row: any): Integration {
  if (!row) return row as Integration;
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return { ...row, config } as Integration;
}

/**
 * Create a VCS client from an integration
 */
export function createVCSClient(integration: Integration, token: string): VCSClient {
  const config: VCSConfigWithSecret = {
    ...integration.config,
    token,
  };

  switch (integration.provider as VCSProvider) {
    case 'github':
      return new GitHubClient(config);
    case 'gitlab':
      return new GitLabClient(config);
    case 'git':
      return new GenericGitClient(config);
    default:
      throw new Error(`Unsupported VCS provider: ${integration.provider}`);
  }
}

/**
 * Create an AI client from an integration
 */
export function createAIClient(integration: Integration, apiKey: string): AIClient {
  const config: AIConfigWithSecret = {
    ...(integration.config as AIConfig),
    apiKey,
  };

  switch (integration.provider as AIProvider) {
    case 'openai-compatible':
      return new OpenAICompatibleClient(config);
    default:
      throw new Error(`Unsupported AI provider: ${integration.provider}`);
  }
}

/**
 * Resolve VCS integration for a project
 * Priority: Project-specific > Org default
 */
export async function resolveVCSIntegration(projectId: string): Promise<{
  integration: Integration | null;
  client: VCSClient;
}> {
  const project = await queryOne<{ vcs_integration_id: string | null; org_id: string | null }>(
    `select vcs_integration_id, org_id
     from code_projects
     where id = $1`,
    [projectId]
  );

  if (!project) {
    throw new Error('Project not found');
  }

  // 1. Try project-specific integration
  if (project.vcs_integration_id) {
    const integrationRow = await queryOne(
      `select * from org_integrations where id = $1`,
      [project.vcs_integration_id]
    );

    if (integrationRow) {
      const integration = normalizeIntegration(integrationRow);
      if (project.org_id && integration.org_id !== project.org_id) {
        throw new Error('Integration does not belong to this organization');
      }
      const token = await readSecret(integration.vault_secret_name);
      const client = createVCSClient(integration, token);
      return { integration, client };
    }
  }

  // 2. Try org default integration
  if (project.org_id) {
    const defaultIntegrationRow = await queryOne(
      `select * from org_integrations
       where org_id = $1 and type = 'vcs' and is_default = true`,
      [project.org_id]
    );

    if (defaultIntegrationRow) {
      const integration = normalizeIntegration(defaultIntegrationRow);
      const token = await readSecret(integration.vault_secret_name);
      const client = createVCSClient(integration, token);
      return { integration, client };
    }
  }

  throw new Error(
    'No VCS integration configured. Please add a code repository integration in Settings > Integrations.'
  );
}

/**
 * Resolve AI integration for a project
 * Priority: Project-specific > Org default
 */
export async function resolveAIIntegration(projectId: string): Promise<{
  integration: Integration | null;
  client: AIClient;
}> {
  const project = await queryOne<{ ai_integration_id: string | null; org_id: string | null }>(
    `select ai_integration_id, org_id
     from code_projects
     where id = $1`,
    [projectId]
  );

  if (!project) {
    throw new Error('Project not found');
  }

  // 1. Try project-specific integration
  if (project.ai_integration_id) {
    const integrationRow = await queryOne(
      `select * from org_integrations where id = $1`,
      [project.ai_integration_id]
    );

    if (integrationRow) {
      const integration = normalizeIntegration(integrationRow);
      if (project.org_id && integration.org_id !== project.org_id) {
        throw new Error('Integration does not belong to this organization');
      }
      const apiKey = await readSecret(integration.vault_secret_name);
      const client = createAIClient(integration, apiKey);
      return { integration, client };
    }
  }

  // 2. Try org default integration
  if (project.org_id) {
    const defaultIntegrationRow = await queryOne(
      `select * from org_integrations
       where org_id = $1 and type = 'ai' and is_default = true`,
      [project.org_id]
    );

    if (defaultIntegrationRow) {
      const integration = normalizeIntegration(defaultIntegrationRow);
      const apiKey = await readSecret(integration.vault_secret_name);
      const client = createAIClient(integration, apiKey);
      return { integration, client };
    }
  }

  throw new Error(
    'No AI integration configured. Please add an AI model integration in Settings > Integrations.'
  );
}

/**
 * Get all integrations for an organization
 */
export async function getOrgIntegrations(
  orgId: string,
  type?: 'vcs' | 'ai'
): Promise<Integration[]> {
  const rows = await query(
    `select * from org_integrations
     where org_id = $1
     ${type ? `and type = $2` : ''}
     order by created_at desc`,
    type ? [orgId, type] : [orgId]
  );

  return rows.map(normalizeIntegration) as Integration[];
}

/**
 * Get a specific integration by ID
 */
export async function getIntegration(integrationId: string, orgId?: string): Promise<Integration> {
  const row = await queryOne(
    `select * from org_integrations
     where id = $1 ${orgId ? 'and org_id = $2' : ''}`,
    orgId ? [integrationId, orgId] : [integrationId]
  );

  if (!row) {
    throw new Error('Integration not found');
  }

  return normalizeIntegration(row);
}
