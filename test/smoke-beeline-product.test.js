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
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  // --- Board-layout randomization (real playtesting feedback: the single
  // always-identical arrangement was memorizable/stale) — a fresh, separate
  // page load so this check's own startMatch() call doesn't disturb the
  // main playthrough's state below. Confirms rebuildBoardLayout() actually
  // reshuffles VALUES/VALUE_INDEX (not just once at load), and that the SET
  // of 36 distinct product values stays exactly the same across a reshuffle
  // — only their cell POSITIONS should vary, never which values exist. ---
  {
    const layoutDom = loadGame('beeline-product.html');
    const first = runInPage(layoutDom, () => {
      document.querySelector('#diff-row [data-diff="easy"]').click();
      el('start-btn').click();
      return VALUES.slice();
    });
    runInPage(layoutDom, () => { startMatch(); }); // "Play again" — should reshuffle again
    const second = runInPage(layoutDom, () => VALUES.slice());
    assert.strictEqual(first.length, 36, 'the board should always have exactly 36 cells');
    assert.deepStrictEqual([...first].sort((a, b) => a - b), [...second].sort((a, b) => a - b), 'reshuffling must keep the exact same SET of 36 distinct values — only their positions should change');
    assert.notDeepStrictEqual(first, second, 'two separate matches should (overwhelmingly likely, 1-in-36! odds otherwise) get DIFFERENT cell layouts, not the same fixed arrangement every time');
    console.log('  ✅ beeline-product.html: board layout reshuffles between matches (same 36 values, different positions)');
  }

  const dom = loadGame('beeline-product.html');

  // Real hit-testing (CLAUDE.md "Drag interactions") needs actual layout —
  // jsdom has none, getBoundingClientRect is always zero there. Stub it
  // once, at the Element.prototype level (not per-node) so it survives
  // #operand-row's every re-render (a fresh .innerHTML='' rebuild each
  // time, per the game's own established render pattern) without needing
  // to be re-applied — a fake but CONSISTENT 40px-per-number layout, so
  // the actual production geometry code (nearestNumForX, tokenLeftForNum)
  // runs for real against it instead of being bypassed.
  runInPage(dom, () => {
    const proto = Element.prototype;
    const orig = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function(){
      if (this.classList && this.classList.contains('op-num')){
        const num = parseInt(this.dataset.num, 10);
        return { left: (num-1)*40, top: 0, width: 34, height: 40, right: (num-1)*40+34, bottom: 40, x: (num-1)*40, y: 0 };
      }
      if (this.id === 'operand-row'){
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
  assert.strictEqual(defaults.scYouBadge, null, 'beeline-product.html has no persistent #scorecard, so there is no scoreboard-header "you" badge');
  assert.strictEqual(defaults.botBadge, `avatars/bot-${defaults.difficulty}.png`, 'top-bar bot badge should point at the difficulty-mapped bot avatar');
  assert.strictEqual(defaults.scBotBadge, null, 'beeline-product.html has no persistent #scorecard, so there is no scoreboard-header bot badge');

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
    const { phase, turn } = runInPage(dom, () => ({ phase: st.phase, turn: st.turn }));
    // phase alone isn't enough: checkAnswer() sets phase back to 'idle'
    // SYNCHRONOUSLY the instant a human move is confirmed, before handing
    // off via `st.turn = 'bot'` — botTurn() itself only actually runs
    // ~550ms later, via setTimeout. Waiting on phase alone would stop
    // polling in that in-between window, before the bot has done anything.
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }
  runInPage(dom, () => { startRound(); });

  // --- Dedicated probe of the anti-stalemate rule (real playtesting bug
  // report — see CLAUDE.md's design note): once a tokens-configuration has
  // been visited this game, moving back into it (even from a LONGER cycle,
  // not just reversing the immediately-prior move) must be rejected via a
  // real click on the real handler — not a reimplementation of the rule.
  // isLegalHumanMove() is the exact same function both handleRowClick and
  // the drag onDrop call, so probing it through a click here also covers
  // the drag path's own rejection logic. ---
  const stalemateProbe = runInPage(dom, () => {
    st.tokens = [9, 7];
    st.visitedTokenPairs = new Set(['4,7', '9,7']);
    st.turn = 'human';
    st.phase = 'idle';
    st.selectedTokenIdx = 0;
    render();
    const beforeTokens = st.tokens.slice();
    document.querySelectorAll('#operand-row .op-num')[3].click(); // number 4 -> would recreate the visited "4,7"
    const rejected = {
      tokensUnchanged: JSON.stringify(st.tokens) === JSON.stringify(beforeTokens),
      turnStatus: el('turn-status').textContent,
      pendingStillNull: st.pendingMove === null,
      answerAreaHidden: el('answer-area').classList.contains('hidden'),
    };
    document.querySelectorAll('#operand-row .op-num')[1].click(); // number 2 -> a genuinely new, never-visited config
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

  // That was a synthetic state poke, not part of the real playthrough —
  // reset back to a clean slate before continuing.
  runInPage(dom, () => { startRound(); });

  // --- Dedicated drag probe (CLAUDE.md "Drag interactions"): a fresh
  // setup (still click-based — no existing token position to drag from
  // yet), then one deliberate drag of the active token to a specific new
  // number, checking every step: the token visibly follows the pointer,
  // the equation display updates only once the drag actually resolves
  // (not mid-drag), a WRONG answer afterward does NOT claim the cell —
  // dragging only sets up the equation, same retry-until-correct pattern
  // as everywhere else — and the CORRECT answer both claims the cell and
  // actually commits the dragged-to position into st.tokens. ---
  runInPage(dom, () => {
    document.querySelectorAll('#operand-row .op-num')[2].click(); // number 3
    document.querySelectorAll('#operand-row .op-num')[3].click(); // number 4
    el('answer-input').value = '12';
    el('check-btn').click();
  });
  for (let i = 0; i < 20; i++) {
    const { phase, turn } = runInPage(dom, () => ({ phase: st.phase, turn: st.turn }));
    // phase alone isn't enough: checkAnswer() sets phase back to 'idle'
    // SYNCHRONOUSLY the instant a human move is confirmed, before handing
    // off via `st.turn = 'bot'` — botTurn() itself only actually runs
    // ~550ms later, via setTimeout. Waiting on phase alone would stop
    // polling in that in-between window, before the bot has done anything.
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }

  const dragTest = runInPage(dom, () => {
    // Both tokens are always draggable now (no single "active" token — see
    // CLAUDE.md's Beeline redesign note), so pick one by its own fixed
    // identity class (.token-0/.token-1) rather than an "active" marker
    // that no longer exists.
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
  assert.notStrictEqual(dragTest.midDragTransform, '', 'the active token should visibly follow the pointer (a non-empty transform) while dragging');
  assert.strictEqual(dragTest.answerAreaHiddenMidDrag, true, 'the answer-check UI should NOT appear mid-drag — no move is proposed until the drag actually resolves');
  assert.strictEqual(dragTest.pendingRightAfterDrop, null, 'pendingMove should not be set the instant pointerup fires — it waits for the snap-into-place animation to finish first');

  await sleep(300); // TOKEN_SNAP_MS (220ms, see beeline-product.html) + buffer

  const expectedA = dragTest.activeIdx === 0 ? dragTest.target : dragTest.otherPos;
  const expectedB = dragTest.activeIdx === 0 ? dragTest.otherPos : dragTest.target;
  const afterSettle = runInPage(dom, () => ({
    pendingMove: st.pendingMove,
    equationText: el('equation-line').textContent,
    answerAreaHidden: el('answer-area').classList.contains('hidden'),
  }));
  assert.deepStrictEqual(afterSettle.pendingMove, { type: 'move', idx: dragTest.activeIdx, pos: dragTest.target }, 'once the snap animation finishes, the drag should propose exactly the dragged-to move');
  assert.strictEqual(afterSettle.equationText, `${expectedA} × ${expectedB} = ?`, 'the equation display should now reflect the dragged-to target, not the original position');
  assert.strictEqual(afterSettle.answerAreaHidden, false, 'the answer-check UI should be showing, awaiting confirmation');

  const wrongDragAnswer = runInPage(dom, () => {
    const ownerBefore = st.owner.slice();
    el('answer-input').value = '99999';
    el('check-btn').click();
    return { ownerUnchanged: JSON.stringify(ownerBefore) === JSON.stringify(st.owner), stillPending: st.pendingMove !== null };
  });
  assert.strictEqual(wrongDragAnswer.ownerUnchanged, true, 'a wrong answer after a drag must NOT claim the cell — dragging only sets up the equation, it never commits by itself');
  assert.strictEqual(wrongDragAnswer.stillPending, true, 'the pending move should stay open for another attempt after a wrong guess, same retry-until-correct pattern as everywhere else');

  // EXPERIMENTAL (see CLAUDE.md "Answer-explanation modal & stats-demo
  // experiment"): one more wrong answer (this is the 2nd for this move)
  // now opens the explanation modal — an array of `a` columns of `b` dots
  // with a running skip-count — and its "Continue" commits the move with
  // the correct product instead of making the player keep retyping it.
  // The ordinary correct-answer-commits path stays covered by the full
  // playthrough loop further down, which types real answers every turn.
  const correctDragProduct = runInPage(dom, () => computePendingProduct());
  const pendingFactorsForDrag = runInPage(dom, () => pendingFactors());
  // Hold botTurn while this probe waits out the ~5s animation, then put it
  // back for the playthrough below — a bot move scheduled earlier (or by
  // the Continue click itself) would otherwise land mid-assertion. Same
  // hazard the two-row variants' rounding probe hit for real.
  runInPage(dom, () => { window.__origBotTurn = botTurn; botTurn = () => {}; });
  runInPage(dom, () => { el('answer-input').value = '88888'; el('check-btn').click(); });

  const arrModal = runInPage(dom, () => {
    const backdrop = document.getElementById('explain-modal-backdrop');
    return {
      visible: !!backdrop && !backdrop.classList.contains('hidden'),
      answerHtml: backdrop ? document.getElementById('explain-modal-answer').innerHTML : null,
      totalColumnSlots: document.querySelectorAll('.arr-col').length,
      shownColumns: document.querySelectorAll('.arr-col:not(.arr-pending)').length,
      dotsInFirstColumn: document.querySelectorAll('.arr-col:first-child .arr-dot').length,
      ownerUnchanged: st.pendingMove !== null,
    };
  });
  assert.strictEqual(arrModal.visible, true, 'a 2nd wrong answer should open the answer-explanation modal');
  assert.ok(arrModal.answerHtml && arrModal.answerHtml.includes(String(correctDragProduct)), 'the modal should state the real correct product');
  assert.strictEqual(arrModal.totalColumnSlots, pendingFactorsForDrag[0], 'the array should reserve one column slot per group from the very first frame, so nothing shifts as they fill in');
  assert.strictEqual(arrModal.dotsInFirstColumn, pendingFactorsForDrag[1], 'each column should hold one dot per item in the group');
  assert.strictEqual(arrModal.shownColumns, 1, 'only the first column should be revealed right after the modal opens — the columns come in one at a time');
  assert.strictEqual(arrModal.ownerUnchanged, true, 'the move should not commit just from the modal appearing');

  // ~5s paced sequence (EXPLAIN_TOTAL_MS); 7s clears it with room to spare.
  await sleep(7000);
  const arrSettled = runInPage(dom, () => ({
    shownColumns: document.querySelectorAll('.arr-col:not(.arr-pending)').length,
    counts: Array.from(document.querySelectorAll('.arr-count')).map(c => c.textContent).filter(Boolean),
    total: document.querySelector('.arr-total').textContent,
  }));
  assert.strictEqual(arrSettled.shownColumns, pendingFactorsForDrag[0], 'every column should be revealed once the sequence settles');
  assert.deepStrictEqual(
    arrSettled.counts.map(Number),
    Array.from({ length: pendingFactorsForDrag[0] }, (_, i) => (i + 1) * pendingFactorsForDrag[1]),
    'the running counts under the columns should be a real skip-count, landing on the product'
  );
  assert.ok(arrSettled.total.includes(String(correctDragProduct)), 'the settled frame should state the product');

  const rightDragAnswer = runInPage(dom, () => {
    document.getElementById('explain-modal-continue-btn').click();
    return { tokens: st.tokens.slice(), pendingCleared: st.pendingMove === null };
  });
  assert.strictEqual(rightDragAnswer.pendingCleared, true, "the modal's Continue should clear the pending move");
  assert.strictEqual(rightDragAnswer.tokens[dragTest.activeIdx], dragTest.target, "Continue should actually commit the dragged-to position into st.tokens — this is what 'claiming the cell' means, not the drag itself");

  // Restore the real bot and hand control back to it, exactly as the
  // Continue click would have if it hadn't been stubbed out above.
  runInPage(dom, () => { botTurn = window.__origBotTurn; if (st.turn === 'bot' && !st.gameOver) setTimeout(botTurn, 50); });

  // Let the bot resolve before handing off to the general playthrough loop.
  for (let i = 0; i < 20; i++) {
    const { phase, turn } = runInPage(dom, () => ({ phase: st.phase, turn: st.turn }));
    // phase alone isn't enough: checkAnswer() sets phase back to 'idle'
    // SYNCHRONOUSLY the instant a human move is confirmed, before handing
    // off via `st.turn = 'bot'` — botTurn() itself only actually runs
    // ~550ms later, via setTimeout. Waiting on phase alone would stop
    // polling in that in-between window, before the bot has done anything.
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }

  // --- Real playthrough: human plays Hard-quality moves (via the in-page
  // bot logic) against an Easy bot, to a real win. Setup moves stay
  // click-based (no existing position to drag from yet); every ordinary
  // "move" turn drags whichever token the move actually names DIRECTLY —
  // both tokens are always draggable now (no separate "switch which token
  // is active" step to click through first — see CLAUDE.md's Beeline
  // redesign note), so there's no selection step needed before dragging. ---
  async function playHumanTurn() {
    // Pass st.visitedTokenPairs (the anti-stalemate rule's real-game
    // history — see beeline-product.html's own comment) so this scripted
    // "human" never proposes a move the real page's own onDrop/click
    // handlers would reject as an already-visited repeat.
    const move = runInPage(dom, () => botChooseRound({ owner: st.owner, tokens: st.tokens }, 'human', 'hard', st.visitedTokenPairs));
    if (move.type === 'setup') {
      runInPage(dom, (mv) => {
        document.querySelectorAll('#operand-row .op-num')[mv.a - 1].click();
        document.querySelectorAll('#operand-row .op-num')[mv.b - 1].click();
      }, move);
    } else {
      runInPage(dom, (mv) => {
        const cellCenter = (num) => (num - 1) * 40 + 17;
        const tok = document.querySelector('.token.token-' + mv.idx);
        tok.dispatchEvent(new PointerEvent('pointerdown', { clientX: cellCenter(st.tokens[mv.idx]), clientY: 20, pointerId: 1, bubbles: true }));
        tok.dispatchEvent(new PointerEvent('pointerup', { clientX: cellCenter(mv.pos), clientY: 20, pointerId: 1, bubbles: true }));
      }, move);
      await sleep(300); // TOKEN_SNAP_MS (220ms) + buffer, before pendingMove is actually set
    }
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

  // The win-visual reveal (typewriter banner + staggered winning-line
  // flash, see CLAUDE.md "Celebration animations") is asynchronous — right
  // after gameOver flips, it should still be mid-flight, not already
  // showing final state. Proves this is really animated, not silently
  // short-circuited to instant.
  const midFlight = runInPage(dom, () => ({
    bannerText: el('winner-banner').textContent,
    winCellClasses: (st.winningCells || []).map(i => document.querySelectorAll('#claim-grid .claim-cell')[i].className),
  }));
  assert.strictEqual(midFlight.bannerText, '', 'winner banner should be cleared (typewriter not yet started ticking) immediately after gameOver');
  midFlight.winCellClasses.forEach(cls => {
    assert.ok(!/\bwin\b/.test(cls), 'winning cells should not have .win yet in the same tick gameOver flips (the stagger has not started)');
  });

  // Typewriter is 45ms/char + a 400ms flash buffer; the winning-line reveal
  // is 4 cells * 180ms stagger + 150ms pause + 400ms flash. 2s comfortably
  // clears both for every possible banner string and any winning line.
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
  assert.strictEqual(final.winner, 'human', 'a Hard-quality human should reliably beat an Easy bot (matches the ~100% simulated win rate)');
  assert.ok(final.winningCells && final.winningCells.length === 4, 'a real win should have exactly 4 winning cells recorded');
  final.winningCells.forEach(idx => {
    assert.strictEqual(final.owner[idx], 'human', 'every recorded winning cell should actually be owned by the declared winner');
  });
  assert.strictEqual(final.bannerText, 'BEELINE! You win!', 'the winner banner should show the human-win text once the typewriter finishes');
  assert.strictEqual(final.winRevealDone, true, 'the winning-line reveal sequence should have finished by now');
  final.winCellClasses.forEach(cls => {
    assert.ok(/\bwin\b/.test(cls) && /\bsettled\b/.test(cls) && !/\bflash\b/.test(cls), `winning cell should have settled into "win settled" (not still flashing) once the reveal finishes, got "${cls}"`);
  });
  assert.strictEqual(final.scoreHuman, 1, "the human's win should be reflected in the score pill");

  console.log('  ✅ beeline-product.html: full playthrough smoke test passed');
  console.log(`     wasted-turn rule verified | anti-stalemate rule verified | human won in ${turns} turns | winning cells: ${JSON.stringify(final.winningCells)}`);
}

main().catch(e => {
  console.error('  ❌ beeline-product.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
