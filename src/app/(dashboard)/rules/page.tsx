import { getRuleSets } from '@/services/db';
import RulesClient from './RulesClient';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const ruleSets = await getRuleSets();
  return <RulesClient initialRuleSets={ruleSets} />;
}
