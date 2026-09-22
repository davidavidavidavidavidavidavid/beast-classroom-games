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
// The frame alone can't say what it means, so every marked thing also gets
// a DEMO chip, and each listing page gets one legend line.
function demoBadgeEl(){
  const b = document.createElement('span');
  b.className = 'badge demo';
  b.textContent = 'Demo';
  return b;
}
function demoLegendEl(){
  const wrap = document.createElement('div');
  wrap.className = 'demo-legend';
  wrap.appendChild(demoBadgeEl());
  wrap.appendChild(document.createTextNode('= has the new answer-explanation demo built in'));
  return wrap;
}

// For the sub-menu pages, whose variant cards are hand-written markup
// rather than rendered from GLOBAL_GAMES — marks them from the same one
// list instead of hardcoding the frame into each page's HTML.
function markDemoReadyCards(){
  let marked = 0;
  document.querySelectorAll('a.variant-card[href]').forEach(card => {
    if (!isDemoReady(card.getAttribute('href'))) return;
    card.classList.add('demo-framed');
    const top = card.querySelector('.variant-top');
    const name = top && top.querySelector('.variant-name');
    if (name && !top.querySelector('.badge.demo')){
      const wrap = document.createElement('span');
      wrap.className = 'variant-name-wrap';
      name.parentNode.insertBefore(wrap, name);
      wrap.appendChild(name);
      wrap.appendChild(demoBadgeEl());
    }
    marked++;
  });
  const list = document.querySelector('.variant-list');
  if (marked && list && !document.querySelector('.demo-legend')){
    list.parentNode.insertBefore(demoLegendEl(), list);
  }
}

/* ---------------- advance-control stacking -----------------------------
   Collects a screen's "advance the game" wrappers into one .action-stack
   at the bottom of that screen, so the button the player clicks to move
   forward is always in the same place instead of migrating up and down
   the card between steps. See design-system.css's .action-stack block.
   Pass only wrappers whose content is a bare advance BUTTON — an
   answer-check row (input + submit) is a different kind of control and
   stays where it is. Order in the array is irrelevant; they overlap. */
function stackAdvanceControls(screenId, wrapperIds){
  const screen = document.getElementById(screenId);
  if (!screen || screen.querySelector('.action-stack')) return;
  const wraps = wrapperIds.map(id => document.getElementById(id)).filter(Boolean);
  if (wraps.length < 2) return; // nothing to keep consistent with
  const stack = document.createElement('div');
  stack.className = 'action-stack';
  screen.appendChild(stack);
  wraps.forEach(w => {
    // These carry their own spacing for their old position in the flow;
    // inside the overlap cell it would offset them from each other.
    w.style.marginTop = '';
    w.style.marginBottom = '';
    stack.appendChild(w);
  });
}

/* ---------------- stats / reporting ------------------------------------
   A skill is the thing a player actually practises, which is NOT the same
   as a game: several games train one skill (Beeline Difference and Scuttle
   Difference are both subtraction), and one game family spreads across
   several. So stats are keyed by skill, with the games that feed each one
   listed alongside — that's what makes "open this from Product Beeline and
   see Multiplication facts already expanded" possible.
   Every NUMBER here is sample data, same as stats-demo.html: nothing in
   this project records real play yet. The skill->games mapping, though, is
   real and worth keeping accurate as games get built. */
const SKILL_STATS = [
  /* FACTS bucket (design/fluency-tracking-design-plan.md): a finite,
     enumerable set, so the lower tier is a grid of every individual fact.
     Product Beeline's own token row is ROWMIN=1..ROWMAX=9, so the grid is
     9x9 — the facts this game can actually produce, not a generic 10x10.
     `overall` is COMPUTED from the cells rather than stored, so the
     headline number can never contradict the grid underneath it.
     Mock data, shaped like a real class: 1s/2s/5s land early and reliably,
     the 6-8 square is the weak cluster, a handful of pairs have not come
     up on this board yet (null = no evidence, which is NOT the same as
     scoring zero). */
  { id: 'mult-facts', name: 'Multiplication Facts', type: 'facts',
    games: ['beeline-product.html', 'lightning-multiplication.html'],
    totalTime: '2h 05m', lastPlayed: 'Yesterday',
    factGrid: {
      min: 1, max: 9,
      rows: [
        [97, 94, 84, 69, 92, 85, 64, 76, 83],
        [92, 89, 75, 75, 84, 70, 65, 81, 71],
        [89, 79, 93, 69, 84, 65, 58, 53, 64],
        [69, 72, 67, 66, 78, 58, 56, 58, 62],
        [96, 86, 82, 78, 94, 72, 70, 64, 79],
        [82, 79, 68, 57, 85, 45, 46, 48, null],
        [73, 65, 68, 45, 70, 40, 43, null, 59],
        [72, 66, 50, 58, 65, 48, null, 63, null],
        [88, 67, 73, 68, 78, null, 61, 46, 62],
      ],
    } },
  /* PROCEDURES bucket: not enumerable, so the lower tier is a taxonomy of
     sub-skills rather than a grid. All three rows are shown for taxonomy
     completeness; only the one this game actually generates evidence for
     is marked. Addition & Subtraction Scuttle combines THREE numbers with
     TWO operators (see design/game-rules-index.md), so its evidence is
     genuinely multi-step — it says nothing about single-operation addition
     or subtraction, and the view must not imply otherwise. */
  { id: 'add-sub-large', name: 'Addition and Subtraction of Larger Numbers',
    type: 'procedures', games: ['scuttle-addition-subtraction.html', 'lightning-multi-step.html'],
    totalTime: '1h 12m', lastPlayed: 'Just now',
    /* `evidenceFrom` lists which GAMES feed each row. The highlight is then
       derived from the page you opened the panel FROM — it is not a
       property of the data. Opened from the hub, nothing is highlighted;
       opened from Scuttle Add/Sub, that game's row is. A hardcoded
       `evidence: true` highlighted the row no matter how you got there,
       which said "this row is special" rather than "this row is where your
       numbers from THIS game went". */
    subSkills: [
      { name: 'Addition', score: 79, attempts: 132, evidenceFrom: [] },
      { name: 'Subtraction', score: 61, attempts: 104, evidenceFrom: [] },
      { name: 'Multi-step problems', score: 52, attempts: 47,
        evidenceFrom: ['scuttle-addition-subtraction.html', 'lightning-multi-step.html'] },
    ] },
  { id: 'mult-multi', name: 'Multi-digit multiplication', games: ['scuttle-product.html'],
    correct: 27, attempts: 40, totalTime: '48m', lastPlayed: '2 hours ago' },
  { id: 'sub-facts', name: 'Subtraction facts', games: ['beeline-difference.html', 'scuttle-difference.html'],
    correct: 24, attempts: 31, totalTime: '35m', lastPlayed: '4 hours ago' },
  { id: 'rounding', name: 'Rounding', games: ['beeline-rounding.html'],
    correct: 14, attempts: 28, totalTime: '22m', lastPlayed: '3 days ago' },
  { id: 'decimals', name: 'Decimals', games: ['beeline-decimal.html'],
    correct: 18, attempts: 26, totalTime: '27m', lastPlayed: '2 days ago' },
  { id: 'fractions', name: 'Equivalent fractions', games: ['beeline-equivalent-fraction.html', 'detective-fraction-equivalence.html'],
    correct: 19, attempts: 45, totalTime: '36m', lastPlayed: '1 week ago' },
  { id: 'perimeter', name: 'Perimeter', games: ['pop-perimeter.html'],
    correct: 11, attempts: 15, totalTime: '14m', lastPlayed: '5 days ago' },
  { id: 'operations', name: 'Order of operations', games: ['numbo-operations.html'],
    correct: 22, attempts: 38, totalTime: '41m', lastPlayed: '6 hours ago' },
  { id: 'strategy', name: 'Counting & strategy', games: ['nim.html', 'nim-nickeled-and-dimed.html', 'nim-subtraction.html'],
    correct: 30, attempts: 34, totalTime: '52m', lastPlayed: 'Yesterday' },
];

