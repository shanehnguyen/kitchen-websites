# kitchenwebsites.com — Build Specification for Claude Code
### Direct-response agency site · King Kong anatomy, kitchen & bath register · June 2026
*Strategy sources: Dream-Buyer-Dossier · Godfather-Offer-System · HVCO-Funnel-Plan · Ad-Board. Copy is written separately; this spec defines structure, components, design direction, and rules. Build copy slots with intent-labeled placeholders.*

---

## 0. PROJECT BRIEF (read first)

One-page-letter-style direct-response site for **Kitchen Websites** — websites, Google Business Profile management, and local SEO **exclusively for kitchen & bath businesses** (showrooms, dealers, remodelers whose revenue comes from homeowners). Buyer: 40–60s owner-operator, skeptical of marketers (has been burned by lead platforms), decides on trust and receipts, reads on his phone at a jobsite. Brand voice: blue-collar direct, dry, zero marketing-speak, confidence backed by documents. The structural model is kingkong.co (long letter, one goal, guarantees in headline type, personality everywhere) — but rebuilt lean, fast, and in this buyer's register, with *industry* receipts standing in for the client-proof wall until real case studies fill the slots.

---

## 1. STRESS-PROOF CHANGELOG (research deltas from v1 structure)

1. **/calculator added to the sitemap** (was ad-creative-only). Evidence: an agency's ROI-calculator page produced 30% of ALL site conversions — interactive tools are the highest-performing page type for agency sites. The Lost Referral Calculator becomes a permanent organic conversion asset.
2. **CTA hierarchy is now a hard rule, not a suggestion.** Multiple competing offers cut conversion ~266%. /score is the ONLY hero-level CTA site-wide; /book exists in nav and at natural decision points (offer pages) but never competes in a hero.
3. **Receipts move adjacent to CTAs.** Trust signals beside the action (not in a footer/standalone block) measurably lift conversion. The ReceiptStrip component renders beside/below every primary CTA.
4. **Performance budget is a conversion feature.** 7% conversion lost per second of load; 1s pages convert 3x vs 5s. King Kong's heavy WordPress build is the anti-pattern. Hard budget below.
5. **/score remains nav-less, footer-less, single-goal** — message-matched to ads. Unchanged, now evidence-locked.

---

## 2. SITEMAP (8 pages at launch)

| Route | Job | Primary CTA |
|---|---|---|
| `/` | The letter page — verification layer + organic conversion | → /score |
| `/score` | THE landing page — ad traffic destination, Score tool | Start the check (in-page) |
| `/calculator` | Lost Referral Calculator — interactive conversion asset | Result → /score CTA |
| `/rescue` | Offer: 21-Day Google Rescue ($997) | Book → /book (or direct checkout later) |
| `/websites` | Offer: See-It-First Website Build ($3.5–6k) | → /book only |
| `/growth` | Offer: Tracked-Calls Retainer ($997/mo) | → /book only |
| `/about` | Insider story / anti-agency origin | → /score |
| `/book` | Calendly embed + qualification fields | Booking itself |

