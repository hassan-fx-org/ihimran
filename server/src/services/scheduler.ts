import { fetchDueFollowUps, fetchUpcomingMeetingReminders, generateFollowUpEmail, markMeetingReminderSent } from './agentEngine';
import { sendWhatsApp, whatsapp } from '../providers/whatsapp';
import { query } from '../db/db';

let timer: NodeJS.Timeout | null = null;

/**
 * Durable background mechanism for delayed jobs. Follow-up state is persisted
 * in the database, so a crash/restart resumes execution — it does NOT depend
 * on any single HTTP request staying alive.
 */
async function tick() {
  try {
    // 1. Execute due follow-up emails (Day 3 cadence)
    const due = await fetchDueFollowUps();
    for (const task of due) {
      try {
        const lead = await query(
          `SELECT id, do_not_contact, workspace_id FROM leads WHERE id = $1`,
          [task.lead_id]
        );
        const l = lead.rows[0];
        if (!l || l.do_not_contact) {
          await query(`UPDATE follow_up_tasks SET status = 'cancelled', cancel_reason = 'Do Not Contact' WHERE id = $1`, [task.id]);
          continue;
        }
        const ws = await query(`SELECT outbound_enabled FROM workspaces WHERE id = $1`, [l.workspace_id]);
        if (ws.rows[0]?.outbound_enabled === false) continue;
        await generateFollowUpEmail(task.lead_id, l.workspace_id);
      } catch (e) {
        console.error('Follow-up execution error:', (e as Error).message);
      }
    }

    // 2. Dispatch meeting reminders (30-minute briefings) to the admin via WhatsApp
    const meetings = await fetchUpcomingMeetingReminders();
    for (const m of meetings) {
      try {
        const briefing = `⏰ Meeting in 30 minutes — ${m.lead_name || 'Prospect'}
When: ${m.meeting_time ? new Date(m.meeting_time).toISOString() : ''}
Contact: ${m.contact_name || 'N/A'} (${m.contact_role || ''})
Service: ${m.service_to_discuss || ''}
Problem: ${m.problem_summary || m.customer_problem || ''}
Objections expected: ${m.objections_expected || ''}
Key points: ${m.key_discussion_points || ''}
${m.meeting_link ? `Link: ${m.meeting_link}` : 'No meeting link — calendar provider not connected.'}`;
        const wa = await sendWhatsApp({ to: whatsapp.adminNumber(), body: briefing });
        await markMeetingReminderSent(m.id);
        await query(
          `INSERT INTO memories (lead_id, type, category, content)
           VALUES ($1, 'short_term', 'meeting_reminder', $2)`,
          [m.lead_id, `30-minute reminder dispatched for ${m.meeting_time ? new Date(m.meeting_time).toISOString() : ''} (admin WhatsApp: ${wa.providerStatus}).`]
        );
      } catch (e) {
        console.error('Reminder execution error:', (e as Error).message);
      }
    }
  } catch (e) {
    console.error('Scheduler tick error:', (e as Error).message);
  }
}

export function startScheduler() {
  if (timer) return timer;
  tick();
  timer = setInterval(tick, 30000);
  timer.unref?.();
  console.log('⏰ Background scheduler started (30s interval).');
  return timer;
}