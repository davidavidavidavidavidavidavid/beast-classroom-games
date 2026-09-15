/*
 * jsdom full-playthrough smoke test for pop-perimeter.html.
 * Uses the "big" (2-digit sides) format, exercising the leading-zero-
 * under-uncertainty rule on the Length addend, and:
 *   - deterministically probes the leading-zero BLOCK rule via a real
 *     click on the real handler (not a reimplementation of the rule),
 *   - plays through all 6 rolls with real, sequential, irrevocable
 *     placements — including at least one deliberate throw-away,
 *   - completes the answer-check step (perimeter = 2×length + 2×width),
 *   - asserts the reveal screen's bust status and winner agree with what
 *     the page itself computed, using the COEFFICIENT-AWARE
 *     committedInsideSum (not a plain sum) — the one genuinely new thing
 *     this variant's engine needed, see CLAUDE.md's design note.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('pop-perimeter.html');

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
    document.querySelector('#format-row [data-format="big"]').click();
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
    insideCoeffs: st.insideCoeffs.slice(),
    throwaways: st.throwaways,
    totalBlanks: st.totalBlanks,
    target: st.target,
  }));
  assert.deepStrictEqual(cfg.insideLens, [2, 2], 'big format should set insideLens to [2,2]');
  assert.deepStrictEqual(cfg.insideCoeffs, [2, 2], 'both Length and Width should carry a ×2 coefficient (each side counts twice toward the perimeter)');
  assert.strictEqual(cfg.throwaways, 2, 'big format should have 2 throwaways');
  assert.strictEqual(cfg.totalBlanks, 6, 'big format should total 6 blanks (4 inside + 2 throwaway)');
  assert.strictEqual(cfg.target, 200, 'big format should default to target 200');

  // --- Deterministic probe of the leading-zero-under-uncertainty rule ---
  const blockProbe = runInPage(dom, () => {
    st.currentDigit = 0;
    const beforeMsg = el('msg').textContent;
    document.querySelectorAll('#human-inside .slot')[0].click(); // Length's leading blank
    return {
      msgAfter: el('msg').textContent,
      msgHadError: el('msg').classList.contains('error'),
      stillEmpty: st.human.inside[0][0] === null,
      beforeMsg,
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

      return { digit, kind: choice.kind };
    }, i === 0);
    placements.push(result);

    await sleep(isLast ? 700 : 1150);
  }

  assert.ok(placements.some(p => p.kind === 'throw'), 'the playthrough should include at least one throw-away placement');

  let filled;
  for (let waited = 0; waited < 2500; waited += 50) {
    filled = runInPage(dom, () => ({
      humanComplete: isComplete(st.human),
      botComplete: isComplete(st.bot),
      humanSum: committedInsideSum(st.human, st.insideLens, st.insideCoeffs),
    }));
    if (filled.humanComplete && filled.botComplete) break;
    await sleep(50);
  }
  assert.strictEqual(filled.humanComplete, true, 'all of the human blanks should be filled after totalBlanks rolls');
  assert.strictEqual(filled.botComplete, true, "all of the bot's blanks should be filled in lockstep (shared rolls)");

  // Independently verify the coefficient math itself: the committed sum
  // must equal 2×length + 2×width, not a plain (uncoefficiented) sum.
  const rawCheck = runInPage(dom, () => {
    const lengthVal = parseInt(st.human.inside[0].join(''), 10);
    const widthVal = parseInt(st.human.inside[1].join(''), 10);
    return { lengthVal, widthVal, committed: committedInsideSum(st.human, st.insideLens, st.insideCoeffs) };
  });
  assert.strictEqual(rawCheck.committed, 2 * rawCheck.lengthVal + 2 * rawCheck.widthVal, 'the committed sum must be 2×length + 2×width (coefficient-aware), not a plain sum of the two addends');

  // --- Compute (answer-check) screen ---
  runInPage(dom, (sum) => {
    el('answer-input').value = String(sum);
    el('check-btn').click();
  }, filled.humanSum);

  const computeMsg = runInPage(dom, () => el('compute-msg').textContent);
  assert.strictEqual(computeMsg, 'That checks out!', 'the correct perimeter should be accepted');

  runInPage(dom, () => { el('reveal-btn').click(); });

  const result = runInPage(dom, () => {
    const humanSum = st.finalHumanSum;
    const botSum = committedInsideSum(st.bot, st.insideLens, st.insideCoeffs);
    return {
      target: st.target,
      humanSum,
      botSum,
      humanBusted: humanSum > st.target,
      botBusted: botSum > st.target,
      shownHumanTotal: Number(el('human-total').textContent),
      shownBotTotal: Number(el('bot-total').textContent),
      humanStatusClass: el('human-status').className,
      botStatusClass: el('bot-status').className,
      banner: el('winner-banner').textContent,
      computedWinner: decideWinner(humanSum, humanSum > st.target, botSum, botSum > st.target, st.target),
    };
  });

  assert.strictEqual(result.shownHumanTotal, result.humanSum, 'displayed human total should match the actual committed perimeter');
  assert.strictEqual(result.shownBotTotal, result.botSum, "displayed bot total should match the bot's actual committed perimeter");
  assert.strictEqual(result.humanStatusClass, 'result-status ' + (result.humanBusted ? 'busted' : 'safe'), 'human status class should reflect bust vs safe correctly');
  assert.strictEqual(result.botStatusClass, 'result-status ' + (result.botBusted ? 'busted' : 'safe'), 'bot status class should reflect bust vs safe correctly');

  const bannerWinner = result.banner.includes('tie') || result.banner.includes('a tie')
    ? 'tie'
    : (result.banner.toLowerCase().includes('you win') ? 'human' : 'bot');
  assert.strictEqual(bannerWinner, result.computedWinner, "the banner shown should agree with decideWinner's verdict on the real sums/bust flags");

  console.log('  ✅ pop-perimeter.html: full playthrough smoke test passed');
  console.log(`     leading-zero block verified | throw-away used: yes | coefficient math verified (2×L+2×W) | target=${result.target} | human ${result.humanSum} (${result.humanBusted ? 'BUSTED' : 'safe'}) | bot ${result.botSum} (${result.botBusted ? 'BUSTED' : 'safe'}) | winner=${result.computedWinner}`);
}

main().catch(e => {
  console.error('  ❌ pop-perimeter.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
