/*
 * Standalone Node simulation for Pop — Perimeter variant's bot difficulty
 * tiers. Run BEFORE writing pop-perimeter.html, per CLAUDE.md's Bot AI
 * philosophy: "a naive-seeming heuristic can be worse than random — always
 * verify empirically."
 *
 * Perimeter Pop reuses Addition Pop's exact engine shape (roll one digit at
 * a time, place into an inside blank or a throwaway, closest-to-target-
 * without-busting wins, only ONE bust cause since side lengths can't go
 * negative) with ONE real extension: each inside addend carries a per-
 * addend integer COEFFICIENT (length and width are each counted TWICE
 * toward the perimeter), generalizing Subtraction/Expression Pop's ±1
 * insideSigns to an arbitrary positive integer — see CLAUDE.md's Suggested
 * next steps note on Perimeter Pop and the design note this simulation's
 * results get written up into. `placeWeight` becomes coefficient-aware
 * (coeff * placeValue, not just placeValue) and every sum/projection
 * function that used it inherits the change — same "one function's meaning
 * changes, everything built on it just works" shape as insideSigns' own
 * extension into placeWeight for Subtraction Pop.
 *
 * This file has its own copy of the game logic (no build step / module
 * system to share code with the eventual inline <script>, per project
 * convention) — once these numbers check out, the same logic gets ported
 * into pop-perimeter.html.
 *
 * Run: node test/pop-perimeter-bot-simulation.js
 */

'use strict';

function rollDie() { return Math.floor(Math.random() * 10); }

/* ---------------- blank-structure helpers (coefficient-aware) ---------------- */

// Place value of an inside position, INCLUDING its addend's coefficient —
// leftmost digit of an L-digit addend is worth coeff * 10^(L-1), rightmost
// coeff * 10^0. insideCoeffs is normally all-positive here (Perimeter has no
// negative addends, unlike Subtraction/Expression Pop's insideSigns) but
// nothing below assumes that beyond "no bust-by-negative-result" — busting
// stays the single "over target" cause, same as Addition Pop.
function placeWeight(pos, insideLens, insideCoeffs) {
  if (pos.kind !== 'inside') return 0;
  const len = insideLens[pos.addend];
  return insideCoeffs[pos.addend] * Math.pow(10, len - 1 - pos.idx);
}

function emptyPositions(state) {
  const out = [];
  state.inside.forEach((arr, a) => arr.forEach((v, i) => { if (v === null) out.push({ kind: 'inside', addend: a, idx: i }); }));
  state.throw.forEach((v, i) => { if (v === null) out.push({ kind: 'throw', idx: i }); });
  return out;
}

function isLeadingPos(pos, insideLens) {
  return pos.kind === 'inside' && pos.idx === 0 && insideLens[pos.addend] > 1;
}

// Same legality rule as every other Pop variant (see CLAUDE.md's Pop
// design-decisions note) — a rolled 0 may not fill an empty leading
// inside-blank while any other kind of empty blank still exists.
function legalTargets(digit, state, insideLens) {
  const empties = emptyPositions(state);
  if (digit !== 0) return empties;
  const nonLeading = empties.filter(p => !isLeadingPos(p, insideLens));
  return nonLeading.length > 0 ? nonLeading : empties;
}

function committedInsideSum(state, insideLens, insideCoeffs) {
  let sum = 0;
  state.inside.forEach((arr, a) => arr.forEach((v, i) => {
    if (v !== null) sum += v * placeWeight({ kind: 'inside', addend: a, idx: i }, insideLens, insideCoeffs);
  }));
  return sum;
}

function remainingInsideWeight(state, insideLens, insideCoeffs) {
  let w = 0;
  state.inside.forEach((arr, a) => arr.forEach((v, i) => {
    if (v === null) w += placeWeight({ kind: 'inside', addend: a, idx: i }, insideLens, insideCoeffs);
  }));
  return w;
}

function isComplete(state) {
  return state.inside.every(arr => arr.every(v => v !== null)) && state.throw.every(v => v !== null);
}

function cloneState(state) {
  return { inside: state.inside.map(a => a.slice()), throw: state.throw.slice() };
}

