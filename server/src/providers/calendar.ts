import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

export interface MeetingLinkResult {
  link: string;
  provider: string;
  error?: string;
}

/**
 * Calendar/meeting provider. Creates a real Google Meet link when credentials
 * are configured. When not configured it NEVER fabricates a link — it returns
 * an empty link with a NOT_CONFIGURED provider so the UI can honestly tell the
 * user to connect Google Calendar.
 */
export async function createMeetingLink(opts: {
  subject: string;
  when: Date;
  attendeeEmail?: string;
}): Promise<MeetingLinkResult> {
  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  if (clientEmail && privateKey && process.env.DEMO_MODE !== 'true') {
    try {
      const { google } = await import('googleapis');
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      const calendar = google.calendar({ version: 'v3', auth });
      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: opts.subject,
          start: { dateTime: opts.when.toISOString() },
          end: { dateTime: new Date(opts.when.getTime() + 30 * 60000).toISOString() },
          conferenceData: {
            createRequest: { requestId: randomUUID() }
          }
        },
        conferenceDataVersion: 1
      });
      if (event.data.hangoutLink) {
        return { link: event.data.hangoutLink, provider: 'GOOGLE_CALENDAR' };
      }
      return {
        link: '',
        provider: 'GOOGLE_CALENDAR_ERROR',
        error: 'Google Calendar created the event, but Google Meet conferencing is not enabled for this calendar (service account without domain-wide delegation), so no meeting link was generated.'
      };
    } catch (e) {
      console.warn('⚠️ Google Calendar failed:', (e as Error).message);
      return { link: '', provider: 'GOOGLE_CALENDAR_ERROR', error: (e as Error).message };
    }
  }

  return { link: '', provider: 'NOT_CONFIGURED' };
}

export const calendar = {
  createMeeting: createMeetingLink,
  isSimulated: () => !process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || process.env.DEMO_MODE === 'true'
};