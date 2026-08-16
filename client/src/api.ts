import axios from 'axios';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:5000/api';
const TOKEN_KEY = 'agenthack_token';

const http = axios.create({ baseURL: API_BASE });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  get base() {
    return API_BASE;
  },
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string | null) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  // auth
  login: (email: string, password: string) => http.post('/auth/login', { email, password }).then((r) => r.data),
  demoLogin: () => http.post('/auth/demo-login').then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),

  // health / activity
  getHealth: () => http.get('/health').then((r) => r.data),
  getAgentLogs: () => http.get('/agent-logs').then((r) => r.data),
  getAgentRuns: () => http.get('/agent-runs').then((r) => r.data),

  // company knowledge
  getCompany: () => http.get('/company').then((r) => r.data),
  getDocuments: () => http.get('/company/documents').then((r) => r.data),
  getChunks: () => http.get('/company/chunks').then((r) => r.data),
  ingestCompany: (name: string, rawText: string) => http.post('/company/ingest', { name, rawText, sourceType: 'TEXT' }).then((r) => r.data),
  uploadPdfDocument: (file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return http
      .post('/company/documents/upload', fd, { onUploadProgress: (e) => onProgress?.(Math.round(((e.loaded || 0) / (e.total || 1)) * 100)) })
      .then((r) => r.data);
  },
  getDocumentStatus: (id: string) => http.get(`/company/documents/${id}/status`).then((r) => r.data),
  reprocessDocument: (id: string) => http.post(`/company/documents/${id}/reprocess`).then((r) => r.data),
  deleteDocument: (id: string) => http.delete(`/company/documents/${id}`).then((r) => r.data),
  getDocumentChunks: (id: string) => http.get(`/company/documents/${id}/chunks`).then((r) => r.data),
  askCompany: (question: string, history?: { q: string; a: string }[]) => http.post('/company/ask', { question, history: history || [] }).then((r) => r.data),

  // icp
  createICP: (data: any) => http.post('/icp', data).then((r) => r.data),
  getIcps: () => http.get('/icps').then((r) => r.data),

  // leads
  discoverLeads: (icpId?: string) => http.post('/leads/discover', { icpId }).then((r) => r.data),
  getLeads: () => http.get('/leads').then((r) => r.data),
  getLeadDetail: (id: string) => http.get(`/leads/${id}`).then((r) => r.data),
  runResearch: (id: string) => http.post(`/leads/${id}/research`).then((r) => r.data),
  matchService: (id: string) => http.post(`/leads/${id}/service-match`).then((r) => r.data),
  getDecisionMakers: (id: string) => http.post(`/leads/${id}/decision-makers`).then((r) => r.data),
  generateOutreach: (id: string, contactId?: string) => http.post(`/leads/${id}/outreach`, { contactId }).then((r) => r.data),
  sendOutreach: (id: string, messageId?: string, subject?: string, body?: string) => http.post(`/leads/${id}/outreach/send`, { messageId, subject, body }).then((r) => r.data),
  saveOutreachDraft: (id: string, messageId: string, subject: string, body: string) => http.post(`/leads/${id}/outreach/draft`, { messageId, subject, body }).then((r) => r.data),
  simulateReply: (id: string, replyText?: string) => http.post(`/leads/${id}/reply`, { replyText }).then((r) => r.data),
  triggerFollowUp: (id: string) => http.post(`/leads/${id}/followup-trigger`).then((r) => r.data),
  pauseFollowUp: (id: string, days?: number) => http.post(`/leads/${id}/followup/pause`, { days }).then((r) => r.data),
  resumeFollowUp: (id: string) => http.post(`/leads/${id}/followup/resume`).then((r) => r.data),
  cancelFollowUp: (id: string, reason?: string) => http.post(`/leads/${id}/followup/cancel`, { reason }).then((r) => r.data),
  setDnc: (id: string, value: boolean, reason?: string) => http.post(`/leads/${id}/dnc`, { value, reason }).then((r) => r.data),

  // pipeline
  getPipeline: () => http.get('/pipeline').then((r) => r.data),
  moveStage: (leadId: string, toStage: string, reason?: string, confirmed?: boolean) =>
    http.post('/pipeline/move', { leadId, toStage, reason, confirmed }).then((r) => r.data),

  // meetings
  getMeetings: () => http.get('/meetings').then((r) => r.data),
  getMeeting: (id: string) => http.get(`/meetings/${id}`).then((r) => r.data),

  // settings
  getSettings: () => http.get('/settings').then((r) => r.data),
  updateSettings: (data: any) => http.put('/settings', data).then((r) => r.data),
  testIntegrations: () => http.get('/integrations/test').then((r) => r.data),

  // dashboard / demo
  getDashboard: () => http.get('/dashboard').then((r) => r.data),
  runDemo: () => http.post('/demo/run').then((r) => r.data),
};

export function extractError(err: any): string {
  return err?.response?.data?.error || err?.message || 'Request failed.';
}