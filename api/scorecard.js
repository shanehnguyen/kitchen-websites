import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

import { Redis } from '@upstash/redis';
import * as cheerio from 'cheerio';

/* =====================================================================
   /api/scorecard — The Google Scorecard, full graded Google Business
   Profile audit. (Scorecard rebuild spec, June 2026.)

   Identify still uses Google Places (autocomplete → here we take a minimal
   Place Details for the confirmed name + coordinates). The PROFILE DATA the
   audit grades comes from DataForSEO Business Data API, which sees what the
   Places API can't:
     - my_business_info (live)   → categories, description, attributes, hours,
                                    phone, domain, photo count, booking link, rating
     - google/reviews            → review recency + owner-response rate
     - my_business_updates       → post recency
     - business_listings/search  → the competitor set
   The website check uses Google PageSpeed Insights (free) + a server-side
   fetch. All calls are server-side; the profile is cached 24h.

   HONESTY RULES (critical — enforced in analyze()):
     - A null/empty field means UNKNOWN, not zero. Omit the item. Never render
       "0 photos", "no description", etc. off a null. We only WARN/FAIL on a
       value we actually have; otherwise the item doesn't appear.
     - Attributes: only flag the relevant-and-missing K&B set. Never dump the
       raw unavailable list.
     - Never assert claim/verification status. Neglect is inferred from real
       gaps only.
     - Every value is live from an API or omitted. No invented data, ever.

   Degrades quietly: missing creds or a failed core lookup → { degraded:true }
   so the client offers manual capture rather than dead-ending ad spend.
   ===================================================================== */

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const DFS_LOGIN = process.env.DATAFORSEO_LOGIN || '';
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD || '';
const PAGESPEED_KEY = process.env.PAGESPEED_API_KEY || '';
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h

const dfsAuth = DFS_LOGIN && DFS_PASSWORD
  ? 'Basic ' + Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')
  : '';

let redisClient = null;
function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

// A dumb comparison (Home Depot as a "rival") trips the scam filter.
const EXCLUDE = [
  /home\s*depot/i, /lowe'?s/i, /\bikea\b/i, /menards/i, /costco/i, /sam'?s club/i,
  /wayfair/i, /floor\s*&?\s*decor/i, /the tile shop/i, /best\s*buy/i, /walmart/i,
  /amazon/i, /\bhd supply\b/i, /ferguson/i, /build\.com/i,
  /wholesale/i, /distribut/i, /\bsupply co\b/i, /liquidat/i, /\boutlet\b/i,
];
const isExcluded = (name) => EXCLUDE.some((re) => re.test(name || ''));

// ---------- Google Places: confirm name + coordinates (identify bridge) ----------
async function placeDetails(placeId, sessionToken) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const headers = {
    'X-Goog-Api-Key': PLACES_KEY,
    'X-Goog-FieldMask': 'id,displayName,location,rating,userRatingCount,websiteUri',
  };
  if (sessionToken) headers['X-Goog-Session-Token'] = sessionToken;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`places details ${r.status}`);
  return r.json();
}

// ---------- DataForSEO helpers ----------
async function dfsPost(path, task) {
  const r = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: dfsAuth },
    body: JSON.stringify([task]),
  });
  if (!r.ok) throw new Error(`dfs ${path} ${r.status}`);
  const data = await r.json();
  return data?.tasks?.[0] || null;
}

function firstResultItems(task) {
  return task?.result?.[0]?.items || task?.result || [];
}

// my_business_info (live) — the rich GBP record
async function fetchMyBusinessInfo(name, lat, lng) {
  if (!dfsAuth) return null;
  try {
    const task = await dfsPost('business_data/google/my_business_info/live', {
      keyword: name,
      location_coordinate: `${lat},${lng}`,
      language_code: 'en',
    });
    const items = firstResultItems(task);
    return items[0] || null;
  } catch (err) {
    console.warn('my_business_info failed:', err.message);
    return null;
  }
}

// business_listings/search (live) — competitor set, category-matched
async function fetchCompetitors(lat, lng) {
  if (!dfsAuth) return [];
  try {
    const task = await dfsPost('business_data/business_listings/search/live', {
      categories: ['kitchen_remodeler', 'bathroom_remodeler', 'cabinet_store', 'countertop_store', 'remodeler'],
      location_coordinate: `${lat},${lng},20`, // 20km radius
      order_by: ['rating.votes_count,desc'],
      limit: 20,
    });
    return firstResultItems(task);
  } catch (err) {
    console.warn('business_listings search failed:', err.message);
    return [];
  }
}

