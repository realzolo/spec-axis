import { notFound } from 'next/navigation';
import { getRuleSetById } from '@/services/db';
import RuleSetDetailClient from './RuleSetDetailClient';

export const dynamic = 'force-dynamic';

export default async function RuleSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ruleSet = await getRuleSetById(id).catch(() => null);
  if (!ruleSet) notFound();
  return <RuleSetDetailClient initialRuleSet={ruleSet} />;
}
