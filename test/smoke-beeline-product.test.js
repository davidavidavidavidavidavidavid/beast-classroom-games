/*
 * jsdom full-playthrough smoke test for beeline-product.html.
 *
 * Unlike Scuttle/Pop this is turn-based and has no dice/animation ticks to
 * wait out (only a ~550ms bot-thinking delay), so the loop here is: read
 * whose turn it is, if human drive the UI through a real move (using the
 * in-page Hard-bot logic to choose GOOD moves, so the human reliably wins
 * within a bounded number of turns — matches the near-100% Hard-vs-Easy
 * win rate already verified in test/beeline-product-bot-simulation.js),
 * if bot just wait out its delay. A separate, deterministic probe (seeding
 * one cell as pre-claimed) exercises the "already claimed — wasted turn"
 * rule via a real click on the real handler, the same way Pop's smoke
 * test probes its leading-zero rule.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('beeline-product.html');

  runInPage(dom, () => {
    document.querySelector('#diff-row [data-diff="easy"]').click();
    el('start-btn').click();
  });

  const cfg = runInPage(dom, () => ({ turn: st.turn, tokens: st.tokens, ownerAllNull: st.owner.every(o => o === null) }));
  assert.strictEqual(cfg.turn, 'human', 'human should always go first');
  assert.strictEqual(cfg.tokens, null, 'tokens should be unset before the first move');
  assert.strictEqual(cfg.ownerAllNull, true, 'the board should start empty');

  // --- Deterministic probe of the "already claimed" wasted-turn rule ---
  // Seed one cell as pre-claimed by 'bot', then have the human's real
  // first move land exactly on it (tokens 2 and 3 -> product 6).
  const wasteProbe = runInPage(dom, () => {
    const idx = VALUE_INDEX.get(6);
    st.owner[idx] = 'bot';
    const beforeOwner = st.owner[idx];
    document.querySelectorAll('#operand-row .op-num')[1].click(); // number 2
    document.querySelectorAll('#operand-row .op-num')[2].click(); // number 3
    el('answer-input').value = '6';
    el('check-btn').click();
    return {
      beforeOwner,
      afterOwner: st.owner[idx],
      turnStatus: el('turn-status').textContent,
      turnAfter: st.turn,
      winnerAfter: st.winner,
    };
  });
  assert.strictEqual(wasteProbe.beforeOwner, 'bot', 'sanity: the seeded cell should have been bot-owned before the human moved there');
  assert.strictEqual(wasteProbe.afterOwner, 'bot', "landing on an already-claimed cell must NOT overwrite its owner, even after answering the product correctly");
  assert.ok(/already claimed/i.test(wasteProbe.turnStatus), 'the status message should explain the wasted turn');
  assert.strictEqual(wasteProbe.turnAfter, 'bot', "a wasted turn still passes play to the bot (it's not a free extra turn)");
  assert.strictEqual(wasteProbe.winnerAfter, null, 'no mark means no possible win this turn');

  // Let the bot fully resolve its turn (real move — not seeded) before
  // resetting. botTurn() has two chained ~550ms delays (a pause, then a
  // visible "thinking" beat) — poll rather than guess a fixed wait, so
  // this doesn't race a still-pending setTimeout and leave it to fire
  // later, mid-playthrough, corrupting a freshly-reset board.
  for (let i = 0; i < 20; i++) {
    const { phase } = runInPage(dom, () => ({ phase: st.phase }));
    if (phase === 'idle') break;
    await sleep(150);
  }
  runInPage(dom, () => { startRound(); });

  // --- Real playthrough: human plays Hard-quality moves (via the in-page
  // bot logic, driving real clicks) against an Easy bot, to a real win. ---
  async function playHumanTurn() {
    const move = runInPage(dom, () => botChooseRound({ owner: st.owner, tokens: st.tokens }, 'human', 'hard'));
    runInPage(dom, (mv) => {
      if (mv.type === 'setup') {
        document.querySelectorAll('#operand-row .op-num')[mv.a - 1].click();
        document.querySelectorAll('#operand-row .op-num')[mv.b - 1].click();
      } else {
        if (st.activeTokenIdx !== mv.idx) document.getElementById('switch-token-' + mv.idx).click();
        document.querySelectorAll('#operand-row .op-num')[mv.pos - 1].click();
      }
    }, move);
    const correct = runInPage(dom, () => {
      if (!st.pendingMove) return null;
      if (st.pendingMove.type === 'setup') return st.pendingMove.a * st.pendingMove.b;
      const t = st.tokens.slice();
      t[st.pendingMove.idx] = st.pendingMove.pos;
      return t[0] * t[1];
    });
    runInPage(dom, (val) => { el('answer-input').value = String(val); el('check-btn').click(); }, correct);
  }

  let turns = 0;
  while (true) {
    const state = runInPage(dom, () => ({ gameOver: st.gameOver, turn: st.turn }));
    if (state.gameOver) break;
    // Games have resolved in 4-25 human turns across dozens of manual runs
    // (matching the 100%-Hard-win, zero-draw result over 150 trials in
    // beeline-product-bot-simulation.js), but this cap is intentionally
    // generous (not tight) — a single unreproduced timeout was observed
    // during development or this exact test, cause not confirmed, so this
    // errs toward tolerating a genuinely slow game over a false failure.
    if (turns++ > 150) throw new Error('game did not end within 150 human turns — possible stall');
    if (state.turn === 'human') {
      await playHumanTurn();
    } else {
      await sleep(700); // bot-thinking delay + processing
    }
  }

  const final = runInPage(dom, () => ({
    winner: st.winner,
    owner: st.owner,
    winningCells: st.winningCells,
    bannerText: el('winner-banner').textContent,
    recomputedWinner: decideWinner(st.owner),
    scoreHuman: st.score.human,
  }));

  assert.strictEqual(final.recomputedWinner, final.winner, "st.winner should match decideWinner recomputed fresh from the final board");
  assert.strictEqual(final.winner, 'human', 'a Hard-quality human should reliably beat an Easy bot (matches the ~100% simulated win rate)');
  assert.ok(final.winningCells && final.winningCells.length === 4, 'a real win should have exactly 4 winning cells recorded');
  final.winningCells.forEach(idx => {
    assert.strictEqual(final.owner[idx], 'human', 'every recorded winning cell should actually be owned by the declared winner');
  });
  assert.ok(final.bannerText.length > 0, 'the winner banner should show some text');
  assert.strictEqual(final.scoreHuman, 1, "the human's win should be reflected in the score pill");

  console.log('  ✅ beeline-product.html: full playthrough smoke test passed');
  console.log(`     wasted-turn rule verified | human won in ${turns} turns | winning cells: ${JSON.stringify(final.winningCells)}`);
}

main().catch(e => {
  console.error('  ❌ beeline-product.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
