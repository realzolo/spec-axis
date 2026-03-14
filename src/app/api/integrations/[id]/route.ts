/**
 * PUT /api/integrations/[id] - Update an integration
 * DELETE /api/integrations/[id] - Delete an integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  updateIntegration,
  deleteIntegration,
  type UpdateIntegrationInput,
} from '@/services/integrations';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, config, secret, isDefault } = body;

    const input: UpdateIntegrationInput = {};
    if (name !== undefined) input.name = name;
    if (config !== undefined) input.config = config;
    if (secret !== undefined) input.secret = secret;
    if (isDefault !== undefined) input.isDefault = isDefault;

    const integration = await updateIntegration(id, user.id, input);

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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteIntegration(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete integration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete integration' },
      { status: 500 }
    );
  }
}
