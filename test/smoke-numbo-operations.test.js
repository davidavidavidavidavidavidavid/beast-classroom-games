/*
 * jsdom full-playthrough smoke test for numbo-operations.html.
 *
 * The new pieces this game needed beyond every prior smoke test: (1) a
 * target-setting phase that alternates who's active, human vs. bot,
 * (2) a real typed-expression answer-check with several distinct failure
 * modes (structural — syntax/digits/div-by-zero — vs. a value mismatch),
 * not just "wrong number," and (3) a variable-length match ("first to 5
 * points," not a fixed round count or single-round-per-match). The human
 * plays Hard-quality expressions (via the in-page botHard, same trick
 * every adversarial-bot smoke test in this project uses) against an Easy
 * bot so the match reliably resolves in bounded rounds.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('numbo-operations.html');

  // Avatars (see CLAUDE.md "Avatars"): before touching anything, the picker
  // and the top-bar badges should already agree with the default state —
  // st.avatar selected in the picker, and the bot badge matching the
  // default (medium) difficulty. This game has no persistent #scorecard
  // (see CLAUDE.md's Numbo design note), so scYouBadge/scBotBadge come back
  // null — not asserted here, unlike the Scuttle games' own version of this
  // check.
  const avatarDefaults = snapshotAvatarState(dom);
  assert.strictEqual(avatarDefaults.pickerSelected, avatarDefaults.avatar, 'the avatar picker should mark st.avatar\'s slot as .selected by default');
  assert.strictEqual(avatarDefaults.youBadge, `avatars/${avatarDefaults.avatar}.png`, 'top-bar "you" badge should point at st.avatar\'s image');
  assert.strictEqual(avatarDefaults.botBadge, `avatars/bot-${avatarDefaults.difficulty}.png`, 'top-bar bot badge should point at the difficulty-mapped bot avatar');

  // Pick a different avatar alongside the difficulty chip this test already
  // needs to click (easy — see this file's own header comment on why: the
  // human plays Hard-quality expressions against an Easy bot so the match
  // reliably resolves). The avatar pick and the difficulty switch are
  // independent: only the "you" badge should follow the avatar pick, only
  // the bot badge should follow the difficulty.
  runInPage(dom, () => {
    document.querySelector('#avatar-row [data-avatar="cammy"]').click();
    document.querySelector('#diff-row [data-diff="easy"]').click();
    el('start-btn').click();
  });

  const avatarAfterPick = snapshotAvatarState(dom);
  assert.strictEqual(avatarAfterPick.avatar, 'cammy', 'clicking an avatar slot should update st.avatar');
  assert.strictEqual(avatarAfterPick.pickerSelected, 'cammy', 'the clicked slot should become the (only) .selected one');
  assert.strictEqual(avatarAfterPick.youBadge, 'avatars/cammy.png', 'top-bar "you" badge should update to the newly picked avatar');
  assert.strictEqual(avatarAfterPick.botBadge, 'avatars/bot-easy.png', 'bot badge should swap to the easy-tier avatar once difficulty changes to easy, independent of the avatar pick');

  const cfg = runInPage(dom, () => ({ phase: st.phase, activePlayer: st.activePlayer, score: st.score }));
  assert.strictEqual(cfg.phase, 'set-target', 'a fresh match should start awaiting the target');
  assert.strictEqual(cfg.activePlayer, 'human', 'human should be active first (nextActivePlayer starts human)');
  assert.deepStrictEqual(cfg.score, { human: 0, bot: 0 });

  /* ---------------- round sub-phase probe ----------------
     Each round sub-phase block (target-setup-human/bot, dice-expr-wrap,
     round-result, next-round-wrap) is mutually exclusive with every other
     one — never partway-visible alongside another the way within-round
     phase content elsewhere in this project is — so these toggle plain
     .hidden (display:none), not .phase-hidden; see CLAUDE.md "Layout
     stability"'s note on why an earlier version wrongly reserved all
     five's space at once. Confirm exactly the right block is unhidden at
     each step of a target-set -> expression-submit -> round-result cycle. */
  function snapshotPhaseBlocks() {
    const ids = ['target-setup-human', 'target-setup-bot', 'dice-expr-wrap', 'round-result', 'next-round-wrap'];
    const out = {};
    ids.forEach(id => {
      out[id] = { hidden: document.getElementById(id).classList.contains('hidden') };
    });
    return out;
  }
  let snap = runInPage(dom, snapshotPhaseBlocks);
  assert.strictEqual(snap['target-setup-human'].hidden, false, 'human target-setup should be visible (human is active)');
  assert.strictEqual(snap['target-setup-bot'].hidden, true, 'bot target-setup should be hidden');
  assert.strictEqual(snap['dice-expr-wrap'].hidden, true, 'dice/expr block should be hidden before a target is set');
  assert.strictEqual(snap['round-result'].hidden, true, 'round-result should be hidden before a target is set');
  assert.strictEqual(snap['next-round-wrap'].hidden, true, 'next-round button should be hidden before a target is set');

  /* ---------------- human sets the target ---------------- */
  runInPage(dom, () => {
    el('target-input').value = '30';
    el('target-confirm-btn').click();
  });
  let state = runInPage(dom, () => ({ phase: st.phase, target: st.target, digitsLen: st.digits.length }));
  assert.strictEqual(state.phase, 'awaiting-human-expr');
  assert.strictEqual(state.target, 30);
  assert.strictEqual(state.digitsLen, 4, 'four digits should have been rolled once the target is set');

  snap = runInPage(dom, snapshotPhaseBlocks);
  assert.strictEqual(snap['dice-expr-wrap'].hidden, false, 'dice/expr block should now be visible');
  assert.strictEqual(snap['target-setup-human'].hidden, true, 'target-setup should be hidden again once set');
  assert.strictEqual(snap['target-setup-bot'].hidden, true);
  assert.strictEqual(snap['round-result'].hidden, true);
  assert.strictEqual(snap['next-round-wrap'].hidden, true);

  /* ---------------- clickable-keyboard probe ----------------
     Real playtesting feedback replaced free typing into #expr-input with
     a clickable keyboard — see CLAUDE.md's Numbo redesign note. Drives the
     ACTUAL buttons (not a direct st.exprTokens/render() call) to prove the
     full press -> disable -> backspace -> re-enable cycle really works,
     including the legality guards (no leading operator, no ")" with
     nothing open, no digit-then-"(" with no operator between). */
  const kbInitial = runInPage(dom, () => ({
    digitCount: document.querySelectorAll('#numbo-kb-digits button').length,
    opsDisabled: Array.from(document.querySelectorAll('#numbo-keyboard [data-op]')).every(b => b.disabled),
    openParenEnabled: !document.querySelector('#numbo-keyboard [data-paren="("]').disabled,
    closeParenDisabled: document.querySelector('#numbo-keyboard [data-paren=")"]').disabled,
    backspaceDisabled: el('kb-backspace').disabled,
    clearDisabled: el('kb-clear').disabled,
    exprEmpty: el('expr-input').value === '',
  }));
  assert.strictEqual(kbInitial.digitCount, 4, 'the keyboard should show one button per rolled digit');
  assert.strictEqual(kbInitial.opsDisabled, true, 'an operator cannot legally start an expression — should be disabled with nothing pressed yet');
  assert.strictEqual(kbInitial.openParenEnabled, true, '"(" can legally start an expression');
  assert.strictEqual(kbInitial.closeParenDisabled, true, '")" cannot be legal with nothing open yet');
  assert.strictEqual(kbInitial.backspaceDisabled, true, 'backspace should be disabled with nothing typed yet');
  assert.strictEqual(kbInitial.clearDisabled, true, 'clear should be disabled with nothing typed yet');
  assert.strictEqual(kbInitial.exprEmpty, true);

  const afterFirstDigit = runInPage(dom, () => {
    document.querySelectorAll('#numbo-kb-digits button')[0].click();
    return {
      exprText: el('expr-input').value,
      digit0Disabled: document.querySelectorAll('#numbo-kb-digits button')[0].disabled,
      digit1Disabled: document.querySelectorAll('#numbo-kb-digits button')[1].disabled,
      opsEnabled: Array.from(document.querySelectorAll('#numbo-keyboard [data-op]')).every(b => !b.disabled),
      openParenDisabled: document.querySelector('#numbo-keyboard [data-paren="("]').disabled,
      backspaceEnabled: !el('kb-backspace').disabled,
    };
  });
  assert.strictEqual(afterFirstDigit.exprText, String(runInPage(dom, () => st.digits[0])), 'the display should show the pressed digit');
  assert.strictEqual(afterFirstDigit.digit0Disabled, true, 'a pressed digit button should disable itself — that rolled digit is spent');
  assert.strictEqual(afterFirstDigit.digit1Disabled, false, 'the OTHER digit slots stay independently available');
  assert.strictEqual(afterFirstDigit.opsEnabled, true, 'operators become legal once the expression has a first number');
  assert.strictEqual(afterFirstDigit.openParenDisabled, true, '"(" right after a digit is illegal with no operator between them');
  assert.strictEqual(afterFirstDigit.backspaceEnabled, true);

  // Pressing an already-used digit button again must be a no-op.
  const reclickUsed = runInPage(dom, () => {
    const before = el('expr-input').value;
    document.querySelectorAll('#numbo-kb-digits button')[0].click(); // already used — disabled, should do nothing
    return { unchanged: el('expr-input').value === before };
  });
  assert.strictEqual(reclickUsed.unchanged, true, 'clicking an already-spent digit button must not do anything');

  // Backspace removes the digit and re-enables its own specific button.
  const afterBackspace = runInPage(dom, () => {
    el('kb-backspace').click();
    return {
      exprEmpty: el('expr-input').value === '',
      digit0ReEnabled: !document.querySelectorAll('#numbo-kb-digits button')[0].disabled,
      opsDisabledAgain: Array.from(document.querySelectorAll('#numbo-keyboard [data-op]')).every(b => b.disabled),
    };
  });
  assert.strictEqual(afterBackspace.exprEmpty, true, 'backspacing the only token should empty the display again');
  assert.strictEqual(afterBackspace.digit0ReEnabled, true, 'backspace must re-enable the EXACT digit slot it removed, not just any button showing that value');
  assert.strictEqual(afterBackspace.opsDisabledAgain, true, 'with the expression empty again, operators are illegal again');

  // Build a real, complete, valid expression entirely through the keyboard
  // — all 4 digits (in whatever order the buttons are in) joined with "+"
  // — and confirm it both parses correctly AND actually wins the round
  // when the claimed value is submitted, proving the keyboard-built string
  // is exactly what checkAnswer() consumes.
  const kbBuilt = runInPage(dom, () => {
    // renderKeyboard() fully rebuilds #numbo-kb-digits's innerHTML on
    // every press (the digit buttons themselves get torn down and
    // recreated, same rebuild-on-render pattern as everywhere else in
    // this project) — re-query fresh before each click rather than
    // reusing an earlier NodeList, which would go stale after the first
    // rebuild and silently click a detached, no-longer-visible node.
    const digitBtn = (i) => document.querySelectorAll('#numbo-kb-digits button')[i];
    digitBtn(0).click();
    document.querySelector('#numbo-keyboard [data-op="+"]').click();
    digitBtn(1).click();
    document.querySelector('#numbo-keyboard [data-op="+"]').click();
    digitBtn(2).click();
    document.querySelector('#numbo-keyboard [data-op="+"]').click();
    digitBtn(3).click();
    return {
      exprText: el('expr-input').value,
      allDisabled: Array.from(document.querySelectorAll('#numbo-kb-digits button')).every(b => b.disabled),
      backspaceDisabled: el('kb-backspace').disabled,
    };
  });
  assert.strictEqual(kbBuilt.allDisabled, true, 'all 4 digit buttons should be spent once every digit has been used');
  const kbSum = runInPage(dom, () => st.digits.reduce((a, b) => a + b, 0));
  const kbCheck = runInPage(dom, (val) => {
    el('value-input').value = String(val);
    el('check-btn').click();
    return { msg: el('compute-msg').textContent, phase: st.phase };
  }, kbSum);
  assert.strictEqual(kbCheck.msg, 'That checks out!', `the keyboard-built expression ("${kbBuilt.exprText}") should parse and evaluate correctly through the real Check flow`);
  assert.strictEqual(kbCheck.phase, 'bot-thinking', 'a correct keyboard-built submission should advance the phase exactly like a correct typed one used to');

  await sleep(700); // bot reveal delay (550ms) + buffer

  // The keyboard-built round just played above already resolved and scored
  // (human submitted the true sum, so human wins or ties) — capture that
  // as a baseline, since score persists across rounds within one match and
  // the NEXT round's own score assertion (below) needs to account for it,
  // not assume the match started fresh at this point.
  const scoreAfterKbRound = runInPage(dom, () => ({ ...st.score }));

  // Force a fresh round with the human active, rather than calling the
  // real startRound() and hoping nextActivePlayer's alternation happens to
  // land on human — deterministic setup for the rest of this test, which
  // assumes a human-set target. (This intentionally pokes state directly;
  // startRound()'s own alternation logic is already covered by the
  // round-flow assertions earlier in this file.)
  runInPage(dom, () => {
    st.activePlayer = 'human';
    st.target = null;
    st.digits = [];
    st.phase = 'set-target';
    st.humanResult = null;
    st.botResult = null;
    st.roundWinner = null;
    render();
  });
  runInPage(dom, () => {
    el('target-input').value = '30';
    el('target-confirm-btn').click();
  });

  /* ---------------- structural-error probe: concatenation ----------------
     A digit-usage/syntax problem is self-explanatory and must NOT count
     toward wrongAttempts (no hint mechanic for these — see CLAUDE.md's
     Numbo section for why this differs from every other game's single
     failure-mode retry gate). */
  const structuralProbe = runInPage(dom, () => {
    const before = st.wrongAttempts;
    el('expr-input').value = String(st.digits[0]) + String(st.digits[1]); // e.g. "37" — concatenation
    el('value-input').value = '999';
    el('check-btn').click();
    return { before, after: st.wrongAttempts, phase: st.phase, msg: el('compute-msg').textContent };
  });
  assert.strictEqual(structuralProbe.after, structuralProbe.before, 'a structural (syntax/digit-usage) error must NOT increment wrongAttempts');
  assert.strictEqual(structuralProbe.phase, 'awaiting-human-expr', 'a structural error should not advance the phase');
  assert.ok(structuralProbe.msg.length > 0, 'a specific error message should be shown');

  /* ---------------- value-mismatch probe: wrongAttempts + hint-at-2 ---------------- */
  const validExprForDigits = runInPage(dom, () => st.digits.map(String).join('+')); // digits joined with + is always valid
  const trueSum = runInPage(dom, () => st.digits.reduce((a, b) => a + b, 0));

  const wrong1 = runInPage(dom, (expr) => {
    el('expr-input').value = expr;
    el('value-input').value = '999999'; // deliberately wrong
    el('check-btn').click();
    return { wrongAttempts: st.wrongAttempts, hint: el('hint-line').textContent, phase: st.phase };
  }, validExprForDigits);
  assert.strictEqual(wrong1.wrongAttempts, 1);
  assert.strictEqual(wrong1.hint, '', 'no hint yet after 1 wrong attempt');
  assert.strictEqual(wrong1.phase, 'awaiting-human-expr');

  const wrong2 = runInPage(dom, (expr) => {
    el('expr-input').value = expr;
    el('value-input').value = '999998';
    el('check-btn').click();
    return { wrongAttempts: st.wrongAttempts, hint: el('hint-line').textContent };
  }, validExprForDigits);
  assert.strictEqual(wrong2.wrongAttempts, 2);
  assert.ok(/Hint:/.test(wrong2.hint), 'a hint revealing the expression\'s real value should appear after 2 wrong value attempts');

  /* ---------------- correct submission locks in and advances ---------------- */
  const correctProbe = runInPage(dom, (expr, val) => {
    el('expr-input').value = expr;
    el('value-input').value = String(val);
    el('check-btn').click();
    return { phase: st.phase, humanResultValue: st.humanResult ? st.humanResult.value : null };
  }, validExprForDigits, trueSum);
  assert.strictEqual(correctProbe.phase, 'bot-thinking', 'a correct submission should move to bot-thinking');
  assert.strictEqual(correctProbe.humanResultValue, trueSum, 'the locked-in human value should be the real evaluated value');

  await sleep(700); // bot reveal delay (550ms) + buffer

  state = runInPage(dom, () => ({
    phase: st.phase,
    roundWinner: st.roundWinner,
    botResultValue: st.botResult ? st.botResult.value : null,
    score: st.score,
    outcomeMsg: el('round-outcome-msg').textContent,
  }));
  assert.strictEqual(state.phase, 'round-result');
  assert.ok(state.botResultValue !== null, 'the bot should have revealed a result');
  assert.ok(['human', 'bot', 'tie'].includes(state.roundWinner));
  assert.ok(state.outcomeMsg.length > 0);
  // Score persists across the match — this round's own contribution adds
  // on top of whatever the earlier keyboard-probe round already scored
  // (see scoreAfterKbRound above), not a fresh 0-0 baseline.
  const expectedHumanScore = scoreAfterKbRound.human + (state.roundWinner === 'human' || state.roundWinner === 'tie' ? 1 : 0);
  const expectedBotScore = scoreAfterKbRound.bot + (state.roundWinner === 'bot' || state.roundWinner === 'tie' ? 1 : 0);
  assert.deepStrictEqual(state.score, { human: expectedHumanScore, bot: expectedBotScore }, 'applyRoundScore should match the real tie-scores-both rule');

  snap = runInPage(dom, snapshotPhaseBlocks);
  assert.strictEqual(snap['round-result'].hidden, false);
  assert.strictEqual(snap['next-round-wrap'].hidden, false, 'next-round button should be visible (match not over yet, assuming a single round never reaches 5)');
  assert.strictEqual(snap['target-setup-human'].hidden, true);
  assert.strictEqual(snap['target-setup-bot'].hidden, true);
  assert.strictEqual(snap['dice-expr-wrap'].hidden, true, 'dice/expr block should be hidden again once the round result is showing');

  /* ---------------- deterministic TIE probe ----------------
     Hard is a deterministic exhaustive search — the SAME digits+target
     always produce the SAME best value. Have the "human" type back
     exactly the bot's own optimal expression (via exprString on Hard's
     found tree) so both sides land on the identical value — a guaranteed,
     reproducible tie, not a chance occurrence. */
  runInPage(dom, () => { startRound(); });
  // Fast-forward through target-setting regardless of who's active this round.
  for (let i = 0; i < 20; i++) {
    const s = runInPage(dom, () => ({ phase: st.phase, activePlayer: st.activePlayer }));
    if (s.phase === 'awaiting-human-expr') break;
    if (s.phase === 'set-target' && s.activePlayer === 'human') {
      runInPage(dom, () => { el('target-input').value = '40'; el('target-confirm-btn').click(); });
      break;
    }
    await sleep(150);
  }
  for (let i = 0; i < 20; i++) {
    const s = runInPage(dom, () => st.phase);
    if (s === 'awaiting-human-expr') break;
    await sleep(150);
  }

  const tieSetup = runInPage(dom, () => {
    st.difficulty = 'hard'; // deterministic bot for this probe
    const best = botHard(st.digits, st.target);
    return { expr: exprString(best.tree), value: best.value };
  });
  runInPage(dom, (expr, val) => {
    el('expr-input').value = expr;
    el('value-input').value = String(val);
    el('check-btn').click();
  }, tieSetup.expr, tieSetup.value);

  await sleep(700);
  const tieResult = runInPage(dom, () => ({
    roundWinner: st.roundWinner,
    humanValue: st.humanResult.value,
    botValue: st.botResult.value,
    outcomeMsg: el('round-outcome-msg').textContent,
  }));
  assert.strictEqual(tieResult.roundWinner, 'tie', `expected a guaranteed tie (human typed back Hard's own optimal expression) — human=${tieResult.humanValue} bot=${tieResult.botValue}`);
  assert.ok(/[Tt]ied/.test(tieResult.outcomeMsg), 'the outcome message should say the round was tied');

  /* ---------------- real playthrough: human plays Hard-quality moves
     against an Easy bot, racing to 5 points. Handles both active-player
     cases (human types the target; bot picks its own after a short delay). ---------------- */
  runInPage(dom, () => { st.difficulty = 'easy'; startRound(); });

  async function playRound() {
    // Resolve target-setting first, whichever side is active.
    for (let i = 0; i < 20; i++) {
      const s = runInPage(dom, () => ({ phase: st.phase, activePlayer: st.activePlayer }));
      if (s.phase !== 'set-target') break;
      if (s.activePlayer === 'human') {
        runInPage(dom, () => { el('target-input').value = String(1 + Math.floor(Math.random() * 99)); el('target-confirm-btn').click(); });
        break;
      }
      await sleep(150); // bot is choosing its own target
    }
    for (let i = 0; i < 20; i++) {
      if (runInPage(dom, () => st.phase) !== 'set-target') break;
      await sleep(150);
    }
    // Submit the human's best achievable expression (Hard-quality), regardless
    // of the match's actual (Easy) bot difficulty setting.
    const best = runInPage(dom, () => {
      const b = botHard(st.digits, st.target);
      return { expr: exprString(b.tree), value: b.value };
    });
    runInPage(dom, (expr, val) => {
      el('expr-input').value = expr;
      el('value-input').value = String(val);
      el('check-btn').click();
    }, best.expr, best.value);
    await sleep(700);
    const afterReveal = runInPage(dom, () => ({ phase: st.phase, matchOver: st.matchOver }));
    if (!afterReveal.matchOver) {
      runInPage(dom, () => { el('next-round-btn').click(); });
    }
  }

  let rounds = 0;
  while (true) {
    const s = runInPage(dom, () => ({ matchOver: st.matchOver, score: st.score }));
    if (s.matchOver) break;
    if (rounds++ > 30) throw new Error(`match did not end within 30 rounds (score was ${JSON.stringify(s.score)}) — possible stall`);
    await playRound();
  }

  const midFlight = runInPage(dom, () => el('winner-banner').textContent);

  await sleep(1500); // typewriter (45ms/char) + 400ms flash buffer, generous

  const final = runInPage(dom, () => ({
    matchWinner: st.matchWinner,
    score: st.score,
    recomputed: matchWinnerFromScore(st.score),
    bannerText: el('winner-banner').textContent,
    endBtnHidden: el('end-btn-row').classList.contains('hidden'),
  }));
  assert.strictEqual(final.recomputed, final.matchWinner, 'st.matchWinner should match matchWinnerFromScore recomputed fresh from the final score');
  assert.ok(final.score.human >= 5 || final.score.bot >= 5, 'the match should have actually ended by someone reaching 5 points');
  assert.strictEqual(final.matchWinner, 'human', 'a Hard-quality human should reliably beat an Easy bot over a full race to 5 (matches the simulated win-rate gap)');
  assert.ok(midFlight.length < final.bannerText.length, `winner banner should have still been mid-typewriter right after matchOver (shorter than the final "${final.bannerText}"), got "${midFlight}"`);
  assert.ok(/win/i.test(final.bannerText));
  assert.strictEqual(final.endBtnHidden, false, 'Play again / Change settings should be visible once the match is over');

  console.log('  ✅ numbo-operations.html: full playthrough smoke test passed');
  console.log(`     structural-error / value-mismatch / hint-at-2 / deterministic-tie probes verified | final score human=${final.score.human} bot=${final.score.bot} | resolved in ${rounds} rounds`);
}

main().catch(e => {
  console.error('  ❌ numbo-operations.html smoke test FAILED:', e.message);
  console.error(e.stack);
  process.exitCode = 1;
});
