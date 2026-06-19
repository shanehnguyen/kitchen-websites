import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

/* =====================================================================
   /api/score-submit — lead capture for the Scorecard + booking funnel.
   Email delivery uses WEB3FORMS (web3forms.com): POST the fields with an
   access_key and it emails the inbox tied to that key. No Resend, no SMTP.
   Set WEB3FORMS_ACCESS_KEY in env. (If unset, capture no-ops gracefully so
   the front-end never blocks.)
   ESP webhook (MailerLite/Brevo) is still wired via ESP_WEBHOOK_URL when set.
   ===================================================================== */

const WEB3FORMS_KEY = process.env.WEB3FORMS_ACCESS_KEY || '';
const ESP_WEBHOOK = process.env.ESP_WEBHOOK_URL || '';

// Drop empty values and cap field length so the email stays clean.
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = String(v).slice(0, 2000);
  }
  return out;
}

async function notify(subject, fields) {
  if (!WEB3FORMS_KEY) return;
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        from_name: 'Kitchen Websites',
        subject,
        ...clean(fields),
      }),
    });
  } catch (err) {
    console.warn('web3forms notify failed:', err.message);
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

  // ---- Grader head-to-head request ----
  if (body.type === 'grader') {
    const competitor = String(body.competitor || '').slice(0, 300);
    if (!competitor.trim()) return res.status(400).json({ ok: false, error: 'Missing competitor' });
    await notify('🔎 Grader request', {
      Competitor: competitor,
      Score: body.score,
      Segment: body.segment,
    });
    return res.status(200).json({ ok: true });
  }

  // ---- Google Scorecard email gate / manual capture (/scorecard) ----
  if (body.type === 'scorecard') {
    const email = String(body.email || '');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }
    const manual = !!body.manual;
    await Promise.all([
      pushToEsp({ ...body, source: manual ? 'scorecard-manual' : 'scorecard' }),
      notify(`${manual ? '✋ Manual scorecard' : '📊 Scorecard'} — ${body.business || email}`, {
        Lead: manual ? 'Run this one by hand' : 'New scorecard lead',
        Business: body.business,
        City: body.city,
        'Verdict band': body.band,
        'Worst point': body.worst,
        Reviews: body.reviews,
        Rating: body.rating,
        'Top rival reviews': body.topReviews,
        'First name': body.firstName,
        email, // Web3Forms uses this as reply-to
      }),
    ]);
    return res.status(200).json({ ok: true });
  }

  // ---- Strategy session request (/book) ----
  if (body.type === 'booking') {
    const labels = {
      name: 'Name', phone: 'Phone', business: 'Business & city',
      customers: 'Customer mix', jobs: 'Jobs / month',
      bug: 'Biggest gripe (read first)', from: 'Came from',
    };
    const fields = {};
    for (const [k, label] of Object.entries(labels)) {
      if (body[k]) fields[label] = body[k];
    }
    if (body.email) fields.email = body.email; // reply-to
    await Promise.all([
      pushToEsp({ ...body, source: 'book-session' }),
      notify(`📅 Session request — ${body.business || body.name || 'new owner'}`, fields),
    ]);
    return res.status(200).json({ ok: true });
  }

  // ---- Generic email gate (legacy) ----
  const { firstName, email, business, score, segment, urgent, answers } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ ok: false, error: 'Invalid email' });
  }
  const fields = { Name: firstName, email, Business: business, Score: score, Segment: segment, Urgent: urgent ? 'YES' : '' };
  if (Array.isArray(answers)) {
    answers.forEach((a, i) => { if (a && a.q) fields[`Q${i + 1}: ${String(a.q).slice(0, 50)}`] = a.a; });
  }
  await Promise.all([
    pushToEsp({ firstName, email, business, score, segment, urgent: !!urgent, answers, source: 'lead' }),
    notify(`${urgent ? '🚨 URGENT ' : ''}New lead — ${business || email}`, fields),
  ]);
  return res.status(200).json({ ok: true });
}
