import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { Redis } from '@upstash/redis';

const SYSTEM_PROMPT = readFileSync(
  new URL('../claude-tool/systemprompt.md', import.meta.url),
  'utf8'
);

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4000;
const FETCH_TIMEOUT_MS = 10_000;
const CONTENT_CHAR_CAP = 60_000;
const MIN_USEFUL_CONTENT = 200;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Rate limiting + bot heuristics. Each real (non-cached) scan costs Anthropic
// credits; the limit is the floor we'll absorb per IP per day.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_S = 60 * 60 * 24; // 24h
const MIN_FORM_TIME_MS = 1500; // humans take ≥1.5s; insta-submit = bot

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let redisClient = null;
function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

// Pull the originating IP off the request. Vercel/Cloudflare put the real
// client IP in x-forwarded-for; we take the first hop. Falls back to the
// socket address for direct connections (local dev).
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

// Per-IP rate limiter. Increment a Redis counter keyed by IP; first hit
// stamps a 24h TTL. Returns { ok, used, remaining, retryAfter }. If Redis
// isn't configured, the limiter is a no-op (graceful degrade) — same posture
// as the cache.
async function checkRateLimit(redis, ip) {
  if (!redis) return { ok: true, used: 0, remaining: RATE_LIMIT_MAX };
  const key = `ratelimit:scan:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_S);
    }
    if (count > RATE_LIMIT_MAX) {
      const ttl = await redis.ttl(key);
      return {
        ok: false,
        used: count,
        remaining: 0,
        retryAfter: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_S,
      };
    }
    return {
      ok: true,
      used: count,
      remaining: Math.max(0, RATE_LIMIT_MAX - count),
    };
  } catch (err) {
    console.warn('rate limit check failed:', err.message);
    return { ok: true, used: 0, remaining: RATE_LIMIT_MAX };
  }
}

// Decrement the rate-limit counter when a scan resolved from cache (didn't
// actually consume Claude credits). We bumped pre-emptively to keep the
// check atomic; this gives the user their attempt back when nothing was paid for.
async function refundRateLimit(redis, ip) {
  if (!redis) return;
  const key = `ratelimit:scan:${ip}`;
  try {
    const v = await redis.decr(key);
    if (v <= 0) await redis.del(key);
  } catch (err) {
    console.warn('rate limit refund failed:', err.message);
  }
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (/^fc|^fd/.test(lower)) return true;
  if (/^fe[89ab]/.test(lower)) return true;
  if (lower.startsWith('::ffff:')) return isPrivateIPv4(lower.slice(7));
  return false;
}

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

async function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, code: 'invalid_url', error: 'That doesn’t look like a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'invalid_url', error: 'Only http and https URLs are allowed.' };
  }
  const host = parsed.hostname;
  if (!host) {
    return { ok: false, code: 'invalid_url', error: 'URL has no hostname.' };
  }
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { ok: false, code: 'invalid_url', error: 'Localhost is blocked.' };
  }
  if (IPV4_RE.test(host) || host.includes(':')) {
    return { ok: false, code: 'invalid_url', error: 'IP addresses are not allowed; use a hostname.' };
  }
  let resolved;
  try {
    resolved = await lookup(host, { all: false });
  } catch {
    return { ok: false, code: 'unreachable', error: `Couldn’t resolve ${host}.` };
  }
  const isPrivate =
    resolved.family === 6 ? isPrivateIPv6(resolved.address) : isPrivateIPv4(resolved.address);
  if (isPrivate) {
    return { ok: false, code: 'invalid_url', error: `${host} resolves to a private/reserved address.` };
  }
  return { ok: true, url: parsed.toString() };
}

function normalizeUrl(raw) {
  const u = new URL(raw);
  let host = u.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  let path = u.pathname || '/';
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
  return `${u.protocol}//${host}${path}`;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = res.ok ? await res.text() : await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, statusText: res.statusText, html, finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

function extractContent(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, template, svg').remove();

  const title = $('title').first().text().trim();

  const metas = [];
  $('meta').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name') || $el.attr('property') || $el.attr('http-equiv');
    const content = $el.attr('content');
    if (name && content) metas.push(`${name}: ${content}`);
  });

  const headings = [];
  $('h1, h2, h3').each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (txt) headings.push(`${el.tagName.toUpperCase()}: ${txt}`);
  });

  const links = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (href) links.push(`[${text || '(no text)'}](${href})`);
  });

  const ctas = [];
  $('button, input[type="submit"], input[type="button"], [role="button"], .btn, .cta, .button').each(
    (_, el) => {
      const $el = $(el);
      const text = ($el.text() || $el.attr('value') || '').replace(/\s+/g, ' ').trim();
      if (text) ctas.push(text);
    }
  );

  const imgs = [];
  $('img').each((_, el) => {
    const $el = $(el);
    const alt = ($el.attr('alt') || '').trim();
    const src = ($el.attr('src') || $el.attr('data-src') || '').trim();
    if (alt || src) imgs.push(`${alt || '(no alt)'} [${src}]`);
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  const sections = [
    `# TITLE\n${title}`,
    `# META\n${metas.join('\n')}`,
    `# HEADINGS\n${headings.join('\n')}`,
    `# CTA / BUTTONS\n${ctas.join(' | ')}`,
    `# LINKS (${links.length} total)\n${links.slice(0, 200).join('\n')}`,
    `# IMAGES (${imgs.length} total)\n${imgs.slice(0, 100).join('\n')}`,
    `# BODY TEXT\n${bodyText}`,
  ];

  let combined = sections.join('\n\n');
  if (combined.length > CONTENT_CHAR_CAP) {
    combined = combined.slice(0, CONTENT_CHAR_CAP) + '\n\n[…truncated]';
  }
  return combined;
}

function extractBalancedJson(text) {
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') { start = i; break; }
  }
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseJson(text) {
  const fenced = text
    .replace(/^\s*```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return { ok: true, value: JSON.parse(fenced) };
  } catch {}
  const balanced = extractBalancedJson(fenced);
  if (balanced) {
    try {
      return { ok: true, value: JSON.parse(balanced) };
    } catch {}
  }
  return { ok: false };
}

async function callClaude(client, content, strict) {
  const userMessage = strict
    ? `${content}\n\nReturn ONLY valid JSON. No prose, no markdown fences.`
    : content;
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
  return resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function recomputeScore(value) {
  if (!value || !Array.isArray(value.checks)) return value;

  // Dedupe by name. Haiku occasionally hallucinates duplicate checks
  // (e.g. two "Closing CTA before footer" entries), inflating the total.
  const seen = new Set();
  const unique = [];
  for (const c of value.checks) {
    const key = (c?.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  if (unique.length !== value.checks.length) {
    value.checks_removed = value.checks.length - unique.length;
    value.checks = unique;
  }

  // Cap each check's earned at its declared weight. Haiku occasionally
  // outputs e.g. earned=1.5 on a 1.0-weight check.
  for (const c of value.checks) {
    const w = Number(c?.weight);
    const e = Number(c?.earned);
    if (Number.isFinite(w) && Number.isFinite(e) && e > w) {
      c.earned_model = e;
      c.earned = w;
    }
    if (Number.isFinite(e) && e < 0) c.earned = 0;
  }

  const sum = value.checks.reduce((acc, c) => {
    const earned = Number(c?.earned);
    return acc + (Number.isFinite(earned) ? earned : 0);
  }, 0);
  let recomputed = Math.round(sum * 10) / 10;
  if (recomputed > 10) recomputed = 10.0;
  if (recomputed < 0) recomputed = 0.0;
  if (typeof value.score === 'number' && Math.abs(value.score - recomputed) > 0.05) {
    value.score_model = value.score;
  }
  value.score = recomputed;
  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ code: 'method', error: 'Method not allowed' });
  }

  if (process.env.TOOL_ENABLED === 'false') {
    return res.status(503).json({
      code: 'disabled',
      error: 'The audit tool is temporarily offline. Try again later.',
    });
  }

  const { url, force, honeypot, ts, captcha } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ code: 'invalid_url', error: 'Missing URL.' });
  }

  // ---------- Bot heuristics (silent rejections) ----------
  // Honeypot: a hidden field on the form. Bots auto-fill named inputs; humans
  // never see it. We return a fake-success shape so naive bots stop retrying.
  if (honeypot && String(honeypot).trim()) {
    return res.status(200).json({
      url,
      result: { score: 0, interpretation: 'rejected', summary: 'rejected', checks: [], pros: [], cons: [] },
      cached: true,
    });
  }

  // Time check: humans take ≥1.5s to fill the form. The client posts the
  // page-load timestamp; reject anything submitted faster as a bot.
  if (ts !== undefined && ts !== null) {
    const tsNum = Number(ts);
    if (Number.isFinite(tsNum) && tsNum > 0) {
      const elapsed = Date.now() - tsNum;
      if (elapsed >= 0 && elapsed < MIN_FORM_TIME_MS) {
        return res.status(400).json({
          code: 'too_fast',
          error: 'Submitted too fast — try the form again.',
        });
      }
    }
  }

  // Captcha sanity: the client computes the answer and posts it. We don't
  // re-validate the math (captcha is a client-side bot deterrent in front of
  // the real defenses) but we do require *some* non-empty value, which traps
  // bots that POST raw JSON without solving the form.
  if (captcha !== undefined && captcha !== null) {
    const cap = String(captcha).trim();
    if (!cap || !/^-?\d+$/.test(cap)) {
      return res.status(400).json({
        code: 'captcha',
        error: 'Captcha missing or malformed.',
      });
    }
  }

  const validation = await validateUrl(url);
  if (!validation.ok) {
    return res.status(400).json({ code: validation.code, error: validation.error });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ code: 'internal', error: 'ANTHROPIC_API_KEY is not set' });
  }

  const normalized = normalizeUrl(validation.url);
  const cacheKey = `audit:${normalized}`;
  const redis = getRedis();
  const ip = getClientIp(req);

  // ---------- Rate limit check (before any expensive work) ----------
  // Increment first so the check is atomic. Cache hits below refund the
  // counter so users don't burn quota on free results.
  const rate = await checkRateLimit(redis, ip);
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfter || RATE_LIMIT_WINDOW_S));
    return res.status(429).json({
      code: 'rate_limited',
      error: "You've used all 3 free scans for today. Schedule a 15-minute call instead — I'll walk your site live.",
      retryAfterSeconds: rate.retryAfter,
      limit: RATE_LIMIT_MAX,
    });
  }
  // Surface remaining quota on every response so the UI can decrement.
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

  if (redis && !force) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        // Cache hit didn't cost Claude credits — refund the rate-limit slot.
        await refundRateLimit(redis, ip);
        res.setHeader('X-RateLimit-Remaining', String(Math.min(RATE_LIMIT_MAX, rate.remaining + 1)));
        return res.status(200).json({ ...cached, cached: true });
      }
    } catch (err) {
      console.warn('cache read failed:', err.message);
    }
  }

  let fetched;
  try {
    fetched = await fetchWithTimeout(validation.url);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ code: 'timeout', error: 'Fetch timed out after 10s.' });
    }
    return res.status(502).json({ code: 'unreachable', error: 'Couldn’t reach that URL.' });
  }

  if (!fetched.ok) {
    if ([401, 403, 429, 451, 503].includes(fetched.status)) {
      return res.status(502).json({
        code: 'blocked',
        error: 'This site is blocking automated requests. Send me the URL directly at /contact.',
      });
    }
    if ([404, 410].includes(fetched.status)) {
      return res.status(502).json({ code: 'empty', error: 'This URL returned almost no content.' });
    }
    return res.status(502).json({
      code: 'unreachable',
      error: `Couldn’t reach that URL (HTTP ${fetched.status}).`,
    });
  }

  const content = extractContent(fetched.html);
  if (content.replace(/\s+/g, '').length < MIN_USEFUL_CONTENT) {
    return res.status(502).json({ code: 'empty', error: 'This URL returned almost no content.' });
  }

  const client = new Anthropic({ apiKey });

  let firstText;
  try {
    firstText = await callClaude(client, content, false);
  } catch (err) {
    return res.status(502).json({
      code: 'claude_error',
      error: 'Something broke on my end. Try again or /contact me.',
      detail: err.message,
    });
  }

  let parsed = tryParseJson(firstText);
  let secondText;

  if (!parsed.ok) {
    try {
      secondText = await callClaude(client, content, true);
      parsed = tryParseJson(secondText);
    } catch (err) {
      return res.status(502).json({
        code: 'claude_error',
        error: 'Something broke on my end. Try again or /contact me.',
        detail: err.message,
      });
    }
  }

  if (!parsed.ok) {
    console.error('[scan] parse_error — first attempt (last 600 chars):',
      (firstText || '').slice(-600));
    if (secondText) {
      console.error('[scan] parse_error — second attempt (last 600 chars):',
        secondText.slice(-600));
    }
    return res.status(502).json({
      code: 'parse_error',
      error: 'Couldn’t parse the audit response. Try again or /contact me.',
      raw_first: firstText,
      raw_second: secondText ?? null,
    });
  }

  const result = recomputeScore(parsed.value);
  const payload = {
    url: fetched.finalUrl,
    normalized_url: normalized,
    result,
  };

  if (redis) {
    try {
      await redis.set(cacheKey, payload, { ex: CACHE_TTL_SECONDS });
    } catch (err) {
      console.warn('cache write failed:', err.message);
    }
  }

  return res.status(200).json(payload);
}
