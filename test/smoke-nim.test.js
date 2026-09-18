/*
 * jsdom full-playthrough smoke test for nim.html.
 *
 * Turn-based like Beeline (no dice/animation ticks to wait out, just the
 * ~550ms bot-thinking delay) but much shorter — a full race resolves in as
 * few as 5 total turns. The human plays Hard-quality moves (via the
 * in-page botChooseRound, same trick smoke-beeline-product.test.js uses)
 * against an Easy bot so the game reliably resolves in bounded turns,
 * matching the lopsided win rates already verified in
 * test/nim-bot-simulation.js. A separate probe drives the human to a
 * deliberately WRONG new-total answer first, confirming the retry-until-
 * correct gate actually blocks the move, before letting a real playthrough
 * run. Layout-stability assertions (CLAUDE.md "Layout stability") are
 * folded into the same run, same pattern smoke-beeline-product.test.js
 * uses rather than the separate layout-stability.test.js file (which is
 * scoped to the original two Scuttle games only).
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('nim.html');

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
  // on an Easy bot for its deterministic, bounded-turns outcome.
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
  assert.strictEqual(cfg.total, 0, 'the race should start at 0');
  assert.strictEqual(cfg.phase, 'idle', 'should start idle, awaiting a move');
  assert.strictEqual(cfg.gameOver, false);

  /* ---------------- layout-stability probe ----------------
     #answer-area is within-round phase content on an already-visible
     screen (idle -> awaiting-answer -> idle again) — see CLAUDE.md "Layout
     stability". #answer-area is LATER-phase content — it sits below the
     move-button row, so revealing it displaces nothing the player is
     using, and reserving its ~145px from first paint was dead space.
     It therefore toggles .hidden, never .phase-hidden.
     across a full idle -> awaiting-answer -> back-to-idle cycle. */
  function snapshotAnswerArea() {
    const cl = document.getElementById('answer-area').classList;
    return { hidden: cl.contains('hidden'), phaseHidden: cl.contains('phase-hidden') };
  }
  let snap = runInPage(dom, snapshotAnswerArea);
  assert.strictEqual(snap.hidden, true, 'idle (before any move): #answer-area belongs to a later phase and must be out of the layout, not reserving ~145px of dead space');
  assert.strictEqual(snap.phaseHidden, false, 'idle (before any move): #answer-area must not reserve space for a phase the player has not reached');

  /* ---------------- wrong-answer probe: the retry gate actually blocks ---------------- */
  const wrongProbe = runInPage(dom, () => {
    document.querySelector('#move-row [data-amount="2"]').click();
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
    };
  });
  assert.strictEqual(wrongProbe.totalAfter, wrongProbe.totalBefore, 'a wrong new-total guess must NOT change the running total');
  assert.strictEqual(wrongProbe.turnAfter, 'human', "a wrong guess shouldn't hand the turn to the bot");
  assert.strictEqual(wrongProbe.wrongAttempts, 1, 'one wrong attempt should be recorded');
  assert.strictEqual(wrongProbe.pendingStillSet, true, 'the pending move should stay open for another attempt');
  assert.strictEqual(wrongProbe.hintEmpty, true, 'no hint yet after only 1 wrong attempt (hint appears at 2, matching every other game)');

  snap = runInPage(dom, snapshotAnswerArea);
  assert.strictEqual(snap.hidden, false, 'awaiting-answer (after a wrong guess): #answer-area is in the layout');
  assert.strictEqual(snap.phaseHidden, false, 'awaiting-answer (after a wrong guess): #answer-area should be visible');

  // A second wrong attempt should surface the hint line.
  const secondWrong = runInPage(dom, () => {
    el('answer-input').value = String(st.total + 998); // still wrong
    el('check-btn').click();
    return { wrongAttempts: st.wrongAttempts, hint: el('hint-line').textContent };
  });
  assert.strictEqual(secondWrong.wrongAttempts, 2);
  assert.ok(/Hint:/.test(secondWrong.hint), 'a hint should appear after 2 wrong attempts, same convention as every other game');

  /* ---------------- change-your-mind probe: switching the move choice
     before checking is allowed (real playtesting feedback) ---------------- */
  const changeMindProbe = runInPage(dom, () => {
    const totalBefore = st.total;
    document.querySelector('#move-row [data-amount="1"]').click(); // was +2, now switching to +1
    return {
      pendingAmount: st.pendingMove.amount,
      wrongAttemptsReset: st.wrongAttempts,
      hintCleared: el('hint-line').textContent === '',
      equationText: el('equation-line').textContent,
      totalUnchanged: st.total === totalBefore,
      moveRowStillEnabled: !el('move-row').classList.contains('disabled'),
    };
  });
  assert.strictEqual(changeMindProbe.pendingAmount, 1, 'clicking a different move amount while awaiting the answer-check should swap the pending move');
  assert.strictEqual(changeMindProbe.wrongAttemptsReset, 0, 'switching the move choice should reset the wrong-attempt count for the new equation');
  assert.strictEqual(changeMindProbe.hintCleared, true, 'switching the move choice should clear any hint shown for the old one');
  assert.ok(changeMindProbe.equationText.includes('+ 1'), `equation should reflect the NEW pending amount (+1), got "${changeMindProbe.equationText}"`);
  assert.strictEqual(changeMindProbe.totalUnchanged, true, 'switching your pick before checking must not touch the running total by itself');
  assert.strictEqual(changeMindProbe.moveRowStillEnabled, true, 'the move row should stay enabled/clickable while awaiting the answer-check, not just while idle');

  // Now answer correctly (for the NEW pending amount, +1) and confirm that
  // move — not the original +2 pick — is what actually commits.
  const correctProbe = runInPage(dom, () => {
    const expected = st.total + st.pendingMove.amount;
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
    // phase alone isn't enough: checkAnswer()/commitMove() set phase back to
    // 'idle' SYNCHRONOUSLY the instant a human move is confirmed, before
    // handing off turn — botTurn() itself only actually runs ~550ms later
    // via setTimeout (same subtlety as Beeline's own smoke test).
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }
  runInPage(dom, () => { startRound(); });

  /* ---------------- real playthrough: human plays Hard-quality moves
     against an Easy bot, to a real win (matches nim-bot-simulation.js's
     ~95% Hard-seat win rate — not literally 100%, since going first is a
     genuine coin the OTHER side sometimes wins by luck here, see that
     script's header — but reliable enough for a smoke test, and the loop
     below tolerates either outcome rather than assuming 'human' wins). */
  async function playHumanTurn() {
    const amount = runInPage(dom, () => botChooseRound(st.total, 'hard'));
    runInPage(dom, (amt) => {
      document.querySelector(`#move-row [data-amount="${amt}"]`).click();
    }, amount);
    const correct = runInPage(dom, () => st.total + st.pendingMove.amount);
    runInPage(dom, (val) => { el('answer-input').value = String(val); el('check-btn').click(); }, correct);
  }

  let turns = 0;
  while (true) {
    const state = runInPage(dom, () => ({ gameOver: st.gameOver, turn: st.turn }));
    if (state.gameOver) break;
    // A race to 10 with moves of 1-2 takes at most 10 total turns (worst
    // case: everyone adds 1 every time) — cap generously above that.
    if (turns++ > 40) throw new Error('game did not end within 40 total turns — possible stall');
    if (state.turn === 'human') {
      await playHumanTurn();
    } else {
      await sleep(700); // bot-thinking delay + processing
    }
  }

  // The win banner's typewriter reveal (CLAUDE.md "Celebration animations")
  // is asynchronous — right after gameOver flips, it should still be
  // mid-flight, not already showing the full final text. Unlike Beeline's
  // equivalent check (which can assert an exactly-EMPTY banner, because its
  // playthrough loop always has the human make the decisive move), Nim's
  // decisive move can just as easily be the BOT's — reached through
  // botTurn()'s own two chained ~550ms delays (see CLAUDE.md Known traps),
  // not a synchronous click — so the loop above's own sleep(700) can land
  // partway into the typewriter interval by the time it notices gameOver.
  // Asserting "shorter than the eventual final text" (checked below, once
  // that's known) proves the same thing — animated, not instant — without
  // being racy about catching literally the first tick.
  const midFlight = runInPage(dom, () => el('winner-banner').textContent);

  // Longest possible banner string here is short — 45ms/char + 400ms flash
  // buffer clears comfortably well under 1s, but match the generous margin
  // convention used elsewhere.
  await sleep(1500);

  const final = runInPage(dom, () => ({
    winner: st.winner,
    total: st.total,
    recomputedWinner: decideWinner(st.total, st.winner),
    bannerText: el('winner-banner').textContent,
    scoreHuman: st.score.human,
    scoreBot: st.score.bot,
    moveRowDisabled: el('move-row').classList.contains('disabled'),
  }));

  assert.ok(final.total >= 10, 'the final total should have actually reached/crossed the target');
  assert.strictEqual(final.recomputedWinner, final.winner, 'st.winner should match decideWinner recomputed fresh from the final total');
  assert.ok(final.bannerText.length > 0, 'the winner banner should show final text once the typewriter finishes');
  assert.ok(/win/i.test(final.bannerText), 'banner text should mention winning');
  assert.ok(midFlight.length < final.bannerText.length, `winner banner should have still been mid-typewriter (shorter than the final "${final.bannerText}") right after gameOver, got "${midFlight}"`);
  assert.strictEqual(final.scoreHuman + final.scoreBot, 1, 'exactly one side should have scored this single race');
  assert.strictEqual(final.moveRowDisabled, true, 'the move buttons should be disabled once the round is over');

  console.log('  ✅ nim.html: full playthrough smoke test passed');
  console.log(`     retry-until-correct gate verified | winner=${final.winner} | final total=${final.total} | resolved in ${turns} total turns`);
}

main().catch(e => {
  console.error('  ❌ nim.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
