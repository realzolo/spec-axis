import { NextResponse } from 'next/server';
import { getRuleSetById } from '@/services/db';

export async function GET(_: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const data = await getRuleSetById(setId);
  return NextResponse.json(data);
}
