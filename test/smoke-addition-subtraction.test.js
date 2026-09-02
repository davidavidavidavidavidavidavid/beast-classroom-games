/*
 * jsdom full-playthrough smoke test for scuttle-addition-subtraction.html.
 * Actually clicks through the UI (roll, place digits, lock, answer-check,
 * reveal) and asserts the numbers shown on screen match what the page
 * itself computed — not just "it didn't throw."
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('scuttle-addition-subtraction.html');

  // Hard bot (most interesting play) + fixed target for a deterministic run.
  runInPage(dom, () => {
    document.querySelector('.chip-row [data-diff="hard"]').click();
    el('target-input').value = '500';
    el('start-btn').click();
  });

  for (let round = 1; round <= 3; round++) {
    runInPage(dom, () => { el('roll-btn').click(); });
    await sleep(650); // 7 ticks * 70ms roll animation, plus buffer

    // Place the 3 rolled digits via real die clicks, choosing an order that
    // never puts a 0 in the hundreds place unless every digit is 0 —
    // mirrors placeDigit()'s own constraint, so this never gets rejected.
    runInPage(dom, () => {
      function unusedIndices() { return [0, 1, 2].filter(i => !st.slotAssignment.includes(i)); }
      function clickRollIndex(rollIdx) {
        const remaining = unusedIndices().sort((a, b) => a - b);
        const pos = remaining.indexOf(rollIdx);
        document.querySelectorAll('#dice-row .die-wrap.pickable')[pos].click();
      }
      for (let step = 0; step < 3; step++) {
        const remaining = unusedIndices();
        const emptySlot = st.slotAssignment.findIndex(s => s === null);
        let choice;
        if (emptySlot === 0) {
          const nonZero = remaining.find(i => st.roll[i] !== 0);
          choice = nonZero !== undefined ? nonZero : remaining[0];
        } else {
          choice = remaining[0];
        }
        clickRollIndex(choice);
      }
    });

    const beforeLock = runInPage(dom, () => ({
      slotAssignment: st.slotAssignment.slice(),
      roll: st.roll.slice(),
    }));
    assert.ok(beforeLock.slotAssignment.every(s => s !== null), `round ${round}: all 3 slots should be filled before locking in`);
    const expectedHumanVal = 100 * beforeLock.roll[beforeLock.slotAssignment[0]]
      + 10 * beforeLock.roll[beforeLock.slotAssignment[1]]
      + beforeLock.roll[beforeLock.slotAssignment[2]];

    runInPage(dom, () => { el('lock-btn').click(); });

    const afterLock = runInPage(dom, () => ({
      humanNums: st.humanNums.slice(),
      botNums: st.botNums.slice(),
    }));
    assert.strictEqual(afterLock.humanNums.length, round, `round ${round}: humanNums should have ${round} entries`);
    assert.strictEqual(afterLock.humanNums[round - 1], expectedHumanVal, `round ${round}: locked-in human number should match the digits actually placed`);
    assert.strictEqual(afterLock.botNums.length, round, `round ${round}: botNums should have ${round} entries`);

    if (round < 3) {
      runInPage(dom, () => { el('next-round-btn').click(); });
    } else {
      await sleep(650); // setTimeout(goToCompute, 500)
    }
  }

  // Compute screen: answer with the actual correct total for the default
  // (unreordered, all-plus) equation.
  const correctTotal = runInPage(dom, () => currentHumanCorrectTotal());
  runInPage(dom, (total) => {
    el('answer-input').value = String(total);
    el('check-btn').click();
  }, correctTotal);

  const computeMsg = runInPage(dom, () => el('compute-msg').textContent);
  assert.strictEqual(computeMsg, 'That checks out!', 'the correct total should be accepted');

  runInPage(dom, () => { el('reveal-btn').click(); });

  const result = runInPage(dom, () => ({
    target: st.target,
    finalHumanTotal: st.finalHumanTotal,
    botFinalTotal: st.botMeta[2].total,
    shownHumanTotal: Number(el('human-total').textContent),
    shownHumanDist: parseInt(el('human-dist').textContent, 10),
    shownBotTotal: Number(el('bot-total').textContent),
    shownBotDist: parseInt(el('bot-dist').textContent, 10),
    banner: el('winner-banner').textContent,
    // decideWinner is the same pure function the reveal handler itself
    // calls — exercising it here through the real page, not a mock.
    computedWinner: decideWinner(
      Math.abs(st.finalHumanTotal - st.target),
      Math.abs(st.botMeta[2].total - st.target)
    ),
  }));

  assert.strictEqual(result.shownHumanTotal, result.finalHumanTotal, 'displayed human total should match st.finalHumanTotal');
  assert.strictEqual(result.shownBotTotal, result.botFinalTotal, "displayed bot total should match the bot's actual final round-3 total");
  assert.strictEqual(result.shownHumanDist, Math.abs(result.finalHumanTotal - result.target), 'displayed human distance should be |total - target|');
  assert.strictEqual(result.shownBotDist, Math.abs(result.botFinalTotal - result.target), 'displayed bot distance should be |total - target|');

  const bannerWinner = result.banner.includes('tie') ? 'tie'
    : result.banner.startsWith('You win') ? 'human'
    : 'bot';
  assert.strictEqual(bannerWinner, result.computedWinner, "the banner shown should agree with decideWinner's verdict on the same distances");

  console.log('  ✅ scuttle-addition-subtraction.html: full playthrough smoke test passed');
  console.log(`     target=${result.target} | human ${result.finalHumanTotal} (${result.shownHumanDist} away) | bot ${result.botFinalTotal} (${result.shownBotDist} away) | winner=${result.computedWinner}`);
}

main().catch(e => {
  console.error('  ❌ scuttle-addition-subtraction.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
