/*
 * Bot-tier simulation for Operations Numbo — see CLAUDE.md "Bot AI
 * philosophy". Unlike Nim/Beeline (turn-based/adversarial), this is
 * genuinely SIMULTANEOUS: both players see the same 4 rolled digits and
 * the same target, then independently build their own best expression —
 * no move order, no first-move advantage, no "seat" to worry about. That
 * puts this back under the ORIGINAL Scuttle/Pop-style bar (shared roll,
 * independent computation, "Hard never loses to Medium" as an EXACT claim,
 * not a statistical one) rather than the turn-based caveats Beeline/Nim
 * needed — see those two files' own headers for why they couldn't use
 * this simpler bar.
 *
 * Hard is a full exhaustive solver (see engine section below): every
 * distinct way to combine the 4 rolled digits (all orderings, all 5
 * binary-tree parenthesizations, all 4^3 operator combinations = up to
 * 7680 candidate expressions) is evaluated, and the one closest to target
 * is kept. Because this is a genuine exhaustive search over the ENTIRE
 * legal expression space, Hard's result is the mathematically best
 * achievable distance for that roll+target — it is not possible for any
 * other strategy to beat it, only tie it. That makes "Hard never loses"
 * an exact, checkable claim here (asserted every trial below, not just
 * statistically over many), the same way Nim's solve() made "Hard moving
 * first never loses" exact rather than statistical.
 */

'use strict';

const OPS = ['+', '-', '*', '/'];
const EPS = 1e-9;

function applyOp(op, a, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return Math.abs(b) < EPS ? null : a / b;
}

function num(v) { return { type: 'num', value: v }; }
function opNode(op, l, r) { return { type: 'op', op, l, r }; }

// The 5 distinct binary parenthesizations of 4 leaves in a fixed order
// [a,b,c,d] with operators [o1,o2,o3] between them, left to right —
// Catalan(3) = 5. Combined with all 4! orderings of the digits and all
// 4^3 operator assignments, this enumerates every expression shape the
// real rules allow (each rolled digit used exactly once, no concatenation
// — see CLAUDE.md's Numbo section for why concatenation is disallowed).
const SHAPES = [
  (d, o) => opNode(o[2], opNode(o[1], opNode(o[0], num(d[0]), num(d[1])), num(d[2])), num(d[3])), // ((a o1 b) o2 c) o3 d
  (d, o) => opNode(o[2], opNode(o[0], num(d[0]), opNode(o[1], num(d[1]), num(d[2]))), num(d[3])), // (a o1 (b o2 c)) o3 d
  (d, o) => opNode(o[1], opNode(o[0], num(d[0]), num(d[1])), opNode(o[2], num(d[2]), num(d[3]))), // (a o1 b) o2 (c o3 d)
  (d, o) => opNode(o[0], num(d[0]), opNode(o[2], opNode(o[1], num(d[1]), num(d[2])), num(d[3]))), // a o1 ((b o2 c) o3 d)
  (d, o) => opNode(o[0], num(d[0]), opNode(o[1], num(d[1]), opNode(o[2], num(d[2]), num(d[3])))), // a o1 (b o2 (c o3 d))
];

function evalTree(node) {
  if (node.type === 'num') return node.value;
  const l = evalTree(node.l);
  if (l === null) return null;
  const r = evalTree(node.r);
  if (r === null) return null;
  return applyOp(node.op, l, r);
}

function exprString(node) {
  if (node.type === 'num') return String(node.value);
  return `(${exprString(node.l)} ${node.op} ${exprString(node.r)})`;
}

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}

function randInt(n) { return Math.floor(Math.random() * n); }

// Every valid (no divide-by-zero) expression buildable from `digits`, as
// {tree, value} pairs. There is ALWAYS at least one (the all-"+" / all-"-"
// combos never divide by anything), so this never comes back empty — the
// base Numbo page's "if no answers are possible, reroll" rule is
// structurally unreachable in this variant and isn't implemented for that
// reason (see CLAUDE.md).
function allValidCombos(digits) {
  const combos = [];
  for (const perm of permutations(digits)) {
    for (const shapeFn of SHAPES) {
      for (const o1 of OPS) for (const o2 of OPS) for (const o3 of OPS) {
        const tree = shapeFn(perm, [o1, o2, o3]);
        const value = evalTree(tree);
        if (value !== null) combos.push({ tree, value });
      }
    }
  }
  return combos;
}

function dist(value, target) { return Math.abs(value - target); }

function botEasy(digits) {
  const combos = allValidCombos(digits);
  return combos[randInt(combos.length)];
}

// A human-plausible heuristic: try a handful of random combos (not an
// exhaustive search) and keep the best one found — a smart student
// sampling a few ideas, not silently solving the whole search space.
const MEDIUM_SAMPLE = 8;
function botMedium(digits, target) {
  const combos = allValidCombos(digits);
  let best = null;
  for (let i = 0; i < MEDIUM_SAMPLE; i++) {
    const c = combos[randInt(combos.length)];
    if (!best || dist(c.value, target) < dist(best.value, target)) best = c;
  }
  return best;
}

function botHard(digits, target) {
  const combos = allValidCombos(digits);
  let best = combos[0];
  for (const c of combos) {
    if (dist(c.value, target) < dist(best.value, target)) best = c;
  }
  return best;
}

function chooseMove(tier, digits, target) {
  if (tier === 'easy') return botEasy(digits);
  if (tier === 'medium') return botMedium(digits, target);
  return botHard(digits, target);
}

function rollDigits() {
  return [0, 0, 0, 0].map(() => randInt(10));
}

