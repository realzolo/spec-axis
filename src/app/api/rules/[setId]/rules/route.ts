import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { upsertRule, deleteRule } from '@/services/db';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { z } from 'zod';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.enum(['style', 'security', 'architecture', 'performance', 'maintainability']),
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(5000),
  weight: z.number().min(0).max(100).optional(),
  severity: z.enum(['error', 'warning', 'info']).optional(),
  is_enabled: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const { setId } = await params;
  const body = await request.json();
  const validated = ruleSchema.parse(body);
  const data = await upsertRule({ ...validated, ruleset_id: setId });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await request.json();
  await deleteRule(id);
  return NextResponse.json({ success: true });
}