**Deferred (build slots, don't build pages):** /case-studies, /reviews, programmatic city pages (quarter 2+).

**Nav (global, except /score):** Logo · Rescue · Websites · Growth · About · [button] See How You Stack Up
**Footer:** minimal — offers, about, book, contact email/phone, legal. No link forest.

---

## 3. GLOBAL RULES

**Conversion rules**
- One hero CTA per page. All cold paths resolve to /score; warm/ready paths to /book.
- ReceiptStrip adjacent to every primary CTA (see components).
- Mobile hero: headline + subhead + CTA visible without scrolling. No full-bleed hero image pushing the button down.
- StickyMobileCTA appears after 50% scroll on /, /about, offer pages. Never on /score (the page IS the CTA) or /book.
- Guarantee conditions are ALWAYS visible on the same page as the guarantee — never linked away. "Fine print in headline type" is the brand's core trust move.

**Performance budget (hard)**
- LCP < 1.0s on 4G mobile; CLS ≈ 0; total JS < 75KB on content pages.
- Static-first build: **Astro** (or equivalent static output). No client framework on content pages; islands only where interactive (calculator, score, FAQ accordions can be CSS-only).
- Max 2 webfont files total, `font-display: swap`, subset. Images: AVIF/WebP, explicit dimensions, lazy below fold. Calendly embed lazy-loads on interaction. No background videos, no carousels, no animation libraries.
- Analytics: Meta Pixel + CAPI-ready, GA4 optional. Events: `ScoreStarted`, `ScoreComplete`, `CalcComplete`, `GraderRequested`, `CallBooked`. UTM passthrough preserved to /score and /book.

**Voice rules for placeholder copy (until real copy lands)**
- Sentence case. Plain verbs. No "elevate/unlock/empower/seamless." Buttons say what happens: "See how you stack up," "Book the 15-minute call," "Run my numbers."
- Placeholders are intent-labeled, e.g. `[LETTER ¶3: name the Houzz/Angi burn in his words — dossier §3]` so the copy pass drops in cleanly.

---

## 4. DESIGN DIRECTION (no-slop)

**Explicitly avoid the three AI-default looks:** (1) warm-cream + high-contrast serif + terracotta; (2) near-black + single acid-green/vermilion accent; (3) broadsheet hairlines + zero-radius newspaper columns. Also avoid: generic SaaS gradients, glassmorphism cards, emoji in UI, stock photos of laughing people pointing at laptops, and 01/02/03 numbered markers anywhere the content isn't truly sequential (the 3-stage mechanism IS sequential — numbering allowed there only).

**Ground the design in the subject's world:** kitchen showrooms and jobsites. Materials vocabulary: painted shaker cabinetry, stone counters, matte-black and brass hardware, spec sheets, permits, painter's tape, the Google review panel itself.

**Token starting point** (Claude Code: run your own frontend-design pass against this brief and refine — these are direction, not law):
- `--porcelain: #F7F6F3` (background — warmer than white, cooler than AI-cream)
- `--cabinet: #20241F` (near-black with a green-grey cast — painted-cabinet charcoal, NOT pure black)
- `--brass: #A8854B` (hardware accent — used sparingly: numbers, rules, key underlines)
- `--tape: #2456A6` (utility blue — links, focus states, the "painter's tape" functional accent)
- `--alarm: #B5402E` (one color reserved EXCLUSIVELY for leak/loss numbers in receipts)
- Type: characterful condensed/grotesque display for headlines and the big receipt numbers (spec-sheet energy, e.g. a heavy condensed sans), quiet humanist sans for body, tabular mono for figures/conditions (the "document" voice). Two font families max.

**The signature element (spend the boldness here, keep everything else quiet):** **"The fine print, printed big."** Guarantees and conditions sheets are styled as oversized official documents — spec-sheet/permit aesthetic: tabular mono, rules, stamp-like headers, the conditions in large legible type. This IS the positioning made visual: the anti-fine-print company prints its fine print in headline type. Every GuaranteeSpec component uses this treatment. Nothing else on the site competes with it.

**Motion:** one orchestrated moment max (e.g., receipt numbers counting up on first view). Respect `prefers-reduced-motion`. No scroll-jacking, no parallax.

---

## 5. PAGE SPECS

### `/` — THE LETTER PAGE
1. **Hero** — eyebrow ("Websites & Google for kitchen & bath businesses. Nothing else."), H1 slot `[HERO: the verification-layer promise]`, subhead slot, CTA → /score, ReceiptStrip directly beneath. No image required; type-led hero.
2. **The Letter** — dated (`Updated: [auto date]`), `Dear kitchen & bath owner,` long-form letter, max-width ~65ch, generous leading. Copy slots labeled ¶1–¶12 with dossier intent notes. Mid-letter CTA after the turn. Ends → /score CTA.
3. **ReceiptStrip (full-width variant)** — the four industry receipts as big numbers: $7.2M (FTC) · 26% (zero reviews) · 91% (check reviews) · 72hrs (decision window). Each with one-line source caption. `--alarm` on the loss numbers.
4. **The Mechanism** — "The Referral Capture System™": three StageCards (RESCUE → REBUILD → RUN), numbered (legitimately sequential), each linking to its offer page. One sentence each.
5. **GuaranteeSpec (homepage variant)** — Handshake Terms as the oversized document: month-to-month, you own everything, fire me any month + one-line summaries of the three offer guarantees. CTA beneath → /score.
6. **Enemy block** — short section, slot `[ENEMY: lead platforms + lock-in agencies, receipts-toned]`.
7. **ProofSlot** — at launch: 2–3 portfolio screenshots of real kitchen sites built + one-paragraph insider teaser → /about. Grid architecture supports future testimonial cards (build the slot, ship it partially filled — never fake-fill).
8. **FAQ** — 6–8 items, CSS-only accordions, voice-forward, doubles as on-page SEO. Schema.org FAQPage markup.
9. **Final CTA band** — one line + button → /score + ReceiptStrip (compact).

### `/score` — THE LANDING PAGE (single-goal)
No nav. No footer links (legal line only). Implements the existing **Referral-Capture-Score-Package.md** spec exactly: hero (headline matches ad promise verbatim — message match), 3 bullets, start button → in-page 10-question flow (one question per screen, progress bar, large tap targets), email gate after Q10, dynamic results page (score band + 3 leak blocks + segment close + dual CTA: Grader request form / /book link). Island component; everything else static. Events wired: ScoreStarted, ScoreComplete, GraderRequested.

### `/calculator` — LOST REFERRAL CALCULATOR
Hero: one-line promise + the three inputs immediately visible (referrals/month · average job value · Google review count). Live-computed annual leakage figure in the signature document style, math shown beneath in plain English ("here's exactly how we calculated this"), conservative-assumptions note. Result block CTA → /score ("that's the leak — now see where it's coming from"). Small-result fallback line per funnel plan. Event: CalcComplete. This page is shareable — OG image shows the calculator, not a logo.

### `/rescue` · `/websites` · `/growth` — OFFER PAGES (one template, three instances)
1. Promise hero (outcome-first headline slot) + price stated in the hero region — no hidden pricing
2. Who it's for / who it's NOT for (two short columns)
3. Value stack table — named premiums with stated values (from Offer System doc)
4. **GuaranteeSpec** — the offer's guarantee + its full conditions sheet, signature document treatment, on-page
5. CapacityCounter — "X of 4 Rescue slots open this month" (manually updated variable; must be true)
6. Reason-why paragraph slot
7. Mini-FAQ (3–4 offer-specific)
8. CTA: /rescue → /book (checkout later); /websites and /growth → /book ONLY (sold, not bought). StickyMobileCTA active.

### `/about`
Founder story slots (built FOR kitchen businesses before marketing TO them → why niche-only → why Handshake Terms exist), one real photo of a real human (non-negotiable), portfolio strip, CTA → /score.

### `/book`
One-screen intro line + lazy-loaded Calendly embed. Qualification fields configured in Calendly (business type, revenue band, homeowner-revenue %, current marketing). Event: CallBooked. Reassurance line: 15 minutes, no pitch-slap, you'll leave with your leak points either way.

---

## 6. COMPONENT LIBRARY

| Component | Spec |
|---|---|
| **ReceiptStrip** | 4 stat units: big number (display face, `--alarm` for losses), one-line caption with source. Variants: full-width band / compact (beside CTAs). Numbers count up once on view (reduced-motion: static). |
| **GuaranteeSpec** | The signature. Oversized document card: stamp-style header, tabular-mono conditions list, rules/borders evoking a spec sheet or permit. Variants: homepage (terms summary) / offer (full conditions). |
| **StageCards** | 3 sequential cards, numbered 1/2/3, title + one sentence + link. |
| **CapacityCounter** | "N of M slots open this month" — single source of truth in site config; rendered wherever placed. |
| **CTAButton** | One primary style site-wide. Label = the action's plain name. Always paired with a one-line de-risk microcopy slot. |
| **StickyMobileCTA** | Bottom bar, appears ≥50% scroll, content pages only. Dismissible. |
| **ProofSlot** | Grid that renders portfolio cards now, testimonial cards later — same markup contract so proof upgrades without redesign. |
| **FAQ** | CSS-only details/summary accordions + FAQPage schema. |
| **LetterBlock** | 65ch measure, drop-date header, generous leading, mid-letter CTA slot. |

---

## 7. BUILD NOTES FOR CLAUDE CODE

- Stack: Astro (static output) + vanilla CSS (design tokens as custom properties) + minimal TS islands (score flow, calculator). No Tailwind unless token-mapped; no component megalibraries.
- Repo shape: `/src/pages` per sitemap, `/src/components` per library above, `/src/styles/tokens.css`, site config file holding capacity counts, prices, phone, booking URL.
- Forms: Score + Grader submissions POST to ESP webhook (MailerLite/Brevo — env-configured); include segment + answers payload (the answers ARE the sales intel).
- Run the **frontend-design skill pass** on the token starting point before building: confirm the palette/type/signature read as chosen-for-this-brief, not default. The signature (fine-print-printed-big) is locked; refine execution, not concept.
- Accessibility floor: visible focus states, semantic landmarks, contrast AA on all token pairs, full keyboard path through the score flow.
- QA checklist before ship: mobile hero CTA above fold on a 360px viewport · LCP < 1s on throttled 4G · every guarantee's conditions visible on-page · all events firing · /score reachable ONLY via direct link/ads (noindex optional at launch) · zero placeholder text shipped (copy pass gates launch) · CapacityCounter values true.

---

## 8. WHAT THIS SITE MUST NEVER DO (the anti-KK technical list + avatar guards)
- No 12-second WordPress load wearing a conversion costume — the speed budget IS brand proof for a company selling websites.
- No fake/inflated proof: no invented review counts, no stock-testimonial fillers, no "as seen in" logos that aren't real. Empty proof slots stay honest until earned.
- No popups/exit-intent at launch; no chat widgets; no "FREE $2,000 AUDIT!!" value-anchor theater (the avatar's scam filter, per dossier).
- No more than two fonts, no hero carousels, no AI-default aesthetics per §4.
