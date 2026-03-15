import { redirect } from 'next/navigation';
import { requireUser } from '@/services/auth';
import { getActiveOrgId } from '@/services/orgs';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/login');
  }

  const orgId = await getActiveOrgId(user.id, user.email ?? undefined);
  redirect(`/o/${orgId}/settings/organizations`);
}

