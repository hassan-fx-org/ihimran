import {
  Users, Star, MailOpen, ThumbsUp, Calendar, Trophy, Play,
  ArrowRight, ArrowUpRight, Activity, Sparkles
} from 'lucide-react';
import { PageHeader, MetricCard, Card, Button, EmptyState, ScoreBar, Chip, StageBadge, Skeleton, cx } from './ui';

const TOOL_FRIENDLY: Record<string, string> = {
  search_web_accounts: 'Lead Discovery',
  send_email: 'Outreach',
  classify_reply: 'Reply Analysis',
  web_research: 'Research',
  research_lead: 'Research',
  service_match: 'Service Matching',
  decision_makers: 'Decision Maker Research',
  create_meeting: 'Meeting Scheduling',
  generate_outreach: 'Message Drafting',
  deep_research: 'Deep Research',
  upsert_embeddings: 'Knowledge Indexing',
};

export function Dashboard(props: {
  dashboardData: any;
  leadsList: any[];
  meetingsList: any[];
  agentLogs: any[];
  loading: boolean;
  isDemo: boolean;
  integrations: { email: boolean; calendar: boolean; search: boolean; llm: boolean };
  userName: string;
  onRunDiscovery: () => void;
  onSelectLead: (id: string) => void;
  onViewPipeline: () => void;
  onViewLeads: () => void;
  onViewMeetings: () => void;
  onViewActivity: () => void;
}) {
  const { dashboardData, leadsList, meetingsList, agentLogs, loading, userName } = props;
  const kpis = dashboardData?.kpis || {};
  const upcomingMeetings = dashboardData?.upcomingMeetings || [];
  const meetings = upcomingMeetings.length > 0 ? upcomingMeetings : meetingsList.filter((m) => m.status === 'scheduled');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (userName || 'Admin').split(' ')[0];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const topQualified = [...leadsList]
    .filter((l) => ['Qualified', 'Interested', 'Contacted', 'Meeting Scheduled', 'Meeting Booked'].includes(l.stage))
    .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))
    .slice(0, 5);

  const recentActivity = (agentLogs || []).slice(0, 6).map((log: any) => ({
    agent: TOOL_FRIENDLY[log.tool] || log.agent || 'Agent',
    text: log.decision || log.output_data || log.step,
    at: log.timestamp,
  }));

  const kpiItems = [
    { label: 'Total Leads', value: kpis.totalLeads ?? 0, icon: <Users className="w-4 h-4" />, sub: `${kpis.discovered ?? 0} in discovery`, tone: 'neutral' as const },
    { label: 'Qualified', value: kpis.qualified ?? 0, icon: <Star className="w-4 h-4" />, sub: 'Matches your target profile', tone: 'primary' as const },
    { label: 'Contacted', value: kpis.contacted ?? 0, icon: <MailOpen className="w-4 h-4" />, sub: 'Reached out to', tone: 'warning' as const },
    { label: 'Interested', value: kpis.interested ?? 0, icon: <ThumbsUp className="w-4 h-4" />, sub: 'Engaged with you', tone: 'ai' as const },
    { label: 'Meetings', value: kpis.meetings ?? 0, icon: <Calendar className="w-4 h-4" />, sub: 'Booked on calendar', tone: 'neutral' as const },
    { label: 'Converted', value: kpis.converted ?? 0, icon: <Trophy className="w-4 h-4" />, sub: 'Won customers', tone: 'success' as const },
  ];

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={`${today} · Enterprise Production OS`}
        title={`${greeting}, ${firstName}`}
        subtitle="Here's what's happening with your sales pipeline. Your AI team is researching, qualifying, and reaching out so you can focus on the deals that matter."
        actions={
          <>
            <Button onClick={props.onRunDiscovery} loading={loading}>
              <Play className="w-4 h-4 fill-current" /> Run Lead Discovery
            </Button>
            <Button variant="secondary" onClick={props.onViewPipeline} className="hidden sm:inline-flex">
              View Pipeline <ArrowRight className="w-4 h-4" />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {loading && !kpis.totalLeads
          ? kpiItems.map((_, i) => <div key={i} className="bg-surface border border-muted rounded-2xl p-5 space-y-3"><Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-10" /><Skeleton className="h-2.5 w-24" /></div>)
          : kpiItems.map((k) => <MetricCard key={k.label} {...k} accent={k.tone === 'primary'} />)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card title="Top qualified leads" actions={<button onClick={props.onViewLeads} className="text-[12px] font-semibold text-primary hover:text-blue-400 flex items-center gap-1">View all <ArrowUpRight className="w-3.5 h-3.5" /></button>}>
          {loading && topQualified.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-4 p-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-24" /></div>)}
            </div>
          ) : topQualified.length === 0 ? (
            <EmptyState
              title="No qualified leads yet"
              message="Run a discovery to find companies that match your target profile. Qualified leads will appear here with a recommended service and next action."
              cta="Run Lead Discovery"
              onCta={props.onRunDiscovery}
              icon={<Sparkles className="w-5 h-5" />}
            />
          ) : (
            <div className="space-y-1">
              {topQualified.map((l) => (
                <button
                  key={l.id}
                  onClick={() => props.onSelectLead(l.id)}
                  className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left border border-transparent hover:border-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-textPrimary truncate">{l.name}</span>
                      {(l.source || l._source) === 'demo' && <Chip tone="warning" className="text-[10px]">Demo</Chip>}
                    </div>
                    <div className="text-[12px] text-textSecondary truncate mt-0.5">
                      {[l.industry, l.location].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <div className="hidden md:block w-44 shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-textSecondary mb-1">Lead score</div>
                    <ScoreBar value={l.confidence_score || 0} />
                  </div>
                  <div className="w-36 shrink-0 text-right">
                    <div className="text-[11px] text-textSecondary truncate mb-1">{l.recommended_service || 'Service not yet matched'}</div>
                    <StageBadge stage={l.stage} compact />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Upcoming meetings" actions={<button onClick={props.onViewMeetings} className="text-[12px] font-semibold text-primary hover:text-blue-400 flex items-center gap-1">View calendar <ArrowUpRight className="w-3.5 h-3.5" /></button>}>
          {loading && meetings.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-4 p-3"><Skeleton className="h-12 w-12 rounded-xl" /><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-20" /></div>)}
            </div>
          ) : meetings.length === 0 ? (
            <EmptyState
              title="No meetings scheduled"
              message="When a prospect responds positively to outreach, your AI books a meeting and prepares a briefing automatically."
              cta="View Pipeline"
              onCta={props.onViewPipeline}
              icon={<Calendar className="w-5 h-5" />}
            />
          ) : (
            <div className="space-y-1">
              {meetings.slice(0, 5).map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => props.onSelectLead(m.lead_id)}
                  className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left border border-transparent hover:border-muted"
                >
                  <div className="w-14 h-14 shrink-0 rounded-xl bg-primary/[0.1] border border-primary/20 flex flex-col items-center justify-center">
                    <span className="text-[15px] font-bold text-primary leading-none">{new Date(m.meeting_time).getDate()}</span>
                    <span className="text-[9px] uppercase text-textSecondary mt-0.5">{new Date(m.meeting_time).toLocaleString('en-US', { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-textPrimary truncate">{m.lead_name || m.contact_name || 'Meeting'}</div>
                    <div className="text-[12px] text-textSecondary truncate mt-0.5">
                      {m.contact_name ? `${m.contact_name}${m.contact_role ? ' · ' + m.contact_role : ''} · ` : ''}
                      {new Date(m.meeting_time).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-[12px] font-medium text-textSecondary shrink-0 truncate max-w-[180px]">{m.service_to_discuss || 'Intro meeting'}</div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Recent AI activity"
        actions={
          <button onClick={props.onViewActivity} className="text-[12px] font-semibold text-primary hover:text-blue-400 flex items-center gap-1">
            View Activity <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        {loading && recentActivity.length === 0 ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex items-start gap-3"><Skeleton className="h-3 w-3 rounded-full" /><Skeleton className="h-4 flex-1" /></div>)}</div>
        ) : recentActivity.length === 0 ? (
          <div className="text-[13px] text-textSecondary">No agent activity yet. Run a discovery to see your AI team in action.</div>
        ) : (
          <div className="space-y-2.5">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={cx('mt-1 w-1.5 h-1.5 rounded-full shrink-0', i === 0 ? 'bg-secondary' : 'bg-success')} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-textPrimary leading-relaxed">{a.text}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-textSecondary">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {a.agent}</span>
                    {a.at && <span>{new Date(a.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}