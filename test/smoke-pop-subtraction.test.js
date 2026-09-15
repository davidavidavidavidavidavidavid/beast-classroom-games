/*
 * jsdom full-playthrough smoke test for pop-subtraction.html.
 * Uses the 2-2 format (two leading inside-blanks, and the format whose
 * difference can go negative — the case that actually exercises the
 * signed place-value generalization) and:
 *   - deterministically probes the leading-zero BLOCK rule via a real
 *     click on the real handler,
 *   - plays through all 6 rolls with real, sequential, irrevocable
 *     placements — including at least one deliberate throw-away,
 *   - completes the answer-check step (accepting a possibly-negative
 *     correct answer),
 *   - asserts the reveal screen's bust status and winner agree with
 *     what the page itself computed.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('pop-subtraction.html');

  // Avatars (see CLAUDE.md "Avatars"): before touching anything, the picker
  // and every badge should already agree with the default state — st.avatar
  // selected in the picker, and the bot badge matching the default (medium)
  // difficulty. This game has no persistent #scorecard (see CLAUDE.md's
  // Pop/Beeline design note), so snapshotAvatarState's scYouBadge/
  // scBotBadge correctly come back null here — not asserted on.
  const defaults = snapshotAvatarState(dom);
  assert.strictEqual(defaults.pickerSelected, defaults.avatar, 'the avatar picker should mark st.avatar\'s slot as .selected by default');
  assert.strictEqual(defaults.youBadge, `avatars/${defaults.avatar}.png`, 'top-bar "you" badge should point at st.avatar\'s image');
  assert.strictEqual(defaults.botBadge, `avatars/bot-${defaults.difficulty}.png`, 'top-bar bot badge should point at the difficulty-mapped bot avatar');

  runInPage(dom, () => {
    document.querySelector('#format-row [data-format="2-2"]').click();
    document.querySelector('#avatar-row [data-avatar="cammy"]').click();
    document.querySelector('#diff-row [data-diff="hard"]').click();
    el('start-btn').click();
  });

  // The avatar pick and the difficulty switch are independent: only the
  // "you" badge should follow the avatar pick, only the bot badge should
  // follow the difficulty.
  const afterPick = snapshotAvatarState(dom);
  assert.strictEqual(afterPick.avatar, 'cammy', 'clicking an avatar slot should update st.avatar');
  assert.strictEqual(afterPick.pickerSelected, 'cammy', 'the clicked slot should become the (only) .selected one');
  assert.strictEqual(afterPick.youBadge, 'avatars/cammy.png', 'top-bar "you" badge should update to the newly picked avatar');
  assert.strictEqual(afterPick.botBadge, 'avatars/bot-hard.png', 'bot badge should swap to the hard-tier avatar once difficulty changes to hard, independent of the avatar pick');

  const cfg = runInPage(dom, () => ({
    insideLens: st.insideLens.slice(),
    insideSigns: st.insideSigns.slice(),
    throwaways: st.throwaways,
    totalBlanks: st.totalBlanks,
    target: st.target,
  }));
  assert.deepStrictEqual(cfg.insideLens, [2, 2], '2-2 format should set insideLens to [2,2]');
  assert.deepStrictEqual(cfg.insideSigns, [1, -1], '2-2 format should set insideSigns to [+1,-1] (minuend, subtrahend)');
  assert.strictEqual(cfg.throwaways, 2, '2-2 format should have 2 throwaways');
  assert.strictEqual(cfg.totalBlanks, 6, '2-2 format should total 6 blanks (4 inside + 2 throwaway)');
  assert.strictEqual(cfg.target, 40, '2-2 format should default to target 40');

  // --- Deterministic probe of the leading-zero-under-uncertainty rule ---
  const blockProbe = runInPage(dom, () => {
    st.currentDigit = 0;
    document.querySelectorAll('#human-inside .slot')[0].click(); // addend0 (minuend), idx0 — the leading blank
    return {
      msgAfter: el('msg').textContent,
      msgHadError: el('msg').classList.contains('error'),
      stillEmpty: st.human.inside[0][0] === null,
    };
  });
  assert.strictEqual(blockProbe.stillEmpty, true, 'a rolled 0 must NOT be placeable in the leading blank while other blanks remain open');
  assert.ok(blockProbe.msgAfter.length > 0, 'rejecting the click should show an explanatory message');
  assert.strictEqual(blockProbe.msgHadError, true, 'the rejection message should carry the .error modifier');

  runInPage(dom, () => { st.currentDigit = null; flashMsg('', false); });

  // --- Real playthrough: sequential, irrevocable placement across all 6 rolls ---
  runInPage(dom, () => { el('roll-btn').click(); });
  await sleep(700);

  const placements = [];
  for (let i = 0; i < cfg.totalBlanks; i++) {
    const isLast = i === cfg.totalBlanks - 1;

    // Who places first alternates every roll (st.rollFirst — see CLAUDE.md's
    // Pop redesign note) — poll for the digit actually being ready rather
    // than assume a fixed sleep always covered a human-first roll's extra
    // ~450ms "bot is thinking" beat. See pop-addition's identical comment.
    for (let waited = 0; waited < 2500; waited += 50) {
      const ready = runInPage(dom, () => st.currentDigit !== null);
      if (ready) break;
      await sleep(50);
    }

    const result = runInPage(dom, (isFirst) => {
      const digit = st.currentDigit;
      const legal = legalTargets(digit, st.human, st.insideLens);
      const insideLegal = legal.filter(p => p.kind === 'inside');
      const throwLegal = legal.filter(p => p.kind === 'throw');

      let choice;
      if (isFirst && throwLegal.length > 0) choice = throwLegal[0];
      else if (insideLegal.length > 0) choice = insideLegal[0];
      else choice = throwLegal[0];

      let flatIndex, groupId;
      if (choice.kind === 'inside') {
        flatIndex = st.insideLens.slice(0, choice.addend).reduce((a, b) => a + b, 0) + choice.idx;
        groupId = 'human-inside';
      } else {
        flatIndex = choice.idx;
        groupId = 'human-throw';
      }
      document.querySelectorAll('#' + groupId + ' .slot')[flatIndex].click();

      return { digit, kind: choice.kind, addend: choice.addend };
    }, i === 0);
    placements.push(result);

    await sleep(isLast ? 700 : 1150);
  }

  assert.ok(placements.some(p => p.kind === 'throw'), 'the playthrough should include at least one throw-away placement');
  assert.ok(placements.some(p => p.kind === 'inside' && p.addend === 0), 'the minuend should receive at least one digit');
  assert.ok(placements.some(p => p.kind === 'inside' && p.addend === 1), 'the subtrahend should receive at least one digit');

  let filled;
  for (let waited = 0; waited < 2500; waited += 50) {
    filled = runInPage(dom, () => ({
      humanComplete: isComplete(st.human),
      botComplete: isComplete(st.bot),
      humanSum: committedInsideSum(st.human, st.insideLens, st.insideSigns),
      minuend: parseInt(st.human.inside[0].join(''), 10),
      subtrahend: parseInt(st.human.inside[1].join(''), 10),
    }));
    if (filled.humanComplete && filled.botComplete) break;
    await sleep(50);
  }
  assert.strictEqual(filled.humanComplete, true, 'all of the human blanks should be filled after totalBlanks rolls');
  assert.strictEqual(filled.botComplete, true, "all of the bot's blanks should be filled in lockstep (shared rolls)");
  assert.strictEqual(filled.humanSum, filled.minuend - filled.subtrahend, 'committedInsideSum should equal minuend - subtrahend exactly (checks the signed place-value math, not just that some number appeared)');

  // --- Compute (answer-check) screen — the correct answer may be negative ---
  runInPage(dom, (sum) => {
    el('answer-input').value = String(sum);
    el('check-btn').click();
  }, filled.humanSum);

  const computeMsg = runInPage(dom, () => el('compute-msg').textContent);
  assert.strictEqual(computeMsg, 'That checks out!', 'the correct (possibly negative) inside difference should be accepted');

  runInPage(dom, () => { el('reveal-btn').click(); });

  const result = runInPage(dom, () => {
    const humanSum = st.finalHumanSum;
    const botSum = committedInsideSum(st.bot, st.insideLens, st.insideSigns);
    // isBusted (real page function) covers both bust causes: over target,
    // or the difference itself coming out negative.
    const humanBusted = isBusted(humanSum, st.target);
    const botBusted = isBusted(botSum, st.target);
    return {
      target: st.target,
      humanSum,
      botSum,
      humanBusted,
      botBusted,
      shownHumanTotalText: el('human-total').textContent,
      shownBotTotalText: el('bot-total').textContent,
      humanStatusClass: el('human-status').className,
      botStatusClass: el('bot-status').className,
      banner: el('winner-banner').textContent,
      computedWinner: decideWinner(humanSum, humanBusted, botSum, botBusted, st.target),
    };
  });

  // A negative inside difference is never shown as a raw number — real
  // playtesting feedback said a bare negative reads as broken, not a bust
  // (see CLAUDE.md's Pop redesign note and displaySum() in the page itself)
  // — `.result-total` shows the "No score" placeholder instead whenever the
  // real committed sum is negative, and the real number otherwise.
  const expectedHumanText = result.humanSum < 0 ? 'No score' : String(result.humanSum);
  const expectedBotText = result.botSum < 0 ? 'No score' : String(result.botSum);
  assert.strictEqual(result.shownHumanTotalText, expectedHumanText, 'displayed human total should be "No score" for a negative sum, or the real sum otherwise — never a bare negative number');
  assert.strictEqual(result.shownBotTotalText, expectedBotText, 'displayed bot total should be "No score" for a negative sum, or the real sum otherwise — never a bare negative number');
  assert.strictEqual(result.humanStatusClass, 'result-status ' + (result.humanBusted ? 'busted' : 'safe'), 'human status class should reflect bust vs safe correctly');
  assert.strictEqual(result.botStatusClass, 'result-status ' + (result.botBusted ? 'busted' : 'safe'), 'bot status class should reflect bust vs safe correctly');

  const bannerWinner = result.banner.includes('tie') || result.banner.includes('a tie')
    ? 'tie'
    : (result.banner.toLowerCase().includes('you win') ? 'human' : 'bot');
  assert.strictEqual(bannerWinner, result.computedWinner, "the banner shown should agree with decideWinner's verdict on the real sums/bust flags");

  // --- Deterministic probe of the negative-difference bust rule ---
  // The real playthrough above may or may not happen to land on a
  // negative sum, so this checks isBusted/statusText/decideWinner
  // directly against synthetic values, exercising the real page
  // functions rather than reimplementing the rule.
  const negProbe = runInPage(dom, () => ({
    negativeIsBusted: isBusted(-5, st.target),
    zeroIsSafe: isBusted(0, st.target),
    overIsBusted: isBusted(st.target + 1, st.target),
    onTargetIsSafe: isBusted(st.target, st.target),
    negativeStatusText: statusText(-5, st.target),
    negativeBeatsNothing: decideWinner(-5, isBusted(-5, st.target), 10, isBusted(10, st.target), st.target),
    negativeDisplay: displaySum(-5),
    zeroDisplay: displaySum(0),
    positiveDisplay: displaySum(42),
  }));
  assert.strictEqual(negProbe.negativeIsBusted, true, 'a negative difference must be busted, per the real rules (not just "far below target")');
  assert.strictEqual(negProbe.zeroIsSafe, false, 'exactly zero is not negative and not over target — should be safe');
  assert.strictEqual(negProbe.overIsBusted, true, 'exceeding target should still bust, same as before this fix');
  assert.strictEqual(negProbe.onTargetIsSafe, false, 'landing exactly on target should still be safe');
  assert.strictEqual(negProbe.negativeStatusText, 'Popped — negative difference!', 'the status text should name the actual cause, not describe it as merely "under" target');
  assert.strictEqual(negProbe.negativeBeatsNothing, 'bot', 'a busted negative sum must lose outright to any safe sum, regardless of numeric distance to target');
  assert.strictEqual(negProbe.negativeDisplay, 'No score', 'displaySum should never show a bare negative number — real playtesting feedback found that confusing');
  assert.strictEqual(negProbe.zeroDisplay, 0, 'displaySum should show 0 as a real number, not the "No score" placeholder — zero is a safe, valid result');
  assert.strictEqual(negProbe.positiveDisplay, 42, 'displaySum should pass a non-negative sum through unchanged');

  console.log('  ✅ pop-subtraction.html: full playthrough smoke test passed');
  console.log(`     leading-zero block verified | throw-away used: yes | minuend-subtrahend math verified | target=${result.target} | human ${result.humanSum} (${result.humanBusted ? 'BUSTED' : 'safe'}) | bot ${result.botSum} (${result.botBusted ? 'BUSTED' : 'safe'}) | winner=${result.computedWinner}`);
}

main().catch(e => {
  console.error('  ❌ pop-subtraction.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
