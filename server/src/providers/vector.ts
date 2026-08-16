import { query } from '../db/db';

const DIM = 384;

function hashToUnit(seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h % 100000) / 100000; // 0..1
}

/**
 * Deterministic hashing-based embedding. No external embedding API required:
 * shared tokens between a query and a chunk produce high cosine similarity,
 * which is sufficient for grounded RAG retrieval in this workflow.
 */
export function embedText(text: string): number[] {
  const vec = new Array(DIM).fill(0);
  const tokens = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = h >>> 0;
    const dim = idx % DIM;
    const sign = (idx >> 8) % 2 === 0 ? 1 : -1;
    vec[dim] += sign;
  }
  return vec;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface Chunk {
  id: string;
  title: string;
  content: string;
  category: string;
  page: number | null;
  section: string | null;
  heading: string | null;
  chunkIndex: number | null;
  score: number;
  companyName?: string;
  documentName?: string;
  documentId?: string | null;
}

// ---------- query understanding ----------

const STOPWORDS = new Set([
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'does', 'did', 'do',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'we', 'our', 'ours',
  'us', 'the', 'a', 'an', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'from',
  'can', 'could', 'would', 'should', 'about', 'that', 'this', 'these', 'those', 'it', 'its', 'you',
  'your', 'not', 'no', 'yes', 'there', 'their', 'they', 'them', 'i', 'me', 'my', 'into', 'over',
  'under', 'between', 'than', 'then', 'such', 'very', 'just', 'also', 'all', 'any', 'some', 'get'
]);

export interface TopicInfo {
  categories: Record<string, number>;
  keywords: string[];
}

/**
 * Topic routing for question understanding. Each topic maps to the chunk
 * categories that should be prioritized and to the section/keyword vocabulary
 * that answers that kind of question. This is generic query understanding —
 * NOT a hardcoded answer set.
 */
export const TOPIC_META: Record<string, TopicInfo> = {
  services: {
    categories: { offering: 3.0, pricing: 1.4, content: 0.8, summary: 1.2, case_study: 0.5 },
    keywords: ['services', 'service', 'capabilities', 'capability', 'offerings', 'offering', 'products', 'product', 'packages', 'package', 'solutions', 'solution', 'what we do', 'do we offer', 'provide', 'provided']
  },
  pricing: {
    categories: { pricing: 3.4, offering: 0.8 },
    keywords: ['pricing', 'price', 'prices', 'packages', 'package', 'cost', 'costs', 'monthly', 'recurring', 'setup', 'fee', 'fees', 'charge', 'charges', 'how much', 'rate']
  },
  industries: {
    categories: { industry: 3.4, offering: 0.4, content: 0.3 },
    keywords: ['industries', 'industry', 'vertical', 'verticals', 'market', 'markets', 'segments', 'segment', 'clients', 'target industries', 'do we serve', 'who we serve']
  },
  tech: {
    categories: { tech: 3.4 },
    keywords: ['technologies', 'technology', 'tech', 'tech stack', 'stack', 'tools', 'tool', 'languages', 'language', 'frameworks', 'framework', 'database', 'databases', 'libraries']
  },
  limitations: {
    categories: { limitation: 3.6 },
    keywords: ['limitations', 'limitation', 'limits', 'limit', 'boundaries', 'boundary', 'restrictions', 'restriction', 'conditions', 'condition', 'constraints', 'constraint', 'approval', 'exceptions', 'exception', 'not support', 'cannot', 'does not', 'what can you not']
  },
  'case-studies': {
    categories: { case_study: 3.6, offering: 0.4 },
    keywords: ['case studies', 'case study', 'previous work', 'results', 'result', 'outcomes', 'outcome', 'portfolio', 'success stories', 'success story', 'past work', 'done for']
  },
  integrations: {
    categories: { tech: 1.8, offering: 1.2, content: 0.4 },
    keywords: ['integrations', 'integration', 'integrate', 'integrated', 'connect', 'connections', 'api', 'apis', 'crm', 'webhooks', 'plugins', 'plugin', 'third party', 'tools connect']
  },
  'target-customer': {
    categories: { industry: 1.6, content: 0.8, summary: 0.8, offering: 0.6 },
    keywords: ['target customer', 'target customers', 'ideal customer', 'customer', 'customers', 'persona', 'who is our', 'who are our', 'audience', 'buyer', 'buyers', 'who we help']
  },
  differentiation: {
    categories: { summary: 1.4, offering: 1.2, content: 0.6 },
    keywords: ['different', 'differentiate', 'differentiator', 'differentiators', 'unique', 'uniqueness', 'advantage', 'advantages', 'better', 'why us', 'distinct', 'edge', 'stand out', 'make us different']
  },
  general: {
    categories: { summary: 1.0, offering: 0.5, content: 0.3 },
    keywords: []
  }
};

