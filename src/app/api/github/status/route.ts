import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { createVCSClient } from '@/services/integrations';
import { readSecret } from '@/lib/vault';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const supabase = createAdminClient();

    // Get user's default VCS integration
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'vcs')
      .eq('is_default', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({
        authenticated: false,
        message: 'No VCS integration configured. Please add a code repository integration in Settings > Integrations.',
      });
    }

    // Decrypt the token
    const token = await readSecret(integration.vault_secret_name);

    // Create VCS client and test connection
    const client = createVCSClient(integration, token);
    const isConnected = await client.testConnection();

    return NextResponse.json({
      authenticated: isConnected,
      provider: integration.provider,
      name: integration.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
