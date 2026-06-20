# Kitchen Websites — The Google Audit
### Full build spec for Claude Code · 40 checks + spend rules · June 2026
*Single source of truth for the Scorecard audit. What it checks, when paid calls fire, and how to never overspend.*

---

## 0. What this audit is doing

It has to do two opposite things at once:

1. **Look long and full on every audit** — the "wow, there's a lot wrong" feeling. That comes from a big stack of CERTAIN checks that render every time because they're parsed live.
2. **Make him feel he can't keep up** — the "I don't have time" feeling that sells Done-For-You. That comes from a few CADENCE and DEPTH checks that surface a recurring number: posts per month, reviews per month, backlinks, rank across the map.

Every check below earns its place by doing one of those. Nothing that everyone passes. Nothing redundant. Nothing fragile.

```
LEGEND
●  CERTAIN  — parsed live (HTML / PageSpeed / Places / SERP live). Renders every audit.
◐  SLOW     — DataForSEO task-based. Bonus only, or goes in the emailed scorecard. Never load-bearing.
🔁 ONGOING  — surfaces a per-week / per-month number. These sell the service.
★  MARQUEE  — carries the owner-facing result line. These six are the sting.

Result-line voice: first-person Shane, plain subject-verb-object, owner-and-money POV.
No em dashes. Never the "no X no Y" construction.
```

---

# PART ONE — THE CHECKS (40)

## GOOGLE BUSINESS PROFILE

### A — Setup (●, fast, binary)
```
1  Primary category    PASS K&B/Cabinet/Countertop/Remodel · WARN other · FAIL generic ("contractor","handyman")  ● ~$0
2  Secondary categories PASS ≥2 relevant · WARN under 2/none  ● ~$0
3  Description          PASS ≥120 chars + names trade · WARN short / doesn't name trade  ● ~$0
4  Attributes (the 4)   PASS all set: free estimates, online estimates, online appointments, onsite services · WARN any missing  ● ~$0
5  Services menu        PASS ≥5 listed · WARN 1–4 · FAIL none  ● ~$0
6  Business name clean  PASS matches real signage · WARN padded with keywords/city (guideline violation + suspension risk)  ● ~$0
```

### B — Reviews
```
7  ★ Review count vs top rival   PASS ≥ rival · WARN 60–99% · FAIL under 60%  ● ~$0
   "You have {n} reviews. The K&B shop Google shows first near you has {rival}."
8  Star rating                   PASS ≥4.3 · WARN 4.0–4.29 · FAIL under 4.0  ● ~$0
9  🔁 ★ Review velocity (new/90d, you vs rival)  PASS ≥ rival rate · WARN 40–99% · FAIL under 40%  ● ~$0
   "The shop beating you added {x} reviews in 90 days. You added {y}. That gap grows every week you wait."
10 ◐ 🔁 Review response rate      PASS ≥70% · WARN 25–69% · FAIL under 25%  ◐ ~$0.002
```

### C — Photos
```
11 Total photos   PASS ≥15 · WARN 6–14 · FAIL under 6  ● ~$0
```

### D — Freshness
```
12 ◐ 🔁 ★ Google post frequency (posts/90d, you vs rival)  PASS ≥ rival · WARN behind · FAIL none in 90d  ◐ ~$0.002
   "They posted to Google {x} times in 90 days. Your last post was {date}. Google rewards the shop that keeps showing up."
```

### E — Rankings (★ the gold — resolves the Map-Pack ad) · DataForSEO SERP Live $0.002/query
```
13 ★ Local pack rank, primary term ("kitchen remodeler {city}")  PASS top 3 · WARN 4–10 · FAIL not in pack  ● $0.002
   "For 'kitchen remodeler {city}' you sit at #{rank}. The top three get most of the calls. You're below the fold."
14 Local pack rank, money-keyword matrix (3–5 terms)  PASS top 3 for ≥half · WARN mostly 4–10 · FAIL invisible on most  ● $0.002×N
15 ★ Geogrid visibility (% of map you're in the top 3)  PASS ≥60% · WARN 20–59% · FAIL under 20%  ● 3×3 grid = $0.018
   "Across {city} you show up in the top three in only {pct}% of the map. In most of your own town homeowners never see you."
16 Who outranks you (named)  PASS you lead · WARN named rival(s) above you  ● (reuses #13 call)
```

## WEBSITE  *(runs only if a site is linked — all HTML-parse checks are ● certain)*

