/**
 * POST /api/integrations/[id]/set-default - Set an integration as default
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDefaultIntegration } from '@/services/integrations';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await setDefaultIntegration(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set default integration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set default integration' },
      { status: 500 }
    );
  }
}
