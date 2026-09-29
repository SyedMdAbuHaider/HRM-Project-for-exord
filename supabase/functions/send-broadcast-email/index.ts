/**
 * send-broadcast-email
 * Supabase Edge Function — sends broadcast emails via Gmail SMTP.
 *
 * ── Deploy ────────────────────────────────────────────────────────────────────
 *   supabase functions deploy send-broadcast-email --no-verify-jwt
 *
 * ── Secrets (Supabase Dashboard → Edge Functions → Manage secrets) ────────────
 *   GMAIL_USER = exordonline.official@gmail.com
 *   GMAIL_PASS = <your NEW Gmail App Password after revoking the exposed one>
 *
 * Emails are sent individually so each recipient sees only their own address.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { recipients, subject, message, type, senderName } = await req.json() as {
      recipients: { email: string; name: string }[];
      subject: string;
      message: string;
      type: string;
      senderName: string;
    };

    const GMAIL_USER = Deno.env.get('GMAIL_USER');
    const GMAIL_PASS = Deno.env.get('GMAIL_PASS');

    if (!GMAIL_USER || !GMAIL_PASS) {
      return json({ error: 'GMAIL_USER and GMAIL_PASS secrets are not configured.' }, 500);
    }

    const typeLabel: Record<string, string> = {
      GENERAL: '📢 General Announcement',
      SALARY:  '💵 Salary Notice',
      LEAVE:   '📅 Leave Notice',
      SYSTEM:  '⚙️ System Notice',
    };

    const buildHtml = (recipientName: string) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:Inter,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <div style="background:#E31E24;padding:28px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px">Exord Online</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px">
        ${typeLabel[type] || '📢 Announcement'}
      </p>
    </div>

    <div style="padding:32px">
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">
        Dear <strong style="color:#0f172a">${recipientName}</strong>,
      </p>
      <h2 style="font-size:20px;font-weight:900;color:#0f172a;margin:0 0 16px;line-height:1.3">${subject}</h2>
      <div style="font-size:14px;color:#475569;line-height:1.8;white-space:pre-line;background:#f8fafc;border-left:4px solid #E31E24;padding:16px 20px;border-radius:0 12px 12px 0">
${message}
      </div>
    </div>

    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
        Sent by <strong>${senderName || 'Exord HRM'}</strong> via <strong>Exord Online HRM</strong><br>
        This is an automated message — please do not reply directly to this email.
      </p>
    </div>

  </div>
</body>
</html>`;

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: 'smtp.gmail.com',
      port: 465,
      username: GMAIL_USER,
      password: GMAIL_PASS,
    });

    let sent = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        await client.send({
          from: `Exord Online <${GMAIL_USER}>`,
          to: recipient.email,
          subject,
          content: message,               // plain-text fallback
          html: buildHtml(recipient.name),
        });
        sent++;
      } catch (e: any) {
        errors.push(`${recipient.email}: ${e.message}`);
      }
    }

    await client.close();

    return json({ success: true, sent, failed: errors.length, errors });

  } catch (err: any) {
    return json({ error: err.message || String(err) }, 500);
  }
});
