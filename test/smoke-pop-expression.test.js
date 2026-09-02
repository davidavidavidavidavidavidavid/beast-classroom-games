/*
 * jsdom full-playthrough smoke test for pop-expression.html.
 * Uses Format B ( _ _ − _ _ + _ , target 60 — the format that can go
 * negative, exercising the two-cause bust rule for real) and:
 *   - deterministically probes the leading-zero BLOCK rule via a real
 *     click on the real handler,
 *   - plays through all 7 rolls (3 addends across 5 inside blanks + 2
 *     throwaways) with real, sequential, irrevocable placements —
 *     including at least one deliberate throw-away,
 *   - completes the answer-check step (accepting a possibly-negative
 *     correct answer),
 *   - asserts the reveal screen's bust status and winner agree with what
 *     the page itself computed,
 *   - deterministically probes the negative-bust rule directly, the same
 *     way smoke-pop-subtraction.test.js does.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('pop-expression.html');

  runInPage(dom, () => {
    document.querySelector('#format-row [data-format="B"]').click();
    document.querySelector('#diff-row [data-diff="hard"]').click();
    el('start-btn').click();
  });

  const cfg = runInPage(dom, () => ({
    insideLens: st.insideLens.slice(),
    insideSigns: st.insideSigns.slice(),
    throwaways: st.throwaways,
    totalBlanks: st.totalBlanks,
    target: st.target,
  }));
  assert.deepStrictEqual(cfg.insideLens, [2, 2, 1], 'Format B should set insideLens to [2,2,1]');
  assert.deepStrictEqual(cfg.insideSigns, [1, -1, 1], 'Format B should set insideSigns to [+1,-1,+1]');
  assert.strictEqual(cfg.throwaways, 2, 'Format B should have 2 throwaways');
  assert.strictEqual(cfg.totalBlanks, 7, 'Format B should total 7 blanks (5 inside + 2 throwaway)');
  assert.strictEqual(cfg.target, 60, 'Format B should default to target 60');

  // --- Deterministic probe of the leading-zero-under-uncertainty rule ---
  const blockProbe = runInPage(dom, () => {
    st.currentDigit = 0;
    document.querySelectorAll('#human-inside .slot')[0].click(); // addend0, idx0 — the leading blank
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

  // --- Real playthrough: sequential, irrevocable placement across all 7 rolls ---
  runInPage(dom, () => { el('roll-btn').click(); });
  await sleep(700);

  const placements = [];
  for (let i = 0; i < cfg.totalBlanks; i++) {
    const isLast = i === cfg.totalBlanks - 1;
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
  assert.ok(placements.some(p => p.kind === 'inside' && p.addend === 0), 'the first addend should receive at least one digit');
  assert.ok(placements.some(p => p.kind === 'inside' && p.addend === 1), 'the second addend should receive at least one digit');
  assert.ok(placements.some(p => p.kind === 'inside' && p.addend === 2), 'the third addend should receive its digit');

  const filled = runInPage(dom, () => ({
    humanComplete: isComplete(st.human),
    botComplete: isComplete(st.bot),
    humanSum: committedInsideSum(st.human, st.insideLens, st.insideSigns),
    a0: parseInt(st.human.inside[0].join(''), 10),
    a1: parseInt(st.human.inside[1].join(''), 10),
    a2: parseInt(st.human.inside[2].join(''), 10),
  }));
  assert.strictEqual(filled.humanComplete, true, 'all of the human blanks should be filled after totalBlanks rolls');
  assert.strictEqual(filled.botComplete, true, "all of the bot's blanks should be filled in lockstep (shared rolls)");
  assert.strictEqual(filled.humanSum, filled.a0 - filled.a1 + filled.a2, 'committedInsideSum should equal addend0 - addend1 + addend2 exactly, checking the 3-term signed math');

  // --- Compute (answer-check) screen — the correct answer may be negative ---
  runInPage(dom, (sum) => {
    el('answer-input').value = String(sum);
    el('check-btn').click();
  }, filled.humanSum);

  const computeMsg = runInPage(dom, () => el('compute-msg').textContent);
  assert.strictEqual(computeMsg, 'That checks out!', 'the correct (possibly negative) expression result should be accepted');

  runInPage(dom, () => { el('reveal-btn').click(); });

  const result = runInPage(dom, () => {
    const humanSum = st.finalHumanSum;
    const botSum = committedInsideSum(st.bot, st.insideLens, st.insideSigns);
    const humanBusted = isBusted(humanSum, st.target);
    const botBusted = isBusted(botSum, st.target);
    return {
      target: st.target,
      humanSum,
      botSum,
      humanBusted,
      botBusted,
      shownHumanTotal: Number(el('human-total').textContent),
      shownBotTotal: Number(el('bot-total').textContent),
      humanStatusClass: el('human-status').className,
      botStatusClass: el('bot-status').className,
      banner: el('winner-banner').textContent,
      computedWinner: decideWinner(humanSum, humanBusted, botSum, botBusted, st.target),
    };
  });

  assert.strictEqual(result.shownHumanTotal, result.humanSum, 'displayed human total should match the actual committed (signed, 3-term) inside sum');
  assert.strictEqual(result.shownBotTotal, result.botSum, "displayed bot total should match the bot's actual committed inside sum");
  assert.strictEqual(result.humanStatusClass, 'result-status ' + (result.humanBusted ? 'busted' : 'safe'), 'human status class should reflect bust vs safe correctly');
  assert.strictEqual(result.botStatusClass, 'result-status ' + (result.botBusted ? 'busted' : 'safe'), 'bot status class should reflect bust vs safe correctly');

  const bannerWinner = result.banner.includes('tie') || result.banner.includes('a tie')
    ? 'tie'
    : (result.banner.toLowerCase().includes('you win') ? 'human' : 'bot');
  assert.strictEqual(bannerWinner, result.computedWinner, "the banner shown should agree with decideWinner's verdict on the real sums/bust flags");

  // --- Deterministic probe of the negative-result bust rule ---
  const negProbe = runInPage(dom, () => ({
    negativeIsBusted: isBusted(-5, st.target),
    negativeStatusText: statusText(-5, st.target),
    negativeBeatsNothing: decideWinner(-5, isBusted(-5, st.target), 10, isBusted(10, st.target), st.target),
  }));
  assert.strictEqual(negProbe.negativeIsBusted, true, 'a negative expression result must be busted, per the real rules');
  assert.strictEqual(negProbe.negativeStatusText, 'Popped — negative result!', 'the status text should name the actual cause');
  assert.strictEqual(negProbe.negativeBeatsNothing, 'bot', 'a busted negative sum must lose outright to any safe sum');

  console.log('  ✅ pop-expression.html: full playthrough smoke test passed');
  console.log(`     leading-zero block verified | throw-away used: yes | 3-term signed math verified | negative-bust probe verified | target=${result.target} | human ${result.humanSum} (${result.humanBusted ? 'BUSTED' : 'safe'}) | bot ${result.botSum} (${result.botBusted ? 'BUSTED' : 'safe'}) | winner=${result.computedWinner}`);
}

main().catch(e => {
  console.error('  ❌ pop-expression.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
