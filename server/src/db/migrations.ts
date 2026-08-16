import { pool } from './db';
import { hashPassword } from '../lib/security';

const SQL = `
-- 1. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  outbound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  followup_day_1 INT NOT NULL DEFAULT 0,
  followup_day_2 INT NOT NULL DEFAULT 3,
  meeting_default_hour INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Workspace members
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Company documents (upload tracking + versioning)
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_profile_id UUID,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  chunk_count INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Pipeline events
CREATE TABLE IF NOT EXISTS pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT,
  confidence INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Agent runs (durable workflow state)
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID,
  workflow TEXT NOT NULL,
  current_state TEXT NOT NULL,
  input_snapshot JSONB DEFAULT '{}'::jsonb,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  decision TEXT,
  confidence INT DEFAULT 0,
  next_action TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Service matches
CREATE TABLE IF NOT EXISTS service_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  service TEXT NOT NULL,
  problem TEXT NOT NULL,
  why_fits TEXT NOT NULL,
  company_evidence JSONB DEFAULT '[]'::jsonb,
  capability_evidence JSONB DEFAULT '[]'::jsonb,
  confidence INT NOT NULL DEFAULT 0,
  alternatives JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'recommended',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. New columns on existing tables (idempotent)
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE icps ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE messages ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS contact_role TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS lead_score INT DEFAULT 0;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS customer_problem TEXT;
ALTER TABLE follow_up_tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE follow_up_tasks ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE follow_up_tasks ADD COLUMN IF NOT EXISTS pause_until TIMESTAMPTZ;
ALTER TABLE research_evidences ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE research_evidences ADD COLUMN IF NOT EXISTS relevance TEXT;
ALTER TABLE research_evidences ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ;
ALTER TABLE agent_activity_logs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE agent_activity_logs ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS page INT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS heading TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_index INT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES company_documents(id) ON DELETE CASCADE;
ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS page_count INT DEFAULT 0;
ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS status_detail TEXT;
ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS page_text JSONB;

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_icps_workspace ON icps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_workspace ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_evidence_lead ON research_evidences(lead_id);
CREATE INDEX IF NOT EXISTS idx_followup_lead ON follow_up_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_lead ON pipeline_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_agentruns_workspace ON agent_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON agent_activity_logs(workspace_id);
`;

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    // Seed default workspace
    let ws = await client.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`);
    let workspaceId = ws.rows[0]?.id;
    if (!workspaceId) {
      const ins = await client.query(
        `INSERT INTO workspaces (name) VALUES ($1) RETURNING id`,
        ['Enterprise Production OS']
      );
      workspaceId = ins.rows[0].id;
    }

    // Backfill existing rows into the default workspace
    const tables = ['company_profiles', 'icps', 'leads', 'messages', 'meetings', 'follow_up_tasks', 'research_evidences'];
    for (const t of tables) {
      await client.query(`UPDATE ${t} SET workspace_id = $1 WHERE workspace_id IS NULL`, [workspaceId]);
    }

    // Seed admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@agenthack.ai';
    let user = await client.query(`SELECT id FROM users WHERE email = $1`, [adminEmail]);
    if (user.rows.length === 0) {
      const password = process.env.ADMIN_PASSWORD || 'agenthack2026';
      const hash = await hashPassword(password);
      const ins = await client.query(
        `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id`,
        [adminEmail, 'AgentHack Admin', hash]
      );
      user = ins;
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
        [workspaceId, user.rows[0].id]
      );
    }

    console.log('✅ Database migrations applied.');
    return { workspaceId };
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}