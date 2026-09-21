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

/* TEMPORARY (answer-explanation experiment) — mirrors shared-game.js's own
   DEMO_READY_HREFS. Mirrored rather than imported for the reason CLAUDE.md's
   Known Traps already documents for nim.html's TARGET: a top-level `const`
   in a classic script isn't readable off a loaded page. Delete with the
   experiment, alongside the list it mirrors. */
const DEMO_READY_HREFS = [
  'scuttle-addition-subtraction.html',
  'scuttle-product.html',
  'beeline-product.html',
  'beeline-rounding.html',
];

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
    // A card can now carry more than one badge — the play/coming-soon
    // status badge, plus a TEMPORARY "Demo" chip on the games that have
    // the answer-explanation built. Select the status one explicitly
    // rather than "whichever .badge comes first in the DOM".
    const summarize = c => c && {
      tag: c.tagName,
      href: c.getAttribute('href'),
      badge: c.querySelector('.badge.play, .badge.soon').textContent,
      badgeTag: c.querySelector('.badge.play, .badge.soon').tagName,
      badgeHref: c.querySelector('.badge.play, .badge.soon').getAttribute('href'),
      ariaDisabled: c.getAttribute('aria-disabled'),
      toggleText: c.querySelector('.variant-expand-toggle') ? c.querySelector('.variant-expand-toggle').textContent : null,
      sublistHiddenInitially: c.querySelector('.variant-sublist') ? c.querySelector('.variant-sublist').classList.contains('hidden') : null,
      // A demo-ready sublink carries a .badge.demo chip INSIDE the <a>, so
      // a.textContent is "ProductDemo", not the variant name. Read the
      // link's own first text node for the name and check the chip
      // separately, rather than loosening the name assertion.
      sublinks: Array.from(c.querySelectorAll('.variant-sublink')).map(a => ({
        text: Array.from(a.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join(''),
        href: a.getAttribute('href'),
      })),
      demoSublinkHrefs: Array.from(c.querySelectorAll('.variant-sublink'))
        .filter(a => a.querySelector('.badge.demo'))
        .map(a => a.getAttribute('href')),
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
    // TEMPORARY (answer-explanation experiment): the DEMO chip has to land
    // on the specific VARIANTS being demoed, not just the family card — the
    // card-level badge alone can't say which of Beeline's six it means.
    const expectedDemo = expectedSublinks.map(([, href]) => href).filter(h => DEMO_READY_HREFS.indexOf(h) !== -1);
    check(`index.html: ${key} card marks exactly the demo-ready variants with a DEMO chip`, !!c && JSON.stringify(c.demoSublinkHrefs) === JSON.stringify(expectedDemo), JSON.stringify(c && c.demoSublinkHrefs) + ' expected ' + JSON.stringify(expectedDemo));
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

/* ---------------- settings-screen chrome -------------------------------
   initSettingsChrome() (shared-game.js) restructures every game's settings
   screen at runtime — see design-system.css's "settings-screen chrome"
   block for why each piece moved. Checked on one multi-variant game, one
   single-variant game, and the one game with no settings screen at all,
   since those are the three shapes the function has to handle. */
{
  const dom = loadGame('scuttle-addition-subtraction.html');
  const r = runInPage(dom, () => {
    const before = {
      variantRowLifted: !!document.querySelector('#variant-card #variant-row'),
      variantRowNotInSettings: !document.querySelector('#screen-settings #variant-row'),
      avatarBtn: !!document.getElementById('avatar-choose-btn'),
      avatarRowInModal: !!document.querySelector('.avatar-modal #avatar-row'),
      avatarModalClosed: document.getElementById('avatar-modal-backdrop').classList.contains('hidden'),
      settingsActive: document.body.classList.contains('settings-active'),
      variantCardVisible: !document.getElementById('variant-card').classList.contains('hidden'),
      btnLabel: document.getElementById('avatar-choose-btn').textContent,
    };
    // Picking from the modal must still drive the game's own avatar state.
    document.getElementById('avatar-choose-btn').click();
    const opened = !document.getElementById('avatar-modal-backdrop').classList.contains('hidden');
    document.querySelector('#avatar-row [data-avatar="winnie"]').click();
    const picked = {
      opened,
      avatar: st.avatar,
      youBadge: el('you-badge').getAttribute('src'),
      closedAfterPick: document.getElementById('avatar-modal-backdrop').classList.contains('hidden'),
      btnLabel: document.getElementById('avatar-choose-btn').textContent,
    };
    // Starting a game must take the settings chrome away with it.
    el('target-input').value = '500';
    el('start-btn').click();
    const inGame = {
      settingsActive: document.body.classList.contains('settings-active'),
      variantCardHidden: document.getElementById('variant-card').classList.contains('hidden'),
    };
    return { before, picked, inGame };
  });
  check('settings: the variant picker is lifted out into its own card above the settings card', r.before.variantRowLifted && r.before.variantRowNotInSettings, JSON.stringify(r.before));
  check('settings: the avatar picker is behind a button, in a modal that starts closed', r.before.avatarBtn && r.before.avatarRowInModal && r.before.avatarModalClosed, JSON.stringify(r.before));
  check('settings: the avatar button names the current avatar before anything is clicked', /grogg/i.test(r.before.btnLabel), r.before.btnLabel);
  check('settings: picking in the modal still updates st.avatar and the badges, then closes', r.picked.opened && r.picked.avatar === 'winnie' && r.picked.youBadge === 'avatars/winnie.png' && r.picked.closedAfterPick && /winnie/i.test(r.picked.btnLabel), JSON.stringify(r.picked));
  check('settings: body.settings-active is on while settings shows, off once a game starts', r.before.settingsActive === true && r.inGame.settingsActive === false, JSON.stringify([r.before.settingsActive, r.inGame.settingsActive]));
  check('settings: the variant card follows the settings screen in and out of view', r.before.variantCardVisible === true && r.inGame.variantCardHidden === true, JSON.stringify([r.before.variantCardVisible, r.inGame.variantCardHidden]));
}
{
  // Single-variant game: no variant row to lift, but the rest still applies.
  const dom = loadGame('numbo-operations.html');
  const r = runInPage(dom, () => ({
    noVariantCard: !document.getElementById('variant-card'),
    avatarBtn: !!document.getElementById('avatar-choose-btn'),
    settingsActive: document.body.classList.contains('settings-active'),
  }));
  check('settings: a single-variant game gets no variant card, but still gets the avatar modal', r.noVariantCard && r.avatarBtn && r.settingsActive, JSON.stringify(r));
}
{
  // Detective has no settings screen and no avatar picker — must no-op.
  const dom = loadGame('detective-fraction-equivalence.html');
  const r = runInPage(dom, () => ({
    noVariantCard: !document.getElementById('variant-card'),
    noAvatarBtn: !document.getElementById('avatar-choose-btn'),
    notSettingsActive: !document.body.classList.contains('settings-active'),
  }));
  check('settings: a game with no settings screen is left completely untouched', r.noVariantCard && r.noAvatarBtn && r.notSettingsActive, JSON.stringify(r));
}

/* ---------------- advance controls share one position ------------------
   Roll dice / Lock in number / Next round are the same "advance" click at
   different moments; they used to sit at three different depths in the
   round card, so the button moved between every step. They're now
   overlapped in one .action-stack cell — see design-system.css. jsdom has
   no layout engine, so assert the STRUCTURE that guarantees the shared
   position (all of them in the same stack) rather than pixel positions. */
[
  ['scuttle-addition-subtraction.html', ['roll-btn-wrap', 'lock-wrap', 'next-round-wrap']],
  ['scuttle-product.html', ['roll-btn-wrap', 'next-round-wrap']],
  ['scuttle-difference.html', ['roll-btn-wrap', 'next-round-wrap']],
].forEach(([file, wrapIds]) => {
  const dom = loadGame(file);
  const r = runInPage(dom, (ids) => {
    const stack = document.querySelector('#screen-round .action-stack');
    return {
      hasStack: !!stack,
      allInStack: stack ? ids.every(id => { const n = document.getElementById(id); return n && n.parentElement === stack; }) : false,
      stackIsLast: stack ? stack === stack.parentElement.lastElementChild : false,
    };
  }, wrapIds);
  check(`${file}: every advance control shares one .action-stack, so the button never moves`, r.hasStack && r.allInStack, JSON.stringify(r));
  check(`${file}: the action stack sits at the bottom of the round card`, r.stackIsLast === true, JSON.stringify(r));
});

/* ---------------- menu organization: playable vs. coming soon ----------
   Every listing page splits its cards into two labelled sections rather
   than running both tiers together — see CLAUDE.md's design-sweep note. */
['index.html', 'scuttle-menu.html', 'pop-menu.html', 'nim-menu.html', 'beeline-menu.html'].forEach(file => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => {
    const heads = Array.from(document.querySelectorAll('.menu-section-head')).map(h => h.textContent);
    // Every card must sit after one of the two headings — i.e. no card is
    // left ungrouped above the first heading.
    const nodes = Array.from(document.querySelectorAll('.menu-section-head, .variant-card'));
    const firstCardIdx = nodes.findIndex(n => n.classList.contains('variant-card'));
    const firstHeadIdx = nodes.findIndex(n => n.classList.contains('menu-section-head'));
    return { heads, headComesFirst: firstHeadIdx !== -1 && firstHeadIdx < firstCardIdx };
  });
  check(`${file}: cards are grouped under "Playable now" / "Coming soon" headings`, r.heads.length === 2 && r.heads[0] === 'Playable now' && r.heads[1] === 'Coming soon', JSON.stringify(r.heads));
  check(`${file}: no card sits above the first section heading`, r.headComesFirst === true, JSON.stringify(r));
});

