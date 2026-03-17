import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import ProjectReportsView from '@/components/project/ProjectReportsView';

export const dynamic = 'force-dynamic';

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ProjectReportsView projectId={id} dict={dict} />;
}
