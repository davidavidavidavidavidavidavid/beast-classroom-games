/* ==========================================================================
   BEAST CLASSROOM — SHARED GAME LOGIC
   Load via a script tag with src="shared-game.js" BEFORE a game's own
   inline script tag — same relationship as design-system.css, just for JS
   instead of CSS. See CLAUDE.md "File structure & the point of it" (the
   note on checking for JS duplication, not just CSS, before writing
   something new) and "Code conventions".

   (This file's own first draft named that closing tag literally, right
   here in this comment, and it broke every test that loads this file:
   the HTML parser ends a script element the instant it sees the exact
   byte sequence for a script close tag, even inside a JS comment or
   string — see CLAUDE.md Known traps. Say "closing script tag" in prose
   instead, the way the rest of this comment block does below.)

   Four kinds of code live here:
   1. Pure math (no DOM, no `st`) — dice rolls, permutations/combinations,
      digit arrangement. Safe to call from any game, any time.
   2. Game-shell scaffolding — screen swapping, the persistent scorecard,
      the top-bar score pills. These rely on DOM ids that are the SAME BY
      CONVENTION across every game (#scorecard, #sc-you-N/#sc-bot-N,
      #s-wins/#s-bwins/#s-ties — see Code conventions), and on each game
      having already defined its own `el = id => document.getElementById(id)`
      helper. What's genuinely game-specific (which screens exist, which
      arrays hold round values, how to format a value) is passed in as a
      parameter instead of assumed.
   3. Drag interactions — pointer-events-based dragging (never native HTML5
      drag-and-drop, which has poor/unreliable touch support and these
      games must work on tablets) plus the FLIP animation technique for
      animating a re-rendered DOM instead of popping — see
      design/mockups/drag-interactions-mockup.html and CLAUDE.md "Drag
      interactions". `prefersReducedMotion()` lives here too now (used to
      live duplicated per-file alongside the Celebration-animations effects
      — moved here once the drag/FLIP helpers below needed it too, so it
      wasn't worth a third copy).
   4. The global navigation bar (`renderGlobalNav()`, `GLOBAL_GAMES`) — see
      CLAUDE.md "Global navigation". Unlike everything above, this ISN'T
      parameterized per-game via arguments the caller already has to know
      — it owns its own canonical game list and injects its own markup via
      `document.body.insertBefore(...)`, so every page gets byte-identical
      nav behavior from ONE real implementation, not a convention every
      game's own script has to individually follow correctly.
   5. The Nim-family solver (`nimLegalMoves`, `nimImmediateWinMove`,
      `nimIsWinningPosition`, `nimOptimalMove`) — pure math, no DOM, same
      spirit as #1, just broken out on its own since it's a genuinely
      different KIND of pure math (a memoized combinatorial-game solver,
      not arithmetic/permutations). Extracted the moment a SECOND real Nim
      variant existed (`nim-nickeled-and-dimed.html`), not before — see
      CLAUDE.md "Where things stand" and "File structure & the point of
      it". Each game still owns its own `botEasy`/`botMedium`/`botHard`/
      `botChooseRound`/`decideWinner` (per Code Conventions) — only the
      shared "what's the actual best move from here" computation moved.

   Script-tag ordering: this file's own top level never touches `el` or any
   other page-defined global — only the function BODIES below do, and
   those aren't evaluated until a game's own script calls them, by which
   point its inline <script> has already run top-to-bottom and defined
   `el`. Classic (non-module) <script> tags share one global scope, so
   this works the same way test/jsdom-helpers.js's runInPage() comment
   describes for two <script> tags on one page. `renderGlobalNav()`
   specifically doesn't even need `el` — it builds its own elements and
   talks to `document` directly, so it works identically whether or not
   the calling page happens to define that helper.

   Currently linked by every shipped game (scuttle-addition-subtraction.html,
   scuttle-product.html, scuttle-difference.html, pop-addition/subtraction/
   expression/perimeter.html, beeline-product.html, nim.html, nim-nickeled-
   and-dimed.html, nim-subtraction.html, numbo-operations.html, detective-
   fraction-equivalence.html) plus every hub/sub-menu page (index.html,
   scuttle-menu.html, pop-menu.html, nim-menu.html), since
   `renderGlobalNav()` is needed on literally every page — the one function
   here that isn't opt-in per file. Everything else remains "checked for
   duplication so far," not assumed Scuttle-specific — see CLAUDE.md
   Suggested next steps for what hasn't been migrated yet.
   ========================================================================== */

/* ---------------- pure math ---------------- */

function rollDie(){ return Math.floor(Math.random()*10); }
function rollN(n){ return Array.from({length:n}, rollDie); }
function randInt(n){ return Math.floor(Math.random()*n); }