/* The top-tier number is DERIVED, never stored alongside the detail it
   summarises — a stored one drifts the moment a cell or a sub-skill is
   edited, and this whole view exists to be edited and re-judged. */
function skillOverall(skill){
  if (skill.type === 'facts'){
    const vals = skill.factGrid.rows.reduce((acc, r) => acc.concat(r.filter(v => v !== null)), []);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  if (skill.type === 'procedures'){
    // Weighted by attempts: a sub-skill with 132 attempts behind it should
    // move the headline more than one with 47.
    const tot = skill.subSkills.reduce((a, x) => a + x.attempts, 0);
    if (!tot) return null;
    return Math.round(skill.subSkills.reduce((a, x) => a + x.score * x.attempts, 0) / tot);
  }
  return Math.round((skill.correct / skill.attempts) * 100);
}
function skillAttemptCount(skill){
  if (skill.type === 'facts'){
    return skill.factGrid.rows.reduce((acc, r) => acc + r.filter(v => v !== null).length, 0);
  }
  if (skill.type === 'procedures'){
    return skill.subSkills.reduce((a, x) => a + x.attempts, 0);
  }
  return skill.attempts;
}

// Which page are we on? Preferred source is the href a game already passes
// to renderVariantSwitcher (explicit, and reliable in every harness — see
// CLAUDE.md's note on why location can't identify the running file under
// test). location is only a fallback for single-variant games, which never
// call that; if neither works the panel just opens with nothing expanded,
// which is a fine outcome rather than an error.
let CURRENT_PAGE_HREF = null;
function currentPageHref(){
  if (CURRENT_PAGE_HREF) return CURRENT_PAGE_HREF;
  try {
    const base = ((window.location && window.location.pathname) || '').split('/').pop();
    if (base && base.slice(-5) === '.html') return base;
  } catch (e) { /* no usable location — fall through */ }
  return null;
}

/* The single source of truth for which skills the panel lists — the panel
   renders these and the tests derive their expectations from them, so the
   two cannot disagree. */
function visibleSkills(){
  return PILOT_MODE ? SKILL_STATS.filter(s => PILOT_SKILL_IDS.indexOf(s.id) !== -1) : SKILL_STATS;
}
function visibleSkillIds(){ return visibleSkills().map(s => s.id); }

function skillForHref(href){
  if (!href) return null;
  // Searches only the VISIBLE skills: with the pilot on, a page whose skill
  // isn't listed must open with nothing expanded rather than pointing at a
  // row that was never rendered.
  return visibleSkills().find(s => s.games.indexOf(href) !== -1) || null;
}

/* ---- FACTS view: every individual fact, shaded by mastery -------------
   The whole point of a facts-style view is seeing WHICH facts are weak, so
   the cell colour has to carry the value — a grid of identical squares
   with numbers in them would just be the raw table. Four bands using the
   existing semantic tokens (correct / warn / error) rather than a new
   palette, plus a distinct "no evidence yet" state, because never having
   met a fact is not the same as getting it wrong. */
function factBand(v){
  if (v === null || v === undefined) return 'none';
  if (v >= 80) return 'strong';
  if (v >= 65) return 'ok';
  if (v >= 50) return 'weak';
  return 'poor';
}
function factGridEl(skill){
  const { min, max, rows } = skill.factGrid;
  const wrap = document.createElement('div');
  wrap.className = 'fact-grid-wrap';
  const grid = document.createElement('div');
  grid.className = 'fact-grid';
  grid.style.setProperty('--fact-cols', String(max - min + 2));
  // Corner + column headers.
  const corner = document.createElement('div');
  corner.className = 'fact-head fact-corner';
  corner.textContent = '×';
  grid.appendChild(corner);
  for (let b = min; b <= max; b++){
    const h = document.createElement('div');
    h.className = 'fact-head';
    h.textContent = b;
    grid.appendChild(h);
  }
  for (let a = min; a <= max; a++){
    const rh = document.createElement('div');
    rh.className = 'fact-head';
    rh.textContent = a;
    grid.appendChild(rh);
    for (let b = min; b <= max; b++){
      const v = rows[a - min][b - min];
      const cell = document.createElement('div');
      cell.className = 'fact-cell band-' + factBand(v);
      cell.dataset.fact = a + 'x' + b;
      if (v === null || v === undefined){
        cell.textContent = '–';
        cell.title = `${a} × ${b} — not practised yet`;
      } else {
        cell.textContent = v;
        cell.title = `${a} × ${b} — ${v}% mastery`;
      }
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  const key = document.createElement('div');
  key.className = 'fact-key';
  [['strong', '80+'], ['ok', '65-79'], ['weak', '50-64'], ['poor', 'under 50'], ['none', 'not yet']]
    .forEach(([band, label]) => {
      const item = document.createElement('span');
      const sw = document.createElement('span');
      sw.className = 'fact-key-swatch band-' + band;
      item.appendChild(sw);
      item.appendChild(document.createTextNode(label));
      key.appendChild(item);
    });
  wrap.appendChild(key);
  return wrap;
}

/* ---- PROCEDURES view: a taxonomy of sub-skills -----------------------
   Every row in the taxonomy is listed, but only the rows this game
   actually generates evidence for are marked — the others are here for
   completeness, and the view must not imply the game says anything about
   them. The mark is a visible badge on the row itself, not a tooltip,
   because "which of these is this game's evidence" is the single most
   important thing this view communicates. */
function subSkillListEl(skill, currentHref){
  const list = document.createElement('div');
  list.className = 'subskill-list';
  let anyHighlighted = false;
  skill.subSkills.forEach(sub => {
    // Highlighted only when the panel was opened FROM a game that feeds
    // this row. No current game (hub, sub-menu) means no highlight at all.
    const fromHere = !!currentHref && (sub.evidenceFrom || []).indexOf(currentHref) !== -1;
    if (fromHere) anyHighlighted = true;
    const row = document.createElement('div');
    row.className = 'subskill-row' + (fromHere ? ' has-evidence' : '');
    row.dataset.subskill = sub.name;

    const nameWrap = document.createElement('div');
    nameWrap.className = 'subskill-name';
    nameWrap.appendChild(document.createTextNode(sub.name));
    row.appendChild(nameWrap);

    const bar = document.createElement('div');
    bar.className = 'subskill-bar-track';
    const fill = document.createElement('div');
    fill.className = 'subskill-bar-fill';
    fill.style.width = sub.score + '%';
    bar.appendChild(fill);
    row.appendChild(bar);

    const val = document.createElement('div');
    val.className = 'subskill-score';
    val.textContent = sub.score + '%';
    row.appendChild(val);

    const n = document.createElement('div');
    n.className = 'subskill-n';
    n.textContent = sub.attempts + ' problems';
    row.appendChild(n);

    list.appendChild(row);
  });
  if (anyHighlighted){
    const note = document.createElement('div');
    note.className = 'subskill-note';
    note.textContent = 'The highlighted row is where this game\u2019s results go. The others are part of the same skill but get no evidence from it.';
    list.appendChild(note);
  }
  return list;
}

function statsPanelEl(currentHref){
  const openSkill = skillForHref(currentHref);
  const backdrop = document.createElement('div');
  backdrop.id = 'stats-panel-backdrop';
  backdrop.className = 'stats-panel-backdrop hidden';
  const panel = document.createElement('div');
  panel.className = 'stats-panel';
  const head = document.createElement('div');
  head.className = 'stats-panel-head';
  head.textContent = 'Your skills';
  panel.appendChild(head);
  const note = document.createElement('div');
  note.className = 'stats-panel-note';
  note.textContent = 'Sample data — not yet wired to real play';
  panel.appendChild(note);

  /* Pilot mode shows only the two skills this demonstration actually
     covers — the rest describe games that are locked, so listing them
     would be eight rows of unreachable detail. Reverses with PILOT_MODE. */
  visibleSkills().forEach(skill => {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.dataset.skill = skill.id;

    const toggle = document.createElement('button');
    toggle.className = 'skill-toggle';
    toggle.type = 'button';
    const pct = skillOverall(skill);
    const caret = document.createElement('span');
    caret.className = 'skill-caret';
    const nameEl = document.createElement('span');
    nameEl.className = 'skill-title';
    nameEl.textContent = skill.name;
    const pctEl = document.createElement('span');
    pctEl.className = 'skill-pct';
    pctEl.textContent = pct + '%';
    toggle.appendChild(caret);
    toggle.appendChild(nameEl);
    toggle.appendChild(pctEl);

    const body = document.createElement('div');
    body.className = 'skill-body';
    const bar = document.createElement('div');
    bar.className = 'skill-bar-track';
    const fill = document.createElement('div');
    fill.className = 'skill-bar-fill';
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    body.appendChild(bar);
    const stats = document.createElement('div');
    stats.className = 'skill-stats';
    if (skill.type === 'facts'){
      const total = (skill.factGrid.max - skill.factGrid.min + 1) ** 2;
      const seen = skillAttemptCount(skill);
      stats.textContent = `${seen} of ${total} facts practised · ${skill.totalTime} played · last ${skill.lastPlayed.toLowerCase()}`;
    } else if (skill.type === 'procedures'){
      stats.textContent = `${skillAttemptCount(skill)} problems · ${skill.totalTime} played · last ${skill.lastPlayed.toLowerCase()}`;
    } else {
      stats.textContent = `${skill.correct} of ${skill.attempts} correct · ${skill.totalTime} played · last ${skill.lastPlayed.toLowerCase()}`;
    }
    body.appendChild(stats);
    if (skill.type === 'facts') body.appendChild(factGridEl(skill));
    if (skill.type === 'procedures') body.appendChild(subSkillListEl(skill, currentHref));
    const games = document.createElement('div');
    games.className = 'skill-games';
    games.textContent = 'Games: ' + skill.games.map(h => {
      const g = GLOBAL_GAMES.find(x => x.href === h || (x.variants || []).some(v => v.href === h));
      const v = g && (g.variants || []).find(v2 => v2.href === h);
      return g ? (v ? `${g.name} ${v.name}` : g.name) : h;
    }).join(', ');
    body.appendChild(games);

    const isOpen = !!openSkill && openSkill.id === skill.id;
    // Same rule one tier up: the skill belonging to the game you opened
    // the panel from is both expanded AND marked. From the hub there is no
    // such skill, so nothing is expanded and nothing is marked.
    row.classList.toggle('is-current', isOpen);
    row.classList.toggle('open', isOpen);
    body.classList.toggle('hidden', !isOpen);
    caret.textContent = isOpen ? '▾' : '▸';

    toggle.addEventListener('click', () => {
      const nowOpen = body.classList.contains('hidden');
      body.classList.toggle('hidden', !nowOpen);
      row.classList.toggle('open', nowOpen);
      caret.textContent = nowOpen ? '▾' : '▸';
      if (nowOpen) fadeIn(body);
    });

    row.appendChild(toggle);
    row.appendChild(body);
    panel.appendChild(row);
  });

  const close = document.createElement('button');
  close.className = 'primary';
  close.id = 'stats-panel-close';
  close.style.width = '100%';
  close.textContent = 'Close';
  close.addEventListener('click', () => backdrop.classList.add('hidden'));
  panel.appendChild(close);

  backdrop.appendChild(panel);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
  return backdrop;
}

// Corner glyph, on every page (injected from renderGlobalNav so no page
// has to remember it). The panel is built lazily on first click, not here,
// specifically so the current-page href has had a chance to be set by the
// game's own renderVariantSwitcher call, which runs after renderGlobalNav.
function renderStatsLauncher(){
  if (document.getElementById('stats-launcher')) return;
  const btn = document.createElement('button');
  btn.id = 'stats-launcher';
  btn.type = 'button';
  btn.title = 'Your skills';
  btn.setAttribute('aria-label', 'Your skills');
  // Inline SVG rather than a text glyph: this needs to read as a bar
  // chart at 20px, and the project doesn't use emoji.
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">' +
    '<rect x="3" y="13" width="5" height="8" rx="1"></rect>' +
    '<rect x="9.5" y="8" width="5" height="13" rx="1"></rect>' +
    '<rect x="16" y="4" width="5" height="17" rx="1"></rect></svg>';
  document.body.appendChild(btn);
  btn.addEventListener('click', () => {
    let backdrop = document.getElementById('stats-panel-backdrop');
    if (!backdrop){
      backdrop = statsPanelEl(currentPageHref());
      document.body.appendChild(backdrop);
    }
    backdrop.classList.remove('hidden');
  });
}

/* ---------------- generic info modal ------------------------------------
   A one-sentence explanation that doesn't earn permanent space on screen.
   Reuses the .explain-modal shell, same as the rules modal. */
function openInfoModal(title, text){
  let backdrop = document.getElementById('info-modal-backdrop');
  if (!backdrop){
    backdrop = document.createElement('div');
    backdrop.id = 'info-modal-backdrop';
    backdrop.className = 'explain-modal-backdrop hidden';
    const modal = document.createElement('div');
    modal.className = 'explain-modal';
    const h = document.createElement('div');
    h.className = 'explain-modal-title';
    h.id = 'info-modal-title';
    const body = document.createElement('div');
    body.className = 'info-modal-body';
    body.id = 'info-modal-body';
    const close = document.createElement('button');
    close.className = 'primary explain-modal-continue-btn';
    close.id = 'info-modal-close-btn';
    close.textContent = 'Got it';
    close.addEventListener('click', () => backdrop.classList.add('hidden'));
    modal.appendChild(h); modal.appendChild(body); modal.appendChild(close);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
    document.body.appendChild(backdrop);
  }
  document.getElementById('info-modal-title').textContent = title;
  document.getElementById('info-modal-body').textContent = text;
  backdrop.classList.remove('hidden');
}

/* The tiny grey "the number to land closest to" next to a target input was
   clutter that also broke the row's grid alignment — it wrapped under the
   field and made that cell taller than its neighbours. It becomes an info
   button beside the input instead.

   The helper TEXT is read off the label each game already wrote, then the
   label is removed — so no wording is duplicated into shared code and each
   game keeps saying its own thing (Pop's "without going over" is not
   Scuttle's "land closest to"). Runtime, so no game markup changed. */
function initTargetInfo(){
  const probe = document.createElement && document.createElement('div');
  if (!probe || !probe.children || !document.body) return;
  document.querySelectorAll('.target-row').forEach(row => {
    if (row.querySelector('.info-btn')) return;
    const label = row.querySelector('label.small');
    if (!label) return;
    const text = (label.textContent || '').trim();
    label.remove();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn info-btn';
    btn.textContent = 'i';
    btn.setAttribute('aria-label', 'More info');
    btn.title = text;
    btn.addEventListener('click', () => openInfoModal('Target number', text));
    row.appendChild(btn);
  });
}

/* ---------------- rules launcher ----------------------------------------
   Real design direction: the inline "How does this game work?" text link
   was getting lost at the bottom of the settings card, and it was only
   reachable THERE — a student mid-round who forgot the rule had to leave
   the game to read it. It becomes a persistent corner button instead,
   mirroring #stats-launcher on the opposite side, and opens the game's own
   #rules-box in a modal so the current layout is never disturbed.

   The rules text itself is NOT duplicated: #rules-box stays exactly where
   each game already wrote it, and this MOVES that node into the modal the
   first time the button is used. One copy, each game still owns its own
   wording, nothing to keep in sync. Games with no #rules-box (the hub, the
   sub-menus, stats-demo) get no button at all. */
function rulesModalEl(rulesBox){
  const backdrop = document.createElement('div');
  backdrop.id = 'rules-modal-backdrop';
  backdrop.className = 'explain-modal-backdrop hidden';
  const modal = document.createElement('div');
  modal.className = 'explain-modal';
  const title = document.createElement('div');
  title.className = 'explain-modal-title';
  title.textContent = 'How does this game work?';
  modal.appendChild(title);

  // Move, don't copy — see the header comment.
  rulesBox.classList.remove('hidden');
  modal.appendChild(rulesBox);

  const close = document.createElement('button');
  close.className = 'primary explain-modal-continue-btn';
  close.id = 'rules-modal-close-btn';
  close.textContent = 'Got it';
  close.addEventListener('click', () => backdrop.classList.add('hidden'));
  modal.appendChild(close);

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
  return backdrop;
}

function renderRulesLauncher(){
  if (document.getElementById('rules-launcher')) return;
  const rulesBox = document.getElementById('rules-box');
  if (!rulesBox) return;
  const btn = document.createElement('button');
  btn.id = 'rules-launcher';
  btn.type = 'button';
  btn.title = 'How does this game work?';
  btn.setAttribute('aria-label', 'How does this game work?');
  // Inline SVG, not a text "?" — a glyph in the button's own uppercase
  // font would inherit the button type styling and sit off-centre.
  // An open book, not a "?" — a question mark universally reads as
  // "help/support", and this is the game's own manual. Same viewBox,
  // stroke weight and currentColor handling as the stats glyph opposite.
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
    '<path d="M3 5.2h5.4c1.5 0 2.7.6 3.6 1.6.9-1 2.1-1.6 3.6-1.6H21v12.1h-5.4c-1.5 0-2.7.6-3.6 1.6-.9-1-2.1-1.6-3.6-1.6H3z" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>' +
    '<path d="M12 6.8v12.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
  document.body.appendChild(btn);
  btn.addEventListener('click', () => {
    let backdrop = document.getElementById('rules-modal-backdrop');
    if (!backdrop){
      backdrop = rulesModalEl(rulesBox);
      document.body.appendChild(backdrop);
    }
    backdrop.classList.remove('hidden');
  });
}

/* ---------------- menu sections ----------------------------------------
   Splits any .variant-list into "Playable now" / "Coming soon" instead of
   running both tiers together and leaving a footnote at the bottom as the
   only signal. Injected rather than written into each menu's markup for
   the same reason renderGlobalNav() is: one implementation, and the
   grouping can't drift out of sync with the cards themselves. */
function renderMenuSections(playableLabel, lockedLabel){
  const list = document.querySelector('.variant-list');
  if (!list || list.querySelector('.menu-section-head')) return;
  const head = (text) => {
    const h = document.createElement('div');
    h.className = 'menu-section-head';
    h.textContent = text;
    return h;
  };
  const firstLocked = list.querySelector('.variant-card.locked');
  const firstCard = list.querySelector('.variant-card');
  if (firstCard && firstCard !== firstLocked) list.insertBefore(head(playableLabel || 'Playable now'), firstCard);
  if (firstLocked) list.insertBefore(head(lockedLabel || 'Coming soon'), firstLocked);
}

/* ---------------- settings-screen chrome --------------------------------
   Restructures the settings screen at runtime rather than by editing all
   18 games' markup — same "one real implementation" reasoning as
   renderGlobalNav(). See design-system.css's "settings-screen chrome"
   block for WHY each of these moved. Runs itself on DOMContentLoaded
   (shared-game.js is loaded before each game's own inline script, and
   that script runs during parsing, so by DOMContentLoaded every element
   and handler this touches already exists). No-ops on pages with no
   settings screen — the hub, the sub-menus, stats-demo. */
function initSettingsChrome(){
  // test/vm-load-page.js runs a page's script in a bare sandbox whose
  // document returns the same stub element for everything (it exists to
  // exercise pure functions like decideWinner, not the DOM). Detect that
  // and no-op rather than sprinkling guards through every DOM call below:
  // a real element has a `children` collection, the stub doesn't.
  const probe = document.createElement && document.createElement('div');
  if (!probe || !probe.children || !document.body) return;

  const settings = document.getElementById('screen-settings');
  if (!settings || !settings.classList) return;

  // Anything that depends on "is the settings screen showing" registers
  // here. Each one runs on THREE triggers, because no single one covers
  // every case: a MutationObserver (catches programmatic screen changes,
  // but only on a later microtask), a bubble-phase document click (runs
  // straight after whichever button handler just swapped screens, so the
  // update is synchronous from both the player's and a test's point of
  // view), and once now for the initial state.
  const syncers = [];
  const runSyncers = () => syncers.forEach(fn => fn());
  const addSyncer = (fn) => { syncers.push(fn); fn(); };
  // MutationObserver doesn't exist in test/vm-load-page.js's bare sandbox
  // (see CLAUDE.md's note on what that harness deliberately doesn't
  // provide) — guarded the same way makeDraggable() guards
  // setPointerCapture. The click listener below is the one that actually
  // matters for real interactions; the observer only adds coverage for
  // screen changes made programmatically rather than by a click.
  if (typeof MutationObserver === 'function'){
    new MutationObserver(runSyncers).observe(settings, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.addEventListener) document.addEventListener('click', runSyncers);

  // 1. Lift the variant picker out into its own card above the settings.
  const variantRow = document.getElementById('variant-row');
  if (variantRow && variantRow.children.length && !document.getElementById('variant-card')){
    const label = variantRow.previousElementSibling;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'variant-card';
    if (label && label.classList.contains('section-label')) card.appendChild(label);
    card.appendChild(variantRow);
    settings.parentNode.insertBefore(card, settings);
    // The variant card is part of the settings step — it must come and go
    // with it, or it would sit above the board mid-game.
    addSyncer(() => card.classList.toggle('hidden', settings.classList.contains('hidden')));
  }

  // 2. Avatar picker -> a button that opens a modal.
  const avatarRow = document.getElementById('avatar-row');
  if (avatarRow && !document.getElementById('avatar-modal-backdrop')){
    const label = avatarRow.previousElementSibling;
    if (label && label.classList.contains('section-label')) label.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'avatar-modal-backdrop';
    backdrop.className = 'avatar-modal-backdrop hidden';
    const modal = document.createElement('div');
    modal.className = 'avatar-modal';
    const title = document.createElement('div');
    title.className = 'avatar-modal-title';
    title.textContent = 'Choose your avatar';
    modal.appendChild(title);
    const done = document.createElement('button');
    done.className = 'primary';
    done.style.width = '100%';
    done.textContent = 'Done';

    const btn = document.createElement('button');
    btn.id = 'avatar-choose-btn';
    btn.className = 'avatar-choose-btn';
    const thumb = document.createElement('img');
    const btnText = document.createElement('span');
    btn.appendChild(thumb);
    btn.appendChild(btnText);

    // Reflect whichever avatar is currently selected in the (moved) picker,
    // so the button always shows the real state — including after a pick.
    // Falls back to st.avatar because this can run BEFORE the game's own
    // renderAvatarPicker() has marked a slot .selected (initSettingsChrome
    // is called right after renderVariantSwitcher, partway down the inline
    // script) — without the fallback the button rendered a broken <img>
    // and a nameless label until the first click.
    const sync = () => {
      const sel = avatarRow.querySelector('.avatar-slot.selected');
      const name = (sel && sel.dataset.avatar) ||
        (typeof st !== 'undefined' && st && st.avatar) || null;
      thumb.hidden = !name;
      if (name) thumb.src = `avatars/${name}.png`;
      thumb.alt = '';
      btnText.textContent = 'Choose avatar' + (name ? ` · ${name.charAt(0).toUpperCase() + name.slice(1)}` : '');
    };

    avatarRow.parentNode.insertBefore(btn, avatarRow);
    modal.appendChild(avatarRow);
    modal.appendChild(done);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    sync();

    btn.addEventListener('click', () => { sync(); backdrop.classList.remove('hidden'); });
    done.addEventListener('click', () => backdrop.classList.add('hidden'));
    // The picker's own click handlers still run (they were bound to these
    // exact nodes before the move) — this only mirrors the result onto the
    // button and closes up, so picking is one tap, not tap-then-Done.
    avatarRow.addEventListener('click', (e) => {
      if (!e.target.closest('[data-avatar]')) return;
      sync();
      backdrop.classList.add('hidden');
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
    // Re-sync on any click (cheap) and once after the rest of the page's
    // own script has finished wiring itself up.
    addSyncer(sync);
    setTimeout(sync, 0);
  }

  // 3. Track whether the settings screen is showing, for the top bar.
  addSyncer(() => document.body.classList.toggle('settings-active', !settings.classList.contains('hidden')));

  // 4. Two columns instead of one tall stack of ragged rows.
  initSettingsColumns(settings);

  initPlayLayout();
}

/* ---------------- settings: two columns ---------------------------------
   Real design feedback: "pop settings page is too cluttered - lots of rows
   of unequal lengths. Better to arrange in 2 columns."

   A settings card was a single column of `.section-label` + control pairs,
   each a different width (three difficulty chips, two format chips, one
   number input), stacked down the page — so the eye had nothing to line up
   against and the card ran long for very little content.

   Each label and the controls that belong to it are wrapped into one
   `.setting-group`, and the groups are laid out 2-up (see
   design-system.css). Actions — Start, the rules disclosure, the avatar
   button — are pulled into a full-width footer underneath, because they
   aren't settings and shouldn't compete for a column.

   Runtime again, for the same reason as everything else in this file: 18
   settings screens, one implementation, no markup edits. Called AFTER the
   variant lift and the avatar move so it groups the final DOM, not the
   original. */
const SETTINGS_FOOTER_IDS = ['avatar-choose-btn', 'how-link', 'rules-box'];
function isSettingsFooterNode(n){
  if (!n.classList) return false;
  if (n.classList.contains('btn-row')) return true;
  return SETTINGS_FOOTER_IDS.indexOf(n.id) !== -1;
}
function initSettingsColumns(settings){
  if (!settings || settings.querySelector('.settings-grid')) return;
  const kids = Array.prototype.slice.call(settings.children);
  if (!kids.length) return;

  const grid = document.createElement('div');
  grid.className = 'settings-grid';
  const footer = document.createElement('div');
  footer.className = 'settings-footer';

  let group = null;
  kids.forEach(node => {
    if (isSettingsFooterNode(node)){ group = null; footer.appendChild(node); return; }
    if (node.classList && node.classList.contains('section-label')){
      group = document.createElement('div');
      group.className = 'setting-group';
      grid.appendChild(group);
    }
    // Anything before the first label (nothing, normally) just leads the
    // grid on its own rather than being dropped.
    if (!group){
      group = document.createElement('div');
      group.className = 'setting-group';
      grid.appendChild(group);
    }
    group.appendChild(node);
  });

  settings.appendChild(grid);
  if (footer.children.length) settings.appendChild(footer);
}

/* ---------------- side-by-side play layout ------------------------------
   Real design feedback: "there is a lot of dead space to the left and
   right sides of the screen... the scoreboard and gameboard in scuttle can
   be left and right. Beeline is already good."

   Beeline and Detective already split board-from-play in their own markup
   (see CLAUDE.md "Side-by-side board/playing-space layout"); Scuttle's
   persistent #scorecard was the remaining case — three cards stacked
   vertically, so the round card itself sat below a scoreboard that never
   changes mid-round, pushing the actual playing controls down the page.

   Done at runtime, from here, rather than by restructuring three games'
   markup, for the same reason initSettingsChrome() is: one real
   implementation, no chance of the three drifting. It keys off #scorecard
   alone, so any future game that grows one gets the layout for free and
   every game without one is untouched.

   DOM ORDER IS UNCHANGED in spirit — scorecard still comes before the play
   screens, which is what the narrow-viewport stacked view still shows (see
   the same DOM-order-vs-visual-order reasoning in claim-grid.css). The
   side-by-side arrangement is purely the CSS row above the breakpoint, so
   scorecard-first also means scorecard-LEFT with no `order` override. */
function initPlayLayout(){
  const side = document.getElementById('scorecard');
  const app = document.getElementById('app');
  if (!side || !app || document.querySelector('.play-layout')) return;
  // Everything after the scorecard is a play screen (settings and the
  // variant card both sit above it — see each Scuttle file's markup).
  const main = [];
  for (let n = side.nextElementSibling; n; n = n.nextElementSibling){
    if (n.classList && n.classList.contains('card')) main.push(n);
  }
  if (!main.length) return;

  const layout = document.createElement('div');
  layout.className = 'play-layout';
  const sideCol = document.createElement('div');
  sideCol.className = 'play-side';
  const mainCol = document.createElement('div');
  mainCol.className = 'play-main';
  side.parentNode.insertBefore(layout, side);
  sideCol.appendChild(side);
  main.forEach(n => mainCol.appendChild(n));
  layout.appendChild(sideCol);
  layout.appendChild(mainCol);
  // Widen #app only for games that actually have two columns to fill, and
  // only via a class, so design-system.css keeps every width in one place.
  app.classList.add('has-play-layout');
}

/* ---------------- Beeline: separate containers --------------------------
   Real design feedback: "Beeline, match the layout style of scuttle. With
   separate containers."

   Beeline already had two side-by-side COLUMNS, but both lived inside one
   bordered card, so it read as a single panel split down the middle
   rather than as Scuttle's two distinct containers. This promotes each
   column to its own card and demotes the wrapper to a bare shell.

   CSS-only would have needed `:has()` to target the one card that holds a
   .game-layout; doing it here instead keeps it working on older tablet
   browsers, and matches how every other cross-cutting restructure in this
   project is done. Six files, no markup edits. */
/* Every game's play screens become a stable frame — see design-system.css's
   .play-frame rule. A two-column game gets this from .play-main instead;
   this covers the single-card games (Nim, Pop, Numbo, Detective) so the
   container stops resizing on every phase there too. Keyed off the
   `screen-` id convention (Code conventions' showScreen names), excluding
   the settings step, which is a form and should be its own natural size. */
function initPlayFrames(){
  const app = document.getElementById('app');
  if (!app || !app.children) return;
  if (document.querySelector('.play-layout')) return; // .play-main handles it
  Array.prototype.forEach.call(app.children, (n) => {
    if (!n.classList || !n.classList.contains('card')) return;
    if (n.classList.contains('card-shell')) return; // Beeline's columns stretch themselves
    if (!n.id || n.id.indexOf('screen-') !== 0 || n.id === 'screen-settings') return;
    n.classList.add('play-frame');
  });
}

function initBoardLayout(){
  const layout = document.querySelector('.game-layout');
  if (!layout || layout.classList.contains('is-split')) return;
  const shell = layout.closest && layout.closest('.card');
  if (!shell) return;
  shell.classList.add('card-shell');
  layout.classList.add('is-split');
  // Same two-column width treatment Scuttle's play layout gets, so the
  // shared rule in design-system.css is the single place widths live —
  // this replaced a per-file `#app { max-width: 1100px }` in all 6 files.
  const app = document.getElementById('app');
  if (app) app.classList.add('has-play-layout');
  ['.game-board-col', '.game-play-col'].forEach(sel => {
    const col = layout.querySelector(sel);
    if (col) col.classList.add('card');
  });
}

/* ---------------- phase blocks ------------------------------------------
   `showPhaseBlock(node, visible)` — reveal/remove a block that belongs to a
   LATER phase than the one showing, with the same fadeIn() every screen
   swap in this project gets. Originally local to numbo-operations.html,
   which hit the dead-space bug first; promoted here once the same fix was
   needed across Scuttle and Nim too.

   Use this, NOT `.phase-hidden`, whenever an element belongs to a phase the
   player has not reached yet — see CLAUDE.md "Layout stability" for where
   the line actually falls. `.phase-hidden` is still right, and still the
   default, for content that appears WHILE the player is working inside the
   phase it belongs to. */
function showPhaseBlock(node, visible){
  if (!node || !node.classList) return;
  const wasHidden = node.classList.contains('hidden');
  node.classList.toggle('hidden', !visible);
  if (wasHidden && visible && typeof fadeIn === 'function') fadeIn(node);
}

/* ---------------- 3-tier information hierarchy --------------------------
   Real design feedback: the status row gave the number that DEFINES the
   win condition exactly the same weight as the bot-difficulty readout and
   the Settings button — one flat row of identically-styled pills with no
   signal about what to actually look at.

   Three tiers (see design-system.css's HUD block for the visual side):
     PRIMARY   — the one fact that defines winning, big and on its own.
     SECONDARY — round / difficulty / score, still pills, one step down.
     UTILITY   — Settings, Print, and the temporary Demo button: chrome.

   Which element is PRIMARY is genuinely per-game, not one shape repeated
   six times — Scuttle and Pop have a target number, Beeline has whose turn
   it is on a board with no target at all, Nim has a target the player
   races toward, Detective is single-player with no opponent. So this
   function does NOT invent or recompute any game state: it MOVES an
   element the game already owns and already keeps up to date (the same
   move-don't-rebuild trick initSettingsChrome() uses for the avatar
   picker, so every existing render function and handler keeps working
   untouched). A game nominates its own primary with `data-hud-primary`
   plus a `data-hud-label`; a `.target-pill` is adopted automatically so
   the 7 Scuttle/Pop files need no markup change at all. */
function initHud(){
  const probe = document.createElement && document.createElement('div');
  if (!probe || !probe.children || !document.body) return;
  const topBar = document.getElementById('top-bar');
  if (!topBar || document.querySelector('.hud-primary')) return;

  // Tier 3: the existing actions wrapper simply gains the utility class —
  // no restructuring, so Detective's level-badge-instead-of-Settings shape
  // works with no special case.
  const actions = topBar.querySelector('.top-bar-actions');
  if (actions) actions.classList.add('hud-utility');
  // Tier 2: the remaining pills.
  const pills = topBar.querySelector('.pill-group');
  if (pills) pills.classList.add('hud-secondary');

  // Tier 1. A game either nominates an element or has a .target-pill.
  const nominated = topBar.querySelector('[data-hud-primary]') ||
    document.querySelector('[data-hud-primary]');
  const source = nominated || topBar.querySelector('.target-pill');
  if (!source) return;

  const label = source.getAttribute('data-hud-label') ||
    // A .target-pill's own text is "Target 500" — the word before the
    // <b> is the label, the <b> is the value. Read them off rather than
    // hardcoding "Target", since Pop variants word it differently.
    (source.firstChild && (source.firstChild.textContent || '').trim()) || '';
  // The value can be marked explicitly; otherwise a .target-pill's own <b>
  // is it, and failing that the element's whole text.
  const valueNode = source.querySelector('[data-hud-value]') || source.querySelector('b') || source;

  const block = document.createElement('div');
  block.className = 'hud-primary';
  const labelEl = document.createElement('span');
  labelEl.className = 'hud-primary-label';
  labelEl.textContent = label.replace(/[:\s]+$/, '');
  const valueEl = document.createElement('span');
  valueEl.className = 'hud-primary-value';
  block.appendChild(labelEl);
  block.appendChild(valueEl);
  const subText = source.getAttribute('data-hud-sub');
  let subEl = null;
  if (subText){
    subEl = document.createElement('span');
    subEl.className = 'hud-primary-sub';
    subEl.textContent = subText;
    block.appendChild(subEl);
  }

  // Mirror rather than move: the game's own code keeps writing to its own
  // element (st updates, renderTrack(), updateScorePills(), ...) and this
  // just reflects it, so nothing has to know the HUD exists. The source
  // element is hidden, not removed, for the same reason — a render that
  // writes into a detached node would silently stop working.
  const sync = () => {
    const txt = (valueNode.textContent || '').trim();
    if (valueEl.textContent !== txt) valueEl.textContent = txt;
    // A phrase ("Your turn") needs smaller type than a bare number.
    valueEl.classList.toggle('is-text', !/^[\d.,−-]+$/.test(txt));
  };
  sync();
  source.classList.add('hidden');
  if (typeof MutationObserver === 'function'){
    new MutationObserver(sync).observe(source, { childList: true, subtree: true, characterData: true });
  }
  if (document.addEventListener) document.addEventListener('click', sync);

  // Placement: the top of the left-hand reading column. In a two-column
  // game that's the rail the scorecard already lives in; everywhere else
  // it's a band directly under the header. Deliberately ABOVE the
  // scorecard rather than below it (the feedback suggested "bottom-left"):
  // this is a fact the player consults constantly, and the top of the
  // first column is the strongest position for that in a left-to-right
  // reading order — below a scorecard it would float in whitespace with
  // nothing anchoring it.
  const side = document.querySelector('.play-side');
  if (side){
    side.insertBefore(block, side.firstChild);
  } else {
    block.classList.add('hud-primary-band');
    topBar.parentNode.insertBefore(block, topBar.nextSibling);
  }
}

if (typeof document !== 'undefined' && document.addEventListener){
  document.addEventListener('DOMContentLoaded', () => {
    // Order matters: initSettingsChrome() runs initPlayLayout(), which is
    // what creates the .play-side rail initHud() wants to put the primary
    // block into. Detective has no settings screen at all, so it exits
    // early and initHud() falls back to the under-header band — which is
    // why initHud is called from here rather than from inside that chain.
    initPageHead();
    initSettingsChrome();
    initBoardLayout();
    initPlayFrames();
    initHud();
    markCenteredPage();
  });
}

/* A listing page (the hub, a family sub-menu) keeps its centred title: a
   title there heads a symmetric 2-column grid of cards rather than a
   left-aligned play column, so centring is genuinely right for it, and
   these are exactly the pages that have a card grid and no #top-bar. */
/* Groups the title, variant kicker and tagline into one header unit.
   Block-stacked as before at normal heights; at the 1024x600 floor they
   become a single row (see design-system.css's short-viewport tier),
   which recovers a whole line of height without hiding the variant name
   the way simply dropping the kicker would. Runtime, like every other
   cross-cutting restructure here — 18 files, no markup edits. */
function initPageHead(){
  const app = document.getElementById('app');
  if (!app || !app.children || document.querySelector('.page-head')) return;
  const h1 = app.querySelector(':scope > h1');
  if (!h1) return;
  const head = document.createElement('div');
  head.className = 'page-head';
  app.insertBefore(head, h1);
  let n = head.nextElementSibling;
  while (n && (n.tagName === 'H1' || n.classList.contains('kicker-wrap') || n.classList.contains('tagline'))){
    const next = n.nextElementSibling;
    head.appendChild(n);
    n = next;
  }
}

function markCenteredPage(){
  if (!document.body || !document.body.classList) return;
  if (document.getElementById('top-bar')) return;
  if (document.querySelector('.variant-list, .game-grid')) document.body.classList.add('page-centered');
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
// Reserve the tallest frame's height up front so the modal never grows
// mid-sequence. Every one of these visuals adds content as it goes (the
// column method keeps step 1 on screen and adds step 2 below it; the
// number line adds its verdict lines; the area model adds its addition
// row), so without this the whole modal — including the Continue button —
// jumps under the reader partway through. Measured rather than hardcoded
// per visual: each frame is rendered once, hidden, at the container's real
// width, so this stays correct for any future representation and for
// whatever a specific problem's numbers happen to render as. No-ops where
// there's no layout engine (jsdom reports 0 for everything).
function reserveFrameHeight(containerEl, frames){
  if (!containerEl) return;
  // Clear any reservation from a previous explanation first, or a short
  // one would inherit a tall one's floor.
  containerEl.style.minHeight = '';
  if (!frames || frames.length < 2) return;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
  probe.style.width = (containerEl.clientWidth || containerEl.offsetWidth || 0) + 'px';
  if (!containerEl.parentNode) return;
  containerEl.parentNode.appendChild(probe);
  let max = 0;
  frames.forEach(html => {
    probe.innerHTML = html;
    max = Math.max(max, probe.scrollHeight);
  });
  probe.remove();
  if (max > 0) containerEl.style.minHeight = max + 'px';
}

function revealSteps(containerEl, frames, msPerFrame, onDone){
  if (!frames || !frames.length){ if (onDone) onDone(); return () => {}; }
  reserveFrameHeight(containerEl, frames);
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
  { key: 'lightning', name: 'Lightning', status: 'playable', href: 'lightning-multiplication.html', multiVariant: true,
    variants: [
      { name: 'Multiplication Facts', href: 'lightning-multiplication.html' },
      { name: 'Multi-step Add & Subtract', href: 'lightning-multi-step.html' },
    ],
    desc: 'Straight question-and-answer drill \u2014 ten at a time, no board and no opponent. The one place a specific fact can be asked directly.' },
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

/* ---------------- Lightning: the drill engine ---------------------------
   design/fluency-tracking-design-plan.md's strategy/forcing matrix says
   every skill needs at least one game at the TOP of the forcing axis —
   where we can assign specific numbers directly — even though that means
   near-zero strategy for that game. The doc is explicit that this is "a
   deliberate instrument alongside the strategy games, not a compromise we
   settle for". Lightning is that instrument: no board, no bot, no choice,
   just the question in front of you.

   Single-player, so per CLAUDE.md's Detective precedent there is no
   decideWinner, no bot tiers and no avatar picker — none of those
   conventions have anything to compare against here.

   Shared because both Lightning variants are the same loop over different
   question generators: each file supplies only `LIGHTNING_SPEC`
   (a generator, an answer, and how to display the question). Extracted up
   front because there are two real consumers from the start — the same
   bar the Beeline two-row engine met. */
const LIGHTNING_QUESTIONS_PER_ROUND = 10;

/* Draws without immediate repeats, so a 10-question round can't serve the
   same fact twice in a row — which reads as a bug even when it isn't. */
function lightningBuildRound(spec, n){
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 50){
    const q = spec.generate();
    if (out.length && out[out.length - 1].prompt === q.prompt) continue;
    out.push(q);
  }
  while (out.length < n) out.push(spec.generate()); // pathological generator
  return out;
}

function lightningAccuracy(correct, answered){
  return answered ? Math.round((correct / answered) * 100) : 0;
}

/* The round summary's message. Deliberately about the WORK, not praise —
   these are drills, and a student running several rounds should get
   information back rather than applause. */
function lightningSummary(correct, total){
  const pct = lightningAccuracy(correct, total);
  if (pct === 100) return 'Every one correct.';
  if (pct >= 80) return 'Strong round — a couple to look at below.';
  if (pct >= 50) return 'Worth another round on these.';
  return 'These need some work — try the same set again.';
}

/* ---------------- PILOT MODE (reversible) --------------------------------
   A hardcoded UI demonstration of design/fluency-tracking-design-plan.md's
   two-bucket model, run on exactly two SKILLS so the stats views can be
   evaluated without the rest of the catalogue in the way. Four files are
   unlocked, not two: the two strategy games the views are built around,
   plus both Lightning drills, which train the same two skills from the
   forcing end of the matrix.

   TO REVERSE THIS ENTIRELY: set PILOT_MODE to false. Nothing is deleted
   and no file is removed — every game, variant, menu card and nav entry
   comes straight back.

   It works by transforming GLOBAL_GAMES ONCE, here, rather than by
   teaching each of the four nav surfaces (the hub grid, the nav dropdown,
   the in-game variant switcher, the static sub-menu pages) its own rule.
   GLOBAL_GAMES stays the single canonical list — see "Global navigation" —
   which is exactly why a single documented transform on it is safer than
   four independent filters that could drift apart. */
const PILOT_MODE = true;
/* The stats panel is limited to the skills these two games demonstrate. */
const PILOT_SKILL_IDS = ['mult-facts', 'add-sub-large'];
const PILOT_UNLOCKED_HREFS = [
  'scuttle-addition-subtraction.html', // procedures-style stats view
  'beeline-product.html',              // facts-style stats view
  // Lightning drills the same two skills directly — it is the forcing-power
  // instrument the design plan's strategy/forcing matrix calls for, so it
  // belongs in the pilot alongside the two strategy games it backs up.
  'lightning-multiplication.html',
  'lightning-multi-step.html',
];
function isPilotUnlocked(href){
  return !PILOT_MODE || PILOT_UNLOCKED_HREFS.indexOf(href) !== -1;
}
/* Accessors, because a top-level `const` is NOT readable off a loaded page
   (see CLAUDE.md's Known Trap about nim.html's TARGET) and the tests must
   be able to derive their expectations from the live flag. That is what
   makes flipping PILOT_MODE back a one-line change instead of a one-line
   change plus 68 test edits. */
function pilotModeOn(){ return PILOT_MODE; }
function pilotUnlockedHrefs(){ return PILOT_UNLOCKED_HREFS.slice(); }

function applyPilotLock(){
  if (!PILOT_MODE) return;
  GLOBAL_GAMES.forEach(g => {
    if (g.status !== 'playable') return;
    if (Array.isArray(g.variants)){
      g.variants.forEach(v => { v.locked = !isPilotUnlocked(v.href); });
      const open = g.variants.filter(v => !v.locked);
      if (!open.length){
        // No variant of this family survives — the whole family locks.
        g.status = 'locked';
        g.lockedHref = g.href;   // see the note on lockedHref below
        delete g.href;
        delete g.multiVariant;
      } else {
        // "Play" must land on a variant that actually opens, not on
        // whatever happened to be listed first.
        g.href = open[0].href;
      }
    } else if (!isPilotUnlocked(g.href)){
      g.status = 'locked';
      /* `href` is deleted so no nav surface can accidentally render a link
         to a locked game — but the file still EXISTS and can be opened
         directly, and when it is, the page should still know which page it
         is. Without this, a locked single-variant game (Detective is the
         only one today) opened directly showed a stats panel with nothing
         expanded, because renderGlobalNav sets CURRENT_PAGE_HREF only when
         the game has an href. Keep the original under a name no renderer
         reads, purely for self-identification. */
      g.lockedHref = g.href;
      delete g.href;
    }
  });
}
applyPilotLock();

/* The four *-menu.html sub-menus hand-write their cards, so they are the
   one nav surface the GLOBAL_GAMES transform above cannot reach. This
   converts any card pointing at a locked variant into the same
   locked/"coming soon" treatment those pages already use for unbuilt
   variants — so e.g. Product Scuttle becomes locked inside
   scuttle-menu.html without that file being edited. */
function applyPilotLockToMenu(){
  if (!PILOT_MODE) return;
  const probe = document.createElement && document.createElement('div');
  if (!probe || !probe.children || !document.body) return;
  document.querySelectorAll('a.variant-card[href]').forEach(card => {
    const href = card.getAttribute('href');
    if (!href || isPilotUnlocked(href)) return;
    const locked = document.createElement('div');
    locked.className = card.className.replace(/\bactive\b/, 'locked').replace(/\bdemo-framed\b/, '').trim();
    locked.setAttribute('aria-disabled', 'true');
    locked.innerHTML = card.innerHTML;
    const badge = locked.querySelector('.badge');
    if (badge){ badge.className = 'badge soon'; badge.textContent = 'Coming soon'; }
    const chip = locked.querySelector('.badge.demo');
    if (chip) chip.remove();
    card.parentNode.replaceChild(locked, card);
  });
}

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
  wordmark.setAttribute('aria-label', 'Beast Classroom — home');
  const logo = document.createElement('img');
  logo.id = 'global-nav-logo';
  logo.src = 'design/BC_Logo_Whiteoutline.png';
  logo.alt = 'Beast Classroom';
  wordmark.appendChild(logo);
  nav.appendChild(wordmark);

  const gamesWrap = document.createElement('div');
  gamesWrap.id = 'global-nav-games';

  const toggle = document.createElement('button');
  toggle.id = 'global-nav-toggle';
  toggle.type = 'button';
  // A grid glyph over the word, stacked — the rail is 76px wide, and
  // "Games ▾" with a downward caret would be both too wide and wrong
  // (the panel opens sideways now, not below).
  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
    '<rect x="3" y="3" width="8" height="8" rx="1.5"></rect>' +
    '<rect x="13" y="3" width="8" height="8" rx="1.5"></rect>' +
    '<rect x="3" y="13" width="8" height="8" rx="1.5"></rect>' +
    '<rect x="13" y="13" width="8" height="8" rx="1.5"></rect></svg>' +
    '<span>Games</span>';
  toggle.setAttribute('aria-label', 'Games menu');
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
    // The right-aligned game-name label is gone — the page's own H1 and
    // kicker already name the game directly below it, so the bar was
    // repeating itself. Only the side effect below survives, and it is
    // load-bearing: it is how the stats panel knows which page it is on.
    // A SINGLE-variant game's key already identifies its one file, so the
    // nav key is enough to know which page this is (used by the stats
    // panel to expand that game's skill). A multi-variant key deliberately
    // isn't — it names a family, not a file — so those pages wait for
    // renderVariantSwitcher's explicit href instead of guessing a default.
    if (!currentGame.multiVariant) CURRENT_PAGE_HREF = currentGame.href || currentGame.lockedHref || CURRENT_PAGE_HREF;
  }

  document.body.insertBefore(nav, document.body.firstChild);
  applyPilotLockToMenu(); // pilot: lock hand-written sub-menu cards
  renderStatsLauncher(); // corner stats glyph, on every page
  renderRulesLauncher(); // corner rules glyph, on every page that has rules
  initTargetInfo();      // target helper text -> an info button + modal
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
  // Remember the page's own filename — the stats panel needs it to know
  // which skill to open expanded, and this is the one place a game
  // already tells us, explicitly and reliably.
  if (currentHref) CURRENT_PAGE_HREF = currentHref;
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
    } else if (v.locked){
      // Pilot mode: shown for completeness, but not navigable.
      const chip = document.createElement('span');
      chip.className = 'chip locked';
      chip.textContent = v.name;
      chip.setAttribute('aria-disabled', 'true');
      chip.title = 'Coming soon';
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
