/*
 * Layout-stability regression test — see CLAUDE.md "Layout stability".
 *
 * The bug: toggling `.hidden` (display:none) on within-round phase content
 * (dice row, slot row, answer-check row, ...) removes it from the layout
 * entirely, so the round card's height snaps to whatever's currently
 * visible and everything below it jumps. The fix: that content now toggles
 * `.phase-hidden` (visibility:hidden) instead, which keeps its layout space
 * reserved even while invisible. Only entire top-level screens (settings /
 * round / compute-or-sum / reveal) and one-off disclosures (the rules box)
 * still use `.hidden`.
 *
 * jsdom does not run a real layout engine (getBoundingClientRect is always
 * zero), so this can't measure actual pixel heights. Instead it proves the
 * thing that *would* cause a height change if it ever happened: it drives a
 * real playthrough via the actual click handlers and asserts, at every
 * within-round phase, that none of the phase-content elements ever carry
 * `.hidden` — only `.phase-hidden` toggles, on the same element, across the
 * whole round. Given CSS's own guarantee that visibility:hidden preserves
 * an element's box, "never removed from flow" is equivalent to "never
 * changes the card's height." A static check on design-system.css itself
 * (below) locks in that `.hidden`/`.phase-hidden` map to the properties
 * this reasoning depends on, so a future edit can't quietly break it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

/* ---------------- static CSS guard ---------------- */
function checkDesignSystemCss() {
  const css = fs.readFileSync(path.join(__dirname, '..', 'design-system.css'), 'utf8');
  const hiddenRule = css.match(/\.hidden\s*\{([^}]*)\}/);
  const phaseHiddenRule = css.match(/\.phase-hidden\s*\{([^}]*)\}/);
  assert.ok(hiddenRule, 'design-system.css should still define .hidden');
  assert.ok(phaseHiddenRule, 'design-system.css should define .phase-hidden');
  assert.ok(/display\s*:\s*none/.test(hiddenRule[1]), '.hidden should be display:none (screen-level swaps)');
  assert.ok(/visibility\s*:\s*hidden/.test(phaseHiddenRule[1]), '.phase-hidden should be visibility:hidden (reserves layout space)');
  assert.ok(!/display\s*:\s*none/.test(phaseHiddenRule[1]), '.phase-hidden must not also set display:none, or it stops reserving space');
  console.log('  ✅ design-system.css: .hidden = display:none, .phase-hidden = visibility:hidden');
}

// Snapshot which of `ids` currently carry 'hidden' and which carry
// 'phase-hidden'. Run inside the page via runInPage, so `ids` must be
// passed in as an arg (no closing over Node-side variables).
function snapshotClasses(ids) {
  const out = {};
  ids.forEach(id => {
    const cl = document.getElementById(id).classList;
    out[id] = { hidden: cl.contains('hidden'), phaseHidden: cl.contains('phase-hidden') };
  });
  return out;
}

function assertNeverHidden(snapshot, ids, where) {
  ids.forEach(id => {
    assert.strictEqual(snapshot[id].hidden, false, `${where}: #${id} should never carry .hidden while its screen is showing (that's the bug this fix removes) — layout space must stay reserved`);
  });
}

