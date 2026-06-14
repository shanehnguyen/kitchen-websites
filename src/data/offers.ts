/* =====================================================================
   offers.ts — two offers now: SEO and Websites.
   SEO merges the old 21-Day Google Rescue (one-time fix) and the
   Tracked-Calls retainer into one $997/mo service: month one is the full
   rebuild, every month after is the run, single day-90 performance
   guarantee. Risk reversal only on what Shane controls (deliverables, the
   tracked number, money). No invented proof, no ranking/lead promises.
   ===================================================================== */

import { site } from './site.config';

export type ValueStackItem = { name: string; what: string; value?: string; group?: string };
export type Gate = { intro: string; items: string[]; notLine?: string };
export type NotForYou = string[];
export type Offer = {
  slug: 'seo' | 'websites';
  stage: 'SEO' | 'REBUILD';
  eyebrow: string;
  name: string;
  price: string;
  priceNote: string;
  heroHeadline: string;
  heroDerisk?: string;
  subhead: string;
  lead: string[];
  stack: ValueStackItem[];
  revealLine?: string;
  reasonWhy: string;
  guarantee: { stamp: string; title: string; conditions: string[]; foot: string };
  gate: Gate;
  notForYou?: NotForYou;
  scarcity: string;
  capacity: { open: number; total: number; label: string };
  capacityLead?: string; // constraint-first framing for CapacityCounter
  faqs: { q: string; a: string }[];
  ctaLabel: string;
  metaTitle: string;
  metaDescription: string;
};

