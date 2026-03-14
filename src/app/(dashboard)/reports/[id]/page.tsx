import { getReportById } from '@/services/db';
import EnhancedReportDetailClient from './EnhancedReportDetailClient';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportById(id);
  return <EnhancedReportDetailClient initialReport={report} />;
}
