/*
 * Shared helpers for the jsdom full-playthrough smoke tests.
 *
 * These games are classic (non-module) single <script> files with no
 * exports — everything lives as a top-level `let`/`function` inside the
 * page's own global scope. `runInPage` lets test code write ordinary JS
 * functions that reference page globals directly (st, el, decideWinner,
 * document, ...) by re-serializing the function body into an injected
 * <script> tag that runs in the *same* realm jsdom already executed the
 * game's own script in — so top-level `let`/`const`/`function` bindings
 * from the game are visible as bare identifiers, exactly as another
 * <script> tag on the same page would see them in a real browser.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadGame(htmlFileName, { beforeParse } = {}) {
  let html = fs.readFileSync(path.join(__dirname, '..', htmlFileName), 'utf8');
  // Inline any local <script src="....js"></script> tag (e.g. shared-game.js
  // — see CLAUDE.md "File structure & the point of it") as if the browser
  // had already fetched it. `runScripts: 'dangerously'` below executes
  // INLINE script content unconditionally, but jsdom does not fetch
  // external resources at all without `resources: "usable"` (deliberately
  // left off — see the comment on the JSDOM call), so a real <script src>
  // tag would otherwise silently never run, leaving every shared function
  // undefined. Doing this substitution ourselves, at the test-harness
  // level, keeps that CSS/font-fetching opt-out intact while still letting
  // a game's shared script actually execute.
  html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (match, src) =>
    `<script>${fs.readFileSync(path.join(__dirname, '..', src), 'utf8')}</script>`
  );
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true, // real timers for setTimeout/setInterval
    url: 'http://localhost/',
    // no `resources: "usable"` — the Google Fonts / local CSS <link> tags
    // are deliberately left unfetched, we only care about page logic here.
    // `beforeParse(window)` (optional) runs before the page's own inline
    // script does — the only way to seed something like sessionStorage
    // (e.g. simulating a repeat-visit-this-session) BEFORE the page's own
    // top-level code reads it, since `loadGame` otherwise always runs
    // scripts synchronously against a fresh, empty storage. See the boot
    // sequence's session-skip test for the pattern.
    ...(beforeParse ? { beforeParse } : {}),
  });
}

// Run `fn` (a plain function, no closures over Node-side variables — only
// page globals and its own args) inside the page's realm and return its
// result. Throws in Node if `fn` throws in the page.
//
// The return value is JSON round-tripped before crossing back into Node.
// Without this, plain objects/arrays built in jsdom's realm are *not*
// `assert.deepStrictEqual`-equal to same-shaped Node-realm literals (they
// have a different realm's Array/Object prototype) even though they look
// identical when logged — JSON-safe values only, but that covers every
// value these tests actually pass around (numbers/strings/booleans/plain
// objects/arrays).
function runInPage(dom, fn, ...args) {
  const script = dom.window.document.createElement('script');
  const argsJson = JSON.stringify(args);
  script.textContent = `
    (function(){
      try {
        var __args = ${argsJson};
        var __value = (${fn.toString()}).apply(null, __args);
        window.__ret = { ok: true, value: JSON.stringify(__value === undefined ? null : __value) };
      } catch (e) {
        window.__ret = { ok: false, error: (e && e.stack) ? e.stack : String(e) };
      }
    })();
  `;
  dom.window.document.body.appendChild(script);
  const ret = dom.window.__ret;
  delete dom.window.__ret;
  if (!ret || !ret.ok) {
    throw new Error('runInPage: page code threw:\n' + (ret && ret.error));
  }
  return JSON.parse(ret.value);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Snapshot avatar-related state (see CLAUDE.md "Avatars"): st.avatar /
// st.difficulty, every badge's rendered src (top bar + scoreboard header),
// and which picker slot currently carries .selected. Shared across every
// game's smoke test since the avatar wiring itself
// (renderAvatarPicker/renderAvatarBadges, AVATAR_ROSTER,
// BOT_AVATAR_BY_DIFF, the you-badge/bot-badge/sc-you-badge/sc-bot-badge
// ids) is identical code duplicated per-file, per this project's
// no-shared-JS convention — only the *check* is worth sharing.
function snapshotAvatarState(dom) {
  return runInPage(dom, () => {
    const selected = document.querySelector('#avatar-row .avatar-slot.selected');
    // sc-you-badge/sc-bot-badge only exist on games with a persistent
    // #scorecard (Scuttle) — every other family (Pop/Beeline/Nim/Numbo)
    // has no such element, so these come back null there rather than
    // throwing; a test for those games simply doesn't assert on them.
    const scYou = document.getElementById('sc-you-badge');
    const scBot = document.getElementById('sc-bot-badge');
    return {
      avatar: st.avatar,
      difficulty: st.difficulty,
      youBadge: el('you-badge').getAttribute('src'),
      botBadge: el('bot-badge').getAttribute('src'),
      scYouBadge: scYou ? scYou.getAttribute('src') : null,
      scBotBadge: scBot ? scBot.getAttribute('src') : null,
      pickerSelected: selected ? selected.dataset.avatar : null,
    };
  });
}

module.exports = { loadGame, runInPage, sleep, snapshotAvatarState };
