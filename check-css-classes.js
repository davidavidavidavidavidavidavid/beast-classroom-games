#!/usr/bin/env node
/*
 * check-css-classes.js
 *
 * Catches this bug: a class defined in a shared stylesheet (design-system.css
 * or anything in components/) that a given game's HTML never actually
 * references, so the styling for it silently never applies.
 *
 * For every *.html file in the project root (design/ is not scanned — those
 * are mockups, not shipped games):
 *   1. Find which shared stylesheets it <link>s.
 *   2. Collect every class *selector* defined in those stylesheets.
 *   3. Collect every class *referenced* in that HTML file — both static
 *      class="..." attributes, and classes assigned at runtime in the inline
 *      <script> via `.className = ...` or `.classList.add/remove/toggle(...)`.
 *   4. Report shared classes from step 2 that never show up in step 3.
 *
 * A reported class isn't automatically a bug — it may just be a shared class
 * this particular game legitimately doesn't use. This script surfaces
 * candidates for a human to eyeball, the way the addition-subtraction bug
 * was caught.
 *
 * Limitations (by design, to stay dependency-free):
 *  - Class detection in JS is done via regex over string literals inside
 *    `.className = <expr>;` and `.classList.add/remove/toggle(<args>)`, not a
 *    real JS parser. Literal tokens (`'active'`, `'used'`, ...) are found
 *    even inside concatenation/ternaries (`'die-wrap' + (used ? ' used' : '')`)
 *    and fallbacks (`cls || 'error'`), but a class name built entirely from a
 *    variable with no literal anywhere (e.g. `el.className = someVar;`) can't
 *    be seen and won't count as "used."
 *  - CSS class selectors are found by scanning only selector/at-rule text
 *    (whatever precedes each `{`), never declaration bodies, so property
 *    values like `opacity: 0.4` can't be mistaken for a class.
 *
 * No dependencies. Run with: node check-css-classes.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

/* ---------------- CSS side: what classes does a shared stylesheet define? ---------------- */

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Walk the stylesheet and pull out only the text that precedes each `{`
// (selector lists and @-rule preludes), discarding everything inside rule
// bodies. Handles nested blocks (e.g. @media wrapping normal rules,
// @keyframes wrapping percentage selectors) via simple brace tracking.
function extractSelectorChunks(css) {
  const stripped = stripCssComments(css);
  const chunks = [];
  let buffer = '';
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '{') {
      chunks.push(buffer);
      buffer = '';
    } else if (ch === '}') {
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  return chunks;
}

const CLASS_IN_SELECTOR_RE = /\.(-?[a-zA-Z_][\w-]*)/g;

function classesDefinedInCss(css) {
  const classes = new Set();
  for (const chunk of extractSelectorChunks(css)) {
    CLASS_IN_SELECTOR_RE.lastIndex = 0;
    let m;
    while ((m = CLASS_IN_SELECTOR_RE.exec(chunk))) {
      classes.add(m[1]);
    }
  }
  return classes;
}

/* ---------------- HTML side: which shared stylesheets does a game link? ---------------- */

