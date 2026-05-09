// Lists captured audit-tool leads from Upstash Redis.
// Usage:
//   node claude-tool/list-leads.mjs                  → all leads, newest first
//   node claude-tool/list-leads.mjs --tier=rebuild   → only rebuild-tier leads
//   node claude-tool/list-leads.mjs --tier=costly    → only costly-tier
//   node claude-tool/list-leads.mjs --tier=competitive
//   node claude-tool/list-leads.mjs --tier=moat
//   node claude-tool/list-leads.mjs --consent        → only opted-in (re-scan reminder)
//   node claude-tool/list-leads.mjs --csv            → emit CSV instead of table
//
// Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from .env.local.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: new URL('../.env.local', import.meta.url) });

import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set.');
  process.exit(1);
}

const redis = new Redis({ url, token });

const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith('--tier='))?.split('=')[1];
const consentOnly = args.includes('--consent');
const asCsv = args.includes('--csv');

const VALID_TIERS = new Set(['rebuild', 'costly', 'competitive', 'moat']);
if (tierArg && !VALID_TIERS.has(tierArg)) {
  console.error(`Invalid --tier=${tierArg}. Valid: ${[...VALID_TIERS].join(', ')}`);
  process.exit(1);
}

let emails;
if (tierArg) {
  emails = await redis.smembers(`audit:leads:tier:${tierArg}`);
} else if (consentOnly) {
  emails = await redis.smembers('audit:leads:consent');
} else {
  emails = await redis.zrange('audit:leads', 0, -1, { rev: true });
}

if (!emails || emails.length === 0) {
  console.error('No leads found.');
  process.exit(0);
}

const records = [];
for (const email of emails) {
  const rec = await redis.get(`lead:${email}`);
  if (rec) records.push(rec);
}

if (consentOnly && tierArg) {
  // intersect both filters when both passed
  const consentSet = new Set(await redis.smembers('audit:leads:consent'));
  const filtered = records.filter((r) => consentSet.has(r.email));
  records.length = 0;
  records.push(...filtered);
}

records.sort((a, b) => (b.ts || 0) - (a.ts || 0));

if (asCsv) {
  console.log('email,url,score,tier,consent,scanned_at');
  for (const r of records) {
    const ts = r.ts ? new Date(r.ts).toISOString() : '';
    const url = (r.url || '').replace(/"/g, '""');
    console.log(`${r.email},"${url}",${r.score ?? ''},${r.tier ?? ''},${r.consent ? 'yes' : 'no'},${ts}`);
  }
} else {
  console.log(
    `\nFound ${records.length} lead${records.length === 1 ? '' : 's'}` +
      (tierArg ? ` (tier=${tierArg})` : '') +
      (consentOnly ? ' (consent=yes)' : '') +
      '\n'
  );
  for (const r of records) {
    const date = r.ts ? new Date(r.ts).toISOString().slice(0, 10) : '—';
    const score = typeof r.score === 'number' ? r.score.toFixed(1) : '?';
    const consent = r.consent ? '✓' : ' ';
    console.log(`${date}  ${score.padStart(4)}/10  [${(r.tier || '?').padEnd(11)}]  ${consent}  ${r.email}`);
    console.log(`            ${r.url || ''}`);
  }
  console.log('');
}
