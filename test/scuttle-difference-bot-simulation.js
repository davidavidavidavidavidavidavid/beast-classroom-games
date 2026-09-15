/*
 * Standalone Node simulation for Scuttle — Difference variant's bot
 * difficulty tiers. Run BEFORE writing scuttle-difference.html, per
 * CLAUDE.md's Bot AI philosophy: "a naive-seeming heuristic can be worse
 * than random — always verify empirically." Confirms Hard never loses to
 * Medium, and Medium beats Easy, across many shared-roll matches using the
 * real win/threshold logic — not just "the code looks reasonable."
 *
 * Difference Scuttle reuses Product Scuttle's exact shell (split shared
 * dice into two numbers each round, evaluate, sum 3 rounds, smallest total
 * still over a minimum wins — see design/game-catalog.csv: "same shell as
 * Product but subtract") — but the per-round value function is
 * Math.abs(num1-num2), not num1*num2. This is NOT a cosmetic swap for the
 * Medium heuristic: Product's own Medium *interleaves* big/small digits
 * between two equal-length numbers (good for a product, since for a fixed
 * digit pool, keeping the two factors close in size tends to maximize
 * their product). For a DIFFERENCE, the opposite intuition holds — you
 * maximize |a-b| by making the two numbers as far apart as possible, i.e.
 * segregating the biggest digits into one number and the smallest into the
 * other, not interleaving them. Verified here from scratch, not assumed
 * from Product's already-shipped heuristic — see CLAUDE.md Known Traps'
 * warning about exactly this kind of unverified cross-variant assumption.
 *
 * This file has its own copy of the game logic (no build step / module
 * system to share code with the eventual inline <script>, per project
 * convention) — once these numbers check out, the same logic gets ported
 * into scuttle-difference.html.
 *
 * Run: node test/scuttle-difference-bot-simulation.js
 */

'use strict';

function rollDie() { return Math.floor(Math.random() * 10); }
function rollN(n) { return Array.from({ length: n }, rollDie); }

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}
function combinations(arr, k) {
  const results = [];
  function helper(start, combo) {
    if (combo.length === k) { results.push(combo.slice()); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); helper(i + 1, combo); combo.pop(); }
  }
  helper(0, []);
  return results;
}
function buildNumber(digits, idxOrder) { return idxOrder.reduce((acc, i) => acc * 10 + digits[i], 0); }

// Every valid way to split `digits` into a d1-digit and a d2-digit number
// (no leading zeros unless every digit in that number is a 0), scored by
// their absolute difference. Direct analog of Product Scuttle's own
// enumerateProductOptions, just a different value function.
function enumerateDifferenceOptions(digits, d1, d2) {
  const idx = digits.map((_, i) => i);
  const subsets = combinations(idx, d1);
  const seen = new Set(); const results = [];
  for (const subset of subsets) {
    const complement = idx.filter(i => !subset.includes(i));
    for (const p1 of permutations(subset)) {
      if (d1 > 1 && digits[p1[0]] === 0) continue;
      const num1 = buildNumber(digits, p1);
      for (const p2 of permutations(complement)) {
        if (d2 > 1 && digits[p2[0]] === 0) continue;
        const num2 = buildNumber(digits, p2);
        const key = num1 + 'x' + num2;
        if (!seen.has(key)) { seen.add(key); results.push({ num1, num2, diff: Math.abs(num1 - num2) }); }
      }
    }
  }
  if (results.length === 0) {
    // Every digit is 0 (or otherwise no leading-zero-free split exists) —
    // fall back to allowing leading zeros, same escape hatch as Product.
    for (const subset of subsets) {
      const complement = idx.filter(i => !subset.includes(i));
      for (const p1 of permutations(subset)) {
        const num1 = buildNumber(digits, p1);
        for (const p2 of permutations(complement)) {
          const num2 = buildNumber(digits, p2);
          const key = num1 + 'x' + num2;
          if (!seen.has(key)) { seen.add(key); results.push({ num1, num2, diff: Math.abs(num1 - num2) }); }
        }
      }
    }
  }
  return results;
}

/* ---------------- bot tiers ---------------- */

function botEasyDifference(digits, d1, d2) {
  const options = enumerateDifferenceOptions(digits, d1, d2);
  return options[Math.floor(Math.random() * options.length)];
}

