/*
 * jsdom full-playthrough smoke test for beeline-difference.html.
 *
 * Mirrors test/smoke-beeline-product.test.js's own depth (board-layout
 * randomization, wasted-turn rule, anti-stalemate rule, a dedicated drag
 * probe, then a full playthrough to a real win) — the two files share
 * almost the same shape, just TWO separate operand rows (one token each)
 * instead of Product's one shared row (two tokens) — see CLAUDE.md's
 * design note on the two-row engine for why they're similar but not
 * literally the same code.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  // --- Board-layout randomization — see beeline-product's own identical check. ---
  {
    const layoutDom = loadGame('beeline-difference.html');
    const first = runInPage(layoutDom, () => {
      document.querySelector('#diff-row [data-diff="easy"]').click();
      el('start-btn').click();
      return VALUES.slice();
    });
    runInPage(layoutDom, () => { startMatch(); });
    const second = runInPage(layoutDom, () => VALUES.slice());
    assert.strictEqual(first.length, 36, 'the board should always have exactly 36 cells');
    assert.deepStrictEqual([...first].sort((a, b) => a - b), [...second].sort((a, b) => a - b), 'reshuffling must keep the exact same SET of distinct values — only their positions should change');
    assert.notDeepStrictEqual(first, second, 'two separate matches should (overwhelmingly likely) get DIFFERENT cell layouts');
    console.log('  ✅ beeline-difference.html: board layout reshuffles between matches (same values, different positions)');
  }

  const dom = loadGame('beeline-difference.html');

  // Fake but consistent geometry — see beeline-product's own identical stub.
  runInPage(dom, () => {
    const proto = Element.prototype;
    const orig = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function(){
      if (this.classList && this.classList.contains('op-num')){
        const num = parseInt(this.dataset.num, 10);
        return { left: (num-1)*40, top: 0, width: 34, height: 40, right: (num-1)*40+34, bottom: 40, x: (num-1)*40, y: 0 };
      }
      if (this.id === 'operand-row-a' || this.id === 'operand-row-b'){
        return { left: 0, top: 0, width: 400, height: 40, right: 400, bottom: 40, x: 0, y: 0 };
      }
      return orig.call(this);
    };
  });

  // Avatars (see CLAUDE.md "Avatars"): before touching anything, the picker
  // and every badge should already agree with the default state. Beeline has
  // no persistent #scorecard (unlike Scuttle), so scYouBadge/scBotBadge
  // should come back null rather than being asserted against anything.
  const defaults = snapshotAvatarState(dom);
  assert.strictEqual(defaults.pickerSelected, defaults.avatar, 'the avatar picker should mark st.avatar\'s slot as .selected by default');
  assert.strictEqual(defaults.youBadge, `avatars/${defaults.avatar}.png`, 'top-bar "you" badge should point at st.avatar\'s image');
  assert.strictEqual(defaults.scYouBadge, null, 'beeline-difference.html has no persistent #scorecard, so there is no scoreboard-header "you" badge');
  assert.strictEqual(defaults.botBadge, `avatars/bot-${defaults.difficulty}.png`, 'top-bar bot badge should point at the difficulty-mapped bot avatar');
  assert.strictEqual(defaults.scBotBadge, null, 'beeline-difference.html has no persistent #scorecard, so there is no scoreboard-header bot badge');

  // Pick a different avatar and a different difficulty chip together — the
  // avatar pick and the difficulty switch are independent: only the "you"
  // badge should follow the avatar pick, only the bot badge should follow
  // the difficulty.
  runInPage(dom, () => {
    document.querySelector('#avatar-row [data-avatar="cammy"]').click();
    document.querySelector('#diff-row [data-diff="hard"]').click();
  });
  const afterPick = snapshotAvatarState(dom);
  assert.strictEqual(afterPick.avatar, 'cammy', 'clicking an avatar slot should update st.avatar');
  assert.strictEqual(afterPick.pickerSelected, 'cammy', 'the clicked slot should become the (only) .selected one');
  assert.strictEqual(afterPick.youBadge, 'avatars/cammy.png', 'top-bar "you" badge should update to the newly picked avatar');
  assert.strictEqual(afterPick.botBadge, 'avatars/bot-hard.png', 'bot badge should swap to the hard-tier avatar once difficulty changes to hard, independent of the avatar pick');

  // This file's own playthrough needs an Easy bot (so the Hard-quality
  // scripted human below reliably wins within a bounded number of turns) —
  // switch difficulty back down before starting the match. The avatar pick
  // (cammy) stays; nothing about the Easy-bot requirement depends on it.
  runInPage(dom, () => {
    document.querySelector('#diff-row [data-diff="easy"]').click();
    el('start-btn').click();
  });

  const cfg = runInPage(dom, () => ({ turn: st.turn, tokens: st.tokens, ownerAllNull: st.owner.every(o => o === null) }));
  assert.strictEqual(cfg.turn, 'human', 'human should always go first');
  assert.strictEqual(cfg.tokens, null, 'tokens should be unset before the first move');
  assert.strictEqual(cfg.ownerAllNull, true, 'the board should start empty');

  // --- Deterministic probe of the "already claimed" wasted-turn rule ---
  // Seed EVERY cell for |7-4|=3 as pre-claimed by 'bot' (this board can
  // repeat a value across several cells — see shared-game.js's
  // beelineApplyMove comment — so a real wasted turn needs ALL of them
  // claimed, not just one), then have the human's real first move (setup:
  // row A=7, row B=4) land exactly on that value.
  const wasteProbe = runInPage(dom, () => {
    const cells = VALUE_TO_CELLS.get(3);
    cells.forEach(i => { st.owner[i] = 'bot'; });
    const idx = cells[0];
    const beforeOwner = st.owner[idx];
    document.querySelectorAll('#operand-row-a .op-num')[6].click(); // row A = 7
    document.querySelectorAll('#operand-row-b .op-num')[3].click(); // row B = 4
    el('answer-input').value = '3';
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
  assert.strictEqual(wasteProbe.afterOwner, 'bot', "landing on an already-claimed cell must NOT overwrite its owner, even after answering correctly");
  assert.ok(/already claimed/i.test(wasteProbe.turnStatus), 'the status message should explain the wasted turn');
  assert.strictEqual(wasteProbe.turnAfter, 'bot', "a wasted turn still passes play to the bot");
  assert.strictEqual(wasteProbe.winnerAfter, null, 'no mark means no possible win this turn');

  for (let i = 0; i < 20; i++) {
    const { phase, turn } = runInPage(dom, () => ({ phase: st.phase, turn: st.turn }));
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }
  runInPage(dom, () => { startRound(); });

  // --- Dedicated probe of the anti-stalemate rule (real playtesting bug
  // report — see CLAUDE.md's design note) — same shape as beeline-product's
  // own probe, isLegalHumanMove() is the exact function both handleRowClick
  // and the drag onDrop call. ---
  const stalemateProbe = runInPage(dom, () => {
    st.tokens = [9, 7];
    st.visitedTokenPairs = new Set(['4,7', '9,7']);
    st.turn = 'human';
    st.phase = 'idle';
    st.selectedTokenIdx = 0;
    render();
    const beforeTokens = st.tokens.slice();
    document.querySelectorAll('#operand-row-a .op-num')[3].click(); // row A -> 4, would recreate the visited "4,7"
    const rejected = {
      tokensUnchanged: JSON.stringify(st.tokens) === JSON.stringify(beforeTokens),
      turnStatus: el('turn-status').textContent,
      pendingStillNull: st.pendingMove === null,
      answerAreaHidden: el('answer-area').classList.contains('hidden'),
    };
    document.querySelectorAll('#operand-row-a .op-num')[1].click(); // row A -> 2, a genuinely new config
    const accepted = {
      pendingMove: st.pendingMove,
      answerAreaHidden: el('answer-area').classList.contains('hidden'),
    };
    return { rejected, accepted };
  });
  assert.strictEqual(stalemateProbe.rejected.tokensUnchanged, true, 'attempting to recreate an already-visited tokens config must not change st.tokens');
  assert.ok(/repeat/i.test(stalemateProbe.rejected.turnStatus), 'the status message should explain the rejection');
  assert.strictEqual(stalemateProbe.rejected.pendingStillNull, true, 'a rejected move must not set a pending move');
  assert.strictEqual(stalemateProbe.rejected.answerAreaHidden, true, 'a rejected move must not open the answer-check UI');
  assert.deepStrictEqual(stalemateProbe.accepted.pendingMove, { type: 'move', idx: 0, pos: 2 }, 'a genuinely new (non-repeating) move should still be accepted normally');
  assert.strictEqual(stalemateProbe.accepted.answerAreaHidden, false, 'accepting the legal move should open the answer-check UI');

  runInPage(dom, () => { startRound(); });

  // --- Dedicated drag probe (CLAUDE.md "Drag interactions") ---
  runInPage(dom, () => {
    document.querySelectorAll('#operand-row-a .op-num')[2].click(); // row A = 3
    document.querySelectorAll('#operand-row-b .op-num')[3].click(); // row B = 4
    el('answer-input').value = '1'; // |3-4|=1
    el('check-btn').click();
  });
  for (let i = 0; i < 20; i++) {
    const { phase, turn } = runInPage(dom, () => ({ phase: st.phase, turn: st.turn }));
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }

  const dragTest = runInPage(dom, () => {
    const activeIdx = st.selectedTokenIdx;
    const startPos = st.tokens[activeIdx];
    const otherPos = st.tokens[1 - activeIdx];
    const target = [1,2,3,4,5,6,7,8,9].find(n => n !== startPos && n !== otherPos);
    const cellCenter = (num) => (num - 1) * 40 + 17;
    const tok = document.querySelector('.token.token-' + activeIdx);

    tok.dispatchEvent(new PointerEvent('pointerdown', { clientX: cellCenter(startPos), clientY: 20, pointerId: 1, bubbles: true }));
    tok.dispatchEvent(new PointerEvent('pointermove', { clientX: cellCenter(target), clientY: 20, pointerId: 1, bubbles: true }));
    const midDragTransform = tok.style.transform;
    const answerAreaHiddenMidDrag = el('answer-area').classList.contains('hidden');

    tok.dispatchEvent(new PointerEvent('pointerup', { clientX: cellCenter(target), clientY: 20, pointerId: 1, bubbles: true }));
    return { activeIdx, startPos, otherPos, target, midDragTransform, answerAreaHiddenMidDrag, pendingRightAfterDrop: st.pendingMove };
  });
  assert.notStrictEqual(dragTest.midDragTransform, '', 'the active token should visibly follow the pointer while dragging');
  assert.strictEqual(dragTest.answerAreaHiddenMidDrag, true, 'the answer-check UI should NOT appear mid-drag');
  assert.strictEqual(dragTest.pendingRightAfterDrop, null, 'pendingMove should not be set the instant pointerup fires — it waits for the snap animation');

  await sleep(300);

  const afterSettle = runInPage(dom, () => ({
    pendingMove: st.pendingMove,
    equationText: el('equation-line').textContent,
    answerAreaHidden: el('answer-area').classList.contains('hidden'),
  }));
  assert.deepStrictEqual(afterSettle.pendingMove, { type: 'move', idx: dragTest.activeIdx, pos: dragTest.target }, 'once the snap animation finishes, the drag should propose exactly the dragged-to move');
  assert.strictEqual(afterSettle.answerAreaHidden, false, 'the answer-check UI should be showing');

  const wrongDragAnswer = runInPage(dom, () => {
    const ownerBefore = st.owner.slice();
    el('answer-input').value = '99999';
    el('check-btn').click();
    return { ownerUnchanged: JSON.stringify(ownerBefore) === JSON.stringify(st.owner), stillPending: st.pendingMove !== null };
  });
  assert.strictEqual(wrongDragAnswer.ownerUnchanged, true, 'a wrong answer after a drag must NOT claim the cell');
  assert.strictEqual(wrongDragAnswer.stillPending, true, 'the pending move should stay open for another attempt');

  const correctDragValue = runInPage(dom, () => computePendingValue());
  const rightDragAnswer = runInPage(dom, (val) => {
    el('answer-input').value = String(val);
    el('check-btn').click();
    return { tokens: st.tokens.slice(), pendingCleared: st.pendingMove === null };
  }, correctDragValue);
  assert.strictEqual(rightDragAnswer.pendingCleared, true, 'a correct answer should clear the pending move');
  assert.strictEqual(rightDragAnswer.tokens[dragTest.activeIdx], dragTest.target, "the correct answer should actually commit the dragged-to position into st.tokens");

  for (let i = 0; i < 20; i++) {
    const { phase, turn } = runInPage(dom, () => ({ phase: st.phase, turn: st.turn }));
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }

  // --- Real playthrough: human plays Hard-quality moves against an Easy bot. ---
  async function playHumanTurn() {
    const move = runInPage(dom, () => botChooseRound({ owner: st.owner, tokens: st.tokens }, 'human', 'hard', st.visitedTokenPairs));
    if (move.type === 'setup') {
      runInPage(dom, (mv) => {
        document.querySelectorAll('#operand-row-a .op-num')[mv.a - 1].click();
        document.querySelectorAll('#operand-row-b .op-num')[mv.b - 1].click();
      }, move);
    } else {
      runInPage(dom, (mv) => {
        const cellCenter = (num) => (num - 1) * 40 + 17;
        const rowId = mv.idx === 0 ? 'operand-row-a' : 'operand-row-b';
        const tok = document.querySelector('.token.token-' + mv.idx);
        tok.dispatchEvent(new PointerEvent('pointerdown', { clientX: cellCenter(st.tokens[mv.idx]), clientY: 20, pointerId: 1, bubbles: true }));
        tok.dispatchEvent(new PointerEvent('pointerup', { clientX: cellCenter(mv.pos), clientY: 20, pointerId: 1, bubbles: true }));
      }, move);
      await sleep(300);
    }
    const correct = runInPage(dom, () => computePendingValue());
    runInPage(dom, (val) => { el('answer-input').value = String(val); el('check-btn').click(); }, correct);
  }

  let turns = 0;
  while (true) {
    const state = runInPage(dom, () => ({ gameOver: st.gameOver, turn: st.turn }));
    if (state.gameOver) break;
    if (turns++ > 150) throw new Error('game did not end within 150 human turns — possible stall');
    if (state.turn === 'human') {
      await playHumanTurn();
    } else {
      await sleep(700);
    }
  }

  const midFlight = runInPage(dom, () => ({
    bannerText: el('winner-banner').textContent,
    winCellClasses: (st.winningCells || []).map(i => document.querySelectorAll('#claim-grid .claim-cell')[i].className),
  }));
  assert.strictEqual(midFlight.bannerText, '', 'winner banner should be cleared immediately after gameOver');
  midFlight.winCellClasses.forEach(cls => {
    assert.ok(!/\bwin\b/.test(cls), 'winning cells should not have .win yet in the same tick gameOver flips');
  });

  await sleep(2000);

  const final = runInPage(dom, () => ({
    winner: st.winner,
    owner: st.owner,
    winningCells: st.winningCells,
    winRevealDone: st.winRevealDone,
    bannerText: el('winner-banner').textContent,
    winCellClasses: st.winningCells.map(i => document.querySelectorAll('#claim-grid .claim-cell')[i].className),
    recomputedWinner: decideWinner(st.owner),
    scoreHuman: st.score.human,
  }));

  assert.strictEqual(final.recomputedWinner, final.winner, "st.winner should match decideWinner recomputed fresh from the final board");
  assert.strictEqual(final.winner, 'human', 'a Hard-quality human should reliably beat an Easy bot');
  assert.ok(final.winningCells && final.winningCells.length === 4, 'a real win should have exactly 4 winning cells recorded');
  final.winningCells.forEach(idx => {
    assert.strictEqual(final.owner[idx], 'human', 'every recorded winning cell should actually be owned by the declared winner');
  });
  assert.strictEqual(final.bannerText, 'BEELINE! You win!', 'the winner banner should show the human-win text once the typewriter finishes');
  assert.strictEqual(final.winRevealDone, true, 'the winning-line reveal sequence should have finished by now');
  final.winCellClasses.forEach(cls => {
    assert.ok(/\bwin\b/.test(cls) && /\bsettled\b/.test(cls) && !/\bflash\b/.test(cls), `winning cell should have settled into "win settled", got "${cls}"`);
  });
  assert.strictEqual(final.scoreHuman, 1, "the human's win should be reflected in the score pill");

  console.log('  ✅ beeline-difference.html: full playthrough smoke test passed');
  console.log(`     wasted-turn rule verified | anti-stalemate rule verified | human won in ${turns} turns | winning cells: ${JSON.stringify(final.winningCells)}`);
}

main().catch(e => {
  console.error('  ❌ beeline-difference.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
