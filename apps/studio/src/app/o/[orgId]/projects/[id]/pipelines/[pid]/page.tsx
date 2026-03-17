import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import PipelineDetailClient from '@/components/pipeline/PipelineDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProjectPipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { pid } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <PipelineDetailClient dict={dict} pipelineId={pid} />;
}