/* ---------------- TEMPORARY: demo markers on listing pages -------------
   EXPERIMENTAL — delete with the experiment. The frame is now border-less
   (the chip carries the meaning), so what's checked is that every marked
   item CARRIES a chip and the legend explains it. Counted as
   cards + variant sublinks + the legend's own sample chip, rather than a
   magic total, so this stays readable if the demo list changes. */
[
  // [file, demo-marked cards, demo-marked variant sublinks]
  ['index.html', 2, 4],
  ['scuttle-menu.html', 2, 0],
  ['beeline-menu.html', 2, 0],
].forEach(([file, expectedCards, expectedSublinks]) => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => ({
    framed: document.querySelectorAll('.demo-framed').length,
    framedSublinks: document.querySelectorAll('.variant-sublink.demo-framed').length,
    // Every marked item must carry its own chip — the mark is invisible
    // without it now that the frame draws nothing.
    allFramedChipped: Array.from(document.querySelectorAll('.demo-framed')).every(x => !!x.querySelector('.badge.demo')),
    badges: document.querySelectorAll('.badge.demo').length,
    legends: document.querySelectorAll('.demo-legend').length,
  }));
  check(`${file}: ${expectedCards} demo-marked cards + ${expectedSublinks} demo-marked variants, each carrying a chip`,
    r.framed === expectedCards + expectedSublinks && r.framedSublinks === expectedSublinks && r.allFramedChipped === true, JSON.stringify(r));
  // +1 for the legend's own sample chip.
  check(`${file}: a legend explains what the chip means`, r.legends === 1 && r.badges === expectedCards + expectedSublinks + 1, JSON.stringify(r));
});
// Pages with nothing demo-ready must stay completely clean of demo furniture.
['pop-menu.html', 'nim-menu.html'].forEach(file => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => ({
    framed: document.querySelectorAll('.demo-framed').length,
    badges: document.querySelectorAll('.badge.demo').length,
    legends: document.querySelectorAll('.demo-legend').length,
  }));
  check(`${file}: no demo frame/chip/legend, since none of its variants has one`, r.framed === 0 && r.badges === 0 && r.legends === 0, JSON.stringify(r));
});

