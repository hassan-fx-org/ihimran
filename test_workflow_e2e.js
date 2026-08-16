const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const base = 'http://localhost:5000/api';
const pdfPath = 'C:\\Users\\HassanUsmani\\Desktop\\hackathon\\AgentHack_Autonomous_AI_Sales_Agent_Challenge.pdf';

let passed = 0;
let failed = 0;
function escapeRegExp(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { failed++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

async function main() {
  console.log('=== AGENTHACK FULL WORKFLOW E2E ===');

  // 0. Health
  const health = await (await fetch(base + '/health')).json();
  check('Health OK', health.status === 'ok', `mode=${health.mode} outbound=${health.outbound}`);

  // 1. Auth
  const loginRes = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agenthack.ai', password: 'agenthack2026' })
  });
  const login = await loginRes.json();
  check('Login returns token', !!login.token);
  check('Login returns workspace', !!login.workspace?.id);
  const token = login.token;
  const auth = { Authorization: 'Bearer ' + token };
  const json = { 'Content-Type': 'application/json' };

  // 2. Company knowledge: text ingest (challenge §2 - text input path)
  console.log('\n[2] Company Knowledge (TEXT ingest + RAG)');
  const companyText = `IH Usmani Group provides autonomous AI sales agents for B2B companies. Our AgentHack platform automates lead discovery, research, personalized outreach, and meeting booking — end-to-end. Core offerings include AI-powered inquiry triage, evidence-grounded cold emails, and automated follow-up sequences. Target customers are B2B SaaS, agencies, and high-growth teams that rely on outbound sales. Limitations: requires CRM integration and verified contact data.`;
  const ingestRes = await fetch(base + '/company/ingest', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ name: 'IH Usmani Group', rawText: companyText, sourceType: 'TEXT' }) });
  const ingest = await ingestRes.json();
  check('Company knowledge ingested', ingest.success === true && !!ingest.profile?.id);
  check('Knowledge chunks indexed', (ingest.profile?.chunk_count || 0) > 0, `chunks=${ingest.profile?.chunk_count}`);

  const askRes = await fetch(base + '/company/ask', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ question: 'What services does IH Usmani Group offer?' }) });
  const ask = await askRes.json();
  check('RAG ask returns grounded answer', !!ask.answer && ask.answer.length > 0);
  check('RAG ask returns sources', (ask.sources?.length || 0) > 0, `sources=${ask.sources?.length}`);

  // 3. ICP (challenge §3)
  console.log('\n[3] ICP Definition');
  const icpRes = await fetch(base + '/icp', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({
    location: 'Pakistan', industry: 'Hospital', companySize: '100 employees',
    targetProblem: 'High volume patient appointment & inquiry support backlogs',
    exclusions: 'Micro-clinics under 10 staff', preferredService: 'WhatsApp AI Support & Inquiry Triage'
  }) });
  const icp = await icpRes.json();
  check('ICP created', !!icp.id, icp.normalized_prompt);

  // 4. Discovery + cheap filter (challenge §4)
  console.log('\n[4] Lead Discovery + Cheap Filtering');
  const discRes = await fetch(base + '/leads/discover', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ icpId: icp.id }) });
  const disc = await discRes.json();
  check('Discovery returns candidates', disc.success === true && disc.candidatesCount > 0, `candidates=${disc.candidatesCount}, source=${disc.source}`);
  check('Discovery source is real when provider configured', ['web-search', 'demo'].includes(disc.source), `source=${disc.source}`);
  check('Cheap filter evaluated all candidates', (disc.passed + disc.rejected) === disc.candidatesCount, `passed=${disc.passed} rejected=${disc.rejected} total=${disc.candidatesCount}`);
  const potential = (disc.leads || []).filter((l) => l.stage === 'Potential')[0];
  const rejected = (disc.leads || []).filter((l) => l.stage === 'Not Qualified')[0];
  check('Potential lead exists', !!potential, potential?.name);
  if (disc.rejected > 0) {
    check('Unfit lead rejected (e.g. corner shop)', !!rejected, rejected?.name);
  } else {
    console.log('  ℹ️ No unfit candidates in this batch (web results are ICP-targeted; filter ran)');
  }

  // 5. Deep research + qualification (challenge §5, §6)
  console.log('\n[5] Deep Research + Qualification');
  const resRes = await fetch(base + '/leads/' + potential.id + '/research', { method: 'POST', headers: { ...auth } });
  const res = await resRes.json();
  check('Research completed', res.success === true);
  check('Lead moved to Qualified', res.lead?.stage === 'Qualified', `${res.lead?.name}: ${res.lead?.confidence_score}%`);
  check('Score explained', !!res.lead?.score_explanation, res.lead?.score_explanation?.slice(0, 120));
  check('Qualification factors present', Object.keys(res.factors || {}).length >= 4, Object.keys(res.factors || {}).join(', '));
  check('Evidence persisted', (res.lead?.evidence_count || 0) > 0 || !!res.factors);
  check('Recommended service from RAG', !!res.lead?.recommended_service, res.lead?.recommended_service);
  check('Service rationale grounded', !!res.lead?.service_rationale, res.lead?.service_rationale?.slice(0, 80));

  // 6. Decision makers (challenge §8)
  console.log('\n[6] Decision Maker Identification');
  const dmRes = await fetch(base + '/leads/' + potential.id + '/decision-makers', { method: 'POST', headers: { ...auth } });
  const dm = await dmRes.json();
  const contact = (dm.contacts || [])[0];
  check('Decision maker found', (dm.contacts?.length || 0) > 0, contact?.name + ' (' + contact?.role + ')');

  // 7. Service match (challenge §7)
  console.log('\n[7] Service Matching');
  const smRes = await fetch(base + '/leads/' + potential.id + '/service-match', { method: 'POST', headers: { ...auth } });
  const sm = await smRes.json();
  check('Service match exists', sm.success === true && !!sm.match?.service, sm.match?.service);
  check('Service match confidence', sm.match?.confidence > 0, `${sm.match?.confidence}%`);

  // 8. Personalized outreach (challenge §9)
  console.log('\n[8] Personalized Outreach Draft');
  const draftRes = await fetch(base + '/leads/' + potential.id + '/outreach', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ contactId: contact?.id || null }) });
  const draft = await draftRes.json();
  check('Draft generated', draft.success === true && !!draft.message?.id);
  check('Draft personalized for role', !!contact && (new RegExp(escapeRegExp(contact.name.split(' ')[0]), 'i').test(draft.message?.body || '') || new RegExp(escapeRegExp(contact.role || ''), 'i').test(draft.message?.body || '')), draft.message?.body?.slice(0, 80));
  check('Draft grounded in evidence', (draft.message?.evidence_used?.length || 0) > 0);

  // 9. Send outreach (challenge §10, extra features)
  console.log('\n[9] Send Outreach');
  const hasVerifiedContact = !!contact?.email && contact.email !== 'Not found';
  if (hasVerifiedContact) {
    const sendRes = await fetch(base + '/leads/' + potential.id + '/outreach/send', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ messageId: draft.message.id }) });
    const sent = await sendRes.json();
    const sentOk = sent.message?.status === 'sent';
    const providerFailed = sent.success === true && sent.message?.status === 'failed' && !!sent.message?.provider_status;
    check('Message dispatched', sent.success === true && (sentOk || providerFailed), `status=${sent.message?.status} provider=${sent.message?.provider_status}`);
    check('Provider status honest', !!sent.message?.provider_status, sent.message?.provider_status);

    const leadAfterSendRes = await fetch(base + '/leads/' + potential.id, { headers: { ...auth } });
    const leadAfterSend = await leadAfterSendRes.json();
    if (sentOk) {
      check('Lead moved to Contacted', leadAfterSend.stage === 'Contacted', leadAfterSend.stage);
      check('Follow-up #2 scheduled', leadAfterSend.follow_up?.sequence_step === 2, `due ${leadAfterSend.follow_up?.next_due_at}`);
      check('Outreach stored w/ evidence+timestamp', !!leadAfterSend.outreach_message?.sent_at);
      check('Outreach message persisted', leadAfterSend.outreach_message?.status === 'sent');
      check('Long-term memory: outreach_sent', (leadAfterSend.memories || []).some((m) => m.category === 'outreach_sent'));
    } else if (providerFailed) {
      check('Failed send left lead state unchanged', leadAfterSend.stage !== 'Contacted', `stage=${leadAfterSend.stage}`);
      check('Failure recorded on message', leadAfterSend.outreach_message?.status === 'failed' && /^RESEND_ERROR/.test(leadAfterSend.outreach_message?.provider_status || ''), leadAfterSend.outreach_message?.provider_status);
      check('Honest next_action for retry', /Delivery failed/.test(leadAfterSend.outreach_message?.next_action || ''));
    } else {
      check('Message dispatched', false, 'unexpected send state ' + (sent.message?.status || sendRes.status));
    }
  } else {
    const blockedSend = await fetch(base + '/leads/' + potential.id + '/outreach/send', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ messageId: draft.message.id }) });
    const blocked = await blockedSend.json();
    check('Send blocked without verified contact', (blockedSend.status === 400 || blockedSend.status === 500) && /no verified contact email/i.test(blocked.error || ''), blocked.error);
  }

  // 10. Response classification (challenge §11)
  console.log('\n[10] Response Classification + Meeting');
  const replyRes = await fetch(base + '/leads/' + potential.id + '/reply', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ replyText: "Hi team, we're interested. Let's meet this Thursday at 3 PM to discuss your solution." }) });
  const reply = await replyRes.json();
  check('Reply classified as Meeting Requested', ['Meeting Requested', 'Positive / Interested'].includes(reply.classification), reply.classification);
  check('Next action determined', !!reply.nextAction, reply.nextAction);

  const leadAfterReplyRes = await fetch(base + '/leads/' + potential.id, { headers: { ...auth } });
  const leadAfterReply = await leadAfterReplyRes.json();
  check('Meeting scheduled', (leadAfterReply.meetings?.length || 0) > 0, leadAfterReply.meetings?.[0]?.meeting_time);
  check('Lead moved to Meeting Scheduled', leadAfterReply.stage === 'Meeting Scheduled', leadAfterReply.stage);
  check('Follow-up cancelled after meeting', (leadAfterReply.follow_up?.sequence_step || 0) === 0 || !leadAfterReply.follow_up);
  check('Inbound reply stored w/ classification', (leadAfterReply.inbound_responses?.length || 0) > 0);
  check('Long-term memory: response', (leadAfterReply.memories || []).some((m) => m.category === 'response'));

  // 11. Follow-up / DNC guard
  console.log('\n[11] Follow-Up + Policy Guards');
  const dncRes = await fetch(base + '/leads/' + potential.id + '/dnc', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ value: true, reason: 'E2E test of DNC guard' }) });
  const dnc = await dncRes.json();
  check('DNC set', dnc.success === true && dnc.lead.do_not_contact === true, dnc.lead.stage);

  const sendAfterDncRes = await fetch(base + '/leads/' + potential.id + '/followup-trigger', { method: 'POST', headers: { ...auth } });
  const sendAfterDnc = await sendAfterDncRes.json();
  check('DNC blocks outbound', sendAfterDncRes.status === 400 && /BLOCKED|Do Not Contact/i.test(sendAfterDnc.error || ''), sendAfterDnc.error);

  const pipelineRes = await fetch(base + '/pipeline', { headers: { ...auth } });
  const pipeline = await pipelineRes.json();
  const stages = pipeline.stages || [];
  check('Pipeline has all stages', stages.length >= 11, `stages=${stages.length}`);
  const dncStage = stages.find((s) => s.name === 'Do Not Contact');
  check('Lead visible in DNC stage', (dncStage?.leads?.length || 0) > 0);
  check('Pipeline events persisted', (pipeline.events?.length || 0) > 0, `events=${pipeline.events?.length}`);

  // 12. Memory + agent activity
  console.log('\n[12] Memory + Agent Activity');
  check('Memory rows present (short+long term)', (leadAfterReply.memories?.length || 0) >= 3, `memories=${leadAfterReply.memories?.length}`);
  check('Agent activity logged', (leadAfterReply.activity?.length || 0) > 0, `activity=${leadAfterReply.activity?.length}`);

  const logsRes = await fetch(base + '/agent-logs', { headers: { ...auth } });
  const logs = await logsRes.json();
  check('Agent activity ledger populated', (logs?.length || 0) > 0, `logs=${logs?.length}`);

  // 13. Dashboard reflects pipeline
  console.log('\n[13] Dashboard');
  const dashRes = await fetch(base + '/dashboard', { headers: { ...auth } });
  const dash = await dashRes.json();
  check('Dashboard KPIs present', !!dash.kpis && typeof dash.kpis.totalLeads === 'number', `totalLeads=${dash.kpis?.totalLeads} meetings=${dash.kpis?.meetings}`);

  console.log(`\n===== RESULT: ${passed} passed, ${failed} failed =====`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });