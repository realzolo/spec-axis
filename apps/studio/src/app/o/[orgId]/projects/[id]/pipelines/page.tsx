import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import ProjectPipelinesView from '@/components/project/ProjectPipelinesView';

export const dynamic = 'force-dynamic';

export default async function ProjectPipelinesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ProjectPipelinesView projectId={id} dict={dict} />;
}