export const offers: Record<Offer['slug'], Offer> = {
  seo: {
    slug: 'seo',
    stage: 'SEO',
    eyebrow: 'SEO · Get found & stay found',
    name: 'Local SEO',
    price: '$997/mo',
    priceNote: 'cancel any month. Month one is the full rebuild.',
    heroHeadline:
      'Get found, stay found, and if the calls aren’t up by day 90, I work free.',
    subhead:
      'Month-to-month management of your Google presence: profile, reviews, local search, the site. Month one I rebuild the page from scratch, verified, photo-loaded, review engine running. Every month after, I keep the calls climbing and track the one number that proves it.',
    lead: [
      'Open your Google Business Profile and be honest about what’s there. A page you haven’t touched in two years. Nine reviews. A couple of photos off your phone from a job back in 2022.',
      'Meanwhile every agency you’ve ever paid sent you a “report.” Charts, impressions, reach. Numbers that climbed while your phone stayed quiet. You could never tell if any of it turned into a single job.',
      'So here’s the deal instead. I rebuild the page in month one, then I run it, and we watch one number you can check yourself: the calls coming off your Google presence.',
    ],
    stack: [
      { group: 'Month one: the rebuild', name: 'The Showroom X-Ray', what: 'The personal video teardown of your Google presence next to your competitors’. The same one that probably brought you here.', value: '$500' },
      { group: 'Month one: the rebuild', name: 'The Job-Site Review Kit', what: 'QR review cards for the truck, the exact words your crew says to the homeowner, and the follow-up text that gets the review actually written.', value: '$350' },
      { group: 'Month one: the rebuild', name: 'The Local Rival Report', what: 'Your Google presence next to your three closest competitors, before and after, side by side.', value: '$300' },
      { group: 'Month one: the rebuild', name: 'The Core Rebuild', what: 'Profile verified and corrected, categories and services rebuilt, photos overhauled, posts seeded, the whole page brought back to life.', value: 'the main event' },
      { group: 'Every month: the run', name: 'Instrumentation & tracking', what: 'Call tracking that doesn’t break your Google listing, tagged forms, Google insights. No promise without the plumbing behind it.' },
      { group: 'Every month: the run', name: 'A written baseline', what: 'Your trailing-90-day number, adjusted for season, written into the agreement before the clock starts, so there’s nothing to argue about later.' },
      { group: 'Every month: the run', name: 'The climb + monthly emails', what: 'Ongoing local SEO to keep the calls rising, and a plain-English email every month: what I did, what it cost, what it brought back.' },
    ],
    revealLine:
      'Month one alone is over $1,150 in named work. It’s in your first $997, same as every month after.',
    reasonWhy:
      'Why put my own pay on the line? Because activity isn’t the product. Any agency can stay busy and bill you for it. I’d rather bet my fee on the one number that means a homeowner actually picked up the phone. If it doesn’t move, I haven’t earned it, so I don’t take it.',
    guarantee: {
      stamp: 'Warranty',
      title: 'If the calls aren’t up by day 90, I work free until they are.',
      conditions: [
        'Leads get called back the same business day. Your buyers decide inside 72 hours. No marketing survives an unanswered phone.',
        'Review asks go out on completed jobs, or you authorize me to run them for you.',
        'Access stays live. Google profile, site, tracking. No second SEO vendor making changes that fight mine.',
        'The free-work guarantee is capped at three months. At the cap, either of us can walk, and you keep everything.',
      ],
      foot: 'The number is mechanical: call tracking, tagged forms, Google’s own insights. Not my opinion, not yours. A number you can check without me in the room.',
    },
    gate: {
      intro: 'Before you book, a few things have to be true:',
      items: [
        'Most of your work comes from homeowners, not contractor accounts.',
        'You’ll give me working access to your Google Business Profile and keep it live.',
        'You answer your phone the same business day.',
      ],
    },
    notForYou: [
      'Most of your revenue is B2B or contractor accounts',
      'You want a guaranteed ranking (nobody can promise that, and Google flags anyone who does)',
      'You’re running a second SEO vendor in parallel',
    ],
    scarcity:
      'I won’t run pay-per-lead. That’s Angi’s model, the one the FTC went after, the one that burned you. My number can’t be faked. Theirs could.',
    capacity: site.capacity.seo,
    capacityLead: 'Ten SEO seats. I run them myself, so when they fill there’s a waitlist.',
    faqs: [
      { q: 'What exactly is this?', a: 'Monthly management of your whole Google presence. Month one I rebuild the page from scratch, verified, photo-loaded, review engine running. Every month after, I keep the calls climbing and track the one number that proves it. $997 a month, cancel any month.' },
      { q: 'What’s the “one number” you track?', a: 'Calls, direction taps, and form fills coming off your Google presence. Tracked with call tracking, tagged links, and Google’s own insights. We agree the baseline in writing before we start.' },
      { q: 'Is this pay-per-lead?', a: 'No. Pay-per-lead is the model that burned you, where you pay for tire-kickers who were never going to hire. I get paid to move one tracked number you can verify yourself. If it doesn’t move, I don’t get paid.' },
      { q: 'Do I own everything?', a: 'All of it. Profile, photos, content, logins. You can fire me any month and it walks out the door with you. No hostage anything.' },
      { q: 'What if my profile has no history to baseline?', a: 'Then we run a 30-day instrumented baseline first, so we’re measuring against a real starting line, not a guess. The 90-day clock starts after that.' },
    ],
    ctaLabel: `Book the ${site.callLengthMinutes}-minute call`,
    metaTitle: 'Local SEO for Kitchen & Bath, Tracked Calls or I Work Free | Kitchen Websites',
    metaDescription:
      'Month-to-month local SEO for kitchen & bath. Month one I rebuild your Google page; every month after I keep the calls climbing. If the number isn’t up by day 90, I work free.',
  },

  websites: {
    slug: 'websites',
    stage: 'REBUILD',
    eyebrow: 'Websites · Get chosen',
    name: 'The See-It-First Website Build',
    price: '$3,500–6,000',
    priceNote: 'flat, quoted by scope before the build starts. No hourly creep.',
    heroHeadline:
      'I’ll design your new homepage before you spend a dollar. You see it. Then you decide.',
    heroDerisk: `${site.callLengthMinutes} minutes. I show you the homepage idea before you owe a dollar.`,
    subhead:
      'Your work, your market, your business, on the screen in front of you before you’ve committed a cent to the build. Love it, we build the rest at one flat price on a 21-day clock with a penalty on me if I’m late. Don’t love it, you walk, and it cost you nothing. $3,500 to $6,000, quoted flat before we start.',
    lead: [
      'You’ve paid for marketing up front before. You wired the deposit, you waited, and what came back didn’t look anything like your work or didn’t come back at all. So you’ve got every reason to flinch at another web quote.',
      'So I flipped it. I design your real homepage first, on my dime, and send it to you before you’ve paid for the build. Not a template. Not a mockup of somebody else’s site with your logo dropped in. Yours. You look at it and you decide. The risk of the design sits with me, where it belongs, because you’ve carried it before and got nothing for it.',
    ],
    stack: [
      { name: 'The Spec Homepage', what: 'Your real homepage, designed first, delivered as an image you hold before a dollar moves to the build.' },
      { name: 'The Punch List Period', what: '90 days of post-launch fixes and tweaks, free. Every job you run ends with a punch list. So does mine.' },
      { name: 'The Job Photo Playbook', what: 'A shot list and phone guide so your crew shoots portfolio-grade job photos forever, long after I’m gone.' },
      { name: 'Launch-Day Google Sync', what: 'Site and Google profile lined up the day you go live. Services, name, address, phone, links, schema, all matching.' },
    ],
    reasonWhy:
      'Why design first instead of asking for a deposit and a leap of faith? Because the leap of faith is exactly what burned you. I’d rather eat the design hours on a job that walks than ask you to pay for a promise again. Two spec slots a month. I design them myself.',
    guarantee: {
      stamp: 'Terms',
      title: 'Flat price, real deadline, penalty on me.',
      conditions: [
        'The build clock starts on Content-Complete Day, not signing day. The number one reason websites run late is missing client content. The clock can’t start until your materials are in. You’d run your own jobs the same way.',
        'The clock pauses on any approval I’m waiting on for more than 48 hours.',
        'The spec stage includes one revision round. We lock the direction on the qualifying call so there’s no guessing.',
        'You own everything at every stage you’ve paid for. If I run late, I take 10% off the project price for every full week I’m late, capped at half the total. The deadline has teeth, and they bite me.',
      ],
      foot: 'Milestones: 40% to start, 40% at content-complete, 20% at launch. The spec homepage comes to you as a watermarked image. You see it before a dollar moves.',
    },
    gate: {
      intro: 'Before you book, three things have to be true:',
      items: [
        'Your current site doesn’t come close to the quality of your actual work.',
        'You’ve been burned by open-ended billing and you want one flat number.',
        'You can get your content and job photos together, because the clock starts when they’re in.',
      ],
      notLine: 'Not for you if you need it live next week, or you’re shopping on lowest price and nothing else.',
    },
    scarcity:
      'I design them personally, before you pay. That’s the whole reason there are only two.',
    capacity: site.capacity.websites,
    capacityLead: 'Two spec-design slots a month. I design them myself.',
    faqs: [
      { q: 'What does “see it first” actually mean?', a: 'Before you commit to the full build, I design your real homepage and send it to you as an image. Not a template, not someone else’s site with your name on it. Yours. You decide from there.' },
      { q: 'What if I don’t like it?', a: 'You walk, and it cost you nothing. No deposit kept, no kill fee. The risk of the spec is mine. That’s the whole idea.' },
      { q: 'Why a flat quote instead of hourly?', a: 'Because hourly is how the last guy ran your bill up where you couldn’t see the bottom of it. I quote the scope flat, before we start. The number doesn’t move unless you change the scope, same as a change order on one of your jobs.' },
    ],
    ctaLabel: `Book the ${site.callLengthMinutes}-minute call`,
    metaTitle: 'See-It-First Website Build for Kitchen & Bath | Kitchen Websites',
    metaDescription:
      'I design your homepage first. You see it before you pay a dollar. Flat price, 21-day clock, penalty on me if I’m late. Don’t love it, you walk for free.',
  },
};

export const offerList = [offers.seo, offers.websites];
