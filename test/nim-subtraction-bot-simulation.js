/*
 * Bot-tier simulation for Nim: Subtraction — see CLAUDE.md "Bot AI
 * philosophy". Same shape as base Nim and Nickeled & Dimed (turn-based,
 * deterministic, perfect-information, no dice, a single running total,
 * alternating moves from a fixed set), but COUNTING DOWN instead of up: a
 * pile starts at 20 tokens, each turn removes 1, 2, or 3, and whoever
 * removes the LAST token (brings the pile to exactly 0) wins.
 *
 * This maps directly onto the shared solver without any new machinery:
 * `distanceToTarget` (shared-game.js's own term) is just the CURRENT PILE
 * SIZE here, not `TARGET - total` the way the two count-UP variants compute
 * it — since the goal is reaching 0, the remaining pile size already IS the
 * distance from the goal. `reachOrExceed=false` does the same job it does
 * for Nickeled & Dimed: a move that would remove more tokens than remain
 * is filtered out as illegal, which is just the real, obvious rule here
 * (you can't remove tokens that aren't there), not a special design choice.
 *
 * A genuinely new, real finding this simulation surfaced (not assumed from
 * either sibling): for THIS starting pile (20) and move set ({1,2,3}), the
 * forced-win seat is the OPPOSITE of base Nim's and Nickeled & Dimed's.
 * Both of those start from a distance that's an N-position (mover can force
 * a win) — 10 mod 3 = 1 for base Nim, 50 mod 15 = 5 for Nickeled & Dimed
 * (their moveSet's own equivalent modulus, k+1 scaled by 5) — so "moving
 * FIRST never loses" is their exact, provable claim. 20 mod (3+1) = 20 mod
 * 4 = 0 — a genuine P-position, i.e. the player TO MOVE from a fresh pile
 * of 20 is the one under a forced LOSS with perfect play on both sides;
 * going SECOND is what actually holds the forced win here. Verified
 * directly against the real shared solver below (not assumed from the
 * mod-4 subtraction-game formula, even though that formula predicts it
 * correctly) before writing a single line of the exact-record assertion —
 * see CLAUDE.md's own design note on why this matters and why the
 * "moving first never loses" claim would be simply WRONG to copy over
 * unchanged from either sibling script.
 *
 * Loads the real shared-game.js into a small vm sandbox and calls the
 * actual shipped functions directly (same discipline as the Nickeled &
 * Dimed script) — this is the ALREADY-SHARED solver, not a fresh
 * reimplementation, so there is nothing to "port" once these numbers check
 * out beyond the move set / pile framing itself.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'shared-game.js'), 'utf8'),
  sandbox,
  { filename: 'shared-game.js' }
);
const { nimOptimalMove, nimImmediateWinMove, nimIsWinningPosition, nimLegalMoves, randInt } = sandbox;

const PILE_START = 20;
const MOVES = [1, 2, 3];
const REACH_OR_EXCEED = false; // can't remove more tokens than remain — see file header

function botEasy(total) {
  const legal = nimLegalMoves(total, MOVES, REACH_OR_EXCEED);
  return legal[randInt(legal.length)];
}
function botMedium(total) {
  const m = nimImmediateWinMove(total, MOVES, REACH_OR_EXCEED);
  if (m !== null) return m;
  const legal = nimLegalMoves(total, MOVES, REACH_OR_EXCEED);
  return legal[randInt(legal.length)];
}
function botHard(total) {
  return nimOptimalMove(total, MOVES, REACH_OR_EXCEED);
}
function chooseMove(tier, total) {
  if (tier === 'easy') return botEasy(total);
  if (tier === 'medium') return botMedium(total);
  return botHard(total);
}

// Returns whichever seat ('first'/'second') removed the last token.
function playGame(first, second) {
  let total = PILE_START;
  let seat = 'first';
  const tiers = { first, second };
  while (true) {
    const amount = chooseMove(tiers[seat], total);
    total -= amount;
    if (total === 0) return seat;
    seat = seat === 'first' ? 'second' : 'first';
  }
}

function simulate(tierA, tierB, trials) {
  let winsA = 0, winsB = 0;
  for (let i = 0; i < trials; i++) {
    const aGoesFirst = i % 2 === 0;
    const result = aGoesFirst ? playGame(tierA, tierB) : playGame(tierB, tierA);
    const aWon = aGoesFirst ? result === 'first' : result === 'second';
    if (aWon) winsA++; else winsB++;
  }
  return { winsA, winsB, trials };
}

const TRIALS = 2000;

function report(tierA, tierB) {
  const r = simulate(tierA, tierB, TRIALS);
  const pctA = (100 * r.winsA / r.trials).toFixed(1);
  const pctB = (100 * r.winsB / r.trials).toFixed(1);
  console.log(`  ${tierA} vs ${tierB} (first move alternated): ${tierA}=${r.winsA}/${r.trials} (${pctA}%)  ${tierB}=${r.winsB}/${r.trials} (${pctB}%)`);
  return r.winsA / r.trials;
}

function main() {
  console.log(`Nim: Subtraction bot-tier simulation (${TRIALS} trials per matchup, first move alternated), pile=${PILE_START}, moves={1,2,3}\n`);

  // --- 0. Confirm the forced-win seat directly against the real solver,
  // rather than trusting the mod-4 subtraction-game formula by hand. ---
  const startIsWinningForMover = nimIsWinningPosition(PILE_START, MOVES, REACH_OR_EXCEED);
  console.log(`  pile=${PILE_START} winning-for-the-player-to-move: ${startIsWinningForMover}`);
  if (startIsWinningForMover) {
    throw new Error(`Expected pile=${PILE_START} to be a LOSING position for whoever moves first (20 mod 4 === 0) — the solver disagrees, re-check the move set/framing before writing any "moving X never loses" claim below.`);
  }
  console.log('  ✅ confirmed: a fresh pile of 20 is a forced LOSS for whoever moves first under perfect play — going SECOND is the real advantage here (the opposite of base Nim and Nickeled & Dimed)\n');

  // --- 1. Every simulated game actually terminates, landing on EXACTLY 0
  // — never negative, never stuck. Easy (fully random among LEGAL moves)
  // is the riskiest tier for this. ---
  for (let i = 0; i < 200; i++) {
    let total = PILE_START, turns = 0, seat = 'first';
    const tiers = { first: 'easy', second: 'easy' };
    while (total !== 0) {
      const amount = chooseMove(tiers[seat], total);
      if (amount > total) throw new Error(`a "legal" move (${amount}) removed more than the ${total} tokens remaining — nimLegalMoves let an illegal move through`);
      total -= amount;
      seat = seat === 'first' ? 'second' : 'first';
      turns++;
      if (turns > 30) throw new Error(`game did not terminate within 30 turns (stuck at total=${total})`);
    }
  }
  console.log('  ✅ every simulated game terminates with the pile at EXACTLY 0 (never negative, never stuck) — 200/200 trials, Easy vs Easy');

  // --- 2. The real, verified exact claim for THIS game: Hard moving
  // SECOND never loses — the forced-win seat confirmed in step 0. This is
  // the equivalent rigor to base Nim's/Nickeled & Dimed's own "moving
  // FIRST never loses," just for the correct seat here. ---
  for (let i = 0; i < 500; i++) {
    if (playGame('easy', 'hard') !== 'second') throw new Error(`Hard moving second lost to Easy on trial ${i} — the shared solver is broken for this variant, or the forced-win seat isn't what step 0 confirmed`);
  }
  for (let i = 0; i < 500; i++) {
    if (playGame('medium', 'hard') !== 'second') throw new Error(`Hard moving second lost to Medium on trial ${i} — the shared solver is broken for this variant, or the forced-win seat isn't what step 0 confirmed`);
  }
  console.log('  ✅ Hard moving SECOND: 500/500 wins vs Easy, 500/500 wins vs Medium (exact — perfect play from the forced-win seat cannot lose)');

  // --- 2b. Deliberately NOT asserted as exact: Hard moving FIRST is not
  // guaranteed to win every trial (it starts from a true P-position — any
  // move it makes hands the opponent an N-position, and if that opponent
  // ever happens to play the one correct reply, Hard is right back in the
  // same trap). Confirm it still wins MOST of the time against weaker,
  // imperfect opponents (they rarely find the exact trapping sequence
  // every turn), without requiring a perfect record — the honest claim for
  // a mover starting from a real disadvantage. ---
  let hardFirstWinsVsEasy = 0;
  for (let i = 0; i < 500; i++) if (playGame('hard', 'easy') === 'first') hardFirstWinsVsEasy++;
  console.log(`  Hard moving FIRST vs Easy (a real disadvantage, NOT asserted exact): ${hardFirstWinsVsEasy}/500 (${(hardFirstWinsVsEasy / 5).toFixed(1)}%)`);
  if (hardFirstWinsVsEasy < 350) throw new Error(`Hard moving first only won ${hardFirstWinsVsEasy}/500 vs Easy — expected it to still win comfortably most of the time despite the disadvantageous seat, since Easy rarely finds the exact trapping sequence`);

  // --- 3. Overall win rates, first move alternated (so the seat
  // disadvantage/advantage is shared equally, same fairness reasoning as
  // nextStarter in the real game): Hard > Medium > Easy, each by a clear
  // margin — same thresholds as the sibling Nim scripts, since skill still
  // dominates seat luck over many alternated trials. ---
  const hardVsMedium = report('hard', 'medium');
  const hardVsEasy = report('hard', 'easy');
  const mediumVsEasy = report('medium', 'easy');

  if (hardVsMedium < 0.65) throw new Error(`Hard's overall win rate vs Medium (${(hardVsMedium * 100).toFixed(1)}%) is too close to a coin flip — expected it to clear ~65%+`);
  if (hardVsEasy < 0.75) throw new Error(`Hard's overall win rate vs Easy (${(hardVsEasy * 100).toFixed(1)}%) is too close to a coin flip — expected it to clear ~75%+`);
  if (mediumVsEasy < 0.55) throw new Error(`Medium's overall win rate vs Easy (${(mediumVsEasy * 100).toFixed(1)}%) should be a clear, meaningful edge, not roughly even`);
  if (hardVsEasy <= hardVsMedium) throw new Error('Hard should beat Easy at least as convincingly as it beats Medium');

  console.log(`\n  ✅ Hard > Medium > Easy confirmed across ${TRIALS}-trial alternated-first-move matchups (all comfortably clear their thresholds)`);
}

main();
