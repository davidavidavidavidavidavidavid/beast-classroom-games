/*
 * Standalone Node simulation for Pop — Addition variant's bot difficulty
 * tiers. Run BEFORE writing pop-addition.html, per CLAUDE.md's Bot AI
 * philosophy: "a naive-seeming heuristic can be worse than random — always
 * verify empirically." Confirms Hard never loses to Medium, and Medium
 * beats Easy, across many shared-roll matches using the real win/bust
 * logic — not just "the code looks reasonable."
 *
 * This file has its own copy of the game logic (no build step / module
 * system to share code with the eventual inline <script>, per project
 * convention) — once these numbers check out, the same logic gets ported
 * into pop-addition.html.
 *
 * Run: node test/pop-addition-bot-simulation.js
 */

'use strict';

function rollDie() { return Math.floor(Math.random() * 10); }

/* ---------------- blank-structure helpers ---------------- */

// Place value of an inside position: leftmost digit of an L-digit addend is
// worth 10^(L-1), rightmost is worth 10^0.
function placeWeight(pos, insideLens) {
  if (pos.kind !== 'inside') return 0;
  const len = insideLens[pos.addend];
  return Math.pow(10, len - 1 - pos.idx);
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

// Legality rule for where a rolled digit may go. Scuttle's "block only if a
// nonzero alternative currently exists" doesn't transfer here: Scuttle sees
// its whole digit pool before deciding, Pop sees one digit at a time with no
// idea what's still coming. The rule adopted instead: a rolled 0 may not
// fill an empty *leading* inside-blank while any other kind of empty blank
// (a non-leading inside position, or a throwaway) still exists — since
// there's always somewhere less costly to put it. A 0 is only forced into a
// leading blank when every remaining empty blank is itself a leading blank
// (so there genuinely is no better option left).
function legalTargets(digit, state, insideLens) {
  const empties = emptyPositions(state);
  if (digit !== 0) return empties;
  const nonLeading = empties.filter(p => !isLeadingPos(p, insideLens));
  return nonLeading.length > 0 ? nonLeading : empties;
}

function committedInsideSum(state, insideLens) {
  let sum = 0;
  state.inside.forEach((arr, a) => arr.forEach((v, i) => {
    if (v !== null) sum += v * placeWeight({ kind: 'inside', addend: a, idx: i }, insideLens);
  }));
  return sum;
}

function remainingInsideWeight(state, insideLens) {
  let w = 0;
  state.inside.forEach((arr, a) => arr.forEach((v, i) => {
    if (v === null) w += placeWeight({ kind: 'inside', addend: a, idx: i }, insideLens);
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

// Which physical throwaway slot a digit lands in never affects the final
// sum — they're interchangeable. Collapse them to one representative choice
// so bot decisions (and Hard's Monte Carlo branching) don't waste effort
// distinguishing options that are actually identical in outcome.
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

// Medium: fill your most significant remaining inside blank with today's
// digit if that still projects to land at-or-under target assuming future
// digits average out to 5 (the midpoint of 0-9); otherwise bin it in a
// throwaway. Simple and human-plausible — not guaranteed optimal (that's
// what Hard is for), and per CLAUDE.md this gets verified below, not
// assumed.
function botMediumPop(digit, state, insideLens, target) {
  const choices = distinctChoices(digit, state, insideLens);
  if (choices.length === 1) return choices[0];
  const insideChoices = choices.filter(c => c.kind === 'inside');
  const throwChoice = choices.find(c => c.kind === 'throw') || null;
  if (insideChoices.length === 0) return throwChoice;

  insideChoices.sort((a, b) => placeWeight(b, insideLens) - placeWeight(a, insideLens));
  const bestSlot = insideChoices[0];
  const weight = placeWeight(bestSlot, insideLens);

  const committed = committedInsideSum(state, insideLens);
  const projectedNow = committed + digit * weight;
  const remainingAfter = remainingInsideWeight(state, insideLens) - weight;
  const projectedWithAvgFuture = projectedNow + remainingAfter * 5;

  if (!throwChoice || projectedWithAvgFuture <= target) return bestSlot;
  return throwChoice;
}

function rolloutScore(state, insideLens, target) {
  // Finish out a state using Medium's heuristic against freshly-rolled
  // random future digits (a cheap, reasonable rollout policy), then score
  // the completed result. Busting is a fixed large penalty — always far
  // worse than any non-bust outcome — so maximizing average score means
  // minimizing (bust probability, then distance from target).
  let s = state;
  while (!isComplete(s)) {
    const d = rollDie();
    const choice = botMediumPop(d, s, insideLens, target);
    s = place(s, choice, d);
  }
  const sum = committedInsideSum(s, insideLens);
  return sum > target ? -1000 : -(target - sum);
}

function botHardPop(digit, state, insideLens, target, trials) {
  const choices = distinctChoices(digit, state, insideLens);
  if (choices.length === 1) return choices[0];
  let best = null;
  for (const choice of choices) {
    const placed = place(state, choice, digit);
    let total = 0;
    for (let t = 0; t < trials; t++) total += rolloutScore(placed, insideLens, target);
    const avg = total / trials;
    if (!best || avg > best.avg) best = { choice, avg };
  }
  return best.choice;
}

// The fixed entry point every difficulty dispatches through (see CLAUDE.md
// Code conventions) — here a per-*roll* decision rather than per-round,
// since Pop reveals one digit at a time instead of Scuttle's whole pool at
// once.
function botChooseRound(digit, state, insideLens, target, difficulty) {
  if (difficulty === 'easy') return botEasyPop(digit, state, insideLens);
  if (difficulty === 'medium') return botMediumPop(digit, state, insideLens, target);
  return botHardPop(digit, state, insideLens, target, 120);
}

/* ---------------- win condition (pure) ---------------- */

function decideWinner(humanSum, humanBusted, botSum, botBusted, target) {
  // Simultaneous bust isn't covered by the source rules (they only say a
  // busting player loses "regardless of margin," which speaks to one
  // player's own bust, not to comparing two busts). Treated as a friendly
  // tie, consistent with every other tie in this project.
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

function playMatch(insideLens, throwaways, target, diffA, diffB) {
  let a = emptyState(insideLens, throwaways);
  let b = emptyState(insideLens, throwaways);
  const totalBlanks = insideLens.reduce((s, l) => s + l, 0) + throwaways;
  for (let i = 0; i < totalBlanks; i++) {
    const d = rollDie(); // shared roll: both players see the same digit, same as the real game
    a = place(a, botChooseRound(d, a, insideLens, target, diffA), d);
    b = place(b, botChooseRound(d, b, insideLens, target, diffB), d);
  }
  const sumA = committedInsideSum(a, insideLens);
  const sumB = committedInsideSum(b, insideLens);
  return decideWinner(sumA, sumA > target, sumB, sumB > target, target);
}

function headToHead(insideLens, throwaways, target, diffA, diffB, matches) {
  let winsA = 0, winsB = 0, ties = 0;
  for (let i = 0; i < matches; i++) {
    const w = playMatch(insideLens, throwaways, target, diffA, diffB);
    if (w === 'human') winsA++; else if (w === 'bot') winsB++; else ties++;
  }
  return { winsA, winsB, ties, matches };
}

function pct(n, total) { return (100 * n / total).toFixed(1) + '%'; }

function report(label, insideLens, throwaways, target, diffA, diffB, matches) {
  const r = headToHead(insideLens, throwaways, target, diffA, diffB, matches);
  console.log(`  ${label}  (${matches} matches, target=${target})`);
  console.log(`    ${diffA}: ${r.winsA} (${pct(r.winsA, matches)})   ${diffB}: ${r.winsB} (${pct(r.winsB, matches)})   ties: ${r.ties} (${pct(r.ties, matches)})`);
  return r;
}

/* ---------------- run it ---------------- */

const MATCHES = 3000;
const t0 = Date.now();
console.log('Pop — Addition variant: bot difficulty head-to-head simulation\n');

console.log('Format 2+1  ( _ _ + _ , 2 throwaways, target 50):');
const r1 = report('Hard vs Medium', [2, 1], 2, 50, 'hard', 'medium', MATCHES);
const r2 = report('Medium vs Easy', [2, 1], 2, 50, 'medium', 'easy', MATCHES);
const r3 = report('Hard vs Easy', [2, 1], 2, 50, 'hard', 'easy', MATCHES);

console.log('\nFormat 2+2  ( _ _ + _ _ , 2 throwaways, target 100):');
const r4 = report('Hard vs Medium', [2, 2], 2, 100, 'hard', 'medium', MATCHES);
const r5 = report('Medium vs Easy', [2, 2], 2, 100, 'medium', 'easy', MATCHES);
const r6 = report('Hard vs Easy', [2, 2], 2, 100, 'hard', 'easy', MATCHES);

console.log(`\n(ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log('\nRequired: Hard must not lose more than it wins against Medium; Medium must not lose more than it wins against Easy.');
let failures = 0;
function checkBeats(r, strongerLabel, weakerLabel) {
  const pass = r.winsA >= r.winsB;
  console.log(`  ${pass ? '✅' : '❌'} ${strongerLabel} vs ${weakerLabel}: ${r.winsA} vs ${r.winsB} wins${pass ? '' : ' — FAILED'}`);
  if (!pass) failures++;
}
checkBeats(r1, 'Hard', 'Medium (2+1)');
checkBeats(r2, 'Medium', 'Easy (2+1)');
checkBeats(r3, 'Hard', 'Easy (2+1)');
checkBeats(r4, 'Hard', 'Medium (2+2)');
checkBeats(r5, 'Medium', 'Easy (2+2)');
checkBeats(r6, 'Hard', 'Easy (2+2)');

if (failures > 0) {
  console.error(`\n${failures} tier-ordering check(s) FAILED — do not ship these bots as-is.`);
  process.exitCode = 1;
} else {
  console.log('\nAll tier-ordering checks passed.');
}
