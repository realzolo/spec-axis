"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Play,
  RotateCcw,
  Settings,
  History,
  ChevronRight,
  ChevronDown,
  GitBranch,
  GitCommit,
  Clock,
  CheckCircle,
  XCircle,
  Circle,
  RefreshCw,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type { Dictionary } from "@/i18n";
import type {
  PipelineConfig,
  PipelineDetail,
  PipelineEnvironment,
  PipelineRunDetail,
  PipelineRunStatus,
  PipelineSummary,
  PipelineStep,
} from "@/services/pipelineTypes";
import {
  createDefaultPipelineConfig,
  createDefaultStep,
  durationLabel,
  ENV_LABELS,
  STATUS_VARIANTS,
} from "@/services/pipelineTypes";
import { withOrgPrefix } from "@/lib/orgPath";

type Tab = "runs" | "configure";

const ENV_OPTIONS: PipelineEnvironment[] = [
  "development",
  "staging",
  "production",
];

type StageKey = "source" | "review" | "build" | "deploy";
const STAGE_KEYS: StageKey[] = ["source", "review", "build", "deploy"];

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_ICON: Record<PipelineRunStatus, React.ReactNode> = {
  success: <CheckCircle className="size-4 text-success" />,
  failed: <XCircle className="size-4 text-danger" />,
  timed_out: <XCircle className="size-4 text-danger" />,
  running: <RefreshCw className="size-4 text-warning animate-spin" />,
  queued: <Clock className="size-4 text-muted-foreground" />,
  canceled: <Circle className="size-4 text-muted-foreground" />,
  skipped: <Circle className="size-4 text-muted-foreground" />,
};

const STATUS_ICON_SM: Record<PipelineRunStatus, React.ReactNode> = {
  success: <CheckCircle className="size-3 text-success" />,
  failed: <XCircle className="size-3 text-danger" />,
  timed_out: <XCircle className="size-3 text-danger" />,
  running: <RefreshCw className="size-3 text-warning animate-spin" />,
  queued: <Clock className="size-3 text-muted-foreground" />,
  canceled: <Circle className="size-3 text-muted-foreground" />,
  skipped: <Circle className="size-3 text-muted-foreground" />,
};

type PipelineRun = PipelineRunDetail["run"];

// ── Main component ─────────────────────────────────────────────────────────

