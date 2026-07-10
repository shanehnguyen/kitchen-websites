import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

import { Redis } from '@upstash/redis';

/* =====================================================================
   /api/pulse — booking-funnel telemetry + drop-off alerts.

   The /book page beacons a "journey" here as a visitor moves through the
   funnel (landed → started → contact → details → obstacle → submitted →
   booked). This endpoint:

     • upserts the journey in Redis (7-day TTL) and indexes it, so /pulse
       (the private dashboard) can show who came through and exactly where
       each person dropped off.

     • when a visitor LEAVES without submitting, emails Shane ONE rollup via
       Web3Forms (deduped with a Redis NX lock) — the drop-offs that were
       invisible before. Submitters already get the Web3Forms lead email, and
       Calendly notifies him of real bookings, so we never double up. One
       signal per visitor, no duplicates.

   Email goes through Web3Forms (server-side POST — fine on the paid plan) to
   the same booking inbox the form already uses. No Resend.

   GET (token-gated on PULSE_TOKEN) returns recent journeys + a computed
   funnel. Degrades quietly if Redis isn't configured.
   ===================================================================== */

// Web3Forms access key for the booking inbox. PUBLIC by design (it already
// ships in the client bundle via site.config), so an env override is optional.
const WEB3FORMS_KEY = process.env.WEB3FORMS_BOOKING_KEY || '43b3a69b-e565-48c2-bc12-d5c00c863d10';

// Dashboard password. GET is refused entirely until this is set (so the
// visitor list — which holds names/emails/phones — is never wide open).
const DASHBOARD_TOKEN = process.env.PULSE_TOKEN || '';

const JOURNEY_TTL_S = 60 * 60 * 24 * 7; // keep each journey 7 days
const RECENT_KEY = 'pulse:recent';
const RECENT_KEEP = 500; // cap the index so it can't grow without bound
const WRITE_RATE_MAX = 120; // per-IP beacons per window (flood guard)
const WRITE_RATE_WINDOW_S = 60;
// Skip the email for sub-1.5s visits that left no trace — that's prefetch and
// bots, not a homeowner. They still land on the dashboard. Set to 0 to email
// literally every landing.
const MIN_DWELL_FOR_EMAIL_MS = 1500;

// Funnel stages, in order. A journey's stage only ever moves forward.
const STAGES = ['landed', 'started', 'contact', 'details', 'obstacle', 'submitted', 'booked'];
const STAGE_LABEL = {
  landed: 'Just landed on the page',
  started: 'Typed their name',
  contact: 'Name done — on contact info',
  details: 'Gave phone, email & website',
  obstacle: 'Answered everything — on the final question',
  submitted: 'Submitted — details sent to you',
  booked: 'Booked a time',
};
const stageIndex = (s) => {
  const i = STAGES.indexOf(s);
  return i < 0 ? 0 : i;
};

let redisClient = null;
function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') {
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }
  const real = req.headers['x-real-ip'];
  if (real && typeof real === 'string') return real.trim();
  return req.socket?.remoteAddress || 'unknown';
}

