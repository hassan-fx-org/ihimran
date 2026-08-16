import { useState } from 'react';
import {
  ArrowLeft, Globe, Target, AlertTriangle, Users, Briefcase,
  RefreshCw, Zap, Clock, Calendar, Send, Wand2, FileSearch,
  PhoneCall, Pause, Play, Ban, History, ExternalLink
} from 'lucide-react';
import { Card, Button, Chip, ScoreBar, StageBadge, Tabs, Notice, ConfirmModal, Collapsible, cx } from './ui';

type Tab = 'overview' | 'evidence' | 'people' | 'service' | 'outreach' | 'history';

export function LeadDetail(props: {
  lead: any;
  loading: boolean;
  integrations: { email: boolean; calendar: boolean; search: boolean; llm: boolean };
  isDemo: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onRunResearch: () => void;
  onMatchService: () => void;
  onGetDecisionMakers: () => void;
  onGenerateOutreach: () => void;
  onSendOutreach: () => void;
  onSimulateReply: (text: string) => void;
  onTriggerFollowUp: () => void;
  onPauseFollowUp: (days: number) => void;
  onResumeFollowUp: () => void;
  onCancelFollowUp: (reason: string) => void;
  onSetDnc: (value: boolean, reason?: string) => void;
}) {
  const l = props.lead;
  const [tab, setTab] = useState<Tab>('overview');
  const [replyText, setReplyText] = useState("Hi team, yes we are interested. Let's meet this week to discuss.");
  const [pauseDays, setPauseDays] = useState(7);
  const [cancelReason, setCancelReason] = useState('');
  const [dncOpen, setDncOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const evidence = l.evidence || [];
  const dms = l.decision_makers || [];
  const services = l.service_matches || [];
  const fu = l.follow_up;
  const sent = l.outreach_message;
  const draft = l.outreach_draft;
  const meeting = (l.meetings || [])[0];

  const nextActionLabel =
    (l.next_action || '') ||
    (l.recommended_service ? `Promote ${l.recommended_service}` : 'Research this lead') ||
    'Review this lead';

  const hasResearch = evidence.length > 0 || l.deep_research?.qualification_notes;
  const hasService = services.length > 0 || l.recommended_service;
  const hasDms = dms.length > 0;
  const hasDraft = !!draft;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <button onClick={props.onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-textSecondary hover:text-textPrimary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to leads
      </button>

      {/* HEADER */}
      <div className="bg-surface border border-muted rounded-2xl p-6 mb-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-textPrimary tracking-tight">{l.name}</h1>
              {(l.source || l._source) === 'demo' && <Chip tone="warning" className="text-[10px]">Demo dataset</Chip>}
              <StageBadge stage={l.stage} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[13px] text-textSecondary">
              {l.website && (
                <a href={l.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:text-blue-400">
                  <Globe className="w-3.5 h-3.5" /> {l.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              {l.industry && <span>{l.industry}</span>}
              {l.location && <span>{l.location}</span>}
              {l.size && l.size !== 'Unknown' && <span>{l.size}</span>}
            </div>
          </div>

          <div className="flex items-center gap-8 shrink-0">
            <div className="w-40">
              <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-2">Lead score</div>
              <ScoreBar value={l.confidence_score || 0} />
              <div className="text-[11px] text-textSecondary mt-1.5 truncate">{l.qualification_score != null ? `${l.qualification_score}/100 fit` : 'Not qualified yet'}</div>
            </div>
            <div className="max-w-[260px]">
              <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-2">What to do next</div>
              <div className="text-[13px] text-textPrimary font-medium leading-snug flex items-start gap-2">
                <Zap className="w-4 h-4 text-warning shrink-0 mt-0.5" /> {nextActionLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-muted">
          <Button onClick={props.onRunResearch} loading={props.loading && !hasResearch} variant={hasResearch ? 'secondary' : 'primary'}>
            <FileSearch className="w-4 h-4" /> {hasResearch ? 'Re-run Research' : 'Research Lead'}
          </Button>
          <Button onClick={props.onMatchService} loading={props.loading && !hasService} variant={hasService ? 'secondary' : 'primary'}>
            <Briefcase className="w-4 h-4" /> {hasService ? 'Re-match Service' : 'Match Service'}
          </Button>
          <Button onClick={props.onGetDecisionMakers} loading={props.loading && !hasDms} variant={hasDms ? 'secondary' : 'primary'}>
            <Users className="w-4 h-4" /> {hasDms ? 'Refresh People' : 'Find Decision Makers'}
          </Button>
          <Button onClick={props.onGenerateOutreach} loading={props.loading && !hasDraft} variant={hasDraft ? 'secondary' : 'primary'}>
            <Wand2 className="w-4 h-4" /> {hasDraft ? 'Regenerate Message' : 'Write Outreach Message'}
          </Button>
          <Button variant="ghost" onClick={props.onRefresh} disabled={props.loading} title="Refresh data">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="flex-1" />
          {!l.do_not_contact ? (
            <Button variant="ghost" onClick={() => setDncOpen(true)} disabled={props.loading} className="text-red-300 hover:text-red-200">
              <Ban className="w-4 h-4" /> Mark do not contact
            </Button>
          ) : (
            <Chip tone="danger">Do not contact</Chip>
          )}
        </div>
      </div>

      <Tabs
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'evidence', label: 'Evidence', count: l.evidence_count },
          { id: 'people', label: 'People', count: dms.length },
          { id: 'service', label: 'Recommended service', count: services.length },
          { id: 'outreach', label: 'Outreach' },
          { id: 'history', label: 'History' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as Tab)}
      />

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Why this lead">
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><Target className="w-3.5 h-3.5 text-primary" /> Why it fits your target profile</div>
                <p className="text-[13px] text-textPrimary leading-relaxed">{l.score_explanation || l.deep_research?.qualification_notes || 'Not evaluated yet — run research to qualify this lead.'}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><AlertTriangle className="w-3.5 h-3.5 text-warning" /> Problem detected</div>
                <p className="text-[13px] text-textPrimary leading-relaxed">{l.deep_research?.pain_points || 'Not analyzed yet.'}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><Zap className="w-3.5 h-3.5 text-secondary" /> Buying signals</div>
                <p className="text-[13px] text-textPrimary leading-relaxed">{l.deep_research?.intent_signals || 'No signals collected yet.'}</p>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card title="Status & follow-up">
              <div className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-[13px] text-textSecondary">Pipeline stage</span><StageBadge stage={l.stage} /></div>
                <div className="flex items-center justify-between"><span className="text-[13px] text-textSecondary">Current next step</span><span className="text-[13px] font-medium text-textPrimary text-right max-w-[60%]">{nextActionLabel}</span></div>
                {fu ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-textSecondary">Follow-up #{fu.sequence_step}</span>
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-textPrimary">
                      {fu.paused ? <Pause className="w-3.5 h-3.5 text-warning" /> : <Clock className="w-3.5 h-3.5 text-textSecondary" />}
                      {fu.paused ? 'Paused' : fu.days_until === 0 ? 'Due today' : `Due in ${fu.days_until} day${fu.days_until === 1 ? '' : 's'}`}
                    </span>
                  </div>
                ) : (
                  <div className="text-[12px] text-textSecondary">No pending follow-up.</div>
                )}
                {meeting && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-textSecondary">Meeting</span>
                    <span className="text-[13px] font-medium text-textPrimary flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {new Date(meeting.meeting_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <Card title="Recommended next action">
              {hasService || hasDraft ? (
                <div className="space-y-3 text-[13px] text-textPrimary leading-relaxed">
                  <p>Your AI has prepared the next step. Review the evidence, then send the outreach message or follow up with the decision maker.</p>
                  <div className="flex gap-2">
                    <Button onClick={() => setTab('evidence')} variant="secondary"><FileSearch className="w-4 h-4" /> Review evidence</Button>
                    {hasDraft && <Button onClick={() => setTab('outreach')}><Send className="w-4 h-4" /> Go to outreach</Button>}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-[13px] text-textPrimary leading-relaxed">
                  <p>This lead needs a few automated steps before you can reach out. Let your AI do the groundwork:</p>
                  <div className="space-y-2">
                    {!hasResearch && <Button variant="secondary" onClick={props.onRunResearch} loading={props.loading}><FileSearch className="w-4 h-4" /> Step 1 · Research & qualify this company</Button>}
                    {hasResearch && !hasService && <Button variant="secondary" onClick={props.onMatchService} loading={props.loading}><Briefcase className="w-4 h-4" /> Step 2 · Match a service from your knowledge</Button>}
                    {hasResearch && hasService && !hasDms && <Button variant="secondary" onClick={props.onGetDecisionMakers} loading={props.loading}><Users className="w-4 h-4" /> Step 3 · Find the decision maker</Button>}
                    {hasResearch && hasService && hasDms && !hasDraft && <Button onClick={props.onGenerateOutreach} loading={props.loading}><Wand2 className="w-4 h-4" /> Step 4 · Write the outreach message</Button>}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'evidence' && (
        <Card>
          {evidence.length === 0 ? (
            <div className="text-[13px] text-textSecondary py-4">
              No research evidence yet. Run <span className="text-textPrimary font-medium">Research Lead</span> to gather real signals about this company (funding, hiring, tech stack, and problems).
            </div>
          ) : (
            <div className="space-y-3">
              {evidence.map((e: any) => (
                <div key={e.id} className="border border-muted rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {e.title && <div className="text-[13px] font-semibold text-textPrimary">{e.title}</div>}
                      <p className="text-[13px] text-textSecondary leading-relaxed mt-1">{e.content}</p>
                    </div>
                    {e.relevance && <Chip tone="ai" className="shrink-0">{e.relevance}</Chip>}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-muted/50">
                    <span className="text-[11px] uppercase tracking-wide text-textSecondary">Source · {e.source || 'unknown'}</span>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-primary hover:text-blue-400 flex items-center gap-1">
                        View source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'people' && (
        <Card>
          {dms.length === 0 ? (
            <div className="text-[13px] text-textSecondary py-4">
              No contacts identified yet. Run <span className="text-textPrimary font-medium">Find Decision Makers</span> to discover who to reach out to at this company.
            </div>
          ) : (
            <div className="space-y-3">
              {dms.map((p: any) => (
                <div key={p.id} className="flex items-center gap-4 border border-muted rounded-xl p-4">
                  <div className="w-10 h-10 rounded-full bg-primary/[0.12] border border-primary/25 flex items-center justify-center text-[15px] font-bold text-primary shrink-0">
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-textPrimary">{p.name}</span>
                      {p.is_primary && <Chip tone="primary" className="text-[10px]">Primary</Chip>}
                    </div>
                    <div className="text-[12px] text-textSecondary">{p.role || 'Role unknown'}</div>
                  </div>
                  <div className="hidden md:block w-32 shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-textSecondary mb-1">Contact confidence</div>
                    <ScoreBar value={p.email_confidence_score || 0} />
                  </div>
                  <span className="text-[12px] text-textSecondary shrink-0 max-w-[220px] truncate">{p.email || 'Email not available'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'service' && (
        <Card>
          {services.length === 0 && !l.recommended_service ? (
            <div className="text-[13px] text-textSecondary py-4">
              No service matched yet. Run <span className="text-textPrimary font-medium">Match Service</span> to pick the best offering for this company from your knowledge base.
            </div>
          ) : (
            <div className="space-y-3">
              {(services.length ? services : [{ id: 'preview', service_name: l.recommended_service, rationale: l.service_rationale, confidence_score: null }]).map((s: any) => (
                <div key={s.id} className="border border-muted rounded-xl p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[15px] font-bold text-textPrimary">{s.service_name || 'Recommended service'}</div>
                    {s.confidence_score != null && <Chip tone="ai">{(s.confidence_score * 100).toFixed(0)}% match</Chip>}
                  </div>
                  <p className="text-[13px] text-textSecondary leading-relaxed mt-2">{s.rationale || 'Why this fits this company.'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'outreach' && (
        <div className="space-y-6">
          {!props.integrations.email && (
            <Notice tone="warning">
              <strong className="font-semibold">Email provider is not connected.</strong> Messages will be saved as drafts and marked as <em>not sent</em> so nothing fake reaches the world. Connect an email provider in Settings to send real messages.
            </Notice>
          )}
          {sent && sent.status === 'failed' && (
            <Notice tone="danger">
              <strong className="font-semibold">Last send failed.</strong> Provider returned: {sent.provider_status}. Check your email provider configuration in Settings and try again.
            </Notice>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            <Card title="Draft message">
              {!draft ? (
                <div className="text-[13px] text-textSecondary">
                  No draft yet. <button className="text-primary font-medium hover:underline" onClick={props.onGenerateOutreach}>Write an outreach message</button> grounded in this company's evidence and your knowledge.
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-1.5">To</div>
                    <div className="text-[13px] font-medium text-textPrimary">{draft.recipient || 'Recipient'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-1.5">Subject</div>
                    <div className="text-[13px] font-medium text-textPrimary">{draft.subject}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-1.5">Message</div>
                    <div className="text-[13px] text-textPrimary leading-relaxed whitespace-pre-wrap bg-elevated border border-muted rounded-lg p-3">{draft.body}</div>
                  </div>
                  <div className="text-[11px] text-textSecondary italic">{draft.grounded_in}</div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button onClick={props.onGenerateOutreach} loading={props.loading} variant="secondary"><Wand2 className="w-4 h-4" /> Regenerate</Button>
                    <Button onClick={props.onSendOutreach} loading={props.loading}><Send className="w-4 h-4" /> Approve & Send</Button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Prospect response">
              <div className="space-y-3">
                <p className="text-[13px] text-textSecondary leading-relaxed">When the prospect replies, paste or enter their message here. The AI classifies intent (meeting request, objection, more info…) and reacts automatically.</p>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/50 resize-none"
                />
                <div className="flex gap-2">
                  <Button onClick={() => props.onSimulateReply(replyText)} loading={props.loading} variant="secondary"><Zap className="w-4 h-4" /> Analyze reply</Button>
                  <Button onClick={props.onTriggerFollowUp} loading={props.loading} variant="secondary"><PhoneCall className="w-4 h-4" /> Send follow-up</Button>
                </div>
              </div>
            </Card>

            <Card title="Follow-up controls">
              {fu ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-textSecondary">Follow-up #{fu.sequence_step}</span>
                    <span className={cx('font-medium', fu.paused ? 'text-warning' : 'text-textPrimary')}>{fu.paused ? 'Paused' : `Due in ${fu.days_until} day${fu.days_until === 1 ? '' : 's'}`}</span>
                  </div>
                  {!fu.paused ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={90} value={pauseDays} onChange={(e) => setPauseDays(Number(e.target.value))} className="w-20 px-2 py-1.5 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary" />
                        <Button onClick={() => props.onPauseFollowUp(pauseDays)} loading={props.loading} variant="secondary"><Pause className="w-4 h-4" /> Pause</Button>
                      </div>
                      <Button onClick={props.onTriggerFollowUp} loading={props.loading} variant="secondary"><Send className="w-4 h-4" /> Send now</Button>
                    </div>
                  ) : (
                    <Button onClick={props.onResumeFollowUp} loading={props.loading} variant="secondary"><Play className="w-4 h-4" /> Resume</Button>
                  )}
                  <Button onClick={() => setCancelOpen(true)} variant="ghost" className="text-red-300 hover:text-red-200"><Ban className="w-4 h-4" /> Cancel follow-up</Button>
                </div>
              ) : (
                <div className="text-[13px] text-textSecondary">No follow-up scheduled. Follow-ups are created automatically after outreach is sent.</div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-6">
          <Card title="Activity timeline">
            {(l.activity || []).length === 0 ? (
              <div className="text-[13px] text-textSecondary">No activity yet.</div>
            ) : (
              <div className="space-y-3">
                {(l.activity || []).map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                    <div>
                      <div className="text-[13px] text-textPrimary leading-relaxed">{a.notes || a.event_type}</div>
                      <div className="text-[11px] text-textSecondary mt-0.5">{new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Collapsible title="Pipeline history" icon={<History className="w-4 h-4 text-textSecondary" />}>
            <div className="space-y-2">
              {(l.pipeline_events || []).map((e: any) => (
                <div key={e.id} className="flex items-start gap-3 text-[13px]">
                  <StageBadge stage={e.to_stage || e.stage} compact />
                  <div className="min-w-0">
                    <div className="text-textSecondary leading-relaxed">{e.reason || e.notes || ''}</div>
                    <div className="text-[11px] text-textSecondary/70">{new Date(e.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>

          {(l.memories || []).length > 0 && (
            <Collapsible title="AI memory" icon={<History className="w-4 h-4 text-textSecondary" />} defaultOpen={false}>
              <div className="space-y-2">
                {(l.memories || []).map((m: any) => (
                  <div key={m.id} className="text-[13px] text-textSecondary leading-relaxed"><span className="text-textPrimary font-medium capitalize">{m.category || m.type}:</span> {m.content}</div>
                ))}
              </div>
            </Collapsible>
          )}
        </div>
      )}

      <ConfirmModal
        open={dncOpen}
        title="Mark as do not contact"
        body="This removes the lead from active outreach and prevents any future messages. You can reverse this later."
        confirmLabel="Mark do not contact"
        danger
        onConfirm={() => { props.onSetDnc(true, 'Marked by admin'); setDncOpen(false); }}
        onCancel={() => setDncOpen(false)}
      />
      <ConfirmModal
        open={cancelOpen}
        title="Cancel follow-up"
        confirmLabel="Cancel follow-up"
        danger
        onConfirm={() => { props.onCancelFollowUp(cancelReason); setCancelOpen(false); }}
        onCancel={() => setCancelOpen(false)}
      >
        <div className="space-y-2">
          <label className="block text-[13px] text-textSecondary">Reason (optional)</label>
          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Meeting already booked" className="w-full px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/50" />
        </div>
      </ConfirmModal>
    </div>
  );
}