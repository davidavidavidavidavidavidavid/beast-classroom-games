/*
 * jsdom full-playthrough smoke test for pop-addition.html.
 * Uses the 2+2 format (two leading inside-blanks, exercising the
 * leading-zero-under-uncertainty rule on both addends) and:
 *   - deterministically probes the leading-zero BLOCK rule via a real
 *     click on the real handler (not a reimplementation of the rule),
 *   - plays through all 6 rolls with real, sequential, irrevocable
 *     placements — including at least one deliberate throw-away,
 *   - completes the answer-check step,
 *   - asserts the reveal screen's bust status and winner agree with
 *     what the page itself computed.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('pop-addition.html');

  runInPage(dom, () => {
    document.querySelector('#format-row [data-format="2+2"]').click();
    document.querySelector('#diff-row [data-diff="hard"]').click();
    el('start-btn').click();
  });

  const cfg = runInPage(dom, () => ({
    insideLens: st.insideLens.slice(),
    throwaways: st.throwaways,
    totalBlanks: st.totalBlanks,
    target: st.target,
  }));
  assert.deepStrictEqual(cfg.insideLens, [2, 2], '2+2 format should set insideLens to [2,2]');
  assert.strictEqual(cfg.throwaways, 2, '2+2 format should have 2 throwaways');
  assert.strictEqual(cfg.totalBlanks, 6, '2+2 format should total 6 blanks (4 inside + 2 throwaway)');
  assert.strictEqual(cfg.target, 100, '2+2 format should default to target 100');

  // --- Deterministic probe of the leading-zero-under-uncertainty rule ---
  // Every blank is still empty here. Force digit 0 (bypassing the roll
  // animation — this is a synthetic probe, not part of the real
  // playthrough) and click the *leading* blank of the first addend, which
  // must be rejected since other blanks (the second addend, the
  // throwaways) are all still open.
  const blockProbe = runInPage(dom, () => {
    st.currentDigit = 0;
    const beforeMsg = el('msg').textContent;
    document.querySelectorAll('#human-inside .slot')[0].click(); // addend0, idx0 — the leading blank
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

  // Reset the synthetic probe's leftover currentDigit before the real playthrough.
  runInPage(dom, () => { st.currentDigit = null; flashMsg('', false); });

  // --- Real playthrough: sequential, irrevocable placement across all 6 rolls ---
  runInPage(dom, () => { el('roll-btn').click(); });
  await sleep(700); // first spin settles

  const placements = [];
  for (let i = 0; i < cfg.totalBlanks; i++) {
    const isLast = i === cfg.totalBlanks - 1;
    const result = runInPage(dom, (isFirst) => {
      const digit = st.currentDigit;
      const legal = legalTargets(digit, st.human, st.insideLens);
      const insideLegal = legal.filter(p => p.kind === 'inside');
      const throwLegal = legal.filter(p => p.kind === 'throw');

      // Force at least one deliberate (non-forced) throw-away on the very
      // first roll; otherwise prefer filling an inside blank; fall back to
      // throw-away only when no inside option is currently legal.
      let choice;
      if (isFirst && throwLegal.length > 0) choice = throwLegal[0];
      else if (insideLegal.length > 0) choice = insideLegal[0];
      else choice = throwLegal[0];

      // Map the chosen logical position to its DOM slot: slots render in
      // fixed left-to-right order per group regardless of fill state.
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

    await sleep(isLast ? 700 : 1150); // isLast: setTimeout(goToCompute,600); else: 450ms pre-roll delay + ~490ms spin
  }

  assert.ok(placements.some(p => p.kind === 'throw'), 'the playthrough should include at least one throw-away placement');

  const filled = runInPage(dom, () => ({
    humanComplete: isComplete(st.human),
    botComplete: isComplete(st.bot),
    humanSum: committedInsideSum(st.human, st.insideLens),
  }));
  assert.strictEqual(filled.humanComplete, true, 'all of the human blanks should be filled after totalBlanks rolls');
  assert.strictEqual(filled.botComplete, true, "all of the bot's blanks should be filled in lockstep (shared rolls)");

  // --- Compute (answer-check) screen ---
  runInPage(dom, (sum) => {
    el('answer-input').value = String(sum);
    el('check-btn').click();
  }, filled.humanSum);

  const computeMsg = runInPage(dom, () => el('compute-msg').textContent);
  assert.strictEqual(computeMsg, 'That checks out!', 'the correct inside-sum should be accepted');

  runInPage(dom, () => { el('reveal-btn').click(); });

  const result = runInPage(dom, () => {
    const humanSum = st.finalHumanSum;
    const botSum = committedInsideSum(st.bot, st.insideLens);
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

  assert.strictEqual(result.shownHumanTotal, result.humanSum, 'displayed human total should match the actual committed inside sum');
  assert.strictEqual(result.shownBotTotal, result.botSum, "displayed bot total should match the bot's actual committed inside sum");
  assert.strictEqual(result.humanStatusClass, 'result-status ' + (result.humanBusted ? 'busted' : 'safe'), 'human status class should reflect bust vs safe correctly');
  assert.strictEqual(result.botStatusClass, 'result-status ' + (result.botBusted ? 'busted' : 'safe'), 'bot status class should reflect bust vs safe correctly');

  const bannerWinner = result.banner.includes('tie') || result.banner.includes('a tie')
    ? 'tie'
    : (result.banner.includes('you win') || result.banner.toLowerCase().includes('you win') ? 'human' : 'bot');
  assert.strictEqual(bannerWinner, result.computedWinner, "the banner shown should agree with decideWinner's verdict on the real sums/bust flags");

  console.log('  ✅ pop-addition.html: full playthrough smoke test passed');
  console.log(`     leading-zero block verified | throw-away used: yes | target=${result.target} | human ${result.humanSum} (${result.humanBusted ? 'BUSTED' : 'safe'}) | bot ${result.botSum} (${result.botBusted ? 'BUSTED' : 'safe'}) | winner=${result.computedWinner}`);
}

main().catch(e => {
  console.error('  ❌ pop-addition.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
