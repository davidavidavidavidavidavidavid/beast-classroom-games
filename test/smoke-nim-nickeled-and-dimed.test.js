/*
 * jsdom full-playthrough smoke test for nim-nickeled-and-dimed.html.
 *
 * Same shape as test/smoke-nim.test.js (turn-based, no dice/animation ticks
 * to wait out besides the ~550ms bot-thinking delay), with three additions
 * specific to this variant:
 *   1. A direct probe of the per-button legal-move disabling — the dime
 *      button must disable itself once adding it would pass 50¢, while the
 *      nickel stays enabled (see CLAUDE.md's design note on overshoot
 *      prevention). Driven by poking st.total directly and re-rendering,
 *      not by playing an entire game up to that total — a targeted check
 *      of render()'s own logic, independent of the general playthrough.
 *   2. Currency-formatted display assertions ("35¢", not a bare "35").
 *   3. The playthrough drives the human via Hard-quality moves (same trick
 *      as base Nim's own smoke test) and confirms the game still resolves
 *      correctly under the EXACT-match win condition — i.e., it actually
 *      reaches precisely 50¢, never anything past it, since overshoot is
 *      never offered as a legal choice.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('nim-nickeled-and-dimed.html');

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
  assert.strictEqual(cfg.total, 0, 'the pile should start at 0');
  assert.strictEqual(cfg.phase, 'idle', 'should start idle, awaiting a move');
  assert.strictEqual(cfg.gameOver, false);

  const initialDisplay = runInPage(dom, () => el('total-display').textContent);
  assert.strictEqual(initialDisplay, '0¢', 'the running total must be currency-formatted, not a bare number');

  /* ---------------- per-button legal-move disabling probe ----------------
     Direct state poke: with the pile at 45¢, a dime (+10¢) would overshoot
     to 55¢ — it must be disabled, while the nickel (+5¢, landing exactly on
     50¢) stays enabled. This is the concrete behavior behind the "overshoot
     is never offered as a legal choice" design (CLAUDE.md), checked at the
     DOM level, not just at the nimLegalMoves function level (already
     covered by test/nim-nickeled-and-dimed-bot-simulation.js). */
  const nearTarget = runInPage(dom, () => {
    st.total = 45;
    st.turn = 'human';
    st.phase = 'idle';
    st.gameOver = false;
    render();
    return {
      display: el('total-display').textContent,
      nickelDisabled: document.querySelector('#move-row [data-amount="5"]').disabled,
      dimeDisabled: document.querySelector('#move-row [data-amount="10"]').disabled,
    };
  });
  assert.strictEqual(nearTarget.display, '45¢');
  assert.strictEqual(nearTarget.nickelDisabled, false, 'a nickel from 45¢ lands exactly on 50¢ — must stay legal/enabled');
  assert.strictEqual(nearTarget.dimeDisabled, true, 'a dime from 45¢ would overshoot to 55¢ — must be disabled, never a legal choice');

  // And right at 40¢, a dime lands exactly on target too — both coins
  // should be legal/enabled here (the boundary case: distanceToTarget===10
  // means neither move overshoots).
  const atBoundary = runInPage(dom, () => {
    st.total = 40;
    render();
    return {
      nickelDisabled: document.querySelector('#move-row [data-amount="5"]').disabled,
      dimeDisabled: document.querySelector('#move-row [data-amount="10"]').disabled,
    };
  });
  assert.strictEqual(atBoundary.nickelDisabled, false, 'nickel from 40¢ (lands on 45¢) is legal');
  assert.strictEqual(atBoundary.dimeDisabled, false, 'dime from 40¢ (lands exactly on 50¢) is legal — the boundary case, not overshoot');

  // Reset back to a fresh, known-human-turn state before the rest of the
  // test drives real play. Deliberately NOT calling the real startRound()
  // here — it assigns st.turn from the module-level `nextStarter`, which
  // the initial start-btn click above already toggled once (to 'bot'), so
  // a second startRound() call here would hand the very next turn to the
  // bot instead of the human this probe needs. A direct field reset avoids
  // depending on/consuming that alternation a second time.
  runInPage(dom, () => {
    st.total = 0;
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
    // Pick whichever coin is actually legal from the current total (should
    // be 0 here, post-startRound, so both are legal — but don't assume).
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
  assert.ok(/¢/.test(wrongProbe.equationText), 'the equation line should be currency-formatted (contains ¢), not bare numbers');

  snap = runInPage(dom, snapshotAnswerArea);
  assert.strictEqual(snap.hidden, false, 'awaiting-answer (after a wrong guess): #answer-area is in the layout');
  assert.strictEqual(snap.phaseHidden, false, 'awaiting-answer (after a wrong guess): #answer-area should be visible');

  // A second wrong attempt should surface the hint line, currency-formatted.
  const secondWrong = runInPage(dom, () => {
    el('answer-input').value = String(st.total + 998); // still wrong
    el('check-btn').click();
    return { wrongAttempts: st.wrongAttempts, hint: el('hint-line').textContent };
  });
  assert.strictEqual(secondWrong.wrongAttempts, 2);
  assert.ok(/Hint:/.test(secondWrong.hint), 'a hint should appear after 2 wrong attempts, same convention as every other game');
  assert.ok(/¢/.test(secondWrong.hint), 'the hint should be currency-formatted too');

  /* ---------------- change-your-mind probe: switching the coin choice
     before checking is allowed (real playtesting feedback) ---------------- */
  const changeMindProbe = runInPage(dom, () => {
    const totalBefore = st.total;
    const originalAmount = st.pendingMove.amount;
    const otherAmount = originalAmount === 5 ? 10 : 5;
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
  assert.strictEqual(changeMindProbe.pendingAmount, changeMindProbe.otherAmount, 'clicking a different coin while awaiting the answer-check should swap the pending move');
  assert.strictEqual(changeMindProbe.wrongAttemptsReset, 0, 'switching the coin choice should reset the wrong-attempt count for the new equation');
  assert.strictEqual(changeMindProbe.hintCleared, true, 'switching the coin choice should clear any hint shown for the old one');
  assert.ok(changeMindProbe.equationText.includes(`+ ${changeMindProbe.otherAmount}¢`), `equation should reflect the NEW pending coin, got "${changeMindProbe.equationText}"`);
  assert.strictEqual(changeMindProbe.totalUnchanged, true, 'switching your pick before checking must not touch the running total by itself');
  assert.strictEqual(changeMindProbe.moveRowStillEnabled, true, 'the move row should stay enabled/clickable while awaiting the answer-check, not just while idle');

  // Now answer correctly (for the NEW pending coin) and confirm that move —
  // not the original pick — is what actually commits.
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
    // via setTimeout (same subtlety as base Nim's and Beeline's own tests).
    if (phase === 'idle' && turn === 'human') break;
    await sleep(150);
  }
  runInPage(dom, () => { startRound(); });

  /* ---------------- real playthrough: human plays Hard-quality moves
     against an Easy bot, matching the lopsided win rates already verified
     in test/nim-nickeled-and-dimed-bot-simulation.js — the loop below
     tolerates either outcome rather than assuming 'human' wins. */
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
    // A race to 50¢ with moves of 5/10 takes at most 10 total turns (worst
    // case: everyone adds a nickel every time) — cap generously above that.
    if (turns++ > 40) throw new Error('game did not end within 40 total turns — possible stall');
    if (state.turn === 'human') {
      await playHumanTurn();
    } else {
      await sleep(700); // bot-thinking delay + processing
    }
  }

  const midFlight = runInPage(dom, () => el('winner-banner').textContent);

  // This variant's banner strings are longer than base Nim's ("You win!
  // You brought the pile to exactly 50¢." — 45 chars, worst case "Bot
  // wins..." is 46) — at 45ms/char that's up to ~2070ms of typewriter
  // alone, +400ms flash buffer = ~2470ms worst case. A 1500ms sleep
  // (base Nim's own value, safe there only because its shorter strings
  // and early-appearing "win" keyword tolerate a partial string) is NOT
  // enough here, confirmed empirically — use a longer, safely-clearing
  // sleep instead.
  await sleep(3000);

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

  // The critical, variant-specific assertion: unlike base Nim (where
  // overshoot still wins), this game must land on EXACTLY 50 — never past
  // it — since an overshooting move is never offered as a legal choice.
  assert.strictEqual(final.total, TARGET_FOR_TEST, `the final total must be EXACTLY 50¢ (exact-match win condition, not "50 or more") — got ${final.total}`);
  assert.strictEqual(final.display, '50¢', 'the final displayed total should be currency-formatted');
  assert.strictEqual(final.recomputedWinner, final.winner, 'st.winner should match decideWinner recomputed fresh from the final total');
  assert.ok(final.bannerText.length > 0, 'the winner banner should show final text once the typewriter finishes');
  assert.ok(/exactly 50/i.test(final.bannerText), 'banner text should reference landing on exactly 50¢');
  assert.ok(midFlight.length < final.bannerText.length, `winner banner should have still been mid-typewriter (shorter than the final "${final.bannerText}") right after gameOver, got "${midFlight}"`);
  assert.strictEqual(final.scoreHuman + final.scoreBot, 1, 'exactly one side should have scored this single race');
  assert.strictEqual(final.moveRowDisabled, true, 'the move buttons should be disabled once the round is over');

  console.log('  ✅ nim-nickeled-and-dimed.html: full playthrough smoke test passed');
  console.log(`     legal-move disabling verified (nickel-at-45¢, boundary-at-40¢) | retry-until-correct gate verified | winner=${final.winner} | final total=${final.total} (exact) | resolved in ${turns} total turns`);
}

const TARGET_FOR_TEST = 50; // mirrors nim-nickeled-and-dimed.html's own TARGET = 50 (a lexical const, not exposed on the sandbox)

main().catch(e => {
  console.error('  ❌ nim-nickeled-and-dimed.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
