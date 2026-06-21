import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

/* =====================================================================
   /api/staticmap — proxies a Google Static Map for the scorecard's
   rankings visual. The key NEVER reaches the browser: we build the
   Google URL server-side, fetch the image, and stream the bytes back.
   The image is cached hard at the browser/CDN so a reload doesn't
   re-bill Google. Requires the Maps Static API enabled on the key.
   ===================================================================== */

const KEY = process.env.GOOGLE_PLACES_API_KEY || '';

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const zoom = Math.min(16, Math.max(10, parseInt(req.query.zoom, 10) || 13));
  if (!KEY || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(404).json({ ok: false, error: 'unavailable' });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('center', `${lat},${lng}`);
  url.searchParams.set('zoom', String(zoom));
  url.searchParams.set('size', '600x600');
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  // a clean, muted style so our colored rank pins read on top of it
  [
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
    'feature:road|element:labels|visibility:off',
    'feature:administrative|element:labels|visibility:simplified',
    'saturation:-40|lightness:10',
  ].forEach((s) => url.searchParams.append('style', s));
  url.searchParams.set('key', KEY);

  try {
    const r = await fetch(url.toString());
    if (!r.ok) return res.status(502).json({ ok: false, error: 'map fetch failed' });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable'); // 7d
    return res.status(200).send(buf);
  } catch (err) {
    console.warn('staticmap proxy failed:', err.message);
    return res.status(502).json({ ok: false, error: 'map fetch failed' });
  }
}
