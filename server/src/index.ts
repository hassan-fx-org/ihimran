import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { z } from 'zod';
import { query } from './db/db';
import { runMigrations } from './db/migrations';
import { generateSessionToken, verifyPassword } from './lib/security';
import { startScheduler } from './services/scheduler';
import { testAllIntegrations } from './services/integrations';
import {
  ingestCompanyKnowledge,
  createIcp,
  discoverAndFilterLeads,
  performDeepResearchAndQualification,
  matchService,
  identifyDecisionMakers,
  generateOutreachDraft,
  saveOutreachDraft,
  sendOutreachMessage,
  processInboundResponse,
  generateFollowUpEmail,
  pauseFollowUp,
  resumeFollowUp,
  cancelFollowUp,
  movePipelineStage,
  setDoNotContact,
  runDemoWorkflow,
  PIPELINE_STAGES,
  NEGATIVE_STAGES
} from './services/agentEngine';
import {
  processPdfUpload,
  reprocessDocument,
  deleteDocument,
  askCompanyKnowledge
} from './services/knowledgePipeline';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------- Auth middleware ----------
interface AuthedRequest extends Request {
  userId?: string;
  workspaceId?: string;
  role?: string;
}

async function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing session token.' });
  }
  try {
    const result = await query(
      `SELECT s.token, s.expires_at, s.user_id, s.workspace_id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = $1`,
      [token]
    );
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: 'Unauthorized: invalid session.' });
    if (new Date(row.expires_at) < new Date()) {
      await query(`DELETE FROM sessions WHERE token = $1`, [token]);
      return res.status(401).json({ error: 'Unauthorized: session expired.' });
    }
    req.userId = row.user_id;
    req.workspaceId = row.workspace_id;
    req.role = row.role;
    next();
  } catch (e) {
    return res.status(500).json({ error: 'Auth middleware error.' });
  }
}

// ---------- Multer (PDF upload) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.') as any, false);
    }
  }
});

function handleError(res: Response, err: any, status = 500) {
  const msg = err?.message || 'Unexpected error.';
  const blocked = /^BLOCKED:/.test(msg);
  console.error('API Error:', msg);
  res.status(blocked ? 400 : status).json({ error: msg });
}

// ---------- 1. Health ----------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: process.env.DEMO_MODE === 'true' ? 'DEMO_MODE' : 'production',
    outbound: process.env.OUTBOUND_ENABLED !== 'false'
  });
});

// ---------- 2. Auth ----------
app.post('/api/auth/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(4) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password.' });

  const { email, password } = parsed.data;
  try {
    const userRes = await query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const memberRes = await query(
      `SELECT workspace_id, role FROM workspace_members WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [user.id]
    );
    const member = memberRes.rows[0];
    if (!member) return res.status(403).json({ error: 'No workspace assigned to this user.' });

    const token = generateSessionToken();
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await query(
      `INSERT INTO sessions (token, user_id, workspace_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [token, user.id, member.workspace_id, expires]
    );

    const wsRes = await query(`SELECT * FROM workspaces WHERE id = $1`, [member.workspace_id]);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      workspace: wsRes.rows[0]
    });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/auth/demo-login', async (_req, res) => {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@agenthack.ai';
    const userRes = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: 'Demo admin user not seeded.' });
    const memberRes = await query(`SELECT workspace_id, role FROM workspace_members WHERE user_id = $1 LIMIT 1`, [user.id]);
    const member = memberRes.rows[0];
    const token = generateSessionToken();
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await query(
      `INSERT INTO sessions (token, user_id, workspace_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [token, user.id, member.workspace_id, expires]
    );
    const wsRes = await query(`SELECT * FROM workspaces WHERE id = $1`, [member.workspace_id]);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      workspace: wsRes.rows[0]
    });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/auth/logout', authMiddleware, async (req: AuthedRequest, res) => {
  const token = (req.headers.authorization || '').slice(7);
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, async (req: AuthedRequest, res) => {
  const userRes = await query(`SELECT id, email, name, role FROM users WHERE id = $1`, [req.userId]);
  const wsRes = await query(`SELECT * FROM workspaces WHERE id = $1`, [req.workspaceId]);
  res.json({ user: userRes.rows[0], workspace: wsRes.rows[0] });
});

// ---------- 3. Agent Activity (persisted) ----------
app.get('/api/agent-logs', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(
      `SELECT id, agent_name AS agent, step, tool_used AS tool, input_data, output_data, decision, duration_ms AS duration, status, created_at AS timestamp
       FROM agent_activity_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.workspaceId]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/agent-runs', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(
      `SELECT a.*, l.name AS lead_name FROM agent_runs a LEFT JOIN leads l ON l.id = a.lead_id
       WHERE a.workspace_id = $1 ORDER BY a.created_at DESC LIMIT 60`,
      [req.workspaceId]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 4. Company Knowledge ----------
