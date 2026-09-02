/*
 * Standalone Node simulation for Pop — Expression variant's bot difficulty
 * tiers. Run BEFORE writing pop-expression.html, per CLAUDE.md's Bot AI
 * philosophy.
 *
 * Expression Pop is a genuine direct-reuse case, confirmed by reading the
 * full Teacher Instructions doc (not assumed from the catalog's identical
 * one-line summary — see CLAUDE.md's Known Traps on exactly that mistake
 * already happening once for Subtraction Pop): a longer, fixed +/-
 * sequence than Addition/Subtraction Pop (e.g. `_ _ + _ _ − _`), with the
 * SAME two-cause bust rule as Subtraction Pop (over target, OR the running
 * value coming out negative). Every helper below — placeWeight,
 * legalTargets, committedInsideSum, the bot tiers, isBusted, decideWinner —
 * already generalizes to any number of signed addends with zero changes,
 * confirmed by grepping pop-subtraction.html for a hardcoded "exactly 2
 * addends" assumption and finding none. This script exists to verify that
 * genuinely holds for real 3-term play, not just to assert it does.
 *
 * Run: node test/pop-expression-bot-simulation.js
 */

'use strict';

function rollDie() { return Math.floor(Math.random() * 10); }

/* ---------------- blank-structure helpers (signed place-values) ---------------- */

