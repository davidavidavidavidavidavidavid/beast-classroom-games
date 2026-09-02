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

function loadGame(htmlFileName) {
  const html = fs.readFileSync(path.join(__dirname, '..', htmlFileName), 'utf8');
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true, // real timers for setTimeout/setInterval
    url: 'http://localhost/',
    // no `resources: "usable"` — the Google Fonts / local CSS <link> tags
    // are deliberately left unfetched, we only care about page logic here.
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

module.exports = { loadGame, runInPage, sleep };