// Fisher-Yates shuffle, returning a NEW array (never mutates `arr`) — used
// by every Beeline-family game to randomize its claim-grid's cell layout
// fresh each match (see CLAUDE.md's Beeline post-playtest note: the board's
// SET of answer values stays fixed, only their positions vary), instead of
// always showing the same fixed arrangement.
function shuffleArray(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function permutations(arr){
  if (arr.length<=1) return [arr.slice()];
  const out=[];
  for (let i=0;i<arr.length;i++){
    const rest = arr.slice(0,i).concat(arr.slice(i+1));
    for (const p of permutations(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}
function combinations(arr,k){
  const results=[];
  function helper(start, combo){
    if (combo.length===k){ results.push(combo.slice()); return; }
    for (let i=start;i<arr.length;i++){ combo.push(arr[i]); helper(i+1,combo); combo.pop(); }
  }
  helper(0,[]);
  return results;
}
function buildNumber(digits, idxOrder){ return idxOrder.reduce((acc,i)=>acc*10+digits[i],0); }

// Every distinct value from arranging ALL of `digits` in a row (not split
// into two numbers — see Product Scuttle's own enumerateProductOptions for
// that), excluding a leading zero unless every digit is a 0, in which case
// there's no valid alternative and it's allowed. Generalizes the old
// 3-digit-only uniquePerms() so a future variant (e.g. Difference
// Scuttle's 2- or 4-digit numbers) doesn't need its own hardcoded copy of
// this — see CLAUDE.md "Leading zeros".
function uniqueArrangements(digits){
  const idx = digits.map((_, i) => i);
  const seen = new Set(); const out = [];
  for (const p of permutations(idx)){
    if (digits[p[0]] === 0) continue;
    const val = buildNumber(digits, p);
    if (!seen.has(val)){ seen.add(val); out.push(val); }
  }
  if (out.length === 0){
    for (const p of permutations(idx)){
      const val = buildNumber(digits, p);
      if (!seen.has(val)){ seen.add(val); out.push(val); }
    }
  }
  return out;
}

/* ---------------- game-shell scaffolding ---------------- */
// See the file header above: relies on `el` already being defined by the
// calling game, and on the DOM ids below being the same by convention.

// Fades the newly-active screen/scorecard in — replays a ~180ms opacity
// animation via the remove-class/reflow/add-class trick also used for
// `.shake` (see CLAUDE.md "Layout stability"). Call right after a node
// loses `.hidden`.
function fadeIn(node){
  node.classList.remove('fade-in');
  void node.offsetWidth;
  node.classList.add('fade-in');
}

// Screen-level swap: `.hidden` (display:none) toggle, per CLAUDE.md "Layout
// stability" — within-round phase content is a separate concern, handled
// by each game's own `.phase-hidden` toggles, not this. `screens` is the
// calling game's own `{ name: node }` map (its keys vary per game — Add/Sub
// has settings/round/compute/reveal, Product has settings/round/sum/
// reveal). The persistent `#scorecard` is hidden whenever `name ===
// 'settings'`, tied to the same swap, in every game.
function showScreen(screens, name){
  Object.entries(screens).forEach(([k,node]) => {
    const wasHidden = node.classList.contains('hidden');
    node.classList.toggle('hidden', k!==name);
    if (wasHidden && k===name) fadeIn(node);
  });
  const scorecard = el('scorecard');
  const scWasHidden = scorecard.classList.contains('hidden');
  const scNowHidden = name === 'settings';
  scorecard.classList.toggle('hidden', scNowHidden);
  if (scWasHidden && !scNowHidden) fadeIn(scorecard);
}

// Top-bar You/Bot/Ties pills. `score` is the calling game's `st.score`
// ({ human, bot, ties }).
function updateScorePills(score){
  el('s-wins').textContent = score.human;
  el('s-bwins').textContent = score.bot;
  el('s-ties').textContent = score.ties;
}

// Blanks the persistent scoreboard's 3 rounds back to "–" — purely
// DOM-id based, no game state needed.
function resetScorecard(){
  for (let i=1;i<=3;i++){
    const y = el('sc-you-'+i), b = el('sc-bot-'+i);
    y.textContent = '–'; y.classList.add('empty');
    b.textContent = '–'; b.classList.add('empty');
  }
}

// Fills in the persistent scoreboard's rounds as they lock in. `formatFn`
// lets a game keep its own display convention (Product passes
// `v => v.toLocaleString()`; Add/Sub omits it and gets its plain numbers
// back via the identity default).
function updateScorecard(humanValues, botValues, formatFn){
  formatFn = formatFn || (v => v);
  humanValues.forEach((v,i)=>{
    const y = el('sc-you-'+(i+1));
    y.textContent = formatFn(v); y.classList.remove('empty');
  });
  botValues.forEach((v,i)=>{
    const b = el('sc-bot-'+(i+1));
    b.textContent = formatFn(v); b.classList.remove('empty');
  });
}

/* ---------------- drag interactions ----------------
   See design/mockups/drag-interactions-mockup.html and CLAUDE.md "Drag
   interactions". Two pieces: makeDraggable() is the low-level pointer
   plumbing every drag needs regardless of what dragging MEANS in a given
   game; flipBefore()/flipAfter() is the FLIP technique for animating a
   full destroy-and-rebuild re-render instead of popping. Both respect
   prefersReducedMotion() below, same governing rule as every other
   animation in this project (see "Celebration animations"): a small fixed
   number of times, then rest static — never loop. */

function prefersReducedMotion(){
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* ---------------- TEMPORARY: which variants have the demo built ----------
   EXPERIMENTAL — see CLAUDE.md "Answer-explanation modal & stats-demo
   experiment". The variant files that actually have the answer-explanation
   work in them, marked with a dotted frame wherever games are listed so
   it's obvious which ones are worth opening in a demo. Kept here as ONE
   canonical list (same reasoning as GLOBAL_GAMES itself) so index.html's
   grid and each family's sub-menu can't drift apart — and so there's a
   single line to delete when the experiment ends. */
const DEMO_READY_HREFS = [
  'scuttle-addition-subtraction.html',
  'scuttle-product.html',
  'beeline-product.html',
  'beeline-rounding.html',
];
function isDemoReady(href){ return DEMO_READY_HREFS.indexOf(href) !== -1; }
// A game/family counts as demo-ready if any of its own variants is.
function gameHasDemo(g){
  if (Array.isArray(g.variants)) return g.variants.some(v => isDemoReady(v.href));
  return isDemoReady(g.href);
}
// For the sub-menu pages, whose variant cards are hand-written markup
// rather than rendered from GLOBAL_GAMES — marks them from the same one
// list instead of hardcoding the frame into each page's HTML.
function markDemoReadyCards(){
  document.querySelectorAll('a.variant-card[href]').forEach(card => {
    if (isDemoReady(card.getAttribute('href'))) card.classList.add('demo-framed');
  });
}

/* ---------------- staged step-reveal (EXPERIMENTAL) ----------------------
   See CLAUDE.md "Answer-explanation modal & stats-demo experiment". Same
   governing rule as every other animation in this project (see
   "Celebration animations"): plays a short, FIXED sequence once, then
   rests on the final frame — never loops — and skips straight to the
   final frame under prefers-reduced-motion. Paced off a whole-sequence
   budget rather than a fixed per-frame delay — see EXPLAIN_TOTAL_MS on
   showExplanationModal() below, which is what actually computes the
   msPerFrame passed in here. `frames` is an array of HTML strings — the
   LAST one is what stays showing once the sequence finishes, and is also
   what a caller can jump straight to early (see the returned stop()).
   Returns a `stop()` function: jumps immediately to the final frame and
   clears the timer — callers use this when the player dismisses the
   explanation before the animation finishes on its own, so speed-focused
   players are never forced to sit through it, and so the interval never
   leaks past the modal being dismissed. */
function revealSteps(containerEl, frames, msPerFrame, onDone){
  if (!frames || !frames.length){ if (onDone) onDone(); return () => {}; }
  if (prefersReducedMotion() || frames.length === 1){
    containerEl.innerHTML = frames[frames.length - 1];
    if (onDone) onDone();
    return () => {};
  }
  let i = 0;
  containerEl.innerHTML = frames[0];
  const timer = setInterval(() => {
    i++;
    containerEl.innerHTML = frames[i];
    if (i >= frames.length - 1){
      clearInterval(timer);
      if (onDone) onDone();
    }
  }, msPerFrame);
  return () => {
    clearInterval(timer);
    containerEl.innerHTML = frames[frames.length - 1];
  };
}

/* ---------------- answer-explanation modal (EXPERIMENTAL) ----------------
   See CLAUDE.md "Answer-explanation modal & stats-demo experiment" for the
   full story. Shared shell only, built once here since 3 simultaneous pilot
   consumers (Scuttle Add/Sub, Scuttle Product, Beeline Rounding) already
   meets this project's usual "wait for a second consumer" extraction bar at
   3+ real consumers (same threshold the Beeline two-row engine used). The
   bespoke visual FRAMES — column method, area model, number line — are
   entirely each calling game's own concern; this function only owns
   showing/hiding the modal shell, driving the shared revealSteps()
   animation into `.explain-modal-visual`, and firing `onContinue` exactly
   once. `answerHtml` is shown immediately, in full, the instant the modal
   opens — never staged behind the animation — so the real answer is never
   ambiguous or hint-like regardless of how the visual animates in.
   `visualFrames`/`msPerFrame` are passed straight through to revealSteps().
   Built lazily into the DOM on first call, not on page load, since not
   every page linking shared-game.js needs this. */
// Pacing is budgeted for the whole sequence rather than per frame, because
// frame COUNT varies a lot between (and within) the four representations —
// a no-carry column step is 2 frames, a 9-column Beeline array is 10 — so
// a fixed per-frame delay would make some explanations flash by and others
// drag. Dividing a budget alone isn't enough either: at 10 frames a pure
// division got fast enough to read as a flicker ("pacing is too fast"), so
// the result is clamped to a per-frame band. That makes the total
// approximate rather than exact, which is the right trade — no individual
// beat should ever be too quick to follow or slow enough to feel stalled.
// Callers can still pass an explicit msPerFrame to override all of this.
const EXPLAIN_TOTAL_MS = 7000;
const EXPLAIN_MIN_FRAME_MS = 700;
const EXPLAIN_MAX_FRAME_MS = 1800;

function showExplanationModal({ title, answerHtml, visualFrames, msPerFrame, onContinue }){
  let backdrop = document.getElementById('explain-modal-backdrop');
  if (!backdrop){
    backdrop = document.createElement('div');
    backdrop.id = 'explain-modal-backdrop';
    backdrop.className = 'explain-modal-backdrop hidden';
    backdrop.innerHTML =
      '<div class="explain-modal">' +
        '<div class="explain-modal-title" id="explain-modal-title"></div>' +
        '<div class="explain-modal-answer" id="explain-modal-answer"></div>' +
        '<div class="explain-modal-visual" id="explain-modal-visual"></div>' +
        '<button class="primary explain-modal-continue-btn" id="explain-modal-continue-btn">Got it — continue</button>' +
      '</div>';
    document.body.appendChild(backdrop);
  }
  document.getElementById('explain-modal-title').textContent = title;
  document.getElementById('explain-modal-answer').innerHTML = answerHtml;
  backdrop.classList.remove('hidden');
  const frameCount = (visualFrames && visualFrames.length) || 0;
  const budgeted = Math.round(EXPLAIN_TOTAL_MS / Math.max(1, frameCount - 1));
  const perFrame = msPerFrame ||
    Math.min(EXPLAIN_MAX_FRAME_MS, Math.max(EXPLAIN_MIN_FRAME_MS, budgeted));
  const stopReveal = revealSteps(document.getElementById('explain-modal-visual'), visualFrames, perFrame);
  // Replace (not just re-listen on) the continue button so a stale
  // onContinue closure from an earlier call can never also fire — plain
  // addEventListener would stack a second listener on the same persistent
  // node every time this function runs.
  const oldBtn = document.getElementById('explain-modal-continue-btn');
  const btn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(btn, oldBtn);
  btn.addEventListener('click', () => {
    stopReveal(); // jump to the final frame + clear the timer — harmless no-op if the reveal already finished on its own
    backdrop.classList.add('hidden');
    onContinue();
  }, { once: true });
}

// Low-level pointer-drag primitive. `el` is the element a drag starts on
// (pointerdown). `onMove(dx, dy, e)` fires on every pointermove with the
// delta from the drag's start position — nothing is snapped or resolved
// here, the caller decides what "following the pointer" looks like (a
// CSS transform, usually) and can do its own hit-testing in the same
// callback (e.g. Scuttle's swap-target highlight). `onDrop(dx, dy, e)`
// fires exactly once when the drag ends — pointerup and pointercancel are
// treated identically, since every caller's onDrop already resolves
// purely from where the pointer actually is, so an interrupted gesture
// just naturally finds no valid target rather than needing special
// handling. `dragClass` (default 'dragging') is toggled on `el` for
// whatever CSS hook the game's own stylesheet already has for it.
// Pointer capture keeps events flowing to `el` even once the pointer
// moves outside it, so listeners live on `el` itself, not `document` —
// this also means multiple simultaneous draggables need no shared state.
// Sets touch-action:none on `el` so a touch drag doesn't also try to
// scroll the page; every game's own CSS doesn't have to remember this.
// `setPointerCapture` doesn't exist in jsdom (no real pointer stack) —
// guarded so the smoke tests can dispatch real PointerEvents without it
// throwing; every real browser this ships to has it.
function makeDraggable(el, { onMove, onDrop, dragClass = 'dragging' } = {}){
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    el.classList.add(dragClass);
    if (typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId);

    function move(ev){
      if (onMove) onMove(ev.clientX - startX, ev.clientY - startY, ev);
    }
    function end(ev){
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      el.classList.remove(dragClass);
      if (onDrop) onDrop(ev.clientX - startX, ev.clientY - startY, ev);
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
}

// FLIP (First-Last-Invert-Play), for animating a full destroy-and-rebuild
// re-render instead of it just popping into the new layout. Call
// flipBefore() with the CURRENT elements right before tearing them down,
// keyed by `keyAttr` (an element's `dataset[keyAttr]` — a stable identity
// that survives the rebuild, e.g. Scuttle's underlying humanNums index,
// NOT its display position, which is exactly what changes on a swap).
// After rebuilding, call flipAfter() with the SAME keyAttr, the freshly
// rendered elements, and flipBefore()'s return value — each new element
// whose key matches an old position gets animated from where it USED to
// be to where it now is (an inverted transform played back to zero), so
// it visibly slides even though the DOM node itself is new. A key with no
// match in the snapshot (nothing to animate from) or a zero delta is
// left alone. prefers-reduced-motion skips straight to final position —
// no snapshot needed, so it's fine to call flipBefore() unconditionally
// and let flipAfter() decide.
function flipBefore(elements, keyAttr){
  const before = new Map();
  elements.forEach(el => { before.set(el.dataset[keyAttr], el.getBoundingClientRect()); });
  return before;
}
function flipAfter(elements, keyAttr, before, { duration = 220 } = {}){
  if (prefersReducedMotion()) return;
  elements.forEach(el => {
    const from = before.get(el.dataset[keyAttr]);
    if (!from) return;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left, dy = from.top - to.top;
    if (!dx && !dy) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    void el.offsetWidth; // force reflow so the transition below actually animates
    el.style.transition = `transform ${duration}ms ease`;
    el.style.transform = '';
    el.addEventListener('transitionend', () => {
      el.style.transition = '';
    }, { once: true });
  });
}

/* ---------------- global navigation bar ----------------
   See CLAUDE.md "Global navigation". A persistent thin bar, fixed to the
   top of EVERY page (every game, index.html, and each game family's own
   sub-menu) — sits ABOVE a game's existing round/difficulty/score top bar,
   never replaces it. Injected via JS (prepended to document.body) rather
   than duplicated as static HTML in every file — same "one edit changes
   everything" reasoning as design-system.css itself; the actual markup
   exists in exactly one place, this function. The CSS half (#global-nav
   and its children, plus the body/#app top-padding that keeps page
   content from rendering underneath the fixed bar) lives in
   design-system.css, since every page already shares that file too.

   `GLOBAL_GAMES` is the ONE canonical game list — both this nav bar's
   dropdown and index.html's own landing-page cards read from it, so they
   can never drift out of sync with each other. `status: 'playable'` means
   at least one real variant is shipped. `status: 'locked'` means
   catalogued but not yet built (no `href` — nothing to link to yet).

   `href` always points straight at a real, playable FILE — a single
   variant's own file for a single-variant game, or a multi-variant game's
   own DEFAULT (first-listed) variant for one with several — never at a
   "choose your variant" menu page. This is a deliberate post-testing
   correction (see CLAUDE.md "Where things stand"'s navigation redesign
   note): clicking "Play" anywhere (the hub, the nav dropdown) should always
   land you directly in a real game, not on another menu to click through.
   `variants` (multi-variant games only) is the ordered list of that
   family's own shipped files — `{name, href}` per variant, family order
   (matches each family's own former `*-menu.html` listing) — index.html's
   own card reads this to render its expandable "N variants" disclosure,
   and each variant FILE reads it too (via `renderVariantSwitcher()` below)
   to render its own in-game switcher, so a player who lands on one variant
   can jump straight to a sibling without going back to the hub at all. The
   old `*-menu.html` sub-menu pages (scuttle-menu.html, pop-menu.html,
   nim-menu.html) still exist and still work if linked to directly, but
   nothing in the primary nav paths points at them anymore — see that same
   design note for why they were kept rather than deleted. */
const GLOBAL_GAMES = [
  { key: 'scuttle',   name: 'Scuttle',   status: 'playable', href: 'scuttle-addition-subtraction.html', multiVariant: true,
    variants: [
      { name: 'Addition & Subtraction', href: 'scuttle-addition-subtraction.html' },
      { name: 'Product', href: 'scuttle-product.html' },
      { name: 'Difference', href: 'scuttle-difference.html' },
    ],
    desc: 'Build numbers from rolled dice and race to (or over) a target — closest-to-target, product, and difference variants.' },
  { key: 'pop',       name: 'Pop',       status: 'playable', href: 'pop-addition.html', multiVariant: true,
    variants: [
      { name: 'Addition', href: 'pop-addition.html' },
      { name: 'Subtraction', href: 'pop-subtraction.html' },
      { name: 'Expression', href: 'pop-expression.html' },
      { name: 'Perimeter', href: 'pop-perimeter.html' },
    ],
    desc: 'One digit at a time, no take-backs — place each roll into your number or a throw-away before it’s gone for good.' },
  { key: 'beeline',   name: 'Beeline',   status: 'playable', href: 'beeline-product.html', multiVariant: true,
    variants: [
      { name: 'Product', href: 'beeline-product.html' },
      { name: 'Difference', href: 'beeline-difference.html' },
      { name: 'Addition', href: 'beeline-addition.html' },
      { name: 'Decimal', href: 'beeline-decimal.html' },
      { name: 'Rounding', href: 'beeline-rounding.html' },
      { name: 'Equivalent Fraction', href: 'beeline-equivalent-fraction.html' },
    ],
    desc: 'Move your token(s) along a number row, mark the value on the board, and connect four in a row before the bot does.' },
  { key: 'nim',       name: 'Nim',       status: 'playable', href: 'nim.html', multiVariant: true,
    variants: [
      { name: 'Race to 10', href: 'nim.html' },
      { name: 'Nickeled & Dimed', href: 'nim-nickeled-and-dimed.html' },
      { name: 'Subtraction Nim', href: 'nim-subtraction.html' },
    ],
    desc: 'Take turns adding to (or removing from) a running total — no dice, pure strategy, race to (or away from) a target.' },
  { key: 'numbo',     name: 'Numbo',     status: 'playable', href: 'numbo-operations.html', desc: 'Roll digits and build the expression closest to a target using every operation you’ve got.' },
  { key: 'detective', name: 'Detective', status: 'playable', href: 'detective-fraction-equivalence.html', desc: 'A Wordle-style puzzle — guess the equivalent fraction hiding in plain sight, one digit at a time.' },
  // Everything below is catalogued in design/game-catalog.csv but not yet
  // built — see CLAUDE.md "Where things stand" / "Suggested next steps".
  // Only Pig and Math Match are kept visible here, at the user's explicit
  // direction (2026-09-15) — every other catalogued-but-unbuilt game was
  // removed from this list, not just hidden, since GLOBAL_GAMES is the ONE
  // canonical source both index.html's cards AND the nav dropdown read from
  // (see "Global navigation") — trimming it here is what actually declutters
  // both surfaces at once, rather than needing a second, separate filter.
  // The full 41-entry catalogue this trimmed still lives in
  // design/game-catalog.csv and this file's own git history if any of them
  // need to come back.
  { key: 'math-match', name: 'Math Match', status: 'locked', desc: 'Flip two cards, keep them if they match by the variant’s rule — most matched cards wins.' },
  { key: 'pig', name: 'Pig', status: 'locked', desc: 'Roll repeatedly to build up points — bust and lose the round’s points, or bank them anytime.' },
];

// `currentKey` is this page's own game key (one of GLOBAL_GAMES' `key`
// values) — omit/pass null on index.html itself, where no single game is
// "current." Idempotent (checks for its own id first) so calling it twice
// on one page (e.g. by accident) never double-injects the bar.
function renderGlobalNav(currentKey){
  if (document.getElementById('global-nav')) return;

  const nav = document.createElement('nav');
  nav.id = 'global-nav';

  const wordmark = document.createElement('a');
  wordmark.id = 'global-nav-wordmark';
  wordmark.href = 'index.html';
  wordmark.textContent = 'Beast Classroom';
  nav.appendChild(wordmark);

  const gamesWrap = document.createElement('div');
  gamesWrap.id = 'global-nav-games';

  const toggle = document.createElement('button');
  toggle.id = 'global-nav-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Games ▾';
  gamesWrap.appendChild(toggle);

  const dropdown = document.createElement('div');
  dropdown.id = 'global-nav-dropdown';
  dropdown.className = 'hidden';
  GLOBAL_GAMES.forEach(g => {
    const isCurrent = g.key === currentKey;
    const isLocked = g.status === 'locked';
    const row = document.createElement(isLocked ? 'div' : 'a');
    row.className = 'global-nav-item' + (isCurrent ? ' current' : '') + (isLocked ? ' locked' : '');
    if (!isLocked) row.href = g.href;
    const label = document.createElement('span');
    label.textContent = g.name;
    row.appendChild(label);
    const status = document.createElement('span');
    status.className = 'global-nav-status';
    status.textContent = isCurrent ? 'current' : (isLocked ? 'coming soon' : 'playable');
    row.appendChild(status);
    dropdown.appendChild(row);
  });
  gamesWrap.appendChild(dropdown);
  nav.appendChild(gamesWrap);

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => { dropdown.classList.add('hidden'); });

  const currentGame = GLOBAL_GAMES.find(g => g.key === currentKey);
  if (currentGame){
    const label = document.createElement('span');
    label.id = 'global-nav-current';
    label.textContent = currentGame.name;
    nav.appendChild(label);
  }

  document.body.insertBefore(nav, document.body.firstChild);
}

// `renderVariantSwitcher(containerId, currentKey, currentHref)` — the
// in-game half of the same navigation redesign `renderGlobalNav()`'s
// `href` change serves (see GLOBAL_GAMES' own comment above): once a
// player has landed on ONE variant of a multi-variant game family
// (Scuttle, Pop, Nim), this lets them jump straight to a SIBLING variant
// without going back to the hub. Reads the same `GLOBAL_GAMES[key]
// .variants` list index.html's own expandable card disclosure reads, so
// the two surfaces can't drift out of sync with each other — same
// principle as GLOBAL_GAMES itself.
//
// `containerId` is a `<div class="chip-row" id="...">` the calling game's
// own settings-screen markup already defines (same convention as that
// game's own difficulty chip-row — see Code conventions) — this function
// only POPULATES it, matching every other per-game "the game defines the
// DOM, a helper fills it in" pattern in this file. `currentHref` is that
// same file's own filename, passed explicitly by the caller (e.g.
// 'scuttle-addition-subtraction.html') rather than inferred from
// `location.pathname` — every test in this project loads a game's raw
// HTML into a fixed fake URL (jsdom's `url: 'http://localhost/'` in
// jsdom-helpers.js, no `document` at all in vm-load-page.js's bare
// sandbox), so `location` can never actually identify which file's
// content is running; passing it explicitly is also just the same
// "genuinely game-specific info is a parameter, not assumed" principle
// this file's own header comment already states for its game-shell
// scaffolding. A no-op (renders nothing, leaves the container empty) if
// the game has no `variants` list or only one entry, so it's always safe
// to call unconditionally — no per-file "do I actually have siblings?"
// check needed at the call site. The CURRENT file's own entry renders as
// a non-navigating `.active` chip (styled distinctly, per the shared
// `.chip`/`.chip-row` look every settings screen already uses for
// difficulty) rather than a link back to itself; every sibling renders as
// a real `<a>` to that file.
function renderVariantSwitcher(containerId, currentKey, currentHref){
  const container = document.getElementById(containerId);
  if (!container) return;
  const game = GLOBAL_GAMES.find(g => g.key === currentKey);
  if (!game || !Array.isArray(game.variants) || game.variants.length < 2) return;

  container.innerHTML = '';
  game.variants.forEach(v => {
    const isCurrent = v.href === currentHref;
    if (isCurrent){
      const chip = document.createElement('span');
      chip.className = 'chip active';
      chip.textContent = v.name;
      container.appendChild(chip);
    } else {
      const chip = document.createElement('a');
      chip.className = 'chip';
      chip.href = v.href;
      chip.textContent = v.name;
      container.appendChild(chip);
    }
  });
}

/* ---------------- Nim-family solver ----------------
   Shared by the whole Nim family (nim.html, nim-nickeled-and-dimed.html,
   and any future variant with this same "running total, race to a
   target, alternating moves from a fixed set" shape) — see CLAUDE.md
   "Bot AI philosophy" and "Where things stand". Extracted the moment a
   SECOND real consumer existed, not before — same "don't just extract
   shared CSS/JS preemptively" discipline as everywhere else.

   Works in terms of `distanceToTarget` (target - current total), not the
   raw total, and the REAL move sizes for whichever variant is calling —
   nim.html passes `moveSet=[1,2]`; nim-nickeled-and-dimed.html passes the
   actual coin values `moveSet=[5,10]` against its own real distance-to-50.
   No divide-by-5/multiply-back rescaling layer is needed: the same
   recursive minimax handles either scale directly, since nothing in it
   assumes a particular move-set shape (verified directly against base
   Nim's already-solved game in test/decide-winner.nim-nickeled-and-
   dimed.test.js, rather than just trusted).

   `reachOrExceed` (default true, matching base Nim's "10 or more wins")
   is the one real per-variant difference this solver can't paper over:
   Nickeled & Dimed's actual rule is landing on EXACTLY 50 — overshooting
   passes the target by without winning, and (since every reachable total
   stays a multiple of 5 when only nickels/dimes are ever added) would
   otherwise make the target permanently unreachable from that point on.
   Pass `false` for any variant with that shape. This also controls which
   moves are even LEGAL to consider (`nimLegalMoves`): under
   `reachOrExceed`, any move is fine (overshoot wins); otherwise, only
   moves that don't exceed `distanceToTarget` are offered at all — see
   CLAUDE.md's Nickeled & Dimed design note for why this (not a bust rule,
   not "the game just continues") is the deliberate fix for the
   permanently-unreachable-target problem. */

const nimSolveCache = new Map();

// Every move that's actually selectable from here — under `reachOrExceed`,
// that's the whole set (overshooting is always fine, so nothing is ever
// excluded); otherwise, only moves that don't pass the target.
function nimLegalMoves(distanceToTarget, moveSet, reachOrExceed = true){
  return reachOrExceed ? moveSet.slice() : moveSet.filter(m => m <= distanceToTarget);
}

// The first legal move that ends the game right now, or null if none does.
function nimImmediateWinMove(distanceToTarget, moveSet, reachOrExceed = true){
  for (const m of nimLegalMoves(distanceToTarget, moveSet, reachOrExceed)){
    const isWin = reachOrExceed ? m >= distanceToTarget : m === distanceToTarget;
    if (isWin) return m;
  }
  return null;
}

// Is the player about to move, facing `distanceToTarget` remaining, in a
// forced-win position under perfect play? Memoized — the cache key folds
// in the move set and reachOrExceed flag too, since multiple Nim variants
// share this one cache but must never see each other's answers.
function nimIsWinningPosition(distanceToTarget, moveSet, reachOrExceed = true){
  const key = moveSet.join(',') + '|' + reachOrExceed + '|' + distanceToTarget;
  if (nimSolveCache.has(key)) return nimSolveCache.get(key);
  let canWin = nimImmediateWinMove(distanceToTarget, moveSet, reachOrExceed) !== null;
  if (!canWin){
    for (const m of nimLegalMoves(distanceToTarget, moveSet, reachOrExceed)){
      const remaining = distanceToTarget - m;
      if (remaining > 0 && !nimIsWinningPosition(remaining, moveSet, reachOrExceed)) { canWin = true; break; }
    }
  }
  nimSolveCache.set(key, canWin);
  return canWin;
}

// The actual best move from `distanceToTarget` — prefers an immediate win,
// else a move that leaves the opponent facing a position
// nimIsWinningPosition says THEY can't win from, else (a true loss no
// matter what) any legal move, since it genuinely doesn't matter which.
function nimOptimalMove(distanceToTarget, moveSet, reachOrExceed = true){
  const immediate = nimImmediateWinMove(distanceToTarget, moveSet, reachOrExceed);
  if (immediate !== null) return immediate;
  const legal = nimLegalMoves(distanceToTarget, moveSet, reachOrExceed);
  for (const m of legal){
    const remaining = distanceToTarget - m;
    if (remaining > 0 && !nimIsWinningPosition(remaining, moveSet, reachOrExceed)) return m;
  }
  return legal[randInt(legal.length)];
}

/* ---------------- Beeline two-row engine ----------------
   Shared by every TWO-ROW Beeline variant (Difference, Addition, Decimal,
   Rounding, Equivalent Fraction — see CLAUDE.md "Where things stand"): one
   token per row, moved independently; a per-variant VALUE FUNCTION turns
   the pair of row-token positions into the value claimed on the shared
   36-cell grid. Extracted here the moment 5 real two-row consumers existed
   at once — a far stronger case than the usual "wait for a second
   consumer" bar (see "File structure & the point of it").

   Deliberately NOT shared with beeline-product.html's own ONE-ROW engine
   (two tokens sharing a single row, kept local to that file per its
   existing "don't do a big unrelated migration" restraint — see CLAUDE.md).
   The two shapes only look similar; setup here places ONE token per row
   from that row's OWN range (rowA and rowB are not interchangeable the way
   Product's shared-row tokens are), so the setup enumeration genuinely
   differs — only the win-detection/minimax machinery is truly identical
   between the two shapes (it only ever looks at `owner`/grid geometry,
   never at what a "move" or "value" means), which is exactly what's
   shared below.

   Includes the anti-stalemate rule from the very first line, already in
   its PROVEN-correct shape — not the simpler "forbid only the immediate
   reversal" version, which real playtesting AND a direct simulation both
   showed was insufficient (a longer, non-2-cycle repeat could still stall
   the game — see beeline-product.html's own design note for the full
   story). `visited` is a Set of "a,b" tokens-config keys already reached
   THIS game; forbidding a move into any of them (not just the
   immediately-prior one) guarantees real forward progress, since only 36
   × up to a handful of row-range combinations exist and the board (36
   cells) fills or someone wins long before they could all be exhausted.
   Applied only at the top-level move actually being chosen, not threaded
   through minimax's own bounded-depth lookahead (which already always
   terminates regardless — see the same design note). */

const BEELINE_W = 6, BEELINE_H = 6;
const BEELINE_DIRS = [[0,1],[1,0],[1,1],[1,-1]];
const BEELINE_OTHER = { human: 'bot', bot: 'human' };

function beelineTokensKey(tokens){ return tokens[0] + ',' + tokens[1]; }

// rowRanges: [[minA,maxA],[minB,maxB]] — row A's legal token range, row B's
// (independent ranges, since the two rows can mean genuinely different
// things — e.g. Rounding Beeline's tens-digit row vs. ones-digit row).
function beelineLegalMoves(state, rowRanges, visited){
  if (state.tokens === null){
    const moves = [];
    for (let a = rowRanges[0][0]; a <= rowRanges[0][1]; a++){
      for (let b = rowRanges[1][0]; b <= rowRanges[1][1]; b++){
        moves.push({ type:'setup', a, b });
      }
    }
    return moves;
  }
  const moves = [];
  for (let idx = 0; idx < 2; idx++){
    const lo = rowRanges[idx][0], hi = rowRanges[idx][1];
    for (let pos = lo; pos <= hi; pos++){
      if (pos !== state.tokens[idx]) moves.push({ type:'move', idx, pos });
    }
  }
  if (!visited) return moves;
  const filtered = moves.filter(m => {
    const candidate = state.tokens.slice(); candidate[m.idx] = m.pos;
    return !visited.has(beelineTokensKey(candidate));
  });
  return filtered.length > 0 ? filtered : moves;
}

// valueFn(tokens) -> this variant's own claimed value (a number, or a
// string key for a non-numeric value like Equivalent Fraction Beeline's
// reduced "na/nb"). valueToCells: Map<value, number[]> — the cell
// indices holding that value. Usually length 1 per value (an exact 1:1
// fit, like Product/Decimal Beeline's own boards), but a variant whose
// achievable-value count is smaller than 36 repeats a value across
// several cells (see each variant's own board-building comment) — the
// FIRST currently-unclaimed cell among them is what actually gets marked;
// if all of them are already claimed, this is a wasted turn, the exact
// same "already claimed" rule every Beeline variant already has.
function beelineApplyMove(state, move, symbol, valueFn, valueToCells){
  const owner = state.owner.slice();
  let tokens;
  if (move.type === 'setup') tokens = [move.a, move.b];
  else { tokens = state.tokens.slice(); tokens[move.idx] = move.pos; }
  const value = valueFn(tokens);
  const cells = valueToCells.get(value) || [];
  const openCell = cells.find(i => owner[i] === null);
  let marked = false, cellIdx = cells.length ? cells[0] : null;
  if (openCell !== undefined){ owner[openCell] = symbol; marked = true; cellIdx = openCell; }
  return { state: { owner, tokens }, marked, cellIdx, value };
}

function beelineBoardFull(owner){ return owner.every(o => o !== null); }

function beelineHasFourInRow(owner, symbol){
  for (let r=0; r<BEELINE_H; r++) for (let c=0; c<BEELINE_W; c++){
    if (owner[r*BEELINE_W+c] !== symbol) continue;
    for (const [dr,dc] of BEELINE_DIRS){
      let count = 1;
      for (let k=1; k<4; k++){
        const rr=r+dr*k, cc=c+dc*k;
        if (rr<0||rr>=BEELINE_H||cc<0||cc>=BEELINE_W||owner[rr*BEELINE_W+cc]!==symbol) break;
        count++;
      }
      if (count>=4) return true;
    }
  }
  return false;
}

function beelineFindWinningLine(owner, symbol){
  for (let r=0; r<BEELINE_H; r++) for (let c=0; c<BEELINE_W; c++){
    if (owner[r*BEELINE_W+c] !== symbol) continue;
    for (const [dr,dc] of BEELINE_DIRS){
      const cells = [r*BEELINE_W+c];
      for (let k=1; k<4; k++){
        const rr=r+dr*k, cc=c+dc*k;
        if (rr<0||rr>=BEELINE_H||cc<0||cc>=BEELINE_W||owner[rr*BEELINE_W+cc]!==symbol) break;
        cells.push(rr*BEELINE_W+cc);
      }
      if (cells.length>=4) return cells.slice(0,4);
    }
  }
  return null;
}

// Win condition (pure — see CLAUDE.md Code conventions). Each consumer
// file still defines its OWN top-level `decideWinner`, per that
// convention — a thin one-line call into this shared function, not a
// re-derivation.
function beelineDecideWinner(owner){
  if (beelineHasFourInRow(owner, 'human')) return 'human';
  if (beelineHasFourInRow(owner, 'bot')) return 'bot';
  if (beelineBoardFull(owner)) return 'tie';
  return null;
}

function beelineLongestRunThrough(owner, idx, symbol){
  const r0 = Math.floor(idx/BEELINE_W), c0 = idx%BEELINE_W;
  let best = 1;
  for (const [dr,dc] of BEELINE_DIRS){
    let count = 1;
    for (let k=1;k<4;k++){ const rr=r0+dr*k, cc=c0+dc*k; if (rr<0||rr>=BEELINE_H||cc<0||cc>=BEELINE_W||owner[rr*BEELINE_W+cc]!==symbol) break; count++; }
    for (let k=1;k<4;k++){ const rr=r0-dr*k, cc=c0-dc*k; if (rr<0||rr>=BEELINE_H||cc<0||cc>=BEELINE_W||owner[rr*BEELINE_W+cc]!==symbol) break; count++; }
    if (count>best) best = count;
  }
  return best;
}

const BEELINE_WINDOWS = (() => {
  const wins = [];
  for (let r=0; r<BEELINE_H; r++) for (let c=0; c<BEELINE_W; c++){
    for (const [dr,dc] of BEELINE_DIRS){
      const cells = []; let ok = true;
      for (let k=0;k<4;k++){ const rr=r+dr*k, cc=c+dc*k; if (rr<0||rr>=BEELINE_H||cc<0||cc>=BEELINE_W){ ok=false; break; } cells.push(rr*BEELINE_W+cc); }
      if (ok) wins.push(cells);
    }
  }
  return wins;
})();
const BEELINE_WEIGHT = { 1:1, 2:12, 3:150, 4:100000 };

function beelineEvaluate(owner, symbol){
  const opp = BEELINE_OTHER[symbol];
  let score = 0;
  for (const cells of BEELINE_WINDOWS){
    let mine=0, theirs=0;
    for (const idx of cells){ if (owner[idx]===symbol) mine++; else if (owner[idx]===opp) theirs++; }
    if (mine>0 && theirs===0) score += BEELINE_WEIGHT[mine];
    else if (theirs>0 && mine===0) score -= BEELINE_WEIGHT[theirs];
  }
  return score;
}

function beelineMinimax(state, symbol, toMove, depth, alpha, beta, rowRanges, valueFn, valueToCells){
  if (beelineHasFourInRow(state.owner, symbol)) return 100000+depth;
  if (beelineHasFourInRow(state.owner, BEELINE_OTHER[symbol])) return -100000-depth;
  if (beelineBoardFull(state.owner) || depth===0) return beelineEvaluate(state.owner, symbol);
  const moves = beelineLegalMoves(state, rowRanges); // no `visited` here — unconstrained hypothetical lookahead, see header comment
  const maximizing = toMove===symbol;
  let value = maximizing ? -Infinity : Infinity;
  for (const m of moves){
    const applied = beelineApplyMove(state, m, toMove, valueFn, valueToCells);
    const next = beelineMinimax(applied.state, symbol, BEELINE_OTHER[toMove], depth-1, alpha, beta, rowRanges, valueFn, valueToCells);
    if (maximizing){ value=Math.max(value,next); alpha=Math.max(alpha,value); }
    else { value=Math.min(value,next); beta=Math.min(beta,value); }
    if (beta<=alpha) break;
  }
  return value;
}

const BEELINE_HARD_DEPTH = 4;

function beelineBotHard(state, symbol, rowRanges, valueFn, valueToCells, visited){
  const moves = beelineLegalMoves(state, rowRanges, visited);
  let best = null;
  for (const m of moves){
    const applied = beelineApplyMove(state, m, symbol, valueFn, valueToCells);
    let score;
    if (applied.marked && beelineHasFourInRow(applied.state.owner, symbol)) score = 200000;
    else score = beelineMinimax(applied.state, symbol, BEELINE_OTHER[symbol], BEELINE_HARD_DEPTH-1, -Infinity, Infinity, rowRanges, valueFn, valueToCells);
    if (!best || score>best.score) best = { m, score };
  }
  return best.m;
}

function beelineBotMedium(state, symbol, rowRanges, valueFn, valueToCells, visited){
  const moves = beelineLegalMoves(state, rowRanges, visited);
  const scored = moves.map(m => {
    const applied = beelineApplyMove(state, m, symbol, valueFn, valueToCells);
    const runLen = applied.marked ? beelineLongestRunThrough(applied.state.owner, applied.cellIdx, symbol) : 0;
    return { m, marked: applied.marked, runLen };
  });
  const openMoves = scored.filter(s=>s.marked);
  const pool = openMoves.length>0 ? openMoves : scored;
  const bestRun = Math.max(...pool.map(s=>s.runLen));
  const best = pool.filter(s=>s.runLen===bestRun);
  return best[randInt(best.length)].m;
}

function beelineBotEasy(state, rowRanges, visited){
  const moves = beelineLegalMoves(state, rowRanges, visited);
  return moves[randInt(moves.length)];
}

// Round-robin board builder: fills a 36-cell grid from a list of distinct
// achievable values, repeating from the start of the list as needed
// (`distinctValues[i % distinctValues.length]`) — divides evenly when
// distinctValues.length divides 36 (Difference Beeline's 9, Rounding
// Beeline's 9), spreads any remainder across the FIRST few values
// otherwise (Addition Beeline's 17), and degenerates to "each value
// exactly once" when distinctValues.length is already 36 (Decimal
// Beeline's own deliberately-scoped 6x6=36 range — see its own comment).
// Every consumer shuffles the RESULT (shared-game.js's own shuffleArray())
// at match start for cell-position randomization — see CLAUDE.md's
// Beeline post-playtest note — same as Product Beeline.
function beelineBuildBoardValues(distinctValues, cellCount){
  cellCount = cellCount || 36;
  const out = [];
  for (let i = 0; i < cellCount; i++) out.push(distinctValues[i % distinctValues.length]);
  return out;
}
function beelineBuildValueToCells(values){
  const map = new Map();
  values.forEach((v, i) => {
    if (!map.has(v)) map.set(v, []);
    map.get(v).push(i);
  });
  return map;
}
