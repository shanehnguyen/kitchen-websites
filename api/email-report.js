import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

import { Redis } from '@upstash/redis';
import { Resend } from 'resend';

const FROM = 'Shane Nguyen <shane.nguyen@goflipfix.com>';
const REPLY_TO = 'shane.nguyen@goflipfix.com';
const REPORT_BASE_URL = 'https://flipfixdigital.com/audit.html';
const SENDER_BRAND = 'kitchenwebsites.com';

const EMAIL_RATE_MAX = 5;
const EMAIL_RATE_WINDOW_S = 60 * 60;

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
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function normalizeUrl(raw) {
  const u = new URL(raw);
  let host = u.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  let path = u.pathname || '/';
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
  return `${u.protocol}//${host}${path}`;
}

function tierFor(score) {
  if (score >= 9.0) return { key: 'moat', label: 'Top tier — protect the moat', color: '#3F7F4F' };
  if (score >= 7.0) return { key: 'competitive', label: 'Competitive but losing deals', color: '#A78B4F' };
  if (score >= 5.0) return { key: 'costly', label: 'Costing you sales', color: '#C9803E' };
  return { key: 'rebuild', label: 'Full rebuild recommended', color: '#9B3823' };
}

function pickTopFixes(checks, n) {
  if (!Array.isArray(checks)) return [];
  return checks
    .map((c) => {
      const w = Number(c?.weight);
      const e = Number(c?.earned);
      if (!Number.isFinite(w) || !Number.isFinite(e)) return null;
      return {
        name: c.name || '',
        weight: w,
        earned: e,
        gap: w - e,
        tier: (c.tier || '').toLowerCase(),
        evidence: c.evidence || '',
        business_impact: c.business_impact || '',
      };
    })
    .filter((c) => c && c.gap > 0)
    .sort((a, b) => b.gap - a.gap || b.weight - a.weight)
    .slice(0, n);
}

function buildEmailText({ url, score, topFixes, reportUrl }) {
  const fixesText = topFixes.length
    ? topFixes
        .map((f, i) =>
          `${i + 1}. ${f.name} (${f.earned.toFixed(2)} / ${f.weight.toFixed(2)})` +
          (f.business_impact ? `\n${f.business_impact}` : '')
        )
        .join('\n\n')
    : 'No specific weak points stood out — your homepage is solid.';

  return `You requested an audit of ${url} on ${SENDER_BRAND}.

Score: ${score.toFixed(1)} / 10

Top 3 issues, ranked by points lost:

${fixesText}

Full report: ${reportUrl}

If you'd rather walk through the report with me on a call, just reply to this email and I'll send a few times. 15 minutes is usually enough to map the top fixes.

Shane
${SENDER_BRAND}

You are receiving this because you requested an audit at ${SENDER_BRAND}/audit. Reply "remove" and I'll take you off the list.
`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { email, url, honeypot, consent } = req.body || {};

  if (honeypot && String(honeypot).trim()) {
    return res.status(200).json({ success: true });
  }

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }
  if (email.length > 200) {
    return res.status(400).json({ success: false, error: 'Email is too long.' });
  }
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing audit URL.' });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid audit URL.' });
  }

  const redis = getRedis();
  const ip = getClientIp(req);

  if (redis) {
    const key = `ratelimit:emailreport:${ip}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, EMAIL_RATE_WINDOW_S);
      if (count > EMAIL_RATE_MAX) {
        return res.status(429).json({
          success: false,
          error: 'Too many emails sent from this IP. Try again in an hour.',
        });
      }
    } catch (err) {
      console.warn('email rate limit check failed:', err.message);
    }
  }

  const normalized = normalizeUrl(url);
  let payload = null;
  if (redis) {
    try {
      payload = await redis.get(`audit:${normalized}`);
    } catch (err) {
      console.warn('audit cache read failed:', err.message);
    }
  }
  if (!payload || !payload.result) {
    return res.status(404).json({
      success: false,
      error: 'No recent audit found for that URL. Re-run the scan first.',
    });
  }

  const result = payload.result;
  const score = Number(result.score);
  if (!Number.isFinite(score)) {
    return res.status(500).json({ success: false, error: 'Audit data is malformed.' });
  }
  const tier = tierFor(score);
  const topFixes = pickTopFixes(result.checks, 3);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Email is not configured yet. Try again later.',
    });
  }

  const resend = new Resend(apiKey);
  const reportUrl = `${REPORT_BASE_URL}?url=${encodeURIComponent(payload.url || url)}`;
  const text = buildEmailText({
    url: payload.url || url,
    score,
    topFixes,
    reportUrl,
  });
  let hostname = '';
  try {
    hostname = new URL(payload.url || url).hostname.replace(/^www\./, '');
  } catch {}
  const subject = hostname ? `Your audit of ${hostname}` : 'Your homepage audit results';

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject,
      text,
    });
    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({
        success: false,
        error: 'Could not send the email. Try again or message Shane directly.',
      });
    }
  } catch (err) {
    console.error('email-report error:', err);
    return res.status(500).json({
      success: false,
      error: 'Could not send the email. Try again later.',
    });
  }

  if (redis) {
    const lower = email.toLowerCase();
    const now = Date.now();
    const record = {
      email: lower,
      url: payload.url || url,
      normalized_url: normalized,
      score,
      tier: tier.key,
      consent: !!consent,
      ip,
      ts: now,
    };
    try {
      await Promise.all([
        redis.set(`lead:${lower}`, record),
        redis.zadd('audit:leads', { score: now, member: lower }),
        redis.sadd(`audit:leads:tier:${tier.key}`, lower),
        consent
          ? redis.sadd('audit:leads:consent', lower)
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.warn('lead storage failed:', err.message);
    }
  }

  return res.status(200).json({ success: true });
}
