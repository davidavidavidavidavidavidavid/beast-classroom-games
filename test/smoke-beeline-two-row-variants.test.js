/*
 * Lighter jsdom smoke test covering beeline-addition.html,
 * beeline-decimal.html, beeline-rounding.html, and
 * beeline-equivalent-fraction.html together.
 *
 * Deliberately NOT as deep as smoke-beeline-difference.html's or
 * smoke-beeline-product.html's own smoke tests (no drag probe, no full
 * playthrough to a win) — those two already thoroughly exercise the
 * SHARED engine these four variants also use verbatim (drag mechanics,
 * the wasted-turn rule, a full win via Hard-quality scripted play), and
 * test/beeline-two-row-bot-simulation.js already verifies the shared
 * engine's tier-ordering and anti-stalemate guarantee holds for each of
 * these four variants' own row ranges specifically. What's actually left
 * to verify per file — and genuinely NOT shared code — is each variant's
 * own value function, row-index wiring, and answer-parsing; that's what
 * this test checks: a real setup move computes the right claimed value
 * and is accepted by the real Check flow, a second real move computes a
 * DIFFERENT correct value, and the anti-stalemate rule (already proven
 * correct in the abstract) is actually wired up to reject a real attempt
 * to reverse that second move back to the first, via real clicks on the
 * real handlers.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep, snapshotAvatarState } = require('./jsdom-helpers');

const VARIANTS = [
  {
    file: 'beeline-addition.html',
    rowA: [1, 9], rowB: [1, 9],
    setup: [3, 4], move: [5], // move row A (idx 0) to 5
    claimedValue: (t) => t[0] + t[1],
    answerFor: (t) => String(t[0] + t[1]),
  },
  {
    file: 'beeline-decimal.html',
    rowA: [1, 6], rowB: [1, 6],
    setup: [3, 4], move: [5],
    claimedValue: (t) => t[0] * 10 + t[1],
    answerFor: (t) => '0.' + String(t[0] * 10 + t[1]).padStart(2, '0'),
  },
  {
    file: 'beeline-rounding.html',
    rowA: [1, 9], rowB: [0, 9],
    setup: [3, 7], move: null, moveRow: 1, movePos: 2, // move row B (idx 1) to 2
    claimedValue: (t) => Math.round((t[0] * 10 + t[1]) / 10) * 10,
    answerFor: (t) => String(Math.round((t[0] * 10 + t[1]) / 10) * 10),
  },
  {
    file: 'beeline-equivalent-fraction.html',
    rowA: [1, 7], rowB: [1, 7],
    setup: [6, 4], move: [3], // move row A (idx 0) to 3
    claimedValue: (t) => { const g = gcd(t[0], t[1]); return (t[0]/g) + '/' + (t[1]/g); },
    answerFor: (t) => String(gcd(t[0], t[1])), // the GCF, not the claimed fraction — see the file's own design note
  },
];

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

function idxFor(pos, range) { return pos - range[0]; }

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass || !detail ? '' : ` — ${detail}`}`);
}

async function main() {
for (const v of VARIANTS) {
  const dom = loadGame(v.file);

  // Avatars (see CLAUDE.md "Avatars"): defaults should already agree with
  // st.avatar/st.difficulty before anything is touched — checked per file
  // in this loop, since a wiring bug could be per-file even though the
  // underlying avatar-picker/badge code is duplicated identically across
  // all 6 Beeline files. No persistent #scorecard on any of these (unlike
  // Scuttle), so scYouBadge/scBotBadge should come back null.
  const avatarDefaults = snapshotAvatarState(dom);
  check(`${v.file}: avatar picker defaults to st.avatar`, avatarDefaults.pickerSelected === avatarDefaults.avatar, JSON.stringify(avatarDefaults));
  check(`${v.file}: top-bar "you" badge matches st.avatar`, avatarDefaults.youBadge === `avatars/${avatarDefaults.avatar}.png`, JSON.stringify(avatarDefaults));
  check(`${v.file}: top-bar bot badge matches the difficulty-mapped bot avatar`, avatarDefaults.botBadge === `avatars/bot-${avatarDefaults.difficulty}.png`, JSON.stringify(avatarDefaults));
  check(`${v.file}: no persistent #scorecard, so scoreboard-header badges are null`, avatarDefaults.scYouBadge === null && avatarDefaults.scBotBadge === null, JSON.stringify(avatarDefaults));

  // Full click-interaction independence check — only once, on the first
  // variant, matching this file's own "don't over-repeat what's already
  // proven shared code" philosophy (see this file's header comment): the
  // avatar-picker/badge wiring is byte-identical duplicated code across all
  // 6 Beeline files, so proving the interaction once here is enough on top
  // of the per-file default-state check above.
  if (v === VARIANTS[0]) {
    runInPage(dom, () => {
      document.querySelector('#avatar-row [data-avatar="cammy"]').click();
      document.querySelector('#diff-row [data-diff="hard"]').click();
    });
    const afterPick = snapshotAvatarState(dom);
    check(`${v.file}: clicking an avatar slot updates st.avatar and only the "you" badge`, afterPick.avatar === 'cammy' && afterPick.pickerSelected === 'cammy' && afterPick.youBadge === 'avatars/cammy.png', JSON.stringify(afterPick));
    check(`${v.file}: clicking a difficulty chip updates only the bot badge, independent of the avatar pick`, afterPick.botBadge === 'avatars/bot-hard.png', JSON.stringify(afterPick));
  }

  runInPage(dom, () => {
    document.querySelector('#diff-row [data-diff="easy"]').click();
    el('start-btn').click();
  });

  // Neutralize the bot for this whole file. Every probe here pokes
  // st.turn back to 'human' itself and never depends on the bot actually
  // moving, and the rounding probe below has to WAIT OUT a ~5s animation —
  // long enough for a bot move scheduled by an earlier commit to fire and
  // move a token out from under the assertions (it did: tokens came back
  // [5,9], then [5,1], instead of [5,2]). This has to happen BEFORE any
  // commit schedules one: setTimeout(botTurn, 550) captures the function
  // VALUE at scheduling time, so stubbing the global afterwards is too
  // late to stop a timer that's already queued.
  runInPage(dom, () => { botTurn = () => {}; });

  // --- Setup move: place both tokens, confirm the claimed value is right ---
  const [a1, b1] = v.setup;
  const setupResult = runInPage(dom, (aIdx, bIdx) => {
    document.querySelectorAll('#operand-row-a .op-num')[aIdx].click();
    document.querySelectorAll('#operand-row-b .op-num')[bIdx].click();
    const claimed = computePendingValue();
    return { equationText: el('equation-line').textContent, claimed };
  }, idxFor(a1, v.rowA), idxFor(b1, v.rowB));

  check(`${v.file}: setup(${a1},${b1}) computes the right claimed value`, setupResult.claimed === v.claimedValue([a1, b1]), JSON.stringify(setupResult));

  const answer1 = v.answerFor([a1, b1]);
  const afterCheck1 = runInPage(dom, (ans) => {
    el('answer-input').value = ans;
    el('check-btn').click();
    return { msg: el('compute-msg').textContent, tokens: st.tokens.slice(), turn: st.turn };
  }, answer1);
  check(`${v.file}: correct setup answer (${answer1}) is accepted`, afterCheck1.msg === 'That checks out!', JSON.stringify(afterCheck1));
  check(`${v.file}: st.tokens committed to [${a1},${b1}]`, JSON.stringify(afterCheck1.tokens) === JSON.stringify([a1, b1]));
  check(`${v.file}: turn passes to the bot after a correct human move`, afterCheck1.turn === 'bot');

  // Reset back to a clean human-turn state directly (avoids depending on
  // the bot's own ~550ms delayed move) — same reasoning as every other
  // game's "direct state poke" pattern for isolating one probe from the
  // next (see e.g. CLAUDE.md's Nim smoke test notes).
  runInPage(dom, () => {
    st.turn = 'human';
    st.phase = 'idle';
    st.selectedTokenIdx = 0;
    render();
  });

  // --- Second real move: whichever row this variant's own config names,
  // to a genuinely new value — confirm it computes correctly too. ---
  const moveRow = v.move ? 0 : v.moveRow;
  const movePos = v.move ? v.move[0] : v.movePos;
  const tokensAfterMove = moveRow === 0 ? [movePos, b1] : [a1, movePos];
  const moveResult = runInPage(dom, (rowSel, idx) => {
    document.querySelectorAll(rowSel + ' .op-num')[idx].click();
    return { claimed: computePendingValue(), pendingMove: st.pendingMove };
  }, moveRow === 0 ? '#operand-row-a' : '#operand-row-b', idxFor(movePos, moveRow === 0 ? v.rowA : v.rowB));
  check(`${v.file}: second move to row ${moveRow} = ${movePos} computes the right claimed value`, moveResult.claimed === v.claimedValue(tokensAfterMove), JSON.stringify(moveResult));
  assert.deepStrictEqual(moveResult.pendingMove, { type: 'move', idx: moveRow, pos: movePos });

  const answer2 = v.answerFor(tokensAfterMove);
  const afterCheck2 = runInPage(dom, (ans) => {
    el('answer-input').value = ans;
    el('check-btn').click();
    return { msg: el('compute-msg').textContent, tokens: st.tokens.slice() };
  }, answer2);
  check(`${v.file}: correct second-move answer (${answer2}) is accepted`, afterCheck2.msg === 'That checks out!', JSON.stringify(afterCheck2));
  check(`${v.file}: st.tokens committed to [${tokensAfterMove}]`, JSON.stringify(afterCheck2.tokens) === JSON.stringify(tokensAfterMove));

  // --- Anti-stalemate rule (real playtesting bug report — see CLAUDE.md's
  // design note): attempting to move the SAME row right back to its
  // previous value (recreating [a1,b1]) must be rejected. ---
  runInPage(dom, () => {
    st.turn = 'human';
    st.phase = 'idle';
    st.selectedTokenIdx = 0;
    render();
  });
  const reversalAttempt = runInPage(dom, (rowSel, idx) => {
    const before = st.tokens.slice();
    document.querySelectorAll(rowSel + ' .op-num')[idx].click();
    return { tokensUnchanged: JSON.stringify(st.tokens) === JSON.stringify(before), pendingStillNull: st.pendingMove === null, turnStatus: el('turn-status').textContent };
  }, moveRow === 0 ? '#operand-row-a' : '#operand-row-b', idxFor(moveRow === 0 ? a1 : b1, moveRow === 0 ? v.rowA : v.rowB));
  check(`${v.file}: anti-stalemate rule rejects reversing back to [${a1},${b1}]`, reversalAttempt.tokensUnchanged && reversalAttempt.pendingStillNull && /repeat/i.test(reversalAttempt.turnStatus), JSON.stringify(reversalAttempt));

  // EXPERIMENTAL (see CLAUDE.md "Answer-explanation modal & stats-demo
  // experiment") — probed only for beeline-rounding.html, the one two-row
  // variant in this pilot; the modal SHELL is already proven generic by
  // Scuttle Add/Sub's and Scuttle Product's own smoke tests, so this only
  // needs to prove Rounding's own number-line visual and wiring.
  if (v.file === 'beeline-rounding.html') {
    runInPage(dom, () => { st.turn = 'human'; st.phase = 'idle'; st.selectedTokenIdx = 0; render(); });
    const thirdMovePos = 5; // row A (idx 0) to 5 — distinct from every prior position used above
    const tokensAfterThird = [thirdMovePos, tokensAfterMove[1]];
    const correctThird = v.claimedValue(tokensAfterThird);
    runInPage(dom, (idx) => { document.querySelectorAll('#operand-row-a .op-num')[idx].click(); }, idxFor(thirdMovePos, v.rowA));

    runInPage(dom, (correct) => {
      el('answer-input').value = String(correct + 1000);
      el('check-btn').click();
      el('answer-input').value = String(correct + 2000);
      el('check-btn').click();
    }, correctThird);

    // The answer itself (#explain-modal-answer) is shown in full THE
    // INSTANT the modal opens — never staged behind the animation.
    const modalState = runInPage(dom, () => {
      const backdrop = document.getElementById('explain-modal-backdrop');
      return {
        visible: !!backdrop && !backdrop.classList.contains('hidden'),
        answerHtml: backdrop ? document.getElementById('explain-modal-answer').innerHTML : null,
        hasTrack: document.querySelectorAll('.numline-track').length,
        visualTextMidFlight: document.getElementById('explain-modal-visual').textContent,
        tokensBeforeContinue: st.tokens.slice(),
      };
    });
    check(`${v.file}: after 2 wrong attempts, the answer-explanation modal appears`, modalState.visible === true, JSON.stringify(modalState));
    check(`${v.file}: the modal states the real correct rounded value`, !!modalState.answerHtml && modalState.answerHtml.includes(String(correctThird)), JSON.stringify(modalState));
    check(`${v.file}: the modal shows a number-line visual`, modalState.hasTrack === 1, JSON.stringify(modalState));
    check(`${v.file}: the move is not committed just from the modal appearing`, JSON.stringify(modalState.tokensBeforeContinue) === JSON.stringify(tokensAfterMove), JSON.stringify(modalState));
    // EXPERIMENTAL (see CLAUDE.md "Answer-explanation modal & stats-demo
    // experiment"), revised per real feedback: the number line no longer
    // leads with "closer to... so it rounds to" reasoning — real feedback
    // called that "more of a hint." Right after the modal opens, the
    // visual should still be on its brief neutral frame (no verdict yet);
    // once it settles, it should lead with a direct "Rounds to N" headline.
    check(`${v.file}: right after the modal opens, the number line hasn't announced a verdict yet (neutral frame)`, !modalState.visualTextMidFlight.includes('Rounds to'), JSON.stringify(modalState));

    await sleep(10000); // paced from EXPLAIN_TOTAL_MS (~7s, clamped per frame); 10s clears it
    const settled = runInPage(dom, () => document.getElementById('explain-modal-visual').textContent);
    check(`${v.file}: once the reveal settles, it leads with a direct "Rounds to ${correctThird}" statement, not just reasoning`, settled.includes(`Rounds to`) && settled.includes(String(correctThird)), settled);

    runInPage(dom, () => { document.getElementById('explain-modal-continue-btn').click(); });
    const afterContinue = runInPage(dom, () => ({ tokens: st.tokens.slice(), modalHidden: document.getElementById('explain-modal-backdrop').classList.contains('hidden') }));
    check(`${v.file}: "Continue" commits the move using the real correct value`, JSON.stringify(afterContinue.tokens) === JSON.stringify(tokensAfterThird), JSON.stringify(afterContinue));
    check(`${v.file}: the modal hides again after Continue`, afterContinue.modalHidden === true);
  }
}
}

main().then(() => {
  if (failures > 0) {
    console.error(`\n  ${failures} case(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log('\n  all two-row Beeline variant smoke checks passed (Addition, Decimal, Rounding, Equivalent Fraction)');
  }
}).catch(e => {
  console.error('  ❌ smoke-beeline-two-row-variants.test.js FAILED:', e.message);
  process.exitCode = 1;
});
