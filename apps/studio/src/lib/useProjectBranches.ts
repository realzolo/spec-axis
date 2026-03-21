import { useEffect, useMemo, useState } from 'react';

function normalizeBranches(branches: string[]) {
  return Array.from(new Set(branches.map((branch) => branch.trim()).filter(Boolean)));
}

export function useProjectBranches(projectId: string | null, defaultBranch: string | null | undefined) {
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId || !defaultBranch) return;

    let active = true;

    fetch(`/api/projects/${projectId}/branches?sync=0`)
      .then(async (response) => {
        if (!response.ok) return [];
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const fetched = Array.isArray(data) ? data.filter((item): item is string => typeof item === 'string') : [];
        setBranches(normalizeBranches([defaultBranch, ...fetched]));
      })
      .catch(() => {
        if (!active) return;
        setBranches([defaultBranch]);
      });

    return () => {
      active = false;
    };
  }, [projectId, defaultBranch]);

  return useMemo(
    () => normalizeBranches(defaultBranch ? [defaultBranch, ...branches] : branches),
    [branches, defaultBranch]
  );
}
