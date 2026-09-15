/*
 * Site-wide structural checks — cross-cutting concerns that don't belong
 * in any single game's own smoke test: every file's H1 (CLAUDE.md Design
 * system conventions: "the H1 is never a hardcoded placeholder copied from
 * another game"), the global navigation bar (CLAUDE.md "Global
 * navigation"), the hub's boot sequence (CLAUDE.md "Boot sequence"), and
 * the hub/sub-menu cards' single-vs-multi-variant link rule.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage } = require('./jsdom-helpers');

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass || !detail ? '' : ` — ${detail}`}`);
}

/* ---------------- H1 audit — one explicit assertion per file ----------------
   Exactly the bug CLAUDE.md's new Design system conventions rule guards
   against: a game's H1 silently left over from whatever file it was
   copied from as a template. Covers every real game page plus each game
   family's own sub-menu (which names the FAMILY, e.g. "SCUTTLE"/"POP" —
   not a variant) — index.html is checked separately below since its H1
   is the umbrella "BEAST" logo, not a single game's name. */
const H1_EXPECTED = {
  'scuttle-addition-subtraction.html': 'SCUTTLE',
  'scuttle-product.html': 'SCUTTLE',
  'scuttle-difference.html': 'SCUTTLE',
  'pop-addition.html': 'POP',
  'pop-subtraction.html': 'POP',
  'pop-expression.html': 'POP',
  'pop-perimeter.html': 'POP',
  'beeline-product.html': 'BEELINE',
  'beeline-difference.html': 'BEELINE',
  'beeline-addition.html': 'BEELINE',
  'beeline-decimal.html': 'BEELINE',
  'beeline-rounding.html': 'BEELINE',
  'beeline-equivalent-fraction.html': 'BEELINE',
  'nim.html': 'NIM',
  'nim-nickeled-and-dimed.html': 'NIM',
  'nim-subtraction.html': 'NIM',
  'numbo-operations.html': 'NUMBO',
  'detective-fraction-equivalence.html': 'DETECTIVE',
  'scuttle-menu.html': 'SCUTTLE',
  'pop-menu.html': 'POP',
  'nim-menu.html': 'NIM',
  'beeline-menu.html': 'BEELINE',
};

Object.entries(H1_EXPECTED).forEach(([file, expected]) => {
  const dom = loadGame(file);
  const h1 = runInPage(dom, () => document.querySelector('h1').textContent);
  check(`${file}: <h1> reads "${expected}"`, h1 === expected, `got "${h1}"`);
});

{
  const dom = loadGame('index.html');
  const h1 = runInPage(dom, () => document.querySelector('h1').textContent);
  check('index.html: <h1> reads the umbrella brand "BEAST 64" (the hub, not a single game)', h1 === 'BEAST 64', `got "${h1}"`);
}

/* ---------------- global nav bar — renders correctly on every page ---------------- */
const NAV_EXPECTED_CURRENT = {
  'scuttle-addition-subtraction.html': 'Scuttle',
  'scuttle-product.html': 'Scuttle',
  'scuttle-difference.html': 'Scuttle',
  'scuttle-menu.html': 'Scuttle',
  'pop-addition.html': 'Pop',
  'pop-subtraction.html': 'Pop',
  'pop-expression.html': 'Pop',
  'pop-perimeter.html': 'Pop',
  'pop-menu.html': 'Pop',
  'beeline-product.html': 'Beeline',
  'beeline-difference.html': 'Beeline',
  'beeline-addition.html': 'Beeline',
  'beeline-decimal.html': 'Beeline',
  'beeline-rounding.html': 'Beeline',
  'beeline-equivalent-fraction.html': 'Beeline',
  'beeline-menu.html': 'Beeline',
  'nim.html': 'Nim',
  'nim-nickeled-and-dimed.html': 'Nim',
  'nim-subtraction.html': 'Nim',
  'nim-menu.html': 'Nim',
  'numbo-operations.html': 'Numbo',
  'detective-fraction-equivalence.html': 'Detective',
};
const TOTAL_CATALOGUED_GAMES = 8; // 6 playable + 2 locked (Pig, Math Match — every
// other catalogued-but-unbuilt game was trimmed from GLOBAL_GAMES at the
// user's explicit direction, 2026-09-15) — see shared-game.js GLOBAL_GAMES