### F — Loads / tech
```
17 Loads          FAIL site didn't load (gate)  ● ~$0
18 Mobile speed   PASS ≥90 · WARN 50–89 · FAIL under 50  ● ~$0
19 HTTPS secure   PASS yes · FAIL not secure  ● ~$0
20 Mobile layout  PASS has viewport · FAIL desktop-only  ● ~$0
```

### G — Conversion & trust
```
21 Tap-to-call near top  PASS tel: link near top · WARN none  ● ~$0
22 Quote / contact form  PASS a real form · WARN none  ● ~$0
23 Clear "get a quote" CTA  PASS yes · WARN none  ● ~$0
24 Reviews shown on site  PASS yes · WARN none  ● ~$0
25 Gallery / portfolio    PASS present · WARN none  ● ~$0
26 Trust badges (licensed, insured, NKBA, BBB, warranty)  PASS ≥2 · WARN one · FAIL none  ● ~$0
27 Financing mentioned    PASS mentioned · WARN not mentioned  ● ~$0
28 Footer copyright year  FAIL year more than 2 yrs old (site reads as abandoned)  ● ~$0
```

### H — SEO foundations (free, and he's never heard of most of these — good overwhelm)
```
29 Title tag        PASS names trade + city · WARN generic / no city · FAIL missing  ● ~$0
30 Meta description PASS present 120–160 chars · WARN short / missing  ● ~$0
31 H1 names trade   PASS mentions K&B · WARN doesn't (show the actual H1) · FAIL no H1  ● ~$0
32 ★ LocalBusiness schema  PASS present · WARN missing  ● ~$0
   "Your site is missing the code that tells Google what you do and where you are. The shops above you have it."
33 NAP matches GBP  PASS match · WARN phone/address differs from the Google listing (actively suppresses ranking)  ● ~$0
34 Image alt text   PASS ≥80% covered · WARN some · FAIL none  ● ~$0
```

### I — Content (blog) · 🔁
```
35 Blog section exists  PASS yes · WARN none  ● ~$0
36 🔁 ★ Most recent post age  PASS ≤1 mo · WARN 2–6 mo · FAIL over 6 mo / never  ● ~$0
   "Your last article went up {date}. The shop beating you publishes most months. Google treats a quiet site like a closed one."
37 🔁 Posting cadence (posts/mo, trailing 6 mo)  PASS ≥1/mo · WARN under 1/mo · FAIL none  ● ~$0
38 Service pages per trade  PASS separate pages for kitchen/bath/cabinets/countertops · WARN one catch-all  ● ~$0
```

### J — Authority (★ the hardest section for him to fake) · DataForSEO Backlinks + Labs
```
39 ★ Referring domains vs top rival  PASS ≥ rival · WARN 40–99% · FAIL under 40%  ● $0.02
   "{rival_domains} websites link to {rival}. {your_domains} link to you. Google reads links like votes. You're losing the vote."
40 ★ Organic keywords ranked vs rival  PASS ≥ rival · WARN 40–99% · FAIL under 40%  ● $0.02
   "Your site shows up in Google for {n} searches. The shop beating you shows up for {rival}."
```

### The six that sting
`#7 review count · #9 velocity · #13 local rank · #15 geogrid · #39 backlinks · #40 organic keywords.`
Lead each verdict band with these. Everything else is the weight that makes them land.

### Reliability rule (don't recreate the thin-audit problem)
Build the page from the ● certain checks first — that's 35 of the 40, full before a single slow check runs. The two ◐ checks (#10 response rate, #12 post frequency) are bonus: run them async, and whatever hasn't landed by render time goes in the emailed scorecard. A slow check never renders as a blank row.

---

# PART TWO — SPEND RULES

The per-audit cost (~$0.16) is not the risk. The risk is firing paid calls on traffic that never converts: bots, bounces, reloads, shares, back-button hits. `$0.16 × 10,000 junk loads = $1,600` with zero leads. Every rule below stops a paid call from firing on traffic that hasn't earned it.

### Rule 1 — The email gate is the spend boundary
Cheap checks fire before the gate. Expensive checks fire only after. No Tier 2 call may execute before the gate is passed.

