# Kitchen Websites — Offer, About & Booking Change List

### For Claude Code · pages `/websites`, `/seo`, `/about` (improve) and `/book` (build new)
### Grounded in: KitchenWebsites-Build-Spec.md · FlipFix-Godfather-Offer-System.md · FlipFix-HVCO-Funnel-Plan.md · FlipFix-Dream-Buyer-Dossier.md · KingKong-Copy-Teardown.md

Apply in order: site-wide P1 first, then page by page. Copy marked **NEW COPY** ships verbatim. Where a value comes from a source doc, the ticket names the doc.

---

## VOICE GUARDRAILS (hold while editing any copy)

Buyer: 40–60s kitchen & bath owner, burned by lead platforms, screens every word for a sales con, reads on his phone. Voice rules:

- First person singular "I", signed Shane Nguyen. Never "we" or "our team."
- Sentence case in body. Plain verbs. No "elevate, unlock, empower, seamless, leverage, supercharge, transform."
- No exclamation marks. No emoji. No hype multipliers. No "free consultation," no "$X,XXX value" theater (the dossier's scam filter rejects both; the HVCO kill list bans the first).
- Every number must be real, sourced, and identical to its config value (Site-Wide Ticket 1). No invented figures. FTC truth-in-advertising applies to this site too.
- Mix sentence lengths. No stacks of three. No em dashes; use commas and periods.

---

# SITE-WIDE TICKETS (do these before the page work)

### Site-Wide 1 — One source of truth for the receipt stats, applied across every page

**Problem:** The receipt numbers disagree between pages and inside `/seo`. Homepage: $7.2M / 91% / 72hrs / 26%. `/seo` strip: $4.0M / 51% / 40hrs / 15%, while `/seo`'s own guarantee says 72 hours. Same industry facts, different numbers. For this buyer that reads as fabrication and kills the page.

**Canonical set** (from FlipFix-Godfather-Offer-System.md and the homepage):
```
receipts: [
  { value: "$7.2M", caption: "FTC settlement against a home-services lead platform", alarm: true },
  { value: "91%",   caption: "of homeowners read reviews before they call", alarm: false },
  { value: "72hrs", caption: "the window most homeowners decide inside", alarm: false },
  { value: "26%",   caption: "of kitchen & bath businesses sit at zero reviews", alarm: true }
]
```

**Change:**
1. Move these four to site config as the single source. Every `ReceiptStrip` instance on every page reads from it. No hardcoded stat numbers anywhere.
2. Replace the `/seo` strip's $4.0M / 51% / 40hrs / 15% with the canonical set.
3. Anywhere body copy or a guarantee states one of these facts in words (for example "72 hours" in the `/seo` guarantee), it must match the config value.

**Acceptance:** Grep the repo for any stat literal (`4.0`, `7.2`, `51%`, `91%`, `40hrs`, `72`, `15%`, `26%`). Every one resolves to a single config value. The same four numbers render identically site-wide.

**Verification note for Shane (not Claude Code):** Confirm each figure traces to a citable source before launch (the FTC case, the survey behind 91% and 72hrs, the data behind 26%). This buyer checks. One number you cannot source is worse than no number.

### Site-Wide 2 — One source of truth for call length, and the 15-vs-30 decision

**Problem:** Offer pages say "Book the 15-minute call." You asked to build a "30 minute booking." If the offer pages say 15 and `/book` says 30, the buyer feels a bait-and-switch the moment he arrives.

**Recommendation:** Keep 15 minutes. It is a lower commitment than 30, so more people book it, and your reassurance copy ("fifteen minutes, no pitch-slap") is already written for it. King Kong runs 30 because their traffic is pre-sold by a personal brand; your cold-to-warm traffic books a shorter call more readily. If you have a closing reason for 30, take it, but the decision must be one value.

**Change:** Put `callLengthMinutes` in site config. Every CTA label and the `/book` page read from it. Default 15. Changing to 30 is then one line, applied everywhere at once.

**Acceptance:** No hardcoded "15-minute" or "30-minute" string in any page. All read from config.

### Site-Wide 3 — Sitemap reflects the SEO + Websites collapse

**Problem:** The build merged the old Rescue and Growth offers into `/seo` ($997/mo, month one is the full rebuild). The spec's sitemap still lists `/rescue` and `/growth`.

**Change:** Do not build or link `/rescue` or `/growth`. Live offer routes are `/seo` and `/websites`. Nav and footer offer links point only to those. If `/rescue` or `/growth` exist as stubs, 301 them to `/seo`.

**Acceptance:** No internal link resolves to `/rescue` or `/growth`. Nav reads SEO · Websites · About.

---

# PAGE 1 — `/websites` (improve)

This page is close. It already runs the see-it-first risk reversal, flat price, named-and-itemized stack, fine-print-printed-big penalty, who-it's-for, and a `/book` CTA. Tighten these.

### W1 — Complete the late-penalty line

**Location:** GuaranteeSpec on `/websites`, condition 04.

**Problem:** The penalty figure is cut off ("the penalty is 1... project price for every full week").

**Change:** Set condition 04 to read, from FlipFix-Godfather-Offer-System.md (10%/week, capped at 50%):

   **NEW COPY:** You own everything at every stage you've paid for. If I run late, I take 10% off the project price for every full week I'm late, capped at half the total. The deadline has teeth, and they bite me.

**Acceptance:** Condition 04 is complete and states 10% per week, capped at half.

### W2 — De-risk line on the hero CTA

**Location:** `CTAButton` de-risk slot, hero "Book the 15-minute call."

**Problem:** The final CTA carries "no pitch-slap" but the hero CTA's de-risk slot looks empty. The spec requires the slot filled on every primary CTA.

**Change:** Set the hero CTA support line to:

   **NEW COPY:** 15 minutes. I show you the homepage idea before you owe a dollar.

**Acceptance:** Hero CTA renders a de-risk line. Every `/book` CTA on the page has one.

### W3 — Value stack stays itemized, no invented prices

**Location:** "NAMED AND ITEMIZED. NOTHING VAGUE." section.

**Decision (your call, default = leave as is):** The Offer System doc prices the SEO premiums ($500/$350/$300) but deliberately leaves the website bonuses unpriced. Keep the website bonuses (Punch List Period, Job Photo Playbook, Launch-Day Google Sync) named and unpriced. For this buyer, "named and itemized" is the proof. A bolted-on "$X value" on each line reads as the theater he distrusts. Do not add dollar tags here.

**Acceptance:** No fabricated "value" figures on the website bonuses. Each item keeps its concrete one-line benefit.

### W4 — Capacity counter pulls from config and leads with the constraint

**Location:** `CapacityCounter` on `/websites` ("2 of 2 spec-design slots open this month").

**Problem:** "2 of 2 open" reads as no constraint yet. The constraint is that only two exist, and the reason is that Shane designs them himself.

**Change:** Pull the count from config (single source). Render it constraint-first:

   **NEW COPY:** Two spec-design slots a month. I design them myself. [N] open in [month].

**Acceptance:** Count reads from config. Framing leads with the two-a-month limit, not the open number.

### W5 — Confirm CTA destination and hierarchy

**Location:** all CTAs on `/websites`.

**Change:** Primary CTA is "Book the 15-minute call" to `/book` only (this offer is sold on a call, not bought cold, per spec). The global nav "See how you stack up" button to `/score` may stay in the header but must not appear as an in-body CTA competing with booking.

**Acceptance:** Every in-body primary CTA points to `/book`. No `/score` CTA competes inside the page body.

---

# PAGE 2 — `/seo` (improve) — this is your reference standard

`/seo` is the strongest of the three. Its day-90 performance guarantee is the Godfather move done right: reversed on a number you control, not on rankings. The "what it costs to leave it" block is the pain-of-inaction beat. The stack carries real stated values. Match the other pages to this one. Fixes here are mostly the site-wide consistency items landing on the page.

### S1 — Apply the canonical receipt set (see Site-Wide 1)

**Location:** `ReceiptStrip` on `/seo`.

**Change:** Replace $4.0M / 51% / 40hrs / 15% with the config set ($7.2M / 91% / 72hrs / 26%). Confirm the guarantee's "72 hours" now matches the strip.

**Acceptance:** `/seo` strip equals the homepage strip. No internal 40-vs-72 conflict remains.

### S2 — Complete the price subline

**Location:** hero price region, "$997/mo".

**Problem:** The management line is cut off ("Month-to-month manage...").

**Change:** Set the subline to:

   **NEW COPY:** Month-to-month management of your Google presence: profile, reviews, local search, the site. Month one I rebuild the page from scratch, verified, photo-loaded, review engine running. Every month after, I keep the calls climbing and track the one number that proves it.

**Acceptance:** Subline is complete and matches the Offer System retainer description.

### S3 — Capacity counter from config

**Location:** the mono pull quote, "10 of 10 SEO seats open this month."

**Change:** Pull the seat count from config. Keep the reason-why (the work is done by hand, then a waitlist, no pay-per-lead, the number can't be faked). Render constraint-first:

   **NEW COPY:** Ten SEO seats. I run them myself, so when they fill there's a waitlist. [N] open this month.

**Acceptance:** Seat count reads from config. The no-pay-per-lead reason-why stays intact.

### S4 — Verify the guarantee cap matches the Offer System doc

**Location:** GuaranteeSpec on `/seo`, condition 04.

**Change:** Confirm the free-work cap reads three months, then either party can walk and the owner keeps everything (per FlipFix-Godfather-Offer-System.md Offer 3). Fix if it drifted.

**Acceptance:** Cap states three months and the walk-away-with-everything term.

### S5 — Keep one receipt strip, not two sets

**Location:** `/seo` body.

**Change:** Do not add a second differently-numbered strip anywhere on the page. One strip, config-sourced. If a CTA lower on the page needs adjacent proof, use the compact two-stat variant ($7.2M and 26%) from the same config.

**Acceptance:** Every stat on `/seo` traces to one config set.

---

# PAGE 3 — `/about` (improve)

Good and on-spec: real founder photo, the "narrowness is the product" positioning, Handshake Terms explained, real portfolio, honest NKBA placeholder. Two King Kong moves to add, plus copy completion.

### A1 — Complete the hero subhead

**Location:** `/about` hero subhead.

**Problem:** Cut off at "before the ph...".

**Change:** Set the subhead to:

   **NEW COPY:** Most marketers picked your industry off a dropdown. I picked it the long way. I built the actual sites, watched how a homeowner shops a $24,000 kitchen, and learned where the work leaks before the phone ever rings.

**Acceptance:** Subhead is complete, no truncation.

### A2 — Add the redirect-to-the-reader turn before the CTA

**Location:** `/about`, between the portfolio strip and the final CTA band.

**Problem:** King Kong's about page refuses to stay about them and pivots hard to the reader. Yours tells the story well but ends on the story. Add one bridge that turns it to his stakes.

**Change:** Insert a short block:

   **NEW COPY (heading):** None of this matters unless it changes your phone.
   **NEW COPY (body):** So here is the only question that does. When a homeowner looks you up tonight, do you win that ten seconds, or does the shop underneath you win it? That is what the check below measures, and it takes three minutes.

Then the existing "See how you stack up" CTA to `/score`.

**Acceptance:** The bridge sits before the final CTA. It redirects from Shane's story to the reader's situation and hands into the `/score` CTA.

### A3 — Optional credibility line, only if true

**Location:** `/about`, near "Why I only do this."

**Change:** If the number is real, add one specificity line ("I have built [N] kitchen and bath sites" or "[N] years building for this trade"). If you cannot state a real number yet, add nothing. The portfolio and the "I built these before I sold marketing" origin carry the proof until then.

**Acceptance:** Either a true, specific credibility line, or no line. No vague or invented claim.

### A4 — Keep the CTA to /score, keep the honest NKBA placeholder

**Location:** `/about` CTA and badge slot.

**Change:** `/about` CTA stays "See how you stack up" to `/score` (cold/nurture page, per spec). Keep the NKBA badge placeholder honest: it ships when the membership is real. Do not render a badge until then.

**Acceptance:** CTA points to `/score`. No fake membership badge.

---

# PAGE 4 — `/book` (BUILD NEW) — King Kong qualifying-funnel strength

**What this page is.** The warm/ready destination. Offer pages (`/seo`, `/websites`) point here, and the `/score` results page links here. It is NOT a cold front door. The cold qualifying quiz is `/score`, which already captures the ten diagnostic questions. So `/book` must not re-ask the Score's questions. It frames the call with King Kong strength, runs a short fit-and-intel qualifier for people who arrive without a Score, then shows the calendar.

Source of the King Kong strength: KingKong-Copy-Teardown.md Section 4 (the strategy-session page). Lift the structure, drop the carnival voice.

### B1 — Page chrome (reduced)

- Header: logo only. Remove the "See how you stack up" button here. Do not send a ready-to-book person back to the quiz.
- Footer: legal line only, matching `/score`'s minimal treatment.
- `StickyMobileCTA`: off (per spec, never on `/book`).
- Event: `CallBooked` fires on Calendly confirmation. The qualifier answers POST to the ESP/CRM with the booking, because the answers are the sales intel, the same principle as the Score.

### B2 — Two entry states

**From the Score (query param present, for example `?from=score` with segment/score):** Skip the qualifier. Show a personalized intro and the calendar directly. The Score already captured everything.

   **NEW COPY (intro, Score path):** You already ran the check. I have your leak points in front of me. Pick a time and I will walk you through them, and what I would fix first. Fifteen minutes.

**Cold/warm (no Score param, arriving from an offer page):** Show the short qualifier (B4) before the calendar.

**Acceptance:** A visitor arriving with the Score param sees the calendar without re-answering questions. A visitor without it sees the qualifier first.

### B3 — Hero (both states)

   **NEW COPY (eyebrow):** THE 15-MINUTE CALL
   **NEW COPY (H1):** I'll show you exactly where your phone is leaking. Then you decide if you want me to fix it.
   **NEW COPY (subhead):** Fifteen minutes. No pitch-slap. You leave with your three biggest leak points and what I would fix first, whether or not we ever work together.

**Acceptance:** Hero names the call length, what he leaves with, and the no-obligation. No "free consultation" phrasing.

### B4 — The short qualifier (cold/warm path only)

Three required questions, one optional, each with a reason-why beneath it, in the King Kong reason-why style. Match the Calendly fields named in the spec (business type, revenue mix, current marketing) plus the intel field. One question per screen on mobile, or a short stacked form. Do not exceed four.

**Q1 (fit gate).**
   **NEW COPY (question):** Where does most of your work come from?
   **NEW COPY (options):** Homeowners · Contractor or builder accounts · A mix
   **NEW COPY (reason-why):** I only take businesses whose customers are homeowners. It is the one buyer I know cold, and the narrowness is the whole point.

**Q2 (route).**
   **NEW COPY (question):** Which one brought you here?
   **NEW COPY (options):** Getting found on Google · A website that actually closes · Not sure yet
   **NEW COPY (reason-why):** So I walk into the call already knowing which of the two jobs we are talking about.

**Q3 (intel, open text, the highest-value field).**
   **NEW COPY (question):** What has made the phone quieter than it should be?
   **NEW COPY (reason-why):** Your words, not a dropdown. It is the first thing I look at before we talk.

**Q4 (optional, ROI anchor).**
   **NEW COPY (question):** Roughly what does your average job run?
   **NEW COPY (options):** Under $10k · $10k–25k · $25k–50k · $50k+
   **NEW COPY (reason-why):** So the numbers I show you on the call are yours, not generic.

**Acceptance:** Four questions maximum, each with a reason-why. Q1 routes contractor-only and B2B answers to a soft-decline state (B6). Answers POST with the booking.

### B5 — Show-up confirmation, then calendar

A plain confirmation before the calendar. No "pinky promise," no "Tiger."

   **NEW COPY (confirmation line):** If I hold a time for you, you'll be there. I run these myself, so a no-show is a slot another owner needed.
   **NEW COPY (checkbox label):** Yes, I'll be there.

Then the lazy-loaded Calendly embed. Beneath it, repeat the reassurance:

   **NEW COPY (under calendar):** Fifteen minutes. No pitch-slap. You leave with your leak points either way.

**Acceptance:** Confirmation precedes the calendar. Calendly lazy-loads on interaction (performance budget). Reassurance line sits under the calendar.

### B6 — Who the call is for, and the soft decline

A short two-column block below the calendar, plus a graceful state for a bad fit from Q1.

   **NEW COPY (for):** Book the call if your customers are homeowners, your work is better than your Google page makes it look, and you're ready to fix that.
   **NEW COPY (not):** Not the call for you if you want a guaranteed ranking (nobody can promise that and Google flags anyone who does), you're shopping on price alone, or your revenue is contractor and builder accounts.

   **NEW COPY (soft decline, shown if Q1 = contractor/B2B):** Straight answer: I'd be the wrong call for you. I only know the homeowner side cold, and you deserve someone who knows yours. No call booked, no hard feelings.

**Acceptance:** The for/not block is present. A contractor-only answer reaches the soft-decline state instead of the calendar.

### B7 — Capacity, only if true

   **NEW COPY (optional, if true):** I take a handful of these calls a week, because I run every one myself.

**Acceptance:** Included only if the limit is real. No invented scarcity.

### B8 — What this page must not do

- No second qualifying quiz that repeats the Score's ten questions.
- No "free 30-minute strategy session, $1,000 value" framing. Plain, specific, no value theater.
- No nav or CTA that pulls a ready buyer back to `/score`.
- No emoji, no exclamation marks, no hype.

---

# FINAL VERIFICATION (run after all tickets)

- Every receipt number on every page resolves to one config set. `/seo` strip equals homepage strip. No 40-vs-72 conflict.
- Call length reads from config on every CTA and on `/book`. One value site-wide.
- No links to `/rescue` or `/growth`. Nav reads SEO · Websites · About.
- `/websites`: penalty line complete (10%/week, capped at half), hero CTA de-risk line present, capacity constraint-first from config.
- `/seo`: price subline complete, guarantee cap at three months, one strip only.
- `/about`: hero subhead complete, reader-redirect block before the `/score` CTA, no fake NKBA badge.
- `/book`: Score path skips the qualifier; cold path runs four questions max with reason-whys; show-up confirmation before a lazy-loaded calendar; reassurance under it; soft decline for contractor/B2B; reduced header, no back-to-Score CTA; CallBooked fires and qualifier answers POST.
- Whole site: no em dashes, no emoji, no exclamation marks, no invented numbers, first-person "I" throughout.
```
