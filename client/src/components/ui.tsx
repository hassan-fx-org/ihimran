import React from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

export const cx = (...cls: (string | false | undefined | null)[]) => cls.filter(Boolean).join(' ');

// ---------- Stage styling ----------
export const STAGE_COLORS: Record<string, string> = {
  Discovered: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  Potential: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  Researching: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  Qualified: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  Contacted: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  Interested: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
  'Meeting Scheduled': 'bg-purple-500/10 text-purple-300 border-purple-500/25',
  'Meeting Booked': 'bg-purple-500/10 text-purple-300 border-purple-500/25',
  Evaluation: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
  Negotiation: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
  Won: 'bg-green-500/15 text-green-300 border-green-500/30',
  Converted: 'bg-green-500/15 text-green-300 border-green-500/30',
  Identified: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  Lost: 'bg-red-500/10 text-red-300 border-red-500/25',
  Dead: 'bg-red-600/15 text-red-200 border-red-600/30',
  'Not Qualified': 'bg-red-500/10 text-red-300 border-red-500/25',
  'Not Interested': 'bg-red-500/10 text-red-300 border-red-500/25',
  'Do Not Contact': 'bg-red-600/15 text-red-200 border-red-600/30',
};

export const STAGE_HEX: Record<string, string> = {
  Discovered: '#64748B',
  Potential: '#38BDF8',
  Researching: '#38BDF8',
  Qualified: '#10B981',
  Contacted: '#F59E0B',
  Interested: '#8B5CF6',
  'Meeting Scheduled': '#A855F7',
  'Meeting Booked': '#A855F7',
  Evaluation: '#06B6D4',
  Negotiation: '#F97316',
  Won: '#22C55E',
  Converted: '#22C55E',
  Identified: '#38BDF8',
  Lost: '#EF4444',
  Dead: '#DC2626',
  'Not Qualified': '#EF4444',
  'Not Interested': '#EF4444',
  'Do Not Contact': '#DC2626',
};

export function StageBadge({ stage, compact }: { stage: string; compact?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md font-semibold border whitespace-nowrap',
        compact && 'px-1.5 py-0 text-[10px]',
        STAGE_COLORS[stage] || 'bg-white/[0.05] text-gray-300 border-white/[0.1]'
      )}
    >
      <span className="w-1 h-1 rounded-full bg-current opacity-60" />
      {stage}
    </span>
  );
}

