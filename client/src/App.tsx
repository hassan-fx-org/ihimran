import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, Kanban, Building2, Target, Mail, Calendar,
  Activity, ScrollText, Settings, LogOut, Play, Bot,
  Menu, PanelLeftClose, PanelLeftOpen, ChevronDown
} from 'lucide-react';
import { api, extractError } from './api';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { LeadsPage } from './components/LeadsPage';
import { LeadDetail } from './components/LeadDetail';
import { PipelineView } from './components/PipelineView';
import { CompanyView } from './components/CompanyView';
import { IcpWizard } from './components/IcpWizard';
import { OutreachView } from './components/OutreachView';
import { MeetingsView } from './components/MeetingsView';
import { ActivityView } from './components/ActivityView';
import { AuditLogsView } from './components/AuditLogsView';
import { SettingsView } from './components/SettingsView';
import { cx, Avatar, Dropdown, StatusPill, Tooltip, useToast } from './components/ui';

type View = 'overview' | 'leads' | 'leadDetail' | 'pipeline' | 'company' | 'icp' | 'outreach' | 'meetings' | 'activity' | 'logs' | 'settings';

const PRIMARY_NAV: Array<{ id: View; label: string; icon: any }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: Kanban },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'icp', label: 'ICP', icon: Target },
  { id: 'outreach', label: 'Outreach', icon: Mail },
  { id: 'meetings', label: 'Meetings', icon: Calendar },
];

