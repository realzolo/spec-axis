import ProjectsClient from './ProjectsClient';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ProjectsClient dict={dict} />;
}
