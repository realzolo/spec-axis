import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import ProjectSettingsView from '@/components/project/ProjectSettingsView';

export const dynamic = 'force-dynamic';

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ProjectSettingsView projectId={id} dict={dict} />;
}