/* ---------------- TEMPORARY: answer-explanation demo buttons ------------
   EXPERIMENTAL — see CLAUDE.md "Answer-explanation modal & stats-demo
   experiment". Delete this whole block along with the experiment. It's
   here (rather than split across four per-game smoke tests) so there's
   exactly one place to remove, and because the thing actually worth
   guarding is cheap and cross-cutting: a "click here for demo" button
   that throws or opens an empty modal is the single worst failure mode
   for a button whose entire purpose is being clicked in front of people. */
['scuttle-addition-subtraction.html', 'scuttle-product.html', 'beeline-product.html', 'beeline-rounding.html'].forEach(file => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => {
    const btn = document.getElementById('demo-explain-btn');
    if (!btn) return { hasButton: false };
    btn.click();
    const backdrop = document.getElementById('explain-modal-backdrop');
    return {
      hasButton: true,
      modalOpened: !!backdrop && !backdrop.classList.contains('hidden'),
      answerText: backdrop ? document.getElementById('explain-modal-answer').textContent.trim() : '',
      visualRendered: backdrop ? document.getElementById('explain-modal-visual').innerHTML.length > 50 : false,
    };
  });
  check(`${file}: has the temporary "Demo" button`, r.hasButton === true, JSON.stringify(r));
  check(`${file}: clicking Demo opens a populated explanation modal`, r.modalOpened === true && r.visualRendered === true && r.answerText.length > 0, JSON.stringify(r));
});

