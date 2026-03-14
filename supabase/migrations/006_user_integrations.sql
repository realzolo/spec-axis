-- Migration: User Integrations System
-- Adds support for user-configurable VCS and AI integrations

-- ============================================================
-- 1. Enable Supabase Vault (if not already enabled)
-- ============================================================
-- Note: Vault must be enabled in Supabase dashboard first
-- This migration assumes vault is available

-- ============================================================
-- 2. Create user_integrations table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Integration type: vcs (version control) | ai (AI model)
  type TEXT NOT NULL CHECK (type IN ('vcs', 'ai')),

  -- Provider: github | gitlab | git | openai-compatible
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'git', 'openai-compatible')),

  -- User-defined name (e.g., "Company GitHub", "Personal GitLab")
  name TEXT NOT NULL,

  -- Is this the default integration for this type?
  is_default BOOLEAN DEFAULT false,

  -- Non-sensitive configuration (JSON)
  -- VCS: {baseUrl?, org?}
  -- AI: {baseUrl?, model, maxTokens?, temperature?}
  config JSONB NOT NULL DEFAULT '{}',

  -- Reference to Vault secret (stores sensitive data like tokens/API keys)
  vault_secret_name TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, type, name)
);

-- Indexes
CREATE INDEX idx_user_integrations_user_type ON user_integrations(user_id, type);
CREATE INDEX idx_user_integrations_default ON user_integrations(user_id, type, is_default) WHERE is_default = true;

-- ============================================================
-- 3. Add multi-tenant support to existing tables
-- ============================================================

-- Add user_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add integration references to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vcs_integration_id UUID REFERENCES user_integrations(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_integration_id UUID REFERENCES user_integrations(id) ON DELETE SET NULL;

-- Add user_id to reports (for multi-tenant isolation)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to rule_sets (allow users to create custom rule sets)
ALTER TABLE rule_sets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_sets_user_id ON rule_sets(user_id);

-- ============================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on user_integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own integrations
CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own integrations
CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON user_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Update RLS policies for projects (add user_id filter)
DROP POLICY IF EXISTS "Enable read access for all users" ON projects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON projects;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON projects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON projects;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Update RLS policies for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON reports FOR DELETE
  USING (auth.uid() = user_id);

-- Update RLS policies for rule_sets (allow viewing global + own)
ALTER TABLE rule_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view global and own rule sets"
  ON rule_sets FOR SELECT
  USING (is_global = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own rule sets"
  ON rule_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_global = false);

CREATE POLICY "Users can update own rule sets"
  ON rule_sets FOR UPDATE
  USING (auth.uid() = user_id AND is_global = false);

CREATE POLICY "Users can delete own rule sets"
  ON rule_sets FOR DELETE
  USING (auth.uid() = user_id AND is_global = false);

-- ============================================================
-- 5. Helper Functions
-- ============================================================

-- Function to ensure only one default integration per user per type
CREATE OR REPLACE FUNCTION ensure_single_default_integration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other defaults for this user and type
    UPDATE user_integrations
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND type = NEW.type
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_integration
  AFTER INSERT OR UPDATE ON user_integrations
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_integration();

-- Function to auto-populate user_id in reports from project
CREATE OR REPLACE FUNCTION auto_populate_report_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_populate_report_user_id
  BEFORE INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_report_user_id();

-- ============================================================
-- 6. Migration: Set user_id for existing data
-- ============================================================
-- Note: This assumes single-user system. For production, you need to
-- properly assign existing data to the correct users.

DO $$
DECLARE
  v_first_user_id UUID;
BEGIN
  -- Get the first user (or create a system user)
  SELECT id INTO v_first_user_id
  FROM auth.users
  LIMIT 1;

  IF v_first_user_id IS NOT NULL THEN
    -- Assign existing projects to first user
    UPDATE projects
    SET user_id = v_first_user_id
    WHERE user_id IS NULL;

    -- Assign existing reports to first user
    UPDATE reports
    SET user_id = v_first_user_id
    WHERE user_id IS NULL;

    -- Assign existing custom rule sets to first user
    UPDATE rule_sets
    SET user_id = v_first_user_id
    WHERE user_id IS NULL AND is_global = false;
  END IF;
END $$;

-- ============================================================
-- 7. Make user_id NOT NULL after migration
-- ============================================================
-- Uncomment after verifying data migration
-- ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE reports ALTER COLUMN user_id SET NOT NULL;
