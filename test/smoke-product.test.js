/*
 * jsdom full-playthrough smoke test for scuttle-product.html.
 * Actually clicks through the UI (roll, split digits into two numbers,
 * product-check, sum-check, reveal) and asserts the numbers shown on
 * screen match what the page itself computed.
 *
 * Runs a full 3-round match for all 4 formats x all 3 difficulties (12
 * combinations) — see CLAUDE.md "File structure & the point of it"
 * (shared-game.js): different formats feed different-shaped arrays
 * (st.slotsN1/st.slotsN2, humanProducts/botProducts) through the same
 * shared updateScorecard()/showScreen(), so a refactor bug specific to one
 * shape (e.g. d1===d2 vs d1!==d2, or a single-digit d2) wouldn't
 * necessarily show up testing only one combination.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

const FORMATS = ['2x1', '3x1', '4x1', '2x2'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Plays one full 3-round match for a given format/difficulty and returns
// the final result. `checkAvatarsAndScorecard` is only true for the very
// first combination — that behavior is independent of format/difficulty,
// so checking it 12 times would be redundant, not more thorough.
async function playFullMatch(format, difficulty, checkAvatarsAndScorecard) {
  const dom = loadGame('scuttle-product.html');

  if (checkAvatarsAndScorecard) {
    // showScreen(screens, name) now takes `screens` as a parameter (see
    // CLAUDE.md "File structure & the point of it" — shared-game.js)
    // instead of closing over a game-specific global; confirm the
    // persistent scorecard still hides on the settings screen exactly as
    // before.
    const scHiddenBeforeStart = runInPage(dom, () => document.getElementById('scorecard').classList.contains('hidden'));
    assert.strictEqual(scHiddenBeforeStart, true, 'the scorecard should be hidden while still on the settings screen');

    // Avatars (see CLAUDE.md "Avatars"): before touching anything, the
    // picker and every badge should already agree with the default state.
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

  for (let round = 1; round <= 3; round++) {
    runInPage(dom, () => { el('roll-btn').click(); });
    await sleep(650); // roll animation

    // Fill n1's slots then n2's slots (mirrors nextEmptySlot()'s own
    // order), never placing a 0 in a frame's leading slot unless forced —
    // mirrors placeDigit()'s constraint so no click is ever rejected. This
    // generalizes across every format's own d1/d2 shape since it reads
    // st.slotsN1/st.slotsN2's actual lengths, not a hardcoded 2x1 shape.
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
    const correctProduct = split.num1 * split.num2;

    if (checkAvatarsAndScorecard && round === 1) {
      // EXPERIMENTAL (see CLAUDE.md "Answer-explanation modal & stats-demo
      // experiment"): 2 wrong attempts now trigger a modal (area-model
      // visual + the real answer) instead of a plain-text hint, and its
      // "Continue" completes the round with the correct product. Only
      // probed once (first format/difficulty, round 1) — the mechanism
      // itself is format/difficulty-independent, so re-proving it in all
      // 12 combinations would be redundant, not more thorough (same
      // reasoning `checkAvatarsAndScorecard` above already uses).
      runInPage(dom, (product) => {
        el('product-answer-input').value = String(product + 100000);
        el('product-check-btn').click();
        el('product-answer-input').value = String(product + 200000);
        el('product-check-btn').click();
      }, correctProduct);

      // The answer itself (#explain-modal-answer) is shown in full THE
      // INSTANT the modal opens — never staged behind the animation.
      const modalState = runInPage(dom, () => {
        const backdrop = document.getElementById('explain-modal-backdrop');
        return {
          visible: !!backdrop && !backdrop.classList.contains('hidden'),
          answerHtml: backdrop ? document.getElementById('explain-modal-answer').innerHTML : null,
          gridRows: document.querySelectorAll('.area-model-grid tr').length,
          cellsMidFlight: document.getElementById('explain-modal-visual').textContent,
        };
      });
      assert.strictEqual(modalState.visible, true, 'after 2 wrong attempts, the answer-explanation modal should appear');
      assert.ok(modalState.answerHtml && modalState.answerHtml.includes(correctProduct.toLocaleString()), 'the modal should state the real correct product');
      assert.ok(modalState.gridRows >= 2, 'the area-model grid should have a header row plus at least one place-value row');
      // EXPERIMENTAL (see CLAUDE.md "Answer-explanation modal & stats-demo
      // experiment"): the grid now animates in (blank cells first, real
      // partial products a beat later) rather than dumping everything at
      // once — right after opening, the cells should still read "?".
      assert.ok(modalState.cellsMidFlight.includes('?'), 'right after the modal opens, the area-model grid should still be blank ("?" cells), not already solved');

      const beforeContinue = runInPage(dom, () => st.humanProducts.length);
      assert.strictEqual(beforeContinue, 0, 'the round should not auto-complete just from the modal appearing — only "Continue" should do that');

      // Let the reveal actually finish (2 frames x 350ms default = 700ms;
      // 1.5s clears that with room to spare) before confirming it settles
      // on the real, filled-in partial products and sum.
      await sleep(1500);
      const settled = runInPage(dom, () => document.getElementById('explain-modal-visual').textContent);
      assert.ok(!settled.includes('?'), 'once the reveal finishes, every cell should show a real partial product, not a "?" placeholder');
      assert.ok(settled.includes(correctProduct.toLocaleString()), 'the settled grid should show the real total, matching the answer stated above it');

      runInPage(dom, () => { document.getElementById('explain-modal-continue-btn').click(); });
    } else {
      runInPage(dom, (product) => {
        el('product-answer-input').value = String(product);
        el('product-check-btn').click();
      }, correctProduct);
    }

    const afterCheck = runInPage(dom, () => ({
      msg: el('product-msg').textContent,
      humanProducts: st.humanProducts.slice(),
      botProducts: st.botProducts.slice(),
      scorecardShown: !document.getElementById('sc-you-' + st.humanProducts.length).classList.contains('empty'),
    }));
    assert.strictEqual(afterCheck.msg, 'That checks out!', `[${format}/${difficulty}] round ${round}: the correct product should be accepted`);
    assert.strictEqual(afterCheck.humanProducts.length, round, `[${format}/${difficulty}] round ${round}: humanProducts should have ${round} entries`);
    assert.strictEqual(afterCheck.humanProducts[round - 1], correctProduct, `[${format}/${difficulty}] round ${round}: locked-in product should match the digits actually placed (${split.num1} × ${split.num2})`);
    assert.strictEqual(afterCheck.botProducts.length, round, `[${format}/${difficulty}] round ${round}: botProducts should have ${round} entries`);
    assert.strictEqual(afterCheck.scorecardShown, true, `[${format}/${difficulty}] round ${round}: updateScorecard(humanValues, botValues, formatFn) should have filled in the scorecard row`);

    if (round < 3) {
      runInPage(dom, () => { el('next-round-btn').click(); });
    } else {
      await sleep(650); // setTimeout(goToSum, 500)
    }
  }

  // Sum screen: answer with the actual sum of the three round products.
  const correctSum = runInPage(dom, () => st.humanProducts.reduce((a, b) => a + b, 0));
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

  // The win-visual reveal (typewriter banner + count-up totals, see CLAUDE.md
  // "Celebration animations") is asynchronous — right after the click, it
  // should still be mid-flight, not already showing final values. Proves
  // this is really animated, not silently short-circuited to instant.
  const midFlight = runInPage(dom, () => ({
    humanTotalText: el('human-total').textContent,
    bannerText: el('winner-banner').textContent,
  }));
  assert.strictEqual(midFlight.humanTotalText, preReveal.humanTotalText, `[${format}/${difficulty}] human total should not have jumped to its final value in the same tick as the reveal click`);
  assert.strictEqual(midFlight.bannerText, '', `[${format}/${difficulty}] winner banner should be cleared (typewriter not yet started ticking) immediately after the reveal click`);

  // Typewriter is 45ms/char + a 400ms flash buffer, count-up is a fixed
  // 650ms — 2s comfortably clears both for every possible banner string.
  await sleep(2000);

  const result = runInPage(dom, () => ({
    target: st.target,
    finalHumanSum: st.finalHumanSum,
    finalBotSum: st.finalBotSum,
    shownHumanTotal: Number(el('human-total').textContent.replace(/,/g, '')),
    shownBotTotal: Number(el('bot-total').textContent.replace(/,/g, '')),
    humanStatusText: el('human-status').textContent,
    humanStatusClass: el('human-status').className,
    botStatusText: el('bot-status').textContent,
    botStatusClass: el('bot-status').className,
    banner: el('winner-banner').textContent,
    // decideWinner is the same pure function the reveal handler calls.
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
      console.log(`  ✅ scuttle-product.html [${format}(${r.d1}x${r.d2})/${difficulty}]: full playthrough passed | target=${r.target} | human ${r.finalHumanSum} (${r.humanOver ? 'over' : 'under'}) | bot ${r.finalBotSum} (${r.botOver ? 'over' : 'under'}) | winner=${r.computedWinner}`);
    }
  }
  console.log('  ✅ scuttle-product.html: all 4 formats × 3 difficulties (12 combinations) passed');
}

main().catch(e => {
  console.error('  ❌ scuttle-product.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
