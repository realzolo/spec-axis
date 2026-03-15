import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'Task execution moved to runner service. Use RUNNER_BASE_URL.' },
    { status: 410 }
  );
}
