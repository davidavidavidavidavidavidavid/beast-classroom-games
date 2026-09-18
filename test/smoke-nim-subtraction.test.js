/*
 * jsdom full-playthrough smoke test for nim-subtraction.html.
 *
 * Same shape as test/smoke-nim-nickeled-and-dimed.test.js (turn-based, no
 * dice/animation ticks besides the ~550ms bot-thinking delay), adapted for
 * a COUNT-DOWN pile instead of a count-up total:
 *   1. A direct probe of the per-button legal-move disabling near the end
 *      of the pile — removing 3 must disable itself once it would take the
 *      pile below 0, while smaller amounts stay enabled.
 *   2. Plain-integer display assertions (no currency formatting here).
 *   3. The playthrough drives the human via Hard-quality moves and
 *      confirms the game resolves correctly under the exact-empty-pile win
 *      condition — it actually reaches precisely 0, never negative, since
 *      overshoot is never offered as a legal choice.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

const PILE_START = 20; // mirrors nim-subtraction.html's own PILE_START = 20 (a lexical const, not exposed on the sandbox)
const TARGET_FOR_TEST = 0;

async function main() {
  const dom = loadGame('nim-subtraction.html');

  // Avatars (see CLAUDE.md "Avatars"): before touching anything, the picker
  // and every badge should already agree with the default state — st.avatar
  // selected in the picker, and the bot badge matching the default (medium)
  // difficulty. This game has no persistent #scorecard (see CLAUDE.md's Nim
  // design note), so snapshotAvatarState()'s scYouBadge/scBotBadge fields
  // correctly come back null here — not asserted on.
  const defaults = snapshotAvatarState(dom);
  assert.strictEqual(defaults.pickerSelected, defaults.avatar, 'the avatar picker should mark st.avatar\'s slot as .selected by default');
  assert.strictEqual(defaults.youBadge, `avatars/${defaults.avatar}.png`, 'top-bar "you" badge should point at st.avatar\'s image');
  assert.strictEqual(defaults.botBadge, `avatars/bot-${defaults.difficulty}.png`, 'top-bar bot badge should point at the difficulty-mapped bot avatar');

  // Pick a different avatar + switch to the hard bot, confirming the two are
  // independent: only the "you" badge should follow the avatar pick, only
  // the bot badge should follow the difficulty. Switched back to 'easy'
  // afterward, below, since the rest of this test's own playthrough relies
  // on an Easy bot for its deterministic, bounded-turns outcome (this
  // game's forced-win seat is SECOND under perfect play, but the Easy bot
  // here is far from perfect play — see CLAUDE.md's design note — so the
  // human-plays-Hard-vs-Easy-bot setup below stays unaffected either way).
  runInPage(dom, () => {
    document.querySelector('#avatar-row [data-avatar="cammy"]').click();
    document.querySelector('#diff-row [data-diff="hard"]').click();
  });
  const afterPick = snapshotAvatarState(dom);
  assert.strictEqual(afterPick.avatar, 'cammy', 'clicking an avatar slot should update st.avatar');
  assert.strictEqual(afterPick.pickerSelected, 'cammy', 'the clicked slot should become the (only) .selected one');
  assert.strictEqual(afterPick.youBadge, 'avatars/cammy.png', 'top-bar "you" badge should update to the newly picked avatar');
  assert.strictEqual(afterPick.botBadge, 'avatars/bot-hard.png', 'bot badge should swap to the hard-tier avatar once difficulty changes to hard, independent of the avatar pick');

  runInPage(dom, () => {
    document.querySelector('#diff-row [data-diff="easy"]').click();
    el('start-btn').click();
  });

  const cfg = runInPage(dom, () => ({ total: st.total, phase: st.phase, gameOver: st.gameOver }));
  assert.strictEqual(cfg.total, PILE_START, 'the pile should start at 20 tokens');
  assert.strictEqual(cfg.phase, 'idle', 'should start idle, awaiting a move');
  assert.strictEqual(cfg.gameOver, false);

  const initialDisplay = runInPage(dom, () => el('total-display').textContent);
  assert.strictEqual(initialDisplay, '20', 'the running total must be a plain integer, not currency-formatted (that convention is Nickeled & Dimed-specific)');

  /* ---------------- per-button legal-move disabling probe ----------------
     With 2 tokens left, removing 3 would go negative — it must be
     disabled, while removing 1 or 2 stay enabled. This is the concrete
     behavior behind "overshoot is never offered as a legal choice"
     (CLAUDE.md), checked at the DOM level, not just at the nimLegalMoves
     function level (already covered by
     test/nim-subtraction-bot-simulation.js). */
  const nearEmpty = runInPage(dom, () => {
    st.total = 2;
    st.turn = 'human';
    st.phase = 'idle';
    st.gameOver = false;
    render();
    return {
      display: el('total-display').textContent,
      oneDisabled: document.querySelector('#move-row [data-amount="1"]').disabled,
      twoDisabled: document.querySelector('#move-row [data-amount="2"]').disabled,
      threeDisabled: document.querySelector('#move-row [data-amount="3"]').disabled,
    };
  });
  assert.strictEqual(nearEmpty.display, '2');
  assert.strictEqual(nearEmpty.oneDisabled, false, 'removing 1 from a pile of 2 leaves 1 — legal');
  assert.strictEqual(nearEmpty.twoDisabled, false, 'removing 2 from a pile of 2 empties it exactly — legal, not overshoot');
  assert.strictEqual(nearEmpty.threeDisabled, true, 'removing 3 from a pile of 2 would go negative — must be disabled, never a legal choice');

  // At exactly 3 remaining, all three amounts are legal (the boundary case).
  const atBoundary = runInPage(dom, () => {
    st.total = 3;
    render();
    return {
      oneDisabled: document.querySelector('#move-row [data-amount="1"]').disabled,
      twoDisabled: document.querySelector('#move-row [data-amount="2"]').disabled,
      threeDisabled: document.querySelector('#move-row [data-amount="3"]').disabled,
    };
  });
  assert.strictEqual(atBoundary.oneDisabled, false, 'removing 1 from a pile of 3 (leaves 2) is legal');
  assert.strictEqual(atBoundary.twoDisabled, false, 'removing 2 from a pile of 3 (leaves 1) is legal');
  assert.strictEqual(atBoundary.threeDisabled, false, 'removing 3 from a pile of 3 (empties it exactly) is legal — the boundary case, not overshoot');

  // Reset back to a fresh, known-human-turn state before the rest of the
  // test drives real play — same reasoning as the Nickeled & Dimed smoke
  // test: a second startRound() call here would consume nextStarter's
  // alternation a second time, so a direct field reset avoids that.
  runInPage(dom, () => {
    st.total = PILE_START;
    st.turn = 'human';
    st.phase = 'idle';
    st.pendingMove = null;
    st.wrongAttempts = 0;
    st.gameOver = false;
    st.winner = null;
    render();
  });

  /* ---------------- layout-stability probe ----------------
     #answer-area is within-round phase content on an already-visible
     screen (idle -> awaiting-answer -> idle again) — see CLAUDE.md "Layout
     stability". #answer-area is LATER-phase content — it sits below the
     move-button row, so revealing it displaces nothing the player is
     using, and reserving its ~145px from first paint was dead space.
     It therefore toggles .hidden, never .phase-hidden. */
  function snapshotAnswerArea() {
    const cl = document.getElementById('answer-area').classList;
    return { hidden: cl.contains('hidden'), phaseHidden: cl.contains('phase-hidden') };
  }
  let snap = runInPage(dom, snapshotAnswerArea);
  assert.strictEqual(snap.hidden, true, 'idle (before any move): #answer-area belongs to a later phase and must be out of the layout, not reserving ~145px of dead space');
  assert.strictEqual(snap.phaseHidden, false, 'idle (before any move): #answer-area must not reserve space for a phase the player has not reached');

  /* ---------------- wrong-answer probe: the retry gate actually blocks ---------------- */
  const wrongProbe = runInPage(dom, () => {
    const legalBtn = document.querySelector('#move-row [data-amount]:not([disabled])');
    legalBtn.click();
    const totalBefore = st.total;
    el('answer-input').value = String(st.total + 999); // deliberately wrong
    el('check-btn').click();
    return {
      totalBefore,
      totalAfter: st.total,
      turnAfter: st.turn,
      wrongAttempts: st.wrongAttempts,
      pendingStillSet: st.pendingMove !== null,
      hintEmpty: el('hint-line').textContent === '',
      equationText: el('equation-line').textContent,
    };
  });
  assert.strictEqual(wrongProbe.totalAfter, wrongProbe.totalBefore, 'a wrong new-total guess must NOT change the running total');
  assert.strictEqual(wrongProbe.turnAfter, 'human', "a wrong guess shouldn't hand the turn to the bot");
  assert.strictEqual(wrongProbe.wrongAttempts, 1, 'one wrong attempt should be recorded');
  assert.strictEqual(wrongProbe.pendingStillSet, true, 'the pending move should stay open for another attempt');
  assert.strictEqual(wrongProbe.hintEmpty, true, 'no hint yet after only 1 wrong attempt (hint appears at 2, matching every other game)');
  assert.ok(/−/.test(wrongProbe.equationText), 'the equation line should show a subtraction, not an addition (this game removes tokens, it does not add them)');

  snap = runInPage(dom, snapshotAnswerArea);
  assert.strictEqual(snap.hidden, false, 'awaiting-answer (after a wrong guess): #answer-area is in the layout');
  assert.strictEqual(snap.phaseHidden, false, 'awaiting-answer (after a wrong guess): #answer-area should be visible');

  const secondWrong = runInPage(dom, () => {
    el('answer-input').value = String(st.total + 998); // still wrong
    el('check-btn').click();
    return { wrongAttempts: st.wrongAttempts, hint: el('hint-line').textContent };
  });
  assert.strictEqual(secondWrong.wrongAttempts, 2);
  assert.ok(/Hint:/.test(secondWrong.hint), 'a hint should appear after 2 wrong attempts, same convention as every other game');
  assert.ok(/−/.test(secondWrong.hint), 'the hint should show a subtraction too');

  /* ---------------- change-your-mind probe: switching the amount before
     checking is allowed (same fix as every other game — CLAUDE.md's
     Post-playtest note) ---------------- */
  const changeMindProbe = runInPage(dom, () => {
    const totalBefore = st.total;
    const originalAmount = st.pendingMove.amount;
    const legalNow = nimLegalMoves(st.total, [1, 2, 3], false);
    const otherAmount = legalNow.find(a => a !== originalAmount);
    document.querySelector(`#move-row [data-amount="${otherAmount}"]`).click();
    return {
      originalAmount,
      otherAmount,
      pendingAmount: st.pendingMove.amount,
      wrongAttemptsReset: st.wrongAttempts,
      hintCleared: el('hint-line').textContent === '',
      equationText: el('equation-line').textContent,
      totalUnchanged: st.total === totalBefore,
      moveRowStillEnabled: !el('move-row').classList.contains('disabled'),
    };
  });
  assert.strictEqual(changeMindProbe.pendingAmount, changeMindProbe.otherAmount, 'clicking a different amount while awaiting the answer-check should swap the pending move');
  assert.strictEqual(changeMindProbe.wrongAttemptsReset, 0, 'switching the amount should reset the wrong-attempt count for the new equation');
  assert.strictEqual(changeMindProbe.hintCleared, true, 'switching the amount should clear any hint shown for the old one');
  assert.ok(changeMindProbe.equationText.includes(`− ${changeMindProbe.otherAmount}`), `equation should reflect the NEW pending amount, got "${changeMindProbe.equationText}"`);
  assert.strictEqual(changeMindProbe.totalUnchanged, true, 'switching your pick before checking must not touch the running total by itself');
  assert.strictEqual(changeMindProbe.moveRowStillEnabled, true, 'the move row should stay enabled/clickable while awaiting the answer-check, not just while idle');

  const correctProbe = runInPage(dom, () => {
    const expected = st.total - st.pendingMove.amount;
    el('answer-input').value = String(expected);
    el('check-btn').click();
    return { expected, totalAfter: st.total, turnAfter: st.turn, pendingCleared: st.pendingMove === null };
  });
  assert.strictEqual(correctProbe.totalAfter, correctProbe.expected, 'a correct new-total guess should actually commit the move');
  assert.strictEqual(correctProbe.pendingCleared, true);
  assert.strictEqual(correctProbe.turnAfter, 'bot', 'turn should pass to the bot after a correct human move');

  snap = runInPage(dom, snapshotAnswerArea);
  assert.strictEqual(snap.hidden, true, 'back to idle after committing: #answer-area leaves the layout again');
  assert.strictEqual(snap.phaseHidden, false, 'back to idle after committing: #answer-area must not start reserving space again');

  // Let the bot resolve before handing off to the general playthrough loop.
  for (let i = 0; i < 20; i++) {
    const { phase, turn } = runInPage(dom, () => ({ phase: st.phase, turn: st.turn }));
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }
  runInPage(dom, () => { startRound(); });

  /* ---------------- real playthrough: human plays Hard-quality moves
     against an Easy bot — the loop tolerates either outcome (this game's
     forced-win seat is SECOND, not first, and nextStarter may hand the
     human either seat — see CLAUDE.md's design note), matching the same
     "don't assume a fixed winner" discipline as the sibling smoke test. */
  async function playHumanTurn() {
    const amount = runInPage(dom, () => botChooseRound(st.total, 'hard'));
    runInPage(dom, (amt) => {
      document.querySelector(`#move-row [data-amount="${amt}"]`).click();
    }, amount);
    const correct = runInPage(dom, () => st.total - st.pendingMove.amount);
    runInPage(dom, (val) => { el('answer-input').value = String(val); el('check-btn').click(); }, correct);
  }

  let turns = 0;
  while (true) {
    const state = runInPage(dom, () => ({ gameOver: st.gameOver, turn: st.turn }));
    if (state.gameOver) break;
    // A pile of 20 with moves 1-3 takes at most 20 total turns (everyone
    // removes 1 every time) — cap generously above that.
    if (turns++ > 25) throw new Error('game did not end within 25 total turns — possible stall');
    if (state.turn === 'human') {
      await playHumanTurn();
    } else {
      await sleep(700); // bot-thinking delay + processing
    }
  }

  const midFlight = runInPage(dom, () => el('winner-banner').textContent);

  // "You win! You took the last token." (35 chars) / "Bot wins. Bot took
  // the last token." (34 chars) — at 45ms/char that's up to ~1575ms of
  // typewriter alone, +400ms flash buffer ≈ 1975ms worst case. Use a
  // comfortably larger sleep rather than cutting it close (see CLAUDE.md's
  // Known Traps note on re-deriving a sibling's sleep duration for a new
  // game's own actual banner text, not copying it blindly).
  await sleep(2500);

  const final = runInPage(dom, () => ({
    winner: st.winner,
    total: st.total,
    display: el('total-display').textContent,
    recomputedWinner: decideWinner(st.total, st.winner),
    bannerText: el('winner-banner').textContent,
    scoreHuman: st.score.human,
    scoreBot: st.score.bot,
    moveRowDisabled: el('move-row').classList.contains('disabled'),
  }));

  assert.strictEqual(final.total, TARGET_FOR_TEST, `the final total must be EXACTLY 0 (empty pile) — got ${final.total}`);
  assert.strictEqual(final.display, '0', 'the final displayed total should be a plain "0"');
  assert.strictEqual(final.recomputedWinner, final.winner, 'st.winner should match decideWinner recomputed fresh from the final total');
  assert.ok(final.bannerText.length > 0, 'the winner banner should show final text once the typewriter finishes');
  assert.ok(/last token/i.test(final.bannerText), 'banner text should reference taking the last token');
  assert.ok(midFlight.length < final.bannerText.length, `winner banner should have still been mid-typewriter (shorter than the final "${final.bannerText}") right after gameOver, got "${midFlight}"`);
  assert.strictEqual(final.scoreHuman + final.scoreBot, 1, 'exactly one side should have scored this single race');
  assert.strictEqual(final.moveRowDisabled, true, 'the move buttons should be disabled once the round is over');

  console.log('  ✅ nim-subtraction.html: full playthrough smoke test passed');
  console.log(`     legal-move disabling verified (near-empty-at-2, boundary-at-3) | retry-until-correct gate verified | winner=${final.winner} | final total=${final.total} (exact) | resolved in ${turns} total turns`);
}

main().catch(e => {
  console.error('  ❌ nim-subtraction.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
