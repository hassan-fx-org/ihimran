import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  Sparkles,
  Database,
  RefreshCw,
  Boxes,
  Target,
  Award,
  Wrench,
  AlertTriangle,
  BadgeDollarSign,
  X,
  Eye,
  Trash2,
  RotateCw,
  BookOpen,
  Loader2,
  FileWarning,
  Search
} from 'lucide-react';
import { PageHeader, Card, Button, Notice, Chip, Collapsible, cx, ConfirmModal, Drawer, ErrorBanner } from './ui';
import { api, extractError } from '../api';

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued…',
  validating: 'Validating file…',
  extracting: 'Extracting PDF…',
  analyzing: 'Analyzing company information…',
  chunking: 'Creating knowledge chunks…',
  embedding: 'Generating embeddings…',
  indexing: 'Indexing knowledge…',
  finalizing: 'Finalizing…'
};

const STEPS = [
  { key: 'validating', label: 'Validating file' },
  { key: 'extracting', label: 'Extracting PDF' },
  { key: 'analyzing', label: 'Analyzing company information' },
  { key: 'chunking', label: 'Creating knowledge chunks' },
  { key: 'embedding', label: 'Generating embeddings' },
  { key: 'indexing', label: 'Indexing knowledge' },
  { key: 'finalizing', label: 'Finalizing' }
];