/* ---------------- type scale ---------------------------------------------
   Real feedback: "Too many font sizes... looks cluttered." There were 28
   distinct font sizes; there are now 7 tokens. This guards the collapse by
   forbidding raw px font sizes anywhere except the :root scale itself —
   the failure mode isn't one wrong value, it's the slow return of
   12/12.5/13/13.5 as four different ways to say "small". */
{
  const fs2 = require('fs');
  const path2 = require('path');
  const root = path2.join(__dirname, '..');
  const files = fs2.readdirSync(root)
    .filter(f => f.endsWith('.html'))
    .concat(['design-system.css'])
    .concat(fs2.readdirSync(path2.join(root, 'components')).map(f => 'components/' + f));
  const offenders = [];
  files.forEach(f => {
    let src = fs2.readFileSync(path2.join(root, f), 'utf8');
    // Skip the token definitions themselves.
    const marker = '--text-3xl: 48px;';
    if (src.indexOf(marker) !== -1) src = src.slice(src.indexOf(marker) + marker.length);
    const m = src.match(/font-size:\s*[0-9.]+px/g);
    if (m) offenders.push(`${f}: ${m.join(', ')}`);
  });
  check('type scale: no raw px font sizes outside the :root scale (use var(--text-*))',
    offenders.length === 0, offenders.join(' | '));

  // The floor was 10px. Nothing may go below 13px again — and the steps
  // are CSS locks now, so read the clamp() floor/ceiling rather than a
  // bare px value. Two things matter: the floor (what renders at the
  // 1024x600 tablet floor) and MONOTONICITY (a step whose ceiling
  // overtakes the next step's would invert the hierarchy on wide screens
  // — exactly what would have happened had only the four steps the
  // handoff named been made fluid).
  const ds = fs2.readFileSync(path2.join(root, 'design-system.css'), 'utf8');
  const STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
  const range = (name) => {
    const m = ds.match(new RegExp('--text-' + name.replace('2xl', '2xl') + ':\\s*([^;]+);'));
    if (!m) return null;
    // Greedy middle on purpose: a clamp's centre term can contain its own
    // commas — min(1vw, 1.5vh) — and a [^,]+ middle matches none of them,
    // reporting every step "unparseable" while the ordering check below
    // silently passes on an empty set. A parser bug that disables the
    // assertion it feeds is worse than no assertion.
    const c = m[1].match(/clamp\(\s*([0-9.]+)px\s*,.+,\s*([0-9.]+)px\s*\)/);
    if (c) return { min: Number(c[1]), max: Number(c[2]) };
    const plain = m[1].match(/^\s*([0-9.]+)px\s*$/);
    return plain ? { min: Number(plain[1]), max: Number(plain[1]) } : null;
  };
  const ranges = STEPS.map(n => ({ n, r: range(n) }));
  const missing = ranges.filter(x => !x.r).map(x => x.n);
  check('type scale: every step parses as a px value or a clamp() lock',
    missing.length === 0, 'unparseable: ' + missing.join(', '));
  const xs = ranges[0].r;
  check('type scale: the smallest step is at least 13px ("too much font is too small")',
    !!xs && xs.min >= 13, xs ? xs.min + 'px' : 'missing');
  const inversions = [];
  for (let i = 1; i < ranges.length; i++) {
    const a = ranges[i - 1].r, b = ranges[i].r;
    if (!a || !b) continue;
    if (!(b.min > a.min && b.max > a.max)) inversions.push(`${ranges[i - 1].n} -> ${ranges[i].n}`);
  }
  check('type scale: steps stay strictly ordered at BOTH ends of their fluid range (no inversion on wide screens)',
    inversions.length === 0, inversions.join(', '));
}