const LINK_TAG_RE = /<link\b[^>]*>/gi;
const REL_STYLESHEET_RE = /rel\s*=\s*(["'])stylesheet\1/i;
const HREF_RE = /href\s*=\s*(["'])(.*?)\1/i;

function sharedCssLinks(html) {
  const hrefs = [];
  LINK_TAG_RE.lastIndex = 0;
  let m;
  while ((m = LINK_TAG_RE.exec(html))) {
    const tag = m[0];
    if (!REL_STYLESHEET_RE.test(tag)) continue;
    const hrefMatch = HREF_RE.exec(tag);
    if (!hrefMatch) continue;
    const href = hrefMatch[2];
    if (/^https?:\/\//i.test(href)) continue; // Google Fonts etc. — not shared game CSS

    const normalized = href.replace(/^\.\//, '');
    const isDesignSystem = path.basename(normalized) === 'design-system.css';
    const isComponent = normalized.startsWith('components/');
    if (isDesignSystem || isComponent) hrefs.push(href);
  }
  return hrefs;
}

/* ---------------- HTML side: split into markup vs. inline script ---------------- */

function splitHtml(html) {
  let scriptContent = '';
  const markup = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/\bsrc\s*=/i.test(attrs)) return ''; // external script, no inline body to scan
    scriptContent += body + '\n';
    return '';
  });
  return { markup, scriptContent };
}

/* ---------------- HTML side: classes used in static class="..." attributes ---------------- */

const CLASS_ATTR_RE = /\bclass\s*=\s*(["'])([\s\S]*?)\1/gi;

function classesFromStaticHtml(markup) {
  const classes = new Set();
  CLASS_ATTR_RE.lastIndex = 0;
  let m;
  while ((m = CLASS_ATTR_RE.exec(markup))) {
    m[2].split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
  }
  return classes;
}

/* ---------------- HTML side: classes assigned dynamically in <script> ---------------- */

// Any single/double/backtick-quoted string literal found inside a captured
// expression, tokenized on whitespace (so `'result-status ' + (over?'over':'under')`
// yields "result-status", "over", "under" from its three literals).
const QUOTED_STRING_RE = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

function tokensFromLiteralChunk(chunk) {
  const out = new Set();
  QUOTED_STRING_RE.lastIndex = 0;
  let m;
  while ((m = QUOTED_STRING_RE.exec(chunk))) {
    const raw = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]);
    raw.split(/\s+/).filter(Boolean).forEach(tok => {
      if (/^[a-zA-Z_][\w-]*$/.test(tok)) out.add(tok);
    });
  }
  return out;
}

const CLASSNAME_ASSIGN_RE = /\.className\s*=\s*([^;]+);/g;
// classList.toggle('x', cond) also *assigns* a class conditionally, so it
// counts as "referenced" the same as add/remove — only that way does e.g.
// `classList.toggle('active', ...)` correctly mark `.active` as used.
const CLASSLIST_CALL_RE = /\.classList\.(?:add|remove|toggle)\s*\(([^)]*)\)/g;

function classesFromScript(scriptContent) {
  const classes = new Set();

  CLASSNAME_ASSIGN_RE.lastIndex = 0;
  let m;
  while ((m = CLASSNAME_ASSIGN_RE.exec(scriptContent))) {
    tokensFromLiteralChunk(m[1]).forEach(c => classes.add(c));
  }

  CLASSLIST_CALL_RE.lastIndex = 0;
  while ((m = CLASSLIST_CALL_RE.exec(scriptContent))) {
    tokensFromLiteralChunk(m[1]).forEach(c => classes.add(c));
  }

  return classes;
}

/* ---------------- main ---------------- */

function main() {
  const htmlFiles = fs.readdirSync(ROOT)
    .filter(f => f.toLowerCase().endsWith('.html'))
    .filter(f => fs.statSync(path.join(ROOT, f)).isFile())
    .sort();

  if (htmlFiles.length === 0) {
    console.log('No .html files found in project root.');
    return;
  }

  const cssClassCache = new Map(); // href -> Set<string> | null (null = unreadable)

  function getCssClasses(href) {
    if (cssClassCache.has(href)) return cssClassCache.get(href);
    let classes = null;
    try {
      const css = fs.readFileSync(path.join(ROOT, href), 'utf8');
      classes = classesDefinedInCss(css);
    } catch (e) {
      classes = null;
    }
    cssClassCache.set(href, classes);
    return classes;
  }

  let anyUnused = false;

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const links = sharedCssLinks(html);

    console.log(`\n${file}`);

    if (links.length === 0) {
      console.log('  (links no shared stylesheet — skipping)');
      continue;
    }
    console.log(`  linked shared CSS: ${links.join(', ')}`);

    // class -> which linked file(s) define it
    const sharedClasses = new Map();
    for (const href of links) {
      const classes = getCssClasses(href);
      if (classes === null) {
        console.log(`  ! could not read linked stylesheet: ${href}`);
        continue;
      }
      for (const c of classes) {
        if (!sharedClasses.has(c)) sharedClasses.set(c, new Set());
        sharedClasses.get(c).add(href);
      }
    }

    const { markup, scriptContent } = splitHtml(html);
    const used = new Set([
      ...classesFromStaticHtml(markup),
      ...classesFromScript(scriptContent),
    ]);

    const unused = [...sharedClasses.keys()].filter(c => !used.has(c)).sort();

    console.log(`  shared classes defined: ${sharedClasses.size} | referenced here: ${sharedClasses.size - unused.length} | unreferenced: ${unused.length}`);

    if (unused.length === 0) {
      console.log('  ✅ every shared class is referenced somewhere in this file.');
    } else {
      anyUnused = true;
      console.log('  ⚠ shared classes never referenced (static or dynamic) in this file:');
      for (const c of unused) {
        const sources = [...sharedClasses.get(c)].join(', ');
        console.log(`      .${c}   [from ${sources}]`);
      }
    }
  }

  console.log('\n' + '-'.repeat(72));
  console.log(anyUnused
    ? 'Eyeball the ⚠ lines above: each is either fine (game-specific, not\nneeded here) or a silent styling bug like the one already caught in\nscuttle-addition-subtraction.html.'
    : 'No unreferenced shared classes found in any scanned file.');
}

main();
