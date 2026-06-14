# Kitchen Websites

Direct-response site for **kitchenwebsites.com** — websites, Google Business Profile management,
and local SEO, exclusively for kitchen & bath businesses. Astro static build + Vercel functions.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output → dist/ (+ .vercel/output)
npm run preview
```

## Where things live

- `src/pages/` — routes (`/`, `/score`, `/calculator`, `/rescue` `/websites` `/growth`, `/about`, `/book`, legal)
- `src/components/` — component library (ReceiptStrip, GuaranteeSpec, StageCards, …)
- `src/islands/` — the two interactive TS islands (score flow, calculator)
- `src/data/` — single source of truth: `site.config.ts` (prices/capacity/contact/analytics), `offers.ts`,
  `score-questions.ts`, `scoring.ts`, `leak-templates.ts`, `faqs.ts`
- `src/styles/` — `tokens.css` (design tokens), `base.css`, `components.css`
- `api/` — Vercel functions: `score-submit.js` (lead capture), `send.js`, `email-report.js`, `scan.js`
- `markdowns/` — strategy docs (source of truth for copy & offers)
- `_legacy/` — the previous FlipFix HTML site (reference only)

See **BUILD-STATUS.md** for what's shipped vs. the launch-gate checklist.

## Strategy

Built from the docs in `markdowns/`: Dream-Buyer-Dossier · Godfather-Offer-System · HVCO-Funnel-Plan ·
Referral-Capture-Score-Package · Ad-Board · KitchenWebsites-Build-Spec.
