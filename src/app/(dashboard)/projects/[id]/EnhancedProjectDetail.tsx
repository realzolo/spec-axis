'use client';

import { Settings, GitBranch, BarChart3, Code2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CommitsClient from './CommitsClient';
import CodebaseClient from './CodebaseClient';
import ProjectConfigPanel from '@/components/project/ProjectConfigPanel';
import DashboardStats from '@/components/dashboard/DashboardStats';
import type { Dictionary } from '@/i18n';

type Project = {
  id: string; name: string; repo: string; default_branch: string; org_id: string;
};

export default function EnhancedProjectDetail({ project, branches, dict }: { project: Project; branches: string[]; dict: Dictionary }) {
  return (
    <div className="flex flex-col h-full">
      <Tabs className="flex flex-col h-full" defaultValue="commits">
        <div className="border-b border-border bg-background shrink-0 px-4">
          <TabsList className="bg-transparent h-11">
            <TabsTrigger value="commits">
              <GitBranch className="size-4 mr-2" />
              {dict.commits.title}
            </TabsTrigger>
            <TabsTrigger value="codebase">
              <Code2 className="size-4 mr-2" />
              {dict.projects.codebase}
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="size-4 mr-2" />
              {dict.projects.statistics}
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="size-4 mr-2" />
              {dict.projects.projectConfig}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="commits">
            <CommitsClient project={project} branches={branches} dict={dict} />
          </TabsContent>
          <TabsContent value="codebase" className="h-full">
            <CodebaseClient project={project} branches={branches} dict={dict} />
          </TabsContent>
          <TabsContent value="stats" className="p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-1">{dict.projects.projectStatistics}</h2>
              <p className="text-sm text-muted-foreground">{dict.projects.viewQualityTrends.replace('{{name}}', project.name)}</p>
            </div>
            <DashboardStats projectId={project.id} dict={dict} />
          </TabsContent>
          <TabsContent value="config" className="p-8">
            <ProjectConfigPanel projectId={project.id} dict={dict} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
