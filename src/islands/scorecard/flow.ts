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
type WebsiteItem = { label: string; status: 'fail' | 'warn'; value: string; why: string };
type Payload = {
  ok?: boolean;
  degraded?: boolean;
  profile: { name: string; reviews: number | null; rating: number | null };
  top: Rival | null;
  competitors: Rival[];
  verdict: { key: string; headline: string; sub: string };
  hook: string;
  audit: AuditItem[];
  passing: string[];
  website: { url: string; items: WebsiteItem[]; passing: string[] } | null;
  math: string;
  segment: { band: string; worst: string };
};

const minutes = site.callLengthMinutes;

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
  top: { name: 'Granite Peak Kitchens', reviews: 142, rating: 4.8 },
  competitors: [
    { name: 'Granite Peak Kitchens', reviews: 142, rating: 4.8 },
    { name: 'Hearth & Home Remodelers', reviews: 96, rating: 4.7 },
    { name: 'Summit Bath & Kitchen', reviews: 61, rating: 4.6 },
  ],
  verdict: { key: 'losing', headline: 'You’re in the game, and losing the comparison.', sub: 'You show up. But next to the shop Google puts beside you, a homeowner has a reason to pick them. Here’s exactly where.' },
  hook: 'You have 7 reviews. The kitchen & bath shop Google shows first near you has 142.',
  audit: [
    { id: 'rev', label: 'Review count', status: 'fail', value: 'You 7 vs 142 for Granite Peak Kitchens', why: 'A wide review gap is the clearest reason a homeowner picks the other shop before she ever calls you.', fix: 'Ask your last ten happy customers with a direct link, then keep a steady trickle going.' },
    { id: 'star', label: 'Star rating', status: 'fail', value: '3.9 stars', why: 'Most homeowners filter out anything under four stars before they read a single word.', fix: 'Reply to every review, the negative ones first, and earn a run of honest 5-stars.' },
    { id: 'cat1', label: 'Primary category', status: 'fail', value: 'Yours: “General contractor”', why: 'Your primary category is the single biggest factor in which searches you appear in, and a generic one keeps you out of the kitchen and bath results.', fix: 'Set it to the most specific category that fits, like Kitchen remodeler or Bathroom remodeler.' },
    { id: 'photos', label: 'Photos', status: 'warn', value: '4 photos', why: 'People buy this trade with their eyes, and a thin gallery looks like thin work.', fix: 'Add 15 to 20 sharp photos of finished kitchens and baths.' },
    { id: 'recency', label: 'Review recency', status: 'warn', value: 'Newest review ~7 months ago', why: 'Homeowners read a stale profile as a shop that’s slowing down.', fix: 'Ask for a review after every job so the newest one is always recent.' },
    { id: 'response', label: 'Review responses', status: 'warn', value: '1 of 7 answered', why: 'Silence reads as not caring, and Google rewards profiles that respond.', fix: 'Reply to every review, even one line. Especially the negative ones.' },
    { id: 'cat2', label: 'Secondary categories', status: 'warn', value: 'None set', why: 'Each relevant secondary category is another search you can win, and most shops leave them empty.', fix: 'Add the ones that apply: Bathroom remodeler, Cabinet maker, Countertop store, Tile contractor.' },
    { id: 'attrs', label: 'Attributes', status: 'warn', value: 'Missing: Free estimates, Online estimates', why: 'Homeowners filter Maps by these, and unchecked means filtered out before they ever see you.', fix: 'Turn on the ones that apply to you in your profile’s services and attributes.' },
    { id: 'posts', label: 'Google posts', status: 'warn', value: 'Never posted', why: 'Posts are free, signal an active business, and most competitors aren’t doing them. That’s your opening.', fix: 'Post a finished project every couple of weeks. It takes minutes.' },
  ],
  passing: ['Hours listed', 'Phone listed', 'Website linked', 'Profile description'],
  website: {
    url: 'https://demokitchenbath.com',
    items: [
      { label: 'Speed', status: 'fail', value: 'PageSpeed 38/100 (mobile)', why: 'A slow site bleeds visitors before it loads, and Google ranks it lower too.' },
      { label: 'Phone above the fold', status: 'warn', value: 'No tap-to-call up top', why: 'If she has to hunt for your number, she calls the shop that put theirs front and center.' },
    ],
    passing: ['HTTPS secure', 'Mobile-friendly', 'Clear call to action'],
  },
  math: 'One kitchen is $20,000 to $30,000 to you. Win back one homeowner you’d have lost to a sharper-looking shop, and fixing all of this has already paid for itself.',
  segment: { band: 'losing', worst: 'Review count' },
};

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
  };

  let sessionToken = newToken();
  let payload: Payload | null = null;
  let chosen = { placeId: '', name: '' };
  let email = '';

  // ---------------- START ----------------
  root.querySelector('[data-start]')?.addEventListener('click', () => {
    track('ScorecardStarted');
    show('identify');
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
    if (q.length < 3) { renderAc([]); return; }
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
        if (data.degraded) { renderAc(import.meta.env.DEV ? MOCK_SUGGESTIONS : []); return; }
        renderAc(data.suggestions || []);
      } catch { renderAc(import.meta.env.DEV ? MOCK_SUGGESTIONS : []); }
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
    try {
      const r = await fetch('/api/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: chosen.placeId, sessionToken }),
      });
      const data = (await r.json()) as Payload;
      sessionToken = newToken(); // session consumed; fresh token for any retry
      if (!data.ok || data.degraded || !data.profile) {
        if (import.meta.env.DEV) { payload = MOCK_PAYLOAD; renderHook(); show('hook'); track('ScorecardHook', { band: MOCK_PAYLOAD.segment.band, mock: true }); return; }
        show('manual');
        return;
      }
      payload = data;
      renderHook();
      show('hook');
      track('ScorecardHook', { band: data.segment?.band });
    } catch {
      if (import.meta.env.DEV) { payload = MOCK_PAYLOAD; renderHook(); show('hook'); track('ScorecardHook', { band: MOCK_PAYLOAD.segment.band, mock: true }); return; }
      show('manual');
    }
  }

  // ---------------- HOOK ----------------
  function renderHook() {
    const host = root!.querySelector<HTMLElement>('[data-hook]');
    if (host && payload) host.textContent = payload.hook;
  }
  root.querySelector('[data-hook-next]')?.addEventListener('click', () => show('gate'));

  // ---------------- EMAIL GATE ----------------
  const gateForm = root.querySelector<HTMLFormElement>('[data-gate-form]');
  const gateStatus = root.querySelector<HTMLElement>('[data-gate-status]');
  gateForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(gateForm);
    if ((data.get('company') as string)?.trim()) return; // honeypot
    email = String(data.get('email') || '').trim();
    if (!emailOk(email)) { fail(gateStatus, 'That email doesn’t look right.'); return; }
    if (!data.get('consent')) { fail(gateStatus, 'Please tick the box so I can send it.'); return; }
    if (gateStatus) { gateStatus.hidden = false; gateStatus.textContent = ''; }

    void capture(false);             // fire-and-forget; never block the result
    track('ScorecardEmail', { band: payload?.segment?.band });
    renderResult();
    show('result');
    track('ScorecardResult', { band: payload?.segment?.band });
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
    track('ScorecardEmail', { via: 'manual' });
    show('manualDone');
  });

  async function capture(manual: boolean) {
    if (!payload) return;
    try {
      await fetch('/api/score-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scorecard',
          manual,
          email,
          business: payload.profile.name,
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

  function renderResult() {
    const host = root!.querySelector<HTMLElement>('[data-result-host]');
    if (!host || !payload) return;
    const p = payload;
    const me = p.profile;

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

    // website section — only when a domain is linked (else it's finding #13 above)
    let websiteHtml = '';
    if (p.website) {
      const wRows = p.website.items.map(gradeRow).join('');
      const wDoing = p.website.passing.length
        ? `<p class="sc-doing"><span class="sc-doing__label">Already working:</span> ${esc(p.website.passing.join(', '))}.</p>`
        : '';
      websiteHtml = `
        <section class="sc-section">
          <h3 class="sc-section__h">Your website</h3>
          <p class="sc-section__sub">The profile gets her to click. The site is where that click becomes a booked job, or doesn’t.</p>
          ${wRows ? `<ul class="sc-grades">${wRows}</ul>` : ''}
          ${wDoing}
        </section>`;
    }

    // owner-only tease — what the tool can't see (after the audit, before the CTA)
    const tease = `
      <div class="sc-tease">
        <p class="sc-tease__h">What this tool can’t see, but the call shows you</p>
        <p class="sc-tease__body">Which exact searches you’re showing up for and which you’re missing, how many people find you and call versus click away, and where you rank across your whole service area. That’s owner-only data, and it’s where the real money’s hiding.</p>
      </div>`;

    const isStrong = p.verdict.key === 'strong';
    const escalation = isStrong
      ? `This is the automated read, directional, not the last word. Your Google’s already done its job, so on the call I pull your live site apart the way a homeowner reads it and show you exactly where the click stops turning into a call. That’s what the ${minutes} minutes is for.`
      : `This is the automated read, directional, not the last word. On the call I pull the live side-by-side, find the exact spots they’re beating you, and hand you the fix in writing. That’s what the ${minutes} minutes is for.`;

    host.innerHTML = `
      <div class="sc-verdict sc-verdict--${esc(p.verdict.key)}">
        <p class="sc-verdict__eyebrow mono">Your scorecard</p>
        <h2 class="sc-verdict__h" data-focus tabindex="-1">${esc(p.verdict.headline)}</h2>
        <p class="sc-verdict__sub">${esc(p.verdict.sub)}</p>
      </div>
      ${table}
      <section class="sc-section">
        <h3 class="sc-section__h">Your Google Business Profile, graded</h3>
        <p class="sc-section__sub">Worst first. Each line is a homeowner you can stop losing.</p>
        <ul class="sc-grades">${audit}</ul>
        ${doing}
      </section>
      ${websiteHtml}
      ${tease}
      <p class="sc-math">${esc(p.math)}</p>
      <div class="sc-cta">
        <p class="sc-cta__copy">${esc(escalation)}</p>
        <a class="btn btn--primary btn--lg" href="${bookHref()}" data-book>Book the ${minutes}-minute call <span aria-hidden="true">→</span></a>
        <p class="sc-cta__second">A copy of this scorecard is on its way to ${esc(email)}.</p>
      </div>
      <p class="sc-sig">— ${esc(site.founder)}, ${esc(site.brand)}</p>
    `;
    host.querySelector('[data-book]')?.addEventListener('click', () => track('BookClicked', { via: 'scorecard', band: p.segment.band }));
  }

  function fail(el: HTMLElement | null, msg: string) {
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
  }

  show('start');
}