// Medium: segregate, don't interleave — sort all digits descending, give
// the biggest d1 of them to number 1 (built largest-first) and the
// remaining (smallest) d2 digits to number 2 (built smallest-first,
// respecting leading-zero avoidance). This maximizes the SPREAD between
// the two numbers, which is what actually maximizes |num1-num2| for a
// fixed digit pool — the opposite heuristic shape from Product's own
// interleave-when-equal-length Medium. Simple and human-plausible; not
// guaranteed optimal (that's what Hard's exhaustive search is for).
function largestArrangement(digits) {
  const sorted = digits.slice().sort((a, b) => b - a);
  return buildNumber(sorted, sorted.map((_, i) => i));
}
function smallestArrangement(digits) {
  const sorted = digits.slice().sort((a, b) => a - b);
  if (sorted.length > 1 && sorted[0] === 0) {
    const firstNonZero = sorted.findIndex(d => d !== 0);
    if (firstNonZero !== -1) {
      const swapped = sorted.slice();
      swapped[0] = sorted[firstNonZero];
      swapped[firstNonZero] = 0;
      return buildNumber(swapped, swapped.map((_, i) => i));
    }
  }
  return buildNumber(sorted, sorted.map((_, i) => i));
}
function fixLeadingZero(digitsArr) {
  if (digitsArr.length > 1 && digitsArr[0] === 0) {
    const idx = digitsArr.findIndex((d, i) => i > 0 && d !== 0);
    if (idx !== -1) {
      const copy = digitsArr.slice();
      copy[0] = digitsArr[idx];
      copy[idx] = 0;
      return copy;
    }
  }
  return digitsArr;
}

// Target-aware, same reasoning as Hard's own fix above (see that comment),
// just cheaper/simpler — a human-plausible rule rather than an exact
// per-round-share computation: "if we already have enough, don't pile on
// more than necessary; if we still need more, go big." Below target:
// unchanged segregate-for-max-spread behavior. At/above target: balances
// the two numbers instead (interleaves big/small digits between them, the
// same intuition Product Scuttle's own Medium already uses for keeping two
// factors close together) to keep this round's own contribution small.
function botMediumDifference(digits, d1, d2, runningSum, target) {
  if (runningSum >= target) {
    const sortedIdx = digits.map((_, i) => i).sort((a, b) => digits[b] - digits[a]);
    let g1 = [], g2 = [];
    sortedIdx.forEach((i, pos) => (pos % 2 === 0 ? g1 : g2).push(digits[i]));
    g1 = g1.slice(0, d1).sort((a, b) => b - a);
    g2 = g2.slice(0, d2).sort((a, b) => b - a);
    const arr1 = fixLeadingZero(g1), arr2 = fixLeadingZero(g2);
    const num1 = buildNumber(arr1, arr1.map((_, i) => i));
    const num2 = buildNumber(arr2, arr2.map((_, i) => i));
    return { num1, num2, diff: Math.abs(num1 - num2) };
  }
  const sortedIdx = digits.map((_, i) => i).sort((a, b) => digits[b] - digits[a]);
  const bigIdx = sortedIdx.slice(0, d1);
  const smallIdx = sortedIdx.slice(d1, d1 + d2);
  const num1 = largestArrangement(bigIdx.map(i => digits[i]));
  const num2 = smallestArrangement(smallIdx.map(i => digits[i]));
  return { num1, num2, diff: Math.abs(num1 - num2) };
}

// Hard: exact brute force over each round's own options — but NOT a
// straight port of Product's "maximize non-final rounds, refine only the
// last" shape. That shape quietly assumes a single round can never reach
// the target alone (true for Product's own thresholds, which need real
// multi-round accumulation) — verified FALSE here on the first simulation
// run below for the 3-digit format (a single 3-digit-vs-3-digit round can
// swing up to ~999, well past a target of 500), where "always maximize"
// made Hard massively overshoot and lose to random play. Since every
// round's diff is >=0 and permanently adds to the running sum (no round
// can undo an earlier one), the real goal every non-final round is to stay
// on a trajectory that leaves the LAST round able to land just barely over
// target — so instead of "maximize," non-final rounds aim for an even
// per-round share of whatever target distance remains
// (`(target-runningSum)/roundsLeft`), picking whichever of this round's
// actual options lands closest to that share. This adapts automatically to
// BOTH regimes without hardcoding either: when a format's per-round max is
// well under the target (Product-shaped — and the 2-digit Difference
// format below, where 3 rounds of ~99 are genuinely needed to clear 100),
// the share is large and this converges to "take the biggest available
// option" on its own; when a format's per-round max can dwarf the target
// (the 3-digit format's real shape), the share is small and this converges
// to "take a small, precise option" instead — exactly the restraint that
// was missing. The final round is untouched: exact "smallest total that
// clears the target, else the largest available" (Product's own logic —
// still correct there, since it's an exact one-round optimization either way).
function botHardDifferenceRound(digits, d1, d2, runningSum, target, round) {
  const options = enumerateDifferenceOptions(digits, d1, d2);
  const isFinalRound = round === 3;
  if (!isFinalRound) {
    const roundsLeft = 3 - round + 1;
    const shareTarget = Math.max(0, target - runningSum) / roundsLeft;
    let best = options[0], bestDist = Math.abs(options[0].diff - shareTarget);
    for (const o of options) {
      const dist = Math.abs(o.diff - shareTarget);
      if (dist < bestDist) { bestDist = dist; best = o; }
    }
    return best;
  }
  let bestOver = null, bestAny = null;
  for (const o of options) {
    const total = runningSum + o.diff;
    if (total > target && (!bestOver || total < bestOver.total)) bestOver = { ...o, total };
    if (!bestAny || total > bestAny.total) bestAny = { ...o, total };
  }
  return bestOver || bestAny;
}

