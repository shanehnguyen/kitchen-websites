/* =====================================================================
   flow.ts — The Google Scorecard interactive flow (client-only).
   Screens: start → identify (Places autocomplete) → loading → hook
   (one true external fact, before the gate) → email gate → full result
   → escalation to /book. Plus the manual-capture degrade path (spec §5).
   The scorecard ESCALATES, it does not satisfy — every result ends
   pointed at the call (Scorecard spec §0, §6). init() is called explicitly
   from scorecard.astro; no auto-run.
   ===================================================================== */
import { site } from '../../data/site.config';

type Rival = { name: string; reviews: number; rating: number };
type AuditItem = { id: string; label: string; status: 'fail' | 'warn'; value: string; why: string; fix: string };
type WebsiteItem = { label: string; status: 'fail' | 'warn'; value: string; why: string; fix?: string };
type Rankings = {
  term: string;
  city: string | null;
  rank: number | null;
  inPack: boolean | null;
  above: string[];
  gridPct: number | null;
  cells: (number | null)[] | null;
  gridN: number | null;
  mapUrl: string | null;
  rankStatus: 'pass' | 'warn' | 'fail';
  gridStatus: 'pass' | 'warn' | 'fail' | null;
  why: string;
};
type Payload = {
  ok?: boolean;
  degraded?: boolean;
  profile: { name: string; reviews: number | null; rating: number | null };
  city: string | null;
  top: Rival | null;
  competitors: Rival[];
  verdict: { key: string; headline: string; sub: string };
  hook: string;
  rankings?: Rankings | null;
  audit: AuditItem[];
  passing: string[];
  website: { url: string; items: WebsiteItem[]; passing: string[] } | null;
  math: string;
  segment: { band: string; worst: string };
};

const minutes = site.callLengthMinutes;

// ============================================================================
// DEMO MODE — runs the entire scorecard on built-in sample data with ZERO API
// calls. No keys, no /api, no servers, no fetch timing to break. Click through
// the whole flow locally exactly as designed.
// FLIP TO false once GOOGLE_PLACES_API_KEY + DATAFORSEO_LOGIN/PASSWORD are set.
const DEMO_MODE: boolean = false;
// Flip to true to PREVIEW the "no website linked" empty state of the website
// section (the whole section collapses to a single bridge finding).
const DEMO_NO_WEBSITE: boolean = false;
// ============================================================================

