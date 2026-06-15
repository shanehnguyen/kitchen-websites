# The Google Scorecard — v1 Build Specification for Claude Code
### Cold-traffic HVCO for kitchenwebsites.com · Demonstration-first · June 2026
*Strategy sources: Dream-Buyer-Dossier · Godfather-Offer-System-v3 · Site (kitchen-websites.vercel.app). Companion to KitchenWebsites-Build-Spec.md — same stack, same voice, same design tokens.*

---

## 0. PROJECT BRIEF (read first)

A self-serve tool that pulls a homeowner-relevant **truth** about a kitchen & bath owner's Google presence and shows it to him next to a real competitor — then escalates him to the free strategy session. The reason it exists, in one line: this buyer decides on **demonstration, not claims** (dossier §5), so the tool's entire job is to *show* him a real external fact, not assert one, then make booking the call the obvious next move.

**The end goal this serves:** booked, qualified strategy-session calls that become Kitchen Websites / FlipFix clients. Not opt-ins. Not completions. The scorecard is a means; it is judged only by **cost per booked qualified call**, measured against the existing `/book` page as a live control.

**The non-negotiable design rule:** the scorecard escalates, it does not satisfy. A visitor who finishes feeling informed and leaves is a failure, not a soft win. Every screen bends toward the call.

---

## 1. v1 SCOPE — what it does and what it deliberately does NOT do

**v1 DOES (Google Places API only):**
- Identifies his real Google Business Profile by name (he taps it from autocomplete — he confirms his own listing).
- Pulls his review count, star rating, photo count, and profile-completeness signals.
- Pulls his nearest category-matched K&B competitors and their review counts + ratings.
- Reveals one stinging, true, external fact, gates email, then shows the full side-by-side scorecard with 3 named fixes.
- Escalates to `/book`.

**v1 does NOT (deferred to v2):**
- It does **not** report his map-pack rank position ("you're #5"). Google's APIs don't return that; it requires a third-party SERP API (DataForSEO). v2 adds it.
- It does **not** claim or imply a rank. **Hard rule:** never infer rank from Places "nearby" ordering — that ordering is not the map pack, and an owner who is actually in the 3-pack will catch the lie and never trust the brand again. v1 stays silent on rank.
- It does **not** report GBP "claimed/verified" status. The Places API does not expose this reliably. Infer neglect from review/photo/field gaps instead; never assert "unclaimed."

**Why review-led, not rank-led, is a legitimate v1:** the review gap is the dossier's #1 wound (losing to the worse craftsman with more reviews) and it's already all over the live site ("91% read your reviews," "92% won't consider a shop under four stars," "270% more likely to get picked with your first five reviews"). v1 leads with the angle the site already proves. The rank reveal is the v2 upgrade.

**Message-match warning:** the destination must match the ad that feeds it. If the existing ad leads with **search rank / map pack**, v1 cannot deliver that promise — either point that ad at v2, or run a v1 ad that leads with the **review/competitor gap**. The page must only cash checks v1 can actually cover.

---

## 2. THE FLOW (one screen at a time, mobile-first)

```
AD (already built)
  │
  ▼
/scorecard  — nav-less, footer-less, single goal, message-matched to the ad
  │
  ├─ 1. PROMISE + START. Headline matches the ad verbatim. One line of what he gets. Button: "Check my Google."
  │
  ├─ 2. IDENTIFY (one tap, not a form). "Start typing your business name." Places Autocomplete.
  │      He taps his own listing → resolves to a place_id. Optional: confirm city / main service.
  │      (This step makes HIM confirm the correct listing — kills the duplicate-listing false negative.)
  │
  ├─ 3. LOOKUP (server-side, ~1–3s, loading state). Pull his profile + category-matched competitors.
  │
  ├─ 4. THE HOOK — one true external fact, shown BEFORE the email gate.
  │      e.g. "You have 4 reviews. The kitchen & bath shop Google shows first near you has 87."
  │      (The sting is the sunk cost that earns the email.)
  │
  ├─ 5. EMAIL GATE. "Want the full scorecard — all three competitors and the 3 things to fix first?
  │      Enter your email." Consent checkbox + privacy link. Value shown, ask after.
  │
  ├─ 6. THE FULL SCORECARD (result page). Verdict band · side-by-side vs 3 competitors ·
  │      3 named leak points each with a one-line fix he can use without you · the math shown openly.
  │
  └─ 7. ESCALATION (the point of the whole thing). Primary CTA → /book.
         "This is the automated read. On the call I pull the live side-by-side, find the exact spots
          they're beating you, and hand you the fix in writing. Don't take the tool's word for it —
          that's what the 30 minutes is for." Secondary: emailed copy of the scorecard.
```

