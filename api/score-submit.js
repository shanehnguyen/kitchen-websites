import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

import { Resend } from 'resend';

/* =====================================================================
   /api/score-submit — lead capture for the Referral Capture Score.
   Two payload types:
     (default) email gate after Q10  → { firstName, email, business, score,
       segment, urgent, answers[] }. The answers ARE the sales intel
       (HVCO-Funnel-Plan) — forwarded whole.
     type: 'grader' → competitor head-to-head request from the results page.
   Posture mirrors the existing api/send.js: Resend notify + honeypot.
   ESP webhook (MailerLite/Brevo) is wired via env when the account exists;
   until then the lead still lands in Shane's inbox so nothing is lost.
   ===================================================================== */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const TO = process.env.LEAD_NOTIFY_TO || 'shane@kitchenwebsites.com';
const FROM = process.env.LEAD_NOTIFY_FROM || 'Kitchen Websites <onboarding@resend.dev>';
const ESP_WEBHOOK = process.env.ESP_WEBHOOK_URL || ''; // MailerLite/Brevo inbound webhook

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function notifyEmail(subject, html) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to: TO, subject, html });
  } catch (err) {
    console.warn('score-submit notify failed:', err.message);
  }
}

async function pushToEsp(payload) {
  if (!ESP_WEBHOOK) return;
  try {
    await fetch(ESP_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('score-submit ESP push failed:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};

  // ---- Grader head-to-head request (results page CTA 1) ----
  if (body.type === 'grader') {
    const competitor = String(body.competitor || '').slice(0, 300);
    if (!competitor.trim()) return res.status(400).json({ ok: false, error: 'Missing competitor' });
    await notifyEmail(
      `🔎 Grader request (score ${esc(body.score)}, ${esc(body.segment)})`,
      `<p><strong>Competitor:</strong> ${esc(competitor)}</p>
       <p>Score: ${esc(body.score)} · Segment: ${esc(body.segment)}</p>
       <p>Run the head-to-head teardown within 24 hours.</p>`
    );
    return res.status(200).json({ ok: true });
  }

  // ---- Strategy session request (/book) ----
  // The 12-field form is the qualifier AND the sales intel. Forward every
  // field (field 8, "bug", is the line Shane reads first on the call), so
  // nothing the owner typed is dropped. Labels mirror the form's field names.
  if (body.type === 'booking') {
    const labels = {
      name: 'Name', shop: 'Shop', website: 'Website', customers: 'Customer mix',
      jobs: 'Jobs / month', sources: 'Job sources', shopDesc: 'Shop / job value',
      burned: 'Been burned?', bug: 'Biggest gripe (read first)', route: 'Handle it / DIY',
      timeline: 'Timeline', attribution: 'First heard via', phone: 'Phone', email: 'Email',
      showup: 'Show-up commit', from: 'Came from',
    };
    const rows = Object.keys(labels)
      .filter((k) => body[k])
      .map((k) => `<tr><td>${esc(labels[k])}</td><td><strong>${esc(String(body[k]).slice(0, 2000))}</strong></td></tr>`)
      .join('');
    await Promise.all([
      pushToEsp({ ...body, source: 'book-session' }),
      notifyEmail(
        `📅 Session request — ${esc(body.shop || body.name || 'new owner')}${body.from === 'score' ? ' (from Score)' : ''}`,
        `<h2>New ${esc(body.name || '')} session</h2><table border="1" cellpadding="6" cellspacing="0">${rows || '<tr><td>(no answers)</td></tr>'}</table>`
      ),
    ]);
    return res.status(200).json({ ok: true });
  }

  // ---- Email gate (Q10 → results) ----
  const { firstName, email, business, score, segment, urgent, answers } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ ok: false, error: 'Invalid email' });
  }

  const answerRows = Array.isArray(answers)
    ? answers.map((a) => `<tr><td>${esc(a.q)}</td><td><strong>${esc(a.a)}</strong></td></tr>`).join('')
    : '';

  const lead = {
    firstName: String(firstName || '').slice(0, 120),
    email: String(email).slice(0, 200),
    business: String(business || '').slice(0, 200),
    score,
    segment,
    urgent: !!urgent,
    answers,
    source: 'referral-capture-score',
  };

  await Promise.all([
    pushToEsp(lead),
    notifyEmail(
      `${urgent ? '🚨 URGENT ' : ''}New Score lead — ${esc(business)} (${esc(score)}/100, ${esc(segment)})`,
      `<h2>${esc(firstName)} — ${esc(business)}</h2>
       <p>Email: ${esc(email)}<br/>Score: ${esc(score)}/100 · Segment: ${esc(segment)}${urgent ? ' · <strong>URGENT</strong>' : ''}</p>
       <table border="1" cellpadding="6" cellspacing="0">${answerRows}</table>`
    ),
  ]);

  return res.status(200).json({ ok: true });
}
