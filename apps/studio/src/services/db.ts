import { exec, query, queryOne } from '@/lib/db';

// ── Projects ──────────────────────────────────────────────
export async function getProjects(orgId: string) {
  if (!orgId) {
    throw new Error('orgId is required');
  }
  return query(
    `select *
     from code_projects
     where org_id = $1
     order by created_at desc`,
    [orgId]
  );
}

export async function getProjectById(id: string) {
  const row = await queryOne(
    `select *
     from code_projects
     where id = $1`,
    [id]
  );
  if (!row) throw new Error('Project not found');
  return row;
}

export async function getProjectByRepo(repo: string, orgId: string) {
  const row = await queryOne(
    `select *
     from code_projects
     where repo = $1 and org_id = $2`,
    [repo, orgId]
  );
  if (!row) throw new Error('Project not found');
  return row;
}

export async function listProjectsByRepo(repo: string) {
  return query(
    `select *
     from code_projects
     where repo = $1`,
    [repo]
  );
}

export async function createProject(payload: {
  name: string;
  repo: string;
  description?: string;
  default_branch?: string;
  ruleset_id?: string;
  user_id: string;
  org_id: string;
  vcs_integration_id: string;
  ai_integration_id: string;
}) {
  const row = await queryOne(
    `insert into code_projects
      (name, repo, description, default_branch, ruleset_id, user_id, org_id, vcs_integration_id, ai_integration_id, created_at, updated_at)
     values ($1,$2,$3,coalesce($4,'main'),$5,$6,$7,$8,$9,now(),now())
     returning *`,
    [
      payload.name,
      payload.repo,
      payload.description ?? null,
      payload.default_branch ?? 'main',
      payload.ruleset_id ?? null,
      payload.user_id,
      payload.org_id,
      payload.vcs_integration_id,
      payload.ai_integration_id,
    ]
  );
  if (!row) throw new Error('Failed to create project');
  return row;
}

export async function updateProject(
  id: string,
  payload: {
    name?: string;
    description?: string;
    ruleset_id?: string | null;
  }
) {
  const row = await queryOne(
    `update code_projects
     set name = coalesce($2, name),
         description = coalesce($3, description),
         ruleset_id = $4,
         updated_at = now()
     where id = $1
     returning *`,
    [id, payload.name ?? null, payload.description ?? null, payload.ruleset_id ?? null]
  );
  if (!row) throw new Error('Project not found');
  return row;
}

export async function deleteProject(id: string) {
  await exec(`delete from code_projects where id = $1`, [id]);
}

// ── Rule Sets ─────────────────────────────────────────────
export async function getRuleSets(orgId: string) {
  if (!orgId) {
    throw new Error('orgId is required');
  }

  return query(
    `select rs.*,
            coalesce(jsonb_agg(r.*) filter (where r.id is not null), '[]'::jsonb) as rules
     from quality_rule_sets rs
     left join quality_rules r on r.ruleset_id = rs.id
     where rs.is_global = true or rs.org_id = $1
     group by rs.id
     order by rs.created_at desc`,
    [orgId]
  );
}

export async function getRuleSetById(id: string) {
  const row = await queryOne(
    `select rs.*,
            coalesce(jsonb_agg(r.*) filter (where r.id is not null), '[]'::jsonb) as rules
     from quality_rule_sets rs
     left join quality_rules r on r.ruleset_id = rs.id
     where rs.id = $1
     group by rs.id`,
    [id]
  );
  if (!row) throw new Error('Rule set not found');
  return row;
}

export async function createRuleSet(payload: { name: string; description?: string; org_id: string }) {
  const row = await queryOne(
    `insert into quality_rule_sets (name, description, org_id, is_global, created_at, updated_at)
     values ($1,$2,$3,false,now(),now())
     returning *`,
    [payload.name, payload.description ?? null, payload.org_id]
  );
  if (!row) throw new Error('Failed to create rule set');
  return row;
}

export async function getRulesBySetId(rulesetId: string) {
  return query(
    `select *
     from quality_rules
     where ruleset_id = $1 and is_enabled = true
     order by sort_order`,
    [rulesetId]
  );
}

