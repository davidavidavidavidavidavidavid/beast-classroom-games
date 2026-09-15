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

function tokensKey(tokens) { return tokens[0] + ',' + tokens[1]; }

// Anti-stalemate rule — see CLAUDE.md's design note and
// beeline-product.html's own comment. Real playtesting found Hard's
// minimax could ping-pong a token between already-claimed cells forever (a
// "safe," never-losing, never-progressing move it had no reason to avoid).
// The FIRST fix tried (forbid only the exact reversal of the immediately-
// prior move) was verified INSUFFICIENT right here in this script — a
// direct diagnostic run showed Hard-vs-Hard settling into a longer
// repeating CYCLE (period > 2) that never reverses any single move but
// still loops forever, since a deterministic search over a finite state
// space must eventually repeat something once no new progress is
// possible. The real fix: forbid moving into ANY tokens-configuration
// already visited so far THIS game (`visited`, a Set of "a,b" keys),
// applied only at the TOP-LEVEL move actually being chosen (not threaded
// through minimax's own bounded-depth internal lookahead below, which
// already always terminates on its own regardless — see
// beeline-product.html's identical comment for the full reasoning).
// Guarantees real progress: only 81 tokens-configurations exist in total,
// and the 36-cell board fills (or someone wins) long before all of them
// could possibly be exhausted. Never returns zero moves — falls back to
// the unfiltered set in the vanishingly rare case every destination has
// already been visited.
function legalMoves(state, visited) {
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
  if (!visited) return moves;
  const filtered = moves.filter(m => {
    const candidate = state.tokens.slice(); candidate[m.idx] = m.pos;
    return !visited.has(tokensKey(candidate));
  });
  return filtered.length > 0 ? filtered : moves;
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

function botEasy(state, symbol, visited) {
  const moves = legalMoves(state, visited);
  return moves[randInt(moves.length)];
}

function botMedium(state, symbol, visited) {
  const moves = legalMoves(state, visited);
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

function botHard(state, symbol, visited) {
  const moves = legalMoves(state, visited);
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

function botChooseRound(state, symbol, difficulty, visited) {
  if (difficulty === 'easy') return botEasy(state, symbol, visited);
  if (difficulty === 'medium') return botMedium(state, symbol, visited);
  return botHard(state, symbol, visited);
}

/* ---------------- one full match ---------------- */

const MAX_TURNS = 200; // generous safety cap against a pathological stall

// 'human'/'bot' here are just the two internal turn-order roles (whoever
// moves first vs second) — nothing to do with actual human play; both
// roles are played by a bot difficulty tier during simulation. Returns the
// turn count and whether MAX_TURNS was actually exhausted (`stalled`) —
// distinct from a legitimate full-board draw, which resolves well before
// the cap. Before the anti-stalemate rule (see legalMoves()'s own comment
// above), Hard could ping-pong a token between two already-claimed cells
// forever — MAX_TURNS silently reclassified that as an ordinary "draw"
// here, which is exactly why the real bug wasn't caught by this script's
// own win/loss-ratio checks and had to be reported from real play instead.
function playMatchWithTurns(diffFirst, diffSecond) {
  let state = emptyGame();
  const diffOf = { human: diffFirst, bot: diffSecond };
  let turn = 'human'; // 'human' role always moves first internally
  const visited = new Set(); // anti-stalemate rule's real-game history — see legalMoves()'s comment above
  for (let t = 0; t < MAX_TURNS; t++) {
    const move = botChooseRound(state, turn, diffOf[turn], visited);
    const applied = applyMove(state, move, turn);
    state = applied.state;
    if (state.tokens) visited.add(tokensKey(state.tokens));
    if (applied.marked && hasFourInRow(state.owner, turn)) return { winner: turn, turns: t + 1, stalled: false };
    if (boardFull(state.owner)) return { winner: 'draw', turns: t + 1, stalled: false };
    turn = OTHER[turn];
  }
  return { winner: 'draw', turns: MAX_TURNS, stalled: true };
}
function playMatch(diffFirst, diffSecond) {
  return playMatchWithTurns(diffFirst, diffSecond).winner;
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

/* ---------------- anti-stalemate rule ---------------- */

// Direct, deterministic check against the EXACT scenario from the real bug
// report: "If the board says 4x7, someone moves to 9x7, the next move
// cannot be to 4x7." tokens=[9,7] (the state right after that move),
// visited={"4,7","9,7"} (both configs already reached this game) —
// legalMoves() must exclude moving token 0 back to 4 (which would
// recreate the visited "4,7"), and must NOT over-restrict anything else.
function checkAntiStalemateRuleDirectly() {
  const state = { owner: Array(36).fill(null), tokens: [9, 7] };
  const visited = new Set(['4,7', '9,7']);
  const moves = legalMoves(state, visited);
  if (moves.some(m => m.type === 'move' && m.idx === 0 && m.pos === 4)) {
    throw new Error('legalMoves() allowed reversing [9,7] back to [4,7] — the anti-stalemate rule is broken');
  }
  if (!moves.some(m => m.type === 'move' && m.idx === 1 && m.pos === 3)) {
    throw new Error('legalMoves() over-restricted — moving the OTHER (untouched) token should still be legal');
  }
  if (!moves.some(m => m.type === 'move' && m.idx === 0 && m.pos === 5)) {
    throw new Error('legalMoves() over-restricted — moving the same token to a DIFFERENT new position should still be legal');
  }
  console.log('  ✅ legalMoves() forbids exactly the reversal from the real bug report ([9,7] -> back to [4,7]) and nothing else');

  // The longer-cycle case that proved the reversal-only fix insufficient
  // (found by direct simulation before this rule shipped): a state that
  // was ALREADY visited two-or-more moves ago (not just one move ago) must
  // still be forbidden, even though it isn't a same-single-token reversal
  // of the immediately-prior move.
  const cyclingState = { owner: Array(36).fill(null), tokens: [2, 4] };
  const longHistory = new Set(['2,2', '9,2', '4,2', '2,4', '2,9']); // a real period-6 cycle observed pre-fix
  const cyclingMoves = legalMoves(cyclingState, longHistory);
  if (cyclingMoves.some(m => m.type === 'move' && m.idx === 1 && m.pos === 9)) {
    throw new Error('legalMoves() allowed re-entering a state from 2+ moves ago (a longer cycle, not just an immediate reversal) — this is exactly the gap the reversal-only fix left open');
  }
  console.log('  ✅ legalMoves() also forbids re-entering a state from further back than one move ago (closes the longer-cycle gap the simpler reversal-only rule left open)');
}

// Emergent check: with the rule in place, Hard-vs-Hard (the most likely
// matchup to fall into a deterministic repeating cycle, since neither side
// ever makes a genuinely random move) should never exhaust MAX_TURNS.
// Before the fix, this is exactly the scenario real play reported.
function checkNoStalls() {
  const TRIALS = 30;
  let stalls = 0, maxTurnsSeen = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = playMatchWithTurns('hard', 'hard');
    if (r.stalled) stalls++;
    maxTurnsSeen = Math.max(maxTurnsSeen, r.turns);
  }
  if (stalls > 0) throw new Error(`${stalls}/${TRIALS} Hard-vs-Hard games hit the ${MAX_TURNS}-turn cap without resolving — the anti-stalemate rule did not fix the real stall`);
  console.log(`  ✅ ${TRIALS}/${TRIALS} Hard-vs-Hard games resolved (win or genuine full-board draw) well before the ${MAX_TURNS}-turn cap (longest: ${maxTurnsSeen} turns) — no stalls`);
}

checkAntiStalemateRuleDirectly();
checkNoStalls();

/* ---------------- run it ---------------- */

const MATCHES = 150; // win rates are decisive (see below) — this many trials is already conclusive and keeps the script fast to re-run
const t0 = Date.now();
console.log('\nBeeline — Product variant: bot difficulty head-to-head simulation\n');

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