const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(b: number) {
  if (!b || b <= 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(s: string) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function validateFile(f: File): string | null {
  const name = (f.name || '').toLowerCase();
  if (f.type && f.type !== 'application/pdf' && !f.type.includes('pdf') && !name.endsWith('.pdf')) {
    return `"${f.name}" is not a PDF file. Only PDF documents are supported.`;
  }
  if (!name.endsWith('.pdf')) {
    return `Only PDF files are supported. Please choose a .pdf file.`;
  }
  if (f.size === 0) {
    return 'The selected file is empty.';
  }
  if (f.size > MAX_BYTES) {
    return `This file is ${Math.round(f.size / 1024 / 1024)} MB. The maximum upload size is 10 MB.`;
  }
  return null;
}

function ListSection({ icon, title, items, empty }: { icon: ReactNode; title: string; items: any[]; empty: string }) {
  return (
    <div className="border border-muted rounded-xl p-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-textSecondary mb-3">
        {icon} {title}
      </div>
      {(!items || items.length === 0) ? (
        <div className="text-[13px] text-textSecondary">{empty}</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-[13px] text-textPrimary leading-relaxed flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
              {typeof it === 'string' ? it : it.name || it.title || JSON.stringify(it)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CompanyView(props: {
  companyName: string;
  setCompanyName: (v: string) => void;
  companyText: string;
  setCompanyText: (v: string) => void;
  companyProfile: any;
  documents: any[];
  chunks: any[];
  loading: boolean;
  onIngest: () => void;
  onRefresh: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const watchersRef = useRef<Array<() => void>>([]);

  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [jobStatus, setJobStatus] = useState<Record<string, string>>({});
  const [viewDoc, setViewDoc] = useState<any | null>(null);
  const [viewChunks, setViewChunks] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const [askQuestion, setAskQuestion] = useState('What services do we offer?');
  const [askLoading, setAskLoading] = useState(false);
  const [askResult, setAskResult] = useState<any | null>(null);
  const [askError, setAskError] = useState<string>('');
  const [askPhase, setAskPhase] = useState<'idle' | 'searching' | 'generating'>('idle');
  const [askHistory, setAskHistory] = useState<{ q: string; a: string }[]>([]);

  useEffect(() => {
    return () => {
      watchersRef.current.forEach((cancel) => cancel());
      watchersRef.current = [];
    };
  }, []);

  const startWatcher = (docId: string, tick: (doc: any) => void): (() => void) => {
    const iv = window.setInterval(async () => {
      try {
        tick(await api.getDocumentStatus(docId));
      } catch {
        // transient — next tick retries
      }
    }, 1500);
    const stop = () => clearInterval(iv);
    watchersRef.current.push(stop);
    return () => {
      stop();
      watchersRef.current = watchersRef.current.filter((f) => f !== stop);
    };
  };

  const handleFiles = (list?: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setFile(null);
      setError(err);
      setPhase('failed');
      return;
    }
    setFile(f);
    setPhase('idle');
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase('uploading');
    setProgress(0);
    setError(null);
    setStep('');
    try {
      const res = await api.uploadPdfDocument(file, (pct) => setProgress(pct));
      setPhase('processing');
      setStep('Queued…');
      startWatcher(res.documentId, (doc) => {
        if (doc.status === 'processing') {
          setStep(STEP_LABELS[doc.status_detail] || 'Processing…');
        } else if (doc.status === 'indexed') {
          setPhase('success');
          setStep('Indexed');
          setFile(null);
          props.onRefresh();
        } else if (doc.status === 'failed') {
          setPhase('failed');
          setError(doc.error || 'Knowledge processing failed.');
        }
      });
    } catch (e) {
      setPhase('failed');
      setError(extractError(e));
    }
  };

  const handleReprocess = async (doc: any) => {
    setJobStatus((s) => ({ ...s, [doc.id]: 'Queued…' }));
    try {
      await api.reprocessDocument(doc.id);
      startWatcher(doc.id, (d) => {
        if (d.status === 'processing') {
          setJobStatus((s) => ({ ...s, [doc.id]: STEP_LABELS[d.status_detail] || 'Processing…' }));
        } else if (d.status === 'indexed') {
          setJobStatus((s) => ({ ...s, [doc.id]: 'indexed' }));
          props.onRefresh();
          setTimeout(() => setJobStatus((s) => { const n = { ...s }; delete n[doc.id]; return n; }), 2500);
        } else if (d.status === 'failed') {
          setJobStatus((s) => ({ ...s, [doc.id]: 'failed' }));
        }
      });
    } catch {
      setJobStatus((s) => ({ ...s, [doc.id]: 'failed' }));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    try {
      await api.deleteDocument(id);
      await props.onRefresh();
    } catch (e) {
      setError(extractError(e));
    }
  };

  const handleView = async (doc: any) => {
    setViewDoc(doc);
    setViewChunks([]);
    setViewLoading(true);
    try {
      setViewChunks(await api.getDocumentChunks(doc.id));
    } catch {
      setViewChunks([]);
    }
    setViewLoading(false);
  };

  const openSource = async (s: any) => {
    const doc =
      props.documents.find((d) => d.id === s.documentId) ||
      props.documents.find((d) => (d.filename || '') === (s.document || ''));
    if (doc) await handleView(doc);
  };

  const handleAsk = async () => {
    const q = askQuestion.trim();
    if (q.length < 2 || askLoading) return;
    setAskLoading(true);
    setAskError('');
    setAskPhase('searching');
    window.setTimeout(() => setAskPhase('generating'), 700);
    try {
      const res = await api.askCompany(q, askHistory);
      setAskResult(res);
      setAskHistory((h) => [...h.slice(-5), { q, a: res?.answer || '' }]);
    } catch (e) {
      setAskError(extractError(e));
    } finally {
      setAskLoading(false);
      setAskPhase('idle');
    }
  };

  const profile = props.companyProfile;
  const busy = phase === 'uploading' || phase === 'processing';
  const currentStepIdx = STEP_LABELS[step] ? STEPS.findIndex((s) => STEP_LABELS[s.key] === STEP_LABELS[step]) : -1;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow="Knowledge Base"
        title="Your Company Knowledge"
        subtitle="Upload your real company documents (brochures, decks, pricing sheets, case studies). The AI extracts the facts, indexes them, and uses only this knowledge for leads, outreach, and meetings."
        actions={
          <Button variant="secondary" onClick={props.onRefresh} disabled={props.loading}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {phase === 'success' && (
        <div className="mb-6">
          <Notice tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span><strong className="font-semibold">Knowledge ready.</strong> The document was extracted, embedded, and indexed. It is now available for research, outreach, and meeting briefs.</span>
            </div>
          </Notice>
        </div>
      )}

      <Card className="mb-6" title="Upload Company Knowledge">
        <div
          onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setDragOver(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragOver(false); } }}
          onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={cx(
            'flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer select-none',
            dragOver ? 'border-primary bg-primary/[0.06]' : 'border-muted hover:border-primary/40',
            busy && 'opacity-60 pointer-events-none'
          )}
          onClick={() => fileRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/[0.1] border border-primary/25 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.15)]">
            <Upload className="w-7 h-7 text-primary" />
          </div>
          <div className="text-[16px] font-bold text-textPrimary">Drag & drop your PDF here, or browse</div>
          <div className="text-[12px] text-textSecondary max-w-sm leading-relaxed">Brochures, pitch decks, case studies, pricing sheets — anything that teaches the AI what you sell and how. Supported: PDF files (max 10 MB).</div>
          <Button variant="secondary">
            <FileText className="w-4 h-4" /> Browse files
          </Button>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {file && phase !== 'processing' && phase !== 'uploading' && (
          <div className="mt-5 flex items-center gap-4 border border-muted rounded-xl p-4">
            <div className="w-11 h-11 rounded-xl bg-danger/10 border border-danger/25 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-red-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-textPrimary truncate">{file.name}</div>
              <div className="text-[11px] text-textSecondary mt-0.5">{formatBytes(file.size)} · PDF document</div>
            </div>
            <Button onClick={handleUpload} disabled={busy}>
              <Upload className="w-4 h-4" /> Upload
            </Button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg text-textSecondary hover:text-textPrimary hover:bg-white/[0.06] transition-colors"
              title="Remove file"
              onClick={() => { setFile(null); setPhase('idle'); setError(null); }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'uploading' && (
          <div className="mt-5 space-y-2.5">
            <div className="flex items-center justify-between text-[12px] text-textSecondary">
              <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Uploading…</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(progress, 3)}%` }} />
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="mt-5 space-y-3">
            <div className="text-[13px] font-semibold text-textPrimary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> {step || 'Processing…'}
            </div>
            <ol className="grid sm:grid-cols-2 gap-2">
              {STEPS.map((s, i) => {
                const state = i < currentStepIdx || (currentStepIdx === -1 && step === 'indexed') ? 'done' : i === currentStepIdx ? 'current' : 'todo';
                return (
                  <li key={s.key} className={cx('flex items-center gap-2.5 text-[12px] px-3 py-2 rounded-lg border', state === 'done' && 'border-success/25 bg-success/[0.05] text-emerald-300', state === 'current' && 'border-primary/30 bg-primary/[0.05] text-blue-200', state === 'todo' && 'border-muted text-textSecondary')}>
                    {state === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" /> : state === 'current' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-muted shrink-0" />}
                    {s.label}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {phase === 'failed' && error && (
          <div className="mt-5">
            <ErrorBanner message={error} />
            <div className="mt-3 flex items-center gap-2.5">
              {file && (
                <Button onClick={handleUpload} variant="secondary">
                  <RotateCw className="w-4 h-4" /> Retry
                </Button>
              )}
              <Button variant="ghost" onClick={() => { setFile(null); setPhase('idle'); setError(null); }}>
                <X className="w-4 h-4" /> Remove File
              </Button>
            </div>
          </div>
        )}

        {phase === 'idle' && file && (
          <div className="mt-4 text-[12px] text-textSecondary flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5" /> The file is ready. Press <strong className="text-textPrimary">Upload</strong> to process it.
          </div>
        )}
      </Card>

      {!profile ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Test your knowledge">
            <div className="text-[13px] text-textSecondary leading-relaxed">
              Upload a PDF above to build the AI's understanding of your company. Once indexed, you can ask questions about your own offerings and verify the knowledge is retrievable.
            </div>
            <div className="mt-4 text-[13px] text-textSecondary leading-relaxed">
              Alternatively, paste your company information as plain text below.
            </div>
          </Card>
          <Card title="Or paste company information">
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-textSecondary mb-1.5">Company name</label>
                <input
                  value={props.companyName}
                  onChange={(e) => props.setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-textSecondary mb-1.5">What your company does</label>
                <textarea
                  value={props.companyText}
                  onChange={(e) => props.setCompanyText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all resize-none leading-relaxed"
                  placeholder="Paste a short description of your company — offerings, industries, technologies, pricing, and results."
                />
              </div>
              <Button onClick={props.onIngest} loading={props.loading} className="w-full">
                <Sparkles className="w-4 h-4" /> Process knowledge
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-textPrimary">{profile.name}</h2>
              {profile.tagline && profile.tagline !== profile.name && <span className="text-[13px] text-textSecondary italic">{profile.tagline}</span>}
            </div>
            <p className="text-[14px] text-textPrimary leading-relaxed">{profile.summary || 'Not available in company knowledge'}</p>
          </Card>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <ListSection icon={<Boxes className="w-3.5 h-3.5 text-primary" />} title="Services & capabilities" items={profile.offerings} empty="Not available in company knowledge" />
            <ListSection icon={<Target className="w-3.5 h-3.5 text-secondary" />} title="Industries" items={profile.target_industries} empty="Not available in company knowledge" />
            <ListSection icon={<Award className="w-3.5 h-3.5 text-success" />} title="Case studies & results" items={profile.case_studies} empty="Not available in company knowledge" />
            <ListSection icon={<Wrench className="w-3.5 h-3.5 text-warning" />} title="Technologies & stack" items={profile.tech_stack} empty="Not available in company knowledge" />
            <ListSection icon={<BadgeDollarSign className="w-3.5 h-3.5 text-primary" />} title="Pricing & packages" items={profile.pricing} empty="Not available in company knowledge" />
            <ListSection icon={<AlertTriangle className="w-3.5 h-3.5 text-danger" />} title="Limitations & boundaries" items={profile.limitations} empty="Not available in company knowledge" />
          </div>

          <Card title="Ask Company Knowledge" className="mb-6">
            <div className="flex flex-wrap gap-2.5">
              <div className="flex-1 min-w-[240px]">
                <input
                  value={askQuestion}
                  onChange={(e) => setAskQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }}
                  placeholder="e.g. What services do we offer?"
                  className="w-full px-3 py-2 bg-elevated border border-muted rounded-lg text-[13px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>
              <Button onClick={handleAsk} loading={askLoading} disabled={askLoading}>
                <Search className="w-4 h-4" /> Ask
              </Button>
            </div>

            {askLoading && (
              <div className="mt-3 text-[12px] text-textSecondary flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                {askPhase === 'searching' ? 'Searching company knowledge…' : 'Generating grounded answer…'}
              </div>
            )}
            {askError && <div className="mt-3 text-[12px] text-red-300">{askError}</div>}
            {askResult && (
              <div className="mt-4 space-y-3">
                {askResult.error ? (
                  <div className="text-[13px] text-amber-200">{askResult.error}</div>
                ) : (
                  <>
                    <div className="text-[13px] text-textPrimary leading-relaxed whitespace-pre-wrap">{askResult.answer}</div>
                    {askResult.sources && askResult.sources.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-muted/60">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-textSecondary">Sources</div>
                        {askResult.sources.map((s: any, i: number) => (
                          <button
                            key={s.id || i}
                            onClick={() => openSource(s)}
                            title="Open this document"
                            className="flex items-start gap-2 text-[12px] text-textSecondary leading-relaxed w-full text-left rounded-lg p-1.5 hover:bg-white/[0.03] transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <span>
                              <span className="text-textPrimary font-medium">{s.document}</span>
                              {s.page && <span> · Page {s.page}</span>}
                              {(s.section || s.heading) && <span> · {s.section || s.heading}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {askHistory.length > 0 && (
              <div className="mt-4 pt-3 border-t border-muted/60 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-textSecondary">Conversation context</div>
                {askHistory.slice(-2).map((h, i) => (
                  <div key={i} className="text-[11px] text-textSecondary leading-relaxed">
                    <span className="text-primary/80 font-medium">Q:</span> {h.q}
                    <span className="text-secondary/80 font-medium ml-2">A:</span>{' '}
                    {h.a.length > 160 ? `${h.a.slice(0, 160)}…` : h.a}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Card title="Knowledge Sources" className="mb-6" actions={<Chip>{props.documents.length} documents</Chip>}>
        {props.documents.length === 0 ? (
          <div className="text-[13px] text-textSecondary leading-relaxed">
            No documents uploaded yet. Upload a PDF above — each document becomes a retrievable knowledge source.
          </div>
        ) : (
          <div className="space-y-2">
            {props.documents.map((d) => {
              const busyDoc = jobStatus[d.id];
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-3 border border-muted rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-danger/10 border border-danger/25 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-red-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-textPrimary truncate">{d.filename}</div>
                    <div className="text-[11px] text-textSecondary mt-0.5 flex flex-wrap items-center gap-x-3">
                      <span>{formatBytes(d.size_bytes)}</span>
                      <span>Uploaded {formatDate(d.created_at)}</span>
                      <span>{d.page_count || 0} pages</span>
                      <span>{d.chunk_count || 0} chunks</span>
                      {d.version > 1 && <span>v{d.version}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {busyDoc === 'indexed' && <Chip tone="success"><CheckCircle2 className="w-3 h-3" /> Reindexed</Chip>}
                    {busyDoc === 'failed' && <Chip tone="danger">Reprocessing failed</Chip>}
                    {busyDoc && busyDoc !== 'indexed' && busyDoc !== 'failed' && <Chip tone="primary"><Loader2 className="w-3 h-3 animate-spin" /> {busyDoc}</Chip>}
                    {!busyDoc && d.status === 'processing' && <Chip tone="warning"><Loader2 className="w-3 h-3 animate-spin" /> Processing</Chip>}
                    {!busyDoc && d.status === 'indexed' && <Chip tone="success"><CheckCircle2 className="w-3 h-3" /> Indexed</Chip>}
                    {!busyDoc && d.status === 'failed' && <Chip tone="danger"><AlertTriangle className="w-3 h-3" /> Failed</Chip>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" title="View sources" onClick={() => handleView(d)}>
                      <Eye className="w-4 h-4" /> View
                    </Button>
                    <Button variant="ghost" title="Reprocess" disabled={d.status === 'processing' || !!busyDoc} onClick={() => handleReprocess(d)}>
                      <RotateCw className="w-4 h-4" /> Reprocess
                    </Button>
                    <Button variant="ghost" title="Delete" onClick={() => setConfirmDelete(d)}>
                      <Trash2 className="w-4 h-4 text-red-300" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Collapsible title="Advanced details" icon={<Database className="w-4 h-4 text-textSecondary" />} badge={<Chip>{props.chunks.length} indexed chunks</Chip>}>
        <div className="text-[12px] text-textSecondary leading-relaxed space-y-1.5">
          <div>Each upload is validated, page-extracted, semantically chunked, embedded, and stored in the knowledge index. Source metadata (document, page, section) is retained per chunk.</div>
          <div>Embeddings are generated by the built-in semantic indexer in the server environment — no external embedding key required.</div>
          <div>Query the index with “Ask Company Knowledge” to confirm the newest documents are retrievable.</div>
        </div>
      </Collapsible>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete this knowledge source?"
        body={confirmDelete ? `"${confirmDelete.filename}" and all of its indexed knowledge will be permanently removed. This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Drawer open={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc ? `Source evidence — ${viewDoc.filename}` : ''}>
        {viewLoading ? (
          <div className="flex items-center gap-2 text-[13px] text-textSecondary py-6">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading chunks…
          </div>
        ) : viewChunks.length === 0 ? (
          <div className="text-[13px] text-textSecondary">No indexed chunks available for this document.</div>
        ) : (
          <div className="space-y-3">
            {viewChunks.map((c) => (
              <div key={c.id} className="border border-muted rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Chip tone="neutral" className="text-[10px]">{c.category}</Chip>
                  {c.page && <Chip tone="primary" className="text-[10px]">Page {c.page}</Chip>}
                  {c.section && <Chip tone="ai" className="text-[10px]">{c.section}</Chip>}
                </div>
                <div className="text-[12px] text-textPrimary leading-relaxed whitespace-pre-wrap">{c.content}</div>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}