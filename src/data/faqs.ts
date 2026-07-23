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
      'That means rebuilding your Google so it shows the business you actually are, and building a website that turns a curious click into a booked estimate.',
      'Then I keep it working every month. That’s it.',
    ],
  },
  {
    q: 'Aren’t you just another marketer who’ll rip me off?',
    a: [
      'Fair question. You’ve earned it.',
      'Here’s the difference. They sold you leads; I make the homeowner already looking choose you. They swore they owned Google; I promise the one thing I can actually move, your phone ringing more. They locked you in for a year; I earn next month every month.',
      'I show you the plan before you pay me a dollar. You see the work every week. You own everything I build.',
      'The last guy mailed you charts while your phone stayed quiet. I’d rather you judge me on homeowners calling.',
    ],
  },
  {
    q: 'Do you promise me leads or rankings?',
    a: [
      'No, and run from anyone who does.',
      '“Leads” is the Angi game, the same homeowner sold to four businesses at once. Rankings nobody controls, not me, not the guy who swore he did.',
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
      '$750 a month for the whole plan. Your Google rebuilt and run every month, your site built in, the ninety-day guarantee behind all of it. Month to month, and you own everything.',
      'Want a website on its own instead? That’s $1,500 for the standard build, or $4,500 fully custom, and you see your homepage before you pay a dollar of it.',
      'One kitchen runs your customer twenty, thirty grand. Win a single homeowner who’d have called someone else, and it’s paid for itself. We’ll talk real numbers on the call.',
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
      'I only work with kitchen and bath businesses, and I take a handful at a time. I designed your homepage myself. I know your numbers by name.',
      'The big agency sells you the same playbook they sell a dentist and a roofer. I know why a homeowner picks one over another, because it’s the only thing I do.',
      'You’re not a ticket in a queue. You’re the work.',
    ],
  },
];

/* Done For You page FAQ — tuned to the offer itself, so /done-for-you stands
   on its own with the same strength as the homepage. Same voice, same schema. */
export const dfyFaqs: Faq[] = [
  {
    q: 'How is this different from the SEO company that took $1,500 and mailed me charts?',
    a: [
      'They billed you for effort. I’m on the hook for a result.',
      'They swore they owned Google and sold you rankings nobody controls. I promise the one thing that matters: 15+ homeowner inquiries in ninety days, without you running a single ad.',
      'They locked you in for a year. I earn next month, every month. You see the work every week, and you own every piece of it.',
    ],
  },
  {
    q: 'What happens if it doesn’t work?',
    a: [
      'Then you don’t pay, and I don’t stop.',
      'Day one, we write down your numbers. Ninety days in, you’ve got 15+ homeowner inquiries, or you stop paying and I keep working until you get there. Still short three months later? We shake hands and you keep all of it. And I haven’t earned a dollar.',
    ],
  },
  {
    q: 'Do I own my website and Google profile?',
    a: [
      'All of it. Always.',
      'The site, the domain, the Google profile, the photos, the content. It’s yours from day one. Cancel any month and it all walks out the door with you.',
    ],
  },
  {
    q: 'I’m slammed on jobs. How much of my time does this take?',
    a: [
      'Almost none. That’s the point.',
      'I need about an hour up front to learn your business and your work. After that, I do the building. The only thing I ask is that you call back the homeowners who reach out. You’re doing that part anyway.',
    ],
  },
];
