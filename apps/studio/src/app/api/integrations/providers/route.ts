/**
 * GET /api/integrations/providers - Get available providers and their configuration templates
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = {
    vcs: {
      github: {
        name: 'GitHub',
        description: 'GitHub.com and GitHub Enterprise',
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            type: 'password',
            required: true,
            placeholder: 'ghp_...',
            help: 'Create a token with repo scope',
          },
          {
            key: 'baseUrl',
            label: 'Base URL (for Enterprise)',
            type: 'text',
            required: false,
            placeholder: 'https://github.company.com/api/v3',
            help: 'Leave empty for GitHub.com',
          },
          {
            key: 'org',
            label: 'Default Organization',
            type: 'text',
            required: false,
            placeholder: 'my-org',
            help: 'Default organization for repositories',
          },
        ],
        docs: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token',
      },
      gitlab: {
        name: 'GitLab',
        description: 'GitLab.com and self-hosted GitLab',
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            type: 'password',
            required: true,
            placeholder: 'glpat-...',
            help: 'Create a token with api scope',
          },
          {
            key: 'baseUrl',
            label: 'Base URL',
            type: 'text',
            required: true,
            placeholder: 'https://gitlab.com',
            help: 'GitLab instance URL',
          },
          {
            key: 'org',
            label: 'Default Group',
            type: 'text',
            required: false,
            placeholder: 'my-group',
            help: 'Default group for repositories',
          },
        ],
        docs: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
      },
      git: {
        name: 'Generic Git',
        description: 'Custom Git service',
        fields: [
          {
            key: 'token',
            label: 'Access Token',
            type: 'password',
            required: true,
            placeholder: 'your-token',
          },
          {
            key: 'baseUrl',
            label: 'Base URL',
            type: 'text',
            required: true,
            placeholder: 'https://git.company.com',
          },
        ],
        docs: null,
      },
    },
    ai: {
      'openai-compatible': {
        name: 'OpenAI-Compatible API',
        description: 'Anthropic, OpenAI, DeepSeek, and other compatible APIs',
        fields: [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password',
            required: true,
            placeholder: 'sk-...',
          },
          {
            key: 'baseUrl',
            label: 'Base URL',
            type: 'text',
            required: true,
            placeholder: 'https://api.anthropic.com',
            help: 'API endpoint URL',
          },
          {
            key: 'model',
            label: 'Model',
            type: 'text',
            required: true,
            placeholder: 'claude-sonnet-4-6',
            help: 'Model identifier',
          },
          {
            key: 'maxTokens',
            label: 'Max Tokens',
            type: 'number',
            required: false,
            placeholder: '4096',
          },
          {
            key: 'temperature',
            label: 'Temperature',
            type: 'number',
            required: false,
            placeholder: '0.7',
            help: 'Value between 0 and 1',
          },
        ],
        docs: 'https://docs.anthropic.com/en/api/getting-started',
        presets: [
          {
            name: 'Anthropic Claude',
            config: {
              baseUrl: 'https://api.anthropic.com',
              model: 'claude-sonnet-4-6',
            },
          },
          {
            name: 'OpenAI GPT-4',
            config: {
              baseUrl: 'https://api.openai.com/v1',
              model: 'gpt-4-turbo',
            },
          },
          {
            name: 'DeepSeek',
            config: {
              baseUrl: 'https://api.deepseek.com/v1',
              model: 'deepseek-chat',
            },
          },
        ],
      },
    },
  };

  return NextResponse.json(providers);
}
