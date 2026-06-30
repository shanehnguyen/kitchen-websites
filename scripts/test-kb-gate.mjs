/* Test the kitchen & bath LEAD gate against the REAL classifier in
   api/scorecard.js (imported, not copied — so this can never drift from prod).

   Run all the baked-in cases:   node scripts/test-kb-gate.mjs
   Check your own business:       node scripts/test-kb-gate.mjs "Stone supplier" "Precision Surfaces LLC"
                                  node scripts/test-kb-gate.mjs "Restaurant"     "Tony's Pizza"
   (args are: "<GBP category>" "<business name>")

   It calls isKbLead and prints the lead decision. Nothing is sent anywhere —
   this is the classifier only, zero side-effects. */
import { isKbLead } from '../api/scorecard.js';

// One-off check from the command line.
const [cat, name] = process.argv.slice(2);
if (cat !== undefined) {
  const lead = isKbLead({ category: cat, name: name || '' });
  console.log(`${lead ? '✅ LEAD' : '⛔ filtered'}  category="${cat}"  name="${name || ''}"`);
  process.exit(0);
}

// Regression set. STRICT scope: kitchen & bath + interior remodeling only.
// LEFT = should be a lead. RIGHT = should be filtered (includes adjacent
// building trades like roofing/HVAC/plumbing, which strict scope excludes).
const SHOULD_LEAD = [
  ['Kitchen remodeler'], ['Bathroom remodeler'], ['Cabinet maker'], ['Countertop store'],
  ['General contractor'], ['Construction company'], ['Home improvement store'], ['Remodeler'],
  ['Tile contractor'], ['Flooring contractor'], ['Interior designer'], ['Carpenter'],
  ['Drywall contractor'], ['Masonry contractor', 'Stoneworks'], ['Handyman', 'Joe Fix-It'],
  // generic-named shops whose CATEGORY carries the K&B signal:
  ['Stone supplier', 'Precision Surfaces LLC'], ['Woodworker', 'Heritage Woodcraft'],
  ['Glass & mirror shop', 'Clear View'], ['Window installation service', 'ABC Installers'],
  ['Granite supplier', 'Rock Solid'], ['Countertop contractor', 'Edge Co'],
  // missing category, K&B signal only in the name:
  ['', 'Acme Kitchen & Bath'], ['', 'Smith Cabinetry'],
];
const SHOULD_FILTER = [
  // the report that started this — trash service slipping through:
  ['Garbage collection service', 'Trash Caddies'], ['Junk removal service', 'Haul It'],
  // adjacent building trades excluded by STRICT scope:
  ['Roofing contractor', 'TopShield'], ['Plumber', 'Quick Drain'], ['HVAC contractor', 'CoolAir'],
  ['Electrician', 'Volt'], ['Landscaping service', 'Green Lawns'], ['Painter', 'Fresh Coat'],
  ['Deck builder', 'Backyard Co'], ['Pest control service', 'BugOff'], ['House cleaning service', 'Tidy'],
  // ambiguous words that must NOT slip in (vetoed by an off-trade signal):
  ['Auto glass shop', 'Quick Glass'], ['Restaurant', 'Granite City Food & Brewery'],
  // plain non-home-improvement + the now-rejected unknown:
  ['Restaurant', "Tony's Pizza"], ['Dentist', 'Bright Smiles'], ['Hair salon', 'Cuts'],
  ['Real estate agency', 'Homes Inc'], ['Gym', 'FitLife'], ['', 'Generic LLC'],
];

let pass = 0, fail = 0;
const run = (rows, want, label) => {
  console.log(`\n--- ${label} (want ${want ? 'LEAD' : 'filtered'}) ---`);
  for (const [cat, name] of rows) {
    const got = isKbLead({ category: cat, name: name || '' });
    const ok = got === want;
    ok ? pass++ : fail++;
    console.log(`${ok ? '  ok ' : 'FAIL'}  ${got ? 'LEAD    ' : 'filtered'}  category="${cat}"${name ? `  name="${name}"` : ''}`);
  }
};
run(SHOULD_LEAD, true, 'kitchen & bath / adjacent');
run(SHOULD_FILTER, false, 'not home improvement');
console.log(`\n${fail === 0 ? '✅ all' : `❌ ${fail} of ${pass + fail}`} checks ${fail === 0 ? 'passed' : 'FAILED'} (${pass} passed).`);
process.exit(fail === 0 ? 0 : 1);
