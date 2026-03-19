/**
 * PUT /api/integrations/[id] - Update an integration
 * DELETE /api/integrations/[id] - Delete an integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, unauthorized } from '@/services/auth';
import {
  updateIntegration,
  deleteIntegration,
  getIntegration,
  sanitizeAIConfig,
  type UpdateIntegrationInput,
} from '@/services/integrations';
import { getActiveOrgId, getOrgMemberRole, isRoleAllowed, ORG_ADMIN_ROLES } from '@/services/orgs';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const { name, config, secret, isDefault } = body;

    const input: UpdateIntegrationInput = {};
    if (name !== undefined) input.name = name;
    if (secret !== undefined) input.secret = secret;
    if (isDefault !== undefined) input.isDefault = isDefault;

    const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
    const role = await getOrgMemberRole(orgId, user.id);
    if (!isRoleAllowed(role, ORG_ADMIN_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (config !== undefined) {
      const existing = await getIntegration(id, orgId);
      input.config = existing.type === 'ai' ? sanitizeAIConfig(config) : config;
    }

    const integration = await updateIntegration(id, orgId, input);

    // Remove sensitive data
    const sanitized = {
      id: integration.id,
      type: integration.type,
      provider: integration.provider,
      name: integration.name,
      is_default: integration.is_default,
      config: integration.config,
      created_at: integration.created_at,
      updated_at: integration.updated_at,
    };

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Failed to update integration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update integration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    if (!user) return unauthorized();

    const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
    const role = await getOrgMemberRole(orgId, user.id);
    if (!isRoleAllowed(role, ORG_ADMIN_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteIntegration(id, orgId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete integration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete integration' },
      { status: 500 }
    );
  }
}