// DEV-only fallback so the flow is clickable under `astro dev`, where the
// Vercel /api functions aren't served. Every use is guarded by a literal
// `import.meta.env.DEV` so Vite folds it to `false` in production and
// tree-shakes this whole block out. Real Places data always wins under
// `vercel dev` / deploy.
const MOCK_SUGGESTIONS = [
  { placeId: 'demo-place', primary: 'Demo Kitchen & Bath Co.', secondary: 'DEMO DATA · npm run dev only' },
  { placeId: 'demo-place-2', primary: 'Demo Remodeling Studio', secondary: 'DEMO DATA · npm run dev only' },
];
const MOCK_PAYLOAD: Payload = {
  ok: true,
  profile: { name: 'Demo Kitchen & Bath Co.', reviews: 7, rating: 3.9 },
  city: 'La Mirada',
  top: { name: 'Granite Peak Kitchens', reviews: 142, rating: 4.8 },
  competitors: [
    { name: 'Granite Peak Kitchens', reviews: 142, rating: 4.8 },
    { name: 'Hearth & Home Remodelers', reviews: 96, rating: 4.7 },
    { name: 'Summit Bath & Kitchen', reviews: 61, rating: 4.6 },
  ],
  verdict: { key: 'losing', headline: 'You’re in the game, and losing the comparison.', sub: 'You show up. But next to the shop Google puts beside you, a La Mirada homeowner has a reason to pick them. Here’s exactly where.' },
  hook: 'You have 7 Google reviews. Granite Peak Kitchens, the shop Google puts right above you in La Mirada, has 142.',
  rankings: {
    term: 'kitchen remodeler La Mirada',
    city: 'La Mirada',
    rank: 7,
    inPack: true,
    above: ['Granite Peak Kitchens', 'Hearth & Home Remodelers', 'Summit Bath & Kitchen'],
    gridPct: 20,
    cells: [
      0,  0, 12,  0,  0,
      0,  8,  5,  9,  0,
     15,  3,  1,  3, 14,
      0,  6,  2,  7,  0,
      0,  0, 11,  0,  0,
    ],
    gridN: 5,
    mapUrl: null,
    rankStatus: 'warn',
    gridStatus: 'warn',
    why: 'When a La Mirada homeowner searches “kitchen remodeler La Mirada”, Google shows three shops on the map before anything else. Those three split almost every call. Everyone ranked below them is on a second screen she rarely reaches. This is the single biggest source of new homeowners in La Mirada, and it runs on autopilot once you win it.',
  },
  audit: [
    { id: 'rev', label: 'Review count', status: 'fail', value: 'You’re at 7. Granite Peak Kitchens, the shop Google puts right above you, has 142.', why: 'When a La Mirada homeowner compares the two of you, that gap is the whole decision.', fix: 'Ask your last ten happy customers for a review, with a direct link. Then keep a steady trickle going.' },
    { id: 'star', label: 'Star rating', status: 'fail', value: 'You’re sitting at 3.9. Granite Peak’s at 4.8.', why: 'Most homeowners never read a word under four stars. They just scroll to the shop that’s over it.', fix: 'Reply to every review, the rough ones first, and ask happy customers until the average climbs.' },
    { id: 'cat1', label: 'Primary category', status: 'fail', value: 'Yours is set to “General contractor.”', why: 'Every homeowner searching “kitchen remodeler in La Mirada” is looking right past you.', fix: 'Set it to the most specific category that fits, Kitchen remodeler or Bathroom remodeler.' },
    { id: 'photos', label: 'Photos', status: 'warn', value: 'You’ve got 4 photos on the profile.', why: 'People buy kitchens and baths with their eyes. A thin gallery looks like thin work.', fix: 'Add fifteen to twenty sharp shots of your finished jobs.' },
    { id: 'recency', label: 'Review recency', status: 'warn', value: 'Your newest review is about 7 months old.', why: 'A La Mirada homeowner reads a stale profile as a shop that’s slowing down.', fix: 'Ask for a review after every job, so the one on top is always recent.' },
    { id: 'response', label: 'Review responses', status: 'warn', value: 'You’ve answered 1 of your 7 reviews.', why: 'Silence reads as a shop that doesn’t care, and Google quietly favors the ones that reply.', fix: 'Reply to every review, even a line. The rough ones first.' },
    { id: 'cat2', label: 'Secondary categories', status: 'warn', value: 'You’ve got none set.', why: 'Each one is another search you could win in La Mirada, and most shops leave them empty. That’s an opening.', fix: 'Add the ones that fit: Bathroom remodeler, Cabinet maker, Countertop store, Tile contractor.' },
    { id: 'attrs', label: 'Attributes', status: 'warn', value: 'Missing: Free estimates, Online estimates.', why: 'Homeowners filter Maps by these. Unchecked means you’re filtered out before she ever sees you.', fix: 'Switch on the ones that apply to you, right in your profile.' },
    { id: 'posts', label: 'Google posts', status: 'warn', value: 'You’ve never posted an update.', why: 'Posts are free, they signal a shop that’s busy, and almost nobody in La Mirada bothers. That’s your opening.', fix: 'Post a finished project every couple of weeks. It takes minutes.' },
  ],
  passing: ['Hours listed', 'Phone listed', 'Website linked', 'Profile description'],
  website: {
    url: 'https://demokitchenbath.com',
    // DEMO website findings — hardcoded placeholders, worst-first. Each maps to
    // a real server-side HTML check (the [bracket]); the live version swaps the
    // value/status source without touching this UI. Honesty: each finding
    // reports presence/absence only, never a quality judgment, and in the live
    // version is pushed ONLY when its check is certain — uncertain/unknown stays
    // silent and is never shown as a fail.
    items: [
      // [from PageSpeed API — already live]
      { label: 'Speed', status: 'fail', value: 'PageSpeed 38/100 on mobile.', why: 'A slow site bleeds visitors before it even loads, and Google ranks it lower for it.', fix: 'Compress the images and cut the bloat so it loads in a second or two.' },
      // [check: count of meaningful <img> tags beyond logo/icons]
      { label: 'Photos of your work', status: 'fail', value: 'Almost no project photos on the homepage.', why: 'She came to see your kitchens, not a stock hero.', fix: 'Lead with a gallery of your real finished kitchens and baths.' },
      // [check: footer year — fire ONLY if more than ~2 years old]
      { label: 'Footer year', status: 'fail', value: 'Your site footer says © 2019.', why: 'A homeowner reads a years-old date as a shop that’s closed.', fix: 'Set the footer year to update automatically so it’s never stale.' },
      // [check: tel: link present AND within the first screen]
      { label: 'Tap-to-call up top', status: 'warn', value: 'No tap-to-call above the fold.', why: 'If she has to hunt for your number, she calls the shop that put theirs front and center.', fix: 'Put a tappable phone number in the header, visible the second the page loads.' },
      // [check: testimonial/review block or star markup present]
      { label: 'Reviews on your site', status: 'warn', value: 'No reviews shown on the page.', why: 'You’ve earned reviews, but a homeowner on your site never sees them, they’re one tab away from a competitor on Google.', fix: 'Pull your best Google reviews onto the homepage where she lands.' },
      // [check: <h1> text — show it verbatim as the data line]
      { label: 'What your site opens with', status: 'warn', value: 'Welcome to Demo Kitchen & Bath Co.', why: 'Your site opens with your company name, not the kitchens you build. She cares what you do for her before who you are.', fix: 'Open with the outcome: the kitchens and baths you build for homeowners like her.' },
      // [check: link/button with contact/quote/book intent]
      { label: 'A clear next step', status: 'warn', value: 'No obvious “get a quote” button.', why: 'There’s no clear step to reach you, so she figures it out somewhere else.', fix: 'Add one obvious “Get a free quote” button, repeated down the page.' },
    ],
    passing: ['HTTPS secure', 'Mobile-friendly', 'Clear call to action'],
  },
  math: 'One kitchen in La Mirada runs a homeowner $20,000 to $30,000. Win back one you’d have lost to a sharper-looking shop, and every fix on this page has already paid for itself.',
  segment: { band: 'losing', worst: 'Review count' },
};

