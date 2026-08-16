import dotenv from 'dotenv';

dotenv.config();

export interface SendResult {
  status: 'sent' | 'failed' | 'blocked';
  providerStatus: string;
  error?: string;
}

/**
 * Outbound email provider. 
 * - If OUTBOUND_ENABLED is false -> blocked (kill switch).
 * - If no RESEND_API_KEY -> failed with honest error.
 * - Otherwise sends via Resend.
 * - If EMAIL_TEST_RECIPIENT is set, all emails go to that address for testing,
 *   while the original recipient is preserved in the database outreach record.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): Promise<SendResult> {
  if (process.env.OUTBOUND_ENABLED === 'false') {
    return { status: 'blocked', providerStatus: 'OUTBOUND_DISABLED', error: 'Outbound kill switch is enabled.' };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { status: 'failed', providerStatus: 'NOT_CONFIGURED', error: 'Email provider not configured — set RESEND_API_KEY in server/.env.' };
  }

  const testRecipient = process.env.EMAIL_TEST_RECIPIENT;
  const to = testRecipient ? testRecipient : opts.to;

  try {
    const from = opts.from || process.env.EMAIL_SENDER || 'AgentHack Sales <sales@agenthack.ai>';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`
      },
      body: JSON.stringify({ from, to, subject: opts.subject, text: opts.body }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data: any = await res.json();
      return { status: 'sent', providerStatus: data?.id ? `RESEND:${data.id}` : 'SENT' };
    }
    const data: any = await res.json().catch(() => ({}));
    return { status: 'failed', providerStatus: `RESEND_ERROR:${res.status}`, error: data?.message || `Resend returned HTTP ${res.status}` };
  } catch (e) {
    return { status: 'failed', providerStatus: 'RESEND_ERROR', error: (e as Error).message };
  }
}

export const email = {
  send: sendEmail,
  isSimulated: () => false
};