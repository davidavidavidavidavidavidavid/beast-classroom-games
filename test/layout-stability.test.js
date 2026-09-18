/*
 * Layout-stability regression test — see CLAUDE.md "Layout stability".
 *
 * REWRITTEN for the corrected rule. The previous version of this file
 * asserted that within-round phase content NEVER carries `.hidden`, which
 * encoded the over-broad reading of the rule and actively locked in the
 * bug: every game's round card reserved space for its entire eventual
 * lifecycle from first paint, so an empty pre-roll card was a ~290px dead
 * box with one lone button floating at the bottom of it.
 *
 * The corrected rule (CLAUDE.md has the full statement): reserve space
 * (`.phase-hidden`) only for content that appears WHILE the player is
 * working inside the phase it belongs to. Content belonging to a LATER
 * phase uses `.hidden` + `showPhaseBlock()`. It cuts both ways — Scuttle
 * and Nim were over-reserving, Pop was under-reserving.
 *
 * Four things are checked:
 *   1. The static CSS contract that `.hidden`/`.phase-hidden` depend on.
 *   2. Every row that DOES reserve still declares a min-height — including
 *      Pop's shared die, whose min-height sat dead behind a `.hidden`.
 *   3. EMPTY-STATE DENSITY — the new one, and the one that would have
 *      caught the reported regression: a play card in its pre-action state
 *      must occupy MEANINGFULLY fewer layout boxes than when populated.
 *   4. Per-phase expectations, so a future "fix" can't cure a jump by
 *      re-reserving a later phase.
 *
 * On (3), and what jsdom can honestly prove: jsdom has no layout engine
 * (getBoundingClientRect is always 0), so it cannot measure pixel height.
 * It CAN count how many phase blocks are actually IN FLOW, which is the
 * direct cause of that height — a block inside a `display:none` subtree
 * contributes nothing, one that is merely `visibility:hidden` contributes
 * its whole box. "Empty state has 1 box in flow, populated has 4" is a
 * real structural statement about height, not a restatement of the class
 * names. The actual pixel measurement lives in
 * test/layout-density.playwright.js, which needs a real browser and is run
 * by hand (CLAUDE.md Testing methodology point 8).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

let failures = 0;
function ok(label) { console.log(`  ✅ ${label}`); }
function fail(label, err) { failures++; console.log(`  ❌ ${label} — ${err.message}`); }

/* ---------------- 1. static CSS guard ---------------- */
function checkDesignSystemCss() {
  const css = fs.readFileSync(path.join(__dirname, '..', 'design-system.css'), 'utf8');
  const hiddenRule = css.match(/\.hidden\s*\{([^}]*)\}/);
  const phaseHiddenRule = css.match(/\.phase-hidden\s*\{([^}]*)\}/);
  assert.ok(hiddenRule, 'design-system.css should still define .hidden');
  assert.ok(phaseHiddenRule, 'design-system.css should define .phase-hidden');
  assert.ok(/display\s*:\s*none/.test(hiddenRule[1]), '.hidden should be display:none (later-phase content, real removal from flow)');
  assert.ok(/visibility\s*:\s*hidden/.test(phaseHiddenRule[1]), '.phase-hidden should be visibility:hidden (reserves layout space)');
  assert.ok(!/display\s*:\s*none/.test(phaseHiddenRule[1]), '.phase-hidden must not also set display:none, or it stops reserving space');
  ok('design-system.css: .hidden = display:none, .phase-hidden = visibility:hidden');
}

/* ---------------- 2. rows that DO reserve must declare a height ----------
   A .phase-hidden element only reserves the space its CONTENT takes up, so
   a wrapper that's empty in the markup until JS fills it reserves nothing
   and the jump comes straight back. #slots-row is here because it actually
   shipped without one (Scuttle's card grew 375px -> 431px on first roll).
   Pop's #current-digit-wrap is here because its min-height sat dead behind
   a `.hidden` that beat it — the under-reserving half of the same rule. */
