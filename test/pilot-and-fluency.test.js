/*
 * PILOT MODE + fluency-view checks.
 *
 * Covers the hardcoded UI demonstration of
 * design/fluency-tracking-design-plan.md's two-bucket model:
 *   - every game and variant locked except the two pilot exceptions,
 *     cascaded through all four nav surfaces;
 *   - Product Beeline's FACTS view (a 9x9 per-fact mastery grid);
 *   - Addition & Subtraction Scuttle's PROCEDURES view (a taxonomy of
 *     three sub-skills, exactly one marked as this game's evidence).
 *
 * Everything here DERIVES its expectations from the live PILOT_MODE flag
 * via pilotModeOn()/pilotUnlockedHrefs(), so flipping the flag back is a
 * one-line change and not a test rewrite. With the flag off, the lock
 * assertions become vacuous by construction and the fluency-view
 * assertions still hold.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage } = require('./jsdom-helpers');

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass || !detail ? '' : ` — ${detail}`}`);
}

// Every real game file in the project; anything not in the unlocked list
// must be unreachable while the pilot is on.
const ALL_GAME_FILES = [
  'scuttle-addition-subtraction.html', 'scuttle-product.html', 'scuttle-difference.html',
  'pop-addition.html', 'pop-subtraction.html', 'pop-expression.html', 'pop-perimeter.html',
  'beeline-product.html', 'beeline-difference.html', 'beeline-addition.html',
  'beeline-decimal.html', 'beeline-rounding.html', 'beeline-equivalent-fraction.html',
  'nim.html', 'nim-nickeled-and-dimed.html', 'nim-subtraction.html',
  'numbo-operations.html', 'detective-fraction-equivalence.html',
];

const flagDom = loadGame('index.html');
const PILOT = runInPage(flagDom, () => ({ on: pilotModeOn(), hrefs: pilotUnlockedHrefs() }));
const LOCKED = ALL_GAME_FILES.filter(f => PILOT.hrefs.indexOf(f) === -1);

console.log(`\n  pilot mode: ${PILOT.on ? 'ON' : 'OFF'} — unlocked: ${PILOT.hrefs.join(', ')}`);

/* ---------------- 1. No route to a locked game, anywhere -----------------
   The strongest form of "can't navigate to it": collect every anchor with
   an href on each nav surface and assert none of them resolves to a locked
   game file. This catches a lock missed on ANY surface — the hub grid, a
   variant sublist, the nav dropdown, a hand-written sub-menu card, or the
   in-game variant switcher — without needing a separate assertion per
   surface, and it keeps working if a new surface is added later. */
const NAV_PAGES = [
  'index.html',
  'scuttle-menu.html', 'pop-menu.html', 'nim-menu.html', 'beeline-menu.html',
  'scuttle-addition-subtraction.html', 'beeline-product.html',
];
NAV_PAGES.forEach(page => {
  const dom = loadGame(page);
  const hrefs = runInPage(dom, () => {
    // Expand every disclosure first, or a sublist's links never render.
    document.querySelectorAll('.variant-expand-toggle').forEach(t => t.click());
    return Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
  });
  const leaks = hrefs.filter(h => LOCKED.indexOf(h) !== -1);
  check(`${page}: no link anywhere routes to a locked game`,
    !PILOT.on || leaks.length === 0, `reachable: ${leaks.join(', ')}`);
});

/* Both pilot games must still be reachable — a lock that also locks the
   exceptions would pass the check above and be completely useless. */
{
  const dom = loadGame('index.html');
  const hrefs = runInPage(dom, () => {
    document.querySelectorAll('.variant-expand-toggle').forEach(t => t.click());
    return Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
  });
  PILOT.hrefs.forEach(h => {
    check(`index.html: the pilot game ${h} is still reachable`, hrefs.indexOf(h) !== -1,
      `hub links: ${hrefs.join(', ')}`);
  });
}

/* ---------------- 2. Locked things are inert, not just unstyled --------- */
{
  const dom = loadGame('index.html');
  const r = runInPage(dom, () => {
    document.querySelectorAll('.variant-expand-toggle').forEach(t => t.click());
    const card = (name) => Array.from(document.querySelectorAll('#game-grid .variant-card'))
      .find(c => (c.querySelector('.variant-name') || {}).textContent === name);
    const summarise = (c) => c && ({
      tag: c.tagName, locked: c.classList.contains('locked'),
      ariaDisabled: c.getAttribute('aria-disabled'),
      anchors: c.querySelectorAll('a[href]').length,
      sublinksWithHref: c.querySelectorAll('.variant-sublink[href]').length,
      sublinksTotal: c.querySelectorAll('.variant-sublink').length,
    });
    return { pop: summarise(card('Pop')), nim: summarise(card('Nim')), scuttle: summarise(card('Scuttle')) };
  });
  if (PILOT.on) {
    ['pop', 'nim'].forEach(k => {
      check(`index.html: the ${k} card is fully locked (no anchors at all)`,
        r[k] && r[k].locked === true && r[k].ariaDisabled === 'true' && r[k].anchors === 0,
        JSON.stringify(r[k]));
    });
    check('index.html: Scuttle lists all 3 variants but only the pilot one is a link',
      r.scuttle && r.scuttle.sublinksTotal === 3 && r.scuttle.sublinksWithHref === 1,
      JSON.stringify(r.scuttle));
  }
}

