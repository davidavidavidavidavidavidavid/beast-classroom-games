/*
 * Standalone Node simulation for Beeline — Product variant's bot difficulty
 * tiers. Run BEFORE writing beeline-product.html, per CLAUDE.md's Bot AI
 * philosophy.
 *
 * This is a genuinely different kind of game than Scuttle/Pop: turn-based,
 * deterministic (no dice), adversarial, perfect-information — closer to
 * Connect-4 / tic-tac-toe than to a shared-roll bust-or-closest game. The
 * bot difficulty design reflects that:
 *   Easy   = uniform-random legal move.
 *   Medium = prefer an open (unclaimed) cell over a wasted turn; among
 *            open-cell moves, greedily extend its own longest line — no
 *            lookahead, no defense.
 *   Hard   = depth-limited minimax with alpha-beta pruning and a
 *            Connect-4-style window-scoring heuristic at the cutoff —
 *            "exhaustive search where the space is small enough" per
 *            CLAUDE.md, since the real branching factor here (2 tokens,
 *            ~8 new positions each after setup) is small.
 *
 * Because this game is turn-based, a naive single-order head-to-head would
 * conflate "which tier is stronger" with "who had the first-move
 * advantage." Every matchup below is run with each side going first in
 * exactly half the trials, so the reported win rate isolates skill, not
 * turn order.
 *
 * Run: node test/beeline-product-bot-simulation.js
 */

'use strict';

const ROWMIN = 1, ROWMAX = 9;

// Fixed 6x6 board layout: the 36 distinct products of two numbers 1-9,
// arranged via a deterministic shuffle (see git history for the generator)
// since the rules doc describes mechanics, not the physical board's exact
// spatial layout — this is a reasonable placeholder arrangement, not a
// transcription of a real printed board.
const VALUES = [14,54,16,49,32,6,4,72,48,21,2,56,35,64,36,5,9,81,30,40,42,8,7,28,1,15,3,18,27,12,63,24,20,45,25,10];
const VALUE_INDEX = new Map(VALUES.map((v, i) => [v, i]));
const W = 6, H = 6;

/* ---------------- state & moves ---------------- */

function emptyGame() {
  return { owner: Array(36).fill(null), tokens: null }; // tokens null = setup phase not yet done
}

function legalMoves(state) {
  if (state.tokens === null) {
    // Setup: place both tokens freely, order doesn't matter (product is
    // commutative) — enumerate as unordered pairs.
    const moves = [];
    for (let a = ROWMIN; a <= ROWMAX; a++) for (let b = a; b <= ROWMAX; b++) moves.push({ type: 'setup', a, b });
    return moves;
  }
  // Move phase: move exactly one of the two tokens to a genuinely new position.
  const moves = [];
  for (let idx = 0; idx < 2; idx++) {
    for (let pos = ROWMIN; pos <= ROWMAX; pos++) {
      if (pos !== state.tokens[idx]) moves.push({ type: 'move', idx, pos });
    }
  }
  return moves;
}

function applyMove(state, move, symbol) {
  const owner = state.owner.slice();
  let tokens;
  if (move.type === 'setup') {
    tokens = [move.a, move.b];
  } else {
    tokens = state.tokens.slice();
    tokens[move.idx] = move.pos;
  }
  const value = tokens[0] * tokens[1];
  const cellIdx = VALUE_INDEX.get(value);
  let marked = false;
  if (owner[cellIdx] === null) { owner[cellIdx] = symbol; marked = true; }
  return { state: { owner, tokens }, marked, cellIdx };
}

function boardFull(owner) {
  return owner.every(o => o !== null);
}

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function hasFourInRow(owner, symbol) {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (owner[r * W + c] !== symbol) continue;
      for (const [dr, dc] of DIRS) {
        let count = 1;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W || owner[rr * W + cc] !== symbol) break;
          count++;
        }
        if (count >= 4) return true;
      }
    }
  }
  return false;
}

// Win condition (pure — see CLAUDE.md Code conventions). Unlike Scuttle/Pop,
// Beeline has no single "reveal" moment (both sides' moves are visible on
// the shared board the whole game) — this gets called after every mark
// attempt instead of from a reveal-button handler, but the shape (pure,
// zero DOM, 'human'|'bot'|'tie') is the same. Returns null while the game
// is still in progress.
function decideWinner(owner) {
  if (hasFourInRow(owner, 'human')) return 'human';
  if (hasFourInRow(owner, 'bot')) return 'bot';
  if (boardFull(owner)) return 'tie';
  return null;
}

