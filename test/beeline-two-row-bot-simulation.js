/*
 * Standalone Node simulation for every TWO-ROW Beeline variant (Difference,
 * Addition, Decimal, Rounding, Equivalent Fraction) at once — see CLAUDE.md
 * "Bot AI philosophy" and shared-game.js's own "Beeline two-row engine"
 * comment for why one shared engine backs all five.
 *
 * Unlike every other bot-simulation script in this project, this one does
 * NOT reimplement the solver/search locally before "porting" it — the
 * win-detection/minimax/evaluate machinery is ALREADY shared (and already
 * proven correct via beeline-product-bot-simulation.js's own tier-ordering
 * checks and anti-stalemate checks, which this engine is a direct
 * generalization of). What genuinely needs verifying per variant is
 * narrower: does THIS variant's own value function + board produce the
 * same tier ordering (Hard > Medium > Easy) the shared engine already
 * guarantees structurally, and does the anti-stalemate rule still prevent
 * stalls for THIS variant's own row ranges (a different state-space size
 * per variant, so the "36-cell board fills before 81 tokens-configs could
 * exhaust" argument from Product Beeline needs re-checking per variant,
 * not assumed). Loads the real shared-game.js into a small vm sandbox and
 * calls the actual shipped functions directly.
 *
 * Run: node test/beeline-two-row-bot-simulation.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console, Math };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'shared-game.js'), 'utf8'),
  sandbox,
  { filename: 'shared-game.js' }
);
const {
  beelineLegalMoves, beelineApplyMove, beelineHasFourInRow, beelineBoardFull,
  beelineBotEasy, beelineBotMedium, beelineBotHard, beelineTokensKey,
  beelineBuildBoardValues, beelineBuildValueToCells, randInt,
} = sandbox;

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

/* ---------------- one config per variant ---------------- */

const VARIANTS = {
  difference: {
    rowRanges: [[1, 9], [1, 9]],
    valueFn: (t) => Math.abs(t[0] - t[1]),
    distinctValues: Array.from({ length: 9 }, (_, i) => i), // 0..8
  },
  addition: {
    rowRanges: [[1, 9], [1, 9]],
    valueFn: (t) => t[0] + t[1],
    distinctValues: Array.from({ length: 17 }, (_, i) => i + 2), // 2..18
  },
  decimal: {
    rowRanges: [[1, 6], [1, 6]],
    valueFn: (t) => t[0] * 10 + t[1], // integer hundredths, e.g. 3,7 -> 37 (= 0.37)
    distinctValues: (() => { const out = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) out.push(a * 10 + b); return out; })(), // all 36 distinct
  },
  rounding: {
    rowRanges: [[1, 9], [0, 9]],
    valueFn: (t) => Math.round((t[0] * 10 + t[1]) / 10) * 10,
    distinctValues: Array.from({ length: 9 }, (_, i) => (i + 1) * 10), // 10..90
  },
  equivFraction: {
    rowRanges: [[1, 7], [1, 7]],
    valueFn: (t) => { const g = gcd(t[0], t[1]); return (t[0] / g) + '/' + (t[1] / g); },
    distinctValues: (() => {
      const set = new Set();
      for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) { const g = gcd(a, b); set.add((a / g) + '/' + (b / g)); }
      return [...set];
    })(),
  },
};

function makeBoard(cfg) {
  const values = beelineBuildBoardValues(cfg.distinctValues, 36);
  return beelineBuildValueToCells(values);
}

/* ---------------- one full match ---------------- */

const MAX_TURNS = 200;

