import { useMemo, useState } from 'react';
import { Search, ChevronRight, X, Play, Globe, Users } from 'lucide-react';
import { PageHeader, Button, StageBadge, ScoreBar, Chip, EmptyState, cx, Skeleton } from './ui';

export function LeadsPage(props: {
  leadsList: any[];
  loading: boolean;
  onSelectLead: (id: string) => void;
  onReRunDiscovery: () => void;
}) {
  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [minScore, setMinScore] = useState('');
  const [status, setStatus] = useState('');

  const industries = useMemo(() => [...new Set(props.leadsList.map((l) => l.industry).filter(Boolean))].sort(), [props.leadsList]);
  const locations = useMemo(() => [...new Set(props.leadsList.map((l) => l.location).filter(Boolean))].sort(), [props.leadsList]);
  const statuses = useMemo(() => [...new Set(props.leadsList.map((l) => l.stage).filter(Boolean))].sort(), [props.leadsList]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return props.leadsList.filter((l) => {
      if (term && !`${l.name || ''} ${l.industry || ''} ${l.location || ''} ${l.recommended_service || ''}`.toLowerCase().includes(term)) return false;
      if (industry && l.industry !== industry) return false;
      if (location && l.location !== location) return false;
      if (status && l.stage !== status) return false;
      if (minScore && (l.confidence_score ?? 0) < Number(minScore)) return false;
      return true;
    });
  }, [props.leadsList, q, industry, location, status, minScore]);

  const hasFilters = q || industry || location || status || minScore;
  const selectCls = 'px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all';

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Pipeline"
        title="Leads"
        subtitle="Every company your AI has found. Qualified leads are ranked by fit and given a recommended service and next action — click any lead to see the full intelligence."
        actions={
          <Button onClick={props.onReRunDiscovery} loading={props.loading} variant="secondary">
            <Play className="w-4 h-4 fill-current" /> Find More Leads
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, industry, service…"
            className="w-full pl-9 pr-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
          />
        </div>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectCls}>
          <option value="">All industries</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className={selectCls}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={minScore} onChange={(e) => setMinScore(e.target.value)} className={selectCls}>
          <option value="">Any score</option>
          <option value="70">70+</option>
          <option value="60">60+</option>
          <option value="50">50+</option>
          <option value="40">40+</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setQ(''); setIndustry(''); setLocation(''); setStatus(''); setMinScore(''); }} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-textSecondary hover:text-textPrimary">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[12px] text-textSecondary">{filtered.length} lead{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length === 0 && !props.loading ? (
        <EmptyState
          title={hasFilters ? 'No leads match your filters' : 'No leads yet'}
          message={hasFilters ? 'Try widening your search or clearing some filters.' : 'Run a discovery to find companies that match your target profile. They will appear here with a score and recommended service.'}
          cta={hasFilters ? undefined : 'Find More Leads'}
          onCta={hasFilters ? undefined : props.onReRunDiscovery}
          icon={<Users className="w-5 h-5" />}
        />
      ) : (
        <div className="bg-surface border border-muted rounded-2xl overflow-hidden">
          {props.loading && filtered.length === 0 ? (
            <div className="p-6 space-y-4">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-muted">
                    {['Company', 'Industry', 'Location', 'Match', 'Status', 'Recommended service', 'Next action', ''].map((h, i) => (
                      <th key={i} className={cx('px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-textSecondary whitespace-nowrap', i === 0 && 'w-full')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => props.onSelectLead(l.id)}
                      className="border-b border-muted/50 last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-textPrimary">{l.name}</span>
                          {(l.source || l._source) === 'demo' && <Chip tone="warning" className="text-[10px] px-1.5 py-0.5">Demo</Chip>}
                          {(l.source || l._source) === 'web-search' && <Chip tone="primary" className="text-[10px] px-1.5 py-0.5">Web</Chip>}
                        </div>
                        {l.website && (
                          <a
                            href={l.website}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[11px] text-textSecondary hover:text-primary mt-0.5 max-w-[220px] truncate"
                          >
                            <Globe className="w-3 h-3 shrink-0" /> {l.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-textSecondary whitespace-nowrap">{l.industry || '—'}</td>
                      <td className="px-5 py-4 text-[13px] text-textSecondary whitespace-nowrap">{l.location || '—'}</td>
                      <td className="px-5 py-4 w-40"><ScoreBar value={l.confidence_score || 0} /></td>
                      <td className="px-5 py-4"><StageBadge stage={l.stage} compact /></td>
                      <td className="px-5 py-4 text-[13px] text-textPrimary max-w-[220px] truncate">{l.recommended_service || <span className="text-textSecondary">Not matched yet</span>}</td>
                      <td className="px-5 py-4 text-[13px] text-textSecondary max-w-[260px] truncate">{l.next_action || '—'}</td>
                      <td className="px-5 py-4"><ChevronRight className="w-4 h-4 text-textSecondary" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}