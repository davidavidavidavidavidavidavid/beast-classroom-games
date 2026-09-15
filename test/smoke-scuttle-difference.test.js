/*
 * jsdom full-playthrough smoke test for scuttle-difference.html.
 * Actually clicks through the UI (roll, split digits into two numbers,
 * difference-check, sum-check, reveal) and asserts the numbers shown on
 * screen match what the page itself computed.
 *
 * Runs a full 3-round match for both formats x all 3 difficulties (6
 * combinations) — mirrors test/smoke-product.test.js's own format x
 * difficulty sweep (see CLAUDE.md "File structure & the point of it").
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

const FORMATS = ['2digit', '3digit'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

async function playFullMatch(format, difficulty, checkAvatarsAndScorecard) {
  const dom = loadGame('scuttle-difference.html');

  if (checkAvatarsAndScorecard) {
    const scHiddenBeforeStart = runInPage(dom, () => document.getElementById('scorecard').classList.contains('hidden'));
    assert.strictEqual(scHiddenBeforeStart, true, 'the scorecard should be hidden while still on the settings screen');

    const defaults = snapshotAvatarState(dom);
    assert.strictEqual(defaults.pickerSelected, defaults.avatar, 'the avatar picker should mark st.avatar\'s slot as .selected by default');
    assert.strictEqual(defaults.youBadge, `avatars/${defaults.avatar}.png`, 'top-bar "you" badge should point at st.avatar\'s image');
    assert.strictEqual(defaults.scYouBadge, defaults.youBadge, 'scoreboard-header "you" badge should match the top-bar one');
    assert.strictEqual(defaults.botBadge, `avatars/bot-${defaults.difficulty}.png`, 'top-bar bot badge should point at the difficulty-mapped bot avatar');
    assert.strictEqual(defaults.scBotBadge, defaults.botBadge, 'scoreboard-header bot badge should match the top-bar one');
  }

  runInPage(dom, (fmt, diff) => {
    document.querySelector('#avatar-row [data-avatar="cammy"]').click();
    document.querySelector(`#format-row [data-format="${fmt}"]`).click();
    document.querySelector(`#diff-row [data-diff="${diff}"]`).click();
    el('start-btn').click();
  }, format, difficulty);

  if (checkAvatarsAndScorecard) {
    const scHiddenAfterStart = runInPage(dom, () => document.getElementById('scorecard').classList.contains('hidden'));
    assert.strictEqual(scHiddenAfterStart, false, 'the scorecard should become visible once a match starts (round screen)');

    const afterPick = snapshotAvatarState(dom);
    assert.strictEqual(afterPick.avatar, 'cammy', 'clicking an avatar slot should update st.avatar');
    assert.strictEqual(afterPick.pickerSelected, 'cammy', 'the clicked slot should become the (only) .selected one');
    assert.strictEqual(afterPick.youBadge, 'avatars/cammy.png', 'top-bar "you" badge should update to the newly picked avatar');
    assert.strictEqual(afterPick.scYouBadge, afterPick.youBadge, 'scoreboard-header "you" badge should update too');
    assert.strictEqual(afterPick.botBadge, `avatars/bot-${difficulty}.png`, 'bot badges should swap to the chosen tier\'s avatar, independent of the avatar pick');
    assert.strictEqual(afterPick.scBotBadge, afterPick.botBadge, 'scoreboard-header bot badge should match the top-bar one');
  }

  const cfg = runInPage(dom, () => ({ d1: st.slotsN1.length, d2: st.slotsN2.length, target: st.target }));

  // Layout-stability probe (CLAUDE.md "Layout stability" / Testing
  // methodology point 5) — same phase-content ids as Product Scuttle's own
  // dedicated check in test/layout-stability.test.js (this file reuses that
  // exact .phase-hidden engine unchanged, just swapping product-check-wrap
  // for diff-check-wrap) — checked once, on the first combination only,
  // since the mechanism itself doesn't vary by format/difficulty.
  const PHASE_IDS = ['roll-btn-wrap', 'dice-row', 'frames-wrap', 'diff-check-wrap', 'next-round-wrap'];
  // `ids` is passed in explicitly (not closed over) since runInPage
  // serializes this function's source and re-runs it inside the page's own
  // realm — see test/jsdom-helpers.js's runInPage and CLAUDE.md Known Traps.
  function snapshotPhase(ids) {
    const out = {};
    ids.forEach(id => {
      const cl = document.getElementById(id).classList;
      out[id] = { hidden: cl.contains('hidden'), phaseHidden: cl.contains('phase-hidden') };
    });
    return out;
  }
  function assertNeverHidden(snap, where) {
    PHASE_IDS.forEach(id => {
      assert.strictEqual(snap[id].hidden, false, `[${format}/${difficulty}] ${where}: #${id} should never carry .hidden — layout space must stay reserved`);
    });
  }

  for (let round = 1; round <= 3; round++) {
    if (checkAvatarsAndScorecard) {
      const before = runInPage(dom, snapshotPhase, PHASE_IDS);
      assertNeverHidden(before, `round ${round} before rolling`);
      assert.strictEqual(before['roll-btn-wrap'].phaseHidden, false, `round ${round}: roll button should be visible before rolling`);
      assert.strictEqual(before['dice-row'].phaseHidden, true, `round ${round}: dice row should be reserved-but-invisible before rolling`);
      assert.strictEqual(before['frames-wrap'].phaseHidden, true, `round ${round}: number frames should be reserved-but-invisible before rolling`);
    }

    runInPage(dom, () => { el('roll-btn').click(); });
    await sleep(650); // roll animation

    if (checkAvatarsAndScorecard) {
      const afterRoll = runInPage(dom, snapshotPhase, PHASE_IDS);
      assertNeverHidden(afterRoll, `round ${round} after rolling`);
      assert.strictEqual(afterRoll['roll-btn-wrap'].phaseHidden, true, `round ${round}: roll button should be reserved-but-invisible once rolled`);
      assert.strictEqual(afterRoll['dice-row'].phaseHidden, false, `round ${round}: dice row should be visible after rolling`);
      assert.strictEqual(afterRoll['frames-wrap'].phaseHidden, false, `round ${round}: number frames should be visible after rolling`);
      assert.strictEqual(afterRoll['diff-check-wrap'].phaseHidden, true, `round ${round}: answer-check row should be reserved-but-invisible until both frames are full`);
    }

    // Fill n1's slots then n2's slots (mirrors nextEmptySlot()'s own
    // order), never placing a 0 in a frame's leading slot unless forced.
    runInPage(dom, () => {
      function unusedIndices() {
        return st.roll.map((_, i) => i).filter(i => !st.slotsN1.includes(i) && !st.slotsN2.includes(i));
      }
      function clickRollIndex(rollIdx) {
        const remaining = unusedIndices().sort((a, b) => a - b);
        const pos = remaining.indexOf(rollIdx);
        document.querySelectorAll('#dice-row .die-wrap.pickable')[pos].click();
      }
      const totalDice = st.roll.length;
      for (let step = 0; step < totalDice; step++) {
        const remaining = unusedIndices();
        const n1Idx = st.slotsN1.findIndex(s => s === null);
        const inN1 = n1Idx !== -1;
        const slotIdx = inN1 ? n1Idx : st.slotsN2.findIndex(s => s === null);
        const frameLen = inN1 ? st.slotsN1.length : st.slotsN2.length;
        let choice;
        if (slotIdx === 0 && frameLen > 1) {
          const nonZero = remaining.find(i => st.roll[i] !== 0);
          choice = nonZero !== undefined ? nonZero : remaining[0];
        } else {
          choice = remaining[0];
        }
        clickRollIndex(choice);
      }
    });

    const split = runInPage(dom, () => ({
      num1: buildNumber(st.roll, st.slotsN1),
      num2: buildNumber(st.roll, st.slotsN2),
    }));
    const correctDiff = Math.abs(split.num1 - split.num2);

    runInPage(dom, (diff) => {
      el('diff-answer-input').value = String(diff);
      el('diff-check-btn').click();
    }, correctDiff);

    const afterCheck = runInPage(dom, () => ({
      msg: el('diff-msg').textContent,
      humanDiffs: st.humanDiffs.slice(),
      botDiffs: st.botDiffs.slice(),
      scorecardShown: !document.getElementById('sc-you-' + st.humanDiffs.length).classList.contains('empty'),
    }));
    assert.strictEqual(afterCheck.msg, 'That checks out!', `[${format}/${difficulty}] round ${round}: the correct difference should be accepted`);
    assert.strictEqual(afterCheck.humanDiffs.length, round, `[${format}/${difficulty}] round ${round}: humanDiffs should have ${round} entries`);
    assert.strictEqual(afterCheck.humanDiffs[round - 1], correctDiff, `[${format}/${difficulty}] round ${round}: locked-in difference should match the digits actually placed (|${split.num1} - ${split.num2}|)`);
    assert.strictEqual(afterCheck.botDiffs.length, round, `[${format}/${difficulty}] round ${round}: botDiffs should have ${round} entries`);
    assert.strictEqual(afterCheck.scorecardShown, true, `[${format}/${difficulty}] round ${round}: updateScorecard should have filled in the scorecard row`);

    if (checkAvatarsAndScorecard) {
      const afterLock = runInPage(dom, snapshotPhase, PHASE_IDS);
      assertNeverHidden(afterLock, `round ${round} after locking in`);
      assert.strictEqual(afterLock['dice-row'].phaseHidden, true, `round ${round}: dice row should be reserved-but-invisible after locking in`);
      assert.strictEqual(afterLock['frames-wrap'].phaseHidden, true, `round ${round}: number frames should be reserved-but-invisible after locking in`);
      assert.strictEqual(afterLock['diff-check-wrap'].phaseHidden, true, `round ${round}: answer-check row should be reserved-but-invisible after locking in`);
      assert.strictEqual(afterLock['next-round-wrap'].phaseHidden, round === 3, `round ${round}: next-round button visibility should match whether the match just ended`);
    }

    if (round < 3) {
      runInPage(dom, () => { el('next-round-btn').click(); });
    } else {
      await sleep(650); // setTimeout(goToSum, 500)
    }
  }

  const correctSum = runInPage(dom, () => st.humanDiffs.reduce((a, b) => a + b, 0));
  runInPage(dom, (sum) => {
    el('sum-answer-input').value = String(sum);
    el('sum-check-btn').click();
  }, correctSum);

  const sumMsg = runInPage(dom, () => el('sum-msg').textContent);
  assert.strictEqual(sumMsg, 'That checks out!', `[${format}/${difficulty}] the correct sum should be accepted`);

  const preReveal = runInPage(dom, () => ({
    humanTotalText: el('human-total').textContent,
    bannerText: el('winner-banner').textContent,
  }));

  runInPage(dom, () => { el('sum-reveal-btn').click(); });

  const midFlight = runInPage(dom, () => ({
    humanTotalText: el('human-total').textContent,
    bannerText: el('winner-banner').textContent,
  }));
  assert.strictEqual(midFlight.humanTotalText, preReveal.humanTotalText, `[${format}/${difficulty}] human total should not have jumped to its final value in the same tick as the reveal click`);
  assert.strictEqual(midFlight.bannerText, '', `[${format}/${difficulty}] winner banner should be cleared (typewriter not yet started ticking) immediately after the reveal click`);

  await sleep(2000);

  const result = runInPage(dom, () => ({
    target: st.target,
    finalHumanSum: st.finalHumanSum,
    finalBotSum: st.finalBotSum,
    shownHumanTotal: Number(el('human-total').textContent),
    shownBotTotal: Number(el('bot-total').textContent),
    humanStatusText: el('human-status').textContent,
    humanStatusClass: el('human-status').className,
    botStatusText: el('bot-status').textContent,
    botStatusClass: el('bot-status').className,
    banner: el('winner-banner').textContent,
    computedWinner: decideWinner(st.finalHumanSum, st.finalBotSum, st.target),
  }));

  assert.strictEqual(result.shownHumanTotal, result.finalHumanSum, `[${format}/${difficulty}] displayed human total should match st.finalHumanSum`);
  assert.strictEqual(result.shownBotTotal, result.finalBotSum, `[${format}/${difficulty}] displayed bot total should match st.finalBotSum`);

  const humanOver = result.finalHumanSum > result.target;
  const botOver = result.finalBotSum > result.target;
  assert.strictEqual(result.humanStatusText, humanOver ? 'Over the minimum' : 'Under the minimum', `[${format}/${difficulty}] human over/under label should match finalHumanSum vs target`);
  assert.strictEqual(result.humanStatusClass, 'result-status ' + (humanOver ? 'over' : 'under'), `[${format}/${difficulty}] human status class should match finalHumanSum vs target`);
  assert.strictEqual(result.botStatusText, botOver ? 'Over the minimum' : 'Under the minimum', `[${format}/${difficulty}] bot over/under label should match finalBotSum vs target`);
  assert.strictEqual(result.botStatusClass, 'result-status ' + (botOver ? 'over' : 'under'), `[${format}/${difficulty}] bot status class should match finalBotSum vs target`);

  const bannerWinner = result.banner.includes('tie') ? 'tie'
    : result.banner.startsWith('You win') ? 'human'
    : 'bot';
  assert.strictEqual(bannerWinner, result.computedWinner, `[${format}/${difficulty}] the banner shown should agree with decideWinner's verdict on the same sums`);

  if (checkAvatarsAndScorecard) {
    runInPage(dom, () => { el('change-settings-btn').click(); });
    const scHiddenAfterReturnToSettings = runInPage(dom, () => document.getElementById('scorecard').classList.contains('hidden'));
    assert.strictEqual(scHiddenAfterReturnToSettings, true, 'the scorecard should hide again after returning to settings from the reveal screen');
  }

  return { ...result, format, difficulty, d1: cfg.d1, d2: cfg.d2, humanOver, botOver };
}

async function main() {
  let first = true;
  for (const format of FORMATS) {
    for (const difficulty of DIFFICULTIES) {
      const r = await playFullMatch(format, difficulty, first);
      first = false;
      console.log(`  ✅ scuttle-difference.html [${format}(${r.d1}x${r.d2})/${difficulty}]: full playthrough passed | target=${r.target} | human ${r.finalHumanSum} (${r.humanOver ? 'over' : 'under'}) | bot ${r.finalBotSum} (${r.botOver ? 'over' : 'under'}) | winner=${r.computedWinner}`);
    }
  }
  console.log('  ✅ scuttle-difference.html: both formats × 3 difficulties (6 combinations) passed');
}

main().catch(e => {
  console.error('  ❌ scuttle-difference.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
