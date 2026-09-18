/*
 * Empty-state density check — REAL BROWSER, not part of `npm test`.
 *
 * Run with a throwaway Playwright install (per CLAUDE.md Testing
 * methodology point 8 — Playwright is never a project dependency):
 *
 *   npm install --no-save playwright && npx playwright install chromium
 *   python3 -m http.server 8777 &
 *   node test/layout-density.playwright.js
 *   npm uninstall --no-save playwright
 *
 * WHY THIS EXISTS SEPARATELY FROM layout-stability.test.js:
 * the claim being checked here — "the round card in its empty pre-action
 * state is MEANINGFULLY SHORTER than when fully populated" — is a real
 * pixel-layout claim, and jsdom has no layout engine (getBoundingClientRect
 * is always 0), so it fundamentally cannot make it. layout-stability.test.js
 * carries the structural proxy that runs in CI on every commit; this carries
 * the actual measurement, run by hand when the layout changes.
 *
 * The regression it catches: the round card used to reserve space for its
 * entire eventual content (dice row + slot row + answer-check + every
 * advance button) from first paint, so the empty pre-roll card was almost
 * exactly as tall as a fully-populated one — a large dead box with a lone
 * button floating at the bottom of it.
 */
'use strict';

const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8777/';

// Each entry: how to start the game, how to reach the populated state, and
// which card is being measured. `maxEmptyRatio` is the ceiling on
// empty-height / populated-height — a card at 0.95 is the bug.
const CASES = [
  {
    file: 'scuttle-addition-subtraction.html',
    card: '#screen-round',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#roll-btn'); await page.waitForTimeout(800); },
    maxEmptyRatio: 0.70,
  },
  {
    file: 'scuttle-product.html',
    card: '#screen-round',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#roll-btn'); await page.waitForTimeout(800); },
    maxEmptyRatio: 0.70,
  },
  {
    file: 'scuttle-difference.html',
    card: '#screen-round',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#roll-btn'); await page.waitForTimeout(800); },
    maxEmptyRatio: 0.70,
  },
  {
    file: 'nim.html',
    card: '#screen-game',
    start: () => document.getElementById('start-btn').click(),
    // Clicking a move opens the answer-check area — the block that used to
    // reserve ~145px from first paint.
    populate: async (page) => { await page.click('#move-row button:not(:disabled)'); await page.waitForTimeout(300); },
    maxEmptyRatio: 0.80,
  },
  {
    file: 'nim-subtraction.html',
    card: '#screen-game',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#move-row button:not(:disabled)'); await page.waitForTimeout(300); },
    maxEmptyRatio: 0.80,
  },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`${e.message}`));
  let failures = 0;

  for (const c of CASES) {
    errors.length = 0;
    await page.goto(BASE + c.file);
    await page.waitForTimeout(300);
    await page.evaluate(c.start);
    await page.waitForTimeout(300);

    const h = async () => page.evaluate(sel => {
      const n = document.querySelector(sel);
      return n ? Math.round(n.getBoundingClientRect().height) : -1;
    }, c.card);

    const empty = await h();
    await c.populate(page);
    const populated = await h();

    const ratio = populated > 0 ? empty / populated : 1;
    const ok = empty > 0 && populated > 0 && ratio <= c.maxEmptyRatio;
    if (!ok) failures++;
    console.log(
      `  ${ok ? '✅' : '❌'} ${c.file.padEnd(36)} ${c.card} empty ${String(empty).padStart(4)}px → populated ${String(populated).padStart(4)}px ` +
      `(empty is ${(ratio * 100).toFixed(0)}% of populated, ceiling ${(c.maxEmptyRatio * 100).toFixed(0)}%)`
    );
    if (!ok && empty > 0 && populated > 0) {
      console.log(`     the empty card is nearly as tall as the populated one — it is reserving space for phases the player has not reached`);
    }
    if (errors.length) { failures++; console.log(`     ❌ page errors: ${errors.join(' | ')}`); }
  }

  await browser.close();
  if (failures) {
    console.error(`\n  ${failures} case(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log('\n  all empty-state density cases passed');
  }
})();
