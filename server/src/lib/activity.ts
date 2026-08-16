import { query } from '../db/db';

export interface ActivityEntry {
  agent: string;
  step: string;
  tool: string;
  inputData?: string;
  outputData?: string;
  decision?: string;
  status?: 'running' | 'completed' | 'failed';
  workspaceId?: string;
  leadId?: string;
  durationMs?: number;
}

/**
 * Persists a real agent/tool activity record to the durable activity ledger
 * (agent_activity_logs). This is the source of truth for the Agent Console.
 */
export async function logActivity(entry: ActivityEntry): Promise<any> {
  const duration = entry.durationMs ?? 0;
  try {
    const res = await query(
      `INSERT INTO agent_activity_logs
       (agent_name, step, tool_used, input_data, output_data, decision, duration_ms, status, workspace_id, lead_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        entry.agent,
        entry.step,
        entry.tool,
        entry.inputData || null,
        entry.outputData || null,
        entry.decision || null,
        duration,
        entry.status || 'completed',
        entry.workspaceId || null,
        entry.leadId || null
      ]
    );
    return res.rows[0];
  } catch (e) {
    console.error('Failed to persist activity log:', e);
    return null;
  }
}