"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  GitBranch,
  Play,
  Settings,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Circle,
  RefreshCw,
} from "lucide-react";
import type { Dictionary } from "@/i18n";
import type {
  PipelineSummary,
  PipelineRunStatus,
} from "@/services/pipelineTypes";
import { durationLabel, ENV_LABELS, STATUS_VARIANTS } from "@/services/pipelineTypes";
import { withOrgPrefix } from "@/lib/orgPath";
import CreatePipelineWizard from "@/components/pipeline/CreatePipelineWizard";

type Project = { id: string; name: string };

const STATUS_ICONS: Record<PipelineRunStatus, React.ReactNode> = {
  success: <CheckCircle className="size-3.5 text-success" />,
  failed: <XCircle className="size-3.5 text-danger" />,
  timed_out: <XCircle className="size-3.5 text-danger" />,
  running: <RefreshCw className="size-3.5 text-warning animate-spin" />,
  queued: <Clock className="size-3.5 text-muted-foreground" />,
  canceled: <Circle className="size-3.5 text-muted-foreground" />,
  skipped: <Circle className="size-3.5 text-muted-foreground" />,
};

const ENV_BADGE_VARIANT: Record<string, "success" | "warning" | "danger" | "muted"> = {
  production: "danger",
  staging: "warning",
  development: "muted",
};

export default function PipelinesClient({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const pathname = usePathname();

  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const p = dict.pipelines;

  useEffect(() => {
    Promise.all([
      fetch("/api/projects")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch("/api/pipelines")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([projs, pipes]) => {
      setProjects(Array.isArray(projs) ? projs : []);
      setPipelines(Array.isArray(pipes) ? pipes : []);
      setLoading(false);
    });
  }, []);

  function handleCreated(pipelineId: string) {
    router.push(withOrgPrefix(pathname, `/pipelines/${pipelineId}`));
  }

  async function handleRun(e: React.MouseEvent, pipelineId: string) {
    e.preventDefault();
    e.stopPropagation();
    setRunningIds((prev) => new Set(prev).add(pipelineId));
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "manual" }),
      });
      if (!res.ok) throw new Error("failed");
      router.push(withOrgPrefix(pathname, `/pipelines/${pipelineId}`));
    } catch {
      // ignore — user sees detail page anyway
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(pipelineId);
        return next;
      });
    }
  }

  // ── Stage indicators (4 icons representing each stage) ────────────────────
  function StageIndicators({ pipeline }: { pipeline: PipelineSummary }) {
    const run = pipeline.last_run;
    const status = run?.status;

    // We don't know per-stage status from summary — show last run global status
    // as a simple "did it succeed?" indicator on the deploy dot.
    const stageKeys = ["source", "review", "build", "deploy"] as const;
    return (
      <div className="flex items-center gap-1.5">
        {stageKeys.map((stage, i) => {
          const label = p.stages[stage];
          return (
            <div key={stage} className="flex items-center gap-1">
              <div
                title={label}
                className={`size-1.5 rounded-full transition-colors ${
                  !run
                    ? "bg-border"
                    : status === "success"
                    ? "bg-success"
                    : status === "running" && i === 3
                    ? "bg-warning animate-pulse"
                    : status === "failed" && i === 3
                    ? "bg-danger"
                    : "bg-success"
                }`}
              />
              {i < stageKeys.length - 1 && (
                <div className="w-2 h-px bg-border" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-heading-md text-foreground">{p.title}</div>
            <div className="text-copy-sm text-muted-foreground">
              {p.description}
            </div>
          </div>
          <Button variant="default" size="sm" onClick={() => setWizardOpen(true)}>
            {p.new}
          </Button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-6 py-2 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground gap-4 shrink-0">
        <div className="flex-1">{dict.common.name}</div>
        <div className="w-24 text-center">{p.environment}</div>
        <div className="w-32">{p.stages.source} → {p.stages.deploy}</div>
        <div className="w-40">{p.detail.runHistory}</div>
        <div className="w-28" />
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="px-6 py-10 text-sm text-muted-foreground">
            {dict.common.loading}
          </div>
        )}

        {!loading && pipelines.length === 0 && (
          <div className="flex flex-col items-start gap-3 px-6 py-20">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Zap className="size-5 text-muted-foreground" />
            </div>
            <div className="text-heading-sm">{p.emptyTitle}</div>
            <div className="text-copy-sm text-muted-foreground">
              {p.emptyDescription}
            </div>
            <Button variant="default" size="sm" onClick={() => setWizardOpen(true)}>
              {p.new}
            </Button>
          </div>
        )}

        {!loading &&
          pipelines.map((pipeline) => {
            const run = pipeline.last_run;
            const detailHref = withOrgPrefix(
              pathname,
              `/pipelines/${pipeline.id}`
            );

            return (
              <Link
                key={pipeline.id}
                href={detailHref}
                className="flex items-center gap-4 px-6 py-3.5 border-b border-border hover:bg-muted/30 transition-colors group"
              >
                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {pipeline.name}
                    </span>
                    {pipeline.auto_trigger && (
                      <span title={p.basic.autoTrigger}>
                        <Zap className="size-3 text-muted-foreground shrink-0" />
                      </span>
                    )}
                  </div>
                  {pipeline.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {pipeline.description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <GitBranch className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {pipeline.trigger_branch}
                    </span>
                  </div>
                </div>

                {/* Environment */}
                <div className="w-24 flex justify-center">
                  <Badge
                    variant={ENV_BADGE_VARIANT[pipeline.environment] ?? "muted"}
                    size="sm"
                  >
                    {ENV_LABELS[pipeline.environment] ?? pipeline.environment}
                  </Badge>
                </div>

                {/* Stage progress dots */}
                <div className="w-32">
                  <StageIndicators pipeline={pipeline} />
                </div>

                {/* Last run */}
                <div className="w-40">
                  {run ? (
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICONS[run.status]}
                      <div>
                        <div className="text-xs text-foreground font-medium">
                          {p.status[run.status]}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {run.started_at
                            ? durationLabel(run.started_at, run.finished_at ?? undefined)
                            : "—"}
                          {" · "}
                          {new Date(run.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="w-28 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleRun(e, pipeline.id)}
                    disabled={runningIds.has(pipeline.id)}
                    className="h-7 px-2"
                  >
                    <Play className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-7 px-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`${detailHref}?tab=configure`}>
                      <Settings className="size-3" />
                    </Link>
                  </Button>
                </div>
              </Link>
            );
          })}
      </div>

      <CreatePipelineWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
        projects={projects}
        dict={dict}
      />
    </div>
  );
}