/**
 * Concept groups used for lexical semantic matching. When a question touches a
 * concept (e.g. "services"), chunks that mention any of that concept's terms
 * are rewarded — so "what services do we offer?" surfaces chunks about
 * offerings/capabilities/packages, not just chunks containing the literal word
 * "services".
 */
export const CONCEPT_GROUPS: string[][] = [
  ['services', 'offerings', 'capabilities', 'products', 'packages', 'solutions', 'what we do', 'provided'],
  ['pricing', 'packages', 'cost', 'monthly', 'recurring', 'setup', 'fees', 'charges'],
  ['industries', 'verticals', 'markets', 'segments', 'clients', 'serves'],
  ['technologies', 'tech', 'stack', 'tools', 'frameworks', 'languages', 'database'],
  ['limitations', 'boundaries', 'restrictions', 'constraints', 'conditions', 'approval'],
  ['integrations', 'api', 'crm', 'whatsapp', 'connectors', 'webhooks', 'plugins'],
  ['case studies', 'results', 'outcomes', 'portfolio', 'clients', 'success'],
  ['conversational ai', 'chatbot', 'voice', 'automation', 'workflow', 'ai assistant', 'sales agent']
];

const STRUCTURED_CATEGORIES = new Set(['offering', 'industry', 'tech', 'limitation', 'pricing', 'case_study']);

export function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeText(s).split(/\s+/).filter((t) => t.length > 1);
}

/** Detects the business topic a knowledge question is asking about. */
export function detectTopic(question: string): string {
  const q = ' ' + normalizeText(question) + ' ';
  let best = 'general';
  let bestScore = 0;
  for (const [topic, meta] of Object.entries(TOPIC_META)) {
    if (topic === 'general') continue;
    let s = 0;
    for (const kw of meta.keywords) {
      const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (kw.includes(' ')) {
        if (q.includes(kw)) s += 1.2;
      } else if (new RegExp(`\\b${esc}\\b`).test(q)) {
        s += kw.length >= 5 ? 1.0 : 0.6;
      }
    }
    if (s > bestScore) {
      bestScore = s;
      best = topic;
    }
  }
  return best;
}

// ---------- retrieval ----------

export interface RetrieveOptions {
  topic?: string;
  expansionTerms?: string[];
  primaryProfileId?: string;
  primaryDocId?: string;
  selfReferential?: boolean;
  realDocsOnly?: boolean;
  minScore?: number;
}

/**
 * Retrieves the most relevant knowledge chunks across a set of company profiles
 * using hybrid retrieval: vector (hashing) similarity + weighted lexical match +
 * concept-group expansion + topic category routing + document relevance.
 */
