import { getReports } from '@/services/db';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const reports = await getReports();
  return <ReportsClient initialReports={reports} />;
}
