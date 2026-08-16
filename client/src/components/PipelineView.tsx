import { useState } from 'react';
import { Zap } from 'lucide-react';
import { PageHeader, ConfirmModal, cx } from './ui';

const COLUMNS = [
  { id: 'discovered', title: 'Discovered', target: 'Discovered', include: ['Discovered', 'Potential', 'Researching', 'Identified'], hint: 'New leads found by AI' },
  { id: 'qualified', title: 'Qualified', target: 'Qualified', include: ['Qualified'], hint: 'Researched & fit your profile' },
  { id: 'contacted', title: 'Contacted', target: 'Contacted', include: ['Contacted'], hint: 'First outreach sent' },
  { id: 'interested', title: 'Interested', target: 'Interested', include: ['Interested'], hint: 'Prospect engaged' },
  { id: 'meeting', title: 'Meeting', target: 'Meeting Scheduled', include: ['Meeting Scheduled', 'Meeting Booked', 'Evaluation'], hint: 'Call booked' },
  { id: 'converted', title: 'Converted', target: 'Converted', include: ['Won', 'Converted'], hint: 'Deal won' },
];

const CLOSED = { id: 'closed', title: 'Closed', include: ['Not Qualified', 'Not Interested', 'Do Not Contact', 'Lost', 'Dead'], hint: 'Not pursuing' };

export function PipelineView(props: {
  leadsList: any[];
  onSelectLead: (id: string) => void;
  onMoveStage: (stage: string, leadId: string, reason?: string, confirmed?: boolean) => Promise<any>;
}) {
  const [pending, setPending] = useState<{ leadId: string; stage: string; reason: string } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDrop = async (leadId: string, target: string, title: string) => {
    setDragOver(null);
    setMoving(leadId);
    const res = await props.onMoveStage(target, leadId, `Moved to ${title}`);
    setMoving(null);
    if (res?.needsConfirmation) {
      setPending({ leadId, stage: target, reason: res.reason || `Confirm moving this lead to ${title}.` });
    }
  };

  const confirmMove = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    setMoving(p.leadId);
    await props.onMoveStage(p.stage, p.leadId, 'Manual override confirmed', true);
    setMoving(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Pipeline"
        title="Sales pipeline"
        subtitle="Every lead, from discovery to converted. Drag a card to move it — your AI records the reason and keeps the rest of the workflow in sync. No internal agent details shown here."
      />

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map((col) => {
          const items = props.leadsList.filter((l) => col.include.includes(l.stage));
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) handleDrop(id, col.target, col.title);
              }}
              className={cx(
                'w-64 shrink-0 flex flex-col bg-surface border rounded-2xl transition-colors',
                dragOver === col.id ? 'border-primary/60' : 'border-muted'
              )}
            >
              <div className="px-4 py-3 border-b border-muted flex items-center justify-between">
                <div className="text-[13px] font-semibold text-textPrimary">{col.title}</div>
                <span className="px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[11px] text-textSecondary tabular-nums">{items.length}</span>
              </div>
              <div className="p-3 space-y-2.5 flex-1">
                {items.length === 0 && (
                  <div className="text-center text-[11px] text-textSecondary/70 py-4 border border-dashed border-muted rounded-lg">{col.hint}</div>
                )}
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onClick={() => props.onSelectLead(l.id)}
                    className={cx(
                      'bg-elevated border border-muted rounded-xl p-3.5 cursor-pointer hover:border-primary/40 transition-colors select-none',
                      moving === l.id && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-textPrimary leading-snug">{l.name}</span>
                      <span className="text-[12px] font-bold text-textSecondary tabular-nums shrink-0">{l.confidence_score || 0}</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-[11px] text-textSecondary truncate">{l.recommended_service || 'Service not matched'}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-textSecondary leading-snug min-h-[15px]">
                      <Zap className="w-3 h-3 text-warning shrink-0" />
                      <span className="truncate">{l.next_action || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Closed column */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(CLOSED.id); }}
          onDragLeave={() => setDragOver((d) => (d === CLOSED.id ? null : d))}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            if (id) handleDrop(id, 'Not Interested', CLOSED.title);
          }}
          className={cx(
            'w-60 shrink-0 flex flex-col bg-surface border rounded-2xl transition-colors',
            dragOver === CLOSED.id ? 'border-danger/60' : 'border-muted'
          )}
        >
          <div className="px-4 py-3 border-b border-muted flex items-center justify-between">
            <div className="text-[13px] font-semibold text-textSecondary">{CLOSED.title}</div>
            <span className="px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[11px] text-textSecondary tabular-nums">
              {props.leadsList.filter((l) => CLOSED.include.includes(l.stage)).length}
            </span>
          </div>
          <div className="p-3 space-y-2.5 flex-1">
            <div className="text-center text-[11px] text-textSecondary/70 py-4 border border-dashed border-muted rounded-lg">{CLOSED.hint}</div>
            {props.leadsList.filter((l) => CLOSED.include.includes(l.stage)).map((l) => (
              <div
                key={l.id}
                onClick={() => props.onSelectLead(l.id)}
                className="bg-elevated border border-muted rounded-xl p-3.5 cursor-pointer hover:border-danger/40 transition-colors select-none"
              >
                <div className="text-[13px] font-semibold text-textPrimary">{l.name}</div>
                <div className="text-[11px] text-textSecondary mt-1 truncate">{l.stage}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pending}
        title="Move this lead?"
        body={pending?.reason}
        confirmLabel="Move anyway"
        danger={pending?.stage === 'Do Not Contact'}
        onConfirm={confirmMove}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}