/* ---------------- persistent rules launcher ------------------------------
   The inline "How does this game work?" link was only reachable from the
   settings card; it is now a corner button reachable at any point, opening
   the game's own #rules-box in a modal. Two things worth pinning: that the
   rules text is MOVED rather than duplicated (one copy, each game still
   owns its own wording), and that it opens MID-GAME, which is the whole
   point of the change. */
['scuttle-addition-subtraction.html', 'pop-addition.html', 'beeline-product.html', 'nim.html', 'detective-fraction-equivalence.html'].forEach(file => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => {
    const btn = document.getElementById('rules-launcher');
    if (!btn) return { hasLauncher: false };
    const before = {
      // The old inline link must be gone everywhere.
      howLink: !!document.getElementById('how-link'),
      rulesInCard: !!document.querySelector('#screen-settings #rules-box'),
      modal: !!document.getElementById('rules-modal-backdrop'),
    };
    btn.click();
    const bd = document.getElementById('rules-modal-backdrop');
    const boxes = document.querySelectorAll('#rules-box');
    return {
      hasLauncher: true, before,
      opened: !!bd && !bd.classList.contains('hidden'),
      rulesInModal: !!document.querySelector('#rules-modal-backdrop #rules-box'),
      copies: boxes.length,
      textLen: boxes.length ? boxes[0].textContent.trim().length : 0,
    };
  });
  check(`${file}: has a persistent rules launcher and no inline "how does this work" link`,
    r.hasLauncher === true && r.before.howLink === false, JSON.stringify(r));
  check(`${file}: clicking it opens the game's own rules, moved (not copied) into the modal`,
    r.opened === true && r.rulesInModal === true && r.copies === 1 && r.textLen > 80, JSON.stringify(r));
});

// Reachable mid-game, not just from settings — the reason it moved.
{
  const dom = loadGame('scuttle-addition-subtraction.html');
  const r = runInPage(dom, () => {
    el('start-btn').click();
    document.getElementById('rules-launcher').click();
    const bd = document.getElementById('rules-modal-backdrop');
    const open = !!bd && !bd.classList.contains('hidden');
    document.getElementById('rules-modal-close-btn').click();
    return { open, closed: bd.classList.contains('hidden'), stillOnRound: !document.getElementById('screen-round').classList.contains('hidden') };
  });
  check('rules launcher: opens mid-game and closes again without disturbing the current screen',
    r.open === true && r.closed === true && r.stillOnRound === true, JSON.stringify(r));
}

