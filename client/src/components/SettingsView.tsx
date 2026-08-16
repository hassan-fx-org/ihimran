import { useEffect, useState } from 'react';
import { Save, Mail, Calendar as CalendarIcon, Globe, BrainCircuit, LogOut, CheckCircle2, XCircle, KeyRound, MessageCircle, Loader2, Zap } from 'lucide-react';
import { PageHeader, Card, Button, Toggle, Chip, cx, Input } from './ui';
import { api, extractError } from '../api';

type TestState = { testing: boolean; ok: boolean | null; detail: string };

export function SettingsView(props: {
  settings: any;
  user: any;
  onUpdate: (data: any) => void;
  onLogout: () => void;
}) {
  const ws = props.settings?.workspace || {};
  const env = props.settings?.environment || {};

  const [name, setName] = useState(ws.name || '');
  const [outbound, setOutbound] = useState(ws.outbound_enabled !== false);
  const [fu1, setFu1] = useState(ws.followup_day_1 ?? 2);
  const [fu2, setFu2] = useState(ws.followup_day_2 ?? 3);
  const [hour, setHour] = useState(ws.meeting_default_hour ?? 15);
  const [saved, setSaved] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, { connected: boolean; detail: string }>>({});

  const applyReport = (report: any) => {
    const next: Record<string, { connected: boolean; detail: string }> = {};
    for (const key of ['database', 'vector', 'email', 'calendar', 'whatsapp', 'search', 'llm']) {
      const st = (report as any)?.[key];
      next[key] = {
        connected: st ? !!st.connected : false,
        detail: st?.detail || 'Provider not configured.'
      };
    }
    setLive(next);
    setCheckedAt(new Date().toLocaleTimeString());
  };

  // Live health verification on mount — badges reflect a real backend check,
  // never a hardcoded/simulated status.
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    api
      .testIntegrations()
      .then((report) => {
        if (!cancelled) applyReport(report);
      })
      .catch(() => {
        /* leave env-flag fallback state */
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runTest = async (name: string, reportKey: string) => {
    setTests((p) => ({ ...p, [name]: { testing: true, ok: null, detail: 'Testing…' } }));
    try {
      const report = await api.testIntegrations();
      applyReport(report);
      const st = (report as any)?.[reportKey] as { connected?: boolean; detail?: string } | undefined;
      setTests((p) => ({
        ...p,
        [name]: {
          testing: false,
          ok: st ? !!st.connected : false,
          detail: st?.detail || 'Provider not configured.'
        }
      }));
    } catch (e) {
      setTests((p) => ({ ...p, [name]: { testing: false, ok: false, detail: extractError(e) } }));
    }
  };

  const runAll = async () => {
    setTestingAll(true);
    try {
      const report = await api.testIntegrations();
      applyReport(report);
      const keys: Record<string, string> = { email: 'Email', calendar: 'Google Calendar', whatsapp: 'Admin WhatsApp', search: 'Web research', llm: 'AI models' };
      const next: Record<string, TestState> = {};
      for (const [k, label] of Object.entries(keys)) {
        const st = (report as any)?.[k];
        next[label] = { testing: false, ok: st ? !!st.connected : false, detail: st?.detail || 'Provider not configured.' };
      }
      setTests(next);
    } catch (e) {
      setTests((p) => ({
        ...p,
        Email: { testing: false, ok: false, detail: extractError(e) }
      }));
    } finally {
      setTestingAll(false);
    }
  };

  // Truth = the live health report. Config flags are only a transient fallback
  // while the backend check is in flight.
  const connectedFor = (reportKey: string) => {
    const l = live[reportKey];
    if (l) return l.connected;
    if (reportKey === 'email') return env.outboundEnabled !== false && !env.emailSimulated;
    if (reportKey === 'calendar') return !env.calendarSimulated;
    if (reportKey === 'whatsapp') return !env.whatsappSimulated;
    if (reportKey === 'search') return !!env.searchConfigured;
    if (reportKey === 'llm') return !!env.llmConfigured;
    return false;
  };

  useEffect(() => {
    setName(ws.name || '');
    setOutbound(ws.outbound_enabled !== false);
    setFu1(ws.followup_day_1 ?? 2);
    setFu2(ws.followup_day_2 ?? 3);
    setHour(ws.meeting_default_hour ?? 15);
  }, [props.settings?.workspace?.id]);

  const save = async () => {
    await props.onUpdate({ name, outboundEnabled: outbound, followupDay1: Number(fu1), followupDay2: Number(fu2), meetingDefaultHour: Number(hour) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const integrations = [
    {
      reportKey: 'email',
      icon: <Mail className="w-4 h-4" />,
      name: 'Email',
      powers: 'Sends outreach and follow-up messages to prospects.',
      connect: 'Set RESEND_API_KEY (and EMAIL_SENDER) in server/.env, then restart the server.',
      current: 'Real emails sent via Resend API when configured.',
    },
    {
      reportKey: 'calendar',
      icon: <CalendarIcon className="w-4 h-4" />,
      name: 'Google Calendar',
      powers: 'Books meetings and creates real Google Meet links when a prospect says yes.',
      connect: 'Set GOOGLE_CALENDAR_CLIENT_EMAIL and GOOGLE_CALENDAR_PRIVATE_KEY (a service account) in server/.env.',
      current: 'Currently off — meetings are recorded internally with no meeting link.',
    },
    {
      reportKey: 'whatsapp',
      icon: <MessageCircle className="w-4 h-4" />,
      name: 'Admin WhatsApp',
      powers: 'Notifies the admin (meeting finalized + 30-minute reminder with briefing) and reaches prospects on WhatsApp.',
      connect: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM and ADMIN_WHATSAPP_TO in server/.env.',
      current: 'Currently simulated — admin notifications are recorded but no WhatsApp message is sent.',
    },
    {
      reportKey: 'search',
      icon: <Globe className="w-4 h-4" />,
      name: 'Web research',
      powers: 'Finds real companies and evidence on the web during discovery and research.',
      connect: 'Set TAVILY_API_KEY or SERPER_API_KEY in server/.env. Without one, discovery uses a clearly-labeled demo dataset.',
      current: 'Currently using the demo dataset for lead sourcing.',
    },
    {
      reportKey: 'llm',
      icon: <BrainCircuit className="w-4 h-4" />,
      name: 'AI models',
      powers: 'Writes outreach, classifies replies, and generates briefings.',
      connect: 'Configured via server environment variables (e.g. GROQ_API_KEY, GEMINI_API_KEY).',
      current: undefined,
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto">
      <PageHeader
        eyebrow="Advanced"
        title="Settings"
        subtitle="Workspace behavior and the integrations your AI depends on. Nothing here is faked — if a provider is off, the app tells you honestly and keeps working in a safe fallback."
      />

      <div className="space-y-6">
        <Card title="Workspace">
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-textSecondary mb-1.5">Workspace name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-md" placeholder="Workspace name" />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-textSecondary mb-1.5">Follow-up #1 (days)</label>
                <Input type="number" min={1} max={30} value={fu1} onChange={(e) => setFu1(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-textSecondary mb-1.5">Follow-up #2 (days)</label>
                <Input type="number" min={1} max={30} value={fu2} onChange={(e) => setFu2(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-textSecondary mb-1.5">Default meeting hour</label>
                <Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-y border-muted">
              <div>
                <div className="text-[13px] font-semibold text-textPrimary">Outbound email enabled</div>
                <div className="text-[12px] text-textSecondary mt-0.5">Kill switch for all outbound email. When off, the AI never attempts delivery.</div>
              </div>
              <Toggle checked={outbound} onChange={setOutbound} />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save}><Save className="w-4 h-4" /> Save settings</Button>
              {saved && <Chip tone="success"><CheckCircle2 className="w-3 h-3" /> Saved</Chip>}
            </div>
          </div>
        </Card>

        <Card
          title="Integrations"
          actions={
            <Button size="sm" variant="secondary" onClick={runAll} disabled={testingAll}>
              {testingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Test all connections
            </Button>
          }
        >
          <div className="flex items-center gap-2 text-[11px] text-textSecondary mb-4">
            {checking ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Running live health checks…</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-success" /> Live health check complete{checkedAt ? ` at ${checkedAt}` : ''}</span>
            )}
          </div>
          <div className="space-y-4">
            {integrations.map((it) => {
              const connected = connectedFor(it.reportKey);
              return (
                <div key={it.name} className="flex items-start gap-4 border border-muted rounded-xl p-4">
                  <div className={cx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border', connected ? 'bg-success/[0.1] border-success/25 text-success' : 'bg-white/[0.04] border-muted text-textSecondary')}>
                    {it.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-textPrimary">{it.name}</span>
                      {connected ? (
                        <Chip tone="success" className="text-[10px]"><CheckCircle2 className="w-3 h-3" /> Connected</Chip>
                      ) : (
                        <Chip tone="warning" className="text-[10px]"><XCircle className="w-3 h-3" /> Not connected</Chip>
                      )}
                    </div>
                    <div className="text-[12px] text-textSecondary mt-1.5 leading-relaxed">{it.powers}</div>
                    {!connected && it.current && <div className="text-[12px] text-amber-300/90 mt-1 leading-relaxed">{it.current}</div>}
                    {!connected && (
                      <div className="flex items-start gap-1.5 mt-2 text-[11px] text-textSecondary leading-relaxed">
                        <KeyRound className="w-3 h-3 mt-0.5 shrink-0" />
                        <span><strong className="text-textPrimary font-medium">How to connect:</strong> {it.connect}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" variant="secondary" onClick={() => runTest(it.name, it.reportKey)} disabled={tests[it.name]?.testing}>
                        {tests[it.name]?.testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        Test connection
                      </Button>
                      {tests[it.name] && !tests[it.name].testing && (
                        <span className={cx('text-[12px] flex items-center gap-1.5', tests[it.name].ok ? 'text-success' : 'text-danger')}>
                          {tests[it.name].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span className="max-w-[420px] truncate">{tests[it.name].detail}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Account">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-textPrimary">{props.user?.name}</div>
              <div className="text-[12px] text-textSecondary mt-0.5">{props.user?.email}</div>
            </div>
            <Button variant="secondary" onClick={props.onLogout}><LogOut className="w-4 h-4" /> Log out</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}