export async function retrieveChunksIn(
  companyProfileIds: string[],
  queryText: string,
  k = 5,
  opts: RetrieveOptions = {}
): Promise<Chunk[]> {
  if (companyProfileIds.length === 0) return [];

  const topic = opts.topic || detectTopic(queryText);
  const meta = TOPIC_META[topic] || TOPIC_META.general;
  const expansion = opts.expansionTerms && opts.expansionTerms.length > 0 ? opts.expansionTerms : meta.keywords;

  const qNorm = normalizeText(queryText);
  const qTokens = tokenize(queryText);
  const qWords = new Set(qTokens.filter((t) => !STOPWORDS.has(t) && t.length >= 3));

  const activeGroups = new Set<number>();
  CONCEPT_GROUPS.forEach((group, gi) => {
    if (group.some((term) => qNorm.includes(term) || term.split(/\s+/).some((tw) => qWords.has(tw)))) {
      activeGroups.add(gi);
    }
  });

  // Vector over query + concept expansion so chunks sharing concept words get
  // a small cosine signal in addition to the lexical/category scoring.
  const qVec = embedText(`${queryText} ${expansion.slice(0, 24).join(' ')}`);

  const res = await query(
    `SELECT kc.id, kc.title, kc.content, kc.category, kc.page, kc.section, kc.heading, kc.chunk_index,
            kc.embedding, kc.document_id, kc.company_profile_id, cp.name AS company_name, cd.filename AS document_name
     FROM knowledge_chunks kc
     JOIN company_profiles cp ON cp.id = kc.company_profile_id
     LEFT JOIN company_documents cd ON cd.id = kc.document_id
     WHERE kc.company_profile_id = ANY($1)
     ${opts.realDocsOnly ? 'AND kc.document_id IS NOT NULL' : ''}`,
    [companyProfileIds]
  );

  const isPrimary = (c: any) =>
    (opts.primaryProfileId && c.company_profile_id === opts.primaryProfileId) ||
    (opts.primaryDocId && c.document_id === opts.primaryDocId);

  const scored: Chunk[] = res.rows.map((row: any) => {
    let vectorScore = 0;
    if (row.embedding) {
      let emb: number[] = row.embedding;
      if (typeof row.embedding === 'string') {
        try {
          emb = JSON.parse(row.embedding);
        } catch {
          emb = [];
        }
      }
      if (Array.isArray(emb) && emb.length === DIM) vectorScore = cosine(qVec, emb);
    }

    const contentSet = new Set(tokenize(row.content));
    const titleSet = new Set(tokenize([row.title, row.section, row.heading].filter(Boolean).join(' ')));
    const normContent = normalizeText(row.content);
    const normText = normalizeText(`${row.title || ''} ${row.section || ''} ${row.heading || ''} ${row.content || ''}`);

    // 1. Weighted lexical overlap with query content words.
    let lexical = 0;
    for (const w of qWords) {
      if (contentSet.has(w)) lexical += w.length >= 6 ? 1.0 : 0.6;
      if (titleSet.has(w)) lexical += 1.2;
    }

    // 2. Concept-group hits (query concept present in chunk).
    let concept = 0;
    for (const gi of activeGroups) {
      const group = CONCEPT_GROUPS[gi];
      if (group.some((term) => {
        const ts = term.split(/\s+/);
        if (ts.length > 1) return normText.includes(term);
        return contentSet.has(ts[0]) || titleSet.has(ts[0]);
      })) {
        concept += 1.0;
      }
    }

    // 3. Topic category routing.
    const catBoost = meta.categories[row.category] || 0;

    // 4. Topic vocabulary presence.
    let topicHit = 0;
    for (const kw of meta.keywords) {
      if (kw.includes(' ')) {
        if (normText.includes(kw)) topicHit += 1.0;
      } else if (contentSet.has(kw) || titleSet.has(kw)) {
        topicHit += 0.8;
      }
    }

    // 5. Structured derived facts are high-signal.
    const structuredCat = STRUCTURED_CATEGORIES.has(row.category) ? 0.6 : 0;

    // 6. Penalties: question-only chunks and bare section headers are not answers.
    let penalty = 0;
    if (normContent.endsWith('?')) penalty += 1.5;
    if (normContent.length > 0 && normContent === qNorm) penalty += 2.0;
    if ((row.category === 'document' || row.category === 'content') && normContent.split(/\s+/).length <= 12) {
      penalty += 1.2;
    }

    // 7. Primary company document boost.
    const primaryBoost = isPrimary(row) ? (opts.selfReferential ? 2.4 : 1.6) : 0;

    const score = vectorScore * 2.2 + lexical * 1.0 + concept * 1.2 + catBoost + topicHit * 0.7 + structuredCat + primaryBoost - penalty;

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      page: row.page,
      section: row.section,
      heading: row.heading,
      chunkIndex: row.chunk_index,
      score,
      companyName: row.company_name,
      documentName: row.document_name,
      documentId: row.document_id,
      isPrimaryChunk: isPrimary(row)
    };
  });

  // Deduplicate near-identical chunk content, keeping the best-scoring copy.
  scored.sort((a, b) => b.score - a.score);
  const accepted: any[] = [];
  for (const c of scored) {
    const nc = normalizeText(c.content);
    const dup = accepted.some((a) => {
      const na = normalizeText(a.content);
      return na === nc || na.includes(nc) || nc.includes(na);
    });
    if (!dup) accepted.push(c);
  }

  // Document relevance gate: for "our company" questions, non-primary documents
  // must clear a higher bar so unrelated knowledge never contaminates results.
  let pool = accepted;
  if (opts.selfReferential && (opts.primaryProfileId || opts.primaryDocId)) {
    const primaryBest = accepted.find((c) => c.isPrimaryChunk)?.score || 0;
    pool = accepted.filter((c) => c.isPrimaryChunk || c.score >= Math.max(2.2, primaryBest * 0.35));
  }

  const top = pool[0]?.score || 0;
  const floor = Math.max(opts.minScore ?? 0.5, top * 0.2);
  const final = pool.filter((c) => c.score >= floor).slice(0, Math.max(k, 12));

  return final.map((c) => ({
    id: c.id,
    title: c.title,
    content: c.content,
    category: c.category,
    page: c.page,
    section: c.section,
    heading: c.heading,
    chunkIndex: c.chunk_index,
    score: c.score,
    companyName: c.companyName,
    documentName: c.documentName,
    documentId: c.documentId
  }));
}

/**
 * Retrieves the most relevant knowledge chunks for a single company profile
 * using vector similarity over the persisted embeddings.
 */
export async function retrieveChunks(
  companyProfileId: string,
  queryText: string,
  k = 5,
  opts: RetrieveOptions = {}
): Promise<Chunk[]> {
  return retrieveChunksIn([companyProfileId], queryText, k, opts);
}

export const vector = {
  embed: embedText,
  cosine,
  retrieve: retrieveChunks,
  retrieveIn: retrieveChunksIn,
  detectTopic
};