function placeWeight(pos, insideLens, insideSigns) {
  if (pos.kind !== 'inside') return 0;
  const len = insideLens[pos.addend];
  return insideSigns[pos.addend] * Math.pow(10, len - 1 - pos.idx);
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

function legalTargets(digit, state, insideLens) {
  const empties = emptyPositions(state);
  if (digit !== 0) return empties;
  const nonLeading = empties.filter(p => !isLeadingPos(p, insideLens));
  return nonLeading.length > 0 ? nonLeading : empties;
}

function committedInsideSum(state, insideLens, insideSigns) {
  let sum = 0;
  state.inside.forEach((arr, a) => arr.forEach((v, i) => {
    if (v !== null) sum += v * placeWeight({ kind: 'inside', addend: a, idx: i }, insideLens, insideSigns);
  }));
  return sum;
}

function remainingInsideWeight(state, insideLens, insideSigns) {
  let w = 0;
  state.inside.forEach((arr, a) => arr.forEach((v, i) => {
    if (v === null) w += placeWeight({ kind: 'inside', addend: a, idx: i }, insideLens, insideSigns);
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

function botMediumPop(digit, state, insideLens, insideSigns, target) {
  const choices = distinctChoices(digit, state, insideLens);
  if (choices.length === 1) return choices[0];
  const insideChoices = choices.filter(c => c.kind === 'inside');
  const throwChoice = choices.find(c => c.kind === 'throw') || null;
  if (insideChoices.length === 0) return throwChoice;

  insideChoices.sort((a, b) => Math.abs(placeWeight(b, insideLens, insideSigns)) - Math.abs(placeWeight(a, insideLens, insideSigns)));
  const bestSlot = insideChoices[0];
  const weight = placeWeight(bestSlot, insideLens, insideSigns);

  const committed = committedInsideSum(state, insideLens, insideSigns);
  const projectedNow = committed + digit * weight;
  const remainingAfter = remainingInsideWeight(state, insideLens, insideSigns) - weight;
  const projectedWithAvgFuture = projectedNow + remainingAfter * 5;

  if (!throwChoice || (projectedWithAvgFuture >= 0 && projectedWithAvgFuture <= target)) return bestSlot;
  return throwChoice;
}

function rolloutScore(state, insideLens, insideSigns, target) {
  let s = state;
  while (!isComplete(s)) {
    const d = rollDie();
    const choice = botMediumPop(d, s, insideLens, insideSigns, target);
    s = place(s, choice, d);
  }
  const sum = committedInsideSum(s, insideLens, insideSigns);
  return (sum > target || sum < 0) ? -1000 : -(target - sum);
}

function botHardPop(digit, state, insideLens, insideSigns, target, trials) {
  const choices = distinctChoices(digit, state, insideLens);
  if (choices.length === 1) return choices[0];
  let best = null;
  for (const choice of choices) {
    const placed = place(state, choice, digit);
    let total = 0;
    for (let t = 0; t < trials; t++) total += rolloutScore(placed, insideLens, insideSigns, target);
    const avg = total / trials;
    if (!best || avg > best.avg) best = { choice, avg };
  }
  return best.choice;
}

function botChooseRound(digit, state, insideLens, insideSigns, target, difficulty) {
  if (difficulty === 'easy') return botEasyPop(digit, state, insideLens);
  if (difficulty === 'medium') return botMediumPop(digit, state, insideLens, insideSigns, target);
  return botHardPop(digit, state, insideLens, insideSigns, target, 120);
}

function isBusted(sum, target) { return sum > target || sum < 0; }

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

function playMatch(insideLens, insideSigns, throwaways, target, diffA, diffB) {
  let a = emptyState(insideLens, throwaways);
  let b = emptyState(insideLens, throwaways);
  const totalBlanks = insideLens.reduce((s, l) => s + l, 0) + throwaways;
  for (let i = 0; i < totalBlanks; i++) {
    const d = rollDie();
    a = place(a, botChooseRound(d, a, insideLens, insideSigns, target, diffA), d);
    b = place(b, botChooseRound(d, b, insideLens, insideSigns, target, diffB), d);
  }
  const sumA = committedInsideSum(a, insideLens, insideSigns);
  const sumB = committedInsideSum(b, insideLens, insideSigns);
  return decideWinner(sumA, isBusted(sumA, target), sumB, isBusted(sumB, target), target);
}

function headToHead(insideLens, insideSigns, throwaways, target, diffA, diffB, matches) {
  let winsA = 0, winsB = 0, ties = 0;
  for (let i = 0; i < matches; i++) {
    const w = playMatch(insideLens, insideSigns, throwaways, target, diffA, diffB);
    if (w === 'human') winsA++; else if (w === 'bot') winsB++; else ties++;
  }
  return { winsA, winsB, ties, matches };
}

function pct(n, total) { return (100 * n / total).toFixed(1) + '%'; }

function report(label, insideLens, insideSigns, throwaways, target, diffA, diffB, matches) {
  const r = headToHead(insideLens, insideSigns, throwaways, target, diffA, diffB, matches);
  console.log(`  ${label}  (${matches} matches, target=${target})`);
  console.log(`    ${diffA}: ${r.winsA} (${pct(r.winsA, matches)})   ${diffB}: ${r.winsB} (${pct(r.winsB, matches)})   ties: ${r.ties} (${pct(r.ties, matches)})`);
  return r;
}

/* ---------------- run it ---------------- */

const MATCHES = 3000;
const t0 = Date.now();
console.log('Pop — Expression variant: bot difficulty head-to-head simulation\n');

console.log('Format A  ( _ _ + _ _ − _ , 2 throwaways, target 100 — structurally always positive, 11..198):');
const r1 = report('Hard vs Medium', [2, 2, 1], [1, 1, -1], 2, 100, 'hard', 'medium', MATCHES);
const r2 = report('Medium vs Easy', [2, 2, 1], [1, 1, -1], 2, 100, 'medium', 'easy', MATCHES);
const r3 = report('Hard vs Easy', [2, 2, 1], [1, 1, -1], 2, 100, 'hard', 'easy', MATCHES);

console.log('\nFormat B  ( _ _ − _ _ + _ , 2 throwaways, target 60 — can go negative, -89..98):');
const r4 = report('Hard vs Medium', [2, 2, 1], [1, -1, 1], 2, 60, 'hard', 'medium', MATCHES);
const r5 = report('Medium vs Easy', [2, 2, 1], [1, -1, 1], 2, 60, 'medium', 'easy', MATCHES);
const r6 = report('Hard vs Easy', [2, 2, 1], [1, -1, 1], 2, 60, 'hard', 'easy', MATCHES);

console.log(`\n(ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log('\nRequired: Hard must not lose more than it wins against Medium; Medium must not lose more than it wins against Easy.');
let failures = 0;
function checkBeats(r, strongerLabel, weakerLabel) {
  const pass = r.winsA >= r.winsB;
  console.log(`  ${pass ? '✅' : '❌'} ${strongerLabel} vs ${weakerLabel}: ${r.winsA} vs ${r.winsB} wins${pass ? '' : ' — FAILED'}`);
  if (!pass) failures++;
}
checkBeats(r1, 'Hard', 'Medium (A)');
checkBeats(r2, 'Medium', 'Easy (A)');
checkBeats(r3, 'Hard', 'Easy (A)');
checkBeats(r4, 'Hard', 'Medium (B)');
checkBeats(r5, 'Medium', 'Easy (B)');
checkBeats(r6, 'Hard', 'Easy (B)');

if (failures > 0) {
  console.error(`\n${failures} tier-ordering check(s) FAILED — do not ship these bots as-is.`);
  process.exitCode = 1;
} else {
  console.log('\nAll tier-ordering checks passed.');
}
