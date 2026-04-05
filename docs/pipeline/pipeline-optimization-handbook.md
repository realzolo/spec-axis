# Pipeline Optimization Handbook

This handbook is a step-by-step execution manual for improving a new or existing pipeline in Sykra. Use it when a pipeline is slow, noisy, fragile, hard to diagnose, unsafe for production, or difficult to evolve. Follow the steps in order. The goal is not to add more pipeline complexity. The goal is to make execution faster to validate, safer to release, easier to operate, and easier to improve through versioned changes.

This handbook is operational guidance. For canonical product behavior and runtime contracts, refer to:

- `docs/claude/pipeline-engine.md`
- `docs/claude/architecture.md`
- `docs/claude/api-contracts.md`

## Optimization principles

Apply these principles before changing any pipeline:

1. Optimize for fast failure. Detect invalid source, poor review quality, and blocking static-analysis findings as early as possible.
2. Increase control as environment criticality rises. Development can optimize for speed; production must optimize for safety and auditability.
3. Prefer explicit artifact promotion over rebuilds. Build once, publish once, and promote immutable outputs through channels.
4. Use measurable evidence over intuition. Make decisions from `run_stats_7d`, recent failures, execution summaries, and release provenance.
5. Evolve through versioned changes. Change one meaningful optimization lever at a time and review the version diff before rollout.

## Step 1 — Define the target operating model

Start by defining the operating model the pipeline must support.

Decide these inputs first:

- Which environment the pipeline targets by default: `development`, `preview`, or `production`
- Whether the pipeline is for validation, release preparation, deployment, or end-to-end delivery
- Whether the final deploy consumes same-run outputs or published registry artifacts
- Who is allowed to approve manual deploy gates
- Whether the pipeline should optimize for throughput, recency, or safety

Recommended defaults:

- Use `development` for fast validation and internal feedback loops.
- Use `preview` for shared verification and pre-release checks.
- Use `production` only when the pipeline is explicitly designed for controlled release.
- Keep the pipeline purpose narrow. A pipeline that tries to optimize validation, packaging, promotion, and deployment equally will become hard to tune.

Avoid:

- Treating the environment as a badge only. In Sykra, environment affects execution semantics and release control.
- Mixing validation and production release concerns without an explicit promotion boundary.

## Step 2 — Establish source and trigger strategy

Set source and trigger behavior before tuning jobs.

Use these practices:

1. Set a single source branch strategy for the pipeline.
2. Enable `autoTrigger` only when a new commit should normally create a run.
3. Add a schedule only when the pipeline has a purpose that is not already covered by push-driven execution.
4. Keep scheduled pipelines focused on health checks, compliance checks, drift detection, or recurring release automation.

Recommended defaults:

- Use push-driven execution for branch validation pipelines.
- Use schedules for recurring operational checks, not as a duplicate of push events.
- Keep the source branch explicit when the pipeline is not intended to follow the project default branch.

Avoid:

- Enabling both frequent schedules and push triggers when they produce nearly identical runs.
- Using a schedule to compensate for poor trigger discipline.
- Allowing source behavior to become ambiguous across environments.

## Step 3 — Choose the right concurrency mode

Concurrency mode is one of the strongest optimization levers in the system.

### Use `allow`

Choose `allow` when runs are independent and parallel execution is acceptable.

Best for:

- Development validation pipelines
- Low-risk pipelines without shared mutable deployment targets
- Pipelines where older runs still provide useful feedback

### Use `queue`

Choose `queue` when only one run should actively progress at a time, but older runs still matter.

Best for:

- Preview or shared integration environments
- Serialized release preparation
- Pipelines with expensive build or deployment stages that must not overlap

### Use `cancel_previous`

Choose `cancel_previous` when only the latest run matters.

Best for:

- Fast-moving validation branches
- Pipelines where outdated results create noise
- Workloads where recency matters more than completeness

Avoid:

- Using `allow` for production deployment pipelines
- Using `queue` when old commits become irrelevant quickly
- Using `cancel_previous` where partial deployment side effects or audit expectations require every run to complete or fail explicitly

## Step 4 — Set environment strategy and stage controls

After defining concurrency, align stage controls with environment criticality.

Recommended defaults:

- Keep early stages automatic in `development` and `preview` unless there is a strong operational reason to pause.
- Require stronger human control as the pipeline approaches production-facing deployment.
- Treat `production` as a controlled environment. Production pipelines must require a manual deploy entry gate.
- Use serial dispatch only where ordering is required for correctness, safety, or resource control.
- Use parallel dispatch when it shortens execution without making diagnosis harder.

Best practice:

- Keep `source` automatic and deterministic.
- Keep `review` automatic so bad changes fail early.
- Add manual entry where the next action has operational impact, especially before production deploy.

Avoid:

- Adding manual control to low-risk stages that only create friction.
- Using serial mode by default across all stages.
- Making stage controls inconsistent with the target environment.

## Step 5 — Optimize the review stage with `quality_gate`

Treat `quality_gate` as the primary early decision point in the pipeline.

In Sykra, `quality_gate` is canonical and must stay on the `review` stage. It always runs AI review first and static analysis second.

Use these practices:

1. Set `minScore` deliberately. Start with a realistic threshold, then tighten it as signal quality improves.
2. Make static analysis machine-readable wherever possible.
3. Prefer SARIF or another structured report format when supported by the toolchain.
4. Always declare the static-analysis artifact path so the result can be uploaded and ingested even when the analyzer exits non-zero.
5. Scope analyzers to the changed-file manifest when the ecosystem supports it.

Recommended defaults:

- Fail early on poor review quality instead of letting weak changes reach later stages.
- Prefer analyzers that emit structured findings over analyzers that only return a shell exit code.
- Keep review criteria consistent for a given branch or environment class.

Avoid:

- Treating `quality_gate` as a cosmetic stage
- Relying only on plain shell output when structured evidence is available
- Setting an unrealistically strict score threshold before the review signal is stable

## Step 6 — Design reproducible build execution and useful artifacts

A good pipeline build stage is reproducible, explicit, and artifact-oriented.

Use these practices:

1. Keep `buildImage` explicit and stable.
2. Ensure the image already contains the required tools for the repository contract.
3. Keep CI execution inside the Conductor-managed sandbox model.
4. Produce artifacts that are useful for downstream consumers, not only logs for humans.
5. Split jobs only when the split improves diagnosis, caching behavior, or operator clarity.

Recommended defaults:

- Use official runtime base images as a starting point for build images.
- Keep build scripts deterministic and repository-aware.
- Publish artifacts that can support promotion, rollback, and deployment provenance.

Avoid:

- Letting CI steps depend on ad-hoc tool installation inside the runner container
- Breaking the build into many tiny jobs with little diagnostic value
- Treating a successful exit code as sufficient when no useful artifact is preserved

## Step 7 — Add manual control where human judgment matters

Manual execution in Sykra is node-based, not stage-resume based. Use that precision deliberately.

Use manual gates when:

- A production deployment needs explicit approval
- A risky deployment should confirm release timing or release readiness
- The next action has business, customer, or infrastructure impact

Best practices:

- Keep validation and evidence collection automatic before a manual decision.
- Require the manual decision at the exact node where human judgment adds value.
- Use retry for failed nodes when the existing run snapshot should be preserved.
- Trigger a new run when you want the latest saved pipeline version, not the previous run snapshot.

Avoid:

- Adding manual pauses where the operator has no new decision to make
- Using retries as a substitute for saving a corrected pipeline revision
- Hiding production release risk inside automatic downstream execution

## Step 8 — Make runtime observability part of the design

Do not treat observability as a debugging afterthought. Design the pipeline so operators can understand failures quickly.

Use these practices:

1. Ensure important steps produce readable logs and useful artifacts.
2. Use the runtime board, live run stream, and node dialogs during active execution.
3. Use execution summaries after runs to identify the critical path and first failure.
4. Keep step boundaries meaningful so the runtime view tells a clear story.
5. Preserve enough evidence to diagnose failed builds and failed deploys without rerunning immediately.

Recommended defaults:

- Put the most failure-prone and most informative checks early.
- Keep commands explicit enough that operators can understand what executed.
- Use structured analysis artifacts for evidence, not only terminal logs.

Avoid:

- Long opaque scripts that hide the failing command
- Steps that collapse many unrelated concerns into one log stream
- Pipelines that require operators to inspect every node to find the first actionable failure

## Step 9 — Optimize artifact provenance and channel promotion

Use artifact provenance and channel promotion as part of the operating model, not as optional extras.

Use these practices:

1. Publish immutable outputs when a build is meant to be reused or deployed again.
2. Promote a previously published version to a channel instead of rebuilding the same code.
3. Keep release lineage visible: source run, commit, branch, publisher, publish time, and channels.
4. Make deploy stages consume the right source:
   - use same-run outputs when the deploy must track the exact current run
   - use registry version or channel when deployment should follow an immutable release workflow

Recommended defaults:

- Build once and promote through channels for production-facing delivery.
- Use channel promotion to separate release approval from build execution.
- Keep rollback paths tied to published artifacts.

Avoid:

- Rebuilding the same commit for each environment when a promoted artifact would provide stronger provenance
- Deploying without a clear artifact source
- Treating release channels as labels without operational meaning

## Step 10 — Use version history to iterate safely

Pipeline optimization should happen through controlled revisions.

Use these practices:

1. Save configuration changes as meaningful versions.
2. Review the version diff before rollout.
3. Change one optimization lever at a time when possible.
4. Observe run outcomes before applying the next major optimization.

Recommended sequence for a change cycle:

1. Identify one operational problem.
2. Choose the smallest configuration change that addresses it.
3. Save and review the version diff.
4. Trigger a run and inspect runtime behavior.
5. Compare results with recent runs.

Avoid:

- Bundling unrelated trigger, gate, concurrency, and deploy changes into one revision
- Making multiple major optimizations without measuring the outcome between them
- Using retries to validate configuration changes that should be tested in a new versioned run

## Step 11 — Use `run_stats_7d` and recent runs to improve continuously

Optimization is a loop, not a one-time edit.

Use `run_stats_7d`, recent run history, execution summaries, and failure patterns to decide what to change next.

Look for these signals:

- Low success rate
- Rising failed-run count
- Persistent active-run backlog
- Long critical-path duration
- Frequent manual waiting without added safety
- Repeated failure signatures in the same stage or job

When you see these signals, optimize in this order:

1. Fix trigger noise and overlapping execution.
2. Correct the concurrency mode.
3. Tighten the earliest useful gate.
4. Improve artifact and log evidence.
5. Simplify stage and job structure where diagnosis is poor.
6. Improve promotion discipline before touching production automation.

Avoid:

- Tuning late-stage deployment behavior before fixing noisy triggers and weak review gates
- Drawing conclusions from one isolated run when a 7-day pattern tells a different story
- Increasing automation on a pipeline that still lacks strong evidence and clear rollback inputs

## Suggested implementation roadmap

Use this roadmap when you want to apply the handbook as a delivery sequence rather than as a pure review checklist. The phases are ordered by dependency and expected return. Do not start `P1` or `P2` by default if the `P0` baseline is still unstable.

### P0 — Stabilize the execution baseline

Complete `P0` first. The goal is to make the pipeline predictable, fast to reject bad changes, and safe to operate.

Prioritize these changes:

1. Clarify the operating model.
   - Choose the primary environment and pipeline purpose.
   - Make the deploy artifact source explicit: same-run output or published registry artifact.
2. Correct trigger and source behavior.
   - Remove duplicated push/schedule behavior unless each trigger has a distinct purpose.
   - Make the source branch strategy explicit.
