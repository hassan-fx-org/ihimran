import dotenv from 'dotenv';
import { query } from '../db/db';
import { executeLLM } from '../providers/llm';
import { webSearch } from '../providers/search';

dotenv.config();

export interface IntegrationStatus {
  connected: boolean;
  detail: string;
  simulated?: boolean;
}

export interface IntegrationsReport {
  database: IntegrationStatus;
  vector: IntegrationStatus;
  email: IntegrationStatus;
  calendar: IntegrationStatus;
  whatsapp: IntegrationStatus;
  search: IntegrationStatus;
  llm: IntegrationStatus;
  demoMode: boolean;
  outboundEnabled: boolean;
  testedAt: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Live connection test for every integration. Each check performs a real,
 * low-side-effect call against the provider when credentials are configured
 * (list events, verify API key, tiny model call) so "Test connection" is a
 * genuine check — never a fabricated success.
 */
export async function testAllIntegrations(): Promise<IntegrationsReport> {
  const demoMode = process.env.DEMO_MODE === 'true';
  const outboundEnabled = process.env.OUTBOUND_ENABLED !== 'false';

  // Database
  let database: IntegrationStatus = { connected: false, detail: 'Not reachable' };
  try {
    const res = await query('SELECT 1 AS ok');
    database = {
      connected: Number(res.rows[0]?.ok) === 1,
      detail: Number(res.rows[0]?.ok) === 1 ? 'Database connected' : 'Unexpected database response'
    };
  } catch (e) {
    database = { connected: false, detail: (e as Error).message };
  }

  // Vector / RAG index
  let vector: IntegrationStatus = { connected: false, detail: 'No index' };
  try {
    const res = await query('SELECT COUNT(*)::int AS c FROM knowledge_chunks');
    const count = Number(res.rows[0]?.c) || 0;
    vector = { connected: count > 0, detail: count > 0 ? `${count} indexed chunks` : 'No chunks indexed yet — upload company documents first' };
  } catch (e) {
    vector = { connected: false, detail: (e as Error).message };
  }

  // Email (Resend) — verify key by listing emails; no send side-effect.
  let email: IntegrationStatus = { connected: false, detail: 'Not connected — set RESEND_API_KEY in server/.env' };
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && !demoMode) {
    try {
      const res = await fetchWithTimeout('https://api.resend.com/emails', {
        method: 'GET',
        headers: { Authorization: `Bearer ${resendKey}` }
      });
      email = res.ok
        ? { connected: true, detail: 'Resend connected — real email delivery ready' }
        : { connected: false, detail: `Resend key rejected (HTTP ${res.status})` };
    } catch (e) {
      email = { connected: false, detail: `Resend unreachable: ${(e as Error).message}` };
    }
  }

  // Calendar (Google) — list events to verify credentials, no event created.
  let calendar: IntegrationStatus = { connected: false, detail: 'Not connected — set GOOGLE_CALENDAR_CLIENT_EMAIL + GOOGLE_CALENDAR_PRIVATE_KEY in server/.env' };
  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
  if (clientEmail && privateKey && !demoMode) {
    try {
      const { google } = await import('googleapis');
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      const cal = google.calendar({ version: 'v3', auth });
      const res = await cal.events.list({ calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary', maxResults: 1, timeMin: new Date().toISOString() });
      calendar = {
        connected: true,
        detail: `Google Calendar connected (${res.data.items?.length || 0} upcoming events)`
      };
    } catch (e) {
      calendar = { connected: false, detail: `Google Calendar error: ${(e as Error).message}` };
    }
  }

  // WhatsApp (Twilio) — fetch account to verify credentials; no message sent.
  let whatsapp: IntegrationStatus = { connected: false, detail: 'Not connected — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM in server/.env' };
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  if (twilioSid && twilioToken && process.env.TWILIO_WHATSAPP_FROM && !demoMode) {
    try {
      const res = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
        method: 'GET',
        headers: { Authorization: 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64') }
      });
      whatsapp = res.ok
        ? { connected: true, detail: 'Twilio connected — admin WhatsApp delivery ready' }
        : { connected: false, detail: `Twilio key rejected (HTTP ${res.status})` };
    } catch (e) {
      whatsapp = { connected: false, detail: `Twilio unreachable: ${(e as Error).message}` };
    }
  }

  // Web research
  let search: IntegrationStatus = { connected: false, detail: 'Not connected — set TAVILY_API_KEY or SERPER_API_KEY in server/.env' };
  if (process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY) {
    try {
      const results = await webSearch('AgentHack autonomous AI sales agent', 2);
      search = results && results.length > 0
        ? { connected: true, detail: `Web research connected (${results.length} results)` }
        : { connected: false, detail: 'Research provider responded but returned no results' };
    } catch (e) {
      search = { connected: false, detail: `Web research error: ${(e as Error).message}` };
    }
  }

  // LLM
  let llm: IntegrationStatus = { connected: false, detail: 'Not connected — set GROQ_API_KEY or GEMINI_API_KEY in server/.env' };
  if (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      const text = await executeLLM('Reply with exactly the single word: OK', 'Connectivity test', false);
      llm = text && text.trim().length > 0
        ? { connected: true, detail: 'AI models responsive' }
        : { connected: false, detail: 'Model provider responded but returned empty output' };
    } catch (e) {
      llm = { connected: false, detail: `Model error: ${(e as Error).message}` };
    }
  }

  return {
    database,
    vector,
    email,
    calendar,
    whatsapp,
    search,
    llm,
    demoMode,
    outboundEnabled,
    testedAt: new Date().toISOString()
  };
}