```
TIER 0  FREE       Fires on: any site that loads
  All HTML-parse website checks (#17–38). One fetch + one PageSpeed call feeds all of them.  $0

TIER 1  CHEAP      Fires on: pre-gate (hook + question screens)
  Places/DFS profile + top 3 rivals (#1–9, #11) + single local-pack rank (#13).  ~$0.05
  This powers the pre-gate sting and the funnel-echo hook.

TIER 2  EXPENSIVE  Fires on: AFTER the gate only
  Geogrid #15 (~$0.018) · keyword matrix #14 (~$0.008) · referring domains #39 (~$0.04)
  · organic keywords #40 (~$0.04) · async slow tasks #10/#12 (~$0.004).  ~$0.11
```

### Rule 2 — Caching (never pay twice)
On a cache hit, serve from cache and fire zero paid calls.

```
Key                              Holds                     TTL
gbp:{place_id}                   Tier 1 profile + rivals   48h
serp:{keyword}:{location_code}   local-pack + organic rank 24h   (rankings move)
geogrid:{place_id}:{keyword}     grid visibility %         7d
backlinks:{domain}               referring domains + total 7d
keywords:{domain}                organic keyword count     7d
site:{domain}                    Tier 0 HTML result        24h
```
Key on the stable identifier (place_id, normalized domain), never the raw input string. Normalize domains first: strip protocol, `www.`, trailing slash, lowercase. Cache rivals under their own place_id/domain so a repeated rival is paid for once. A share link or reload inside the TTL costs $0.

### Rule 3 — Rate limiting + bot protection
```
Per IP:        5 audits / hour, 20 / day
Per place_id:  served from cache after first paid run within TTL
Bot filter:    require real form interaction before any Tier 1 call;
               honeypot field on the gate form; reject blank/known-bot User-Agents
Debounce:      one in-flight audit per session; ignore duplicate submits
```
On limit exceeded: serve Tier 0 + any cached Tier 1/2 with a soft message. Never hard-error, never fire paid calls past the limit.

### Rule 4 — Daily spend ceiling (the kill switch)
```
DAILY_AUDIT_BUDGET = $25/day   (≈150 full audits; tune to ad spend)
At 80%:   log a warning
At 100%:  stop all Tier 2 calls for the rest of the day;
          keep serving Tier 0 + Tier 1 + cache. Page still renders full;
          only the expensive depth layer pauses.
```

### Rule 5 — Slow (◐) checks are async, never blocking
```
On gate pass:  submit DataForSEO task → keep rendering results
               poll up to ~4s in the background
Resolved:      drop into its slot
Not resolved:  omit the row (never render blank); include in the emailed scorecard as
               "I kept pulling your Google history after you left. Here's what finished loading."
```

### Order of operations (per audit)
```
1. Land → run Tier 0 (free) + check cache for Tier 1.
2. Cache miss → run Tier 1 (~$0.05). Render pre-gate hook + questions.
3. Email gate.
   └─ not passed → stop. No Tier 2 spend, ever, for this visitor.
4. Gate passed → check budget ceiling + cache for each Tier 2 item.
   └─ run only uncached Tier 2 calls under budget. Submit async slow tasks.
5. Render from everything resolved. Email the full scorecard, carrying
   any async checks that landed after render.
```

---

# PART THREE — NUMBERS & BUILD ORDER

```
Full audit, all tiers, uncached, under budget:   ~$0.16
Cost per captured email (CPL ÷ gate rate):       ~$10–$30
Audit data as a share of CPL:                    under 1%
Data cost per closed $750/mo client at 1:500:    ~$80  (vs $2,250 three-month floor)
```
The per-audit price is rounding error against CPL and the client floor. The spend rules aren't about a cheaper audit. They make sure the $0.16 only gets spent on traffic worth $0.16.

**Build order:** Section E first. It's the one that makes the Map-Pack ad honest and closes the click leak. Screen 1 of the Scorecard must echo each ad's hook verbatim; for Map-Pack traffic, the rank reveal (#13) is that hook.

---

## EVIDENCE TIERS
- DataForSEO per-call costs (SERP Live $0.002, Backlinks $0.02, Labs ~$0.02): **[VERIFIED, June 2026]** — re-confirm at build.
- Rankings / blog / backlinks all feasible on the current stack: **[VERIFIED]**
- CPL $3–8/click, 25–35% gate conversion: **[REASONED]** — home-services benchmark ranges; replace with your own Meta + gate data once live.
- Thresholds, verdict stings, geogrid 3×3 call, $25/day ceiling, IP limits, TTLs: **[MY CALL]** — starting values; tune against real traffic and cost-per-booked-call data.