function playMatchWithTurns(cfg, valueToCells, diffFirst, diffSecond) {
  let state = { owner: Array(36).fill(null), tokens: null };
  const diffOf = { human: diffFirst, bot: diffSecond };
  let turn = 'human';
  const visited = new Set();
  for (let t = 0; t < MAX_TURNS; t++) {
    let move;
    if (diffOf[turn] === 'easy') move = beelineBotEasy(state, cfg.rowRanges, visited);
    else if (diffOf[turn] === 'medium') move = beelineBotMedium(state, turn, cfg.rowRanges, cfg.valueFn, valueToCells, visited);
    else move = beelineBotHard(state, turn, cfg.rowRanges, cfg.valueFn, valueToCells, visited);
    const applied = beelineApplyMove(state, move, turn, cfg.valueFn, valueToCells);
    state = applied.state;
    if (state.tokens) visited.add(beelineTokensKey(state.tokens));
    if (applied.marked && beelineHasFourInRow(state.owner, turn)) return { winner: turn, turns: t + 1, stalled: false };
    if (beelineBoardFull(state.owner)) return { winner: 'draw', turns: t + 1, stalled: false };
    turn = turn === 'human' ? 'bot' : 'human';
  }
  return { winner: 'draw', turns: MAX_TURNS, stalled: true };
}

function headToHead(cfg, valueToCells, diffA, diffB, matches) {
  let winsA = 0, winsB = 0, draws = 0, stalls = 0;
  for (let i = 0; i < matches; i++) {
    const aFirst = i % 2 === 0;
    const r = playMatchWithTurns(cfg, valueToCells, aFirst ? diffA : diffB, aFirst ? diffB : diffA);
    if (r.stalled) stalls++;
    if (r.winner === 'draw') { draws++; continue; }
    const winnerDiff = (aFirst ? r.winner === 'human' : r.winner === 'bot') ? diffA : diffB;
    if (winnerDiff === diffA) winsA++; else winsB++;
  }
  return { winsA, winsB, draws, stalls, matches };
}

function pct(n, total) { return (100 * n / total).toFixed(1) + '%'; }

let failures = 0;
function checkBeats(label, r, strongerLabel, weakerLabel) {
  const pass = r.winsA >= r.winsB;
  console.log(`  ${pass ? '✅' : '❌'} [${label}] ${strongerLabel} vs ${weakerLabel}: ${r.winsA} vs ${r.winsB} wins (${pct(r.winsA, r.matches)} / ${pct(r.winsB, r.matches)}), draws ${r.draws}, stalls ${r.stalls}${pass ? '' : ' — FAILED'}`);
  if (!pass) failures++;
  if (r.stalls > 0) { console.log(`  ❌ [${label}] ${r.stalls}/${r.matches} matches STALLED (hit the ${MAX_TURNS}-turn cap) — the anti-stalemate rule failed for this variant's state space`); failures++; }
}

const MATCHES = 80; // 5 variants x 3 matchups x Hard-involving minimax — kept modest to keep this script fast; still enough trials for a decisive tier gap
const t0 = Date.now();

Object.entries(VARIANTS).forEach(([name, cfg]) => {
  console.log(`\n${name} Beeline (rows ${JSON.stringify(cfg.rowRanges)}, ${cfg.distinctValues.length} distinct values):`);
  const valueToCells = makeBoard(cfg);
  // Sanity: every one of the 36 board cells actually got a value, and the
  // SET of distinct values shown matches the variant's own achievable set
  // exactly (no accidental drift from the round-robin builder).
  const totalCells = [...valueToCells.values()].reduce((s, arr) => s + arr.length, 0);
  if (totalCells !== 36) throw new Error(`[${name}] board should have exactly 36 cells total, got ${totalCells}`);
  if (valueToCells.size !== cfg.distinctValues.length) throw new Error(`[${name}] expected ${cfg.distinctValues.length} distinct values on the board, got ${valueToCells.size}`);

  const rHM = headToHead(cfg, valueToCells, 'hard', 'medium', MATCHES);
  const rME = headToHead(cfg, valueToCells, 'medium', 'easy', MATCHES);
  const rHE = headToHead(cfg, valueToCells, 'hard', 'easy', MATCHES);
  checkBeats(name, rHM, 'Hard', 'Medium');
  checkBeats(name, rME, 'Medium', 'Easy');
  checkBeats(name, rHE, 'Hard', 'Easy');
});

console.log(`\n(ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED — do not ship these bots/boards as-is.`);
  process.exitCode = 1;
} else {
  console.log('\nAll tier-ordering and anti-stalemate checks passed for every two-row Beeline variant.');
}
