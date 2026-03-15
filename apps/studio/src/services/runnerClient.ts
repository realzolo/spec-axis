type AnalyzePayload = {
  projectId: string;
  reportId: string;
  repo: string;
  hashes: string[];
  rules: Array<{ category: string; name: string; prompt: string; severity: string }>;
  previousReport: Record<string, unknown> | null;
  useIncremental: boolean;
};

type RunnerResponse = {
  taskId: string;
};

export async function enqueueAnalyze(payload: AnalyzePayload): Promise<RunnerResponse> {
  const baseUrl = process.env.RUNNER_BASE_URL?.replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('RUNNER_BASE_URL is not configured');
  }

  const token = process.env.RUNNER_TOKEN;
  const res = await fetch(`${baseUrl}/v1/tasks/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Runner-Token': token } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Runner enqueue failed: ${res.status} ${text}`);
  }

  return (await res.json()) as RunnerResponse;
}
