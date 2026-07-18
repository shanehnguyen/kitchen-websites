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
const STAGES = ['landed', 'type', 'jobs', 'details', 'calendar', 'booked'];
const STAGE_LABEL = {
  landed: 'Just landed on the page',
  type: 'Picked their business type',
  jobs: 'Answered where jobs come from & how many',
  details: 'On business name / website',
  calendar: 'Completed the form — reached the calendar',
  booked: 'Booked a time',
};
const stageIndex = (s) => {
  const i = STAGES.indexOf(s);
  return i < 0 ? 0 : i;
};

let redisClient = null;
function getRedis() {
  if (redisClient) return redisClient;
  // Prefer the integration's KV_* vars; UPSTASH_* is a legacy fallback (a stale
  // UPSTASH_* pointing at a deleted DB must NOT win over the live KV_* one).
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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

// Pull UTMs / click-ids out of a raw "?a=b&c=d" string. Camel-cased keys match
// the journey record (utm_source → utmSource) so the fallback slots straight in.
function parseQuery(qs) {
  const out = { utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '', utmTerm: '', gclid: '', fbclid: '' };
  if (typeof qs !== 'string' || !qs) return out;
  try {
    const p = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
    const g = (k) => (p.get(k) || '').slice(0, 200).trim();
    out.utmSource = g('utm_source'); out.utmMedium = g('utm_medium'); out.utmCampaign = g('utm_campaign');
    out.utmContent = g('utm_content'); out.utmTerm = g('utm_term');
    out.gclid = g('gclid'); out.fbclid = g('fbclid');
  } catch { /* leave blanks */ }
  return out;
}

// Merge the per-stage timestamp maps from successive beacons. A stage keeps the
// EARLIEST time it was ever reported (stage time never moves later), and only
// sane millisecond timestamps are accepted. `seed` provides defaults (landed).
function mergeStageTimes(prev, incoming, seed) {
  const out = {};
  const take = (src) => {
    if (!src || typeof src !== 'object') return;
    for (const s of STAGES) {
      const t = Number(src[s]);
      if (Number.isFinite(t) && t > 0 && (!out[s] || t < out[s])) out[s] = t;
    }
  };
  take(seed);
  take(prev);
  take(incoming);
  return out;
}

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
  // UTM / click ids come broken out from the client; fall back to parsing the raw
  // query string so older records (and any beacon that missed them) still resolve.
  const q = pick('query', 500);
  const fromQuery = parseQuery(q);
  const utm = (k, max = 200) => clean(b[k], max) || (prev && prev[k]) || fromQuery[k] || '';
  const journey = {
    id: b.id,
    stage,
    businessType: pick('businessType', 80),
    businessName: pick('businessName', 160),
    website: pick('website', 200),
    customers: pick('customers', 60),
    jobs: pick('jobs', 40),
    source: pick('source', 200),
    referrer: pick('referrer', 300),
    query: q,
    utmSource: utm('utmSource'),
    utmMedium: utm('utmMedium'),
    utmCampaign: utm('utmCampaign'),
    utmContent: utm('utmContent'),
    utmTerm: utm('utmTerm'),
    gclid: utm('gclid'),
    fbclid: utm('fbclid'),
    stageTimes: mergeStageTimes(prev && prev.stageTimes, b.stageTimes, { landed: (prev && prev.landedAt) || Number(b.landedAt) || now }),
    landedAt: (prev && prev.landedAt) || Number(b.landedAt) || now,
    updatedAt: now,
    ip: (prev && prev.ip) || ip,
    ua: (prev && prev.ua) || clean(req.headers['user-agent'], 300),
  };

  try {
    await redis.set(key, journey, { ex: JOURNEY_TTL_S });
    await redis.zadd(RECENT_KEY, { score: now, member: b.id });
    await redis.zremrangebyrank(RECENT_KEY, 0, -(RECENT_KEEP + 1)); // trim oldest
  } catch (err) {
    console.warn('pulse store failed:', err.message);
  }

  // Partial-lead capture: once we have a business name, dedupe-write a lead
  // record keyed by business with a status field, upgraded partial → booked.
  await upsertLead(redis, journey, now);

  // Email the drop-offs: they're leaving (final) and never COMPLETED the form
  // (never reached the calendar). The lead notification fires on form completion,
  // so a drop-off here is someone who quit the qualifying questions partway.
  if (b.final && stageIndex(stage) < stageIndex('calendar')) {
    await maybeEmail(redis, journey);
  }

  return res.status(200).json({ ok: true });
}