// ---------- Layout ----------
export function Card({ children, className, title, actions, padded = true }: { children: React.ReactNode; className?: string; title?: React.ReactNode; actions?: React.ReactNode; padded?: boolean }) {
  return (
    <div className={cx('bg-surface border border-muted rounded-2xl shadow-card', padded && 'p-6', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="text-sm font-semibold text-textPrimary tracking-tight">{title}</div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary mb-2">{eyebrow}</div>}
        <h1 className="text-2xl md:text-[28px] font-bold text-textPrimary tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-textSecondary mt-2 leading-relaxed max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, message, description, cta, onCta, icon }: { title: string; message?: string; description?: string; cta?: string; onCta?: () => void; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-surface border border-dashed border-muted rounded-2xl space-y-2.5 animate-fade-in">
      {icon && <div className="w-12 h-12 rounded-2xl bg-primary/[0.08] border border-primary/20 flex items-center justify-center text-primary mb-1">{icon}</div>}
      <div className="text-[15px] font-semibold text-textPrimary">{title}</div>
      <div className="text-[13px] text-textSecondary max-w-md leading-relaxed">{message || description}</div>
      {cta && onCta && (
        <button onClick={onCta} className="mt-3 px-4 py-2 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-lg text-xs font-semibold transition-colors">
          {cta}
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-lg', className)} />;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 p-6 bg-surface border border-muted rounded-2xl animate-fade-in">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <div className="text-[13px] text-textSecondary">{label}</div>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 bg-danger/[0.08] border border-danger/30 rounded-xl animate-fade-in">
      <div className="text-[13px] text-red-200 leading-relaxed">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="px-3 py-1.5 text-xs bg-danger/20 hover:bg-danger/30 text-red-200 rounded-lg border border-danger/30 whitespace-nowrap">
          Retry
        </button>
      )}
    </div>
  );
}

export function SectionTitle({ icon, children, right }: { icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <h4 className="text-[13px] font-semibold text-textPrimary flex items-center gap-2">
        {icon}
        {children}
      </h4>
      {right}
    </div>
  );
}

// ---------- Controls ----------
export function Button({ children, onClick, disabled, variant = 'primary', loading, className, type = 'button', title, size = 'md', full }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
  title?: string;
  size?: 'sm' | 'md';
  full?: boolean;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none';
  const sizes = {
    sm: 'px-2.5 py-1.5 text-[12px]',
    md: 'px-4 py-2',
  };
  const variants = {
    primary: 'bg-primary hover:bg-blue-500 text-white shadow-glow',
    secondary: 'bg-white/[0.06] hover:bg-white/[0.1] text-textPrimary border border-muted hover:border-white/[0.15]',
    ghost: 'hover:bg-white/[0.05] text-textSecondary hover:text-textPrimary',
    danger: 'bg-danger/90 hover:bg-danger text-white',
  };
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled || loading} className={cx(base, sizes[size], variants[variant], full && 'w-full', className)}>
      {loading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({ children, onClick, label, className, disabled }: { children: React.ReactNode; onClick?: () => void; label: string; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-white/[0.06] border border-transparent hover:border-muted transition-all duration-150 active:scale-95 disabled:opacity-40',
        className
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative w-10 h-6 rounded-full transition-colors border shrink-0',
        checked ? 'bg-primary border-primary/50' : 'bg-white/[0.07] border-muted'
      )}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={cx(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow',
          checked && 'translate-x-4'
        )}
      />
    </button>
  );
}

export function Chip({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'ai'; className?: string }) {
  const tones = {
    neutral: 'bg-white/[0.05] text-textSecondary border-muted',
    success: 'bg-success/10 text-emerald-300 border-success/25',
    warning: 'bg-warning/10 text-amber-300 border-warning/25',
    danger: 'bg-danger/10 text-red-300 border-danger/25',
    primary: 'bg-primary/10 text-blue-300 border-primary/25',
    ai: 'bg-secondary/10 text-violet-300 border-secondary/25',
  };
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  const color = v >= 70 ? 'bg-success' : v >= 40 ? 'bg-warning' : 'bg-danger';
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
        <div className={cx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${v}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-textSecondary tabular-nums w-8 text-right">{v}</span>
    </div>
  );
}

export function MetricCard({ label, value, sub, icon, tone = 'neutral', accent }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'ai';
  accent?: boolean;
}) {
  const tones = {
    neutral: 'text-textSecondary',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    ai: 'text-secondary',
  };
  return (
    <div className={cx('bg-surface border border-muted rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 relative overflow-hidden', accent && 'shadow-card')}>
      {accent && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-textSecondary">{label}</span>
        {icon && <span className={cx(tones[tone])}>{icon}</span>}
      </div>
      <div className="text-[28px] font-bold text-textPrimary tracking-tight leading-none tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-textSecondary leading-relaxed">{sub}</div>}
    </div>
  );
}