Object.entries(NAV_EXPECTED_CURRENT).forEach(([file, currentLabel]) => {
  const dom = loadGame(file);
  const nav = runInPage(dom, () => {
    const items = Array.from(document.querySelectorAll('.global-nav-item')).map(el => ({
      tag: el.tagName, href: el.getAttribute('href'), current: el.classList.contains('current'),
    }));
    return {
      isFirstChild: document.body.firstElementChild && document.body.firstElementChild.id === 'global-nav',
      wordmarkHref: document.getElementById('global-nav-wordmark').getAttribute('href'),
      currentLabelText: document.getElementById('global-nav-current').textContent,
      dropdownHiddenInitially: document.getElementById('global-nav-dropdown').classList.contains('hidden'),
      itemCount: items.length,
      currentCount: items.filter(i => i.current).length,
    };
  });

  check(`${file}: #global-nav is the first element in <body> (sits above the game's own top bar)`, nav.isFirstChild);
  check(`${file}: wordmark links to index.html`, nav.wordmarkHref === 'index.html');
  check(`${file}: dropdown starts closed`, nav.dropdownHiddenInitially === true);
  check(`${file}: dropdown lists all ${TOTAL_CATALOGUED_GAMES} catalogued games (built + locked)`, nav.itemCount === TOTAL_CATALOGUED_GAMES, `got ${nav.itemCount}`);
  check(`${file}: exactly one dropdown item is marked current`, nav.currentCount === 1);
  check(`${file}: right-aligned current-game label reads "${currentLabel}"`, nav.currentLabelText === currentLabel, `got "${nav.currentLabelText}"`);
});

// Dropdown open/close behavior — checked once (mechanism is identical
// everywhere, per renderGlobalNav()'s single shared implementation).
{
  const dom = loadGame('nim.html');
  const afterToggle = runInPage(dom, () => {
    document.getElementById('global-nav-toggle').click();
    return document.getElementById('global-nav-dropdown').classList.contains('hidden');
  });
  check('clicking the "Games" toggle opens the dropdown', afterToggle === false);
  const afterOutsideClick = runInPage(dom, () => {
    document.body.click();
    return document.getElementById('global-nav-dropdown').classList.contains('hidden');
  });
  check('clicking outside the dropdown closes it again', afterOutsideClick === true);
}

// index.html itself: no single game is "current" — the right-aligned
// label should simply be omitted, not empty/wrong.
{
  const dom = loadGame('index.html');
  const hub = runInPage(dom, () => ({
    currentLabelExists: !!document.getElementById('global-nav-current'),
    itemCount: document.querySelectorAll('.global-nav-item').length,
  }));
  check('index.html: no right-aligned current-game label (this IS the hub)', hub.currentLabelExists === false);
  check(`index.html: nav dropdown still lists all ${TOTAL_CATALOGUED_GAMES} games`, hub.itemCount === TOTAL_CATALOGUED_GAMES);
}