// Pages with no rules of their own must not get an empty button.
['index.html', 'pop-menu.html'].forEach(file => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => ({ launcher: !!document.getElementById('rules-launcher'), box: !!document.getElementById('rules-box') }));
  check(`${file}: no rules launcher (this page has no #rules-box to show)`,
    r.launcher === false && r.box === false, JSON.stringify(r));
});

/* ---------------- settings in two columns --------------------------------
   Real feedback: "pop settings page is too cluttered - lots of rows of
   unequal lengths. Better to arrange in 2 columns." */
[
  ['pop-addition.html', 3],
  ['scuttle-addition-subtraction.html', 2],
  ['scuttle-product.html', 3],
].forEach(([file, minGroups]) => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => {
    const grid = document.querySelector('#screen-settings .settings-grid');
    const footer = document.querySelector('#screen-settings .settings-footer');
    if (!grid) return { built: false };
    const groups = Array.from(grid.querySelectorAll('.setting-group'));
    return {
      built: true,
      groups: groups.length,
      // Every group must lead with its own label, or the grouping has
      // sliced a control away from the label that names it.
      everyGroupStartsWithLabel: groups.every(g => g.firstElementChild && g.firstElementChild.classList.contains('section-label')),
      everyGroupHasAControl: groups.every(g => g.children.length >= 2),
      // Actions belong in the footer, not competing for a column.
      footerHasStart: !!footer && !!footer.querySelector('#start-btn'),
      startInAGroup: groups.some(g => g.querySelector('#start-btn')),
      labelsLooseInCard: Array.from(document.querySelectorAll('#screen-settings > .section-label')).length,
    };
  });
  check(`${file}: settings render as a grid of ${minGroups}+ labelled groups`,
    r.built === true && r.groups >= minGroups && r.everyGroupStartsWithLabel === true && r.everyGroupHasAControl === true,
    JSON.stringify(r));
  check(`${file}: actions sit in the full-width footer, not in a settings column`,
    r.footerHasStart === true && r.startInAGroup === false && r.labelsLooseInCard === 0, JSON.stringify(r));
});

/* ---------------- side-by-side play layout -----------------------------
   shared-game.js's initPlayLayout() — see CLAUDE.md "Side-by-side
   board/playing-space layout". jsdom has no layout engine, so the pixel
   claim (two columns, no scrolling) is a real-browser check; what's
   assertable here is the STRUCTURE the CSS then acts on, plus the fact
   that DOM order still puts the scorecard before the play screens, which
   is what the narrow-viewport stacked view renders. */
['scuttle-addition-subtraction.html', 'scuttle-product.html', 'scuttle-difference.html'].forEach(file => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => {
    const layout = document.querySelector('.play-layout');
    if (!layout) return { built: false };
    const side = layout.querySelector('.play-side');
    const main = layout.querySelector('.play-main');
    return {
      built: true,
      sideHoldsScorecard: !!side && side.children.length === 1 && side.children[0].id === 'scorecard',
      mainScreens: main ? Array.from(main.children).map(n => n.id) : [],
      // The settings step must stay OUTSIDE the two columns — it's a
      // full-width step before play starts, not a play screen.
      settingsOutside: !layout.contains(document.getElementById('screen-settings')),
      sideBeforeMain: !!side && !!main && side.compareDocumentPosition(main) === 4,
      appWidened: document.getElementById('app').classList.contains('has-play-layout'),
    };
  });
  check(`${file}: scorecard and play screens are split into .play-side / .play-main`,
    r.built === true && r.sideHoldsScorecard === true && r.mainScreens.length >= 3 && r.settingsOutside === true, JSON.stringify(r));
  check(`${file}: scorecard still comes FIRST in DOM order (so narrow viewports stack board-on-top, unchanged)`,
    r.sideBeforeMain === true && r.appWidened === true, JSON.stringify(r));
});
// A game with no persistent scorecard has nothing to put beside anything —
// it must be left completely alone, not wrapped in an empty layout.
['beeline-product.html', 'pop-addition.html', 'nim.html', 'numbo-operations.html'].forEach(file => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => ({
    layouts: document.querySelectorAll('.play-layout').length,
    widened: document.getElementById('app').classList.contains('has-play-layout'),
  }));
  check(`${file}: no scorecard, so no play layout is injected and #app keeps its own width`,
    r.layouts === 0 && r.widened === false, JSON.stringify(r));
});

