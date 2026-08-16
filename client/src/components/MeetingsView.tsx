import { useMemo, useState } from 'react';
import { Calendar, Clock, Users, Briefcase, ExternalLink, AlertTriangle, ArrowRight, Target, MessageSquare, ShieldAlert } from 'lucide-react';
import { PageHeader, Card, EmptyState, Notice, Chip, cx } from './ui';

function fmt(d: string) {
  const dt = new Date(d);
  return {
    date: dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function isToday(d: string) {
  const a = new Date(d);
  const b = new Date();
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export function MeetingsView(props: {
  meetingsList: any[];
  onSelectLead: (id: string) => void;
  integrations: { email: boolean; calendar: boolean; search: boolean; llm: boolean };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(props.meetingsList[0]?.id || null);
  const selected = props.meetingsList.find((m) => m.id === selectedId);

  const groups = useMemo(() => {
    const now = Date.now();
    const upcoming: any[] = [];
    const today: any[] = [];
    const past: any[] = [];
    for (const m of props.meetingsList) {
      const t = new Date(m.meeting_time).getTime();
      if (t < now) past.push(m);
      else if (isToday(m.meeting_time)) today.push(m);
      else upcoming.push(m);
    }
    return { today, upcoming, past };
  }, [props.meetingsList]);

  const renderGroup = (title: string, items: any[]) => (
    <div className="mb-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-textSecondary px-1 mb-2">{title} · {items.length}</div>
      <div className="space-y-1.5">
        {items.map((m) => {
          const { date, time } = fmt(m.meeting_time);
          const active = m.id === selectedId;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={cx(
                'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                active ? 'bg-primary/[0.08] border-primary/30' : 'bg-surface border-muted hover:border-primary/30'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-textPrimary truncate">{m.lead_name || m.contact_name || 'Meeting'}</span>
                <span className="text-[12px] text-textSecondary shrink-0">{time}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-textSecondary mt-1">
                <Calendar className="w-3.5 h-3.5" /> {date}
                {m.contact_name && <><span className="text-textSecondary/50">·</span><Users className="w-3.5 h-3.5" /> {m.contact_name}</>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow="Calendar"
        title="Meetings"
        subtitle="Every booked meeting with a one-click briefing. Your AI schedules these automatically when a prospect says yes, and prepares the talking points."
      />

      {props.meetingsList.length === 0 ? (
        <EmptyState title="No meetings yet" message="Meetings are booked automatically when a prospect responds positively to outreach. Check back after your outreach goes out." icon={<Calendar className="w-5 h-5" />} />
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
          <div>
            {groups.today.length > 0 && renderGroup('Today', groups.today)}
            {renderGroup('Upcoming', groups.upcoming)}
            {renderGroup('Past', groups.past)}
          </div>

          <div className="sticky top-8">
            {!selected ? (
              <Card><div className="text-[13px] text-textSecondary">Select a meeting to see its briefing.</div></Card>
            ) : (
              <Card title="Meeting briefing">
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-textPrimary">{selected.lead_name || selected.contact_name || 'Meeting'}</h2>
                      {selected.status === 'scheduled' && <Chip tone="success" className="text-[10px]">Scheduled</Chip>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[13px] text-textSecondary">
                      {selected.contact_name && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {selected.contact_name}{selected.contact_role ? ` · ${selected.contact_role}` : ''}</span>}
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {fmt(selected.meeting_time).date} at {fmt(selected.meeting_time).time}</span>
                      {selected.service_to_discuss && <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> {selected.service_to_discuss}</span>}
                    </div>
                  </div>

                  {!props.integrations.calendar && !selected.meeting_link ? (
                    <Notice tone="warning">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span><strong className="font-semibold">Calendar not connected.</strong> This meeting is recorded internally but no meeting link was created. Connect Google Calendar in Settings to get a real link.</span>
                    </Notice>
                  ) : selected.meeting_link ? (
                    <a
                      href={selected.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-500 text-white rounded-lg text-[13px] font-semibold transition-colors"
                    >
                      Open meeting link <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : null}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="border border-muted rounded-xl p-4">
                      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><Target className="w-3.5 h-3.5 text-warning" /> Problem to discuss</div>
                      <p className="text-[13px] text-textPrimary leading-relaxed">{selected.problem_summary || selected.customer_problem || 'Not recorded.'}</p>
                    </div>
                    <div className="border border-muted rounded-xl p-4">
                      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><Briefcase className="w-3.5 h-3.5 text-primary" /> Service</div>
                      <p className="text-[13px] text-textPrimary leading-relaxed">{selected.service_to_discuss || 'Not recorded.'}</p>
                      <div className="text-[11px] text-textSecondary mt-2">Lead score: {selected.lead_score != null ? `${selected.lead_score}/100` : '—'}</div>
                    </div>
                  </div>

                  <div className="border border-muted rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><MessageSquare className="w-3.5 h-3.5 text-secondary" /> Recommended talking points</div>
                    <p className="text-[13px] text-textPrimary leading-relaxed whitespace-pre-line">{selected.key_discussion_points || 'Not recorded.'}</p>
                  </div>

                  {selected.objections_expected && (
                    <div className="border border-muted rounded-xl p-4">
                      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><AlertTriangle className="w-3.5 h-3.5 text-danger" /> Likely objections</div>
                      <p className="text-[13px] text-textPrimary leading-relaxed">{selected.objections_expected}</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={() => props.onSelectLead(selected.lead_id)}
                      className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary hover:text-blue-400"
                    >
                      Open full lead file — evidence, people & history <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}