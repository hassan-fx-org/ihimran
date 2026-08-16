import pdfParse from 'pdf-parse';
import { query } from '../db/db';
import { executeLLM, llm } from '../providers/llm';
import { embedText, retrieveChunksIn, detectTopic, TOPIC_META, normalizeText } from '../providers/vector';
import { logActivity } from '../lib/activity';
import { extractCompanyStructured } from './agentEngine';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const RAG_CANDIDATES = 16;
const RAG_LLM_CHUNKS = 8;
const RAG_MIN_SOURCES = 3;

/** Strips synthetic-dossier boilerplate so fallback answers and source previews
 * stay clean (these are index-time disclaimers/headers, not company facts). */
function stripBoilerplate(content: string): string {
  return (content || '')
    .replace(/Synthetic company data prepared for the AgentHack challenge\.?\s*/gi, '')
    .replace(/All entities and figures are fictional\.?\s*/gi, '')
    .replace(/^\s*[\w&.,!?()'/ -]+?\s*\|\s*[\w&.,!?()'/ -]*?Page\s?\d+\s*/gi, '')
    .trim();
}

export type DocStatus = 'processing' | 'indexed' | 'failed';

interface ChunkInput {
  title: string;
  content: string;
  category: string;
  page: number | null;
  section: string | null;
  heading: string | null;
}

// ---------- validation ----------

export function validatePdfFile(buffer: Buffer, originalname: string, mimetype: string, sizeBytes: number) {
  if (!originalname || !originalname.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files are supported. Please upload a .pdf file.');
  }
  if (mimetype && mimetype !== 'application/pdf' && !mimetype.includes('pdf')) {
    throw new Error(`"${mimetype}" is not a PDF file. Only PDF documents are supported.`);
  }
  if (!buffer || buffer.length === 0) {
    throw new Error('The uploaded file is empty.');
  }
  if (sizeBytes > MAX_PDF_BYTES) {
    throw new Error(`This file is ${Math.round(sizeBytes / 1024 / 1024)} MB. The maximum upload size is 10 MB.`);
  }
  const header = buffer.slice(0, 5).toString('latin1');
  if (!header.startsWith('%PDF')) {
    throw new Error('This file is corrupted or is not a valid PDF document.');
  }
}

// ---------- extraction (page-aware) ----------

export async function extractPdfPages(buffer: Buffer): Promise<{ pages: string[]; numPages: number }> {
  const pages: string[] = [];
  const options: any = {
    max: 0,
    pagerender: (pageData: any) =>
      pageData
        .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        .then((textContent: any) => {
          let text = '';
          let lastY: number | undefined;
          for (const item of textContent.items || []) {
            if (lastY === undefined || lastY === item.transform[5]) text += item.str;
            else text += '\n' + item.str;
            lastY = item.transform[5];
          }
          pages.push(text || '');
          return text;
        })
  };
  const result = await pdfParse(buffer, options);
  return { pages, numPages: result.numpages || pages.length };
}

// ---------- chunking ----------

function cleanPageText(pages: string[]): string[] {
  return pages.map((p) => p.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
}

function buildContentChunks(pages: string[]): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const MAX = 1200;
  pages.forEach((pageText, idx) => {
    const pageNo = idx + 1;
    const blocks = pageText
      .split(/\n\s*\n/)
      .map((b) => b.replace(/\s+/g, ' ').trim())
      .filter((b) => b.length > 0);
    let currentSection: string | null = null;
    let buffer = '';
    const flush = () => {
      if (buffer.length > 0) {
        // Keep the section heading attached to its content so a section header
        // (e.g. "Pricing & Packages" or a Q&A heading) is never separated from
        // the facts it introduces — this is critical for grounded retrieval.
        const content = currentSection && !buffer.startsWith(currentSection) ? `${currentSection} ${buffer}` : buffer;
        chunks.push({
          title: buffer.slice(0, 90),
          content,
          category: 'content',
          page: pageNo,
          section: currentSection,
          heading: currentSection
        });
        buffer = '';
      }
    };
    for (const block of blocks) {
      const looksLikeHeading =
        block.length <= 80 && block.split(/\s+/).length <= 12 && block === block.trim() && !/[.!?:]$/.test(block);
      if (looksLikeHeading && block.toLowerCase() !== currentSection?.toLowerCase()) {
        flush();
        currentSection = block;
        continue;
      }
      if (buffer.length + block.length + 1 > MAX && buffer.length > 0) {
        flush();
      }
      buffer = buffer ? `${buffer} ${block}` : block;
    }
    flush();
  });
  return chunks;
}