export async function upsertRule(payload: {
  id?: string;
  ruleset_id: string;
  category: string;
  name: string;
  prompt: string;
  weight?: number;
  severity?: string;
  is_enabled?: boolean;
  sort_order?: number;
}) {
  if (payload.id) {
    const row = await queryOne(
      `update quality_rules
       set category = $2,
           name = $3,
           prompt = $4,
           weight = coalesce($5, weight),
           severity = coalesce($6, severity),
           is_enabled = coalesce($7, is_enabled),
           sort_order = coalesce($8, sort_order),
           updated_at = now()
       where id = $1
       returning *`,
      [
        payload.id,
        payload.category,
        payload.name,
        payload.prompt,
        payload.weight ?? null,
        payload.severity ?? null,
        payload.is_enabled ?? null,
        payload.sort_order ?? null,
      ]
    );
    if (!row) throw new Error('Rule not found');
    return row;
  }

  const row = await queryOne(
    `insert into quality_rules
      (ruleset_id, category, name, prompt, weight, severity, is_enabled, sort_order, created_at, updated_at)
     values ($1,$2,$3,$4,coalesce($5,20),coalesce($6,'warning'),coalesce($7,true),coalesce($8,0),now(),now())
     returning *`,
    [
      payload.ruleset_id,
      payload.category,
      payload.name,
      payload.prompt,
      payload.weight ?? null,
      payload.severity ?? null,
      payload.is_enabled ?? null,
      payload.sort_order ?? null,
    ]
  );
  if (!row) throw new Error('Failed to create rule');
  return row;
}

export async function deleteRule(id: string) {
  await exec(`delete from quality_rules where id = $1`, [id]);
}

// ── Reports ───────────────────────────────────────────────
export async function createReport(payload: {
  project_id: string;
  org_id: string;
  ruleset_snapshot: object[];
  commits: object[];
  analysis_snapshot?: Record<string, unknown>;
}) {
  const row = await queryOne(
    `insert into analysis_reports
      (project_id, org_id, ruleset_snapshot, commits, analysis_snapshot, status, created_at, updated_at)
     values ($1,$2,$3,$4,$5,'pending',now(),now())
     returning *`,
    [
      payload.project_id,
      payload.org_id,
      JSON.stringify(payload.ruleset_snapshot),
      JSON.stringify(payload.commits),
      JSON.stringify(payload.analysis_snapshot ?? {}),
    ]
  );
  if (!row) throw new Error('Failed to create report');
  return row;
}

export async function updateReport(id: string, payload: Record<string, unknown>) {
  const fields = Object.keys(payload);
  if (fields.length === 0) return;

  const assignments = fields.map((key, idx) => `${key} = $${idx + 2}`);
  const values = fields.map((key) => {
    const value = (payload as Record<string, unknown>)[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return JSON.stringify(value);
    }
    return value;
  });

  await exec(
    `update analysis_reports
     set ${assignments.join(', ')}, updated_at = now()
     where id = $1`,
    [id, ...values]
  );
}

export async function deleteReport(id: string) {
  await exec(`delete from analysis_reports where id = $1`, [id]);
}

export async function getReports(orgId: string, projectId?: string) {
  if (!orgId) {
    throw new Error('orgId is required');
  }
  if (projectId) {
    return query(
      `select r.id, r.status, r.score, r.category_scores, r.commits, r.created_at,
              p.name, p.repo
       from analysis_reports r
       join code_projects p on p.id = r.project_id
       where r.org_id = $1
         and r.project_id = $2
       order by r.created_at desc
       limit 50`,
      [orgId, projectId]
    );
  }
  return query(
    `select r.id, r.status, r.score, r.category_scores, r.commits, r.created_at,
            p.name, p.repo
     from analysis_reports r
     join code_projects p on p.id = r.project_id
     where r.org_id = $1
     order by r.created_at desc
     limit 50`,
    [orgId]
  );
}

export async function getReportById(id: string) {
  const row = await queryOne(
    `select r.*, p.name, p.repo
     from analysis_reports r
     join code_projects p on p.id = r.project_id
     where r.id = $1`,
    [id]
  );
  if (!row) throw new Error('Report not found');
  return row;
}