const TRIALS = 1500;

function simulate(tierA, tierB) {
  let aStrictlyBetter = 0, bStrictlyBetter = 0, ties = 0;
  let hardLostToOther = 0; // sanity counter — should stay exactly 0 whenever tierA/tierB includes 'hard'
  for (let i = 0; i < TRIALS; i++) {
    const digits = rollDigits();
    const target = randInt(99) + 1; // "should be less than 100", 1-99 — see CLAUDE.md
    const a = chooseMove(tierA, digits, target);
    const b = chooseMove(tierB, digits, target);
    const da = dist(a.value, target), db = dist(b.value, target);
    if (Math.abs(da - db) < EPS) ties++;
    else if (da < db) aStrictlyBetter++;
    else bStrictlyBetter++;

    if (tierA === 'hard' && da > db + EPS) hardLostToOther++;
    if (tierB === 'hard' && db > da + EPS) hardLostToOther++;
  }
  return { aStrictlyBetter, bStrictlyBetter, ties, hardLostToOther };
}

function report(tierA, tierB) {
  const r = simulate(tierA, tierB);
  console.log(`  ${tierA} vs ${tierB}: ${tierA} closer ${r.aStrictlyBetter}/${TRIALS} | ${tierB} closer ${r.bStrictlyBetter}/${TRIALS} | ties ${r.ties}/${TRIALS}`);
  return r;
}

function main() {
  console.log(`Operations Numbo bot-tier simulation (${TRIALS} trials per matchup, shared roll+target each trial)\n`);

  // --- 1. Hard is a true global optimum: EXACT, per-trial claim, not a
  // statistical one — it can never be strictly beaten by anything, only
  // tied (when the other tier happens to also find the true optimum). ---
  const hardVsMedium = report('hard', 'medium');
  const hardVsEasy = report('hard', 'easy');
  if (hardVsMedium.hardLostToOther > 0) throw new Error(`Hard lost to Medium on ${hardVsMedium.hardLostToOther} trial(s) — the exhaustive solver is broken (it should be mathematically impossible to beat)`);
  if (hardVsEasy.hardLostToOther > 0) throw new Error(`Hard lost to Easy on ${hardVsEasy.hardLostToOther} trial(s) — the exhaustive solver is broken`);
  console.log(`  ✅ Hard never strictly lost a single trial to Medium or Easy (exact, not statistical — Hard is a true exhaustive optimum)`);

  // --- 2. Hard should still be strictly better than Medium/Easy on a
  // clear majority of non-tied trials (most rolls have more than one
  // achievable closest value, so an imperfect search usually falls short
  // of it) — and Medium should have a real, meaningful edge over Easy. ---
  if (hardVsMedium.aStrictlyBetter < hardVsMedium.bStrictlyBetter) throw new Error('Hard should be strictly closer than Medium far more often than the reverse (impossible given Hard is optimal, but double-checking the direction)');
  if (hardVsMedium.aStrictlyBetter < TRIALS * 0.5) throw new Error(`Hard's edge over Medium (${hardVsMedium.aStrictlyBetter}/${TRIALS} strictly closer) is too thin — expected a clear majority`);
  if (hardVsEasy.aStrictlyBetter < TRIALS * 0.7) throw new Error(`Hard's edge over Easy (${hardVsEasy.aStrictlyBetter}/${TRIALS} strictly closer) is too thin — expected Hard to dominate a single random guess even more than it dominates Medium's ${MEDIUM_SAMPLE}-sample`);

  const mediumVsEasy = report('medium', 'easy');
  if (mediumVsEasy.aStrictlyBetter < mediumVsEasy.bStrictlyBetter) throw new Error(`Medium should beat Easy more often than the reverse — got Medium ${mediumVsEasy.aStrictlyBetter} vs Easy ${mediumVsEasy.bStrictlyBetter} (naive-heuristic-worse-than-random trap — see CLAUDE.md Bot AI philosophy)`);
  if (mediumVsEasy.aStrictlyBetter < TRIALS * 0.45) throw new Error(`Medium's edge over Easy (${mediumVsEasy.aStrictlyBetter}/${TRIALS} strictly closer) isn't clear enough`);

  console.log(`\n  ✅ Hard > Medium > Easy confirmed: Hard closer ${hardVsMedium.aStrictlyBetter}/${TRIALS} vs Medium, ${hardVsEasy.aStrictlyBetter}/${TRIALS} vs Easy; Medium closer ${mediumVsEasy.aStrictlyBetter}/${TRIALS} vs Easy`);

  // --- 3. Spot-check the engine itself against a known "24 game" answer:
  // 3,3,8,8 -> 24 exactly via 8/(3-8/3) (a classic example specifically
  // chosen because it needs a non-trivial parenthesization AND relies on
  // floating-point division landing within EPS of the target, not exact
  // equality — see CLAUDE.md Known traps for why this matters). ---
  const classic = botHard([3, 3, 8, 8], 24);
  if (dist(classic.value, 24) >= EPS) throw new Error(`Expected the solver to find an exact-24 expression from [3,3,8,8], got ${exprString(classic.tree)} = ${classic.value}`);
  console.log(`  ✅ classic 3,3,8,8 -> 24 case solved: ${exprString(classic.tree)} = ${classic.value} (within floating-point epsilon of exactly 24)`);
}

main();

module.exports = {
  OPS, EPS, applyOp, num, opNode, SHAPES, evalTree, exprString, permutations,
  allValidCombos, dist, botEasy, botMedium, botHard, MEDIUM_SAMPLE,
};