// Exactly one drop-off email per journey, guarded by an NX lock so repeated
// exit beacons can't double-send. Sent via Web3Forms to the booking inbox.
async function maybeEmail(redis, j) {
  if (!redis) return;

  const dwell = (j.updatedAt || 0) - (j.landedAt || 0);
  const engaged = j.businessType || j.businessName || stageIndex(j.stage) > 0;
  if (dwell < MIN_DWELL_FOR_EMAIL_MS && !engaged) return; // prefetch/bot bounce

  try {
    const won = await redis.set(`pulse:emailed:${j.id}`, 1, { nx: true, ex: JOURNEY_TTL_S });
    if (!won) return; // already emailed this visitor
  } catch {
    return;
  }

  const idLabel = j.businessName || j.businessType || 'Anonymous visitor';
  const reached = STAGE_LABEL[j.stage] || j.stage;

  // Web3Forms renders every extra field into the email body.
  const fields = {
    access_key: WEB3FORMS_KEY,
    from_name: 'Booking pulse',
    subject: `🚪 Booking drop-off — ${idLabel} · ${reached}`,
    'How far they got': reached,
    'Time on page': fmtDwell(dwell),
    Business: j.businessName || '—',
    Type: j.businessType || '—',
    Website: j.website || '—',
    'Came from': j.source || j.referrer || 'direct',
  };
  if (j.customers) fields['Jobs come from'] = j.customers;
  if (j.jobs) fields['Jobs / month'] = j.jobs;
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

// Dedupe leads in Redis keyed by business name (the form no longer collects an
// email — Calendly does — so business is the natural key). ONE record per
// business: status 'partial' once they name the business, upgraded to 'booked'
// when Calendly completes, never downgraded. Internal follow-up data only.
const LEADS_KEY = 'pulse:leads';
const LEAD_TTL_S = 60 * 60 * 24 * 90; // keep booking leads 90 days
export async function upsertLead(redis, j, now) {
  if (!redis || !j.businessName) return; // no business name yet → nothing to key on
  const biz = j.businessName.trim().toLowerCase().slice(0, 120);
  const key = `pulse:lead:${biz}`;

  let prev = null;
  try { prev = await redis.get(key); } catch { /* treat as new */ }
  prev = prev && typeof prev === 'object' ? prev : null;

  // Status only ever climbs: partial → booked, never back to partial.
  const booked = stageIndex(j.stage) >= stageIndex('booked') || (prev && prev.status === 'booked');
  const keep = (v, k) => v || (prev ? prev[k] : '') || '';
  const record = {
    business: j.businessName,
    businessType: keep(j.businessType, 'businessType'),
    website: keep(j.website, 'website'),
    customers: keep(j.customers, 'customers'),
    jobs: keep(j.jobs, 'jobs'),
    source: keep(j.source, 'source'),
    referrer: keep(j.referrer, 'referrer'),
    query: keep(j.query, 'query'),
    status: booked ? 'booked' : 'partial',
    journeyId: j.id,
    ip: (prev && prev.ip) || j.ip || '',
    createdAt: (prev && prev.createdAt) || now,
    updatedAt: now,
  };

  try {
    await redis.set(key, record, { ex: LEAD_TTL_S });
    await redis.zadd(LEADS_KEY, { score: now, member: biz });
  } catch (err) {
    console.warn('pulse lead upsert failed:', err.message);
  }
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
  if (!redis) return res.status(200).json({ ok: true, redisStatus: 'not-configured', journeys: [], funnel: buildFunnel([]), stages: STAGES });

  let ids = [];
  let redisStatus = 'connected';
  try {
    ids = await redis.zrange(RECENT_KEY, 0, 199, { rev: true }); // newest first
  } catch (err) {
    console.warn('pulse zrange failed:', err.message);
    redisStatus = 'unreachable'; // DB is dead / creds wrong — surfaced on the dashboard
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

  return res.status(200).json({ ok: true, redisStatus, journeys, funnel: buildFunnel(journeys), sources: buildSources(journeys), stages: STAGES });
}

// Per-CTA / source rollup: how many arrived from each ?from tag and how many of
// them actually booked — so you see which button drives completed calls, not
// just clicks. Sorted by volume.
function buildSources(journeys) {
  const map = new Map();
  for (const j of journeys) {
    const key = j.source || 'direct';
    const e = map.get(key) || { source: key, total: 0, booked: 0 };
    e.total += 1;
    if (stageIndex(j.stage) >= stageIndex('booked')) e.booked += 1;
    map.set(key, e);
  }
  return [...map.values()]
    .map((e) => ({ ...e, rate: e.total ? Math.round((e.booked / e.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
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