const ADVANCED_NAV: Array<{ id: View; label: string; icon: any }> = [
  { id: 'activity', label: 'Agent Activity', icon: Activity },
  { id: 'logs', label: 'Audit Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const VIEW_META: Record<View, { title: string; subtitle?: string }> = {
  overview: { title: 'Overview', subtitle: 'Your AI sales operation at a glance' },
  leads: { title: 'Leads', subtitle: 'Every company your AI has discovered' },
  leadDetail: { title: 'Lead Intelligence', subtitle: 'Evidence, people, and outreach for one company' },
  pipeline: { title: 'Pipeline', subtitle: 'Move leads from discovery to conversion' },
  company: { title: 'Company Knowledge', subtitle: 'The knowledge your AI reasons with' },
  icp: { title: 'Ideal Customer Profile', subtitle: 'Define who you sell to' },
  outreach: { title: 'Outreach', subtitle: 'Draft, review, and send messages' },
  meetings: { title: 'Meetings', subtitle: 'Booked calls with one-click briefings' },
  activity: { title: 'Agent Activity', subtitle: 'What your AI team has been doing' },
  logs: { title: 'Audit Logs', subtitle: 'Raw technical record of tool calls' },
  settings: { title: 'Settings', subtitle: 'Workspace & integrations' },
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  const [view, setView] = useState<View>('overview');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [chunks, setChunks] = useState<any[]>([]);
  const [meetingsList, setMeetingsList] = useState<any[]>([]);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [agentRuns, setAgentRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('Autonomous Agent Ready');
  const [appError, setAppError] = useState<string>('');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('agenthack_sidebar') === 'collapsed');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toast = useToast();

  const [companyName, setCompanyName] = useState('IH Usmani Group');
  const [companyText, setCompanyText] = useState('IH Usmani Group provides autonomous AI sales agents for B2B companies. Our AgentHack platform automates lead discovery, research, personalized outreach, and meeting booking — end-to-end. Core offerings include AI-powered inquiry triage, evidence-grounded cold emails, and automated follow-up sequences. Target customers are B2B SaaS, agencies, and high-growth teams that rely on outbound sales. Limitations: requires CRM integration and verified contact data.');
  const [icpForm, setIcpForm] = useState({
    location: 'Pakistan',
    industry: 'Hospital',
    companySize: '100 employees',
    targetProblem: 'High volume patient appointment & inquiry support backlogs',
    exclusions: '',
    preferredService: ''
  });
  const [replyInput, setReplyInput] = useState("Hi team, yes we are interested in automating our patient inquiry triage. Let's meet this Thursday at 3 PM to discuss.");

  const toggleSidebar = () => {
    setSidebarCollapsed((c) => {
      localStorage.setItem('agenthack_sidebar', c ? 'expanded' : 'collapsed');
      return !c;
    });
  };

  const refreshData = useCallback(async (opts?: { quiet?: boolean }) => {
    try {
      const [dash, leads, comp, meets, logs, runs, docs, chunksData, settingsData] = await Promise.all([
        api.getDashboard().catch(() => null),
        api.getLeads().catch(() => []),
        api.getCompany().catch(() => null),
        api.getMeetings().catch(() => []),
        api.getAgentLogs().catch(() => []),
        api.getAgentRuns().catch(() => []),
        api.getDocuments().catch(() => []),
        api.getChunks().catch(() => []),
        api.getSettings().catch(() => null)
      ]);
      if (dash) setDashboardData(dash);
      if (leads) setLeadsList(leads);
      if (comp) setCompanyProfile(comp);
      if (meets) setMeetingsList(meets);
      if (logs) setAgentLogs(logs);
      if (runs) setAgentRuns(runs);
      if (docs) setDocuments(docs);
      if (chunksData) setChunks(chunksData);
      if (settingsData) setSettings(settingsData);
      if (selectedLeadId) {
        const detail = await api.getLeadDetail(selectedLeadId).catch(() => null);
        if (detail) setLeadDetail(detail);
      }
    } catch (err) {
      if (!opts?.quiet) setAppError(extractError(err));
    }
  }, [selectedLeadId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = api.getToken();
      if (!token) {
        setAuthReady(true);
        return;
      }
      try {
        const me = await api.me();
        if (cancelled) return;
        setAuthUser(me.user);
        setWorkspace(me.workspace);
      } catch {
        api.clearToken();
        if (!cancelled) setAuthUser(null);
      }
      setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    refreshData();
    const interval = setInterval(() => refreshData({ quiet: true }), 5000);
    return () => clearInterval(interval);
  }, [authUser, selectedLeadId, refreshData]);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.login(email, password);
      api.setToken(data.token);
      setAuthUser(data.user);
      setWorkspace(data.workspace);
      toast('success', 'Signed in', `Welcome back, ${data.user?.name?.split(' ')[0] || 'Admin'}.`);
    } catch (err) {
      toast('error', 'Sign in failed', extractError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const data = await api.demoLogin();
      api.setToken(data.token);
      setAuthUser(data.user);
      setWorkspace(data.workspace);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    api.clearToken();
    setAuthUser(null);
    setWorkspace(null);
    setView('overview');
  };

  const loadLead = async (id: string) => {
    setSelectedLeadId(id);
    try {
      const detail = await api.getLeadDetail(id);
      setLeadDetail(detail);
    } catch (err) {
      setAppError(extractError(err));
    }
  };

  const openLeadDetail = async (id: string) => {
    setView('leadDetail');
    await loadLead(id);
  };

  const withBusy = async <T,>(fn: () => Promise<T>, status?: string): Promise<T | undefined> => {
    if (loading) return undefined;
    setLoading(true);
    setAppError('');
    if (status) setAgentStatus(status);
    try {
      return await fn();
    } catch (err) {
      setAppError(extractError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const runDiscovery = async (targetView: View = 'leads') => {
    await withBusy(async () => {
      setAgentStatus('Sourcing and filtering new candidate companies...');
      const icps = await api.getIcps().catch(() => []);
      const icp = Array.isArray(icps) && icps.length > 0 ? icps[0] : null;
      const disc = await api.discoverLeads(icp?.id);
      await refreshData({ quiet: true });
      setAgentStatus(`Discovery complete: ${disc.candidatesCount} candidates found, ${disc.passed} matched your target profile.`);
      toast('success', 'Discovery complete', `${disc.candidatesCount} candidates found, ${disc.passed} matched your target profile.`);
      if (disc?.leads?.length) {
        const top = disc.leads.find((l: any) => l.stage !== 'Not Qualified') || disc.leads[0];
        await openLeadDetail(top.id);
      } else {
        setView(targetView);
      }
    }, 'Running lead discovery...');
  };

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-textPrimary">
        <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authUser) {
    return <Login onLogin={handleLogin} onDemoLogin={handleDemoLogin} loading={loading} />;
  }

  const env = settings?.environment || {};
  const isDemo = env.demoMode || false;
  const integrations = {
    email: env.outboundEnabled !== false && !env.emailSimulated,
    calendar: !env.calendarSimulated,
    whatsapp: !env.whatsappSimulated,
    search: !!env.searchConfigured,
    llm: !!env.llmConfigured,
  };

  const renderNavItem = (item: { id: View; label: string; icon: any }, collapsed: boolean) => {
    const Icon = item.icon;
    const isActive = view === item.id;
    const el = (
      <button
        key={item.id}
        onClick={() => { setView(item.id); setMobileNavOpen(false); }}
        className={cx(
          'w-full flex items-center gap-3 rounded-lg text-[13px] font-semibold transition-all duration-150',
          collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
          isActive ? 'bg-primary/[0.12] text-textPrimary' : 'text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className={cx('w-[18px] h-[18px] shrink-0', isActive ? 'text-primary' : 'text-textSecondary')} />
        {!collapsed && item.label}
        {collapsed && isActive && <span className="absolute right-0 w-0.5 h-5 bg-primary rounded-full" />}
      </button>
    );
    return collapsed ? (
      <div key={item.id} className="relative">
        <Tooltip label={item.label}>{el}</Tooltip>
      </div>
    ) : el;
  };

  const sidebarBody = (collapsed: boolean) => (
    <>
      <div className="space-y-7">
        <div className={cx('flex items-center gap-3', collapsed ? 'justify-center px-0' : 'px-2')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-glow">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-[15px] text-textPrimary tracking-tight leading-tight">AgentHack</div>
              <div className="text-[11px] text-textSecondary">AI Sales Operations</div>
            </div>
          )}
        </div>

        <div>
          {!collapsed && <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-textMuted">Workspace</div>}
          <nav className="space-y-1">{PRIMARY_NAV.map((item) => renderNavItem(item, collapsed))}</nav>
        </div>

        <div>
          {!collapsed && <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-textMuted">Advanced</div>}
          <nav className="space-y-1">{ADVANCED_NAV.map((item) => renderNavItem(item, collapsed))}</nav>
        </div>
      </div>

      <div className={cx('space-y-3 border-t border-muted', collapsed ? 'p-2' : 'p-4')}>
        {appError && (
          <div className="p-3 bg-danger/[0.08] border border-danger/30 rounded-lg text-[11px] text-red-200 leading-relaxed">
            {appError}
            <button onClick={() => setAppError('')} className="block mt-1.5 text-red-400 hover:text-red-200 text-[11px]">Dismiss</button>
          </div>
        )}
        <div className={cx('bg-surface border border-muted rounded-xl space-y-2.5', collapsed ? 'p-2' : 'p-4')}>
          {!collapsed && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-textSecondary">Agent status</span>
              <span className={cx('px-2 py-0.5 rounded-full text-[10px] font-semibold border', loading ? 'bg-warning/10 text-amber-300 border-warning/25' : 'bg-success/10 text-emerald-300 border-success/25')}>
                {loading ? 'Working' : 'Ready'}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="text-[12px] text-textSecondary leading-relaxed min-h-[34px]">{loading ? 'Running…' : agentStatus}</div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <span className={cx('w-2 h-2 rounded-full', loading ? 'bg-warning animate-pulse-soft' : 'bg-success')} />
            </div>
          )}
          <button
            onClick={() => runDiscovery('overview')}
            disabled={loading}
            title="Run Lead Discovery"
            className={cx(
              'flex items-center justify-center gap-2 bg-primary hover:bg-blue-500 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50',
              collapsed ? 'w-full py-2.5' : 'w-full py-2.5 px-3'
            )}
          >
            <Play className="w-4 h-4 fill-current shrink-0" />
            {!collapsed && 'Run Lead Discovery'}
          </button>
        </div>

        <div className={cx('flex items-center justify-between', collapsed ? 'flex-col gap-2' : 'px-1')}>
          <div className={cx('flex items-center gap-2 min-w-0', collapsed && 'flex-col')}>
            <Avatar name={authUser.name} size="sm" />
            {!collapsed && <span className="truncate text-[11px] text-textSecondary">{authUser.name}</span>}
          </div>
          <button onClick={handleLogout} title="Log out" className="text-textSecondary hover:text-danger transition-colors p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background text-textPrimary font-sans antialiased overflow-hidden">
      {/* DESKTOP SIDEBAR */}
      <aside className={cx(
        'hidden md:flex shrink-0 border-r border-muted bg-surface/60 backdrop-blur flex-col justify-between select-none z-20 transition-all duration-200',
        sidebarCollapsed ? 'w-[68px]' : 'w-64'
      )}>
        <div className="px-3 pt-5 pb-3">
          {sidebarBody(sidebarCollapsed)}
        </div>
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute bottom-3 -right-3 hidden lg:flex w-6 h-6 rounded-full bg-elevated border border-muted items-center justify-center text-textSecondary hover:text-textPrimary hover:border-primary/40 z-10"
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface border-r border-muted flex flex-col justify-between select-none animate-slide-up overflow-y-auto">
            <div className="px-4 pt-5 pb-3">{sidebarBody(false)}</div>
          </aside>
        </div>
      )}

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-muted bg-surface/80 backdrop-blur px-4 md:px-6 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-textSecondary hover:text-textPrimary hover:bg-white/[0.06]" aria-label="Open navigation">
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <span className="text-[15px] font-semibold text-textPrimary truncate block leading-tight">{VIEW_META[view].title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusPill label={integrations.email ? 'Email' : 'Email off'} connected={integrations.email} subtle />
            <StatusPill label={integrations.calendar ? 'Calendar' : 'Calendar off'} connected={integrations.calendar} subtle />
            <StatusPill label={integrations.whatsapp ? 'WhatsApp' : 'WhatsApp off'} connected={integrations.whatsapp} />
            {isDemo && (
              <span className="px-2.5 py-1.5 rounded-lg border border-warning/30 bg-warning/10 text-amber-300 text-[11px] font-medium hidden sm:inline-flex">
                Demo mode
              </span>
            )}
            <span className="hidden lg:block text-[12px] font-medium text-textSecondary whitespace-nowrap ml-1 max-w-[140px] truncate">{workspace?.name || 'Workspace'}</span>
            <Dropdown
              trigger={
                <div className="flex items-center gap-2 pl-2 ml-1">
                  <Avatar name={authUser.name} size="sm" />
                  <ChevronDown className="w-3.5 h-3.5 text-textSecondary" />
                </div>
              }
            >
              {(close) => (
                <div className="p-1.5">
                  <div className="px-3 py-2.5 border-b border-muted/60 mb-1">
                    <div className="text-[13px] font-semibold text-textPrimary truncate">{authUser.name}</div>
                    <div className="text-[11px] text-textSecondary truncate">{authUser.email}</div>
                  </div>
                  <button
                    onClick={() => { close(); setView('settings'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-textPrimary hover:bg-white/[0.05] transition-colors"
                  >
                    <Settings className="w-4 h-4 text-textSecondary" /> Settings
                  </button>
                  <button
                    onClick={() => { close(); setView('activity'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-textPrimary hover:bg-white/[0.05] transition-colors"
                  >
                    <Activity className="w-4 h-4 text-textSecondary" /> Agent Activity
                  </button>
                  <button
                    onClick={() => { close(); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-red-300 hover:bg-danger/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </Dropdown>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {view === 'overview' && (
            <Dashboard
              dashboardData={dashboardData}
              leadsList={leadsList}
              meetingsList={meetingsList}
              agentLogs={agentLogs}
              loading={loading}
              isDemo={isDemo}
              integrations={integrations}
              userName={authUser.name}
              onRunDiscovery={() => runDiscovery('leads')}
              onSelectLead={openLeadDetail}
              onViewPipeline={() => setView('pipeline')}
              onViewLeads={() => setView('leads')}
              onViewMeetings={() => setView('meetings')}
              onViewActivity={() => setView('activity')}
            />
          )}

          {view === 'leads' && (
            <LeadsPage
              leadsList={leadsList}
              loading={loading}
              onSelectLead={openLeadDetail}
              onReRunDiscovery={async () => {
                await withBusy(async () => {
                  const disc = await api.discoverLeads();
                  await refreshData({ quiet: true });
                  toast('success', 'Discovery complete', `${disc?.candidatesCount ?? '?'} candidates scanned.`);
                  const top = (disc?.leads || []).find((l: any) => l.stage !== 'Not Qualified') || disc?.leads?.[0];
                  if (top) await openLeadDetail(top.id);
                }, 'Re-running discovery & cheap filter...');
              }}
            />
          )}

          {view === 'leadDetail' && leadDetail && (
            <LeadDetail
              lead={leadDetail}
              loading={loading}
              integrations={integrations}
              isDemo={isDemo}
              onBack={() => setView('leads')}
              onRefresh={async () => loadLead(leadDetail.id)}
              onRunResearch={async () => {
                await withBusy(async () => {
                  await api.runResearch(leadDetail.id);
                  await loadLead(leadDetail.id);
                  await refreshData({ quiet: true });
                  toast('success', 'Research complete', 'Evidence updated for this company.');
                }, 'Researching this company…');
              }}
              onMatchService={async () => {
                await withBusy(async () => {
                  await api.matchService(leadDetail.id);
                  await loadLead(leadDetail.id);
                  toast('success', 'Service matched', 'Best-fit offering identified from your knowledge.');
                }, 'Matching a service from your company knowledge…');
              }}
              onGetDecisionMakers={async () => {
                await withBusy(async () => {
                  await api.getDecisionMakers(leadDetail.id);
                  await loadLead(leadDetail.id);
                  toast('success', 'Contacts identified', 'Decision makers added to this lead.');
                }, 'Identifying decision makers…');
              }}
              onGenerateOutreach={async () => {
                await withBusy(async () => {
                  const dm = leadDetail.decision_makers?.[0];
                  await api.generateOutreach(leadDetail.id, dm?.id);
                  await loadLead(leadDetail.id);
                  toast('success', 'Message drafted', 'A grounded outreach message is ready for review.');
                }, 'Writing an outreach message…');
              }}
              onSendOutreach={async () => {
                await withBusy(async () => {
                  const res = await api.sendOutreach(leadDetail.id, leadDetail.outreach_message?.id);
                  setAgentStatus(`Email ${res.message.status} (${res.message.provider_status}).`);
                  if (res.message.status === 'sent') toast('success', 'Email sent', `Delivered via ${res.message.provider_status}.`);
                  else if (res.message.status === 'failed') toast('error', 'Email failed', res.message.provider_status);
                  else toast('warning', 'Not actually sent', `${res.message.status} (${res.message.provider_status})`);
                  await loadLead(leadDetail.id);
                }, 'Sending outreach…');
              }}
              onSimulateReply={async (text) => {
                await withBusy(async () => {
                  const res = await api.simulateReply(leadDetail.id, text);
                  setAgentStatus(`Reply classified: ${res.classification}. Next action: ${res.nextAction}`);
                  toast('info', `Reply: ${res.classification}`, res.nextAction);
                  await loadLead(leadDetail.id);
                }, 'Classifying reply intent…');
              }}
              onTriggerFollowUp={async () => {
                await withBusy(async () => {
                  await api.triggerFollowUp(leadDetail.id);
                  await loadLead(leadDetail.id);
                  toast('success', 'Follow-up sent', 'Scheduled in the follow-up sequence.');
                }, 'Sending follow-up…');
              }}
              onPauseFollowUp={async (days) => {
                await withBusy(async () => {
                  await api.pauseFollowUp(leadDetail.id, days);
                  await loadLead(leadDetail.id);
                  toast('info', 'Follow-up paused', `Paused for ${days} day${days === 1 ? '' : 's'}.`);
                });
              }}
              onResumeFollowUp={async () => {
                await withBusy(async () => {
                  await api.resumeFollowUp(leadDetail.id);
                  await loadLead(leadDetail.id);
                  toast('success', 'Follow-up resumed', 'Back in the sequence.');
                });
              }}
              onCancelFollowUp={async (reason) => {
                await withBusy(async () => {
                  await api.cancelFollowUp(leadDetail.id, reason || 'Cancelled by admin');
                  await loadLead(leadDetail.id);
                  toast('info', 'Follow-up cancelled', reason || 'Cancelled by admin');
                });
              }}
              onSetDnc={async (value, reason) => {
                await withBusy(async () => {
                  await api.setDnc(leadDetail.id, value, reason);
                  await loadLead(leadDetail.id);
                  toast('warning', value ? 'Do not contact' : 'Re-enabled', reason);
                });
              }}
            />
          )}

          {view === 'pipeline' && (
            <PipelineView
              leadsList={leadsList}
              onSelectLead={openLeadDetail}
              onMoveStage={async (stage, leadId, reason, confirmed) => {
                return await withBusy(async () => {
                  return await api.moveStage(leadId, stage, reason, confirmed);
                });
              }}
            />
          )}

          {view === 'company' && (
            <CompanyView
              companyName={companyName}
              setCompanyName={setCompanyName}
              companyText={companyText}
              setCompanyText={setCompanyText}
              companyProfile={companyProfile}
              documents={documents}
              chunks={chunks}
              loading={loading}
              onIngest={async () => {
                await withBusy(async () => {
                  await api.ingestCompany(companyName, companyText);
                  await refreshData({ quiet: true });
                  toast('success', 'Knowledge processed', 'Your company profile is now indexed.');
                }, 'Processing your company knowledge…');
              }}
              onRefresh={async () => refreshData({ quiet: true })}
            />
          )}

          {view === 'icp' && (
            <IcpWizard
              icpForm={icpForm}
              setIcpForm={setIcpForm}
              loading={loading}
              onSaveIcp={async () => {
                let result: any[] = [];
                await withBusy(async () => {
                  setAgentStatus(`Sourcing and cheap filtering candidates in ${icpForm.location || 'target region'}...`);
                  const icp = await api.createICP(icpForm);
                  const disc = await api.discoverLeads(icp.id);
                  result = disc.leads || [];
                  await refreshData({ quiet: true });
                  const topLead = result.find((l) => l.stage !== 'Not Qualified') || result[0];
                  if (topLead) {
                    await openLeadDetail(topLead.id);
                  }
                  setAgentStatus(`Sourced ${disc.candidatesCount} candidates; ${disc.passed} matched, ${disc.rejected} filtered out.`);
                  toast('success', 'Discovery started', `${disc.candidatesCount} candidates found, ${disc.passed} matched your profile.`);
                }, `Finding companies in ${icpForm.location}…`);
                return result;
              }}
            />
          )}

          {view === 'outreach' && (
            <OutreachView
              leadsList={leadsList}
              selectedLead={leadDetail?.id === selectedLeadId ? leadDetail : null}
              onSelectLead={async (id) => {
                await loadLead(id);
                setView('outreach');
              }}
              integrations={integrations}
              replyInput={replyInput}
              setReplyInput={setReplyInput}
              onGenerate={async (id, contactId) => {
                await withBusy(async () => {
                  await api.generateOutreach(id, contactId);
                  await loadLead(id);
                  toast('success', 'Message drafted', 'Ready for your review before sending.');
                }, 'Writing an outreach message…');
              }}
              onSend={async (id, messageId, subject, body) => {
                await withBusy(async () => {
                  const res = await api.sendOutreach(id, messageId, subject, body);
                  setAgentStatus(`Email ${res.message.status} (${res.message.provider_status}).`);
                  if (res.message.status === 'sent') toast('success', 'Email sent', `Delivered via ${res.message.provider_status}.`);
                  else if (res.message.status === 'failed') toast('error', 'Email failed', res.message.provider_status);
                  else toast('warning', 'Not actually sent', `${res.message.status} (${res.message.provider_status})`);
                  await loadLead(id);
                }, 'Sending outreach…');
              }}
              onSaveDraft={async (id, messageId, subject, body) => {
                await withBusy(async () => {
                  await api.saveOutreachDraft(id, messageId, subject, body);
                  await loadLead(id);
                  toast('success', 'Draft saved');
                }, 'Saving draft…');
              }}
              onRegenerate={async (id, contactId) => {
                await withBusy(async () => {
                  await api.generateOutreach(id, contactId);
                  await loadLead(id);
                  toast('success', 'Message rewritten');
                }, 'Rewriting the message…');
              }}
              onSimulateReply={async (id, text) => {
                await withBusy(async () => {
                  const res = await api.simulateReply(id, text || replyInput);
                  setAgentStatus(`Reply classified: ${res.classification}. Next action: ${res.nextAction}`);
                  toast('info', `Reply: ${res.classification}`, res.nextAction);
                  await loadLead(id);
                }, 'Classifying reply intent…');
              }}
            />
          )}

          {view === 'meetings' && (
            <MeetingsView meetingsList={meetingsList} onSelectLead={openLeadDetail} integrations={integrations} />
          )}

          {view === 'activity' && (
            <ActivityView agentRuns={agentRuns} agentLogs={agentLogs} onSelectLead={openLeadDetail} />
          )}

          {view === 'logs' && <AuditLogsView agentLogs={agentLogs} />}

          {view === 'settings' && (
            <SettingsView
              settings={settings}
              user={authUser}
              onUpdate={async (data) => {
                await withBusy(async () => {
                  await api.updateSettings(data);
                  await refreshData({ quiet: true });
                  toast('success', 'Settings saved');
                });
              }}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}