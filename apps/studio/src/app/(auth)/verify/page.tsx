import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
import VerifyClient from './VerifyClient';

export const dynamic = 'force-dynamic';

export default async function VerifyPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return <VerifyClient dict={dict} />;
}
