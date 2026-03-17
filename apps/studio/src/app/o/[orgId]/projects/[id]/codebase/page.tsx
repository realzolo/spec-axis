import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import ProjectCodebaseView from '@/components/project/ProjectCodebaseView';

export const dynamic = 'force-dynamic';

export default async function ProjectCodebasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ProjectCodebaseView projectId={id} dict={dict} />;
}