function place(state, pos, digit) {
  const next = cloneState(state);
  if (pos.kind === 'inside') next.inside[pos.addend][pos.idx] = digit;
  else next.throw[pos.idx] = digit;
  return next;
}

function distinctChoices(digit, state, insideLens) {
  const legal = legalTargets(digit, state, insideLens);
  const insideChoices = legal.filter(p => p.kind === 'inside');
  const throwChoice = legal.find(p => p.kind === 'throw') || null;
  const choices = insideChoices.slice();
  if (throwChoice) choices.push(throwChoice);
  return choices;
}

/* ---------------- bot tiers ---------------- */

function botEasyPop(digit, state, insideLens) {
  const choices = distinctChoices(digit, state, insideLens);
  return choices[Math.floor(Math.random() * choices.length)];
}

// Medium: fill the most significant remaining inside blank (by coefficient-
// weighted place value, not just raw place value) with today's digit if
// that still projects to land at-or-under target assuming future digits
// average 5; otherwise bin it in a throwaway. Same shape as Addition Pop's
// own Medium, just coefficient-aware.
function botMediumPop(digit, state, insideLens, insideCoeffs, target) {
  const choices = distinctChoices(digit, state, insideLens);
  if (choices.length === 1) return choices[0];
  const insideChoices = choices.filter(c => c.kind === 'inside');
  const throwChoice = choices.find(c => c.kind === 'throw') || null;
  if (insideChoices.length === 0) return throwChoice;

  insideChoices.sort((a, b) => placeWeight(b, insideLens, insideCoeffs) - placeWeight(a, insideLens, insideCoeffs));
  const bestSlot = insideChoices[0];
  const weight = placeWeight(bestSlot, insideLens, insideCoeffs);

  const committed = committedInsideSum(state, insideLens, insideCoeffs);
  const projectedNow = committed + digit * weight;
  const remainingAfter = remainingInsideWeight(state, insideLens, insideCoeffs) - weight;
  const projectedWithAvgFuture = projectedNow + remainingAfter * 5;

  if (!throwChoice || projectedWithAvgFuture <= target) return bestSlot;
  return throwChoice;
}

function rolloutScore(state, insideLens, insideCoeffs, target) {
  let s = state;
  while (!isComplete(s)) {
    const d = rollDie();
    const choice = botMediumPop(d, s, insideLens, insideCoeffs, target);
    s = place(s, choice, d);
  }
  const sum = committedInsideSum(s, insideLens, insideCoeffs);
  return sum > target ? -1000 : -(target - sum);
}

function botHardPop(digit, state, insideLens, insideCoeffs, target, trials) {
  const choices = distinctChoices(digit, state, insideLens);
  if (choices.length === 1) return choices[0];
  let best = null;
  for (const choice of choices) {
    const placed = place(state, choice, digit);
    let total = 0;
    for (let t = 0; t < trials; t++) total += rolloutScore(placed, insideLens, insideCoeffs, target);
    const avg = total / trials;
    if (!best || avg > best.avg) best = { choice, avg };
  }
  return best.choice;
}

function botChooseRound(digit, state, insideLens, insideCoeffs, target, difficulty) {
  if (difficulty === 'easy') return botEasyPop(digit, state, insideLens);
  if (difficulty === 'medium') return botMediumPop(digit, state, insideLens, insideCoeffs, target);
  return botHardPop(digit, state, insideLens, insideCoeffs, target, 120);
}

/* ---------------- win condition (pure) — identical shape to Addition Pop's:
   only ONE bust cause (over target), no negative-result case (side lengths
   can't be negative). ---------------- */
function decideWinner(humanSum, humanBusted, botSum, botBusted, target) {
  if (humanBusted && botBusted) return 'tie';
  if (humanBusted) return 'bot';
  if (botBusted) return 'human';
  const humanDist = target - humanSum;
  const botDist = target - botSum;
  if (humanDist === botDist) return 'tie';
  return humanDist < botDist ? 'human' : 'bot';
}

/* ---------------- one full match, shared rolls ---------------- */

function emptyState(insideLens, throwaways) {
  return { inside: insideLens.map(len => Array(len).fill(null)), throw: Array(throwaways).fill(null) };
}

