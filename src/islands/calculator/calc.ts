/* =====================================================================
   calc.ts — Lost Referral Calculator (client-only).
   3 inputs → annual leakage estimate, computed live. Math shown openly;
   assumptions stated conservative (the buyer distrusts black boxes —
   HVCO-Funnel-Plan §2). Fires CalcComplete. No backend.

   Model (all [MY CALL], tunable, and SHOWN to the user for honesty):
   a conservative fraction of the referrals who check you on Google
   quietly pick a better-reviewed competitor instead. The fraction depends
   only on YOUR review count — lower reviews, bigger leak.
   ===================================================================== */

type Bracket = { max: number; rate: number; label: string };
const BRACKETS: Bracket[] = [
  { max: 0, rate: 0.09, label: 'zero reviews' },
  { max: 5, rate: 0.07, label: '1–5 reviews' },
  { max: 20, rate: 0.05, label: '6–20 reviews' },
  { max: 50, rate: 0.03, label: '21–50 reviews' },
  { max: Infinity, rate: 0.015, label: '50+ reviews' },
];

function bracketFor(reviews: number): Bracket {
  return BRACKETS.find((b) => reviews <= b.max) ?? BRACKETS[BRACKETS.length - 1];
}

const SMALL_RESULT_THRESHOLD = 6000;

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function init(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>('[data-calc]');
  if (!form) return;

  const refsEl = form.querySelector<HTMLInputElement>('[name="referrals"]')!;
  const valueEl = form.querySelector<HTMLInputElement>('[name="jobValue"]')!;
  const reviewsEl = form.querySelector<HTMLInputElement>('[name="reviews"]')!;

  const leakEl = root.querySelector<HTMLElement>('[data-calc-leak]')!;
  const mathEl = root.querySelector<HTMLElement>('[data-calc-math]')!;
  const fallbackEl = root.querySelector<HTMLElement>('[data-calc-fallback]')!;

  let completed = false;

  function compute(): void {
    const refs = Math.max(0, Number(refsEl.value) || 0);
    const value = Math.max(0, Number(valueEl.value) || 0);
    const reviews = Math.max(0, Number(reviewsEl.value) || 0);
    const b = bracketFor(reviews);

    const annualRefs = refs * 12;
    const lostJobs = annualRefs * b.rate;
    const leak = lostJobs * value;

    leakEl.textContent = money(leak);

    mathEl.innerHTML =
      `Here’s exactly how we got that, no black box: <strong>${refs}</strong> referrals a month is ` +
      `<strong>${annualRefs}</strong> a year. With <strong>${b.label}</strong>, we assume only ` +
      `<strong>${(b.rate * 100).toFixed(1)}%</strong> of them quietly pick a better-reviewed competitor after ` +
      `checking you on Google — that’s <strong>${lostJobs.toFixed(1)}</strong> jobs a year at ` +
      `<strong>${money(value)}</strong> each. We deliberately picked a low percentage; the real number is ` +
      `usually worse.`;

    fallbackEl.hidden = leak >= SMALL_RESULT_THRESHOLD;

    if (!completed && refs > 0 && value > 0) {
      completed = true;
      (window as any).kwTrack?.('CalcComplete', { leak: Math.round(leak), reviews });
    }
  }

  [refsEl, valueEl, reviewsEl].forEach((el) => {
    el.addEventListener('input', compute);
  });
  compute();
}
// Init is called explicitly from the page's module script (calculator.astro)
// so there is no double-binding. Do not auto-run here.
