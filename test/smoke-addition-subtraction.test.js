/*
 * jsdom full-playthrough smoke test for scuttle-addition-subtraction.html.
 * Actually clicks through the UI (roll, place digits, lock, answer-check,
 * reveal) and asserts the numbers shown on screen match what the page
 * itself computed — not just "it didn't throw."
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

async function main() {
  const dom = loadGame('scuttle-addition-subtraction.html');

  // showScreen(screens, name) now takes `screens` as a parameter (see
  // CLAUDE.md "File structure & the point of it" — shared-game.js) instead
  // of closing over a game-specific global; confirm the persistent
  // scorecard still hides on the settings screen exactly as before.
  const scHiddenBeforeStart = runInPage(dom, () => document.getElementById('scorecard').classList.contains('hidden'));
  assert.strictEqual(scHiddenBeforeStart, true, 'the scorecard should be hidden while still on the settings screen');

  // Avatars (see CLAUDE.md "Avatars"): before touching anything, the picker
  // and every badge should already agree with the default state — st.avatar
  // selected in the picker, and the bot badge matching the default (medium)
  // difficulty.
  const defaults = snapshotAvatarState(dom);
  assert.strictEqual(defaults.pickerSelected, defaults.avatar, 'the avatar picker should mark st.avatar\'s slot as .selected by default');
  assert.strictEqual(defaults.youBadge, `avatars/${defaults.avatar}.png`, 'top-bar "you" badge should point at st.avatar\'s image');
  assert.strictEqual(defaults.scYouBadge, defaults.youBadge, 'scoreboard-header "you" badge should match the top-bar one');
  assert.strictEqual(defaults.botBadge, `avatars/bot-${defaults.difficulty}.png`, 'top-bar bot badge should point at the difficulty-mapped bot avatar');
  assert.strictEqual(defaults.scBotBadge, defaults.botBadge, 'scoreboard-header bot badge should match the top-bar one');

  // Pick a different avatar, then switch to the hard bot (most interesting
  // play) + a fixed target for a deterministic run. The avatar pick and the
  // difficulty switch are independent: only the "you" badges should follow
  // the avatar pick, only the bot badges should follow the difficulty.
  runInPage(dom, () => {
    document.querySelector('#avatar-row [data-avatar="cammy"]').click();
    document.querySelector('.chip-row [data-diff="hard"]').click();
    el('target-input').value = '500';
    el('start-btn').click();
  });

  const scHiddenAfterStart = runInPage(dom, () => document.getElementById('scorecard').classList.contains('hidden'));
  assert.strictEqual(scHiddenAfterStart, false, 'the scorecard should become visible once a match starts (round screen)');

  const afterPick = snapshotAvatarState(dom);
  assert.strictEqual(afterPick.avatar, 'cammy', 'clicking an avatar slot should update st.avatar');
  assert.strictEqual(afterPick.pickerSelected, 'cammy', 'the clicked slot should become the (only) .selected one');
  assert.strictEqual(afterPick.youBadge, 'avatars/cammy.png', 'top-bar "you" badge should update to the newly picked avatar');
  assert.strictEqual(afterPick.scYouBadge, afterPick.youBadge, 'scoreboard-header "you" badge should update too');
  assert.strictEqual(afterPick.botBadge, 'avatars/bot-hard.png', 'bot badges should swap to the hard-tier avatar once difficulty changes to hard, independent of the avatar pick');
  assert.strictEqual(afterPick.scBotBadge, afterPick.botBadge, 'scoreboard-header bot badge should match the top-bar one');

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

  // Drag-to-swap (see CLAUDE.md "Drag interactions") replaced the old ◀▶
  // stepper buttons. findDropTile() resolves the NEAREST .eq-tile by
  // comparing the pointer's clientX against each tile's real
  // getBoundingClientRect() center (replaced an elementsFromPoint-based
  // version after real playtesting found it flickered — see that
  // function's own comment) — jsdom has no layout engine, so
  // getBoundingClientRect() always returns all-zero rects; stub it at the
  // PROTOTYPE level (survives renderEquation()'s full tear-down/rebuild of
  // the actual .eq-tile nodes on every drag, per CLAUDE.md Known traps),
  // mapping each tile's own data-pos to a fake but consistent x position,
  // so the actual production drag code (pointer events in, nearest-tile
  // math out) still runs for real, just against fake geometry instead of
  // unavailable real geometry.
  runInPage(dom, () => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.classList && this.classList.contains('eq-tile')) {
        const pos = parseInt(this.dataset.pos, 10) * 40;
        return { left: pos, right: pos + 40, width: 40, top: 0, bottom: 0, height: 0, x: pos, y: 0 };
      }
      return { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0, x: 0, y: 0 };
    };
  });

  const beforeSwap = runInPage(dom, () => ({ order: st.order.slice() }));

  // Drag position 0's tile onto position 2's tile — a real pointerdown /
  // pointermove / pointerup sequence on the actual draggable element, not
  // a direct call into swapOrder().
  const dragOutcome = runInPage(dom, () => {
    const draggedNumEl = document.querySelector('.eq-tile[data-pos="0"] .eq-num');
    draggedNumEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: 20, clientY: 20, pointerId: 1, bubbles: true }));
    draggedNumEl.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, clientY: 20, pointerId: 1, bubbles: true }));
    const dropTargetDuringDrag = document.querySelector('.eq-tile.drop-target');
    const highlightedPos = dropTargetDuringDrag ? dropTargetDuringDrag.dataset.pos : null;
    draggedNumEl.dispatchEvent(new PointerEvent('pointerup', { clientX: 90, clientY: 20, pointerId: 1, bubbles: true }));
    return {
      highlightedPos,
      noDropTargetsLeftAfterDrop: document.querySelectorAll('.eq-tile.drop-target').length === 0,
      order: st.order.slice(),
    };
  });
  assert.strictEqual(dragOutcome.highlightedPos, '2', 'the tile under the pointer mid-drag should get .drop-target (position 2, per the x=90 stub)');
  assert.strictEqual(dragOutcome.noDropTargetsLeftAfterDrop, true, '.drop-target should be cleared again once the drag resolves');
  assert.deepStrictEqual(dragOutcome.order, [beforeSwap.order[2], beforeSwap.order[1], beforeSwap.order[0]], 'a drag from position 0 onto position 2 should swap st.order[0] and st.order[2], leaving position 1 untouched');

  // Flip one operator to '−' too (both start '+', under which the total is
  // order-invariant by commutativity — a real exercise of order-sensitive
  // math needs a subtraction in the mix, and this also confirms the
  // operator toggle still works normally alongside the new drag handling).
  runInPage(dom, () => { document.querySelectorAll('.op-btn')[0].click(); });

  // Compute screen: answer with the actual correct total for the NEW
  // (post-drag, post-operator-toggle) equation. If swapOrder() had left
  // st.order or currentHumanCorrectTotal() out of sync with what's
  // actually displayed, this submission — using the same function the
  // reveal handler itself trusts — would be rejected below.
  const correctTotal = runInPage(dom, () => currentHumanCorrectTotal());
  runInPage(dom, (total) => {
    el('answer-input').value = String(total);
    el('check-btn').click();
  }, correctTotal);

  const computeMsg = runInPage(dom, () => el('compute-msg').textContent);
  assert.strictEqual(computeMsg, 'That checks out!', 'the correct total should be accepted');

  const preReveal = runInPage(dom, () => ({
    humanTotalText: el('human-total').textContent,
    bannerText: el('winner-banner').textContent,
  }));

  runInPage(dom, () => { el('reveal-btn').click(); });

  // The win-visual reveal (typewriter banner + count-up totals, see CLAUDE.md
  // "Celebration animations") is asynchronous — right after the click, it
  // should still be mid-flight, not already showing final values. Proves
  // this is really animated, not silently short-circuited to instant.
  const midFlight = runInPage(dom, () => ({
    humanTotalText: el('human-total').textContent,
    bannerText: el('winner-banner').textContent,
  }));
  assert.strictEqual(midFlight.humanTotalText, preReveal.humanTotalText, 'human total should not have jumped to its final value in the same tick as the reveal click');
  assert.strictEqual(midFlight.bannerText, '', 'winner banner should be cleared (typewriter not yet started ticking) immediately after the reveal click');

  // Typewriter is 45ms/char + a 400ms flash buffer, count-up is a fixed
  // 650ms — 2s comfortably clears both for every possible banner string.
  await sleep(2000);

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

  runInPage(dom, () => { el('change-settings-btn').click(); });
  const scHiddenAfterReturnToSettings = runInPage(dom, () => document.getElementById('scorecard').classList.contains('hidden'));
  assert.strictEqual(scHiddenAfterReturnToSettings, true, 'the scorecard should hide again after returning to settings from the reveal screen');

  console.log('  ✅ scuttle-addition-subtraction.html: full playthrough smoke test passed');
  console.log(`     target=${result.target} | human ${result.finalHumanTotal} (${result.shownHumanDist} away) | bot ${result.botFinalTotal} (${result.shownBotDist} away) | winner=${result.computedWinner}`);
}

main().catch(e => {
  console.error('  ❌ scuttle-addition-subtraction.html smoke test FAILED:', e.message);
  process.exitCode = 1;
});