/* ---------------- scuttle-addition-subtraction.html ---------------- */
async function checkAdditionSubtraction() {
  const dom = loadGame('scuttle-addition-subtraction.html');
  const PHASE_IDS = ['roll-btn-wrap', 'dice-row', 'slots-wrap', 'lock-wrap', 'next-round-wrap'];

  runInPage(dom, () => {
    document.querySelector('.chip-row [data-diff="hard"]').click();
    el('target-input').value = '500';
    el('start-btn').click();
  });

  for (let round = 1; round <= 3; round++) {
    // Stage A: before rolling.
    let snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage A (before roll)`);
    assert.strictEqual(snap['roll-btn-wrap'].phaseHidden, false, `round ${round}: roll button should be visible before rolling`);
    assert.strictEqual(snap['dice-row'].phaseHidden, true, `round ${round}: dice row should be reserved-but-invisible before rolling`);
    assert.strictEqual(snap['slots-wrap'].phaseHidden, true, `round ${round}: slots should be reserved-but-invisible before rolling`);
    assert.strictEqual(snap['lock-wrap'].phaseHidden, true, `round ${round}: lock button should be reserved-but-invisible before rolling`);

    runInPage(dom, () => { el('roll-btn').click(); });
    await sleep(650); // 7 ticks * 70ms roll animation, plus buffer

    // Stage B: dice + slots + lock button showing.
    snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage B (dice/slots showing)`);
    assert.strictEqual(snap['roll-btn-wrap'].phaseHidden, true, `round ${round}: roll button should be reserved-but-invisible once rolled`);
    assert.strictEqual(snap['dice-row'].phaseHidden, false, `round ${round}: dice row should be visible after rolling`);
    assert.strictEqual(snap['slots-wrap'].phaseHidden, false, `round ${round}: slots should be visible after rolling`);
    assert.strictEqual(snap['lock-wrap'].phaseHidden, false, `round ${round}: lock button should be visible after rolling`);
    assert.strictEqual(snap['next-round-wrap'].phaseHidden, true, `round ${round}: next-round button should still be reserved-but-invisible mid-round`);

    // Place the 3 rolled digits (never a leading 0 unless forced).
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

    // Mid-placement: still stage B, nothing should have changed hidden-wise.
    snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage B (after placing digits)`);

    runInPage(dom, () => { el('lock-btn').click(); });

    // Stage C: locked in.
    snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage C (locked in)`);
    assert.strictEqual(snap['dice-row'].phaseHidden, true, `round ${round}: dice row should be reserved-but-invisible after locking in`);
    assert.strictEqual(snap['slots-wrap'].phaseHidden, true, `round ${round}: slots should be reserved-but-invisible after locking in`);
    assert.strictEqual(snap['lock-wrap'].phaseHidden, true, `round ${round}: lock button should be reserved-but-invisible after locking in`);

    if (round < 3) {
      assert.strictEqual(snap['next-round-wrap'].phaseHidden, false, `round ${round}: next-round button should be visible after locking in (round < 3)`);
      runInPage(dom, () => { el('next-round-btn').click(); });
    } else {
      await sleep(650); // setTimeout(goToCompute, 500)
    }
  }

  // Compute screen: reveal-wrap should be reserved-but-invisible until the
  // correct total is entered, then become visible — never .hidden either way.
  let computeSnap = runInPage(dom, snapshotClasses, ['reveal-wrap']);
  assertNeverHidden(computeSnap, ['reveal-wrap'], 'compute screen (before answering)');
  assert.strictEqual(computeSnap['reveal-wrap'].phaseHidden, true, 'reveal button should be reserved-but-invisible before the answer is checked');

  const correctTotal = runInPage(dom, () => currentHumanCorrectTotal());
  runInPage(dom, (total) => {
    el('answer-input').value = String(total);
    el('check-btn').click();
  }, correctTotal);

  computeSnap = runInPage(dom, snapshotClasses, ['reveal-wrap']);
  assertNeverHidden(computeSnap, ['reveal-wrap'], 'compute screen (after answering correctly)');
  assert.strictEqual(computeSnap['reveal-wrap'].phaseHidden, false, 'reveal button should become visible once the answer checks out');

  console.log('  ✅ scuttle-addition-subtraction.html: within-round phase content never left the layout (only .phase-hidden toggled, never .hidden)');
}

