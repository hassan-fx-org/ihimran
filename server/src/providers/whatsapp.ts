import dotenv from 'dotenv';

dotenv.config();

export interface WhatsAppResult {
  status: 'sent' | 'simulated' | 'failed';
  providerStatus: string;
  error?: string;
}

/**
 * Admin WhatsApp notifications (meeting finalized + 30-minute reminders).
 * Sends via Twilio WhatsApp when credentials are configured. Otherwise it
 * NEVER fabricates a delivery — it records a clearly-labeled SIMULATED result
 * so the admin knows nothing was actually sent.
 */
export async function sendWhatsApp(opts: {
  to: string;
  body: string;
}): Promise<WhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from || process.env.DEMO_MODE === 'true') {
    return { status: 'simulated', providerStatus: 'SIMULATED' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        },
        body: new URLSearchParams({ To: opts.to, From: from, Body: opts.body }).toString(),
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data: any = await res.json().catch(() => ({}));
      return { status: 'sent', providerStatus: data?.sid ? `TWILIO:${data.sid}` : 'SENT' };
    }
    const data: any = await res.json().catch(() => ({}));
    return { status: 'failed', providerStatus: `TWILIO_ERROR:${res.status}`, error: data?.message || `Twilio returned HTTP ${res.status}` };
  } catch (e) {
    return { status: 'failed', providerStatus: 'TWILIO_ERROR', error: (e as Error).message };
  }
}

export const whatsapp = {
  send: sendWhatsApp,
  isSimulated: () => !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_WHATSAPP_FROM || process.env.DEMO_MODE === 'true',
  adminNumber: () => process.env.ADMIN_WHATSAPP_TO || 'Not configured'
};