export default function PipelineDetailClient({
  dict,
  pipelineId,
}: {
  dict: Dictionary;
  pipelineId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const p = dict.pipelines;

  const initialTab = (searchParams.get("tab") as Tab) ?? "runs";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<PipelineRunDetail | null>(null);
  const [logText, setLogText] = useState("");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [configStageTab, setConfigStageTab] = useState<StageKey>("source");
  const logRef = useRef<HTMLDivElement>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadPipeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      const rawCfg = data?.version?.config ?? data?.version?.Config;
      const cfg: PipelineConfig =
        typeof rawCfg === "string" ? JSON.parse(rawCfg) : rawCfg;
      setPipeline(data?.pipeline ?? data);
      setConfig(cfg ?? createDefaultPipelineConfig(""));
    } catch {
      toast.error(p.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, p.loadFailed]);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/runs`);
      const data = res.ok ? await res.json() : [];
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      setRuns([]);
    }
  }, [pipelineId]);

  useEffect(() => {
    loadPipeline();
    loadRuns();
  }, [loadPipeline, loadRuns]);

  // Auto-select the most recent run
  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  // Poll run detail while running
  useEffect(() => {
    if (!selectedRunId) return;
    let active = true;

    async function fetchDetail() {
      try {
        const res = await fetch(`/api/pipeline-runs/${selectedRunId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setRunDetail(data);
        // Auto-expand first job
        if (data?.jobs?.length > 0 && !expandedJobId) {
          setExpandedJobId(data.jobs[0].id);
        }
      } catch {/* ignore */}
    }

    fetchDetail();
    const isActive =
      runs.find((r) => r.id === selectedRunId)?.status === "running" ||
      runs.find((r) => r.id === selectedRunId)?.status === "queued";
    if (!isActive) return;

    const interval = setInterval(fetchDetail, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedRunId, runs, expandedJobId]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logText]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadLog(stepId: string) {
    setSelectedStepId(stepId);
    setLogText("");
    try {
      const res = await fetch(
        `/api/pipeline-runs/${selectedRunId}/logs/${stepId}?offset=0&limit=500000`
      );
      const text = res.ok ? await res.text() : "";
      setLogText(text);
    } catch {
      setLogText("");
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "manual" }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success(p.runQueued);
      await loadRuns();
      setTab("runs");
    } catch {
      toast.error(p.runFailed);
    } finally {
      setRunning(false);
    }
  }

  async function handleRollback(runId: string) {
    setRollingBack(runId);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "rollback", rollbackOf: runId }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success(p.rollbackSuccess);
      await loadRuns();
    } catch {
      toast.error(p.rollbackFailed);
    } finally {
      setRollingBack(null);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pipeline?.name ?? config.name,
          description: pipeline?.description ?? config.description,
          environment: pipeline?.environment ?? "production",
          config,
        }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success(p.saveSuccess);
      await loadPipeline();
    } catch {
      toast.error(p.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  // ── Config step helpers ────────────────────────────────────────────────────

  function addStep(stage: "build" | "deploy") {
    if (!config) return;
    setConfig({
      ...config,
      [stage]: {
        ...config[stage],
        steps: [...config[stage].steps, createDefaultStep()],
      },
    });
  }

  function removeStep(stage: "build" | "deploy", stepId: string) {
    if (!config) return;
    setConfig({
      ...config,
      [stage]: {
        ...config[stage],
        steps: config[stage].steps.filter((s) => s.id !== stepId),
      },
    });
  }

  function updateStep(
    stage: "build" | "deploy",
    stepId: string,
    patch: Partial<PipelineStep>
  ) {
    if (!config) return;
    setConfig({
      ...config,
      [stage]: {
        ...config[stage],
        steps: config[stage].steps.map((s) =>
          s.id === stepId ? { ...s, ...patch } : s
        ),
      },
    });
  }

  // ── Stage progress bar ─────────────────────────────────────────────────────

  function StagePipeline({ run }: { run: PipelineRun | undefined }) {
    const status = run?.status;
    return (
      <div className="flex items-center gap-0">
        {STAGE_KEYS.map((stage, i) => {
          const label = p.stages[stage];
          const dot =
            !run
              ? "bg-border"
              : status === "success"
              ? "bg-success"
              : status === "running" && i === 3
              ? "bg-warning animate-pulse"
              : status === "failed" && i === 3
              ? "bg-danger"
              : i < 3
              ? "bg-success"
              : "bg-border";
          const barColor =
            !run
              ? "bg-border"
              : status === "success"
              ? "bg-success/40"
              : i < 3
              ? "bg-success/40"
              : "bg-border";

          return (
            <div key={stage} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`size-2.5 rounded-full ${dot}`} />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {label}
                </span>
              </div>
              {i < STAGE_KEYS.length - 1 && (
                <div className={`h-px w-12 mx-1 mb-3 ${barColor}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-6 py-10 text-sm text-muted-foreground">
        {dict.common.loading}
      </div>
    );
  }

  const currentRun = runs.find((r) => r.id === selectedRunId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-heading-md text-foreground truncate">
                {pipeline?.name ?? "Pipeline"}
              </span>
              {pipeline?.environment && (
                <Badge
                  variant={
                    pipeline.environment === "production"
                      ? "danger"
                      : pipeline.environment === "staging"
                      ? "warning"
                      : "muted"
                  }
                  size="sm"
                >
                  {ENV_LABELS[pipeline.environment]}
                </Badge>
              )}
            </div>
            {pipeline?.description && (
              <div className="text-copy-sm text-muted-foreground truncate mt-0.5">
                {pipeline.description}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <GitBranch className="size-3" />
                {pipeline?.trigger_branch ?? "main"}
              </div>
              {pipeline?.auto_trigger && (
                <span className="text-accent text-[11px]">
                  Auto-trigger on push
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTab("configure")}
              className={tab === "configure" ? "bg-muted" : ""}
            >
              <Settings className="size-3.5 mr-1" />
              {p.detail.configure}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleRun}
              disabled={running}
            >
              <Play className="size-3.5 mr-1" />
              {running ? dict.common.loading : p.runPipeline}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-background shrink-0">
        <div className="flex px-6 gap-1">
          {(["runs", "configure"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "runs" ? (
                <History className="size-3.5" />
              ) : (
                <Settings className="size-3.5" />
              )}
              {t === "runs" ? p.detail.runHistory : p.detail.configure}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* ── Runs tab ──────────────────────────────────────────────────── */}
        {tab === "runs" && (
          <div className="flex h-full">
            {/* Left: run list */}
            <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  {p.detail.runHistory}
                </span>
                <button
                  onClick={loadRuns}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {runs.length === 0 && (
                  <div className="px-4 py-8 text-xs text-muted-foreground text-center">
                    {p.detail.noRuns}
                  </div>
                )}
                {runs.map((run, idx) => (
                  <button
                    key={run.id}
                    onClick={() => {
                      setSelectedRunId(run.id);
                      setRunDetail(null);
                      setSelectedStepId(null);
                      setLogText("");
                      setExpandedJobId(null);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                      selectedRunId === run.id
                        ? "bg-muted/50"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICON_SM[run.status as PipelineRunStatus]}
                        <span className="text-xs font-medium">
                          #{runs.length - idx}
                        </span>
                      </div>
                      <Badge
                        variant={STATUS_VARIANTS[run.status as PipelineRunStatus]}
                        size="sm"
                      >
                        {p.status[run.status as PipelineRunStatus]}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {p.detail.trigger[
                        run.trigger_type as keyof typeof p.detail.trigger
                      ] ?? run.trigger_type}
                      {run.branch && (
                        <span className="ml-1">· {run.branch}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(run.created_at).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: run detail */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedRunId && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  {p.detail.noRuns}
                </div>
              )}

              {selectedRunId && (
                <>
                  {/* Run header */}
                  <div className="px-6 py-4 border-b border-border shrink-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {currentRun &&
                            STATUS_ICON[currentRun.status as PipelineRunStatus]}
                          <span className="text-sm font-semibold">
                            {p.detail.runId.replace(
                              "{{num}}",
                              String(
                                runs.length -
                                  runs.findIndex((r) => r.id === selectedRunId)
                              )
                            )}
                          </span>
                          {currentRun && (
                            <Badge
                              variant={
                                STATUS_VARIANTS[
                                  currentRun.status as PipelineRunStatus
                                ]
                              }
                              size="sm"
                            >
                              {p.status[currentRun.status as PipelineRunStatus]}
                            </Badge>
                          )}
                        </div>

                        {currentRun && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {currentRun.branch && (
                              <div className="flex items-center gap-1">
                                <GitBranch className="size-3" />
                                {currentRun.branch}
                              </div>
                            )}
                            {currentRun.commit_sha && (
                              <div className="flex items-center gap-1">
                                <GitCommit className="size-3" />
                                {currentRun.commit_sha.slice(0, 7)}
                              </div>
                            )}
                            {currentRun.started_at && (
                              <div className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {durationLabel(
                                  currentRun.started_at,
                                  currentRun.finished_at ?? undefined
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Stage progress */}
                        <StagePipeline run={currentRun} />
                      </div>

                      {/* Rollback / retry */}
                      {currentRun &&
                        (currentRun.status === "success" ||
                          currentRun.status === "failed") &&
                        config?.deploy?.rollbackEnabled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRollback(selectedRunId)}
                            disabled={rollingBack === selectedRunId}
                          >
                            <RotateCcw className="size-3.5 mr-1" />
                            {currentRun.status === "success"
                              ? p.rollback
                              : p.retry}
                          </Button>
                        )}
                    </div>
                  </div>

                  {/* Jobs + logs */}
                  <div className="flex-1 flex overflow-hidden">
                    {/* Job/step tree */}
                    <div className="w-56 shrink-0 border-r border-border overflow-y-auto">
                      {!runDetail && (
                        <div className="px-4 py-6 text-xs text-muted-foreground">
                          {dict.common.loading}
                        </div>
                      )}
                      {runDetail?.jobs.map((job) => (
                        <div key={job.id}>
                          <button
                            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                            onClick={() =>
                              setExpandedJobId(
                                expandedJobId === job.id ? null : job.id
                              )
                            }
                          >
                            {STATUS_ICON_SM[job.status as PipelineRunStatus]}
                            <span className="text-xs font-medium flex-1 text-left truncate">
                              {job.name}
                            </span>
                            {expandedJobId === job.id ? (
                              <ChevronDown className="size-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3 text-muted-foreground" />
                            )}
                          </button>
                          {expandedJobId === job.id &&
                            runDetail.steps
                              .filter((s) => s.job_id === job.id)
                              .map((step) => (
                                <button
                                  key={step.id}
                                  onClick={() => loadLog(step.id)}
                                  className={`w-full flex items-center gap-2 pl-8 pr-4 py-1.5 transition-colors text-left ${
                                    selectedStepId === step.id
                                      ? "bg-muted/50"
                                      : "hover:bg-muted/20"
                                  }`}
                                >
                                  {STATUS_ICON_SM[
                                    step.status as PipelineRunStatus
                                  ]}
                                  <span className="text-[11px] truncate text-muted-foreground">
                                    {step.name}
                                  </span>
                                </button>
                              ))}
                        </div>
                      ))}
                    </div>

                    {/* Log viewer */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d0d]">
                      {!selectedStepId && (
                        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                          {p.log.selectStep}
                        </div>
                      )}
                      {selectedStepId && (
                        <div
                          ref={logRef}
                          className="flex-1 overflow-y-auto p-4 font-mono text-[11px] text-green-400 leading-relaxed whitespace-pre-wrap"
                        >
                          {logText || (
                            <span className="text-muted-foreground">
                              {p.log.noLogs}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Configure tab ──────────────────────────────────────────────── */}
        {tab === "configure" && config && (
          <div className="flex h-full">
            {/* Stage nav */}
            <div className="w-40 shrink-0 border-r border-border py-4 space-y-1 px-3">
              {STAGE_KEYS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setConfigStageTab(s)}
                  className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                    configStageTab === s
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-muted/80 text-[10px] flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {p.stageTab[s]}
                </button>
              ))}
              <Separator className="my-3" />
              {/* Pipeline-level settings */}
              <button
                onClick={() => setConfigStageTab("source" as StageKey)}
                className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {dict.common.settings ?? "Settings"}
              </button>
            </div>

            {/* Stage editor */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Source */}
              {configStageTab === "source" && (
                <div className="space-y-4 max-w-lg">
                  <div>
                    <div className="text-sm font-medium">{p.source.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.source.description}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">{p.basic.branch}</label>
                    <Input
                      value={config.source.branch}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          source: { ...config.source, branch: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <Switch
                      checked={config.source.autoTrigger}
                      onCheckedChange={(v) =>
                        setConfig({
                          ...config,
                          source: { ...config.source, autoTrigger: v },
                        })
                      }
                    />
                    <div>
                      <div className="text-sm font-medium">
                        {p.basic.autoTrigger}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.basic.autoTriggerHelp}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Review */}
              {configStageTab === "review" && (
                <div className="space-y-4 max-w-lg">
                  <div>
                    <div className="text-sm font-medium">{p.review.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.review.description}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <span className="text-sm font-medium">{p.review.enabled}</span>
                    <Switch
                      checked={config.review.enabled}
                      onCheckedChange={(v) =>
                        setConfig({
                          ...config,
                          review: { ...config.review, enabled: v },
                        })
                      }
                    />
                  </div>
                  {config.review.enabled && (
                    <div className="space-y-3 rounded-lg border border-border px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">
                            {p.review.qualityGateEnabled}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {p.review.qualityGateHelp}
                          </div>
                        </div>
                        <Switch
                          checked={config.review.qualityGateEnabled}
                          onCheckedChange={(v) =>
                            setConfig({
                              ...config,
                              review: {
                                ...config.review,
                                qualityGateEnabled: v,
                              },
                            })
                          }
                        />
                      </div>
                      {config.review.qualityGateEnabled && (
                        <div className="space-y-1.5 pt-2 border-t border-border">
                          <label className="text-xs font-medium">
                            {p.review.minScore}
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={config.review.qualityGateMinScore}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  review: {
                                    ...config.review,
                                    qualityGateMinScore: Math.min(
                                      100,
                                      Math.max(0, Number(e.target.value))
                                    ),
                                  },
                                })
                              }
                              className="w-24"
                            />
                            <span className="text-xs text-muted-foreground">
                              / 100
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Build */}
              {configStageTab === "build" && (
                <ConfigStepEditor
                  stage="build"
                  config={config}
                  setConfig={setConfig}
                  onAdd={() => addStep("build")}
                  onRemove={(id) => removeStep("build", id)}
                  onUpdate={(id, patch) => updateStep("build", id, patch)}
                  p={p}
                />
              )}

              {/* Deploy */}
              {configStageTab === "deploy" && (
                <div className="space-y-4 max-w-2xl">
                  <ConfigStepEditor
                    stage="deploy"
                    config={config}
                    setConfig={setConfig}
                    onAdd={() => addStep("deploy")}
                    onRemove={(id) => removeStep("deploy", id)}
                    onUpdate={(id, patch) => updateStep("deploy", id, patch)}
                    p={p}
                  />
                  {config.deploy.enabled && (
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <Switch
                        checked={config.deploy.rollbackEnabled}
                        onCheckedChange={(v) =>
                          setConfig({
                            ...config,
                            deploy: { ...config.deploy, rollbackEnabled: v },
                          })
                        }
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {p.deploy.rollbackEnabled}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.deploy.rollbackHelp}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save footer */}
            <div className="absolute bottom-0 right-0 left-40 px-6 py-3 border-t border-border bg-background flex justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? dict.common.loading : p.savePipeline}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Config step editor ─────────────────────────────────────────────────────

function ConfigStepEditor({
  stage,
  config,
  setConfig,
  onAdd,
  onRemove,
  onUpdate,
  p,
}: {
  stage: "build" | "deploy";
  config: PipelineConfig;
  setConfig: (c: PipelineConfig) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PipelineStep>) => void;
  p: Dictionary["pipelines"];
}) {
  const stageConfig = config[stage];
  const stageP = p[stage];
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <div className="text-sm font-medium">{stageP.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {stageP.description}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <span className="text-sm font-medium">{stageP.enabled}</span>
        <Switch
          checked={stageConfig.enabled}
          onCheckedChange={(v) =>
            setConfig({ ...config, [stage]: { ...stageConfig, enabled: v } })
          }
        />
      </div>
      {stageConfig.enabled && (
        <div className="space-y-3">
          {stageConfig.steps.length === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {stageP.noSteps}
            </div>
          )}
          {stageConfig.steps.map((step, idx) => (
            <div
              key={step.id}
              className="rounded-lg border border-border bg-background p-3 space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium w-5 shrink-0">
                  {idx + 1}.
                </span>
                <Input
                  value={step.name}
                  onChange={(e) => onUpdate(step.id, { name: e.target.value })}
                  placeholder={p.step.namePlaceholder}
                  className="h-7 text-xs flex-1"
                />
                <button
                  onClick={() => onRemove(step.id)}
                  className="text-muted-foreground hover:text-danger transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Textarea
                value={step.script}
                onChange={(e) => onUpdate(step.id, { script: e.target.value })}
                placeholder={p.step.scriptPlaceholder}
                rows={3}
                className="text-xs font-mono resize-none"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={onAdd} className="w-full">
            <Plus className="size-3.5 mr-1" />
            {stageP.addStep}
          </Button>
        </div>
      )}
    </div>
  );
}