/* ---------------- scuttle-product.html ---------------- */
async function checkProduct() {
  const dom = loadGame('scuttle-product.html');
  const PHASE_IDS = ['roll-btn-wrap', 'dice-row', 'frames-wrap', 'product-check-wrap', 'next-round-wrap'];

  runInPage(dom, () => {
    document.querySelector('#format-row [data-format="2x2"]').click();
    document.querySelector('#diff-row [data-diff="hard"]').click();
    el('start-btn').click();
  });

  for (let round = 1; round <= 3; round++) {
    let snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage A (before roll)`);
    assert.strictEqual(snap['roll-btn-wrap'].phaseHidden, false, `round ${round}: roll button should be visible before rolling`);
    assert.strictEqual(snap['dice-row'].phaseHidden, true, `round ${round}: dice row should be reserved-but-invisible before rolling`);
    assert.strictEqual(snap['frames-wrap'].phaseHidden, true, `round ${round}: number frames should be reserved-but-invisible before rolling`);

    runInPage(dom, () => { el('roll-btn').click(); });
    await sleep(650);

    snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage B (dice/frames showing)`);
    assert.strictEqual(snap['roll-btn-wrap'].phaseHidden, true, `round ${round}: roll button should be reserved-but-invisible once rolled`);
    assert.strictEqual(snap['dice-row'].phaseHidden, false, `round ${round}: dice row should be visible after rolling`);
    assert.strictEqual(snap['frames-wrap'].phaseHidden, false, `round ${round}: number frames should be visible after rolling`);
    assert.strictEqual(snap['product-check-wrap'].phaseHidden, true, `round ${round}: answer-check row should be reserved-but-invisible until both frames are full`);

    // Fill n1's slots then n2's slots (never a leading 0 unless forced).
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

    // Both frames are now full: the answer-check row should have become
    // visible on its own (renderFrames' `full` branch), still never .hidden.
    snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage B (frames full)`);
    assert.strictEqual(snap['product-check-wrap'].phaseHidden, false, `round ${round}: answer-check row should be visible once both frames are full`);

    const split = runInPage(dom, () => ({ num1: buildNumber(st.roll, st.slotsN1), num2: buildNumber(st.roll, st.slotsN2) }));
    runInPage(dom, (product) => {
      el('product-answer-input').value = String(product);
      el('product-check-btn').click();
    }, split.num1 * split.num2);

    snap = runInPage(dom, snapshotClasses, PHASE_IDS);
    assertNeverHidden(snap, PHASE_IDS, `round ${round} stage C (locked in)`);
    assert.strictEqual(snap['dice-row'].phaseHidden, true, `round ${round}: dice row should be reserved-but-invisible after locking in`);
    assert.strictEqual(snap['frames-wrap'].phaseHidden, true, `round ${round}: number frames should be reserved-but-invisible after locking in`);
    assert.strictEqual(snap['product-check-wrap'].phaseHidden, true, `round ${round}: answer-check row should be reserved-but-invisible after locking in`);

    if (round < 3) {
      assert.strictEqual(snap['next-round-wrap'].phaseHidden, false, `round ${round}: next-round button should be visible after locking in (round < 3)`);
      runInPage(dom, () => { el('next-round-btn').click(); });
    } else {
      await sleep(650); // setTimeout(goToSum, 500)
    }
  }

  let sumSnap = runInPage(dom, snapshotClasses, ['sum-reveal-wrap']);
  assertNeverHidden(sumSnap, ['sum-reveal-wrap'], 'sum screen (before answering)');
  assert.strictEqual(sumSnap['sum-reveal-wrap'].phaseHidden, true, 'reveal button should be reserved-but-invisible before the sum is checked');

  const correctSum = runInPage(dom, () => st.humanProducts.reduce((a, b) => a + b, 0));
  runInPage(dom, (sum) => {
    el('sum-answer-input').value = String(sum);
    el('sum-check-btn').click();
  }, correctSum);

  sumSnap = runInPage(dom, snapshotClasses, ['sum-reveal-wrap']);
  assertNeverHidden(sumSnap, ['sum-reveal-wrap'], 'sum screen (after answering correctly)');
  assert.strictEqual(sumSnap['sum-reveal-wrap'].phaseHidden, false, 'reveal button should become visible once the sum checks out');

  console.log('  ✅ scuttle-product.html: within-round phase content never left the layout (only .phase-hidden toggled, never .hidden)');
}

async function main() {
  checkDesignSystemCss();
  await checkAdditionSubtraction();
  await checkProduct();
}

main().catch(e => {
  console.error('  ❌ layout-stability test FAILED:', e.message);
  process.exitCode = 1;
});
