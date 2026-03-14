/**
 * POST /api/integrations/[id]/test - Test an integration connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIntegration, createVCSClient, createAIClient } from '@/services/integrations';
import { readSecret } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get integration
    const integration = await getIntegration(params.id);

    // Verify ownership
    if (integration.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Read secret from vault
    const secret = await readSecret(integration.vault_secret_name);

    // Test connection based on type
    let success = false;
    let error = null;

    if (integration.type === 'vcs') {
      try {
        const client = createVCSClient(integration, secret);
        success = await client.testConnection();
      } catch (e) {
        error = e instanceof Error ? e.message : 'Connection test failed';
      }
    } else if (integration.type === 'ai') {
      try {
        const client = createAIClient(integration, secret);
        success = await client.testConnection();
      } catch (e) {
        error = e instanceof Error ? e.message : 'Connection test failed';
      }
    }

    return NextResponse.json({ success, error });
  } catch (error) {
    console.error('Failed to test integration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test integration' },
      { status: 500 }
    );
  }
}