3. Set the right concurrency mode.
   - Use `cancel_previous` for fast validation where only the newest run matters.
   - Use `queue` for shared environments and controlled release flows.
   - Avoid `allow` for production-facing deploy pipelines.
4. Make `quality_gate` the earliest strong decision point.
   - Keep it automatic on the `review` stage.
   - Set a realistic `minScore` threshold.
   - Declare the static-analysis artifact path explicitly.
   - Prefer SARIF or another structured report format.
5. Make CI execution reproducible.
   - Keep `buildImage` explicit.
   - Verify the image already contains the required repository tools.
   - Preserve the smallest set of useful downstream artifacts.
6. Enforce production safety rules.
   - Require the manual deploy entry gate for `production`.
   - Remove low-value manual pauses from non-critical stages.

Exit criteria for `P0`:

- The pipeline has a clear environment, trigger strategy, and concurrency mode.
- `quality_gate` blocks weak changes early with structured evidence.
- `buildImage` and artifact outputs are reproducible.
- Production deploy behavior is explicitly gated.

### P1 — Improve diagnosis, operator clarity, and recovery

Start `P1` after the execution baseline is stable. The goal is to reduce operator confusion and shorten time-to-diagnosis.

Prioritize these changes:

1. Strengthen runtime observability.
   - Ensure important steps produce readable logs and actionable artifacts.
   - Keep step boundaries meaningful so failures are easy to isolate.
   - Use execution summaries to review critical path and first failure after each run.
2. Use telemetry as the optimization loop.
   - Review `run_stats_7d` before changing the pipeline again.
   - Compare recent failures by stage, not by intuition.
   - Fix repeated bottlenecks before adding more automation.
3. Improve manual execution discipline.
   - Keep manual approval only at nodes where human judgment adds value.
   - Use retry for node recovery when the existing run snapshot is still valid.
   - Use a new run when the change depends on a newer saved pipeline version.
4. Simplify runtime structure where diagnosis is poor.
   - Merge low-value job splits.
   - Split only where operator clarity, caching behavior, or failure isolation improves.
5. Standardize operator review habits.
   - Check recent run history, execution summaries, and artifact evidence together.
   - Review version diffs before triggering runs on materially changed pipeline configs.

Exit criteria for `P1`:

- Operators can identify the first actionable failure quickly.
- `run_stats_7d` and recent runs are part of normal pipeline tuning.
- Manual retry and new-run decisions are used consistently.
- Version diffs are reviewed before rollout of meaningful config changes.

### P2 — Mature release governance and artifact promotion

Start `P2` when the pipeline is already stable and diagnosable. The goal is to improve release discipline, provenance, and controlled reuse.

Prioritize these changes:

1. Move toward immutable release flow.
   - Publish artifact versions for builds that need reuse, rollback, or controlled deployment.
   - Prefer promotion through channels instead of rebuilding the same commit per environment.
2. Make deploy inputs governance-friendly.
   - Use registry-backed deploy inputs where release approval should be separated from build execution.
   - Keep the selected deploy source explicit for each deployment path.
3. Strengthen provenance and rollback readiness.
   - Keep source run, branch, commit, publish time, publisher, and channel assignments visible.
   - Ensure rollback targets a published artifact version, not an implicit rebuild.
4. Optimize environment-specific operating models.
   - Keep `development` optimized for recency and feedback speed.
   - Keep `preview` optimized for shared verification and serialized control when needed.
   - Keep `production` optimized for approval, provenance, and safety.
5. Iterate through versioned changes only.
   - Use version history to make one meaningful optimization change at a time.
   - Measure operational results before advancing the next governance or promotion change.

Exit criteria for `P2`:

- Release promotion is separated from rebuild where appropriate.
- Deployments use explicit and auditable artifact sources.
- Provenance and rollback behavior are clear to operators.
- The pipeline evolves through measured, versioned revisions.

## Recommended baseline patterns

### Fast feedback validation pipeline