---

## 3. DATA & API LAYER

**Provider:** Google Places API (New). All calls server-side only — the API key is never exposed to the client. On Vercel, implement as serverless functions (`/api/*`).

**Endpoints used:**
| Step | Endpoint | Purpose | Field mask (cost control) |
|---|---|---|---|
| Identify | Place Autocomplete (New), sessionized | Type-ahead to his listing | session token; autocomplete is free when the session ends in a Place Details call with the same token |
| His profile | Place Details (New) | rating, userRatingCount, photos, websiteUri, regularOpeningHours, primaryType/types, editorialSummary, displayName, location | request ONLY these fields — the highest field requested sets the SKU tier, so keep the mask tight |
| Competitors | Text Search (New) or Nearby Search (New) | category-matched K&B shops near his location | displayName, rating, userRatingCount, primaryType, location |

**Competitor selection (must-handle, not polish):**
- Query category-matched K&B remodelers/showrooms near his `location` (e.g. text search "kitchen remodeler" / "kitchen and bath" biased to his coordinates).
- **Exclude:** big-box (Home Depot, Lowe's, IKEA), national chains, pure wholesalers/distributors, and his own listing. A dumb comparison (a Home Depot as his "rival") makes the whole tool look unserious and trips the scam filter.
- Pick the top 3 by review count among the filtered set. The single highest-review competitor is "the shop Google shows first near you" used in the hook.

**Cost [VERIFIED, June 2026]:** Place Details ~$17/1,000 (tier depends on field mask); sessionized autocomplete free when linked to Details; per-SKU free monthly caps replaced the old $200 credit in March 2025. At ~$50/day Meta spend → a few hundred to ~750 lookups/month → within or near the free cap; worst case a few dollars. **Caching:** cache each place_id's result for 24–48h to avoid re-billing and re-waiting on repeat views.

**Latency:** show a "pulling your Google…" loading state during step 3. The 1–3s pause helps the reveal land; do not fake instant.

---

## 4. SCORING MODEL (v1 — all dimensions external/demonstrable)

All inputs come from Places. Nothing is self-reported. Show the source/threshold openly beside each (no black box — the buyer distrusts them).

| Dimension | Source | What it proves | His site's own backing |
|---|---|---|---|
| **Review count vs top rival** (hero) | userRatingCount | the comparison wound | "91% read your reviews" |
| **Star rating vs 4.0 threshold** | rating | the consideration cliff | "92% won't consider under four stars" |
| **Photo count** | photos | portfolio presence | trade's visual language |
| **Website link present** | websiteUri | the click has somewhere to go | the website offer |
| **Hours / categories / description present** | regularOpeningHours, types, editorialSummary | completeness / neglect | "complete profile = 2.7× more trusted" |

**Verdict bands (review-centric for v1):**
1. **"You're not in the room yet."** Zero or very few reviews, or no rating. The cleanest result — route hard to the call.
2. **"You're in the game and losing the comparison."** Has reviews but behind the top category rival, or under 4 stars, or thin profile. The main band; the side-by-side does the work.
3. **"Your Google's strong — the leak is after the click."** Competitive reviews and rating. The reveal flatters instead of stings, so **pivot honestly** to the website/conversion angle. Do not manufacture a problem (referral niche; fabrication is fatal).

**Leak points:** select his worst 3 scored dimensions. Each renders as: the gap (with his number and the benchmark), one plain-English fix he can do himself, and the cost line where one exists from his site's stat set. Standalone usefulness is deliberate — a no-call visitor still leaves with something real, which is the honesty brand and the scam-filter disarm.

**Segment captured (for nurture):** store the verdict band + worst dimension with the email, so the email sequence is keyed to it (no-reviews / behind-on-reviews / thin-profile / strong-google-weak-site).

---

## 5. FALLBACKS & EDGE CASES (the bulletproofing, made concrete)

| Case | Handling |
|---|---|
| **No profile found** | Best result, not an error. "You don't show up at all — that's the finding." Capture email, route straight to /book. |
| **Lookup / API fails** | Never dead-end the ad spend. Degrade to manual capture: "Enter your business and city and I'll run it by hand and email your scorecard within a few hours." (This is also the zero-code Wizard-of-Oz path.) |
| **Duplicate / wrong listing** | The autocomplete-select step makes him confirm. If a duplicate is detected, that's a finding: "a duplicate listing is splitting your reviews — that's a leak." |
| **He's actually doing fine** | Pivot to the website angle (band 3). Tool stays truthful and still converts. |
| **Competitor set comes back thin/empty** | Widen radius once; if still thin, drop the head-to-head and lead on his own gaps vs the benchmarks. Never pad with off-category businesses. |
| **Big-box/national slips into competitors** | Exclusion filter (§3) must catch it before render. |

---

## 6. RESULT PAGE — what renders, in order

1. **Verdict band** — one of the three, in plain language, his number in it.
2. **The side-by-side** — him vs his 3 category-matched competitors: review count, rating, (photos optional). His own row highlighted. `--alarm` token on his losing numbers (reuse the site's receipt treatment).
3. **3 leak points** — gap → fix → cost line. The fixes are genuinely usable.
4. **The honest-read line** — "This is an automated snapshot. It's directional, not the last word." (Pre-empts the black-box objection; matches the dossier.)
5. **Primary CTA → /book** — the escalation copy from the flow. This is the page's reason to exist.
6. **Secondary** — "email me this scorecard" (already captured; this just reassures).

No nav, no footer link forest (legal line only), one CTA hierarchy. The page is the funnel.

---

## 7. COPY & VOICE RULES

- First-person **Shane**, signed where it fits. Honesty brand. Risk sits on Shane.
- Persuasion device is **"they did X, I do Y"** contrast. **Never** the "no X, no Y" negative-listing construction.
- **No em dashes in body copy** (commas/periods); a single signature em dash is acceptable.
- **Never invent stats, reviews, competitors, or results.** Every number on the page is either pulled live from Places or is one of his site's already-sourced benchmarks. Real proof only.
- No "free $2,000 audit" value-theater, no popups, no hype. The avatar's scam filter is the first reader.
- Headline on screen 1 matches the ad **verbatim** (message match).
- Buttons say what happens: "Check my Google," "See the full scorecard," "Book the 30-minute call."

---

## 8. EVENTS & MEASUREMENT

**Events (Meta Pixel + CAPI-ready, GA4 optional):**
`ScorecardStarted` (start tapped) · `ScorecardIdentified` (listing selected) · `ScorecardHook` (reveal shown) · `ScorecardEmail` (gate passed) · `ScorecardResult` (full page rendered) · `BookClicked` (escalation) · `CallBooked` (on /book). UTM passthrough preserved end to end.

**The judging metric (the only one that decides the tool's fate):** **cost per booked qualified call.** Qualified = K&B, homeowner-revenue-dominant, at or above the money floor — enforced by the qualification fields on `/book` (business type, revenue band, homeowner-revenue %, current marketing).

**The control [REQUIRED]:** keep the existing `/book` page running as a parallel destination for a slice of the same ad spend. After ~30 days / enough spend, compare scorecard cost-per-booked-qualified-call against `/book` direct. Scorecard wins → scale it. `/book` wins → retire the scorecard without sentiment.

**Vanity guardrail:** opt-in rate and completion rate are diagnostic only. High completions with near-zero qualified calls means the escalation bridge is broken — fix the bridge, don't celebrate the completions.

---

## 9. TECH / PERFORMANCE / PRIVACY

- **Stack:** match the site — Astro route for `/scorecard` + a small client island for the flow + Vercel serverless functions for all Places calls. API key server-side only, in env.
- **Performance:** the static shell honors the site's budget (LCP < 1s); the lookup is an explicit async step with a loading state, exempt from the static budget. No heavy libraries for the flow.
- **`/scorecard` is nav-less, footer-less, single-goal**, like the existing `/score` spec — reachable via ad/direct link only.
- **Privacy:** email capture needs a consent checkbox + link to `/privacy`; comply with CAN-SPAM/GDPR; store the answers/result payload with the contact (the result IS the sales intel for nurture).
- **Retire the mis-anchored asset:** the current footer "Lost Referral Calculator" (`/calculator`) measures the wrong leak (referrals, not search). Redirect `/calculator` → `/scorecard` or remove it, so the site stops pointing at the retired frame.

---

## 10. BUILD ORDER & QA

**Build order:**
1. Serverless `/api/identify` (autocomplete) + `/api/profile` (details) + `/api/competitors` (text search), with field masks and caching.
2. Competitor filter (exclude big-box/national/wholesale; category-match).
3. Scoring + verdict-band logic + leak selection.
4. The flow UI (screens 1–7), loading state, hook-before-gate ordering.
5. Email capture → ESP webhook with segment + result payload.
6. Fallbacks (§5), including the manual-capture degrade path.
7. Events + UTM passthrough; `/book` qualification fields confirmed.
8. `/calculator` redirect.

**QA before ship:**
- Mobile hero + start button above the fold on a 360px viewport.
- A real in-3-pack, well-reviewed business returns band 3 and pivots cleanly (no fabricated problem).
- A zero-review business returns band 1 and routes to the call.
- No big-box/national ever appears as a competitor.
- API failure shows the manual-capture path, never a dead end.
- Rank is never stated or implied anywhere in v1.
- All events fire; UTMs survive to `/book`.
- Every on-screen number traces to a live pull or a sourced site benchmark — zero invented figures.

---

## 11. WHAT v1 MUST NEVER DO
- Never claim or imply a map-pack rank (that's v2, and only with a real SERP API).
- Never assert "unclaimed/unverified" — Places can't confirm it.
- Never fabricate a problem for a healthy profile, or invent a stat, review, or competitor.
- Never compare him to a big-box, a national, or a wholesaler.
- Never let a finished scorecard be a satisfying dead end — every result ends pointed at the call.
- Never expose the Places API key client-side.

---

## 12. v2 HOOKS (where the real rank reveal slots in later)
- Add DataForSEO Google Maps / Local Pack endpoint (returns rank_absolute for his listing for a query from his location; ~$0.002/request live). [VERIFIED pricing, June 2026]
- New dimension: "you're #N for 'kitchen remodeler near you'." New top verdict band: "You're invisible in search."
- Upgrade the ad to the rank-led / map-pack angle once v2 is live.
- Single-point rank is approximate (real local rank is a geo-grid); keep the "directional, not the last word" honest-read line. The grid-accurate version is a later concern, not a v2 blocker.

---

## EVIDENCE TIERS
- Demonstration-first format fit + interactive beating cold book-a-call: **[VERIFIED]** (cold-traffic data; dossier §5)
- Review-gap as v1's hero angle: **[REASONED]** — the dossier's top wound, backed by the site's own stat set
- API choices, costs, free-tier behavior: **[VERIFIED, June 2026]** — re-confirm at build time, Google changes pricing often
- Verdict bands, scoring weights, the `/book` control, all caps and thresholds: **[MY CALL]** — the 30-day head-to-head re-ranks them with real data