export function Progress({ value, tone = 'primary', className }: { value: number; tone?: 'primary' | 'success' | 'warning' | 'danger'; className?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const tones = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };
  return (
    <div className={cx('h-1.5 bg-white/[0.07] rounded-full overflow-hidden', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', tones[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 'md', className }: { name?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'w-8 h-8 text-[12px]', md: 'w-10 h-10 text-[15px]', lg: 'w-14 h-14 text-lg' };
  return (
    <span className={cx('rounded-full bg-primary/[0.12] border border-primary/25 flex items-center justify-center font-bold text-primary shrink-0 select-none', sizes[size], className)}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

// ---------- Inputs ----------
export function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-textSecondary">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-textMuted leading-relaxed">{hint}</div>}
    </div>
  );
}

export const inputBase = 'w-full px-3.5 py-2.5 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all duration-150';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cx(inputBase, className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={cx(inputBase, 'resize-none leading-relaxed', className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={cx(inputBase, 'pr-8 appearance-none bg-no-repeat bg-[right_0.6rem_center] bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%2394A3B8%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M3 5l3 3 3-3%27/%3E%3C/svg%3E")]', className)}>
      {children}
    </select>
  );
}

// ---------- Disclosure / info ----------
export function Collapsible({ title, children, defaultOpen = false, icon, badge }: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="bg-surface border border-muted rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="flex items-center gap-2.5 text-[13px] font-semibold text-textPrimary">
          {icon}
          {title}
        </span>
        <span className="flex items-center gap-2.5">
          {badge}
          <svg className={cx('w-4 h-4 text-textSecondary transition-transform duration-200', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-muted/60 animate-fade-in">{children}</div>}
    </div>
  );
}

export function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-[12px] text-textSecondary shrink-0">{label}</span>
      <span className={cx('text-[12px] text-textPrimary text-right break-all', mono && 'font-mono')}>{value || '—'}</span>
    </div>
  );
}

export function Tabs({ items, active, onChange, right }: {
  items: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-muted mb-6">
      <div className="flex items-center gap-1 overflow-x-auto">
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cx(
              'px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors',
              active === t.id ? 'text-textPrimary border-primary' : 'text-textSecondary border-transparent hover:text-textPrimary'
            )}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className={cx('ml-2 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums', active === t.id ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-textSecondary')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ---------- Integration status ----------
export function IntegrationStatus({ name, connected, onClick, hint }: {
  name: string;
  connected: boolean;
  onClick?: () => void;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors',
        connected
          ? 'bg-success/[0.08] border-success/20 text-emerald-300'
          : 'bg-white/[0.03] border-muted text-textSecondary hover:bg-white/[0.06]',
        !onClick && 'cursor-default'
      )}
      title={hint}
    >
      <span className={cx('w-1.5 h-1.5 rounded-full', connected ? 'bg-success' : 'bg-warning')} />
      {name}
      <span className={cx('text-[10px] font-semibold uppercase tracking-wide', connected ? 'text-emerald-400/80' : 'text-warning/90')}>
        {connected ? 'On' : hint?.includes('Connect') ? 'Setup' : 'Off'}
      </span>
    </button>
  );
}

export function Notice({ tone = 'info', children, action, icon }: { tone?: 'info' | 'warning' | 'success' | 'danger'; children: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  const tones = {
    info: 'bg-primary/[0.06] border-primary/20 text-blue-200',
    warning: 'bg-warning/[0.07] border-warning/25 text-amber-200',
    success: 'bg-success/[0.07] border-success/25 text-emerald-200',
    danger: 'bg-danger/[0.08] border-danger/25 text-red-200',
  };
  return (
    <div className={cx('flex items-start justify-between gap-4 px-4 py-3.5 rounded-xl border text-[13px] leading-relaxed animate-fade-in', tones[tone])}>
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ---------- Tooltip ----------
export function Tooltip({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 px-2.5 py-1.5 bg-elevated border border-muted rounded-lg text-[11px] font-medium text-textPrimary whitespace-nowrap shadow-pop">
        {label}
      </span>
    </span>
  );
}

// ---------- Modal ----------
export function Modal({ open, title, onClose, children, width }: {
  open?: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className={cx('w-full bg-elevated border border-muted rounded-2xl p-6 space-y-4 shadow-pop animate-scale-in', width || 'max-w-md')} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-textPrimary">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, body, children, confirmLabel, danger, onConfirm, onClose, onCancel }: {
  open?: boolean;
  title: string;
  body?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose?: () => void;
  onCancel?: () => void;
}) {
  const cancel = onClose || onCancel || (() => {});
  return (
    <Modal open={open !== false} title={title} onClose={cancel}>
      {body ? <p className="text-[13px] text-textSecondary leading-relaxed">{body}</p> : children}
      <div className="flex justify-end gap-2.5 pt-2">
        <button onClick={cancel} className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-textSecondary rounded-lg text-[13px] font-semibold transition-colors">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={cx('px-4 py-2 text-white rounded-lg text-[13px] font-bold transition-colors', danger ? 'bg-danger hover:bg-red-500' : 'bg-primary hover:bg-blue-500')}
        >
          {confirmLabel || 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}

export function Drawer({ open, onClose, title, children, width, from = 'right' }: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
  from?: 'right' | 'left';
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className={cx('h-full bg-elevated border-muted shadow-2xl overflow-y-auto animate-slide-up', width || 'w-full max-w-xl', from === 'right' ? 'ml-auto border-l' : 'mr-auto border-r')} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-elevated/95 backdrop-blur border-b border-muted px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-sm font-bold text-textPrimary">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg text-textSecondary hover:text-textPrimary hover:bg-white/[0.06] transition-colors text-lg leading-none">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ---------- Dropdown ----------
export function Dropdown({ trigger, children, align = 'right' }: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer">
        {trigger}
      </button>
      {open && (
        <div className={cx('absolute top-full mt-2 z-50 min-w-[200px] bg-elevated border border-muted rounded-xl shadow-pop overflow-hidden animate-scale-in', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ---------- Toasts ----------
type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

const ToastContext = createContext<(kind: ToastKind, title: string, message?: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, kind, title, message }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismiss = (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 w-[min(92vw,380px)]" aria-live="polite" role="region">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-pop animate-toast-in cursor-pointer select-none',
              t.kind === 'success' && 'bg-[#101B12] border-success/30',
              t.kind === 'error' && 'bg-[#1B1012] border-danger/30',
              t.kind === 'warning' && 'bg-[#1B1609] border-warning/30',
              t.kind === 'info' && 'bg-[#0E1420] border-primary/30'
            )}
            onClick={() => dismiss(t.id)}
          >
            <span className={cx('mt-0.5 w-2 h-2 rounded-full shrink-0', t.kind === 'success' && 'bg-success', t.kind === 'error' && 'bg-danger', t.kind === 'warning' && 'bg-warning', t.kind === 'info' && 'bg-primary')} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-textPrimary">{t.title}</div>
              {t.message && <div className="text-[12px] text-textSecondary leading-relaxed mt-0.5">{t.message}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- Stepper ----------
export function Stepper({ steps, current }: { steps: Array<{ key: string; label: string }>; current: number }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s.key} className={cx(
            'flex items-center gap-2.5 text-[12px] px-3 py-2 rounded-lg border transition-colors',
            state === 'done' && 'border-success/25 bg-success/[0.05] text-emerald-300',
            state === 'current' && 'border-primary/30 bg-primary/[0.05] text-blue-200',
            state === 'todo' && 'border-muted text-textSecondary'
          )}>
            {state === 'done' ? (
              <span className="w-3.5 h-3.5 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                <svg className="w-2.5 h-2.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
            ) : state === 'current' ? (
              <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full border border-muted shrink-0" />
            )}
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Status pill (header) ----------
export function StatusPill({ label, connected, subtle }: { label: string; connected: boolean; subtle?: boolean }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-lg border text-[11px] font-medium px-2.5 py-1.5 transition-colors',
      connected ? 'bg-success/[0.08] border-success/20 text-emerald-300' : 'bg-warning/[0.08] border-warning/25 text-amber-300',
      subtle && 'hidden lg:inline-flex'
    )}>
      <span className={cx('w-1.5 h-1.5 rounded-full', connected ? 'bg-success' : 'bg-warning')} />
      {label}
    </span>
  );
}