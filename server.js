import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = 'Exord Online HRM <onboarding@resend.dev>';

const sendEmail = async (to, subject, html, text) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
};

// ── Broadcast email ────────────────────────────────────────────────────────
app.post('/email/broadcast', async (req, res) => {
  const { recipients, subject, message, type, senderName } = req.body;
  if (!recipients?.length || !subject || !message) {
    return res.status(400).json({ error: 'recipients, subject and message are required.' });
  }
  const typeLabel = {
    GENERAL: 'General Announcement', SALARY: 'Salary Notice',
    LEAVE: 'Leave Notice', SYSTEM: 'System Notice',
  };
  const buildHtml = (name) => `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:#E31E24;padding:24px 28px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900">Exord Online</h1>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:2px">${typeLabel[type] || 'Announcement'}</p>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 16px;font-size:14px;color:#64748b">Dear <strong style="color:#0f172a">${name}</strong>,</p>
    <h2 style="font-size:18px;font-weight:900;color:#0f172a;margin:0 0 12px">${subject}</h2>
    <div style="font-size:14px;color:#475569;line-height:1.8;white-space:pre-line;background:#f8fafc;border-left:4px solid #E31E24;padding:14px 18px;border-radius:0 8px 8px 0">${message}</div>
  </div>
  <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Sent by <strong>${senderName || 'Exord HRM'}</strong> · Do not reply.</p>
  </div>
</div></body></html>`;

  let sent = 0;
  const errors = [];
  for (const r of recipients) {
    try {
      await sendEmail(r.email, subject, buildHtml(r.name), message);
      sent++;
    } catch (e) {
      errors.push(`${r.email}: ${e.message}`);
    }
  }
  res.json({ success: sent > 0, sent, failed: errors.length, errors });
});

// ── Salary slip email ──────────────────────────────────────────────────────
app.post('/email/salary-slip', async (req, res) => {
  const { recipientEmail, recipientName, period, base, bonus, deductions, net, status, lateCount, lateDeduction } = req.body;
  if (!recipientEmail || !period) {
    return res.status(400).json({ error: 'recipientEmail and period are required.' });
  }
  const fmt = (n) => '৳ ' + Number(n).toLocaleString('en-BD');
  const sc = status === 'PAID' ? '#10b981' : '#f59e0b';
  const sb = status === 'PAID' ? '#f0fdf4' : '#fffbeb';
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;padding:24px 28px;display:flex;align-items:center;gap:12px">
    <div style="width:36px;height:36px;background:#E31E24;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff">E</div>
    <div><h1 style="color:#fff;margin:0;font-size:18px;font-weight:900"><span style="color:#E31E24">Exord</span> Online</h1>
    <p style="color:#94a3b8;margin:2px 0 0;font-size:10px">Human Resources Management</p></div>
  </div>
  <div style="padding:24px 28px 0">
    <p style="font-size:20px;font-weight:900;color:#0f172a;margin:0">Salary Slip</p>
    <p style="font-size:12px;color:#64748b;margin:4px 0 16px">${period}</p>
    <p style="font-size:14px;color:#475569;margin:0 0 16px">Dear <strong>${recipientName}</strong>, your salary for <strong>${period}</strong> is ready.</p>
  </div>
  <div style="margin:0 28px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f0fdf4"><td style="padding:12px 16px;font-size:13px;color:#475569;border-bottom:1px solid #dcfce7">Basic Salary</td><td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0f172a;text-align:right;border-bottom:1px solid #dcfce7">${fmt(base)}</td></tr>
      <tr style="background:#f0fdf4"><td style="padding:12px 16px;font-size:13px;color:#16a34a;border-bottom:1px solid #dcfce7">Bonus / Allowances</td><td style="padding:12px 16px;font-size:13px;font-weight:700;color:#16a34a;text-align:right;border-bottom:1px solid #dcfce7">+${fmt(bonus)}</td></tr>
      <tr style="background:#fff5f5"><td style="padding:12px 16px;font-size:13px;color:#dc2626;border-bottom:1px solid #fecaca">Deductions${lateCount > 0 ? ` (${lateCount} late = ${fmt(lateDeduction)})` : ''}</td><td style="padding:12px 16px;font-size:13px;font-weight:700;color:#dc2626;text-align:right;border-bottom:1px solid #fecaca">-${fmt(deductions)}</td></tr>
      <tr style="background:#0f172a"><td style="padding:16px;font-size:14px;font-weight:900;color:#fff;text-transform:uppercase">Net Payable</td><td style="padding:16px;font-size:20px;font-weight:900;color:#E31E24;text-align:right">${fmt(net)}</td></tr>
    </table>
  </div>
  <div style="padding:16px 28px;text-align:center">
    <span style="display:inline-block;padding:8px 24px;background:${sb};color:${sc};border:2px solid ${sc};border-radius:100px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:2px">${status}</span>
  </div>
  <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Exord Online HRM · Automated salary slip · Do not reply.</p>
  </div>
</div></body></html>`;
  const plain = `Salary Slip — ${period}\nDear ${recipientName},\nBasic: ${fmt(base)}\nBonus: +${fmt(bonus)}\nDeductions: -${fmt(deductions)}\nNet: ${fmt(net)}\nStatus: ${status}`;
  try {
    await sendEmail(recipientEmail, `Your Salary Slip — ${period}`, html, plain);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dynamically import probe routes ───────────────────────────────────────
const { default: probeRoutes } = await import('./probeRoutes.js');
app.use('/probe', probeRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok' }));
const PORT = 8081;
app.listen(PORT, () => {
  console.log(`[Exord Probe Server] Running on port ${PORT}`);
});
