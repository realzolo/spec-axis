import ProjectDetailClient from './ProjectDetailClient';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ProjectDetailClient projectId={id} dict={dict} />;
}