function playMatch(insideLens, insideCoeffs, throwaways, target, diffA, diffB) {
  let a = emptyState(insideLens, throwaways);
  let b = emptyState(insideLens, throwaways);
  const totalBlanks = insideLens.reduce((s, l) => s + l, 0) + throwaways;
  for (let i = 0; i < totalBlanks; i++) {
    const d = rollDie(); // shared roll: both players see the same digit, same as the real game
    a = place(a, botChooseRound(d, a, insideLens, insideCoeffs, target, diffA), d);
    b = place(b, botChooseRound(d, b, insideLens, insideCoeffs, target, diffB), d);
  }
  const sumA = committedInsideSum(a, insideLens, insideCoeffs);
  const sumB = committedInsideSum(b, insideLens, insideCoeffs);
  return decideWinner(sumA, sumA > target, sumB, sumB > target, target);
}

function headToHead(insideLens, insideCoeffs, throwaways, target, diffA, diffB, matches) {
  let winsA = 0, winsB = 0, ties = 0;
  for (let i = 0; i < matches; i++) {
    const w = playMatch(insideLens, insideCoeffs, throwaways, target, diffA, diffB);
    if (w === 'human') winsA++; else if (w === 'bot') winsB++; else ties++;
  }
  return { winsA, winsB, ties, matches };
}

function pct(n, total) { return (100 * n / total).toFixed(1) + '%'; }

function report(label, insideLens, insideCoeffs, throwaways, target, diffA, diffB, matches) {
  const r = headToHead(insideLens, insideCoeffs, throwaways, target, diffA, diffB, matches);
  console.log(`  ${label}  (${matches} matches, target=${target})`);
  console.log(`    ${diffA}: ${r.winsA} (${pct(r.winsA, matches)})   ${diffB}: ${r.winsB} (${pct(r.winsB, matches)})   ties: ${r.ties} (${pct(r.ties, matches)})`);
  return r;
}

/* ---------------- run it ---------------- */

const MATCHES = 3000;
const t0 = Date.now();
console.log('Pop — Perimeter variant: bot difficulty head-to-head simulation\n');

console.log('Format small ( 1-digit sides ×2 + ×2, 1 throwaway, target 18):');
const r1 = report('Hard vs Medium', [1, 1], [2, 2], 1, 18, 'hard', 'medium', MATCHES);
const r2 = report('Medium vs Easy', [1, 1], [2, 2], 1, 18, 'medium', 'easy', MATCHES);
const r3 = report('Hard vs Easy', [1, 1], [2, 2], 1, 18, 'hard', 'easy', MATCHES);

console.log('\nFormat big ( 2-digit sides ×2 + ×2, 2 throwaways, target 200):');
const r4 = report('Hard vs Medium', [2, 2], [2, 2], 2, 200, 'hard', 'medium', MATCHES);
const r5 = report('Medium vs Easy', [2, 2], [2, 2], 2, 200, 'medium', 'easy', MATCHES);
const r6 = report('Hard vs Easy', [2, 2], [2, 2], 2, 200, 'hard', 'easy', MATCHES);

console.log(`\n(ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log('\nRequired: Hard must not lose more than it wins against Medium; Medium must not lose more than it wins against Easy.');
let failures = 0;
function checkBeats(r, strongerLabel, weakerLabel) {
  const pass = r.winsA >= r.winsB;
  console.log(`  ${pass ? '✅' : '❌'} ${strongerLabel} vs ${weakerLabel}: ${r.winsA} vs ${r.winsB} wins${pass ? '' : ' — FAILED'}`);
  if (!pass) failures++;
}
checkBeats(r1, 'Hard', 'Medium (small)');
checkBeats(r2, 'Medium', 'Easy (small)');
checkBeats(r3, 'Hard', 'Easy (small)');
checkBeats(r4, 'Hard', 'Medium (big)');
checkBeats(r5, 'Medium', 'Easy (big)');
checkBeats(r6, 'Hard', 'Easy (big)');

if (failures > 0) {
  console.error(`\n${failures} tier-ordering check(s) FAILED — do not ship these bots as-is.`);
  process.exitCode = 1;
} else {
  console.log('\nAll tier-ordering checks passed.');
}