function checkReservingRowsDeclareHeight() {
  const dice = fs.readFileSync(path.join(__dirname, '..', 'components', 'dice-slot.css'), 'utf8');
  [
    ['#dice-row', 74, '.die-wrap is 72px tall'],
    ['#slots-row', 56, '.slot is 56px tall'],
  ].forEach(([sel, min, why]) => {
    const rule = dice.match(new RegExp(sel + '\\s*\\{([^}]*)\\}'));
    assert.ok(rule, `components/dice-slot.css should define ${sel}`);
    const m = rule[1].match(/min-height\s*:\s*(\d+)px/);
    assert.ok(m, `${sel} must declare a min-height — it is empty in the markup until JS fills it (${why})`);
    assert.ok(Number(m[1]) >= min, `${sel}'s min-height should be at least ${min}px (${why}), got ${m[1]}px`);
  });
  ok('components/dice-slot.css: JS-populated rows reserve their height up front');

  ['pop-addition.html', 'pop-subtraction.html', 'pop-expression.html', 'pop-perimeter.html'].forEach(file => {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const rule = src.match(/#current-digit-wrap\s*\{([^}]*)\}/);
    assert.ok(rule, `${file} should style #current-digit-wrap`);
    const m = rule[1].match(/min-height\s*:\s*(\d+)px/);
    assert.ok(m && Number(m[1]) >= 74,
      `${file}: #current-digit-wrap must declare min-height >= 74px — it is the shared die's reserved slot, and without it the card jumps on every roll`);
    const tag = src.match(/<div[^>]*id="current-digit-wrap"[^>]*>/);
    assert.ok(tag, `${file} should contain #current-digit-wrap`);
    // Exact class-token match, not a substring/\b test — `\bhidden\b`
    // matches INSIDE "phase-hidden" (the hyphen is a word boundary), which
    // made this assertion fire on the correct markup.
    const classAttr = (tag[0].match(/class="([^"]*)"/) || [, ''])[1];
    assert.ok(!classAttr.split(/\s+/).includes('hidden'),
      `${file}: #current-digit-wrap must not use .hidden — the shared die appears and disappears on every roll while the player stays on the same screen, so its space must stay reserved (and .hidden makes that min-height dead code)`);
  });
  ok('pop-*.html: the shared die reserves its slot (min-height live, not behind display:none)');
}

/* ---------------- 3. empty-state density ---------------------------------
   Counts how many of a card's phase blocks are actually IN FLOW. Runs
   inside the page, so `ids` is passed as an arg. */
function inFlowCount(ids) {
  const occupies = (n) => {
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      if (e.classList && e.classList.contains('hidden')) return false;
    }
    return true;
  };
  return ids.filter(id => {
    const n = document.getElementById(id);
    return n && occupies(n);
  }).length;
}

async function checkDensity(spec) {
  const dom = loadGame(spec.file);
  runInPage(dom, spec.start);
  await sleep(60);

  const empty = runInPage(dom, inFlowCount, spec.ids);
  await spec.populate(dom);
  const populated = runInPage(dom, inFlowCount, spec.ids);

  assert.ok(empty < populated,
    `${spec.file}: the empty ${spec.card} should hold FEWER layout boxes than the populated one — got ${empty} empty vs ${populated} populated. ` +
    `Equal counts mean the card reserves its whole eventual lifecycle up front, which is the dead-box regression this test exists for.`);
  assert.ok(empty <= spec.maxEmpty,
    `${spec.file}: the empty ${spec.card} should hold at most ${spec.maxEmpty} layout box(es) — it should be sized to the one control the player can actually use — got ${empty}`);
  ok(`${spec.file}: empty ${spec.card} holds ${empty} layout box(es) vs ${populated} populated`);
}

const SCUTTLE_ROLL = async (dom) => { runInPage(dom, () => { el('roll-btn').click(); }); await sleep(700); };
const NIM_MOVE = async (dom) => {
  runInPage(dom, () => { document.querySelector('#move-row button:not(:disabled)').click(); });
  await sleep(60);
};

const DENSITY_CASES = [
  {
    file: 'scuttle-addition-subtraction.html', card: '#screen-round',
    ids: ['roll-btn-wrap', 'dice-row', 'slots-wrap', 'lock-wrap', 'next-round-wrap'],
    start: () => { el('target-input').value = '500'; el('start-btn').click(); },
    populate: SCUTTLE_ROLL, maxEmpty: 1,
  },
  {
    file: 'scuttle-product.html', card: '#screen-round',
    ids: ['roll-btn-wrap', 'dice-row', 'frames-wrap', 'product-check-wrap', 'next-round-wrap'],
    start: () => { el('start-btn').click(); },
    populate: SCUTTLE_ROLL, maxEmpty: 1,
  },
  {
    file: 'scuttle-difference.html', card: '#screen-round',
    ids: ['roll-btn-wrap', 'dice-row', 'frames-wrap', 'diff-check-wrap', 'next-round-wrap'],
    start: () => { el('start-btn').click(); },
    populate: SCUTTLE_ROLL, maxEmpty: 1,
  },
  {
    file: 'nim.html', card: '#screen-game', ids: ['answer-area'],
    start: () => { el('start-btn').click(); }, populate: NIM_MOVE, maxEmpty: 0,
  },
  {
    file: 'nim-subtraction.html', card: '#screen-game', ids: ['answer-area'],
    start: () => { el('start-btn').click(); }, populate: NIM_MOVE, maxEmpty: 0,
  },
  {
    file: 'nim-nickeled-and-dimed.html', card: '#screen-game', ids: ['answer-area'],
    start: () => { el('start-btn').click(); }, populate: NIM_MOVE, maxEmpty: 0,
  },
];

