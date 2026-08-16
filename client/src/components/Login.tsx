import React, { useState } from 'react';
import { Bot, LogIn, Zap, Sparkles, ShieldCheck, Cpu } from 'lucide-react';

export const Login: React.FC<{ onLogin: (email: string, password: string) => Promise<void>; onDemoLogin: () => Promise<void>; loading: boolean }> = ({
  onLogin,
  onDemoLogin,
  loading,
}) => {
  const [email, setEmail] = useState('admin@agenthack.ai');
  const [password, setPassword] = useState('agenthack2026');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Sign in failed. Please check your credentials.');
    }
  };

  const features = [
    { icon: <Cpu className="w-4 h-4 text-primary" />, title: 'Autonomous lead discovery', desc: 'Finds and qualifies companies against your target profile.' },
    { icon: <Sparkles className="w-4 h-4 text-secondary" />, title: 'Grounded outreach', desc: 'Drafts messages from real research and your company knowledge.' },
    { icon: <ShieldCheck className="w-4 h-4 text-success" />, title: 'Honest by design', desc: 'Nothing is faked — unconnected providers are clearly marked.' },
  ];

  return (
    <div className="flex min-h-screen bg-background text-textPrimary">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] p-12 bg-surface/50 border-r border-muted relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-secondary/[0.06] blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight">AgentHack</div>
            <div className="text-[12px] text-textSecondary">AI Sales Operations</div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Your AI sales team,
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">working while you sleep.</span>
          </h1>
          <p className="text-[14px] text-textSecondary leading-relaxed">
            One autonomous system that discovers leads, researches them, qualifies fit, writes outreach, and books meetings — all grounded in your real company knowledge.
          </p>
          <div className="space-y-4">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-muted flex items-center justify-center shrink-0">{f.icon}</div>
                <div>
                  <div className="text-[13px] font-semibold text-textPrimary">{f.title}</div>
                  <div className="text-[12px] text-textSecondary mt-0.5 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[11px] text-textMuted">AgentHack · Autonomous AI Sales Operations</div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 animate-slide-up">
          <div className="flex lg:hidden flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight">AgentHack</div>
              <div className="text-[13px] text-textSecondary mt-1">AI Sales Operations</div>
            </div>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-xl font-bold tracking-tight">Sign in</h2>
            <p className="text-[13px] text-textSecondary mt-1">Access your AI sales operations dashboard.</p>
          </div>

          <form onSubmit={submit} className="bg-surface border border-muted rounded-2xl p-6 space-y-4 shadow-card">
            <div>
              <label className="text-[12px] text-textSecondary font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1.5 bg-elevated border border-muted rounded-lg px-3.5 py-2.5 text-[13px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="text-[12px] text-textSecondary font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1.5 bg-elevated border border-muted rounded-lg px-3.5 py-2.5 text-[13px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
                placeholder="••••••••"
              />
            </div>
            {error && <div className="text-[12px] text-red-300 bg-danger/[0.08] border border-danger/25 rounded-lg px-3 py-2 leading-relaxed">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-blue-500 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50 shadow-glow"
            >
              {loading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
              Sign In
            </button>
            <button
              type="button"
              onClick={onDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-textSecondary hover:text-textPrimary border border-muted rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-warning" /> Quick demo sign-in
            </button>
          </form>

          <p className="text-center text-[11px] text-textMuted">admin@agenthack.ai · agenthack2026</p>
        </div>
      </div>
    </div>
  );
};