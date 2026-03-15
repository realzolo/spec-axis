import { PageLoading } from '@/components/ui/page-loading';
import { getDictionary } from '@/i18n';
import { getLocale } from '@/lib/locale';

export default async function ProjectsLoading() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return <PageLoading label={dict.common.loading} />;
}