function buildDerivedChunks(name: string, pages: string[], extracted: any): ChunkInput[] {
  const allText = pages.map((p) => p.toLowerCase());
  const locate = (phrase: string): { page: number | null; section: string | null } => {
    const key = (phrase || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
    if (!key) return { page: null, section: null };
    for (let i = 0; i < allText.length; i++) {
      if (allText[i].includes(key)) {
        const firstLine = pages[i].split('\n').map((l) => l.trim()).find((l) => l.length > 0) || null;
        return { page: i + 1, section: firstLine && firstLine.length <= 80 ? firstLine : null };
      }
    }
    return { page: null, section: null };
  };

  const out: ChunkInput[] = [];
  const push = (items: any[], category: string, titleFor: (it: any) => string, contentFor: (it: any) => string) => {
    for (const it of items || []) {
      const content = contentFor(it);
      if (!content || !content.trim()) continue;
      const loc = locate(typeof it === 'string' ? it : content);
      out.push({ title: titleFor(it), content, category, page: loc.page, section: loc.section, heading: loc.section });
    }
  };

  push(extracted.offerings, 'offering', (o: string) => `Capability: ${o}`, (o: string) => `${name} provides ${o}.`);
  push(extracted.targetIndustries, 'industry', (ind: string) => `Target Industry: ${ind}`, (ind: string) => `${name} serves the ${ind} vertical.`);
  push(extracted.caseStudies, 'case_study', () => 'Case Study', (cs: string) => cs);
  push(extracted.pricing, 'pricing', () => 'Pricing', (p: string) => p);
  push(extracted.techStack, 'tech', () => 'Technology', (t: string) => t);
  push(extracted.limitations, 'limitation', () => 'Limitation', (l: string) => l);
  return out;
}

function buildChunks(name: string, pages: string[], extracted: any): ChunkInput[] {
  return [...buildContentChunks(pages), ...buildDerivedChunks(name, pages, extracted)];
}

// ---------- profile upsert ----------

async function upsertProfile(docId: string, workspaceId: string, name: string, extracted: any, pageText: string): Promise<string> {
  const doc = (
    await query(`SELECT company_profile_id FROM company_documents WHERE id = $1`, [docId])
  ).rows[0];
  const payload = [
    name,
    extracted.tagline || `${name} Platform`,
    extracted.summary || '',
    JSON.stringify(extracted.offerings || []),
    JSON.stringify(extracted.targetIndustries || []),
    JSON.stringify(extracted.caseStudies || []),
    JSON.stringify(extracted.pricing || []),
    JSON.stringify(extracted.techStack || []),
    JSON.stringify(extracted.limitations || []),
    'PDF',
    pageText,
    workspaceId
  ];
  if (doc?.company_profile_id) {
    await query(
      `UPDATE company_profiles SET name=$1, tagline=$2, summary=$3, offerings=$4, target_industries=$5,
       case_studies=$6, pricing=$7, tech_stack=$8, limitations=$9, source_type=$10, source_text=$11, workspace_id=$12, updated_at=NOW()
       WHERE id=$13`,
      [...payload, doc.company_profile_id]
    );
    return doc.company_profile_id;
  }
  const ins = await query(
    `INSERT INTO company_profiles (name, tagline, summary, offerings, target_industries, case_studies, pricing, tech_stack, limitations, source_type, source_text, workspace_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    payload
  );
  await query(`UPDATE company_documents SET company_profile_id = $1 WHERE id = $2`, [ins.rows[0].id, docId]);
  return ins.rows[0].id;
}

// ---------- step tracking ----------

async function setDocStep(workspaceId: string, docId: string, status: DocStatus, detail: string, extra: any = {}) {
  await query(
    `UPDATE company_documents SET status = $1, status_detail = $2, updated_at = NOW() WHERE id = $3 AND workspace_id = $4`,
    [status, detail, docId, workspaceId]
  );
  return extra;
}

function safeErrorMessage(err: any): string {
  const msg = err?.message || String(err || 'Unknown error');
  return msg.replace(/\s+/g, ' ').slice(0, 400);
}

// ---------- main pipeline ----------

async function buildKnowledge(opts: {
  docId: string;
  workspaceId: string;
  filename: string;
  pages: string[];
}): Promise<{ profileId: string; chunkCount: number; pageCount: number }> {
  const { docId, workspaceId, filename, pages } = opts;
  const cleanPages = cleanPageText(pages);
  const fullText = cleanPages.filter(Boolean).join('\n\n');
  const cleanText = fullText.replace(/\s+/g, ' ').replace(/ \./g, '.').trim();
  if (cleanText.length < 10) {
    throw new Error('Could not extract readable text from this PDF. It may be scanned or image-based — please upload a text-based PDF.');
  }

  await setDocStep(workspaceId, docId, 'processing', 'analyzing');
  const name = filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Company Knowledge';
  const extracted = await extractCompanyStructured(name, cleanText);

  await setDocStep(workspaceId, docId, 'processing', 'chunking');
  const chunks = buildChunks(name, cleanPages, extracted);

  await setDocStep(workspaceId, docId, 'processing', 'embedding');
  const profileId = await upsertProfile(docId, workspaceId, name, extracted, cleanText);

  await query(`DELETE FROM knowledge_chunks WHERE document_id = $1`, [docId]);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const embedding = JSON.stringify(embedText(c.content));
    await query(
      `INSERT INTO knowledge_chunks (company_profile_id, document_id, title, content, category, page, section, heading, chunk_index, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [profileId, docId, c.title, c.content, c.category, c.page, c.section, c.heading, i, embedding]
    );
  }

  await setDocStep(workspaceId, docId, 'processing', 'indexing');
  await setDocStep(workspaceId, docId, 'processing', 'finalizing');
  await query(
    `UPDATE company_documents SET status='indexed', status_detail='indexed', error=NULL, page_count=$1, chunk_count=$2, page_text=$3, updated_at=NOW() WHERE id=$4`,
    [cleanPages.length, chunks.length, JSON.stringify(cleanPages), docId]
  );

  await logActivity({
    agent: 'Company Intelligence',
    step: 'PDF Extraction & RAG Indexing',
    tool: 'knowledge_pipeline',
    inputData: `doc=${filename}, pages=${cleanPages.length}`,
    outputData: `profile_id=${profileId}, chunks=${chunks.length}`,
    decision: `Indexed ${chunks.length} knowledge chunks from ${cleanPages.length} page(s) of ${filename}.`,
    workspaceId
  });

  return { profileId, chunkCount: chunks.length, pageCount: cleanPages.length };
}

export async function processPdfUpload(opts: {
  docId: string;
  workspaceId: string;
  buffer: Buffer;
  filename: string;
  mimetype: string;
  sizeBytes: number;
}): Promise<{ profileId: string; chunkCount: number; pageCount: number }> {
  const { docId, workspaceId, buffer, filename, mimetype, sizeBytes } = opts;
  try {
    validatePdfFile(buffer, filename, mimetype, sizeBytes);
    await setDocStep(workspaceId, docId, 'processing', 'validating');
    await query(
      `UPDATE company_documents SET size_bytes=$1, mime_type=$2, filename=$3, updated_at=NOW() WHERE id=$4`,
      [sizeBytes, mimetype, filename, docId]
    );
    await setDocStep(workspaceId, docId, 'processing', 'extracting');
    const { pages } = await extractPdfPages(buffer);
    const res = await buildKnowledge({ docId, workspaceId, filename, pages });
    return res;
  } catch (e) {
    const msg = safeErrorMessage(e);
    await query(`UPDATE company_documents SET status='failed', status_detail='error', error=$1, updated_at=NOW() WHERE id=$2`, [msg, docId]);
    throw e;
  }
}

export async function reprocessDocument(opts: { docId: string; workspaceId: string }): Promise<{ profileId: string; chunkCount: number; pageCount: number }> {
  const { docId, workspaceId } = opts;
  try {
    const doc = (await query(`SELECT * FROM company_documents WHERE id=$1 AND workspace_id=$2`, [docId, workspaceId])).rows[0];
    if (!doc) throw new Error('Document not found.');
    let pages: string[] = [];
    const pt = doc.page_text;
    if (Array.isArray(pt)) {
      pages = pt;
    } else if (typeof pt === 'string' && pt.length > 0) {
      try { pages = JSON.parse(pt); } catch { pages = []; }
    }
    if (!Array.isArray(pages) || pages.length === 0) {
      const prof = doc.company_profile_id
        ? (await query(`SELECT * FROM company_profiles WHERE id=$1`, [doc.company_profile_id])).rows[0]
        : null;
      const text = prof?.source_text || '';
      if (!text) throw new Error('No source text is available to reprocess this document.');
      pages = [text];
    }
    await query(`UPDATE company_documents SET version = version + 1, status='processing', status_detail='reprocess', error=NULL, updated_at=NOW() WHERE id=$1`, [docId]);
    const res = await buildKnowledge({ docId, workspaceId, filename: doc.filename || 'knowledge', pages });
    return res;
  } catch (e) {
    const msg = safeErrorMessage(e);
    await query(`UPDATE company_documents SET status='failed', status_detail='error', error=$1, updated_at=NOW() WHERE id=$2`, [msg, docId]);
    throw e;
  }
}

export async function deleteDocument(opts: { docId: string; workspaceId: string }): Promise<void> {
  const { docId, workspaceId } = opts;
  const doc = (await query(`SELECT company_profile_id FROM company_documents WHERE id=$1 AND workspace_id=$2`, [docId, workspaceId])).rows[0];
  if (!doc) throw new Error('Document not found.');
  if (doc.company_profile_id) {
    await query(`DELETE FROM knowledge_chunks WHERE document_id=$1 OR company_profile_id=$2`, [docId, doc.company_profile_id]);
    await query(`DELETE FROM company_profiles WHERE id=$1`, [doc.company_profile_id]);
  } else {
    await query(`DELETE FROM knowledge_chunks WHERE document_id=$1`, [docId]);
  }
  await query(`DELETE FROM company_documents WHERE id=$1`, [docId]);
}

// ---------- RAG ask ----------

function isSelfReferential(question: string): boolean {
  const q = ' ' + question.toLowerCase() + ' ';
  return /\b(we|our|ours|us|my|our company|the company|do we|are we|who we|what we)\b/.test(q) || q.includes('company knowledge');
}

function isCoreference(question: string): boolean {
  return /\b(which one|that one|it|they|them|those|these|what about|who)\b/.test(' ' + question.toLowerCase() + ' ');
}

/**
 * Query understanding: routes the question to a business topic and builds the
 * semantic search vocabulary (concept terms) used by hybrid retrieval. Uses the
 * deterministic topic vocabulary (with conversation coreference support) — the
 * LLM is reserved for answer generation to keep each ask efficient. Never
 * returns a hardcoded answer — only search vocabulary.
 */
async function planQuery(question: string, history: { q: string; a: string }[]): Promise<{ topic: string; terms: string[] }> {
  const topic = detectTopic(question);
  const terms = new Set<string>([
    ...(TOPIC_META[topic]?.keywords || []),
    ...normalizeText(question).split(/\s+/).filter((t) => t.length > 2)
  ]);

  const last = history[history.length - 1];
  if (last && isCoreference(question)) {
    const prevTopic = detectTopic(last.q);
    for (const kw of TOPIC_META[prevTopic]?.keywords || []) terms.add(kw);
    for (const w of normalizeText(last.q).split(/\s+/)) if (w.length > 2) terms.add(w);
  }

  return { topic, terms: [...terms].filter(Boolean).slice(0, 40) };
}

function chunkToSource(c: any): any {
  const section = stripBoilerplate(c.section || '');
  const heading = stripBoilerplate(c.heading || '');
  return {
    id: c.id,
    document: c.documentName || c.companyName || 'document',
    documentId: c.documentId,
    companyName: c.companyName,
    page: c.page,
    section: section || heading || undefined,
    heading,
    title: stripBoilerplate(c.title || ''),
    content: stripBoilerplate(c.content),
    category: c.category,
    score: Math.round((c.score || 0) * 100) / 100
  };
}

export async function askCompanyKnowledge(workspaceId: string, question: string, k = RAG_MIN_SOURCES, history: { q: string; a: string }[] = []) {
  const profiles = await query(`SELECT id FROM company_profiles WHERE workspace_id=$1`, [workspaceId]);
  const ids = profiles.rows.map((r: any) => r.id);
  if (ids.length === 0) {
    return { answer: null, sources: [], error: 'No company knowledge is indexed yet. Upload or index a company document first.' };
  }

  // Primary company knowledge base = the most recent indexed upload.
  const prim = (
    await query(
      `SELECT d.id AS doc_id, d.company_profile_id FROM company_documents d
       WHERE d.workspace_id=$1 AND d.status='indexed' AND d.company_profile_id IS NOT NULL
       ORDER BY d.created_at DESC LIMIT 1`,
      [workspaceId]
    )
  ).rows[0] || null;

  const selfRef = isSelfReferential(question);
  const { topic, terms } = await planQuery(question, history);

  const chunks = await retrieveChunksIn(ids, question, RAG_CANDIDATES, {
    topic,
    expansionTerms: terms,
    primaryProfileId: prim?.company_profile_id || undefined,
    primaryDocId: prim?.doc_id || undefined,
    selfReferential: selfRef,
    realDocsOnly: true,
    minScore: 0.6
  });

  if (chunks.length === 0) {
    return {
      answer: "I couldn't find reliable information about that in the uploaded company knowledge.",
      sources: [],
      error: null
    };
  }

  let answer = '';
  let used: number[] = [];

  if (llm.hasProvider) {
    const context = chunks
      .slice(0, RAG_LLM_CHUNKS)
      .map((c: any, i: number) => `[${i + 1}] (${c.documentName || c.companyName || 'document'}) ${c.content}`)
      .join('\n');
    const historyText = history
      .slice(-3)
      .map((h) => `Q: ${h.q}\nA: ${h.a}`)
      .join('\n');
    const systemPrompt = `You are the Company Knowledge assistant for the company described in the uploaded company documents.

Answer the user's question using ONLY the supplied company knowledge context.
- The context may contain chunks from multiple documents. Use ONLY the chunks that are relevant to YOUR company; ignore chunks about other organizations or unrelated material.
- Do not invent facts and do not use outside knowledge.
- If the genuinely relevant information is not present in the context, answer with exactly: "I couldn't find reliable information about that in the uploaded company knowledge."
- Cite chunk numbers like [1] or [2,3] right next to the claims they support.
- Preserve the company's own terminology. Mention pricing and limitations when relevant.
- Simple factual questions get a concise answer; complex questions get a short structured answer.
${historyText ? `\nPrevious conversation:\n${historyText}` : ''}

When you finish, add a final line in this EXACT format listing the chunk numbers you cited (no extra text):
[CITED: 1,3,5]
If you cited nothing, write: [CITED: none]`;
    const userPrompt = `Question: ${question}\n\nCompany knowledge context:\n${context}`;

    // One retry with a short backoff handles transient provider throttling
    // without degrading the experience (the deterministic fallback is last).
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await executeLLM(systemPrompt, userPrompt, false);
      if (typeof raw === 'string' && raw.trim()) {
        answer = raw.trim();
        const cited = answer.match(/\[CITED:\s*([^\]\n]*)\s*\]/i);
        if (cited) {
          answer = answer.replace(/\[CITED:[^\]]*\]/gi, '').trim();
          used = cited[1]
            .split(/[,\s]+/)
            .map((n: string) => Number(n) - 1)
            .filter((i: number) => Number.isInteger(i) && i >= 0 && i < chunks.length);
        }
        break;
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
    }
  }

  // Deterministic fallback (no LLM provider or providers were unavailable).
  // Always grounded in the retrieved chunks — never invented.
  if (!answer) {
    const top = chunks.slice(0, RAG_MIN_SOURCES);
    if (top.length === 0) {
      return {
        answer: "I couldn't find reliable information about that in the uploaded company knowledge.",
        sources: [],
        error: null
      };
    }
    const lines = top.map((c: any) => `• ${stripBoilerplate(c.content)}`).filter(Boolean);
    answer = lines.length > 0 ? `Based on the uploaded company knowledge:\n${lines.join('\n')}` : "I couldn't find reliable information about that in the uploaded company knowledge.";
    used = top.map((_, i) => i);
  }

  // Sources = the chunks the answer was grounded in. Dedup near-identical
  // sources (same document + page + section) so repeated/duplicate chunks from
  // repeated uploads never clutter the source list.
  const srcMap = new Map<string, any>();
  const addSource = (c: any) => {
    const key =
      c.page != null
        ? `${c.documentId || c.documentName || 'doc'}:p${c.page}:${normalizeText(c.section || c.heading || '')}`
        : `${c.documentId || c.documentName || 'doc'}:${normalizeText(c.content).slice(0, 90)}`;
    if (!srcMap.has(key)) srcMap.set(key, chunkToSource(c));
  };
  for (const i of used) {
    const c = chunks[i];
    if (c) addSource(c);
  }
  if (srcMap.size === 0) {
    for (const c of chunks.slice(0, RAG_MIN_SOURCES)) addSource(c);
  }

  return { answer, sources: [...srcMap.values()], error: null };
}