// Longest run of `symbol` through cell idx (owner already includes the new
// mark there), across all 4 directions, counting both ways from idx.
function longestRunThrough(owner, idx, symbol) {
  const r0 = Math.floor(idx / W), c0 = idx % W;
  let best = 1;
  for (const [dr, dc] of DIRS) {
    let count = 1;
    for (let k = 1; k < 4; k++) {
      const rr = r0 + dr * k, cc = c0 + dc * k;
      if (rr < 0 || rr >= H || cc < 0 || cc >= W || owner[rr * W + cc] !== symbol) break;
      count++;
    }
    for (let k = 1; k < 4; k++) {
      const rr = r0 - dr * k, cc = c0 - dc * k;
      if (rr < 0 || rr >= H || cc < 0 || cc >= W || owner[rr * W + cc] !== symbol) break;
      count++;
    }
    if (count > best) best = count;
  }
  return best;
}

/* ---------------- bot tiers ---------------- */

function randInt(n) { return Math.floor(Math.random() * n); }
const OTHER = { human: 'bot', bot: 'human' };

function botEasy(state, symbol) {
  const moves = legalMoves(state);
  return moves[randInt(moves.length)];
}

function botMedium(state, symbol) {
  const moves = legalMoves(state);
  const scored = moves.map(m => {
    const applied = applyMove(state, m, symbol);
    const runLen = applied.marked ? longestRunThrough(applied.state.owner, applied.cellIdx, symbol) : 0;
    return { m, marked: applied.marked, runLen };
  });
  const openMoves = scored.filter(s => s.marked);
  const pool = openMoves.length > 0 ? openMoves : scored;
  const bestRun = Math.max(...pool.map(s => s.runLen));
  const best = pool.filter(s => s.runLen === bestRun);
  return best[randInt(best.length)].m;
}

// Window-based Connect-4-style heuristic: every possible 4-length line on
// the board is a "window." A window that contains only one symbol's marks
// (plus empties) is a live threat for that symbol, weighted steeply by how
// many marks it already has.
const WINDOWS = (() => {
  const wins = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    for (const [dr, dc] of DIRS) {
      const cells = [];
      let ok = true;
      for (let k = 0; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= H || cc < 0 || cc >= W) { ok = false; break; }
        cells.push(rr * W + cc);
      }
      if (ok) wins.push(cells);
    }
  }
  return wins;
})();

const WEIGHT = { 1: 1, 2: 12, 3: 150, 4: 100000 };

function evaluate(owner, symbol) {
  const opp = OTHER[symbol];
  let score = 0;
  for (const cells of WINDOWS) {
    let mine = 0, theirs = 0;
    for (const idx of cells) {
      if (owner[idx] === symbol) mine++;
      else if (owner[idx] === opp) theirs++;
    }
    if (mine > 0 && theirs === 0) score += WEIGHT[mine];
    else if (theirs > 0 && mine === 0) score -= WEIGHT[theirs];
  }
  return score;
}

function minimax(state, symbol, toMove, depth, alpha, beta) {
  if (hasFourInRow(state.owner, symbol)) return 100000 + depth;
  if (hasFourInRow(state.owner, OTHER[symbol])) return -100000 - depth;
  if (boardFull(state.owner) || depth === 0) return evaluate(state.owner, symbol);

  const moves = legalMoves(state);
  const maximizing = toMove === symbol;
  let value = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const applied = applyMove(state, m, toMove);
    // An unmarked (wasted) move still passes the turn with tokens
    // repositioned but ownership unchanged — applied.state already
    // reflects that correctly either way.
    const next = minimax(applied.state, symbol, OTHER[toMove], depth - 1, alpha, beta);
    if (maximizing) {
      value = Math.max(value, next);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, next);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return value;
}

const HARD_DEPTH = 4;

