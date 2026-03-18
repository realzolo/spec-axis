import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import ReportDetailClient from '@/components/report/ReportDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProjectReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { rid } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ReportDetailClient reportId={rid} dict={dict} />;
}