// The in-game variant switcher is its own nav surface.
{
  const dom = loadGame('scuttle-addition-subtraction.html');
  const r = runInPage(dom, () => {
    const chips = Array.from(document.querySelectorAll('#variant-row > *'));
    return chips.map(c => ({ tag: c.tagName, cls: c.className, href: c.getAttribute('href') }));
  });
  const links = r.filter(c => c.href);
  check('scuttle add/sub: in-game variant chips expose no link to a locked sibling',
    !PILOT.on || links.length === 0, JSON.stringify(r));
  check('scuttle add/sub: locked siblings are still SHOWN (family shape stays visible)',
    r.length === 3, JSON.stringify(r));
}

// The hand-written sub-menu pages are the surface the GLOBAL_GAMES
// transform cannot reach, so they get their own explicit check.
{
  const dom = loadGame('scuttle-menu.html');
  const r = runInPage(dom, () => ({
    productLinks: document.querySelectorAll('a.variant-card[href="scuttle-product.html"]').length,
    addSubLinks: document.querySelectorAll('a.variant-card[href="scuttle-addition-subtraction.html"]').length,
    lockedCards: document.querySelectorAll('.variant-card.locked').length,
  }));
  check('scuttle-menu.html: Product Scuttle is locked inside the sub-menu too',
    !PILOT.on || r.productLinks === 0, JSON.stringify(r));
  check('scuttle-menu.html: Addition & Subtraction is still playable there',
    r.addSubLinks === 1, JSON.stringify(r));
}

/* Section headings must still group correctly. GLOBAL_GAMES happened to be
   ordered playable-first, so the grid emitted its headings inline — until
   pilot mode locked families in the MIDDLE of the list and left a
   still-playable Beeline sitting under "Coming soon". */
{
  const dom = loadGame('index.html');
  const r = runInPage(dom, () => {
    const out = [];
    let head = null;
    document.querySelectorAll('#game-grid > *').forEach(n => {
      if (n.classList.contains('menu-section-head')) head = n.textContent;
      else out.push({ head, locked: n.classList.contains('locked') });
    });
    return out;
  });
  const misfiled = r.filter(x => (x.head === 'Coming soon') !== x.locked);
  check('index.html: every card sits under the heading that matches its state',
    misfiled.length === 0, JSON.stringify(r));
}

/* ---------------- 3. The two exceptions still WORK as games ------------- */
{
  const dom = loadGame('scuttle-addition-subtraction.html');
  const r = runInPage(dom, () => {
    el('target-input').value = '500';
    el('start-btn').click();
    const onRound = !document.getElementById('screen-round').classList.contains('hidden');
    el('roll-btn').click();
    return { onRound, rolling: !document.getElementById('dice-row').classList.contains('hidden') };
  });
  check('scuttle add/sub still plays: start -> round screen -> dice roll',
    r.onRound === true && r.rolling === true, JSON.stringify(r));
}
{
  const dom = loadGame('beeline-product.html');
  const r = runInPage(dom, () => {
    el('start-btn').click();
    const onGame = !document.getElementById('screen-game').classList.contains('hidden');
    const nums = document.querySelectorAll('#operand-row .op-num');
    nums[3].click(); nums[6].click();
    return { onGame, cells: nums.length, pending: !!st.pendingMove || !!st.tokens };
  });
  check('beeline product still plays: start -> board -> both tokens placed',
    r.onGame === true && r.cells === 9 && r.pending === true, JSON.stringify(r));
}

