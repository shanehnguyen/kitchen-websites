/* =====================================================================
   faqs.ts — homepage FAQ. "The questions a burned owner actually asks."
   CSS-only accordions + FAQPage schema (FAQ.astro). Voice-forward; doubles
   as on-page SEO. Answers are arrays of short, one-beat-per-line paragraphs
   (FAQ.astro renders each as its own <p>; schema joins them).
   ===================================================================== */

export type Faq = { q: string; a: string | string[] };

export const homeFaqs: Faq[] = [
  {
    q: 'What exactly do you do?',
    a: [
      'Two things.',
      'I get you found by the homeowners already searching for your work. And I make you the one they pick when they look you up.',
      'That means rebuilding your Google so it shows the shop you actually are, and building a website that turns a curious click into a booked estimate.',
      'Then I keep it working every month. That’s it.',
    ],
  },
  {
    q: 'Aren’t you just another marketer who’ll rip me off?',
    a: [
      'Fair question. You’ve earned it.',
      'Here’s the difference. I don’t sell leads. I don’t promise rankings. And I don’t lock you in.',
      'I show you the plan before you pay me a dollar. You see the work every week. You own everything I build.',
      'The last guy mailed you charts while your phone stayed quiet. I’d rather you judge me on homeowners calling.',
    ],
  },
  {
    q: 'Do you promise me leads or rankings?',
    a: [
      'No, and run from anyone who does.',
      '“Leads” is the Angi game, the same homeowner sold to four shops at once. Rankings nobody controls, not me, not the guy who swore he did.',
      'What I promise is the work, the deadline, and more homeowners finding you and calling than do today. Beat that number in 90 days, or you stop paying and I keep going.',
      'That’s a promise I can actually keep.',
    ],
  },
  {
    q: 'Do I own my website and Google profile?',
    a: [
      'All of it. Always.',
      'The site, the domain, the Google profile, the photos, the content. It’s yours from day one.',
      'Most agencies hold it hostage so you can’t leave. Fire me any month and it all walks out the door with you.',
      'I’d rather earn next month than trap you in it.',
    ],
  },
  {
    q: 'How much does it cost?',
    a: [
      'Depends what you need, and you’ll know the number before you commit to anything.',
      'The website is a flat quote, $3,500 to $6,000, and you see the homepage before you pay for the build. Ongoing Google work runs $997 a month, month to month.',
      'One kitchen is $20,000 to $30,000 to you. Win back a single homeowner you’d have lost, and it’s already paid for itself.',
      'We’ll talk real numbers on the call.',
    ],
  },
  {
    q: 'I’m slammed on jobs. How much of my time does this take?',
    a: [
      'Almost none. That’s the point.',
      'I need an hour up front to learn your business and your work. After that, I do the building.',
      'The only ongoing thing I ask is that you ask happy customers for a review, and that you call back the homeowners who reach out. You’re doing that part anyway.',
      'You stay on the tools. I handle the screen.',
    ],
  },
  {
    q: 'Why should I trust you over a bigger agency?',
    a: [
      'Because a bigger agency has a hundred clients, and you’d be a line item.',
      'I only work with kitchen and bath shops, and I take a handful at a time. I designed your homepage myself. I know your numbers by name.',
      'The big shop sells you the same playbook they sell a dentist and a roofer. I know why a homeowner picks one remodeler over another, because it’s the only thing I do.',
      'You’re not a ticket in a queue. You’re the work.',
    ],
  },
];
