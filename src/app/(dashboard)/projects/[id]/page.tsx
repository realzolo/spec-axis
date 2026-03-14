import { getProjectById } from '@/services/db';
import { getRepoBranches } from '@/services/github';
import EnhancedProjectDetail from './EnhancedProjectDetail';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectById(id);
  const branches = await getRepoBranches(project.repo, id).catch(() => [project.default_branch]);

  return <EnhancedProjectDetail project={project} branches={branches} />;
}
