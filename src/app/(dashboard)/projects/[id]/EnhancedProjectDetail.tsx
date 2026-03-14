'use client';

import { useState } from 'react';
import { Settings, GitBranch, BarChart3 } from 'lucide-react';
import CommitsClient from './CommitsClient';
import ProjectConfigPanel from '@/components/project/ProjectConfigPanel';
import DashboardStats from '@/components/dashboard/DashboardStats';

type Project = {
  id: string; name: string; repo: string; default_branch: string;
};

export default function EnhancedProjectDetail({ project, branches }: { project: Project; branches: string[] }) {
  const [activeTab, setActiveTab] = useState<'commits' | 'stats' | 'config'>('commits');

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b bg-background shrink-0">
        <button
          onClick={() => setActiveTab('commits')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'commits' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <GitBranch className="size-4" />
          提交记录
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'stats' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="size-4" />
          统计分析
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'config' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="size-4" />
          项目配置
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'commits' && <CommitsClient project={project} branches={branches} />}
        {activeTab === 'stats' && (
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">项目统计</h2>
              <p className="text-sm text-muted-foreground">查看 {project.name} 的质量趋势和统计数据</p>
            </div>
            <DashboardStats projectId={project.id} />
          </div>
        )}
        {activeTab === 'config' && (
          <div className="p-8">
            <ProjectConfigPanel projectId={project.id} />
          </div>
        )}
      </div>
    </div>
  );
}
