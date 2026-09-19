/*
 * Play-container CONSISTENCY check — REAL BROWSER, not part of `npm test`.
 *
 * Run with a throwaway Playwright install (per CLAUDE.md Testing
 * methodology point 8 — Playwright is never a project dependency):
 *
 *   npm install --no-save playwright && npx playwright install chromium
 *   python3 -m http.server 8777 &
 *   node test/layout-density.playwright.js
 *   npm uninstall --no-save playwright
 *
 * THIS FILE'S ASSERTION WAS DELIBERATELY REVERSED. It first checked that
 * an empty play card was much SHORTER than a populated one, which was the
 * right fix for the dead-box bug (invisible reserved blocks stacking up and
 * stranding the roll button at the bottom of a tall box). Real feedback on
 * that result: "try to keep the right container a consistent height, rather
 * than changing as the internal content changes" — the card resizing on
 * every phase was its own distraction.
 *
 * Both are now satisfied, because they were never the same claim:
 *   - The CONTAINER is a stable frame whose height comes from the viewport,
 *     with its content vertically centred. That is what this file checks.
 *   - The CONTENT does not reserve space for phases the player hasn't
 *     reached. That is what test/layout-stability.test.js checks, by
 *     counting blocks actually in flow — and it is what stops the stable
 *     frame from being the old dead box wearing a new name.
 *
 * So: empty and populated heights must now MATCH (within a pixel or two of
 * rounding), and the frame must genuinely track the viewport rather than
 * being a hardcoded height.
 */
'use strict';

const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8777/';

// Each entry: how to start the game, how to reach the populated state, and
// which card is being measured. `maxEmptyRatio` is the ceiling on
// empty-height / populated-height — a card at 0.95 is the bug.
// `container` is the frame that must stay a consistent height.
const CASES = [
  {
    file: 'scuttle-addition-subtraction.html', container: '.play-main > .card:not(.hidden)',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#roll-btn'); await page.waitForTimeout(800); },
  },
  {
    file: 'scuttle-product.html', container: '.play-main > .card:not(.hidden)',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#roll-btn'); await page.waitForTimeout(800); },
  },
  {
    file: 'scuttle-difference.html', container: '.play-main > .card:not(.hidden)',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#roll-btn'); await page.waitForTimeout(800); },
  },
  {
    file: 'nim.html', container: '#screen-game',
    start: () => document.getElementById('start-btn').click(),
    populate: async (page) => { await page.click('#move-row button:not(:disabled)'); await page.waitForTimeout(300); },
  },
  {
    file: 'beeline-product.html', container: '.game-play-col',
    start: () => document.getElementById('start-btn').click(),
    // Placing both tokens opens the answer-check area in the play column.
    populate: async (page) => {
      await page.evaluate(() => { const n = document.querySelectorAll('#operand-row .op-num'); n[3].click(); n[6].click(); });
      await page.waitForTimeout(500);
    },
  },
];

