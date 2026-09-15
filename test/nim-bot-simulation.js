/*
 * Bot-tier simulation for Nim (base game) — see CLAUDE.md "Bot AI
 * philosophy". Turn-based, deterministic, perfect-information, no dice —
 * same broad category as Beeline, but far smaller: a single running total
 * with two legal moves (+1, +2), racing to reach or exceed TARGET=10. This
 * is a genuinely SOLVED combinatorial game (a "race" variant of Nim /
 * Bachet's game), so Hard isn't a heuristic or a depth-limited search — it's
 * a full exhaustive solve of the entire (tiny) state space, memoized once.
 * Matches the catalog's own note for this family: "Bot AI is a KNOWN
 * modular-arithmetic formula per variant."
 *
 * A real wrinkle this game surfaces that isn't fully covered by the
 * existing Bot AI philosophy wording: going first isn't just an advantage
 * here, it's a PROVEN forced win under optimal play. TARGET=10, MOVES={1,2}
 * means (TARGET - total) mod 3 determines who's winning: a position where
 * that remainder is 0 is a loss for whoever must move from it, and
 * (10 - 0) mod 3 === 1, so the very first mover already holds a forced win
 * before either side has made a single move (see solve() below, and the
 * matching derivation in nim.html's own comments). That means a "dumb"
 * first-mover can occasionally beat a perfect second-mover purely by
 * guessing right on a handful of binary choices — a property of this
 * game's mathematics, not a flaw in the bot tiering. The original "Hard
 * must never lose" bar (written for Scuttle/Pop's no-turn-order shared-roll
 * games, and still exactly right there) isn't the correct standard for a
 * game where the SEAT, not just the skill, can force the outcome. What
 * this script verifies instead:
 *   1. Hard, moving FIRST, wins 100% of the time — an exact mathematical
 *      guarantee for this target/move-set, not just "usually." Checked
 *      directly, not just inferred from the trial percentages below.
 *   2. Hard, Medium, and Easy's OVERALL win rates (first move alternated
 *      across trials, so this measures skill rather than seat) are
 *      strictly ordered Hard > Medium > Easy, each by a clear, meaningful
 *      margin — not just barely over 50%.
 */

'use strict';

const TARGET = 10;
const MOVES = [1, 2];

function randInt(n) { return Math.floor(Math.random() * n); }

function wouldWin(total, amount) { return total + amount >= TARGET; }

// Exhaustive solve, memoized — see file header. solve(total) === true means
// the player about to move FROM `total` can force a win with perfect play
// (either an immediate winning move exists, or some move leaves the
// opponent facing a position solve() says THEY can't win from).
const solveCache = new Map();
function solve(total) {
  if (solveCache.has(total)) return solveCache.get(total);
  let canWin = false;
  for (const m of MOVES) {
    if (wouldWin(total, m) || !solve(total + m)) { canWin = true; break; }
  }
  solveCache.set(total, canWin);
  return canWin;
}

function botEasy() {
  return MOVES[randInt(MOVES.length)];
}

function botMedium(total) {
  for (const m of MOVES) if (wouldWin(total, m)) return m;
  return MOVES[randInt(MOVES.length)];
}

function botHard(total) {
  for (const m of MOVES) if (wouldWin(total, m)) return m;
  for (const m of MOVES) if (!solve(total + m)) return m;
  return MOVES[randInt(MOVES.length)]; // truly lost no matter what — doesn't matter which
}

function chooseMove(tier, total) {
  if (tier === 'easy') return botEasy();
  if (tier === 'medium') return botMedium(total);
  return botHard(total);
}

// Plays one full race from total=0. `first`/`second` are tier names;
// returns whichever of those two strings ('first' or 'second' as SEATS,
// not tiers) actually won.
function playGame(first, second) {
  let total = 0;
  let seat = 'first';
  const tiers = { first, second };
  while (true) {
    const amount = chooseMove(tiers[seat], total);
    total += amount;
    if (total >= TARGET) return seat;
    seat = seat === 'first' ? 'second' : 'first';
  }
}

// Alternates who actually goes first each trial — see CLAUDE.md Bot AI
// philosophy's Beeline note: a turn-based game's head-to-head must
// alternate first move, or the result measures turn order more than skill.
// Returns overall win counts for tierA/tierB regardless of which seat they
// held on a given trial.
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
  console.log(`Nim bot-tier simulation (${TRIALS} trials per matchup, first move alternated)\n`);

  // --- 1. Hard, moving first, must win every single time — exact, not
  // statistical (see file header: 10 mod 3 === 1, a forced win for the
  // first mover under perfect play). ---
  for (let i = 0; i < 500; i++) {
    if (playGame('hard', 'easy') !== 'first') throw new Error(`Hard moving first lost to Easy on trial ${i} — the perfect-play solver is broken`);
  }
  for (let i = 0; i < 500; i++) {
    if (playGame('hard', 'medium') !== 'first') throw new Error(`Hard moving first lost to Medium on trial ${i} — the perfect-play solver is broken`);
  }
  console.log('  ✅ Hard moving first: 500/500 wins vs Easy, 500/500 wins vs Medium (exact — perfect play cannot lose from the forced-win seat)');

  // --- 2. Overall win rates, first move alternated: Hard > Medium > Easy,
  // each by a clear margin. Hard can't reach the Scuttle/Pop-style
  // "literally never loses" bar here (see file header) because the OTHER
  // tier sometimes holds the forced-win seat — but its structural edge
  // (playing perfectly whenever it's even possible to) should still clear
  // a coin flip by a wide margin, and beat Easy more convincingly than it
  // beats Medium (Easy also fumbles free immediate wins Medium never
  // would). ---
  const hardVsMedium = report('hard', 'medium');
  const hardVsEasy = report('hard', 'easy');
  const mediumVsEasy = report('medium', 'easy');

  if (hardVsMedium < 0.65) throw new Error(`Hard's overall win rate vs Medium (${(hardVsMedium * 100).toFixed(1)}%) is too close to a coin flip — expected it to clear ~65%+`);
  if (hardVsEasy < 0.75) throw new Error(`Hard's overall win rate vs Easy (${(hardVsEasy * 100).toFixed(1)}%) is too close to a coin flip — expected it to clear ~75%+`);
  if (mediumVsEasy < 0.55) throw new Error(`Medium's overall win rate vs Easy (${(mediumVsEasy * 100).toFixed(1)}%) should be a clear, meaningful edge, not roughly even`);
  if (hardVsEasy <= hardVsMedium) throw new Error('Hard should beat Easy at least as convincingly as it beats Medium (Easy also fumbles free immediate wins Medium never would)');

  console.log(`\n  ✅ Hard > Medium > Easy confirmed across ${TRIALS}-trial alternated-first-move matchups (all comfortably clear their thresholds)`);
}

main();