const clean = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max).trim() : '');
const validId = (id) => typeof id === 'string' && /^j_[a-z0-9_]{6,48}$/i.test(id);
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---------------------------------------------------------------- ingest (POST)
async function ingest(req, res) {
  const b = req.body || {};
  if (!validId(b.id)) return res.status(400).json({ ok: false });

  const redis = getRedis();
  const ip = getClientIp(req);

  // Flood guard — a script can't hammer Redis. Over the line, drop silently.
  if (redis) {
    try {
      const k = `pulse:wr:${ip}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, WRITE_RATE_WINDOW_S);
      if (n > WRITE_RATE_MAX) return res.status(200).json({ ok: true });
    } catch { /* limiter is best-effort */ }
  }
  if (!redis) return res.status(200).json({ ok: true }); // nothing to store; degrade

  const now = Date.now();
  const key = `pulse:j:${b.id}`;
  let prev = null;
  try { prev = await redis.get(key); } catch { /* treat as new */ }
  prev = prev && typeof prev === 'object' ? prev : null;

  // Stage only moves forward — a late 'landed' beacon can't undo 'submitted'.
  const incoming = STAGES.includes(b.stage) ? b.stage : 'landed';
  const stage = prev ? STAGES[Math.max(stageIndex(prev.stage), stageIndex(incoming))] : incoming;

  // Merge: newest non-empty value wins, otherwise keep what we had.
  const pick = (k, max) => clean(b[k], max) || (prev ? prev[k] : '') || '';
  const journey = {
    id: b.id,
    stage,
    name: pick('name', 120),
    email: pick('email', 200),
    phone: pick('phone', 60),
    website: pick('website', 200),
    customers: pick('customers', 60),
    jobs: pick('jobs', 40),
    obstacle: pick('obstacle', 1000),
    source: pick('source', 200),
    referrer: pick('referrer', 300),
    query: pick('query', 500),
    landedAt: (prev && prev.landedAt) || Number(b.landedAt) || now,
    updatedAt: now,
    ip: (prev && prev.ip) || ip,
  };

  try {
    await redis.set(key, journey, { ex: JOURNEY_TTL_S });
    await redis.zadd(RECENT_KEY, { score: now, member: b.id });
    await redis.zremrangebyrank(RECENT_KEY, 0, -(RECENT_KEEP + 1)); // trim oldest
  } catch (err) {
    console.warn('pulse store failed:', err.message);
  }

  // Email the drop-offs: they're leaving (final) and never submitted.
  if (b.final && stageIndex(stage) < stageIndex('submitted')) {
    await maybeEmail(redis, journey);
  }

  return res.status(200).json({ ok: true });
}

// Exactly one drop-off email per journey, guarded by an NX lock so repeated
// exit beacons can't double-send. Sent via Web3Forms to the booking inbox.
async function maybeEmail(redis, j) {
  if (!redis) return;

  const dwell = (j.updatedAt || 0) - (j.landedAt || 0);
  const engaged = j.name || j.email || j.phone || stageIndex(j.stage) > 0;
  if (dwell < MIN_DWELL_FOR_EMAIL_MS && !engaged) return; // prefetch/bot bounce

  try {
    const won = await redis.set(`pulse:emailed:${j.id}`, 1, { nx: true, ex: JOURNEY_TTL_S });
    if (!won) return; // already emailed this visitor
  } catch {
    return;
  }

  const idLabel = j.name || j.email || j.phone || 'Anonymous visitor';
  const reached = STAGE_LABEL[j.stage] || j.stage;

  // Web3Forms renders every extra field into the email body; `subject`,
  // `from_name`, and `email` (reply-to) are the special ones.
  const fields = {
    access_key: WEB3FORMS_KEY,
    from_name: 'Booking pulse',
    subject: `🚪 Booking drop-off — ${idLabel} · ${reached}`,
    'How far they got': reached,
    'Time on page': fmtDwell(dwell),
    Name: j.name || '—',
    Phone: j.phone || '—',
    Website: j.website || '—',
    'Came from': j.source || j.referrer || 'direct',
  };
  if (isEmail(j.email)) fields.email = j.email; // reply goes straight to them
  if (j.customers) fields['Customer mix'] = j.customers;
  if (j.jobs) fields['Jobs / month'] = j.jobs;
  if (j.obstacle) fields['Biggest gripe'] = j.obstacle;
  if (j.query) fields['Query params'] = j.query;

  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(fields),
    });
  } catch (err) {
    console.error('pulse web3forms send failed:', err.message);
  }
}

function fmtDwell(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.round(s / 60)} min`;
}

// ------------------------------------------------------------- dashboard (GET)
async function dashboard(req, res) {
  if (!DASHBOARD_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: 'Dashboard is off. Set a PULSE_TOKEN env var to turn it on.',
    });
  }
  const token = (req.query && (req.query.token || req.query.t)) || '';
  if (token !== DASHBOARD_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Bad or missing token.' });
  }

  const redis = getRedis();
  if (!redis) return res.status(200).json({ ok: true, journeys: [], funnel: buildFunnel([]), stages: STAGES });

  let ids = [];
  try {
    ids = await redis.zrange(RECENT_KEY, 0, 199, { rev: true }); // newest first
  } catch (err) {
    console.warn('pulse zrange failed:', err.message);
  }
  ids = Array.isArray(ids) ? ids : [];

  let journeys = [];
  if (ids.length) {
    try {
      const rows = await redis.mget(...ids.map((id) => `pulse:j:${id}`));
      journeys = (rows || []).filter((r) => r && typeof r === 'object');
    } catch (err) {
      console.warn('pulse mget failed:', err.message);
    }
  }

  return res.status(200).json({ ok: true, journeys, funnel: buildFunnel(journeys), stages: STAGES });
}

// How many visitors reached AT LEAST each stage (the classic funnel shape).
function buildFunnel(journeys) {
  return STAGES.map((s, i) => ({
    stage: s,
    label: STAGE_LABEL[s],
    count: journeys.filter((j) => stageIndex(j.stage) >= i).length,
  }));
}

// ------------------------------------------------------------------- handler
export default async function handler(req, res) {
  if (req.method === 'POST') return ingest(req, res);
  if (req.method === 'GET') return dashboard(req, res);
  res.setHeader('Allow', 'POST, GET');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
