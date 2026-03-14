'use client';

import { useState, useMemo } from 'react';
import { Plus, FolderOpen, Search } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import { toast } from 'sonner';
import ProjectCard from '@/components/project/ProjectCard';
import AddProjectModal from '@/components/project/AddProjectModal';
import DashboardStats from '@/components/dashboard/DashboardStats';

type Project = {
  id: string; name: string; repo: string;
  description?: string; default_branch: string; ruleset_id?: string;
};

export default function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(q) || p.repo.toLowerCase().includes(q));
  }, [projects, search]);

  async function refresh() {
    const res = await fetch('/api/projects');
    setProjects(await res.json());
  }

  async function handleDelete(id: string) {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    toast.success('项目已删除');
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  function handleUpdate(updated: Project) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex flex-col gap-6 px-8 py-6 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">项目</h2>
            <p className="text-sm text-muted-foreground">管理代码审查仓库</p>
          </div>
          <Button onPress={() => setShowAdd(true)} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            添加项目
          </Button>
        </div>
        {projects.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索项目..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}
        {projects.length > 0 && <DashboardStats />}
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {projects.length === 0 ? (
          <div className="flex h-[450px] shrink-0 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">暂无项目</h3>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">
                添加 GitHub 仓库开始使用代码审查功能
              </p>
              <Button onPress={() => setShowAdd(true)} size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                添加项目
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-[450px] shrink-0 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">没有匹配 &quot;{search}&quot; 的项目</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onDelete={handleDelete} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>

      <AddProjectModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { setShowAdd(false); refresh(); }}
      />
    </div>
  );
}
