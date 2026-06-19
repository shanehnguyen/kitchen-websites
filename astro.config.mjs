// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Static-first build (KitchenWebsites-Build-Spec §3 performance budget).
// The /api/*.js Vercel functions deploy alongside the static output untouched.
export default defineConfig({
  site: 'https://kitchenwebsites.com',
  output: 'static',
  // The Lost Referral Calculator measured the wrong leak (referrals, not
  // search). Retired in favor of the Google Scorecard; old links/ads land
  // on the new tool. (Scorecard spec §9.)
  redirects: {
    '/calculator': '/scorecard',
    '/seo': '/done-for-you',
    '/get-found': '/done-for-you',
  },
  adapter: vercel({
    webAnalytics: { enabled: false }, // we wire Meta Pixel + GA4 ourselves
  }),
  build: {
    inlineStylesheets: 'auto',
  },
  trailingSlash: 'never',
});