(async () => {
  const browser = await chromium.launch();
  const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1280, height: 900 }];
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`${e.message}`));
    console.log(`\n  viewport ${vp.width}x${vp.height}`);

    for (const c of CASES) {
      errors.length = 0;
      await page.goto(BASE + c.file);
      await page.waitForTimeout(300);
      await page.evaluate(c.start);
      await page.waitForTimeout(300);

      const h = async () => page.evaluate(sel => {
        const n = document.querySelector(sel);
        return n ? Math.round(n.getBoundingClientRect().height) : -1;
      }, c.container);

      const empty = await h();
      await c.populate(page);
      const populated = await h();

      // 2px of tolerance for sub-pixel rounding, nothing more — the point
      // is that the frame does not resize with its contents at all.
      const drift = Math.abs(empty - populated);
      const ok = empty > 0 && populated > 0 && drift <= 2;
      if (!ok) failures++;
      console.log(`    ${ok ? '✅' : '❌'} ${c.file.padEnd(36)} ${c.container} empty ${String(empty).padStart(4)}px, populated ${String(populated).padStart(4)}px (drift ${drift}px)`);
      if (!ok && empty > 0 && populated > 0) {
        console.log(`       the container resizes with its contents — it should be a stable frame with content centred inside it`);
      }
      if (errors.length) { failures++; console.log(`       ❌ page errors: ${errors.join(' | ')}`); }
    }
    await ctx.close();
  }

  // The frame must track the VIEWPORT, or "consistent height" would just be
  // a hardcoded number that breaks on a different screen.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'scuttle-addition-subtraction.html');
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('start-btn').click());
  await page.waitForTimeout(300);
  const short = await page.evaluate(() => Math.round(document.querySelector('.play-main > .card:not(.hidden)').getBoundingClientRect().height));
  await page.setViewportSize({ width: 1280, height: 1040 });
  await page.waitForTimeout(300);
  const tall = await page.evaluate(() => Math.round(document.querySelector('.play-main > .card:not(.hidden)').getBoundingClientRect().height));
  const grows = tall > short + 100;
  if (!grows) failures++;
  console.log(`\n  ${grows ? '✅' : '❌'} scuttle frame tracks the viewport: ${short}px at 760px tall -> ${tall}px at 1040px tall`);
  await ctx.close();

  // ---- 1024x600 ZERO-SCROLL FLOOR ----------------------------------
  // The design floor: a landscape small tablet. Nothing may scroll, in
  // either axis, on any game page — settings, play, or mid-round. This is
  // the acceptance test for the fluid spacing/type work; before it, 13/13
  // pages overflowed and "Start game" sat below the fold on 8 of them.
  const FLOOR_PAGES = [
    'scuttle-addition-subtraction.html', 'scuttle-product.html', 'scuttle-difference.html',
    'pop-addition.html', 'pop-subtraction.html', 'pop-expression.html', 'pop-perimeter.html',
    'beeline-product.html', 'beeline-difference.html', 'beeline-addition.html',
    'beeline-decimal.html', 'beeline-rounding.html', 'beeline-equivalent-fraction.html',
    'nim.html', 'nim-subtraction.html', 'nim-nickeled-and-dimed.html',
    'numbo-operations.html', 'detective-fraction-equivalence.html',
  ];
  const floorCtx = await browser.newContext({ viewport: { width: 1024, height: 600 } });
  const fp = await floorCtx.newPage();
  const ferr = [];
  fp.on('pageerror', e => ferr.push(e.message));
  console.log('\n  1024x600 zero-scroll floor');
  const scrollAmounts = () => fp.evaluate(() => {
    const a = document.getElementById('app');
    const d = document.documentElement;
    return {
      v: Math.max(0, a.scrollHeight - a.clientHeight, d.scrollHeight - d.clientHeight),
      h: Math.max(0, d.scrollWidth - d.clientWidth),
    };
  });
  for (const f of FLOOR_PAGES) {
    ferr.length = 0;
    await fp.goto(BASE + f);
    await fp.waitForTimeout(280);
    const settings = await scrollAmounts();
    // Is the primary action reachable without scrolling?
    const startInView = await fp.evaluate(() => {
      const b = document.getElementById('start-btn');
      if (!b) return true; // single-player game with no settings step
      return b.getBoundingClientRect().bottom <= window.innerHeight;
    });
    await fp.click('#start-btn').catch(() => {});
    await fp.waitForTimeout(320);
    const play = await scrollAmounts();
    await fp.click('#roll-btn').catch(() => {});
    await fp.waitForTimeout(820);
    const mid = await scrollAmounts();
    const worstV = Math.max(settings.v, play.v, mid.v);
    const worstH = Math.max(settings.h, play.h, mid.h);
    const good = worstV === 0 && worstH === 0 && startInView && !ferr.length;
    if (!good) failures++;
    console.log(`    ${good ? '✅' : '❌'} ${f.padEnd(36)} scroll v=${worstV} h=${worstH} startInView=${startInView}${ferr.length ? ' ERR ' + ferr[0] : ''}`);
  }
  await floorCtx.close();

  await browser.close();
  if (failures) {
    console.error(`\n  ${failures} case(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log('\n  all play-container consistency cases passed');
  }
})();
