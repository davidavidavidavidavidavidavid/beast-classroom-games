/*
 * Bot-tier simulation for Nim: Nickeled & Dimed — see CLAUDE.md "Bot AI
 * philosophy". Same shape as base Nim (turn-based, deterministic,
 * perfect-information, no dice), themed as coins: alternately add a
 * nickel (5¢) or a dime (10¢), racing to a pile of EXACTLY 50¢ — not "50
 * or more" like base Nim. See CLAUDE.md's design note for why this
 * variant's win condition genuinely differs from base Nim's (not just a
 * reskin), and why overshoot is prevented at the legal-move level (a dime
 * is simply never offered once it would pass 50¢) rather than handled as
 * a bust or left to produce an unfinishable game.
 *
 * Unlike every other bot-simulation script in this project, this one does
 * NOT reimplement the solver locally before "porting" it into the real
 * game — the whole point of THIS task is verifying the ALREADY-SHARED
 * implementation (`nimOptimalMove`/`nimImmediateWinMove`/
 * `nimIsWinningPosition`/`nimLegalMoves` in shared-game.js, used by BOTH
 * this game and base Nim) actually works for a second, genuinely
 * different-shaped consumer (exact-target win condition, different move
 * set and scale). So this script loads the real shared-game.js into a
 * small vm sandbox and calls the actual shipped functions directly,
 * rather than risking a parallel reimplementation that could quietly
 * drift from what's really shipped.
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

const TARGET = 50;
const MOVES = [5, 10];
const REACH_OR_EXCEED = false; // the real rule: exactly 50¢, not "50 or more" — see file header

function botEasy(total) {
  const legal = nimLegalMoves(TARGET - total, MOVES, REACH_OR_EXCEED);
  return legal[randInt(legal.length)];
}
function botMedium(total) {
  const m = nimImmediateWinMove(TARGET - total, MOVES, REACH_OR_EXCEED);
  if (m !== null) return m;
  const legal = nimLegalMoves(TARGET - total, MOVES, REACH_OR_EXCEED);
  return legal[randInt(legal.length)];
}
function botHard(total) {
  return nimOptimalMove(TARGET - total, MOVES, REACH_OR_EXCEED);
}
function chooseMove(tier, total) {
  if (tier === 'easy') return botEasy(total);
  if (tier === 'medium') return botMedium(total);
  return botHard(total);
}

function playGame(first, second) {
  let total = 0;
  let seat = 'first';
  const tiers = { first, second };
  while (true) {
    const amount = chooseMove(tiers[seat], total);
    total += amount;
    if (total === TARGET) return seat;
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

// The strongest test the shared extraction can get: base Nim (target 10,
// moves {1,2}, reachOrExceed=true) is an already fully-verified, solved
// game (see test/nim-bot-simulation.js). This variant is the EXACT same
// underlying combinatorics at a real (not rescaled) 5x — every reachable
// distanceToTarget here is 5x a reachable base-Nim one. If the shared
// solver is correct, the two must agree on which positions are winning at
// every corresponding pair, and — wherever the optimal move is even
// deterministic (a winning position; see below) — the coin move must be
// exactly 5x the base move.
function checkCrossScaleEquivalence() {
  let failures = 0;
  for (let d = 1; d <= 10; d++) {
    const baseWinning = nimIsWinningPosition(d, [1, 2], true);
    const coinWinning = nimIsWinningPosition(5 * d, [5, 10], false);
    if (baseWinning !== coinWinning) {
      console.error(`  ❌ distanceToTarget=${d} (base) vs ${5 * d} (coin): winning-position classification differs (${baseWinning} vs ${coinWinning})`);
      failures++;
      continue;
    }
    if (baseWinning) {
      // A winning position: nimOptimalMove's choice here is DETERMINISTIC
      // (an immediate win, or the first move found to leave the opponent
      // losing) — not a random fallback — so this is the one case where a
      // strict 5x relationship is actually meaningful to assert.
      const baseMove = nimOptimalMove(d, [1, 2], true);
      const coinMove = nimOptimalMove(5 * d, [5, 10], false);
      if (coinMove !== 5 * baseMove) {
        console.error(`  ❌ distanceToTarget=${d}: base optimal move ${baseMove} (x5=${5 * baseMove}) but coin optimal move is ${coinMove}`);
        failures++;
      }
    }
    // A losing position (mover is doomed regardless): both games fall
    // back to a random legal move, which doesn't scale 1:1 on any single
    // call by design — it genuinely doesn't matter which move you make
    // once you're already lost, on either side of the scale. Asserting a
    // specific value there would be testing randomness, not the solver.
  }
  if (failures > 0) throw new Error(`${failures} cross-scale equivalence mismatch(es) — the extraction changed the math`);
  console.log('  ✅ cross-scale equivalence verified for every distanceToTarget 1-10: base Nim (target 10, moves {1,2}) and Nickeled & Dimed (target 50, moves {5,10}) agree on every winning/losing classification, and wherever the optimal move is even deterministic, the coin move is always exactly 5x the base move');
}

function main() {
  console.log(`Nim: Nickeled & Dimed bot-tier simulation (${TRIALS} trials per matchup, first move alternated)\n`);

  // --- 1. Every simulated game actually terminates, landing on EXACTLY
  // 50¢ — never stuck, never anything else. A direct check on the
  // "prevent overshoot at the legal-move level" design: Easy (fully random
  // among LEGAL moves) is the riskiest tier for this, since it never
  // deliberately avoids anything. ---
  for (let i = 0; i < 200; i++) {
    let total = 0, turns = 0, seat = 'first';
    const tiers = { first: 'easy', second: 'easy' };
    while (total !== TARGET) {
      const amount = chooseMove(tiers[seat], total);
      if (total + amount > TARGET) throw new Error(`a "legal" move (${amount}) overshot from total=${total} — nimLegalMoves let an illegal move through`);
      total += amount;
      seat = seat === 'first' ? 'second' : 'first';
      turns++;
      if (turns > 20) throw new Error(`game did not terminate within 20 turns (stuck at total=${total}) — overshoot prevention may have failed`);
    }
  }
  console.log('  ✅ every simulated game terminates with the pile at EXACTLY 50¢ (never stuck, never overshoots) — 200/200 trials, Easy vs Easy (the riskiest tier combo, since it never deliberately avoids anything beyond what\'s legal)');

  // --- 2. Hard, moving first, must win every single time — exact, not
  // statistical, same as base Nim's own guarantee: this is the identical
  // combinatorial structure, just at real (unscaled) coin values. ---
  for (let i = 0; i < 500; i++) {
    if (playGame('hard', 'easy') !== 'first') throw new Error(`Hard moving first lost to Easy on trial ${i} — the shared solver is broken for this variant`);
  }
  for (let i = 0; i < 500; i++) {
    if (playGame('hard', 'medium') !== 'first') throw new Error(`Hard moving first lost to Medium on trial ${i} — the shared solver is broken for this variant`);
  }
  console.log('  ✅ Hard moving first: 500/500 wins vs Easy, 500/500 wins vs Medium (exact — perfect play cannot lose from the forced-win seat)');

  // --- 3. Overall win rates, first move alternated: Hard > Medium > Easy,
  // each by a clear margin — same thresholds as base Nim's own script,
  // since this is the same underlying game. ---
  const hardVsMedium = report('hard', 'medium');
  const hardVsEasy = report('hard', 'easy');
  const mediumVsEasy = report('medium', 'easy');

  if (hardVsMedium < 0.65) throw new Error(`Hard's overall win rate vs Medium (${(hardVsMedium * 100).toFixed(1)}%) is too close to a coin flip — expected it to clear ~65%+`);
  if (hardVsEasy < 0.75) throw new Error(`Hard's overall win rate vs Easy (${(hardVsEasy * 100).toFixed(1)}%) is too close to a coin flip — expected it to clear ~75%+`);
  if (mediumVsEasy < 0.55) throw new Error(`Medium's overall win rate vs Easy (${(mediumVsEasy * 100).toFixed(1)}%) should be a clear, meaningful edge, not roughly even`);
  if (hardVsEasy <= hardVsMedium) throw new Error('Hard should beat Easy at least as convincingly as it beats Medium');

  console.log(`\n  ✅ Hard > Medium > Easy confirmed across ${TRIALS}-trial alternated-first-move matchups (all comfortably clear their thresholds)`);

  // --- 4. The strongest test: cross-scale equivalence against the
  // already-solved base game — see CLAUDE.md and the user's own explicit
  // request for this specific check. ---
  checkCrossScaleEquivalence();
}

main();