app.get('/api/company', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(
      `SELECT * FROM company_profiles WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.workspaceId]
    );
    const profile = result.rows[0] || null;
    let chunks = [];
    if (profile) {
      const c = await query(`SELECT COUNT(*)::int AS count FROM knowledge_chunks WHERE company_profile_id = $1`, [profile.id]);
      chunks = c.rows[0];
    }
    res.json({ ...profile, chunk_count: chunks.count || 0 });
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/company/documents', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(
      `SELECT * FROM company_documents WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [req.workspaceId]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/company/chunks', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const profileRes = await query(
      `SELECT * FROM company_profiles WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.workspaceId]
    );
    const profile = profileRes.rows[0];
    if (!profile) return res.json([]);
    const result = await query(
      `SELECT id, title, content, category, page, section, heading, chunk_index FROM knowledge_chunks WHERE company_profile_id = $1 ORDER BY chunk_index`,
      [profile.id]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/company/ingest', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(200),
    rawText: z.string().min(10).max(50000),
    sourceType: z.enum(['PDF', 'TEXT']).default('TEXT')
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Name and text content are required (min 10 chars).' });
  try {
    const profile = await ingestCompanyKnowledge(parsed.data.name, parsed.data.rawText, parsed.data.sourceType, req.workspaceId!);
    res.json({ success: true, profile });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/company/documents/upload', authMiddleware, (req: AuthedRequest, res: Response) => {
  upload.single('file')(req as any, res as any, async (err: any) => {
    if (err) {
      const msg = err?.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. The maximum upload size is 10 MB.'
        : err?.message || 'Upload failed.';
      return res.status(400).json({ error: msg });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'No PDF file provided.' });
      const filename = req.file.originalname || 'company-knowledge.pdf';
      const inserted = await query(
        `INSERT INTO company_documents (workspace_id, filename, mime_type, size_bytes, status, status_detail, version)
         VALUES ($1, $2, $3, $4, 'processing', 'queued', 1) RETURNING *`,
        [req.workspaceId, filename, req.file.mimetype || 'application/pdf', req.file.size]
      );
      const doc = inserted.rows[0];
      // Async processing job; progress is polled via the status endpoint.
      processPdfUpload({
        docId: doc.id,
        workspaceId: req.workspaceId!,
        buffer: req.file.buffer,
        filename,
        mimetype: req.file.mimetype || 'application/pdf',
        sizeBytes: req.file.size
      }).catch(() => {});
      res.json({ success: true, documentId: doc.id, status: 'processing' });
    } catch (e) {
      handleError(res, e, 500);
    }
  });
});

app.get('/api/company/documents/:id', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(`SELECT * FROM company_documents WHERE id = $1 AND workspace_id = $2`, [req.params.id, req.workspaceId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json(result.rows[0]);
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/company/documents/:id/status', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(`SELECT id, status, status_detail, error, page_count, chunk_count, version, created_at, updated_at FROM company_documents WHERE id = $1 AND workspace_id = $2`, [req.params.id, req.workspaceId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json(result.rows[0]);
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/company/documents/:id/reprocess', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const doc = await reprocessDocument({ docId: req.params.id, workspaceId: req.workspaceId! });
    res.json({ success: true, ...doc });
  } catch (e) {
    handleError(res, e, 400);
  }
});

app.delete('/api/company/documents/:id', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    await deleteDocument({ docId: req.params.id, workspaceId: req.workspaceId! });
    res.json({ success: true });
  } catch (e) {
    handleError(res, e, 400);
  }
});

app.get('/api/company/documents/:id/chunks', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const doc = await query(`SELECT id, company_profile_id FROM company_documents WHERE id = $1 AND workspace_id = $2`, [req.params.id, req.workspaceId]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const result = await query(
      `SELECT id, title, content, category, page, section, heading, chunk_index FROM knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/company/ask', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({
    question: z.string().min(2).max(500),
    history: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(20).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a question (2+ characters).' });
  try {
    const result = await askCompanyKnowledge(req.workspaceId!, parsed.data.question, 6, parsed.data.history || []);
    res.json(result);
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 5. ICP ----------
app.post('/api/icp', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({
    location: z.string().min(2).max(100).optional(),
    industry: z.string().min(2).max(100).optional(),
    companySize: z.string().min(2).max(100).optional(),
    targetProblem: z.string().min(5).max(500).optional(),
    exclusions: z.string().max(500).optional(),
    preferredService: z.string().max(200).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid ICP fields.' });
  try {
    const icp = await createIcp(parsed.data, req.workspaceId!);
    res.json(icp);
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/icps', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(
      `SELECT * FROM icps WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.workspaceId]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 6. Discovery ----------
app.post('/api/leads/discover', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ icpId: z.string().uuid().nullable().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid icpId.' });
  try {
    const result = await discoverAndFilterLeads(parsed.data.icpId || null, req.workspaceId!);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/leads', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(
      `SELECT * FROM leads WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [req.workspaceId]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/leads/:id', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const leadRes = await query(`SELECT * FROM leads WHERE id = $1 AND workspace_id = $2`, [id, req.workspaceId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const [evidences, contacts, messages, memories, followups, serviceMatches, events, meetings, activity] = await Promise.all([
      query(`SELECT * FROM research_evidences WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
      query(`SELECT * FROM contacts WHERE lead_id = $1 ORDER BY relevance DESC`, [id]),
      query(`SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at ASC`, [id]),
      query(`SELECT * FROM memories WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
      query(`SELECT * FROM follow_up_tasks WHERE lead_id = $1 ORDER BY scheduled_for ASC`, [id]),
      query(`SELECT * FROM service_matches WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
      query(`SELECT * FROM pipeline_events WHERE lead_id = $1 ORDER BY created_at ASC`, [id]),
      query(`SELECT * FROM meetings WHERE lead_id = $1 ORDER BY meeting_time ASC`, [id]),
      query(`SELECT id, agent_name, step, tool_used, input_data, output_data, decision, status, created_at FROM agent_activity_logs WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50`, [id])
    ]);

    const lead = leadRes.rows[0];
    const outbound = messages.rows.filter((m) => m.direction === 'outbound');
    const inbound = messages.rows.filter((m) => m.direction === 'inbound');
    const sentMsg = outbound.find((m) => m.status === 'sent');
    const draftMsg = outbound.find((m) => m.status === 'draft') || null;
    const primaryContact = contacts.rows.find((c) => c.email && c.email !== 'Not found') || contacts.rows[0];

    const evidenceMapped = evidences.rows.map((e) => ({
      id: e.id, content: e.snippet, source: e.source_type, relevance: e.relevance || 'demo', url: e.source_url || '', title: e.title
    }));

    const decisionMakersMapped = contacts.rows.map((c) => ({
      id: c.id, name: c.name, role: c.role, email: c.email || null,
      email_confidence_score: c.email && c.email !== 'Not found' ? 90 : 0,
      is_primary: c.id === primaryContact?.id,
      linkedin_url: null
    }));

    const serviceMatchesMapped = serviceMatches.rows.map((sm) => ({
      id: sm.id, service_name: sm.service, rationale: sm.why_fits || sm.problem, confidence_score: sm.confidence, required_actions: sm.problem || null
    }));

    const repliesMapped = inbound.map((m) => ({
      id: m.id, body: m.body, classification: m.classification || 'Unclassified', created_at: m.created_at,
      parsed_meeting: meetings.rows[0]?.meeting_time || null
    }));

    const pendingFu = followups.rows.filter((t) => t.status === 'pending');
    const followUp = pendingFu[0]
      ? {
          id: pendingFu[0].id,
          sequence_step: pendingFu[0].sequence_step,
          next_due_at: pendingFu[0].scheduled_for,
          days_until: Math.max(0, Math.ceil((new Date(pendingFu[0].scheduled_for).getTime() - Date.now()) / 86400000)),
          max_follow_ups: 3,
          paused: !!(pendingFu[0].pause_until && new Date(pendingFu[0].pause_until) > new Date())
        }
      : null;

    const meetingsMapped = meetings.rows.map((m) => ({ id: m.id, meeting_time: m.meeting_time, service_to_discuss: m.service_to_discuss, meeting_link: m.meeting_link, status: m.status }));

    res.json({
      ...lead,
      is_verified: !!primaryContact,
      evidence: evidenceMapped,
      evidence_count: evidenceMapped.length,
      decision_makers: decisionMakersMapped,
      service_matches: serviceMatchesMapped,
      pipeline_events: events.rows,
      inbound_responses: repliesMapped,
      outreach_draft: draftMsg ? {
        id: draftMsg.id, subject: draftMsg.subject, body: draftMsg.body,
        recipient: primaryContact?.email || 'Not available',
        grounded_in: (draftMsg.evidence_used && Array.isArray(draftMsg.evidence_used) && draftMsg.evidence_used.length) ? `grounded in ${draftMsg.evidence_used.length} evidence item(s)` : 'grounded in company knowledge'
      } : null,
      outreach_message: sentMsg
        ? { id: sentMsg.id, status: sentMsg.status, provider_status: sentMsg.provider_status, sent_at: sentMsg.sent_at || sentMsg.created_at, next_action: sentMsg.next_action }
        : null,
      follow_up: followUp,
      meetings: meetingsMapped,
      activity: activity.rows.map((a) => ({ id: a.id, event_type: a.event_type || a.step, created_at: a.created_at, notes: a.notes || a.decision || a.output_data || '', metadata: { message: a.decision || a.output_data || '' } })),
      memories: memories.rows,
      pql_score: lead.confidence_score,
      qualification_score: lead.confidence_score,
      icp_fit_score: null,
      size_score: null,
      location_score: null,
      deep_research: {
        pain_points: serviceMatches.rows[0]?.problem || lead.score_explanation || 'Operations & inquiry load increasing with growth',
        intent_signals: evidenceMapped.slice(0, 3).map((e) => e.content).join(' '),
        qualification_notes: lead.score_explanation || ''
      }
    });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/research', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const result = await performDeepResearchAndQualification(id, req.workspaceId!);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/service-match', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const result = await matchService(id, req.workspaceId!);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/decision-makers', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const contacts = await identifyDecisionMakers(id, req.workspaceId!);
    res.json({ success: true, contacts });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 7. Outreach ----------
app.post('/api/leads/:id/outreach', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ contactId: z.string().uuid().nullable().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid contactId.' });
  try {
    const { id } = req.params;
    const result = await generateOutreachDraft(id, parsed.data.contactId || null, req.workspaceId!);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/outreach/send', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ messageId: z.string().uuid().optional(), subject: z.string().max(500).optional(), body: z.string().max(20000).optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid messageId.' });
  try {
    const { id } = req.params;
    let messageId = parsed.data?.messageId;
    if (!messageId) {
      const draft = await query(
        `SELECT id FROM messages WHERE lead_id = $1 AND direction = 'outbound' AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
        [id]
      );
      if (draft.rows.length === 0) return res.status(400).json({ error: 'No outreach draft found. Generate outreach first.' });
      messageId = draft.rows[0].id;
    }
    const message = await sendOutreachMessage(id, messageId!, req.workspaceId!, { subject: parsed.data?.subject, body: parsed.data?.body });
    res.json({ success: true, message });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/outreach/draft', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ messageId: z.string().uuid(), subject: z.string().max(500).optional(), body: z.string().min(1).max(20000) });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'messageId and body are required.' });
  try {
    const { id } = req.params;
    const message = await saveOutreachDraft(id, parsed.data.messageId, parsed.data.subject || '', parsed.data.body, req.workspaceId!);
    res.json({ success: true, message });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 8. Response Classification ----------
app.post('/api/leads/:id/reply', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ replyText: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'replyText is required.' });
  try {
    const { id } = req.params;
    const result = await processInboundResponse(id, parsed.data.replyText, req.workspaceId!);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 9. Follow-Up ----------
app.post('/api/leads/:id/followup-trigger', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const message = await generateFollowUpEmail(id, req.workspaceId!);
    res.json({ success: true, message });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/followup/pause', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ days: z.number().int().min(1).max(90).default(14) });
  const parsed = schema.safeParse(req.body || {});
  try {
    const { id } = req.params;
    const rows = await pauseFollowUp(id, req.workspaceId!, parsed.data?.days ?? 14);
    res.json({ success: true, rows });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/followup/resume', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const rows = await resumeFollowUp(id, req.workspaceId!);
    res.json({ success: true, rows });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/leads/:id/followup/cancel', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ reason: z.string().min(1).max(500) });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'A cancellation reason is required.' });
  try {
    const { id } = req.params;
    const rows = await cancelFollowUp(id, req.workspaceId!, parsed.data.reason);
    res.json({ success: true, rows });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 10. Do Not Contact ----------
app.post('/api/leads/:id/dnc', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ value: z.boolean(), reason: z.string().max(500).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'value is required.' });
  try {
    const { id } = req.params;
    const lead = await setDoNotContact(id, parsed.data.value, req.workspaceId!, parsed.data.reason);
    res.json({ success: true, lead });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 11. Pipeline ----------
app.get('/api/pipeline', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const [leads, events] = await Promise.all([
      query(`SELECT * FROM leads WHERE workspace_id = $1 ORDER BY updated_at DESC`, [req.workspaceId]),
      query(`SELECT * FROM pipeline_events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200`, [req.workspaceId])
    ]);
    const stages = [...PIPELINE_STAGES, ...NEGATIVE_STAGES].map((name) => ({
      name,
      leads: leads.rows.filter((l) => l.stage === name)
    }));
    res.json({ stages, events: events.rows });
  } catch (e) {
    handleError(res, e);
  }
});

app.post('/api/pipeline/move', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({ leadId: z.string().uuid(), toStage: z.string().min(2).max(50), reason: z.string().max(500).optional(), confirmed: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'leadId and toStage are required.' });

  const agentProduced = ['Qualified', 'Contacted', 'Interested', 'Meeting Scheduled', 'Converted'];
  try {
    const { leadId, toStage, reason, confirmed } = parsed.data;
    const leadRes = await query(`SELECT stage FROM leads WHERE id = $1 AND workspace_id = $2`, [leadId, req.workspaceId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ error: 'Lead not found.' });
    const current = leadRes.rows[0].stage;

    if (toStage === 'Do Not Contact' && !confirmed) {
      return res.json({ ok: false, needsConfirmation: true, reason: 'Setting Do Not Contact permanently stops all automation for this lead. Confirm to proceed.' });
    }
    if (agentProduced.includes(toStage) && !confirmed) {
      return res.json({ ok: false, needsConfirmation: true, reason: `Stage "${toStage}" is normally produced by an agent workflow. Manual override will be recorded as a pipeline event. Confirm to proceed.` });
    }

    const lead = await movePipelineStage(leadId, toStage, reason || 'Manual pipeline override', req.workspaceId!);
    res.json({ ok: true, lead, fromStage: current });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 12. Meetings ----------
app.get('/api/meetings', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await query(
      `SELECT m.*, l.name as lead_name FROM meetings m LEFT JOIN leads l ON m.lead_id = l.id
       WHERE m.workspace_id = $1 ORDER BY m.created_at DESC`,
      [req.workspaceId]
    );
    res.json(result.rows);
  } catch (e) {
    handleError(res, e);
  }
});

app.get('/api/meetings/:id', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT m.*, l.name as lead_name FROM meetings m LEFT JOIN leads l ON m.lead_id = l.id
       WHERE m.id = $1 AND m.workspace_id = $2`,
      [id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
    res.json(result.rows[0]);
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 13. Settings ----------
app.get('/api/settings', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const wsRes = await query(`SELECT * FROM workspaces WHERE id = $1`, [req.workspaceId]);
    const members = await query(
      `SELECT wm.role, u.email, u.name FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE wm.workspace_id = $1`,
      [req.workspaceId]
    );
    const docs = await query(`SELECT * FROM company_documents WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 20`, [req.workspaceId]);
    res.json({
      workspace: wsRes.rows[0],
      members: members.rows,
      documents: docs.rows,
environment: {
        demoMode: process.env.DEMO_MODE === 'true',
        outboundEnabled: process.env.OUTBOUND_ENABLED !== 'false',
        emailSimulated: false,
        calendarSimulated: !process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || process.env.DEMO_MODE === 'true',
        whatsappSimulated: !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_WHATSAPP_FROM || process.env.DEMO_MODE === 'true',
        adminWhatsapp: process.env.ADMIN_WHATSAPP_TO || '',
        searchConfigured: Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY),
        llmConfigured: Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)
      }
    });
  } catch (e) {
    handleError(res, e);
  }
});

app.put('/api/settings', authMiddleware, async (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    outbound_enabled: z.boolean().optional(),
    followup_day_1: z.number().int().min(0).max(30).optional(),
    followup_day_2: z.number().int().min(0).max(60).optional(),
    meeting_default_hour: z.number().int().min(0).max(23).optional(),
    outboundEnabled: z.boolean().optional(),
    followupDay1: z.number().int().min(0).max(30).optional(),
    followupDay2: z.number().int().min(0).max(60).optional(),
    meetingDefaultHour: z.number().int().min(0).max(23).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid settings payload.' });
  try {
    const sets: string[] = [];
    const vals: any[] = [];
    const set = (col: string, v: any) => {
      if (v !== undefined) {
        sets.push(`${col} = $${vals.length + 1}`);
        vals.push(v);
      }
    };
    const d = parsed.data;
    set('name', d.name);
    set('outbound_enabled', d.outbound_enabled ?? d.outboundEnabled);
    set('followup_day_1', d.followup_day_1 ?? d.followupDay1);
    set('followup_day_2', d.followup_day_2 ?? d.followupDay2);
    set('meeting_default_hour', d.meeting_default_hour ?? d.meetingDefaultHour);
    if (sets.length === 0) return res.status(400).json({ error: 'No settings to update.' });
    const result = await query(
      `UPDATE workspaces SET ${sets.join(', ')} WHERE id = $${vals.length + 1} RETURNING *`,
      [...vals, req.workspaceId]
    );
    res.json({ success: true, workspace: result.rows[0] });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 14. Integrations ----------
app.get('/api/integrations/test', authMiddleware, async (_req: AuthedRequest, res) => {
  try {
    const report = await testAllIntegrations();
    res.json(report);
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 15. Dashboard ----------
app.get('/api/dashboard', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const ws = req.workspaceId;
    const [leads, meetings, events, runs, settings] = await Promise.all([
      query(`SELECT stage, confidence_score, name FROM leads WHERE workspace_id = $1`, [ws]),
      query(`SELECT COUNT(*)::int AS c FROM meetings WHERE workspace_id = $1`, [ws]),
      query(`SELECT COUNT(*)::int AS c FROM pipeline_events WHERE workspace_id = $1`, [ws]),
      query(`SELECT * FROM agent_runs WHERE workspace_id = $1 AND status = 'running' ORDER BY created_at DESC`, [ws]),
      query(`SELECT * FROM workspaces WHERE id = $1`, [ws])
    ]);

    const allLeads = leads.rows;
    const count = (s: string) => allLeads.filter((l) => l.stage === s).length;
    const upcomingMeetings = (await query(
      `SELECT m.*, l.name AS lead_name FROM meetings m LEFT JOIN leads l ON l.id = m.lead_id
       WHERE m.workspace_id = $1 AND m.status = 'scheduled' AND m.meeting_time >= NOW() ORDER BY m.meeting_time ASC LIMIT 5`,
      [ws]
    )).rows;
    const recentResponses = (await query(
      `SELECT * FROM messages WHERE workspace_id = $1 AND direction = 'inbound' ORDER BY created_at DESC LIMIT 5`,
      [ws]
    )).rows;
    const topQualified = allLeads.filter((l) => l.stage === 'Qualified').sort((a, b) => b.confidence_score - a.confidence_score).slice(0, 5);
    const recentEvents = (await query(
      `SELECT * FROM pipeline_events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 8`,
      [ws]
    )).rows;

    res.json({
      kpis: {
        discovered: count('Discovered') + count('Potential'),
        qualified: count('Qualified'),
        contacted: count('Contacted'),
        interested: count('Interested'),
        meetings: meetings.rows[0].c,
        converted: count('Converted'),
        totalLeads: allLeads.length,
        dnc: count('Do Not Contact')
      },
      stages: Object.fromEntries([...new Set(allLeads.map((l) => l.stage))].map((s) => [s, count(s)])),
      upcomingMeetings,
      recentResponses,
      topQualified,
      recentEvents,
      activeRuns: runs.rows,
      systemHealth: {
        outboundEnabled: settings.rows[0]?.outbound_enabled,
        demoMode: process.env.DEMO_MODE === 'true',
        failedJobs: 0,
        workspace: settings.rows[0]?.name
      }
    });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- 15. Demo Workflow ----------
app.post('/api/demo/run', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const result = await runDemoWorkflow(req.workspaceId!);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, e);
  }
});

// ---------- Boot ----------
function findPortOwner(): string {
  try {
    const { execSync } = require('child_process');
    const out = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf8' });
    const line = out.trim().split(/\r?\n/)[0];
    const pid = line?.trim().split(/\s+/).pop();
    return pid ? ` owning PID ${pid}` : '';
  } catch {
    return '';
  }
}

async function bootstrap() {
  try {
    await runMigrations();
    startScheduler();
    const server = app.listen(PORT, () => {
      console.log(`🚀 Autonomous Sales Server online at http://localhost:${PORT} (demo=${process.env.DEMO_MODE === 'true'})`);
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n⚠️  Port ${PORT} is already in use${findPortOwner()}.`);
        console.error('   Another AgentHack server instance is already running.');
        console.error('   - Stop the existing process first, then retry, or');
        console.error(`   - Run this instance on another port: PORT=${Number(PORT) + 1} npm start`);
        process.exit(0);
      }
      console.error('Server error:', err);
      process.exit(1);
    });
  } catch (e) {
    console.error('Boot failed:', e);
    process.exit(1);
  }
}

bootstrap();

