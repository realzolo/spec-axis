import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import EnhancedReportDetailClient from '@/components/report/EnhancedReportDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProjectReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { rid } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <EnhancedReportDetailClient reportId={rid} dict={dict} />;
}
