import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader, Card, Chip } from './ui';

export function AuditLogsView(props: { agentLogs: any[] }) {
  const [q, setQ] = useState('');
  const [agent, setAgent] = useState('');

  const agents = useMemo(() => [...new Set(props.agentLogs.map((l) => l.agent).filter(Boolean))].sort(), [props.agentLogs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return props.agentLogs.filter((l) => {
      if (agent && l.agent !== agent) return false;
      if (!term) return true;
      return `${l.agent || ''} ${l.tool || ''} ${l.decision || ''} ${l.input_data || ''} ${l.output_data || ''}`.toLowerCase().includes(term);
    });
  }, [props.agentLogs, q, agent]);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Advanced"
        title="Audit logs"
        subtitle="The raw, technical record of every tool call your AI made. This is for engineering review — the rest of the app keeps this complexity hidden."
      />

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agent, tool, decision…" className="w-full pl-9 pr-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all" />
        </div>
        <select value={agent} onChange={(e) => setAgent(e.target.value)} className="px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all">
          <option value="">All agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[12px] text-textSecondary ml-auto">{filtered.length} entries</span>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-muted">
                {['Agent', 'Tool', 'Step', 'Decision', 'Input', 'Output', 'Status', 'Duration', 'When'].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-textSecondary whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l: any) => (
                <tr key={l.id} className="border-b border-muted/40 last:border-0 align-top hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[12px] font-semibold text-textPrimary whitespace-nowrap">{l.agent}</td>
                  <td className="px-4 py-3 text-[11px] font-mono text-primary whitespace-nowrap">{l.tool}</td>
                  <td className="px-4 py-3 text-[12px] text-textPrimary">{l.step}</td>
                  <td className="px-4 py-3 text-[12px] text-textSecondary max-w-[260px] leading-relaxed">{l.decision || '—'}</td>
                  <td className="px-4 py-3 text-[11px] font-mono text-textSecondary max-w-[200px] break-all">{l.input_data || '—'}</td>
                  <td className="px-4 py-3 text-[11px] font-mono text-textSecondary max-w-[200px] break-all">{l.output_data || '—'}</td>
                  <td className="px-4 py-3">
                    <Chip tone={l.status === 'completed' ? 'success' : l.status === 'failed' ? 'danger' : 'neutral'} className="text-[10px]">{l.status || 'completed'}</Chip>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-textSecondary whitespace-nowrap">{l.duration != null ? `${l.duration}ms` : '—'}</td>
                  <td className="px-4 py-3 text-[11px] text-textSecondary whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10 text-[13px] text-textSecondary">No entries match.</div>}
        </div>
      </Card>
    </div>
  );
}