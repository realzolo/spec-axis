'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Plus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsNav from '@/components/settings/SettingsNav';
import { createClient } from '@/lib/supabase/client';

type OrgRole = 'owner' | 'admin' | 'reviewer' | 'member';

interface Organization {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  owner_id: string | null;
  created_at: string;
}

interface OrgMember {
  user_id: string;
  role: OrgRole;
  status: 'active' | 'invited' | 'suspended';
  created_at: string;
  email?: string | null;
}

interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const roleLabels: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  reviewer: 'Reviewer',
  member: 'Member',
};

const roleBadgeVariant: Record<OrgRole, 'accent' | 'secondary' | 'outline' | 'muted'> = {
  owner: 'accent',
  admin: 'secondary',
  reviewer: 'outline',
  member: 'muted',
};

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadOrgs() {
      setLoading(true);
      try {
        const [orgRes, activeRes] = await Promise.all([
          fetch('/api/orgs'),
          fetch('/api/orgs/active'),
        ]);
        const orgData = orgRes.ok ? await orgRes.json() : [];
        const activeData = activeRes.ok ? await activeRes.json() : null;

        if (!alive) return;
        const safeOrgs = Array.isArray(orgData) ? orgData : [];
        setOrgs(safeOrgs);
        setActiveOrgId(activeData?.orgId ?? safeOrgs?.[0]?.id ?? null);
      } catch {
        if (alive) toast.error('Failed to load organizations');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadOrgs();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    void loadMembers(activeOrgId);
    void loadInvites(activeOrgId);
  }, [activeOrgId]);

  const activeOrg = useMemo(
    () => orgs.find((org) => org.id === activeOrgId) ?? orgs[0],
    [orgs, activeOrgId],
  );

  const currentUserRole = useMemo(() => {
    if (!currentUserId) return null;
    return members.find((member) => member.user_id === currentUserId)?.role ?? null;
  }, [members, currentUserId]);

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  async function loadMembers(orgId: string) {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`);
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }

  async function loadInvites(orgId: string) {
    setInvitesLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invites`);
      if (!res.ok) throw new Error('Failed to load invites');
      const data = await res.json();
      setInvites(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load invites');
    } finally {
      setInvitesLoading(false);
    }
  }

  async function setActiveOrg(orgId: string) {
    if (orgId === activeOrgId) return;
    try {
      const res = await fetch('/api/orgs/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) throw new Error('Failed to set active org');
      setActiveOrgId(orgId);
      router.refresh();
    } catch {
      toast.error('Failed to switch organization');
    }
  }

  async function handleCreateOrg() {
    const name = newOrgName.trim();
    const slug = newOrgSlug.trim();
    if (!name) {
      toast.error('Organization name is required');
      return;
    }

    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: slug || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create organization');
      }
      const org = await res.json();
      setOrgs((prev) => [org, ...prev]);
      setCreateOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      await setActiveOrg(org.id);
      toast.success('Organization created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create organization');
    }
  }

  async function handleInvite() {
    if (!activeOrgId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Email is required');
      return;
    }

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send invite');
      }
      const invite = await res.json();
      setInvites((prev) => [invite, ...prev]);
      setInviteEmail('');
      toast.success('Invite created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invite');
    }
  }

  async function handleCopyInvite(invite: OrgInvite) {
    const url = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch {
      toast.error('Failed to copy invite link');
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!activeOrgId) return;
    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/invites/${inviteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke invite');
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      toast.success('Invite revoked');
    } catch {
      toast.error('Failed to revoke invite');
    }
  }

  async function handleRoleChange(member: OrgMember, role: OrgRole) {
    if (!activeOrgId) return;
    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }
      const updated = await res.json();
      setMembers((prev) =>
        prev.map((item) => (item.user_id === member.user_id ? { ...item, role: updated.role } : item)),
      );
      toast.success('Member updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  }

  async function handleRemoveMember(member: OrgMember) {
    if (!activeOrgId) return;
    if (!confirm(`Remove ${member.email ?? member.user_id}?`)) return;

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/members/${member.user_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }
      setMembers((prev) => prev.filter((item) => item.user_id !== member.user_id));
      toast.success('Member removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member');
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl px-6 py-6">
          <p className="text-sm text-muted-foreground">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <SettingsNav />

          <div className="space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold">Organizations</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage workspaces, members, and invites.
                </p>
              </div>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="size-4" />
                    New Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create organization</DialogTitle>
                    <DialogDescription>
                      Organizations group projects and collaborators under a shared workspace.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Name</label>
                      <Input
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="Acme Inc"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Slug (optional)</label>
                      <Input
                        value={newOrgSlug}
                        onChange={(e) => setNewOrgSlug(e.target.value)}
                        placeholder="acme"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateOrg}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Your organizations</h2>
                <span className="text-xs text-muted-foreground">
                  {orgs.length} total
                </span>
              </div>

              {orgs.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No organizations yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="hidden md:grid grid-cols-[1fr_140px_160px] px-4 py-2 text-xs text-muted-foreground">
                    <span>Name</span>
                    <span>Type</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="divide-y divide-border">
                    {orgs.map((org) => {
                      const isActive = org.id === activeOrg?.id;
                      return (
                        <div
                          key={org.id}
                          className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-[1fr_140px_160px] md:items-center"
                        >
                          <div>
                            <div className="text-sm font-medium">{org.name}</div>
                            <div className="text-xs text-muted-foreground">{org.slug}</div>
                          </div>
                          <div>
                            <Badge variant={org.is_personal ? 'secondary' : 'outline'}>
                              {org.is_personal ? 'Personal' : 'Team'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between md:justify-end gap-2">
                            {isActive ? (
                              <Badge variant="accent" size="sm" className="gap-1">
                                <Check className="size-3" />
                                Active
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveOrg(org.id)}
                              >
                                Switch
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Members</h2>
                  <p className="text-xs text-muted-foreground">
                    {activeOrg ? `Workspace: ${activeOrg.name}` : 'Select an organization'}
                  </p>
                </div>
                <Badge variant="muted">{members.length}</Badge>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="hidden md:grid grid-cols-[1fr_160px_120px_120px] px-4 py-2 text-xs text-muted-foreground">
                  <span>User</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="divide-y divide-border">
                  {membersLoading ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">Loading members...</div>
                  ) : members.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">No members found.</div>
                  ) : (
                    members.map((member) => {
                      const isSelf = member.user_id === currentUserId;
                      const canEditRole =
                        canManageMembers &&
                        !(member.role === 'owner' && currentUserRole !== 'owner') &&
                        !(isSelf && member.role === 'owner');
                      const canRemove =
                        canManageMembers &&
                        !isSelf &&
                        !(member.role === 'owner' && currentUserRole !== 'owner');

                      return (
                        <div
                          key={member.user_id}
                          className="flex flex-col gap-3 px-4 py-3 md:grid md:grid-cols-[1fr_160px_120px_120px] md:items-center"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {member.email ?? member.user_id}
                              {isSelf && <span className="text-xs text-muted-foreground"> (You)</span>}
                            </div>
                            {member.email && (
                              <div className="text-xs text-muted-foreground">{member.user_id}</div>
                            )}
                          </div>
                          <div>
                            {canEditRole ? (
                              <Select
                                value={member.role}
                                onValueChange={(value) => handleRoleChange(member, value as OrgRole)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(roleLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={roleBadgeVariant[member.role]}>{roleLabels[member.role]}</Badge>
                            )}
                          </div>
                          <div>
                            <Badge variant={member.status === 'active' ? 'success' : 'muted'}>
                              {member.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 md:justify-end">
                            {canRemove ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveMember(member)}
                                className="gap-1"
                              >
                                <UserMinus className="size-3.5" />
                                Remove
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Invites</h2>
                  <p className="text-xs text-muted-foreground">
                    Invite teammates to join {activeOrg?.name ?? 'your organization'}.
                  </p>
                </div>
                <Badge variant="muted">{invites.length}</Badge>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@company.com"
                    />
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as OrgRole)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleInvite} disabled={!canManageMembers}>
                      Send Invite
                    </Button>
                  </div>
                  {!canManageMembers && (
                    <p className="text-xs text-muted-foreground">
                      Only owners or admins can send invites.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="hidden md:grid grid-cols-[1fr_120px_160px_120px] px-4 py-2 text-xs text-muted-foreground">
                  <span>Email</span>
                  <span>Role</span>
                  <span>Expires</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="divide-y divide-border">
                  {invitesLoading ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">Loading invites...</div>
                  ) : invites.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">No active invites.</div>
                  ) : (
                    invites.map((invite) => {
                      const expired = new Date(invite.expires_at).getTime() < Date.now();
                      return (
                        <div
                          key={invite.id}
                          className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-[1fr_120px_160px_120px] md:items-center"
                        >
                          <div>
                            <div className="text-sm font-medium">{invite.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {invite.accepted_at ? 'Accepted' : expired ? 'Expired' : 'Pending'}
                            </div>
                          </div>
                          <div>
                            <Badge variant={roleBadgeVariant[invite.role]}>{roleLabels[invite.role]}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(invite.expires_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2 md:justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyInvite(invite)}
                              className="gap-1"
                            >
                              <Copy className="size-3.5" />
                              Copy
                            </Button>
                            {canManageMembers && !invite.accepted_at && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevokeInvite(invite.id)}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
