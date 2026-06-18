/* =====================================================================
   site.config.ts — SINGLE SOURCE OF TRUTH
   Capacity counts, prices, contact, booking URL, brand strings, analytics
   ids. CapacityCounter + every price reads from here so nothing drifts and
   the spec's "CapacityCounter values must be true" rule is enforceable in
   one place. Update capacity HERE and nowhere else.
   ===================================================================== */

export const site = {
  brand: 'Kitchen Websites',
  domain: 'kitchenwebsites.com',
  url: 'https://kitchenwebsites.com',
  tagline: 'Websites & Google for kitchen & bath businesses.',
  founder: 'Shane Nguyen',

  // Contact — TODO confirm production values before launch
  email: 'shane@kitchenwebsites.com',
  phone: '', // PLACEHOLDER: add display phone
  bookingUrl: 'https://calendly.com/shanehnguyen/cabinet-dealers',

  // Call length — single source of truth. Every CTA label + /book read this.
  callLengthMinutes: 30,

  // Capacity (LOAD-BEARING — must be true; Godfather-Offer-System caps)
  capacity: {
    seo: { open: 10, total: 10, label: 'SEO seats' },
    websites: { open: 2, total: 2, label: 'spec-design slots' },
  },

  // Analytics — PLACEHOLDER ids; wired in BaseLayout, fire on real events
  analytics: {
    metaPixelId: '', // PLACEHOLDER
    ga4Id: '',       // optional
  },
} as const;

// Industry receipts (Dream-Buyer-Dossier, all [VERIFIED]). isLoss => --alarm.
// SINGLE SOURCE OF TRUTH for the four receipt stats. Every ReceiptStrip on
// every page reads from here — no stat number is hardcoded in markup, so they
// can never drift. (Homepage P1, Ticket 1.)
export type Receipt = { value: string; caption: string; alarm?: boolean };

export const receipts: Receipt[] = [
  { value: '$7.2M', caption: 'FTC settlement against a home-services lead platform', alarm: true },
  { value: '91%', caption: 'of homeowners read reviews before they call', alarm: false },
  { value: '72 hrs', caption: 'the window most homeowners decide inside', alarm: false },
  { value: '26%', caption: 'of kitchen & bath businesses sit at zero reviews', alarm: true },
];
