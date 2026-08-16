import { useState } from 'react';
import { CheckCircle2, Activity as ActivityIcon, Eye, EyeOff, Bot, Clock } from 'lucide-react';
import { PageHeader, Card, Button, Chip, cx } from './ui';

const WORKFLOW_FRIENDLY: Record<string, string> = {
  'lead-discovery': 'Lead Discovery',
  'deep-research': 'Deep Research',
  'service-match': 'Service Matching',
  'decision-makers': 'Decision Maker Research',
  'outreach': 'Outreach',
  'follow-up': 'Follow-up',
  'full-lifecycle': 'Full Lifecycle',
  'meeting-scheduling': 'Meeting Scheduling',
  'reply-classification': 'Reply Classification',
};

export function ActivityView(props: {
  agentRuns: any[];
  agentLogs: any[];
  onSelectLead: (id: string) => void;
}) {
  const [technical, setTechnical] = useState(false);
  const runs = props.agentRuns || [];
  const logs = props.agentLogs || [];

  const humanize = (w: string) => WORKFLOW_FRIENDLY[w] || w;

  return (
    <div className="p-4 md:p-8 max-w-[1000px] mx-auto">
      <PageHeader
        eyebrow="Advanced"
        title="Agent activity"
        subtitle="What your AI team has been doing. By default you see a simple, human-readable summary — flip to technical details to inspect the underlying tool calls and workflow runs."
        actions={
          <Button variant="secondary" onClick={() => setTechnical((t) => !t)}>
            {technical ? <><EyeOff className="w-4 h-4" /> Hide technical details</> : <><Eye className="w-4 h-4" /> View technical details</>}
          </Button>
        }
      />

      <div className="space-y-6">
        <Card title="Workflow runs">
          {runs.length === 0 ? (
            <div className="text-[13px] text-textSecondary">No workflow runs recorded yet. Run a discovery to see your AI team in action.</div>
          ) : (
            <div className="space-y-3">
              {runs.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-start gap-3 border border-muted rounded-xl p-4">
                  <span className={cx('mt-0.5 w-2 h-2 rounded-full shrink-0', r.status === 'completed' ? 'bg-success' : r.status === 'running' ? 'bg-warning animate-pulse' : 'bg-danger')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-textPrimary">{humanize(r.workflow)}</span>
                      <Chip tone={r.status === 'completed' ? 'success' : r.status === 'running' ? 'warning' : 'danger'} className="text-[10px]">{r.status}</Chip>
                      {r.lead_name && (
                        <button onClick={() => props.onSelectLead(r.lead_id)} className="text-[12px] font-semibold text-primary hover:text-blue-400 ml-auto">
                          {r.lead_name} →
                        </button>
                      )}
                    </div>
                    {r.decision && <div className="text-[13px] text-textSecondary leading-relaxed mt-1.5">{r.decision}</div>}
                    {!technical && (
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-textSecondary">
                        <Clock className="w-3 h-3" /> {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    )}
                    {technical && (
                      <div className="mt-2 pt-2 border-t border-muted/60 space-y-1 text-[11px] font-mono text-textSecondary">
                        <div>run_id: {r.id}</div>
                        <div>state: {r.current_state || '—'}</div>
                        <div>retries: {r.retry_count ?? 0}</div>
                        <div>started: {new Date(r.created_at).toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {!technical ? (
          <Card title="Recent activity">
            {logs.length === 0 ? (
              <div className="text-[13px] text-textSecondary">No activity recorded yet.</div>
            ) : (
              <div className="space-y-2.5">
                {logs.slice(0, 20).map((l: any) => (
                  <div key={l.id} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-textPrimary leading-relaxed">{l.decision || l.step || l.output_data}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-textSecondary">
                        <ActivityIcon className="w-3 h-3" /> {l.agent || 'Agent'}
                        <span>{new Date(l.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card title="Tool calls" actions={<span className="text-[12px] text-textSecondary">{logs.length} entries</span>}>
            <div className="space-y-2">
              {logs.map((l: any) => (
                <div key={l.id} className="border border-muted rounded-lg p-3.5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[12px] font-semibold text-textPrimary flex items-center gap-1.5"><Bot className="w-3.5 h-3.5 text-secondary" /> {l.agent}</span>
                    <span className="text-[11px] font-mono text-primary bg-primary/[0.08] px-1.5 py-0.5 rounded">{l.tool}</span>
                    <Chip tone={l.status === 'completed' ? 'success' : l.status === 'failed' ? 'danger' : 'neutral'} className="text-[10px]">{l.status || 'completed'}</Chip>
                    {l.duration != null && <span className="text-[11px] text-textSecondary ml-auto">{l.duration}ms</span>}
                  </div>
                  <div className="text-[12px] text-textPrimary leading-relaxed">{l.decision || l.step}</div>
                  {(l.input_data || l.output_data) && (
                    <div className="mt-2 grid sm:grid-cols-2 gap-2">
                      {l.input_data && <div className="text-[11px] font-mono text-textSecondary bg-elevated border border-muted rounded p-2 break-all">{l.input_data}</div>}
                      {l.output_data && <div className="text-[11px] font-mono text-textSecondary bg-elevated border border-muted rounded p-2 break-all">{l.output_data}</div>}
                    </div>
                  )}
                  <div className="text-[10px] text-textSecondary mt-2">{new Date(l.timestamp).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}