/* ---------------- boot sequence — now lives on index.html (see CLAUDE.md
   "Boot sequence" / "Where things stand": scuttle-menu.html is Scuttle's
   own sub-menu now, not the hub) ---------------- */
{
  const dom = loadGame('index.html');
  const fresh = runInPage(dom, () => ({
    bootDisplay: document.getElementById('boot-screen').style.display,
    appVisible: document.getElementById('app').classList.contains('visible'),
    bylineText: document.getElementById('boot-byline').textContent,
    hasPresents: !!document.getElementById('boot-presents'),
    hasSeparateLogo: !!document.getElementById('boot-logo'),
    sessionFlagSet: (() => { try { return sessionStorage.getItem('beastClassroomBootSeen') === '1'; } catch (e) { return false; } })(),
  }));
  check('fresh session: boot screen is still showing (not skipped)', fresh.bootDisplay !== 'none');
  check('fresh session: hub content is not yet marked visible', fresh.appVisible === false);
  check('boot byline reads exactly "BEAST CLASSROOM" — one clean line, no duplicated/fragmented BEAST', fresh.bylineText === 'BEAST CLASSROOM', `got "${fresh.bylineText}"`);
  check('the old separate "presents" line is gone', fresh.hasPresents === false);
  check('the old separate, redundant big "BEAST" logo line is gone', fresh.hasSeparateLogo === false);
  check('a fresh session marks the session-seen flag (so a REPEAT visit this session can detect it)', fresh.sessionFlagSet === true);
}
{
  // Repeat visit: seed sessionStorage BEFORE the page's own script runs
  // (loadGame's beforeParse hook — see jsdom-helpers.js), simulating a
  // second visit to the hub within the same browser session.
  const dom = loadGame('index.html', {
    beforeParse(window) {
      try { window.sessionStorage.setItem('beastClassroomBootSeen', '1'); } catch (e) {}
    },
  });
  const repeat = runInPage(dom, () => ({
    bootDisplay: document.getElementById('boot-screen').style.display,
    appVisible: document.getElementById('app').classList.contains('visible'),
  }));
  check('repeat visit this session: boot screen is skipped (display:none) immediately, no animation', repeat.bootDisplay === 'none');
  check('repeat visit this session: hub content is immediately visible', repeat.appVisible === true);
}

