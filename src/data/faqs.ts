/* =====================================================================
   faqs.ts — homepage FAQ. "The questions a burned owner actually asks."
   Verbatim from kitchen-websites-COPY-v2.md. CSS-only accordions + FAQPage
   schema (FAQ.astro). Voice-forward; doubles as on-page SEO.
   ===================================================================== */

export type Faq = { q: string; a: string };

export const homeFaqs: Faq[] = [
  {
    q: 'What exactly do you do?',
    a: 'Two things, and I say no to everything else. I fix the Google page homeowners check before they call you, and I build the website that closes the ones who dig deeper. Websites and Google for kitchen and bath. Not plumbers, not dentists, not “all home services.” If your problem is anything other than that, I’m the wrong guy, and I’ll tell you so on the call.',
  },
  {
    q: 'Aren’t you just another marketer who’ll rip me off?',
    a: 'Probably what the last one said too. So don’t take my word for it. I built the deal so you can’t get ripped off. The Rescue is $997 with a deadline, and if I miss it you get every dollar back. The website I design first, before you pay for the build, and if you hate it you walk for nothing. Everything is month to month and you own all of it. I set it up this way on purpose, because you’ve already met the version of me that didn’t.',
  },
  {
    q: 'Do you promise me leads or rankings?',
    a: 'No, and run from anyone who does. Nobody can promise you a Google ranking. Google itself treats that promise as a scam signal. And the guys who promised you leads sold you tire-kickers who were never going to hire. I promise you the work, on a deadline, in writing. The leads are what happens when your page stops bleeding the referrals you already earned.',
  },
  {
    q: 'Do I own my website and Google profile?',
    a: 'All of it. The site, the domain, the Google login, every photo, every word. The day we start it’s yours, and the day you fire me it walks out the door with you. No hostage website. That trap is the first thing I took out, because it’s the reason the last contract felt like one.',
  },
  {
    q: 'How much does it cost?',
    a: 'The Rescue is $997 flat. The website runs $3,500 to $6,000, quoted before we start so the number can’t creep on you. Ongoing management is $997 a month, cancel any month. For context, the median kitchen job in this country is about $24,000. One referral you stop losing covers the whole thing several times over.',
  },
  {
    q: 'I’m slammed on jobs. How much of my time does this take?',
    a: 'Less than you’d think, and you being slammed is the whole reason your Google page got neglected in the first place. For the Rescue I need access and a batch of job photos, then I’m gone for 21 days. For the website I need your content once, and the clock doesn’t even start until it’s in my hands. I do the work. You run your jobs.',
  },
  {
    q: 'Why should I trust you over a bigger agency?',
    a: 'Because the bigger agency hands you to a 24-year-old account manager running forty other clients who couldn’t tell a shaker door from a slab. I only take kitchen and bath, I only take a handful at a time, and I do the work myself. You’re not trusting a logo. You’re trusting the one guy whose name is on the door.',
  },
];