// reviews — newest timestamp + owner-response rate (task-based; best-effort,
// bounded poll; omit if not ready so we never invent recency/response).
async function fetchReviewsMeta(name, lat, lng) {
  if (!dfsAuth) return null;
  try {
    const posted = await dfsPost('business_data/google/reviews/task_post', {
      keyword: name,
      location_coordinate: `${lat},${lng}`,
      language_code: 'en',
      depth: 20,
      sort_by: 'newest',
    });
    const id = posted?.id;
    if (!id) return null;
    for (let i = 0; i < 3; i++) {
      await new Promise((res) => setTimeout(res, 1500));
      const got = await fetch(`https://api.dataforseo.com/v3/business_data/google/reviews/task_get/${id}`, {
        headers: { Authorization: dfsAuth },
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const items = got?.tasks?.[0]?.result?.[0]?.items;
      if (Array.isArray(items) && items.length) {
        const withResp = items.filter((it) => it.owner_answer || it.owner_response || it.responses);
        const newest = items
          .map((it) => it.timestamp)
          .filter(Boolean)
          .sort()
          .pop();
        return { newest, total: items.length, responded: withResp.length };
      }
    }
    return null;
  } catch (err) {
    console.warn('reviews failed:', err.message);
    return null;
  }
}

// my_business_updates — newest post timestamp (task-based; best-effort).
async function fetchPostsMeta(name, lat, lng) {
  if (!dfsAuth) return null;
  try {
    const posted = await dfsPost('business_data/google/my_business_updates/task_post', {
      keyword: name,
      location_coordinate: `${lat},${lng}`,
      language_code: 'en',
    });
    const id = posted?.id;
    if (!id) return null;
    for (let i = 0; i < 2; i++) {
      await new Promise((res) => setTimeout(res, 1500));
      const got = await fetch(`https://api.dataforseo.com/v3/business_data/google/my_business_updates/task_get/${id}`, {
        headers: { Authorization: dfsAuth },
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const items = got?.tasks?.[0]?.result?.[0]?.items;
      if (Array.isArray(items)) {
        const newest = items.map((it) => it.timestamp).filter(Boolean).sort().pop();
        return { newest: newest || null, count: items.length };
      }
    }
    return null;
  } catch (err) {
    console.warn('updates failed:', err.message);
    return null;
  }
}

// ---------- Website check: server-side fetch + PageSpeed ----------
async function fetchWebsite(domain) {
  const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const out = { url, loads: null, https: null, viewport: null, phoneAboveFold: null, cta: null, perf: null };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const r = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 KitchenWebsitesScorecard' } });
    clearTimeout(t);
    out.loads = r.ok;
    out.https = (r.url || url).startsWith('https://');
    if (r.ok) {
      const html = await r.text();
      const $ = cheerio.load(html);
      out.viewport = $('meta[name="viewport"]').length > 0;
      const head = (html.slice(0, 4000) + ' ' + $('header').text() + ' ' + $('nav').text()).toLowerCase();
      out.phoneAboveFold = /href=["']tel:/i.test(html.slice(0, 6000)) || /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(head);
      out.cta = /(free|get|request)[^<]{0,20}(quote|estimate|consultation)|book (now|online)|schedule|call (now|us|today)|contact us/i.test(
        $('a,button,[role="button"]').text()
      );
    }
  } catch (err) {
    out.loads = false;
  }
  // PageSpeed (mobile) — free; works without a key (rate-limited) but better with one.
  try {
    const ps = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    ps.searchParams.set('url', url);
    ps.searchParams.set('strategy', 'mobile');
    ps.searchParams.set('category', 'performance');
    if (PAGESPEED_KEY) ps.searchParams.set('key', PAGESPEED_KEY);
    const r = await fetch(ps.toString());
    if (r.ok) {
      const data = await r.json();
      const score = data?.lighthouseResult?.categories?.performance?.score;
      if (typeof score === 'number') out.perf = Math.round(score * 100);
    }
  } catch { /* omit perf on failure */ }
  return out;
}

// ---------- grading helpers ----------
const MONTH_MS = 1000 * 60 * 60 * 24 * 30;
const monthsSince = (ts) => {
  const d = Date.parse(typeof ts === 'number' ? ts * 1000 : ts);
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / MONTH_MS);
};
const STRONG_CATS = /(kitchen|bath|cabinet|countertop|remodel)/i;
const GENERIC_CATS = /^(contractor|general contractor|construction company|home improvement|handyman)$/i;
// Relevant-and-missing attribute set for a K&B remodeler (label → matcher).
const RELEVANT_ATTRS = [
  { key: 'free_estimates', label: 'Free estimates', re: /free.*estimate/i },
  { key: 'online_estimates', label: 'Online estimates', re: /online.*estimate/i },
  { key: 'online_appointments', label: 'Online appointments', re: /online.*appointment/i },
  { key: 'onsite_services', label: 'Onsite services', re: /onsite|on-site/i },
];

// ---------- analyze: build the graded audit (worst-first) ----------
function analyze(merged, top, competitors, reviewsMeta, postsMeta, website) {
  const m = merged;
  const reviews = num(m.reviews);
  const rating = num(m.rating);

  // verdict + hook (review-centric, unchanged contract)
  let verdict;
  const strong = rating >= 4.4 && reviews >= 25 && !!m.domain && (!top || reviews >= Math.round(top.reviews * 0.7));
  if ((reviews !== null && reviews <= 3) || (rating !== null && rating === 0)) {
    verdict = { key: 'absent', headline: 'You’re not in the room yet.', sub: 'When a homeowner checks you against the shops near you, there’s almost nothing here to pick. That’s the cleanest fix on this page.' };
  } else if (strong) {
    verdict = { key: 'strong', headline: 'Your Google’s strong. The leak is after the click.', sub: 'You win the Google comparison. So the jobs you’re losing aren’t leaking here, they’re leaking on the website she lands on next.' };
  } else {
    verdict = { key: 'losing', headline: 'You’re in the game, and losing the comparison.', sub: 'You show up. But next to the shop Google puts beside you, a homeowner has a reason to pick them. Here’s exactly where.' };
  }
  let hook;
  if (top && reviews !== null) hook = `You have ${reviews} review${reviews === 1 ? '' : 's'}. The kitchen & bath shop Google shows first near you has ${top.reviews}.`;
  else if (rating !== null && rating < 4) hook = `At ${rating.toFixed(1)} stars, you’re under the line most homeowners use to rule a shop out.`;
  else hook = 'Here’s the homeowner’s-eye read of your Google profile, graded.';

  const items = []; // {id,label,status,value,why,fix,sev}
  const passing = [];
  const add = (it) => items.push(it);
  const pass = (label) => passing.push(label);

  // 1. Primary category
  if (str(m.category)) {
    if (STRONG_CATS.test(m.category)) pass(`Primary category (${m.category})`);
    else if (GENERIC_CATS.test(m.category.trim())) add({ id: 'cat1', label: 'Primary category', status: 'fail', sev: 1, value: `Yours: “${m.category}”`, why: 'Your primary category is the single biggest factor in which searches you appear in, and a generic one keeps you out of the kitchen and bath results.', fix: 'Set it to the most specific category that fits, like Kitchen remodeler or Bathroom remodeler.' });
    else add({ id: 'cat1', label: 'Primary category', status: 'warn', sev: 2, value: `Yours: “${m.category}”`, why: 'It may not be the category homeowners search, which decides whether you show up at all.', fix: 'Confirm it’s the most specific kitchen or bath category Google offers.' });
  }
  // 2. Secondary categories
  if (Array.isArray(m.additional_categories)) {
    const rel = m.additional_categories.filter((c) => STRONG_CATS.test(c));
    if (rel.length >= 2) pass(`${rel.length} relevant secondary categories`);
    else add({ id: 'cat2', label: 'Secondary categories', status: 'warn', sev: 3, value: rel.length ? `Only ${rel.length} relevant one` : 'None set', why: 'Each relevant secondary category is another search you can win, and most shops leave them empty.', fix: 'Add the ones that apply: Bathroom remodeler, Cabinet maker, Countertop store, Tile contractor.' });
  }
  // 3. Review count vs top rival
  if (reviews !== null && top) {
    if (reviews >= top.reviews) pass(`Review count (${reviews})`);
    else if (reviews >= top.reviews * 0.6) add({ id: 'rev', label: 'Review count', status: 'warn', sev: 3, value: `You ${reviews} vs ${top.reviews} for ${top.name}`, why: 'Homeowners count reviews, and being behind the top shop is a reason to call them first.', fix: 'Ask your last ten happy customers, with a direct review link.' });
    else add({ id: 'rev', label: 'Review count', status: 'fail', sev: 1, value: `You ${reviews} vs ${top.reviews} for ${top.name}`, why: 'A wide review gap is the clearest reason a homeowner picks the other shop before she ever calls you.', fix: 'Ask your last ten happy customers with a direct link, then keep a steady trickle going.' });
  }
  // 4. Star rating vs the 4.0 cliff
  if (rating !== null && rating > 0) {
    if (rating >= 4.3) pass(`${rating.toFixed(1)} star rating`);
    else if (rating >= 4.0) add({ id: 'star', label: 'Star rating', status: 'warn', sev: 3, value: `${rating.toFixed(1)} stars`, why: 'You’re just above the four-star line homeowners filter by, with no cushion.', fix: 'Reply to every review and ask happy customers so the average climbs.' });
    else add({ id: 'star', label: 'Star rating', status: 'fail', sev: 1, value: `${rating.toFixed(1)} stars`, why: 'Most homeowners filter out anything under four stars before they read a single word.', fix: 'Reply to every review, the negative ones first, and earn a run of honest 5-stars.' });
  }
  // 5. Review recency
  if (reviewsMeta?.newest) {
    const mo = monthsSince(reviewsMeta.newest);
    if (mo !== null) {
      if (mo <= 3) pass('Fresh reviews');
      else add({ id: 'recency', label: 'Review recency', status: mo > 6 ? 'fail' : 'warn', sev: mo > 6 ? 1 : 3, value: `Newest review ~${mo} months ago`, why: 'Homeowners read a stale profile as a shop that’s slowing down.', fix: 'Ask for a review after every job so the newest one is always recent.' });
    }
  }
  // 6. Review response rate
  if (reviewsMeta && reviewsMeta.total > 0) {
    const rate = reviewsMeta.responded / reviewsMeta.total;
    if (rate >= 0.7) pass('Responds to reviews');
    else add({ id: 'response', label: 'Review responses', status: rate < 0.25 ? 'fail' : 'warn', sev: rate < 0.25 ? 1 : 3, value: `${reviewsMeta.responded} of ${reviewsMeta.total} answered`, why: 'Silence reads as not caring, and Google rewards profiles that respond.', fix: 'Reply to every review, even one line. Especially the negative ones.' });
  }
  // 7. Photos (omit on null — never "0 photos")
  if (num(m.photos) !== null) {
    const ph = num(m.photos);
    if (ph >= 15) pass(`${ph}+ photos`);
    else add({ id: 'photos', label: 'Photos', status: ph < 6 ? 'fail' : 'warn', sev: ph < 6 ? 2 : 3, value: `${ph} photo${ph === 1 ? '' : 's'}`, why: 'People buy this trade with their eyes, and a thin gallery looks like thin work.', fix: 'Add 15 to 20 sharp photos of finished kitchens and baths.' });
  }
  // 8. Description (omit on null — never "no description")
  if (str(m.description)) {
    const d = m.description.trim();
    if (d.length >= 120 && STRONG_CATS.test(d)) pass('Profile description');
    else add({ id: 'desc', label: 'Description', status: 'warn', sev: 4, value: d.length < 120 ? 'Short and thin' : 'Doesn’t mention your trade', why: 'The description is your pitch in the homeowner’s feed, and a thin one wastes it.', fix: 'Write a few lines on your kitchen and bath work, your area, and what sets you apart.' });
  }
  // 9. Attributes — relevant-and-missing only (omit on null; never dump raw list)
  if (m.attributes && typeof m.attributes === 'object') {
    const flat = JSON.stringify(m.attributes).toLowerCase();
    const missing = RELEVANT_ATTRS.filter((a) => !a.re.test(flat));
    if (missing.length === 0) pass('Key attributes set');
    else add({ id: 'attrs', label: 'Attributes', status: 'warn', sev: 4, value: `Missing: ${missing.map((a) => a.label).join(', ')}`, why: 'Homeowners filter Maps by these, and unchecked means filtered out before they ever see you.', fix: 'Turn on the ones that apply to you in your profile’s services and attributes.' });
  }
  // 10. Hours (pass when set; omit when unknown)
  if (m.hoursSet === true) pass('Hours listed');
  // 11. Phone (pass when present; omit when unknown)
  if (str(m.phone)) pass('Phone listed');
  // 12. Booking link — opportunity flag when absent
  if (str(m.book_online_url)) pass('Booking link');
  else if (dfsAuth) add({ id: 'book', label: 'Booking link', status: 'warn', sev: 4, value: 'None set', why: 'A booking link is one of the easiest ways to turn a Maps view into a booked estimate.', fix: 'Add a “Book online” link so homeowners can request an estimate without calling.' });
  // 13. Website link — present, or this is the finding (bridges to website section)
  if (str(m.domain)) pass('Website linked');
  else add({ id: 'web', label: 'Website link', status: 'fail', sev: 2, value: 'No website on the profile', why: 'With no link, the homeowner ready to look closer has nowhere to go, and you can’t show your work.', fix: 'Link a site built to turn that click into a booked job. That’s the call’s second half.' });
  // 14. Posts — "never" only when we successfully fetched updates and found none
  if (postsMeta) {
    if (postsMeta.newest) {
      const mo = monthsSince(postsMeta.newest);
      if (mo !== null && mo <= 3) pass('Posting updates');
      else add({ id: 'posts', label: 'Google posts', status: 'warn', sev: 4, value: mo !== null ? `Last post ~${mo} months ago` : 'Stale', why: 'Posts are free, signal an active business, and most competitors aren’t doing them. That’s your opening.', fix: 'Post a finished project every couple of weeks. It takes minutes.' });
    } else if (postsMeta.count === 0) {
      add({ id: 'posts', label: 'Google posts', status: 'warn', sev: 4, value: 'Never posted', why: 'Posts are free, signal an active business, and most competitors aren’t doing them. That’s your opening.', fix: 'Post a finished project every couple of weeks. It takes minutes.' });
    }
  }

  // worst-first: fail before warn, then by severity
  const rank = { fail: 0, warn: 1 };
  items.sort((a, b) => (rank[a.status] - rank[b.status]) || (a.sev - b.sev));

  // Website section (only if a domain is linked)
  let websiteSection = null;
  if (website) {
    const w = [];
    const wadd = (label, status, value, why) => w.push({ label, status, value, why });
    if (website.loads === false) wadd('Loads', 'fail', 'The site didn’t load', 'A homeowner who clicks and gets nothing is a job gone in one bounce.');
    else if (website.loads === true) {
      if (website.https === false) wadd('HTTPS', 'fail', 'Not secure (no HTTPS)', 'Browsers warn “Not secure,” and a homeowner reads that as “not safe to hire.”');
      else if (website.https === true) {}
      if (website.viewport === false) wadd('Mobile', 'fail', 'No mobile viewport', 'Most homeowners are on a phone, and a desktop-only site loses them instantly.');
      if (typeof website.perf === 'number') {
        if (website.perf < 50) wadd('Speed', 'fail', `PageSpeed ${website.perf}/100 (mobile)`, 'A slow site bleeds visitors before it loads, and Google ranks it lower too.');
        else if (website.perf < 90) wadd('Speed', 'warn', `PageSpeed ${website.perf}/100 (mobile)`, 'Every slow second costs you visitors who won’t wait.');
      }
      if (website.phoneAboveFold === false) wadd('Phone above the fold', 'warn', 'No tap-to-call up top', 'If she has to hunt for your number, she calls the shop that put theirs front and center.');
      if (website.cta === false) wadd('Clear call to action', 'warn', 'No obvious next step', 'A site with no clear “get a quote” leaves a ready buyer with nothing to do.');
    }
    const wpass = [];
    if (website.https === true) wpass.push('HTTPS secure');
    if (website.viewport === true) wpass.push('Mobile-friendly');
    if (typeof website.perf === 'number' && website.perf >= 90) wpass.push(`Fast (${website.perf}/100)`);
    if (website.phoneAboveFold === true) wpass.push('Phone up top');
    if (website.cta === true) wpass.push('Clear call to action');
    websiteSection = { url: website.url, items: w, passing: wpass };
  }

  const math = 'One kitchen is $20,000 to $30,000 to you. Win back one homeowner you’d have lost to a sharper-looking shop, and fixing all of this has already paid for itself.';

  return {
    profile: { name: m.name, reviews, rating },
    top: top || null,
    competitors: competitors.slice(0, 3),
    verdict,
    hook,
    audit: items,
    passing,
    website: websiteSection,
    math,
    segment: { band: verdict.key, worst: items[0]?.label || '' },
  };
}

// numeric / string guards: null/empty → null (UNKNOWN, gets omitted)
function num(v) { return typeof v === 'number' && !Number.isNaN(v) ? v : null; }
function str(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }

// Merge DataForSEO (authoritative for the rich fields) over Places (fallback
// for name / rating / website / photos), keeping null = UNKNOWN.
function mergeProfile(places, info) {
  const rating = info?.rating?.value ?? places?.rating ?? null;
  const reviews = info?.rating?.votes_count ?? places?.userRatingCount ?? null;
  const photos = info?.total_photos ?? (Array.isArray(places?.photos) ? places.photos.length : null);
  const domain = str(info?.domain) || str(info?.url) || str(places?.websiteUri);
  const hoursSet = info?.work_time?.work_hours ? true : (info && 'work_time' in info && !info.work_time ? null : (info?.work_time ? true : null));
  return {
    name: places?.displayName?.text || info?.title || 'Your shop',
    rating: num(rating),
    reviews: num(reviews),
    photos: num(photos),
    category: str(info?.category),
    additional_categories: Array.isArray(info?.additional_categories) ? info.additional_categories : null,
    description: str(info?.description),
    attributes: info?.attributes ?? null,
    phone: str(info?.phone),
    domain,
    book_online_url: str(info?.book_online_url),
    hoursSet,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const { placeId, sessionToken } = req.body || {};
  if (!placeId) return res.status(400).json({ ok: false, error: 'Missing placeId' });
  if (!PLACES_KEY) return res.status(200).json({ ok: true, degraded: true });

  const redis = getRedis();
  const cacheKey = `scorecard:v2:${placeId}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.status(200).json({ ok: true, cached: true, ...cached });
    } catch (err) { console.warn('cache read failed:', err.message); }
  }

  // Confirm name + coordinates (identify bridge)
  let places;
  try { places = await placeDetails(placeId, sessionToken); }
  catch (err) { console.warn('placeDetails failed:', err.message); return res.status(200).json({ ok: true, degraded: true }); }

  const lat = places?.location?.latitude;
  const lng = places?.location?.longitude;
  const name = places?.displayName?.text || '';
  if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(200).json({ ok: true, degraded: true });

  // Rich profile + competitors + reviews + posts (each best-effort, honest omit)
  const [info, rawCompetitors, reviewsMeta, postsMeta] = await Promise.all([
    fetchMyBusinessInfo(name, lat, lng),
    fetchCompetitors(lat, lng),
    fetchReviewsMeta(name, lat, lng),
    fetchPostsMeta(name, lat, lng),
  ]);

  const merged = mergeProfile(places, info);

  const competitors = (rawCompetitors || [])
    .filter((c) => !isExcluded(c.title))
    .filter((c) => str(c.title) && str(c.title).toLowerCase() !== (merged.name || '').toLowerCase())
    .map((c) => ({ name: c.title, reviews: num(c.rating?.votes_count) ?? 0, rating: num(c.rating?.value) ?? 0 }))
    .filter((c) => c.reviews > 0)
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, 3);
  const top = competitors[0] || null;

  // Website check only if a domain is linked
  let website = null;
  if (merged.domain) {
    try { website = await fetchWebsite(merged.domain); } catch { website = null; }
  }

  const payload = analyze(merged, top, competitors, reviewsMeta, postsMeta, website);

  if (redis) {
    try { await redis.set(cacheKey, payload, { ex: CACHE_TTL_SECONDS }); }
    catch (err) { console.warn('cache write failed:', err.message); }
  }
  return res.status(200).json({ ok: true, ...payload });
}