/* ---------------- 4. FACTS view (Product Beeline) ---------------------- */
{
  const dom = loadGame('beeline-product.html');
  const r = runInPage(dom, () => {
    document.getElementById('stats-launcher').click();
    const open = document.querySelector('.skill-row.open');
    const cells = Array.from(document.querySelectorAll('.fact-cell'));
    const values = cells.map(c => c.textContent).filter(t => t !== '–').map(Number);
    const bands = {};
    cells.forEach(c => {
      const b = (c.className.match(/band-(\w+)/) || [])[1];
      bands[b] = (bands[b] || 0) + 1;
    });
    return {
      openSkill: open && open.dataset.skill,
      title: open && open.querySelector('.skill-title').textContent,
      headline: open && open.querySelector('.skill-pct').textContent,
      cells: cells.length,
      heads: document.querySelectorAll('.fact-head').length,
      firstFact: cells[0] && cells[0].dataset.fact,
      lastFact: cells[cells.length - 1] && cells[cells.length - 1].dataset.fact,
      bands,
      distinctValues: new Set(values).size,
      min: Math.min.apply(null, values), max: Math.max.apply(null, values),
      mean: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    };
  });
  check('beeline product: the stats launcher opens with Multiplication Facts expanded',
    r.openSkill === 'mult-facts' && r.title === 'Multiplication Facts', JSON.stringify(r));
  // 9x9 because Product Beeline's own token row is ROWMIN=1..ROWMAX=9 —
  // the facts this board can actually produce, not a generic 10x10.
  check('beeline product: the fact grid is exactly 9x9, spanning 1x1 to 9x9',
    r.cells === 81 && r.firstFact === '1x1' && r.lastFact === '9x9', JSON.stringify(r));
  check('beeline product: the grid has row and column headers (1 corner + 9 + 9)',
    r.heads === 19, JSON.stringify(r));
  // The point of a facts view is seeing WHICH facts are weak, so the data
  // must actually vary and must use more than one mastery band.
  check('beeline product: mastery values vary and span several bands (not a flat placeholder)',
    r.distinctValues >= 20 && Object.keys(r.bands).length >= 4, JSON.stringify(r));
  check('beeline product: "not practised yet" is its own band, distinct from a low score',
    (r.bands.none || 0) > 0, JSON.stringify(r.bands));
  // The headline must be derived from the cells, never stored beside them.
  check('beeline product: the headline score equals the mean of the graded cells',
    r.headline === r.mean + '%', `headline ${r.headline} vs cell mean ${r.mean}%`);
}

/* ---------------- 5. PROCEDURES view (Scuttle Add/Sub) ----------------- */
{
  const dom = loadGame('scuttle-addition-subtraction.html');
  const r = runInPage(dom, () => {
    document.getElementById('stats-launcher').click();
    const open = document.querySelector('.skill-row.open');
    const rows = Array.from(open.querySelectorAll('.subskill-row'));
    return {
      openSkill: open && open.dataset.skill,
      title: open && open.querySelector('.skill-title').textContent,
      headline: open && open.querySelector('.skill-pct').textContent,
      names: rows.map(x => x.dataset.subskill),
      scores: rows.map(x => x.querySelector('.subskill-score').textContent),
      attempts: rows.map(x => Number((x.querySelector('.subskill-n').textContent || '').replace(/\D/g, ''))),
      evidence: rows.filter(x => x.classList.contains('has-evidence')).map(x => x.dataset.subskill),
      badges: open.querySelectorAll('.subskill-evidence-badge').length,
      hasFactGrid: !!open.querySelector('.fact-grid'),
    };
  });
  check('scuttle add/sub: the stats launcher opens with the procedures skill expanded',
    r.openSkill === 'add-sub-large' && r.title === 'Addition and Subtraction of Larger Numbers',
    JSON.stringify(r));
  check('scuttle add/sub: exactly three sub-skill rows, in taxonomy order',
    JSON.stringify(r.names) === JSON.stringify(['Addition', 'Subtraction', 'Multi-step problems']),
    JSON.stringify(r.names));
  // The single most important thing this view communicates.
  check('scuttle add/sub: EXACTLY ONE row is marked as this game\'s evidence, and it is Multi-step',
    r.evidence.length === 1 && r.evidence[0] === 'Multi-step problems' && r.badges === 1,
    JSON.stringify(r));
  check('scuttle add/sub: the mark is a visible badge on the row, not just a tooltip',
    r.badges === 1, JSON.stringify(r));
  check('scuttle add/sub: each sub-skill carries its own distinct score',
    new Set(r.scores).size === 3, JSON.stringify(r.scores));
  // A procedures skill must not render a facts grid — different bucket,
  // different data model (see the design plan).
  check('scuttle add/sub: a procedures skill renders no fact grid',
    r.hasFactGrid === false, JSON.stringify(r));
  // Attempts-weighted, so a sub-skill with more evidence moves it more.
  const expected = Math.round(
    (79 * r.attempts[0] + 61 * r.attempts[1] + 52 * r.attempts[2]) /
    (r.attempts[0] + r.attempts[1] + r.attempts[2]));
  check('scuttle add/sub: the headline is the attempts-weighted mean of its sub-skills',
    r.headline === expected + '%', `headline ${r.headline}, expected ${expected}%`);
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all pilot + fluency cases passed`);
}