/* ---------------- hub cards — navigation redesign, post-playtest ----------------
   One card per GAME, never per variant. Every playable game's card has a
   real "Play →" link straight into a real game (a single-variant game's
   own file, or a multi-variant family's default/first variant) — never a
   "choose one" menu page. A multi-variant game's card ALSO gets an
   expandable disclosure listing every sibling as its own direct link, so
   the card itself is a plain DIV (the badge is the actual link) rather
   than one big enclosing `<a>`; a single-variant/locked card is unchanged
   from before. See CLAUDE.md's navigation redesign design note. */
{
  const dom = loadGame('index.html');
  const hub = runInPage(dom, () => {
    const cards = Array.from(document.querySelectorAll('#game-grid .variant-card'));
    const byName = name => cards.find(c => c.querySelector('.variant-name').textContent === name);
    const summarize = c => c && {
      tag: c.tagName,
      href: c.getAttribute('href'),
      badge: c.querySelector('.badge').textContent,
      badgeTag: c.querySelector('.badge').tagName,
      badgeHref: c.querySelector('.badge').getAttribute('href'),
      ariaDisabled: c.getAttribute('aria-disabled'),
      toggleText: c.querySelector('.variant-expand-toggle') ? c.querySelector('.variant-expand-toggle').textContent : null,
      sublistHiddenInitially: c.querySelector('.variant-sublist') ? c.querySelector('.variant-sublist').classList.contains('hidden') : null,
      sublinks: Array.from(c.querySelectorAll('.variant-sublink')).map(a => ({ text: a.textContent, href: a.getAttribute('href') })),
    };
    return {
      totalCards: cards.length,
      scuttle: summarize(byName('Scuttle')),
      pop: summarize(byName('Pop')),
      beeline: summarize(byName('Beeline')),
      nim: summarize(byName('Nim')),
      numbo: summarize(byName('Numbo')),
      detective: summarize(byName('Detective')),
      lockedSample: summarize(byName('Pig')),
    };
  });

  check(`index.html: exactly ${TOTAL_CATALOGUED_GAMES} cards, one per game (never per variant)`, hub.totalCards === TOTAL_CATALOGUED_GAMES, `got ${hub.totalCards}`);

  [
    ['scuttle', 'scuttle-addition-subtraction.html', 3, [
      ['Addition & Subtraction', 'scuttle-addition-subtraction.html'],
      ['Product', 'scuttle-product.html'],
      ['Difference', 'scuttle-difference.html'],
    ]],
    ['pop', 'pop-addition.html', 4, [
      ['Addition', 'pop-addition.html'],
      ['Subtraction', 'pop-subtraction.html'],
      ['Expression', 'pop-expression.html'],
      ['Perimeter', 'pop-perimeter.html'],
    ]],
    ['nim', 'nim.html', 3, [
      ['Race to 10', 'nim.html'],
      ['Nickeled & Dimed', 'nim-nickeled-and-dimed.html'],
      ['Subtraction Nim', 'nim-subtraction.html'],
    ]],
    ['beeline', 'beeline-product.html', 6, [
      ['Product', 'beeline-product.html'],
      ['Difference', 'beeline-difference.html'],
      ['Addition', 'beeline-addition.html'],
      ['Decimal', 'beeline-decimal.html'],
      ['Rounding', 'beeline-rounding.html'],
      ['Equivalent Fraction', 'beeline-equivalent-fraction.html'],
    ]],
  ].forEach(([key, defaultHref, count, expectedSublinks]) => {
    const c = hub[key];
    check(`index.html: ${key} card is multi-variant — a plain DIV (not one big link)`, !!c && c.tag === 'DIV', JSON.stringify(c));
    check(`index.html: ${key} card's "Play →" badge is its own <a> straight to the default variant (${defaultHref})`, !!c && c.badgeTag === 'A' && c.badgeHref === defaultHref && c.badge === 'Play →', JSON.stringify(c));
    check(`index.html: ${key} card's expand toggle starts collapsed and labeled "▾ ${count} variants"`, !!c && c.toggleText === `▾ ${count} variants` && c.sublistHiddenInitially === true, JSON.stringify(c));
    check(`index.html: ${key} card's sublist links every variant by name+href, in family order`, !!c && JSON.stringify(c.sublinks) === JSON.stringify(expectedSublinks.map(([text, href]) => ({ text, href }))), JSON.stringify(c && c.sublinks));
  });

  [
    ['numbo', 'numbo-operations.html'],
    ['detective', 'detective-fraction-equivalence.html'],
  ].forEach(([key, href]) => {
    const c = hub[key];
    check(`index.html: ${key} card is single-variant — one big <a> link to ${href}`, !!c && c.tag === 'A' && c.href === href && c.badge === 'Play →', JSON.stringify(c));
  });

  check('index.html: a locked (not-yet-built) game card has no href and is marked aria-disabled', !!hub.lockedSample && hub.lockedSample.tag === 'DIV' && hub.lockedSample.href === null && hub.lockedSample.ariaDisabled === 'true' && hub.lockedSample.badge === 'Coming soon', JSON.stringify(hub.lockedSample));
}

/* ---------------- hub cards — expand toggle actually opens/closes ---------------- */
{
  const dom = loadGame('index.html');
  const result = runInPage(dom, () => {
    const card = Array.from(document.querySelectorAll('#game-grid .variant-card')).find(c => c.querySelector('.variant-name').textContent === 'Scuttle');
    const toggle = card.querySelector('.variant-expand-toggle');
    const list = card.querySelector('.variant-sublist');
    toggle.click();
    const afterOpen = { hidden: list.classList.contains('hidden'), label: toggle.textContent };
    toggle.click();
    const afterClose = { hidden: list.classList.contains('hidden'), label: toggle.textContent };
    return { afterOpen, afterClose };
  });
  check('index.html: clicking a card\'s expand toggle reveals the variant sublist', result.afterOpen.hidden === false && result.afterOpen.label === '▴ 3 variants', JSON.stringify(result.afterOpen));
  check('index.html: clicking it again collapses the sublist back', result.afterClose.hidden === true && result.afterClose.label === '▾ 3 variants', JSON.stringify(result.afterClose));
}

