/* Booking-funnel beacons → /api/pulse. Same-origin sendBeacon so a report still
   goes out when the tab is closing — that's the whole point: we need the "they
   left" moment to catch drop-offs. Everything no-ops safely if unavailable, so
   a blocked beacon never breaks the booking flow. */
const ENDPOINT = '/api/pulse';
const ID_KEY = 'kw_pulse_id_v1';

// One id per visit (sessionStorage: survives reloads/step reveals, a genuinely
// new visit gets a fresh id → a fresh journey → at most one email per visit).
export function pulseId() {
  const mint = () => 'j_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  try {
    let id = sessionStorage.getItem(ID_KEY);
    if (!id) { id = mint(); sessionStorage.setItem(ID_KEY, id); }
    return id;
  } catch {
    return mint();
  }
}

// Where they came from. We keep BOTH a rolled-up `source` (the ?from tag, else
// joined UTMs) for the old summary AND every UTM / click-id broken out into its
// own field, so the dashboard can sort & filter by utm_source, utm_campaign, etc.
export function pulseSource() {
  const empty = {
    source: '', referrer: '', query: '',
    utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '', utmTerm: '',
    gclid: '', fbclid: '',
  };
  try {
    const p = new URLSearchParams(location.search);
    // First-touch attribution stashed by Analytics.astro when they landed. The
    // current /book URL usually won't carry UTMs (they entered elsewhere and
    // clicked through), so fall back to what was captured on the landing page.
    let stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('kw_attr_v1') || '{}') || {}; } catch { stored = {}; }
    const g = (k) => ((p.get(k) || stored[k] || '') + '').slice(0, 200).trim();
    const utmSource = g('utm_source');
    const utmMedium = g('utm_medium');
    const utmCampaign = g('utm_campaign');
    const utmContent = g('utm_content');
    const utmTerm = g('utm_term');
    const utm = [utmSource, utmMedium, utmCampaign, utmContent, utmTerm].filter(Boolean).join(' / ');
    return {
      source: (p.get('from') || '').slice(0, 200).trim() || utm || '',
      // the true entry referrer (captured at first touch) beats document.referrer,
      // which after internal navigation is just the previous on-site page.
      referrer: stored._ref || document.referrer || '',
      query: location.search || '',
      utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
      gclid: g('gclid'), fbclid: g('fbclid'),
    };
  } catch {
    return empty;
  }
}

// Fire a beacon. `final` marks the "they're leaving" ping that may trigger the
// drop-off email server-side.
export function pulseSend(data, final = false) {
  try {
    const blob = new Blob([JSON.stringify({ ...data, final: !!final })], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) return;
    fetch(ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
  } catch {
    /* noop — telemetry must never break booking */
  }
}