Use this pattern when the goal is rapid commit feedback.

- Environment: `development`
- Trigger: push-driven
- Concurrency: `cancel_previous`
- Review: automatic `quality_gate`
- Build: minimal reproducible build and test path
- Deploy: none or non-critical only

### Protected production release pipeline

Use this pattern when production safety and auditability matter most.

- Environment: `production`
- Trigger: manual or tightly controlled automation
- Concurrency: `queue`
- Review: strict `quality_gate`
- Deploy: manual entry gate before production deploy
- Artifact flow: publish immutable version, then promote by channel

### Scheduled health-check pipeline

Use this pattern for recurring verification or drift detection.

- Environment: `preview` or `development`
- Trigger: schedule only, or schedule with a clearly different purpose than push-driven execution
- Concurrency: `allow` or `queue`, depending on runtime cost
- Review: focused on health signal, not full release semantics
- Deploy: optional, low-risk only

### Artifact-promotion-first deployment pipeline

Use this pattern when release governance is more important than rebuild speed.

- Build once from a pinned source snapshot
- Publish immutable artifact versions
- Promote to channels after review or approval
- Deploy from registry version or channel, not from a fresh rebuild

## Common anti-patterns to avoid

Do not optimize a pipeline by adding more moving parts than the product already needs.

Avoid these anti-patterns:

- Running production deploys without a manual deploy gate
- Rebuilding artifacts for each environment instead of promoting immutable outputs
- Choosing concurrency mode without considering recency, auditability, and side effects
- Depending only on shell exit codes when structured static-analysis evidence is available
- Splitting jobs for visual neatness rather than diagnostic value
- Duplicating push-trigger and scheduled behavior without a distinct operating purpose
- Treating environment labels, release channels, or version history as decorative metadata only

## Final optimization checklist

Use this checklist before considering a pipeline optimized.

### Operating model

- [ ] The target environment and delivery purpose are explicit.
- [ ] The pipeline has a narrow operational goal.
- [ ] The artifact source for deploy behavior is explicit.

### Source and triggers

- [ ] The source branch strategy is clear.
- [ ] `autoTrigger` is enabled only where push-driven execution is useful.
- [ ] Schedules exist only for a distinct operational purpose.

### Concurrency

- [ ] The selected concurrency mode matches the real operational goal.
- [ ] The pipeline does not allow unsafe overlap for shared deployment targets.
- [ ] Older runs are canceled, queued, or allowed intentionally.

### Environment and controls

- [ ] Stage controls reflect environment criticality.
- [ ] Production deploy behavior requires a manual entry gate.
- [ ] Serial execution is used only where order matters.

### Review quality

- [ ] `quality_gate` is the primary early decision point.
- [ ] `minScore` is deliberate and stable.
- [ ] Static analysis produces structured evidence when supported.
- [ ] The static-analysis artifact path is declared explicitly.

### Build and artifacts

- [ ] `buildImage` is explicit and reproducible.
- [ ] Required tools are present in the image.
- [ ] Build outputs are preserved as useful artifacts.
- [ ] Jobs are split only where the split improves execution or diagnosis.

### Manual control and recovery

- [ ] Manual gates exist only where human judgment adds value.
- [ ] Retry is used for run recovery, not for validating unsaved config changes.
- [ ] Operators know when to retry a node versus start a new run.

### Observability

- [ ] Logs, artifacts, and runtime summaries make failures diagnosable.
- [ ] The first failure is easy to identify.
- [ ] The critical path is visible after a run.

### Release discipline

- [ ] Immutable artifact versions are published when reuse matters.
- [ ] Channel promotion is used instead of rebuilds where appropriate.
- [ ] Release provenance is visible and auditable.
- [ ] Rollback can target a published artifact version.

### Continuous improvement

- [ ] `run_stats_7d` is reviewed before major optimization changes.
- [ ] Version history is used to evolve the pipeline safely.
- [ ] Changes are measured through recent run outcomes, not intuition alone.