/* ---------------- TEMPORARY: stats launcher + skill panel ---------------
   EXPERIMENTAL — delete with the experiment. The launcher comes from
   renderGlobalNav(), so "every page has one" is the same
   one-implementation guarantee the nav itself gets; what's genuinely worth
   driving is the CLICK, since the panel is built lazily and has to resolve
   which page it was opened from at that moment (renderVariantSwitcher runs
   AFTER renderGlobalNav, so capturing the href at launcher-render time
   would always come back null on a multi-variant game). */
[
  // [file, the skill that must open expanded, or null for a listing page]
  ['beeline-product.html', 'mult-facts'],
  ['scuttle-addition-subtraction.html', 'add-sub'],
  ['nim.html', 'strategy'],
  ['detective-fraction-equivalence.html', 'fractions'],
  ['index.html', null],
  ['pop-menu.html', null],
].forEach(([file, expectedOpenSkill]) => {
  const dom = loadGame(file);
  const r = runInPage(dom, () => {
    const btn = document.getElementById('stats-launcher');
    if (!btn) return { hasLauncher: false };
    btn.click();
    const backdrop = document.getElementById('stats-panel-backdrop');
    const rows = Array.from(document.querySelectorAll('.skill-row'));
    return {
      hasLauncher: true,
      panelOpened: !!backdrop && !backdrop.classList.contains('hidden'),
      rowCount: rows.length,
      openSkills: rows.filter(x => x.classList.contains('open')).map(x => x.dataset.skill),
      // Every non-open row's body must actually be collapsed, not just
      // missing the class — "a list of collapsed skills" is the ask.
      collapsedBodiesHidden: rows.filter(x => !x.classList.contains('open'))
        .every(x => x.querySelector('.skill-body').classList.contains('hidden')),
    };
  });
  check(`${file}: has the corner stats launcher`, r.hasLauncher === true, JSON.stringify(r));
  check(`${file}: clicking it opens a panel of collapsed skills`, r.panelOpened === true && r.rowCount === 10 && r.collapsedBodiesHidden === true, JSON.stringify(r));
  check(`${file}: opens with ${expectedOpenSkill ? `"${expectedOpenSkill}" expanded` : 'nothing expanded (no single game in context)'}`,
    JSON.stringify(r.openSkills) === JSON.stringify(expectedOpenSkill ? [expectedOpenSkill] : []), JSON.stringify(r.openSkills));
});

// A collapsed row must actually open on click, and the open one close.
{
  const dom = loadGame('beeline-product.html');
  const r = runInPage(dom, () => {
    document.getElementById('stats-launcher').click();
    const rowOf = id => document.querySelector(`.skill-row[data-skill="${id}"]`);
    const state = id => ({ open: rowOf(id).classList.contains('open'), bodyHidden: rowOf(id).querySelector('.skill-body').classList.contains('hidden') });
    const before = { mult: state('mult-facts'), rounding: state('rounding') };
    rowOf('rounding').querySelector('.skill-toggle').click();
    rowOf('mult-facts').querySelector('.skill-toggle').click();
    return { before, after: { mult: state('mult-facts'), rounding: state('rounding') } };
  });
  check('stats panel: a collapsed skill expands on click, and the pre-expanded one collapses',
    r.before.mult.open === true && r.before.rounding.open === false &&
    r.after.rounding.open === true && r.after.rounding.bodyHidden === false &&
    r.after.mult.open === false && r.after.mult.bodyHidden === true, JSON.stringify(r));
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all site-structure cases passed`);
}
