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
    'X-Goog-FieldMask': 'id,displayName,location,rating,userRatingCount,websiteUri,addressComponents',
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

// ---------- Website check: real server-side HTML parse + PageSpeed ----------
// Every signal is presence/absence the parser can be SURE of, fetched from the
// live homepage. Anything it can't determine stays null and is omitted later
// (never shown as a failure). Each field maps 1:1 to a finding in analyze().
const IMG_JUNK = /logo|icon|favicon|sprite|avatar|badge|spinner|placeholder|pixel|loading|arrow|chevron|svg/i;
const CTA_RE = /(free|get|request|your)[^a-z]{0,14}(quote|estimate|consult)|book (now|online|a)|schedule (now|a|your)|get started|contact us/i;
const REVIEW_RE = /review|testimonial|rating|stars?\b/i;

async function fetchWebsite(domain) {
  const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const out = {
    url, loads: null, https: null, viewport: null, perf: null,
    h1: null, phoneAboveFold: null, cta: null, reviews: null, photos: null, footerYear: null,
  };
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

      // mobile viewport meta
      out.viewport = $('meta[name="viewport"]').length > 0;

      // the homepage's main headline, verbatim
      const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
      out.h1 = h1 || null;

      // tap-to-call near the top: a tel: link inside header/nav, or within the
      // first chunk of markup (a rough "above the fold" proxy)
      const hasTelTop = $('header a[href^="tel:"]').length > 0 || $('nav a[href^="tel:"]').length > 0 || /href=["']tel:/i.test(html.slice(0, 7000));
      out.phoneAboveFold = $('a[href^="tel:"]').length > 0 && hasTelTop;

      // a clear next step: a link/button whose text reads as quote/estimate/book/contact
      const actionText = $('a, button, [role="button"]').map((_, el) => $(el).text()).get().join(' · ');
      out.cta = CTA_RE.test(actionText);

      // reviews/testimonials shown on the page: class names, schema markup, or stars
      const classBlob = $('[class]').map((_, el) => $(el).attr('class')).get().join(' ');
      const ld = $('script[type="application/ld+json"]').map((_, el) => $(el).text()).get().join(' ');
      out.reviews = REVIEW_RE.test(classBlob) || /aggregaterating|"@type"\s*:\s*"review"/i.test(ld) || /★|⭐|☆/.test($('body').text());

      // meaningful project photos: <img> that aren't logos/icons/sprites/svgs
      let photos = 0;
      $('img').each((_, el) => {
        const src = ($(el).attr('src') || $(el).attr('data-src') || '').trim();
        if (!src) return;
        const probe = `${src} ${$(el).attr('alt') || ''} ${$(el).attr('class') || ''}`;
        if (IMG_JUNK.test(probe)) return;
        photos += 1;
      });
      out.photos = photos;

      // footer copyright year (take the most recent year shown in the footer)
      const footerTxt = ($('footer').text() || '') + ' ' + $('body').text().slice(-1800);
      const years = (footerTxt.match(/20\d{2}/g) || []).map((y) => parseInt(y, 10)).filter((y) => y >= 2000 && y <= 2100);
      out.footerYear = years.length ? Math.max(...years) : null;
    }
  } catch (err) {
    out.loads = false;
  }

  // PageSpeed (mobile) — free; better with a key (higher rate limit)
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

