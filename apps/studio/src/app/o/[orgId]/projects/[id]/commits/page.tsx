import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import ProjectCommitsView from '@/components/project/ProjectCommitsView';

export const dynamic = 'force-dynamic';

export default async function ProjectCommitsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ProjectCommitsView projectId={id} dict={dict} />;
}
