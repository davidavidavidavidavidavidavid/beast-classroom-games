/*
 * jsdom full-playthrough smoke test for scuttle-product.html.
 * Actually clicks through the UI (roll, split digits into two numbers,
 * product-check, sum-check, reveal) and asserts the numbers shown on
 * screen match what the page itself computed.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('scuttle-product.html');

  // 2x2 format (richer split: two 2-digit numbers from 4 dice, so the
  // leading-zero guard gets exercised on *both* frames) + hard bot.
  runInPage(dom, () => {
    document.querySelector('#format-row [data-format="2x2"]').click();
    document.querySelector('#diff-row [data-diff="hard"]').click();
    el('start-btn').click();
  });

  for (let round = 1; round <= 3; round++) {
    runInPage(dom, () => { el('roll-btn').click(); });
    await sleep(650); // roll animation

    // Fill n1's slots then n2's slots (mirrors nextEmptySlot()'s own
    // order), never placing a 0 in a frame's leading slot unless forced —
    // mirrors placeDigit()'s constraint so no click is ever rejected.
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

    runInPage(dom, (product) => {
      el('product-answer-input').value = String(product);
      el('product-check-btn').click();
    }, correctProduct);

    const afterCheck = runInPage(dom, () => ({
      msg: el('product-msg').textContent,
      humanProducts: st.humanProducts.slice(),
      botProducts: st.botProducts.slice(),
    }));
    assert.strictEqual(afterCheck.msg, 'That checks out!', `round ${round}: the correct product should be accepted`);
    assert.strictEqual(afterCheck.humanProducts.length, round, `round ${round}: humanProducts should have ${round} entries`);
    assert.strictEqual(afterCheck.humanProducts[round - 1], correctProduct, `round ${round}: locked-in product should match the digits actually placed (${split.num1} × ${split.num2})`);
    assert.strictEqual(afterCheck.botProducts.length, round, `round ${round}: botProducts should have ${round} entries`);

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
  assert.strictEqual(sumMsg, 'That checks out!', 'the correct sum should be accepted');

  runInPage(dom, () => { el('sum-reveal-btn').click(); });

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

  assert.strictEqual(result.shownHumanTotal, result.finalHumanSum, 'displayed human total should match st.finalHumanSum');
  assert.strictEqual(result.shownBotTotal, result.finalBotSum, 'displayed bot total should match st.finalBotSum');

  const humanOver = result.finalHumanSum > result.target;
  const botOver = result.finalBotSum > result.target;
  assert.strictEqual(result.humanStatusText, humanOver ? 'Over the minimum' : 'Under the minimum', 'human over/under label should match finalHumanSum vs target');
  assert.strictEqual(result.humanStatusClass, 'result-status ' + (humanOver ? 'over' : 'under'), 'human status class should match finalHumanSum vs target');
  assert.strictEqual(result.botStatusText, botOver ? 'Over the minimum' : 'Under the minimum', 'bot over/under label should match finalBotSum vs target');
  assert.strictEqual(result.botStatusClass, 'result-status ' + (botOver ? 'over' : 'under'), 'bot status class should match finalBotSum vs target');

  const bannerWinner = result.banner.includes('tie') ? 'tie'
    : result.banner.startsWith('You win') ? 'human'
    : 'bot';
  assert.strictEqual(bannerWinner, result.computedWinner, "the banner shown should agree with decideWinner's verdict on the same sums");

  console.log('  ✅ scuttle-product.html: full playthrough smoke test passed');
  console.log(`     target=${result.target} | human ${result.finalHumanSum} (${humanOver ? 'over' : 'under'}) | bot ${result.finalBotSum} (${botOver ? 'over' : 'under'}) | winner=${result.computedWinner}`);
}

main().catch(e => {
  console.error('  ❌ scuttle-product.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