/* ---------------- in-game variant switcher (renderVariantSwitcher) ----------------
   Each multi-variant game's own settings screen gets a switcher so a
   player who already landed on one variant can jump to a sibling without
   going back to the hub — see CLAUDE.md's navigation redesign note. */
{
  const CASES = [
    ['scuttle-addition-subtraction.html', 'Addition & Subtraction', ['Product', 'Difference']],
    ['scuttle-product.html', 'Product', ['Addition & Subtraction', 'Difference']],
    ['scuttle-difference.html', 'Difference', ['Addition & Subtraction', 'Product']],
    ['pop-addition.html', 'Addition', ['Subtraction', 'Expression', 'Perimeter']],
    ['pop-subtraction.html', 'Subtraction', ['Addition', 'Expression', 'Perimeter']],
    ['pop-expression.html', 'Expression', ['Addition', 'Subtraction', 'Perimeter']],
    ['pop-perimeter.html', 'Perimeter', ['Addition', 'Subtraction', 'Expression']],
    ['nim.html', 'Race to 10', ['Nickeled & Dimed', 'Subtraction Nim']],
    ['nim-nickeled-and-dimed.html', 'Nickeled & Dimed', ['Race to 10', 'Subtraction Nim']],
    ['nim-subtraction.html', 'Subtraction Nim', ['Race to 10', 'Nickeled & Dimed']],
    ['beeline-product.html', 'Product', ['Difference', 'Addition', 'Decimal', 'Rounding', 'Equivalent Fraction']],
    ['beeline-difference.html', 'Difference', ['Product', 'Addition', 'Decimal', 'Rounding', 'Equivalent Fraction']],
    ['beeline-addition.html', 'Addition', ['Product', 'Difference', 'Decimal', 'Rounding', 'Equivalent Fraction']],
    ['beeline-decimal.html', 'Decimal', ['Product', 'Difference', 'Addition', 'Rounding', 'Equivalent Fraction']],
    ['beeline-rounding.html', 'Rounding', ['Product', 'Difference', 'Addition', 'Decimal', 'Equivalent Fraction']],
    ['beeline-equivalent-fraction.html', 'Equivalent Fraction', ['Product', 'Difference', 'Addition', 'Decimal', 'Rounding']],
  ];
  CASES.forEach(([file, currentName, siblingNames]) => {
    const dom = loadGame(file);
    const info = runInPage(dom, () => {
      const chips = Array.from(document.querySelectorAll('#variant-row .chip'));
      return chips.map(c => ({ tag: c.tagName, text: c.textContent, active: c.classList.contains('active'), href: c.getAttribute('href') }));
    });
    const current = info.find(c => c.text === currentName);
    check(`${file}: variant switcher marks "${currentName}" as the current, non-navigating chip`, !!current && current.tag === 'SPAN' && current.active === true && current.href === null, JSON.stringify(info));
    siblingNames.forEach(name => {
      const sib = info.find(c => c.text === name);
      check(`${file}: variant switcher links to sibling "${name}"`, !!sib && sib.tag === 'A' && !!sib.href, JSON.stringify(info));
    });
  });
}

/* ---------------- sub-menu card counts ---------------- */
{
  const dom = loadGame('scuttle-menu.html');
  const n = runInPage(dom, () => document.querySelectorAll('.variant-card').length);
  check('scuttle-menu.html: 7 variant cards (3 built + 4 catalogued-unbuilt)', n === 7, `got ${n}`);
}
{
  const dom = loadGame('pop-menu.html');
  const n = runInPage(dom, () => document.querySelectorAll('.variant-card').length);
  check('pop-menu.html: 11 variant cards (4 built + 7 catalogued-unbuilt)', n === 11, `got ${n}`);
}
{
  const dom = loadGame('nim-menu.html');
  const n = runInPage(dom, () => document.querySelectorAll('.variant-card').length);
  check('nim-menu.html: 6 variant cards (3 built + 3 catalogued-unbuilt)', n === 6, `got ${n}`);
}
{
  const dom = loadGame('beeline-menu.html');
  const n = runInPage(dom, () => document.querySelectorAll('.variant-card').length);
  check('beeline-menu.html: 15 variant cards (6 built + 9 catalogued-unbuilt)', n === 15, `got ${n}`);
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all site-structure cases passed`);
}
