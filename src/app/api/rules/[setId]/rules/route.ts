import { NextResponse } from 'next/server';
import { upsertRule, deleteRule } from '@/services/db';

export async function POST(request: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const body = await request.json();
  const data = await upsertRule({ ...body, ruleset_id: setId });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  await deleteRule(id);
  return NextResponse.json({ success: true });
}