function botChooseRound(round, digits, d1, d2, runningSum, target, difficulty) {
  if (difficulty === 'easy') return botEasyDifference(digits, d1, d2);
  if (difficulty === 'medium') return botMediumDifference(digits, d1, d2, runningSum, target);
  return botHardDifferenceRound(digits, d1, d2, runningSum, target, round);
}

/* ---------------- win condition (pure) — identical shape to Product Scuttle's ---------------- */
function decideWinner(humanSum, botSum, target) {
  const humanOver = humanSum > target;
  const botOver = botSum > target;
  if (humanOver && botOver) return humanSum === botSum ? 'tie' : (humanSum < botSum ? 'human' : 'bot');
  if (humanOver && !botOver) return 'human';
  if (!humanOver && botOver) return 'bot';
  return humanSum === botSum ? 'tie' : (humanSum > botSum ? 'human' : 'bot');
}

/* ---------------- one full match, shared rolls ---------------- */

function playMatch(diceCount, d1, d2, target, diffA, diffB) {
  let sumA = 0, sumB = 0;
  for (let round = 1; round <= 3; round++) {
    const digits = rollN(diceCount); // shared roll: both players split the SAME dice
    const choiceA = botChooseRound(round, digits, d1, d2, sumA, target, diffA);
    const choiceB = botChooseRound(round, digits, d1, d2, sumB, target, diffB);
    sumA += choiceA.diff;
    sumB += choiceB.diff;
  }
  return decideWinner(sumA, sumB, target);
}

function headToHead(diceCount, d1, d2, target, diffA, diffB, matches) {
  let winsA = 0, winsB = 0, ties = 0;
  for (let i = 0; i < matches; i++) {
    const w = playMatch(diceCount, d1, d2, target, diffA, diffB);
    if (w === 'human') winsA++; else if (w === 'bot') winsB++; else ties++;
  }
  return { winsA, winsB, ties, matches };
}

function pct(n, total) { return (100 * n / total).toFixed(1) + '%'; }

function report(label, diceCount, d1, d2, target, diffA, diffB, matches) {
  const r = headToHead(diceCount, d1, d2, target, diffA, diffB, matches);
  console.log(`  ${label}  (${matches} matches, target=${target})`);
  console.log(`    ${diffA}: ${r.winsA} (${pct(r.winsA, matches)})   ${diffB}: ${r.winsB} (${pct(r.winsB, matches)})   ties: ${r.ties} (${pct(r.ties, matches)})`);
  return r;
}

/* ---------------- run it ---------------- */

const MATCHES = 3000;
const t0 = Date.now();
console.log('Scuttle — Difference variant: bot difficulty head-to-head simulation\n');

console.log('Format 2-digit (4 dice, two 2-digit numbers, target 100):');
const r1 = report('Hard vs Medium', 4, 2, 2, 100, 'hard', 'medium', MATCHES);
const r2 = report('Medium vs Easy', 4, 2, 2, 100, 'medium', 'easy', MATCHES);
const r3 = report('Hard vs Easy', 4, 2, 2, 100, 'hard', 'easy', MATCHES);

console.log('\nFormat 3-digit (6 dice, two 3-digit numbers, target 500):');
const r4 = report('Hard vs Medium', 6, 3, 3, 500, 'hard', 'medium', MATCHES);
const r5 = report('Medium vs Easy', 6, 3, 3, 500, 'medium', 'easy', MATCHES);
const r6 = report('Hard vs Easy', 6, 3, 3, 500, 'hard', 'easy', MATCHES);

console.log(`\n(ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log('\nRequired: Hard must not lose more than it wins against Medium; Medium must not lose more than it wins against Easy.');
let failures = 0;
function checkBeats(r, strongerLabel, weakerLabel) {
  const pass = r.winsA >= r.winsB;
  console.log(`  ${pass ? '✅' : '❌'} ${strongerLabel} vs ${weakerLabel}: ${r.winsA} vs ${r.winsB} wins${pass ? '' : ' — FAILED'}`);
  if (!pass) failures++;
}
checkBeats(r1, 'Hard', 'Medium (2-digit)');
checkBeats(r2, 'Medium', 'Easy (2-digit)');
checkBeats(r3, 'Hard', 'Easy (2-digit)');
checkBeats(r4, 'Hard', 'Medium (3-digit)');
checkBeats(r5, 'Medium', 'Easy (3-digit)');
checkBeats(r6, 'Hard', 'Easy (3-digit)');

if (failures > 0) {
  console.error(`\n${failures} tier-ordering check(s) FAILED — do not ship these bots as-is.`);
  process.exitCode = 1;
} else {
  console.log('\nAll tier-ordering checks passed.');
}
