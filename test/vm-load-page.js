/*
 * Loads a game's inline <script> into a Node `vm` context against a minimal
 * fake DOM (no jsdom) and hands back the resulting global object, so a test
 * can pull out a single pure function (decideWinner) and call it directly.
 * This is only for testing already-pure logic in isolation — it does not
 * simulate real interaction, that's what the jsdom smoke tests are for.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeFakeElement() {
  const el = {
    style: {},
    dataset: {},
    disabled: false,
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) { return child; },
    removeChild(child) { return child; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    setAttribute() {},
    getAttribute() { return null; },
  };
  let text = '';
  let value = '';
  Object.defineProperty(el, 'textContent', { get: () => text, set: v => { text = v; } });
  Object.defineProperty(el, 'value', { get: () => value, set: v => { value = v; } });
  return el;
}

function loadPage(htmlFileName) {
  const html = fs.readFileSync(path.join(__dirname, '..', htmlFileName), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error(`no inline <script> found in ${htmlFileName}`);
  const code = scriptMatch[1];

  const fakeDocument = {
    getElementById() { return makeFakeElement(); },
    createElement() { return makeFakeElement(); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {},
  };

  const sandbox = {
    document: fakeDocument,
    console,
    Math,
    Array,
    Object,
    Number,
    parseInt,
    isNaN,
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout() { return 0; },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: htmlFileName });
  return sandbox; // function declarations (decideWinner, etc.) attach here
}

module.exports = { loadPage };
