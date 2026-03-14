import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Trigger auto-adjustment of rule weights
export async function POST() {
  const supabase = await createClient();

  const { error } = await supabase.rpc('auto_adjust_rule_weights');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: '规则权重已自动调整' });
}

// Get learned patterns
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  const supabase = await createClient();

  let query = supabase
    .from('learned_patterns')
    .select('*')
    .eq('is_enabled', true)
    .order('confidence_score', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
