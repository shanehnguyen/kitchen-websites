import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

/* =====================================================================
   /api/places-autocomplete — The Google Scorecard, step 2 (IDENTIFY).
   Sessionized Place Autocomplete (New). The owner taps his OWN listing,
   which kills the duplicate-listing false negative (Scorecard spec §2).
   Key is server-side only (spec §11). When GOOGLE_PLACES_API_KEY is unset
   or the call fails, we degrade quietly — the flow falls back to manual
   capture rather than dead-ending ad spend (spec §5).
   Autocomplete is free when the same sessionToken later resolves to a
   Place Details call (handled in /api/scorecard).
   ===================================================================== */

const KEY = process.env.GOOGLE_PLACES_API_KEY || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { input, sessionToken } = req.body || {};
  const q = String(input || '').trim();
  if (q.length < 3) return res.status(200).json({ ok: true, suggestions: [] });
  if (!KEY) return res.status(200).json({ ok: true, degraded: true, suggestions: [] });

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
      body: JSON.stringify({
        input: q.slice(0, 200),
        sessionToken: sessionToken || undefined,
        includedRegionCodes: ['us'],
      }),
    });
    if (!r.ok) {
      console.warn('autocomplete failed:', r.status, await r.text().catch(() => ''));
      return res.status(200).json({ ok: true, degraded: true, suggestions: [] });
    }
    const data = await r.json();
    const suggestions = (data.suggestions || [])
      .map((s) => s.placePrediction)
      .filter(Boolean)
      .map((p) => ({
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text || p.text?.text || '',
        secondary: p.structuredFormat?.secondaryText?.text || '',
      }))
      .filter((s) => s.placeId && s.primary)
      .slice(0, 6);
    return res.status(200).json({ ok: true, suggestions });
  } catch (err) {
    console.warn('autocomplete error:', err.message);
    return res.status(200).json({ ok: true, degraded: true, suggestions: [] });
  }
}
