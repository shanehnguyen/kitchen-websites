// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Static-first build (KitchenWebsites-Build-Spec §3 performance budget).
// The /api/*.js Vercel functions deploy alongside the static output untouched.
export default defineConfig({
  site: 'https://kitchenwebsites.com',
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: false }, // we wire Meta Pixel + GA4 ourselves
  }),
  build: {
    inlineStylesheets: 'auto',
  },
  trailingSlash: 'never',
});