// ---------- analyze: build the graded, PERSONALIZED audit (worst-first) ----------
// Every finding names their number, the rival beating them on that line, their
// city, or their trade — then the stakes, then the fix. Shane's voice: short
// sentences, direct "you," empathy plus sting. City is woven where known and
// gracefully softened to "near you" when it isn't (never faked).
function analyze(merged, top, competitors, reviewsMeta, postsMeta, website, city) {
  const m = merged;
  const reviews = num(m.reviews);
  const rating = num(m.rating);
  const inCity = city ? `in ${city}` : 'near you';
  const cityHomeowner = city ? `a ${city} homeowner` : 'a homeowner near you';
  const CityHomeowner = city ? `A ${city} homeowner` : 'A homeowner near you';
  const rivalName = top ? top.name : 'the shop above you';

  // verdict + hook
  let verdict;
  const strong = rating >= 4.4 && reviews >= 25 && !!m.domain && (!top || reviews >= Math.round(top.reviews * 0.7));
  if ((reviews !== null && reviews <= 3) || (rating !== null && rating === 0)) {
    verdict = { key: 'absent', headline: 'You’re not in the room yet.', sub: `When ${cityHomeowner} checks you against the shops next to you, there’s almost nothing here to pick. That’s the cleanest fix on this page.` };
  } else if (strong) {
    verdict = { key: 'strong', headline: 'Your Google’s strong. The leak is after the click.', sub: 'You win the comparison. So the jobs you’re losing aren’t leaking here, they’re leaking on the website she lands on next.' };
  } else {
    verdict = { key: 'losing', headline: 'You’re in the game, and losing the comparison.', sub: `You show up. But next to the shop Google puts beside you, ${cityHomeowner} has a reason to pick them. Here’s exactly where.` };
  }
  let hook;
  if (top && reviews !== null) hook = `You’re at ${reviews}. ${rivalName}, the shop Google puts right above you ${inCity}, has ${top.reviews}.`;
  else if (rating !== null && rating < 4) hook = `You’re sitting at ${rating.toFixed(1)} stars, under the line most homeowners use to rule a shop out.`;
  else hook = `Here’s what ${cityHomeowner} sees when she checks your Google, graded.`;

  const items = []; // {id,label,status,value,why,fix,sev}
  const passing = [];
  const add = (it) => items.push(it);
  const pass = (label) => passing.push(label);

  // 1. Primary category
  if (str(m.category)) {
    if (STRONG_CATS.test(m.category)) pass(`Primary category (${m.category})`);
    else if (GENERIC_CATS.test(m.category.trim())) add({ id: 'cat1', label: 'Primary category', status: 'fail', sev: 1, value: `Yours is set to “${m.category}.”`, why: `Every homeowner searching “kitchen remodeler ${inCity}” is looking right past you.`, fix: 'Set it to the most specific category that fits, Kitchen remodeler or Bathroom remodeler.' });
    else add({ id: 'cat1', label: 'Primary category', status: 'warn', sev: 2, value: `Yours is set to “${m.category}.”`, why: `It might not be the words homeowners ${inCity} actually type, and that decides whether you show up at all.`, fix: 'Make sure it’s the most specific kitchen or bath category Google offers.' });
  }
  // 2. Secondary categories
  if (Array.isArray(m.additional_categories)) {
    const rel = m.additional_categories.filter((c) => STRONG_CATS.test(c));
    if (rel.length >= 2) pass(`${rel.length} relevant secondary categories`);
    else add({ id: 'cat2', label: 'Secondary categories', status: 'warn', sev: 3, value: rel.length ? `Only ${rel.length} relevant one.` : 'You’ve got none set.', why: `Each one is another search you could win ${inCity}, and most shops leave them empty. That’s an opening.`, fix: 'Add the ones that fit: Bathroom remodeler, Cabinet maker, Countertop store, Tile contractor.' });
  }
  // 3. Review count vs the named top rival
  if (reviews !== null && top) {
    if (reviews >= top.reviews) pass(`Review count (${reviews})`);
    else {
      const wide = reviews < top.reviews * 0.6;
      add({ id: 'rev', label: 'Review count', status: wide ? 'fail' : 'warn', sev: wide ? 1 : 3, value: `You’re at ${reviews}. ${top.name}, the shop Google puts right above you, has ${top.reviews}.`, why: `When ${cityHomeowner} compares the two of you, that gap is the whole decision.`, fix: 'Ask your last ten happy customers for a review, with a direct link. Then keep a steady trickle going.' });
    }
  }
  // 4. Star rating vs the 4.0 cliff
  if (rating !== null && rating > 0) {
    if (rating >= 4.3) pass(`${rating.toFixed(1)} star rating`);
    else {
      const under = rating < 4.0;
      const rivalStar = top && top.rating ? ` ${top.name}’s at ${top.rating.toFixed(1)}.` : '';
      add({ id: 'star', label: 'Star rating', status: under ? 'fail' : 'warn', sev: under ? 1 : 3, value: `You’re sitting at ${rating.toFixed(1)}.${rivalStar}`, why: under ? 'Most homeowners never read a word under four stars. They just scroll to the shop that’s over it.' : 'You’re right on the four-star line homeowners filter by, with no cushion under you.', fix: 'Reply to every review, the rough ones first, and ask happy customers until the average climbs.' });
    }
  }
  // 5. Review recency
  if (reviewsMeta?.newest) {
    const mo = monthsSince(reviewsMeta.newest);
    if (mo !== null) {
      if (mo <= 3) pass('Fresh reviews');
      else add({ id: 'recency', label: 'Review recency', status: mo > 6 ? 'fail' : 'warn', sev: mo > 6 ? 1 : 3, value: `Your newest review is about ${mo} months old.`, why: `${CityHomeowner} reads a stale profile as a shop that’s slowing down.`, fix: 'Ask for a review after every job, so the one on top is always recent.' });
    }
  }
  // 6. Review response rate
  if (reviewsMeta && reviewsMeta.total > 0) {
    const rate = reviewsMeta.responded / reviewsMeta.total;
    if (rate >= 0.7) pass('Responds to reviews');
    else add({ id: 'response', label: 'Review responses', status: rate < 0.25 ? 'fail' : 'warn', sev: rate < 0.25 ? 1 : 3, value: `You’ve answered ${reviewsMeta.responded} of your ${reviewsMeta.total} reviews.`, why: 'Silence reads as a shop that doesn’t care, and Google quietly favors the ones that reply.', fix: 'Reply to every review, even a line. The rough ones first.' });
  }
  // 7. Photos (omit on null — never "0 photos")
  if (num(m.photos) !== null) {
    const ph = num(m.photos);
    if (ph >= 15) pass(`${ph}+ photos`);
    else add({ id: 'photos', label: 'Photos', status: ph < 6 ? 'fail' : 'warn', sev: ph < 6 ? 2 : 3, value: `You’ve got ${ph} photo${ph === 1 ? '' : 's'} on the profile.`, why: 'People buy kitchens and baths with their eyes. A thin gallery looks like thin work.', fix: 'Add fifteen to twenty sharp shots of your finished jobs.' });
  }
  // 8. Description (omit on null — never "no description")
  if (str(m.description)) {
    const d = m.description.trim();
    if (d.length >= 120 && STRONG_CATS.test(d)) pass('Profile description');
    else add({ id: 'desc', label: 'Description', status: 'warn', sev: 4, value: d.length < 120 ? 'Your description is short and thin.' : 'Your description doesn’t even mention your trade.', why: `It’s your pitch in her feed ${inCity}, and right now it isn’t selling.`, fix: 'A few honest lines on your kitchen and bath work, your area, and what makes you different.' });
  }
  // 9. Attributes — relevant-and-missing only (omit on null; never dump raw list)
  if (m.attributes && typeof m.attributes === 'object') {
    const flat = JSON.stringify(m.attributes).toLowerCase();
    const missing = RELEVANT_ATTRS.filter((a) => !a.re.test(flat));
    if (missing.length === 0) pass('Key attributes set');
    else add({ id: 'attrs', label: 'Attributes', status: 'warn', sev: 4, value: `Missing: ${missing.map((a) => a.label).join(', ')}.`, why: `Homeowners filter Maps by these. Unchecked means you’re filtered out before she ever sees you.`, fix: 'Switch on the ones that apply to you, right in your profile.' });
  }
  // 10. Hours (pass when set; omit when unknown)
  if (m.hoursSet === true) pass('Hours listed');
  // 11. Phone (pass when present; omit when unknown)
  if (str(m.phone)) pass('Phone listed');
  // 12. Booking link — opportunity flag when absent
  if (str(m.book_online_url)) pass('Booking link');
  else if (dfsAuth) add({ id: 'book', label: 'Booking link', status: 'warn', sev: 4, value: 'You’ve got no “Book online” link.', why: 'It’s one of the easiest ways to turn a Maps look into a booked estimate, and yours is switched off.', fix: 'Add a booking link so she can ask for an estimate without picking up the phone.' });
  // 13. Website link — present, or this is the finding (bridges to website section)
  if (str(m.domain)) pass('Website linked');
  else add({ id: 'web', label: 'Website link', status: 'fail', sev: 2, value: 'There’s no website on your profile.', why: 'The homeowner ready to see your work hits a dead end, and you’ve got nothing to show her.', fix: 'Link a site built to turn that click into a booked job. That’s the second half of the call.' });
  // 14. Posts — "never" only when we successfully fetched updates and found none
  if (postsMeta) {
    if (postsMeta.newest) {
      const mo = monthsSince(postsMeta.newest);
      if (mo !== null && mo <= 3) pass('Posting updates');
      else add({ id: 'posts', label: 'Google posts', status: 'warn', sev: 4, value: mo !== null ? `Your last post was about ${mo} months ago.` : 'Your posts have gone stale.', why: `Posts are free, they signal a shop that’s busy, and almost nobody ${inCity} bothers. That’s your opening.`, fix: 'Post a finished project every couple of weeks. It takes minutes.' });
    } else if (postsMeta.count === 0) {
      add({ id: 'posts', label: 'Google posts', status: 'warn', sev: 4, value: 'You’ve never posted an update.', why: `Posts are free, they signal a shop that’s busy, and almost nobody ${inCity} bothers. That’s your opening.`, fix: 'Post a finished project every couple of weeks. It takes minutes.' });
    }
  }

  // worst-first: fail before warn, then by severity
  const rank = { fail: 0, warn: 1 };
  items.sort((a, b) => (rank[a.status] - rank[b.status]) || (a.sev - b.sev));

  // Website section — built from the live HTML parse. Each finding is pushed
  // ONLY when its signal is certain (boolean true/false or a real number);
  // null/unknown stays silent, never a failure. Worst-first, with a fix line.
  let websiteSection = null;
  if (website) {
    const w = [];
    const wpass = [];
    const wadd = (label, status, value, why, fix) => w.push({ label, status, value, why, fix });
    const thisYear = new Date().getFullYear();

    if (website.loads === false) {
      wadd('Loads', 'fail', 'Your site didn’t load for me.', 'A homeowner who clicks and gets nothing is a job gone in one bounce.', 'Get it back online, fast. Every minute down is a missed call.');
    } else if (website.loads === true) {
      // Speed
      if (typeof website.perf === 'number') {
        if (website.perf < 50) wadd('Speed', 'fail', `PageSpeed ${website.perf}/100 on mobile.`, 'A slow site bleeds visitors before it even loads, and Google ranks it lower for it.', 'Compress the images and cut the bloat so it loads in a second or two.');
        else if (website.perf < 90) wadd('Speed', 'warn', `PageSpeed ${website.perf}/100 on mobile.`, 'Every slow second costs you a homeowner who won’t wait.', 'Compress images and trim scripts to get it into the 90s.');
        else wpass.push(`Fast (${website.perf}/100)`);
      }
      // Secure
      if (website.https === false) wadd('Secure (HTTPS)', 'fail', 'Your site isn’t secure.', 'Her browser warns “Not secure,” and she reads that as “not safe to hire.”', 'Add an SSL certificate. Most hosts turn it on free in a click.');
      else if (website.https === true) wpass.push('HTTPS secure');
      // Mobile
      if (website.viewport === false) wadd('Mobile', 'fail', 'No mobile layout.', 'She’s on her phone. A desktop-only site loses her in a second.', 'Make the site responsive so it fits a phone screen.');
      else if (website.viewport === true) wpass.push('Mobile-friendly');
      // Photos of your work
      if (typeof website.photos === 'number') {
        if (website.photos <= 2) wadd('Photos of your work', 'fail', 'Almost no project photos on the homepage.', 'She came to see your kitchens, not a stock hero.', 'Lead with a gallery of your real finished kitchens and baths.');
        else if (website.photos < 8) wadd('Photos of your work', 'warn', `Only ${website.photos} photos on the homepage.`, 'A thin gallery looks like thin work.', 'Add more sharp shots of your finished kitchens and baths.');
        else wpass.push('Photos of your work');
      }
      // Footer year — only when genuinely stale (>2 years old)
      if (typeof website.footerYear === 'number' && website.footerYear < thisYear - 2) {
        wadd('Footer year', 'fail', `Your site footer says © ${website.footerYear}.`, 'A homeowner reads a years-old date as a shop that’s closed.', 'Set the footer year to update automatically so it’s never stale.');
      }
      // Tap-to-call up top
      if (website.phoneAboveFold === false) wadd('Tap-to-call up top', 'warn', 'No tap-to-call above the fold.', 'If she has to hunt for your number, she calls the shop that put theirs front and center.', 'Put a tappable phone number in the header, visible the second the page loads.');
      else if (website.phoneAboveFold === true) wpass.push('Phone up top');
      // Reviews on the site
      if (website.reviews === false) wadd('Reviews on your site', 'warn', 'No reviews shown on the page.', 'You’ve earned reviews, but a homeowner on your site never sees them, they’re one tab away from a competitor on Google.', 'Pull your best Google reviews onto the homepage where she lands.');
      else if (website.reviews === true) wpass.push('Reviews shown');
      // A clear next step
      if (website.cta === false) wadd('A clear next step', 'warn', 'No obvious “get a quote” button.', 'There’s no clear step to reach you, so she figures it out somewhere else.', 'Add one obvious “Get a free quote” button, repeated down the page.');
      else if (website.cta === true) wpass.push('Clear call to action');
      // What the site opens with (show the real H1; flag only when it never names the trade)
      if (website.h1) {
        if (STRONG_CATS.test(website.h1)) wpass.push('Headline names your trade');
        else wadd('What your site opens with', 'warn', website.h1, 'Your site opens with words that don’t say what you do. She cares what you build for her before who you are.', 'Open with the outcome: the kitchens and baths you build for homeowners like her.');
      }
    }

    // worst-first: fail before warn
    const wrank = { fail: 0, warn: 1 };
    w.sort((a, b) => wrank[a.status] - wrank[b.status]);
    websiteSection = { url: website.url, items: w, passing: wpass };
  }

  const math = `One kitchen ${inCity} runs a homeowner $20,000 to $30,000. Win back one you’d have lost to a sharper-looking shop, and every fix on this page has already paid for itself.`;

  return {
    profile: { name: m.name, reviews, rating },
    city: city || null,
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

// Pull the city (locality) from Places address components, falling back to
// DataForSEO's address_info. Null when unknown — never guessed.
function extractCity(places, info) {
  const comps = places?.addressComponents || [];
  const loc = comps.find((c) => (c.types || []).includes('locality'))
    || comps.find((c) => (c.types || []).includes('postal_town'))
    || comps.find((c) => (c.types || []).includes('sublocality'));
  return str(loc?.longText) || str(loc?.long_name) || str(info?.address_info?.city) || null;
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

  const city = extractCity(places, info);
  const payload = analyze(merged, top, competitors, reviewsMeta, postsMeta, website, city);

  if (redis) {
    try { await redis.set(cacheKey, payload, { ex: CACHE_TTL_SECONDS }); }
    catch (err) { console.warn('cache write failed:', err.message); }
  }
  return res.status(200).json({ ok: true, ...payload });
}
