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

// Where they came from: the ?from tag, then any UTMs, then the referring page.
export function pulseSource() {
  try {
    const p = new URLSearchParams(location.search);
    const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
      .map((k) => p.get(k)).filter(Boolean).join(' / ');
    return {
      source: p.get('from') || utm || '',
      referrer: document.referrer || '',
      query: location.search || '',
    };
  } catch {
    return { source: '', referrer: '', query: '' };
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
