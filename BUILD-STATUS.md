# Kitchen Websites — build status

Astro rebuild of the funnel container per `markdowns/KitchenWebsites-Build-Spec.md`.
Legacy FlipFix HTML moved to `/_legacy`. Run: `npm run dev` · `npm run build` · `npm run preview`.

## Design-refinement pass (latest — per the redesign brief)
- **Self-hosted fonts** (Fontsource, no CDN): **Archivo** (display + UI), **Source Serif 4** (the letter + About prose — "a real person wrote this"), **JetBrains Mono** (the "fine print, printed big" blocks). Replaces the cheap Arial-Narrow/Consolas fallback.
- **Palette tightened to brief**: `--bg #F4F1EA` · `--ink #1A1814` · `--dark #1B1F1A` (not pure black) · `--accent #9E7B3D` brass. **Brass is the only accent**; the blue link color and decorative red were removed. Links are now ink-underline; focus rings are high-contrast ink. A single semantic warning red (`--warn`) is reserved ONLY for genuine "your loss" figures (calculator leak total, critical score) — not used as a brand accent.
- **Hierarchy**: hero H1 enlarged to `clamp(44px,6vw,84px)`; heavy ink-filled primary CTA with hover lift; brass CTA on dark; nav grows a hairline on scroll; subtle no-JS-safe fade-up on scroll (gated behind `.js`, respects reduced-motion).
- **AA contrast**: small brass text uses `--accent-deep #6E5424` (>6:1); large brass numbers pass at large-text threshold. Verified across all token pairs.
- **Proof structures added** (clearly marked, never fabricated): `{{ TESTIMONIAL_PLACEHOLDER }}` ×3 + a before/after `{{ CASE_STUDY_PLACEHOLDER }}` on Home; `{{ NKBA_BADGE_PLACEHOLDER }}` on About. Portfolio cards enlarged + framed with hover.
- **Receipt captions** sharpened so $7.2M reads unambiguously as the FTC fine the lead platforms paid — not a revenue claim.
- Preserved exactly: offer names, prices, Rescue→Rebuild→Run ladder, Handshake Terms, the mechanism name, and the first-person voice. No hype added, no invented numbers, no ranking/lead-quantity guarantees.

## Done (all 7 phases build green, 0 type errors)

| Phase | What shipped |
|---|---|
| 0 Scaffold | Astro + Vercel adapter, anti-AI-slop tokens (porcelain/cabinet/brass/tape/alarm), base + components CSS, BaseLayout/BareLayout, Nav, Footer, Analytics (Meta Pixel + GA4 + `kwTrack` event helper + UTM passthrough) |
| 1 Components | ReceiptStrip (count-up), **GuaranteeSpec** (the "fine print printed big" signature), StageCards, CapacityCounter, CTAButton, StickyMobileCTA, ProofSlot, FAQ (+FAQPage schema), LetterBlock |
| 2 /calculator | Lost Referral Calculator — live math, shown openly, conservative rates, small-result fallback, `CalcComplete` |
| 3 /score | Full Referral Capture Score: 10 Qs one-per-screen, progress bar, keyboard path, email gate, client-side scoring + segmentation, dynamic 3-block results, Grader form. Island = **~5 KB gzip**. `api/score-submit.js` lead capture (Resend notify + ESP webhook hook) |
| 4 / | Letter page: hero → letter → receipts → mechanism → Handshake GuaranteeSpec → enemy → proof → FAQ → final CTA |
| 5 offers | `/rescue` `/growth` `/websites` from one `[offer].astro` template + `offers.ts` (real prices, value stacks, full conditions on-page, capacity, mini-FAQ) |
| 6 about/book/legal | `/about` (real Shane photo + portfolio), `/book` (lazy Calendly), `/privacy`, `/terms` |
| 7 QA | 10 pages build, all routes 200, images resolve, JS far under 75 KB budget |

## Real copy (doc-sourced, shippable)
- `/score` — verbatim from `Referral-Capture-Score-Package.md` (questions, weights, flags, bands, gate, closes).
- Offer pages — prices, value stacks, guarantees, conditions, scarcity from `Godfather-Offer-System.md`.
- Receipts, enemy block, FAQ, letter draft — built from `Dream-Buyer-Dossier.md` (verified stats only).
- 10 leak templates — one per score question.

## Placeholder / before launch (the copy + config gate)
- [ ] **Fonts** — drop subset woff2 into `/public/fonts/` (Saira Condensed 600, Inter var, Spline Sans Mono). Fallback stack renders until then.
- [ ] **Config** in `src/data/site.config.ts` — real phone, Calendly URL, Meta Pixel id, GA4 id; confirm `email`.
- [ ] **ESP** — set `ESP_WEBHOOK_URL` (MailerLite/Brevo) + `RESEND_API_KEY`, `LEAD_NOTIFY_TO/FROM` in env. Leads email-notify regardless.
- [ ] **Copy pass** — letter ¶ real founder anecdote (`index.astro`), about origin specifics (`about.astro`) — drafts are voice-accurate but marked `COPY PASS`.
- [ ] **OG image** — `/calculator` wants a custom calculator OG (currently shared `og-cover.svg`).
- [ ] **Legal** — `/privacy` + `/terms` are plain-language drafts; need legal review (marked).
- [ ] **Capacity** — keep `site.config.capacity` true; it drives every CapacityCounter.
- [ ] **Proof** — real Rescue before/after upgrades ProofSlot from portfolio → results (same markup).

## Notes
- `api/scan.js` (AI URL audit) kept for the future automated Grader; launch Grader is Wizard-of-Oz via `score-submit`.
- Founder is **Shane Nguyen** (docs' "Jack" was a placeholder).
- Positioning intentionally drops the dealer/e-commerce angle the old site sold.
