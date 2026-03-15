import ReportsClient from './ReportsClient';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return <ReportsClient dict={dict} />;
}