// Demo payload selector. Default = full audit with a website. With
// DEMO_NO_WEBSITE on, returns the "no website linked" variant: website is null
// (so the website section collapses to the bridge finding), the GBP audit gains
// the website-link failure, and "Website linked" drops from the doing-right line.
function demoPayload(): Payload {
  if (!DEMO_NO_WEBSITE) return MOCK_PAYLOAD;
  return {
    ...MOCK_PAYLOAD,
    website: null,
    passing: MOCK_PAYLOAD.passing.filter((s) => s !== 'Website linked'),
    audit: [
      { id: 'web', label: 'Website link', status: 'fail', value: 'There’s no website on your profile.', why: 'The homeowner ready to see your work hits a dead end, and you’ve got nothing to show her.', fix: 'Link a site built to turn that click into a booked job. That’s the second half of the call.' },
      ...MOCK_PAYLOAD.audit,
    ],
  };
}

// Use the demo data on ANY localhost server — `astro dev`, `vercel dev`, or
// even a stale `astro preview`/built bundle on localhost. import.meta.env.DEV
// alone wasn't enough (a preview/built server reports it false), which made the
// scorecard look broken locally. This is a RUNTIME check, so it never activates
// on the real domain — production visitors never see demo data.
const DEV_MOCK = (() => {
  if (import.meta.env.DEV) return true;
  try {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local');
  } catch { return false; }
})();
const dlog = (...a: unknown[]) => { if (DEV_MOCK) { try { console.info('[scorecard]', ...a); } catch { /* noop */ } } };

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const track = (name: string, params?: Record<string, unknown>) => {
  try { (window as any).kwTrack?.(name, params || {}); } catch { /* noop */ }
};
const newToken = () => {
  try { return (crypto as any).randomUUID(); } catch { return `sc-${Date.now()}-${Math.round(performance.now())}`; }
};
const bookHref = () => {
  const qs = window.location.search;
  return qs && qs.indexOf('utm_') > -1 ? `/book${qs}` : '/book';
};
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function init() {
  const root = document.querySelector<HTMLElement>('[data-sc-root]');
  if (!root) return;

  const screens = Array.from(root.querySelectorAll<HTMLElement>('[data-sc-screen]'));
  const show = (name: string) => {
    screens.forEach((s) => { s.hidden = s.dataset.scScreen !== name; });
    const focusable = root.querySelector<HTMLElement>(`[data-sc-screen="${name}"] [data-focus]`);
    requestAnimationFrame(() => focusable?.focus());
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // demo: show the sample businesses the moment the identify screen appears,
    // so you can just click one — no typing, no API.
    if (name === 'identify' && DEMO_MODE) renderAc(MOCK_SUGGESTIONS);
  };

  let sessionToken = newToken();
  let payload: Payload | null = null;
  let chosen = { placeId: '', name: '' };
  let email = '';
  let firstName = '';

  // ---------------- START (landing) ----------------
  // Both "Check my Google" buttons live in a [data-start-form]. The landing
  // input is non-functional for now; on submit we advance to the real identify
  // step and carry the typed name into the live autocomplete (drop-in path).
  root.querySelectorAll<HTMLFormElement>('[data-start-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      dlog('start tapped');
      track('ScorecardStarted');
      const typed = (form.querySelector<HTMLInputElement>('[data-start-input]')?.value || '').trim();
      show('identify');
      const ai = root.querySelector<HTMLInputElement>('[data-ac-input]');
      if (typed && ai) {
        ai.value = typed;
        ai.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });

  // ---------------- IDENTIFY (autocomplete) ----------------
  const acInput = root.querySelector<HTMLInputElement>('[data-ac-input]');
  const acList = root.querySelector<HTMLElement>('[data-ac-list]');
  let acTimer: number | undefined;
  let lastQuery = '';

  const renderAc = (suggestions: { placeId: string; primary: string; secondary: string }[]) => {
    if (!acList) return;
    if (!suggestions.length) { acList.innerHTML = ''; acList.hidden = true; return; }
    acList.innerHTML = suggestions
      .map(
        (s) =>
          `<button type="button" class="sc-ac__item" data-place-id="${esc(s.placeId)}" data-place-name="${esc(s.primary)}">
             <span class="sc-ac__primary">${esc(s.primary)}</span>
             ${s.secondary ? `<span class="sc-ac__secondary">${esc(s.secondary)}</span>` : ''}
           </button>`
      )
      .join('');
    acList.hidden = false;
  };

  acInput?.addEventListener('input', () => {
    const q = acInput.value.trim();
    window.clearTimeout(acTimer);
    if (q.length < 2) { renderAc([]); return; }
    if (DEMO_MODE) { renderAc(MOCK_SUGGESTIONS); return; }   // demo: instant sample list, no API
    acTimer = window.setTimeout(async () => {
      if (q === lastQuery) return;
      lastQuery = q;
      try {
        const r = await fetch('/api/places-autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: q, sessionToken }),
        });
        const data = await r.json();
        if (data.degraded) { renderAc(DEV_MOCK ? MOCK_SUGGESTIONS : []); return; }
        renderAc(data.suggestions || []);
      } catch { renderAc(DEV_MOCK ? MOCK_SUGGESTIONS : []); }
    }, 250);
  });

  acList?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-place-id]');
    if (!btn) return;
    chosen = { placeId: btn.dataset.placeId || '', name: btn.dataset.placeName || '' };
    track('ScorecardIdentified', { name: chosen.name });
    runLookup();
  });

  // "Can't find it" → manual capture
  root.querySelectorAll('[data-manual-link]').forEach((el) =>
    el.addEventListener('click', (e) => { e.preventDefault(); show('manual'); })
  );

  // ---------------- LOOKUP ----------------
  async function runLookup() {
    show('loading');
    if (DEMO_MODE) {                                          // demo: straight to sample result, no API
      window.setTimeout(() => {
        payload = demoPayload();
        renderHook();
        show('hook');
        track('ScorecardHook', { band: payload?.segment.band, demo: true });
      }, 600);
      return;
    }
    try {
      const r = await fetch('/api/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: chosen.placeId, sessionToken }),
      });
      const data = (await r.json()) as Payload;
      sessionToken = newToken(); // session consumed; fresh token for any retry
      if (!data.ok || data.degraded || !data.profile) {
        if (DEV_MOCK) { dlog('using demo data (no live API on localhost)'); payload = MOCK_PAYLOAD; renderHook(); show('hook'); track('ScorecardHook', { band: MOCK_PAYLOAD.segment.band, mock: true }); return; }
        show('manual');
        return;
      }
      payload = data;
      renderHook();
      show('hook');
      track('ScorecardHook', { band: data.segment?.band });
    } catch {
      if (DEV_MOCK) { dlog('using demo data (no live API on localhost)'); payload = MOCK_PAYLOAD; renderHook(); show('hook'); track('ScorecardHook', { band: MOCK_PAYLOAD.segment.band, mock: true }); return; }
      show('manual');
    }
  }

  // ---------------- HOOK ----------------
  function renderHook() {
    const host = root!.querySelector<HTMLElement>('[data-hook]');
    if (host && payload) host.textContent = payload.hook;
  }
  root.querySelector('[data-hook-next]')?.addEventListener('click', () => {
    if (DEMO_MODE) { dlog('hook → full scorecard (demo, gate skipped)'); goToResult(); return; }
    dlog('hook → gate');
    show('gate');
  });

  // Single hardened path to the result. Used by both "See the full scorecard"
  // buttons. Never leaves a dead button: if rendering throws, it still shows
  // the result screen and logs the error.
  function goToResult() {
    void capture(false);
    track('ScorecardEmail', { band: payload?.segment?.band, demo: DEMO_MODE });
    try {
      renderResult();
    } catch (err) {
      console.error('[scorecard] result render failed:', err);
    }
    show('result');
    // make the result shareable: stamp the business into the URL so the link reopens it
    if (!DEMO_MODE && chosen.placeId) {
      try { history.replaceState(null, '', `#b=${encodeURIComponent(chosen.placeId)}`); } catch { /* noop */ }
    }
    track('ScorecardResult', { band: payload?.segment?.band, demo: DEMO_MODE });
  }

  // Shared-link path: a link like /scorecard#b=<placeId> reopens that scorecard
  // straight to the full result (no gate — the original visitor already gave email).
  // Cached server-side, so a shared open is fast and effectively free within the TTL.
  async function runSharedResult(placeId: string) {
    chosen = { placeId, name: '' };
    show('loading');
    try {
      const r = await fetch('/api/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId }),
      });
      const data = (await r.json()) as Payload;
      if (!data.ok || data.degraded || !data.profile) { show('start'); return; }
      payload = data;
      try { renderResult(); } catch (err) { console.error('[scorecard] shared render failed:', err); }
      show('result');
      track('ScorecardSharedOpen', { band: data.segment?.band });
    } catch { show('start'); }
  }

  // copy-link button inside the rendered result (delegated; result is innerHTML)
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-share]');
    if (!btn) return;
    const done = (msg: string) => { const o = btn.textContent || ''; btn.textContent = msg; window.setTimeout(() => { btn.textContent = o; }, 2000); };
    navigator.clipboard?.writeText(location.href).then(() => done('Link copied ✓')).catch(() => done('Copy failed'));
  });

  // ---------------- EMAIL GATE ----------------
  const gateForm = root.querySelector<HTMLFormElement>('[data-gate-form]');
  const gateStatus = root.querySelector<HTMLElement>('[data-gate-status]');
  gateForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (DEMO_MODE) { dlog('gate → result (demo, no validation)'); goToResult(); return; }
    const data = new FormData(gateForm);
    if ((data.get('company') as string)?.trim()) return; // honeypot
    firstName = String(data.get('firstName') || '').trim();
    email = String(data.get('email') || '').trim();
    if (!emailOk(email)) { dlog('gate blocked: invalid email'); fail(gateStatus, 'That email doesn’t look right.'); return; }
    if (!data.get('consent')) { dlog('gate blocked: consent not ticked'); fail(gateStatus, 'Please tick the box so I can send it.'); return; }
    if (gateStatus) { gateStatus.hidden = false; gateStatus.textContent = ''; }
    goToResult();
  });

  // ---------------- MANUAL CAPTURE (degrade path) ----------------
  const manualForm = root.querySelector<HTMLFormElement>('[data-manual-form]');
  const manualStatus = root.querySelector<HTMLElement>('[data-manual-status]');
  manualForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(manualForm);
    if ((data.get('company') as string)?.trim()) return; // honeypot
    const mEmail = String(data.get('email') || '').trim();
    const business = String(data.get('business') || '').trim();
    if (!business) { fail(manualStatus, 'Add your business name.'); return; }
    if (!emailOk(mEmail)) { fail(manualStatus, 'That email doesn’t look right.'); return; }
    if (!data.get('consent')) { fail(manualStatus, 'Please tick the box so I can send it.'); return; }
    if (manualStatus) { manualStatus.hidden = false; manualStatus.textContent = 'Sending…'; }
    if (!DEMO_MODE) {
      try {
        await fetch('/api/score-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'scorecard',
            manual: true,
            email: mEmail,
            business,
            city: String(data.get('city') || '').trim(),
          }),
        });
      } catch { /* still confirm; the lead is the point */ }
    }
    track('ScorecardEmail', { via: 'manual' });
    show('manualDone');
  });

  async function capture(manual: boolean) {
    if (DEMO_MODE || !payload) return;   // demo: don't POST anywhere
    try {
      await fetch('/api/score-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scorecard',
          manual,
          email,
          firstName,
          business: payload.profile.name,
          city: payload.city,
          band: payload.segment.band,
          worst: payload.segment.worst,
          reviews: payload.profile.reviews,
          rating: payload.profile.rating,
          topReviews: payload.top?.reviews ?? '',
        }),
      });
    } catch { /* the result still renders; capture is best-effort */ }
  }

  // ---------------- RESULT ----------------
  const chip = (s: 'fail' | 'warn') => (s === 'fail' ? 'Fix this' : 'Tighten');
  const gradeRow = (it: { label: string; status: 'fail' | 'warn'; value: string; why: string; fix?: string }) => `
    <li class="sc-grade sc-grade--${it.status}">
      <div class="sc-grade__head">
        <span class="sc-grade__chip">${chip(it.status)}</span>
        <span class="sc-grade__label">${esc(it.label)}</span>
      </div>
      <p class="sc-grade__value">${esc(it.value)}</p>
      <p class="sc-grade__why">${esc(it.why)}</p>
      ${it.fix ? `<p class="sc-grade__fix"><span class="sc-grade__fixlabel">The fix:</span> ${esc(it.fix)}</p>` : ''}
    </li>`;

  // Rankings section — its own visual: a big map with rank pins + headline numbers.
  const renderRankings = (r: Rankings) => {
    const cells = r.cells || [];
    const n = r.gridN || (cells.length === 25 ? 5 : 3);
    const place = esc(r.city || 'your area');
    const center = Math.floor((n * n) / 2); // middle cell = the shop
    const bg = r.mapUrl
      ? `style="background-image:url('${esc(r.mapUrl)}');background-size:cover;background-position:center;"`
      : '';
    const map = cells.length === n * n
      ? `<div class="sc-map${r.mapUrl ? ' sc-map--real' : ''}" ${bg} role="img" aria-label="Map coverage: where you rank across ${place}">
          <div class="sc-map__grid" style="--n:${n};grid-template-columns:repeat(${n},1fr);grid-template-rows:repeat(${n},1fr);">
            ${cells.map((c, i) => {
              const state = c === null ? 'nodata' : c === 0 ? 'out' : c <= 3 ? 'in' : c <= 10 ? 'mid' : 'low';
              const txt = c === null ? '?' : c === 0 ? '✕' : (c > 20 ? '20+' : String(c));
              const you = i === center ? ' sc-pin--you' : '';
              return `<span class="sc-pin sc-pin--${state}${you}"><span class="sc-pin__n">${txt}</span></span>`;
            }).join('')}
          </div>
          <span class="sc-map__tag">${place}</span>
        </div>`
      : '';
    const rankNum = r.rank == null ? 'Not in top&nbsp;3' : `#${r.rank}`;
    const stats = `
      <div class="sc-rank__stats">
        <div class="sc-rank__stat sc-rank__stat--${r.rankStatus}">
          <span class="sc-rank__num">${rankNum}</span>
          <span class="sc-rank__cap">your spot for “${esc(r.term)}”</span>
        </div>
        ${r.gridPct != null ? `<div class="sc-rank__stat sc-rank__stat--${r.gridStatus}">
          <span class="sc-rank__num">${r.gridPct}%</span>
          <span class="sc-rank__cap">of the map where you’re in the top 3</span>
        </div>` : ''}
      </div>`;
    return `
      <section class="sc-section sc-rank">
        <p class="eyebrow sc-eyebrow">Where homeowners look first</p>
        <h3 class="sc-section__h">Your rank on the Google map</h3>
        <p class="sc-section__sub">${esc(r.why)}</p>
        ${map}
        ${map ? `<p class="sc-map__legend"><span class="sc-map__key sc-map__key--in"></span> Top 3&nbsp;&nbsp;<span class="sc-map__key sc-map__key--mid"></span> 4–10&nbsp;&nbsp;<span class="sc-map__key sc-map__key--low"></span> 11+&nbsp;&nbsp;<span class="sc-map__key sc-map__key--out"></span> Not ranking&nbsp;&nbsp;<span class="sc-map__key sc-map__key--you"></span> Your shop &nbsp;·&nbsp; each pin is your rank where a homeowner searches from around ${place}</p>` : ''}
        ${stats}
        ${r.above.length ? `<p class="sc-rank__above"><span class="sc-rank__abovelabel">Ahead of you on the map:</span> ${esc(r.above.join(', '))}.</p>` : ''}
      </section>`;
  };

  function renderResult() {
    const host = root!.querySelector<HTMLElement>('[data-result-host]');
    if (!host || !payload) return;
    const p = payload;
    const me = p.profile;

    // Made-for-this-person header: name them (first name if we captured one,
    // else the business name), and name their city. Never guessed.
    const greetName = firstName || me.name;
    const cityPhrase = p.city ? `a homeowner in ${p.city}` : 'a homeowner near you';
    const eyebrow = firstName ? `${firstName}, your scorecard` : `${me.name}, your scorecard`;
    const intro = `${greetName}, here’s what ${cityPhrase} sees when she checks you against the shops next to you.`;

    // competitor comparison table (his row distinguished, losing numbers in --alarm)
    const meReviewsAlarm = p.top && me.reviews !== null && me.reviews < p.top.reviews ? ' sc-num--alarm' : '';
    const meRatingAlarm = me.rating !== null && me.rating > 0 && me.rating < 4.0 ? ' sc-num--alarm' : '';
    const rows: string[] = [];
    rows.push(
      `<tr class="sc-table__me">
        <th scope="row">${esc(me.name)} <span class="sc-table__tag">you</span></th>
        <td class="sc-num${meReviewsAlarm}">${me.reviews ?? '—'}</td>
        <td class="sc-num${meRatingAlarm}">${me.rating ? me.rating.toFixed(1) : '—'}</td>
      </tr>`
    );
    p.competitors.forEach((c) => {
      rows.push(
        `<tr>
          <th scope="row">${esc(c.name)}</th>
          <td class="sc-num">${c.reviews}</td>
          <td class="sc-num">${c.rating ? c.rating.toFixed(1) : '—'}</td>
        </tr>`
      );
    });
    const table = p.competitors.length
      ? `<div class="sc-tablewrap">
          <table class="sc-table">
            <thead><tr><th scope="col">Kitchen &amp; bath near you</th><th scope="col">Reviews</th><th scope="col">Stars</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>`
      : '';

    // the graded GBP audit (already worst-first from the server)
    const audit = p.audit.map(gradeRow).join('');
    const doing = p.passing.length
      ? `<p class="sc-doing"><span class="sc-doing__label">What you’re already doing right:</span> ${esc(p.passing.join(', '))}.</p>`
      : '';

    // website section — always shown. Full findings when a site is linked;
    // otherwise it collapses to a single bridge finding (no pitch). Each finding
    // is presence/absence only; a real check renders only when certain.
    let websiteHtml;
    if (p.website && p.website.items.length) {
      const wRows = p.website.items.map(gradeRow).join('');
      const wDoing = p.website.passing.length
        ? `<p class="sc-doing"><span class="sc-doing__label">Already working:</span> ${esc(p.website.passing.join(', '))}.</p>`
        : '';
      websiteHtml = `
        <section class="sc-section">
          <p class="eyebrow sc-eyebrow">After the click</p>
          <h3 class="sc-section__h">Your website</h3>
          <p class="sc-section__sub">The profile gets her to click. The site is where that click becomes a booked job, or doesn’t.</p>
          <ul class="sc-grades">${wRows}</ul>
          ${wDoing}
        </section>`;
    } else {
      websiteHtml = `
        <section class="sc-section">
          <p class="eyebrow sc-eyebrow">After the click</p>
          <h3 class="sc-section__h">Your website</h3>
          <p class="sc-section__sub">There’s no website linked on your Google profile.</p>
          <ul class="sc-grades">${gradeRow({ label: 'No website to send her to', status: 'fail', value: 'No website on your Google profile.', why: 'The homeowner ready to look closer has nowhere to go, so she clicks back to someone who gave her one.', fix: 'On the call we map exactly what a homeowner needs to see after she clicks, so the next one becomes a booked job.' })}</ul>
        </section>`;
    }

    // "More info" prompt with a down arrow pointing to the video below
    const more = `
      <div class="sc-more">
        <p class="sc-more__label">More info</p>
        <span class="sc-more__arrow" aria-hidden="true">↓</span>
      </div>`;

    // Everything after the owner-only tease is the full homepage, rendered
    // statically below this host (see scorecard.astro). The audit ends here.
    host.innerHTML = `
      <div class="sc-verdict sc-verdict--${esc(p.verdict.key)}">
        <p class="sc-verdict__eyebrow eyebrow">${esc(eyebrow)}</p>
        <h2 class="sc-verdict__h" data-focus tabindex="-1">${esc(p.verdict.headline)}</h2>
        <p class="sc-verdict__sub">${esc(intro)}</p>
        ${(!DEMO_MODE && chosen.placeId) ? `<button type="button" class="sc-share" data-share>Copy link to this scorecard</button>` : ''}
      </div>
      ${table ? `<section class="sc-section"><p class="eyebrow sc-eyebrow">Where you stand</p>${table}</section>` : ''}
      ${p.rankings ? renderRankings(p.rankings) : ''}
      <section class="sc-section">
        <p class="eyebrow sc-eyebrow">The audit</p>
        <h3 class="sc-section__h">Your Google Business Profile, graded</h3>
        <p class="sc-section__sub">Worst first. Each line is a homeowner you can stop losing.</p>
        <ul class="sc-grades">${audit}</ul>
        ${doing}
      </section>
      ${websiteHtml}
      ${more}
    `;
  }

  function fail(el: HTMLElement | null, msg: string) {
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
  }

  dlog('ready · DEV_MOCK =', DEV_MOCK);
  // shared / deep link: /scorecard#b=<placeId> (or ?b=<placeId>) reopens the result
  const sharedId = (() => {
    try {
      return new URLSearchParams(location.hash.replace(/^#/, '')).get('b')
        || new URLSearchParams(location.search).get('b') || '';
    } catch { return ''; }
  })();
  if (sharedId && !DEMO_MODE) { dlog('shared link → result', sharedId); void runSharedResult(sharedId); }
  else show('start');
}
