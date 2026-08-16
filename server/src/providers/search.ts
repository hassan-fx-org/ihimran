import dotenv from 'dotenv';

dotenv.config();

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Web research provider. Uses Tavily first, then Serper. Returns null when no
 * research API is configured — callers must then fall back to honest
 * "no reliable evidence" or an explicitly-labeled demo dataset.
 */
export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[] | null> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: maxResults,
          search_depth: 'basic'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data: any = await res.json();
        return (data?.results || []).map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.content || ''
        }));
      }
    } catch (e) {
      console.warn('⚠️ Tavily failed:', (e as Error).message);
    }
  }

  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': serperKey },
        body: JSON.stringify({ q: query, num: maxResults }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data: any = await res.json();
        return (data?.organic || []).map((r: any) => ({
          title: r.title || '',
          url: r.link || '',
          snippet: r.snippet || ''
        }));
      }
    } catch (e) {
      console.warn('⚠️ Serper failed:', (e as Error).message);
    }
  }

  return null;
}

export const search = {
  query: webSearch,
  hasProvider: Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY)
};