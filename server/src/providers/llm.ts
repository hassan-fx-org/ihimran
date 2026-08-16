import dotenv from 'dotenv';

dotenv.config();

const groqApiKey = process.env.GROQ_API_KEY || '';
const groqPrimaryModel = process.env.GROQ_PRIMARY_MODEL || 'llama-3.3-70b-versatile';
const groqMiniModel = process.env.GROQ_MINI_MODEL || 'llama-3.1-8b-instant';
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Shared per-tier handling: abort timeout, status logging, throttling backoff. */
async function tierFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<{ ok: boolean; data: any; status: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.status === 429) {
      console.warn(`⚠️ ${label} rate-limited (429), backing off`);
      await sleep(700);
      return { ok: false, data: null, status: 429 };
    }
    if (!res.ok) {
      console.warn(`⚠️ ${label} HTTP ${res.status}`);
      return { ok: false, data: null, status: res.status };
    }
    const data: any = await res.json();
    return { ok: true, data, status: 200 };
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn(`⚠️ ${label} failed:`, (e as Error).message);
    return { ok: false, data: null, status: 0 };
  }
}

function cleanJson(content: string): string {
  return content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function safeParse(content: string): any {
  try {
    return JSON.parse(cleanJson(content));
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleanJson(content.slice(start, end + 1)));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Multi-tier resilient LLM engine (Groq 70B -> Groq 8B -> Gemini).
 * Returns parsed JSON when returnJson is true, else raw text. Returns null when all tiers fail.
 */
export async function executeLLM(
  systemPrompt: string,
  userPrompt: string,
  returnJson: boolean = true
): Promise<any> {
  // Tier 1: Groq Llama 3.3 70B
  if (groqApiKey) {
    const r = await tierFetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: groqPrimaryModel,
          messages: [
            {
              role: 'system',
              content: `${systemPrompt}\n${returnJson ? 'Respond ONLY in raw valid JSON object without markdown fences.' : ''}`
            },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          response_format: returnJson ? { type: 'json_object' } : undefined
        })
      },
      9000,
      'Groq Primary'
    );
    if (r.ok) {
      const content: string = r.data?.choices?.[0]?.message?.content?.trim() || '';
      if (content) return returnJson ? safeParse(content) : content;
    }
  }

  // Tier 2: Groq Llama 3.1 8B
  if (groqApiKey) {
    const r = await tierFetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: groqMiniModel,
          messages: [
            {
              role: 'system',
              content: `${systemPrompt}\n${returnJson ? 'Return valid JSON only.' : ''}`
            },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          response_format: returnJson ? { type: 'json_object' } : undefined
        })
      },
      8000,
      'Groq Mini'
    );
    if (r.ok) {
      const content: string = r.data?.choices?.[0]?.message?.content?.trim() || '';
      if (content) return returnJson ? safeParse(content) : content;
    }
  }

  // Tier 3: Gemini
  if (geminiApiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
    const r = await tierFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }]
        })
      },
      10000,
      'Gemini'
    );
    if (r.ok) {
      const content: string = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (content) return returnJson ? safeParse(content) : content;
    }
  }

  return null;
}

export const llm = {
  execute: executeLLM,
  hasProvider: Boolean(groqApiKey || geminiApiKey)
};