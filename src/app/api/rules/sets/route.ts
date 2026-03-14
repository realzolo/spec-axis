import { NextResponse } from 'next/server';
import { getRuleSets, createRuleSet } from '@/services/db';

export async function GET() {
  const data = await getRuleSets();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const data = await createRuleSet(body);
  return NextResponse.json(data);
}