function botHard(state, symbol) {
  const moves = legalMoves(state);
  let best = null;
  for (const m of moves) {
    const applied = applyMove(state, m, symbol);
    let score;
    if (applied.marked && hasFourInRow(applied.state.owner, symbol)) {
      score = 200000; // immediate win — always take it
    } else {
      score = minimax(applied.state, symbol, OTHER[symbol], HARD_DEPTH - 1, -Infinity, Infinity);
    }
    if (!best || score > best.score) best = { m, score };
  }
  return best.m;
}

function botChooseRound(state, symbol, difficulty) {
  if (difficulty === 'easy') return botEasy(state, symbol);
  if (difficulty === 'medium') return botMedium(state, symbol);
  return botHard(state, symbol);
}

/* ---------------- one full match ---------------- */

const MAX_TURNS = 200; // generous safety cap against a pathological stall

// 'human'/'bot' here are just the two internal turn-order roles (whoever
// moves first vs second) — nothing to do with actual human play; both
// roles are played by a bot difficulty tier during simulation.
function playMatch(diffFirst, diffSecond) {
  let state = emptyGame();
  const diffOf = { human: diffFirst, bot: diffSecond };
  let turn = 'human'; // 'human' role always moves first internally
  for (let t = 0; t < MAX_TURNS; t++) {
    const move = botChooseRound(state, turn, diffOf[turn]);
    const applied = applyMove(state, move, turn);
    state = applied.state;
    if (applied.marked && hasFourInRow(state.owner, turn)) return turn; // 'human' or 'bot' role
    if (boardFull(state.owner)) return 'draw';
    turn = OTHER[turn];
  }
  return 'draw';
}

/* ---------------- head-to-head, alternating who goes first ---------------- */

function headToHead(diffA, diffB, matches) {
  let winsA = 0, winsB = 0, draws = 0;
  for (let i = 0; i < matches; i++) {
    const aGoesFirst = i % 2 === 0;
    const firstDiff = aGoesFirst ? diffA : diffB;
    const secondDiff = aGoesFirst ? diffB : diffA;
    const winnerRole = playMatch(firstDiff, secondDiff); // 'human'|'bot'|'draw' — a turn-order role, not a difficulty
    if (winnerRole === 'draw') { draws++; continue; }
    const winnerDiff = winnerRole === 'human' ? firstDiff : secondDiff;
    if (winnerDiff === diffA) winsA++; else winsB++;
  }
  return { winsA, winsB, draws, matches };
}

function pct(n, total) { return (100 * n / total).toFixed(1) + '%'; }

function report(label, diffA, diffB, matches) {
  const r = headToHead(diffA, diffB, matches);
  console.log(`  ${label}  (${matches} matches, first-move alternated)`);
  console.log(`    ${diffA}: ${r.winsA} (${pct(r.winsA, matches)})   ${diffB}: ${r.winsB} (${pct(r.winsB, matches)})   draws: ${r.draws} (${pct(r.draws, matches)})`);
  return r;
}

/* ---------------- run it ---------------- */

const MATCHES = 150; // win rates are decisive (see below) — this many trials is already conclusive and keeps the script fast to re-run
const t0 = Date.now();
console.log('Beeline — Product variant: bot difficulty head-to-head simulation\n');

const r1 = report('Hard vs Medium', 'hard', 'medium', MATCHES);
const r2 = report('Medium vs Easy', 'medium', 'easy', MATCHES);
const r3 = report('Hard vs Easy', 'hard', 'easy', MATCHES);

console.log(`\n(ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log('\nRequired: Hard must not lose more than it wins against Medium; Medium must not lose more than it wins against Easy.');
let failures = 0;
function checkBeats(r, strongerLabel, weakerLabel) {
  const pass = r.winsA >= r.winsB;
  console.log(`  ${pass ? '✅' : '❌'} ${strongerLabel} vs ${weakerLabel}: ${r.winsA} vs ${r.winsB} wins${pass ? '' : ' — FAILED'}`);
  if (!pass) failures++;
}
checkBeats(r1, 'Hard', 'Medium');
checkBeats(r2, 'Medium', 'Easy');
checkBeats(r3, 'Hard', 'Easy');

if (failures > 0) {
  console.error(`\n${failures} tier-ordering check(s) FAILED — do not ship these bots as-is.`);
  process.exitCode = 1;
} else {
  console.log('\nAll tier-ordering checks passed.');
}
