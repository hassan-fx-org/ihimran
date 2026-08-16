import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const schemaSQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Company Profiles (RAG Knowledge)
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tagline TEXT,
    summary TEXT NOT NULL,
    offerings JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_industries JSONB NOT NULL DEFAULT '[]'::jsonb,
    case_studies JSONB DEFAULT '[]'::jsonb,
    pricing JSONB DEFAULT '[]'::jsonb,
    tech_stack JSONB DEFAULT '[]'::jsonb,
    limitations JSONB DEFAULT '[]'::jsonb,
    source_type TEXT NOT NULL,
    source_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Knowledge Chunks (RAG Layer)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ICP Table
CREATE TABLE IF NOT EXISTS icps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location TEXT NOT NULL,
    industry TEXT NOT NULL,
    company_size TEXT NOT NULL,
    target_problem TEXT NOT NULL,
    exclusions TEXT,
    normalized_prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    icp_id UUID REFERENCES icps(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    website TEXT,
    industry TEXT,
    location TEXT,
    size TEXT,
    stage TEXT DEFAULT 'Discovered' NOT NULL,
    confidence_score INT DEFAULT 0,
    score_explanation TEXT,
    recommended_service TEXT,
    service_rationale TEXT,
    do_not_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Research Evidence
CREATE TABLE IF NOT EXISTS research_evidences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_url TEXT,
    title TEXT NOT NULL,
    snippet TEXT NOT NULL,
    confidence TEXT DEFAULT 'High',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Contacts / Decision Makers
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    relevance TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    confidence TEXT DEFAULT 'High',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Messages & Outreach
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    direction TEXT NOT NULL,
    channel TEXT DEFAULT 'email',
    subject TEXT,
    body TEXT NOT NULL,
    classification TEXT,
    next_action TEXT,
    evidence_used JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Follow Up Tasks
CREATE TABLE IF NOT EXISTS follow_up_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sequence_step INT DEFAULT 1,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending',
    template_prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Meetings & Briefings
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    meeting_time TIMESTAMP WITH TIME ZONE NOT NULL,
    meeting_link TEXT NOT NULL,
    service_to_discuss TEXT NOT NULL,
    problem_summary TEXT NOT NULL,
    objections_expected TEXT,
    key_discussion_points TEXT NOT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    whatsapp_notified BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Memory (Short & Long Term)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Agent Activity Logs
CREATE TABLE IF NOT EXISTS agent_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL,
    step TEXT NOT NULL,
    tool_used TEXT,
    input_data TEXT,
    output_data TEXT,
    decision TEXT,
    duration_ms INT DEFAULT 0,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
`;

async function init() {
  console.log('🔄 Initializing Database Tables on Supabase...');
  try {
    const client = await pool.connect();
    await client.query(schemaSQL);
    client.release();
    console.log('✅ ALL SUPABASE TABLES CREATED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to initialize tables:', err);
    process.exit(1);
  }
}

init();