import { useEffect, useState } from 'react';
import { Wand2, Send, Save, ChevronRight, Sparkles, Info, CheckCircle2, User } from 'lucide-react';
import { PageHeader, Card, Button, Notice, Chip, EmptyState, cx, Avatar } from './ui';

export function OutreachView(props: {
  leadsList: any[];
  selectedLead: any;
  onSelectLead: (id: string) => void;
  integrations: { email: boolean; calendar: boolean; search: boolean; llm: boolean };
  replyInput: string;
  setReplyInput: (v: string) => void;
  onGenerate: (id: string, contactId?: string) => void;
  onSend: (id: string, messageId?: string, subject?: string, body?: string) => void;
  onRegenerate: (id: string, contactId?: string) => void;
  onSaveDraft: (id: string, messageId: string, subject: string, body: string) => void;
  onSimulateReply: (id: string, text?: string) => void;
}) {
  const lead = props.selectedLead;
  const draft = lead?.outreach_draft;
  const sent = lead?.outreach_message;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSubject(draft?.subject || '');
    setBody(draft?.body || '');
    setSaved(false);
  }, [lead?.id, draft?.id]);

  const primaryContact = (lead?.decision_makers || []).find((d: any) => d.is_primary) || (lead?.decision_makers || [])[0];

  const editable = !!draft;
  const evidence = (lead?.evidence || []).slice(0, 3);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Outreach"
        title="Outreach"
        subtitle="A professional email workspace. Pick a lead, review why the message matters, then edit, save, and send — or let the AI classify their reply for you."
      />

      <div className="grid lg:grid-cols-[260px_1fr_320px] gap-6">
        {/* LEFT: lead picker */}
        <Card title="Select a lead" className="lg:row-span-2 h-fit">
          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
            {props.leadsList.filter((l) => !['Not Qualified', 'Not Interested', 'Do Not Contact'].includes(l.stage)).length === 0 && (
              <div className="text-[12px] text-textSecondary">No active leads yet. Run a discovery first.</div>
            )}
            {props.leadsList
              .filter((l) => !['Not Qualified', 'Not Interested', 'Do Not Contact'].includes(l.stage))
              .map((l) => {
                const active = lead?.id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => props.onSelectLead(l.id)}
                    className={cx(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-colors border',
                      active ? 'bg-primary/[0.1] border-primary/30' : 'border-transparent hover:bg-white/[0.03]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cx('text-[13px] font-semibold truncate', active ? 'text-primary' : 'text-textPrimary')}>{l.name}</span>
                      <ChevronRight className={cx('w-3.5 h-3.5 shrink-0', active ? 'text-primary' : 'text-textSecondary')} />
                    </div>
                    <div className="text-[11px] text-textSecondary truncate mt-0.5">{l.recommended_service || '—'}</div>
                  </button>
                );
              })}
          </div>

          {lead && primaryContact && (
            <div className="mt-4 pt-4 border-t border-muted space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-textSecondary">Contact</div>
              <div className="flex items-start gap-2.5">
                <Avatar name={primaryContact.name} size="md" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-textPrimary truncate">{primaryContact.name}</div>
                  <div className="text-[11px] text-textSecondary">{primaryContact.role || 'Role unknown'}</div>
                  <div className="text-[11px] text-textSecondary truncate mt-0.5">{primaryContact.email || 'No email on file'}</div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* CENTER: composer */}
        <div className="space-y-4">
          {!lead ? (
            <EmptyState title="Choose a lead" message="Select a company from the left to open its outreach workspace." />
          ) : (
            <>
              {!props.integrations.email && (
                <Notice tone="warning">
                  <strong className="font-semibold">Email provider is not connected.</strong> You can prepare and save messages, but nothing will be actually sent until you connect an email provider in Settings.
                </Notice>
              )}
              {sent && sent.status === 'failed' && (
                <Notice tone="danger"><strong className="font-semibold">Last send failed.</strong> Provider returned: {sent.provider_status}. Fix your email provider in Settings and send again.</Notice>
              )}
              {sent && sent.status === 'sent' && (
                <Notice tone="success"><strong className="font-semibold">Sent.</strong> Dispatched via {sent.provider_status} on {new Date(sent.sent_at).toLocaleString()}.</Notice>
              )}

              <Card title={editable ? 'Compose message' : 'Message'}>
                {!editable ? (
                  <div className="space-y-4">
                    <div className="text-[13px] text-textSecondary leading-relaxed">
                      No outreach message for this lead yet. Your AI drafts it from this company's evidence and your knowledge base — grounded, personalized, ready for your review.
                    </div>
                    <Button onClick={() => props.onGenerate(lead.id, primaryContact?.id)} loading={false}>
                      <Wand2 className="w-4 h-4" /> Generate message
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-1.5">To</div>
                      <div className="text-[13px] font-medium text-textPrimary">{draft.recipient || 'Recipient'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-1.5">Subject</div>
                      <input value={subject} onChange={(e) => { setSubject(e.target.value); setSaved(false); }} className="w-full px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-textSecondary mb-1.5">Message</div>
                      <textarea value={body} onChange={(e) => { setBody(e.target.value); setSaved(false); }} rows={14} className="w-full px-3 py-2.5 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all resize-none leading-relaxed" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-textSecondary">{saved && <Chip tone="success">Saved</Chip>}{draft.grounded_in}</div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button variant="secondary" onClick={() => props.onSaveDraft(lead.id, draft.id, subject, body)}><Save className="w-4 h-4" /> Save draft</Button>
                      <Button variant="secondary" onClick={() => props.onRegenerate(lead.id, primaryContact?.id)}><Wand2 className="w-4 h-4" /> Regenerate</Button>
                      <Button onClick={() => props.onSend(lead.id, draft.id, subject, body)}><Send className="w-4 h-4" /> Approve & Send</Button>
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Prospect replies">
                <p className="text-[13px] text-textSecondary leading-relaxed mb-3">Paste the prospect's reply here and let the AI classify it — meeting request, objection, or something else — then it reacts accordingly.</p>
                <textarea
                  value={props.replyInput}
                  onChange={(e) => props.setReplyInput(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all resize-none"
                />
                <div className="mt-3">
                  <Button variant="secondary" onClick={() => props.onSimulateReply(lead.id, props.replyInput)}>
                    <Sparkles className="w-4 h-4" /> Analyze reply
                  </Button>
                </div>
                {(lead.inbound_responses || []).length > 0 && (
                  <div className="mt-5 pt-4 border-t border-muted space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-textSecondary">Past responses</div>
                    {(lead.inbound_responses || []).slice(-3).map((r: any) => (
                      <div key={r.id} className="border border-muted rounded-lg p-3">
                        <div className="text-[12px] text-textPrimary leading-relaxed line-clamp-2">{r.body}</div>
                        <div className="flex items-center justify-between mt-2">
                          <Chip tone={r.classification === 'Meeting Requested' ? 'success' : 'primary'} className="text-[10px]">{r.classification || 'Unclassified'}</Chip>
                          <span className="text-[10px] text-textSecondary">{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        {/* RIGHT: why this message */}
        <Card title="Why this message">
          {!lead ? (
            <div className="text-[12px] text-textSecondary">Select a lead to see the reasoning behind its outreach message.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><Sparkles className="w-3.5 h-3.5 text-secondary" /> Grounded in</div>
                <div className="text-[13px] text-textPrimary leading-relaxed">{draft?.grounded_in || 'Company knowledge + research evidence'}</div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><Info className="w-3.5 h-3.5 text-primary" /> Evidence used</div>
                {evidence.length === 0 ? (
                  <div className="text-[13px] text-textSecondary">No research evidence yet — run research on this lead for a stronger message.</div>
                ) : (
                  <div className="space-y-2.5">
                    {evidence.map((e: any) => (
                      <div key={e.id} className="border border-muted rounded-lg p-3">
                        <div className="text-[12px] text-textPrimary leading-relaxed line-clamp-2">{e.content}</div>
                        <div className="text-[10px] text-textSecondary mt-1.5 uppercase tracking-wide">Source · {e.source || 'unknown'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-2"><User className="w-3.5 h-3.5 text-warning" /> Persona</div>
                <div className="text-[13px] text-textPrimary leading-relaxed">
                  Written for {primaryContact?.name || 'the decision maker'} ({primaryContact?.role || 'role unknown'}), focusing on the problem this company likely faces: {lead.deep_research?.pain_points || 'not yet analyzed'}.
                </div>
              </div>
              {lead.recommended_service && (
                <div className="flex items-center gap-2 text-[12px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="text-textPrimary">Promotes your service: <strong>{lead.recommended_service}</strong></span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}