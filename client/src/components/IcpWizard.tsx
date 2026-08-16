import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Target, Sparkles, Users, Briefcase, Search } from 'lucide-react';
import { PageHeader, Button, Card, cx } from './ui';

const SUGGESTIONS: Record<number, string[]> = {
  0: ['United States', 'Pakistan', 'United Kingdom', 'Germany', 'UAE', 'Singapore', 'Canada', 'Australia'],
  1: ['Hospital', 'Logistics & Supply Chain', 'eCommerce', 'SaaS', 'Fintech', 'Healthcare', 'Manufacturing', 'Real Estate'],
  2: ['Startup (1-50 employees)', 'Small (50-200 employees)', '100 employees', '50-500 employees', 'Mid-size (200-1000)', 'Enterprise (1000+)'],
  4: ['AI Support Automation', 'Customer Service Automation', 'Lead Qualification', 'AI Chat Assistants', 'Helpdesk Automation', 'WhatsApp Automation'],
};

const STEPS = [
  { icon: Search, title: 'Where should we sell?', field: 'location', hint: 'The market you want to find buyers in.' },
  { icon: Target, title: 'Which industries should we target?', field: 'industry', hint: 'The types of companies most likely to need you.' },
  { icon: Users, title: 'What size company?', field: 'companySize', hint: 'Company size is a strong filter — big teams and small teams buy differently.' },
  { icon: Briefcase, title: 'What problem should they have?', field: 'targetProblem', hint: 'The pain your AI looks for when researching each company.' },
  { icon: Sparkles, title: 'What service should we promote?', field: 'preferredService', hint: 'The offering your AI recommends to every qualified lead.' },
];

export function IcpWizard(props: {
  icpForm: any;
  setIcpForm: (v: any) => void;
  loading: boolean;
  onSaveIcp: () => Promise<any[]>;
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);
  const { icpForm, setIcpForm } = props;

  const inputCls = 'w-full px-3.5 py-2.5 bg-elevated border border-muted rounded-lg text-[14px] text-textPrimary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all';

  const setField = (field: string, value: string) => setIcpForm({ ...icpForm, [field]: value });

  const startDiscovery = async () => {
    setRunning(true);
    try {
      const leads = await props.onSaveIcp();
      if (leads && leads.length > 0) setDone(true);
    } finally {
      setRunning(false);
    }
  };

  const summaryRows = [
    { label: 'Where to sell', value: icpForm.location },
    { label: 'Industries', value: icpForm.industry },
    { label: 'Company size', value: icpForm.companySize },
    { label: 'Problem to detect', value: icpForm.targetProblem },
    { label: 'Service to promote', value: icpForm.preferredService },
  ];

  if (done) {
    return (
      <div className="p-4 md:p-8 max-w-[820px] mx-auto">
        <Card className="text-center py-14">
          <div className="mx-auto w-14 h-14 rounded-full bg-success/[0.12] border border-success/25 flex items-center justify-center mb-5">
            <Check className="w-7 h-7 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-textPrimary mb-2">Discovery started</h1>
          <p className="text-[14px] text-textSecondary leading-relaxed max-w-lg mx-auto">
            Your AI is researching companies, filtering for fit, and scoring each lead. Check <span className="text-textPrimary font-medium">Leads</span> for results, or visit <span className="text-textPrimary font-medium">Overview</span> to watch progress.
          </p>
        </Card>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="p-4 md:p-8 max-w-[820px] mx-auto">
      <PageHeader
        eyebrow="Targeting"
        title="Define your ideal customer"
        subtitle="Answer five short questions and your AI will go find the companies that fit, research them, score them, and prepare outreach."
      />

      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1">
            <div className={cx('h-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-white/[0.08]')} />
          </div>
        ))}
      </div>

      <Card>
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/[0.12] border border-primary/25 flex items-center justify-center shrink-0">
            <current.icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-textSecondary mb-1">Step {step + 1} of {STEPS.length}</div>
            <h2 className="text-lg font-bold text-textPrimary">{current.title}</h2>
            <p className="text-[13px] text-textSecondary mt-1">{current.hint}</p>
          </div>
        </div>

        <div className="space-y-4">
          {current.field === 'targetProblem' ? (
            <textarea
              value={icpForm[current.field]}
              onChange={(e) => setField(current.field, e.target.value)}
              rows={4}
              className={inputCls}
              placeholder="e.g. High volume customer support backlogs"
            />
          ) : (
            <input
              value={icpForm[current.field]}
              onChange={(e) => setField(current.field, e.target.value)}
              className={inputCls}
              placeholder={current.field === 'companySize' ? 'e.g. 100 employees' : current.field === 'location' ? 'e.g. United States' : current.field === 'industry' ? 'e.g. Hospital' : 'e.g. AI Support Automation'}
            />
          )}

          {SUGGESTIONS[step] && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[step].map((s) => (
                <button
                  key={s}
                  onClick={() => setField(current.field, s)}
                  className={cx(
                    'px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors',
                    icpForm[current.field] === s ? 'bg-primary/[0.15] border-primary/40 text-primary' : 'bg-white/[0.03] border-muted text-textSecondary hover:text-textPrimary hover:border-primary/30'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="border border-muted rounded-xl p-4 space-y-3">
              <label className="block text-[12px] font-medium text-textSecondary">Advanced — exclude specific companies or domains</label>
              <input
                value={icpForm.exclusions}
                onChange={(e) => setField('exclusions', e.target.value)}
                className={inputCls}
                placeholder="e.g. acme.com, globex.com"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-6 mt-6 border-t border-muted">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || props.loading}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={startDiscovery} loading={running || props.loading}>
              <Sparkles className="w-4 h-4" /> Start Finding Leads
            </Button>
          )}
        </div>
      </Card>

      {step === STEPS.length - 1 && (
        <Card className="mt-6">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-textSecondary mb-4">
            <Target className="w-4 h-4 text-primary" /> Your ideal customer
          </div>
          <div className="space-y-3">
            {summaryRows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-6">
                <span className="text-[13px] text-textSecondary shrink-0">{r.label}</span>
                <span className="text-[13px] font-medium text-textPrimary text-right">{r.value || '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}