/* ---------------- 4. per-phase expectations ------------------------------ */
function classState(ids) {
  const out = {};
  ids.forEach(id => {
    const n = document.getElementById(id);
    out[id] = n ? { hidden: n.classList.contains('hidden'), phaseHidden: n.classList.contains('phase-hidden') } : null;
  });
  return out;
}

async function checkScuttleAddSubPhases() {
  const dom = loadGame('scuttle-addition-subtraction.html');
  const IDS = ['roll-btn-wrap', 'dice-row', 'slots-wrap', 'lock-wrap', 'next-round-wrap'];
  runInPage(dom, () => {
    document.querySelector('.chip-row [data-diff="hard"]').click();
    el('target-input').value = '500';
    el('start-btn').click();
  });

  let s = runInPage(dom, classState, IDS);
  assert.strictEqual(s['roll-btn-wrap'].phaseHidden, false, 'pre-roll: the roll button is visible');
  ['dice-row', 'slots-wrap', 'lock-wrap', 'next-round-wrap'].forEach(id => {
    assert.strictEqual(s[id].hidden, true,
      `pre-roll: #${id} belongs to a later phase and must be removed from flow, not reserved — reserving it is what produced the dead box`);
  });

  runInPage(dom, () => { el('roll-btn').click(); });
  await sleep(700);
  s = runInPage(dom, classState, IDS);
  assert.strictEqual(s['dice-row'].hidden, false, 'after roll: the dice row is in flow');
  assert.strictEqual(s['slots-wrap'].hidden, false, 'after roll: the slots are in flow');
  assert.strictEqual(s['lock-wrap'].hidden, false, 'after roll: the lock button is in flow');
  assert.strictEqual(s['next-round-wrap'].hidden, true, 'after roll: next-round still belongs to a later phase');
  // The roll button stays RESERVED rather than removed while the dice spin:
  // it shares one .action-stack grid cell with Lock and Next, and for the
  // ~500ms before Lock appears it is the only thing holding that cell open.
  // This is the correct use of .phase-hidden, pinned here so a future
  // cleanup doesn't "simplify" it into a collapsing stack.
  assert.strictEqual(s['roll-btn-wrap'].phaseHidden, true, 'after roll: the roll button is reserved, holding the action-stack cell');
  assert.strictEqual(s['roll-btn-wrap'].hidden, false, 'after roll: the roll button must NOT be display:none, or the action stack collapses mid-spin');
  ok('scuttle-addition-subtraction.html: phase blocks enter the layout only when their phase begins');
}

async function checkNimPhases() {
  const dom = loadGame('nim.html');
  runInPage(dom, () => { el('start-btn').click(); });
  let s = runInPage(dom, classState, ['answer-area']);
  assert.strictEqual(s['answer-area'].hidden, true,
    'nim: the answer area belongs to the awaiting-answer phase and must not reserve ~145px from first paint');
  await NIM_MOVE(dom);
  s = runInPage(dom, classState, ['answer-area']);
  assert.strictEqual(s['answer-area'].hidden, false, 'nim: the answer area enters the layout once a move is pending');
  ok('nim.html: the answer area enters the layout only once a move is pending');
}

/* ---------------- run ---------------- */
async function main() {
  try { checkDesignSystemCss(); } catch (e) { fail('static CSS guard', e); }
  try { checkReservingRowsDeclareHeight(); } catch (e) { fail('reserving rows declare a height', e); }
  for (const spec of DENSITY_CASES) {
    try { await checkDensity(spec); } catch (e) { fail(`${spec.file} empty-state density`, e); }
  }
  try { await checkScuttleAddSubPhases(); } catch (e) { fail('scuttle-addition-subtraction phases', e); }
  try { await checkNimPhases(); } catch (e) { fail('nim phases', e); }

  if (failures > 0) {
    console.error(`\n  ${failures} case(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log('\n  all layout-stability cases passed');
  }
}

main();
