import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Get project configuration
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select('ignore_patterns, quality_threshold, auto_analyze, webhook_url')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// Update project configuration
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { ignorePatterns, qualityThreshold, autoAnalyze, webhookUrl } = body;

  const supabase = await createClient();

  const updateData: Record<string, unknown> = {};
  if (ignorePatterns !== undefined) updateData.ignore_patterns = ignorePatterns;
  if (qualityThreshold !== undefined) updateData.quality_threshold = qualityThreshold;
  if (autoAnalyze !== undefined) updateData.auto_analyze = autoAnalyze;
  if (webhookUrl !== undefined) updateData.webhook_url = webhookUrl;

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
