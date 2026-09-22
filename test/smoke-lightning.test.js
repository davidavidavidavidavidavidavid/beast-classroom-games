/*
 * jsdom full-playthrough smoke test for both Lightning variants.
 *
 * Drives a real 10-question round through the actual click handlers —
 * typing into #answer-input and clicking Check — and asserts the score,
 * the progress dots and the end-of-round missed list all agree with what
 * the page itself computed.
 *
 * Deliberately answers one question WRONG in each variant: a drill whose
 * only tested path is "correct" never exercises the branch that records a
 * miss, and the missed list is the whole output of the exercise.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage, sleep } = require('./jsdom-helpers');

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass || !detail ? '' : ` — ${detail}`}`);
}

// checkAnswer() defers advancing by 900ms so the answer stays readable —
// see the comment at that setTimeout. Every step has to wait it out.
const STEP_MS = 1000;

async function playRound(file, wrongAt) {
  const dom = loadGame(file);

  const before = runInPage(dom, () => ({
    onSettings: !document.getElementById('screen-settings').classList.contains('hidden'),
    roundHidden: document.getElementById('screen-round').classList.contains('hidden'),
  }));
  check(`${file}: starts on the settings screen`, before.onSettings === true && before.roundHidden === true,
    JSON.stringify(before));

  runInPage(dom, () => { el('start-btn').click(); });

  const started = runInPage(dom, () => ({
    onRound: !document.getElementById('screen-round').classList.contains('hidden'),
    questions: st.questions.length,
    dots: document.querySelectorAll('.lq-dot').length,
    question: el('question').textContent,
  }));
  check(`${file}: Start puts 10 questions on the round screen`,
    started.onRound === true && started.questions === 10 && started.question.length > 2,
    JSON.stringify(started));
  // All ten dots exist from the first render, so the row can never change
  // height mid-round (CLAUDE.md "Layout stability").
  check(`${file}: all 10 progress dots are present from the first question`,
    started.dots === 10, JSON.stringify(started));

  const expected = runInPage(dom, () => st.questions.map(q => ({ prompt: q.prompt, answer: q.answer })));

  for (let i = 0; i < 10; i++) {
    runInPage(dom, (idx, wrong) => {
      const q = st.questions[idx];
      el('answer-input').value = String(idx === wrong ? q.answer + 1 : q.answer);
      el('check-btn').click();
    }, i, wrongAt);

    // Immediately after Check, the answer must still be on screen and the
    // question must NOT have advanced yet — that pause is the point.
    if (i === wrongAt) {
      const mid = runInPage(dom, () => ({
        idx: st.idx, msg: el('msg').textContent, cls: el('msg').className,
        inputDisabled: el('answer-input').disabled,
      }));
      check(`${file}: a wrong answer shows the real answer before moving on`,
        mid.idx === wrongAt && /=/.test(mid.msg) && /error/.test(mid.cls) && mid.inputDisabled === true,
        JSON.stringify(mid));
    }
    await sleep(STEP_MS);
  }

  const end = runInPage(dom, () => ({
    onResults: !document.getElementById('screen-results').classList.contains('hidden'),
    score: el('final-score').textContent,
    correct: st.correct,
    missed: st.missed.map(m => ({ prompt: m.prompt, answer: m.answer })),
    missedRows: Array.from(document.querySelectorAll('.lightning-missed-row')).map(x => x.textContent),
    missedWrapHidden: document.getElementById('missed-wrap').classList.contains('hidden'),
    verdict: el('verdict').textContent,
    rightDots: document.querySelectorAll('.lq-dot.right').length,
    wrongDots: document.querySelectorAll('.lq-dot.wrong').length,
  }));

  check(`${file}: the round ends on the results screen after 10 questions`,
    end.onResults === true, JSON.stringify(end));
  check(`${file}: scored 9/10 — exactly the one deliberately-wrong answer missed`,
    end.correct === 9 && end.score === '9 / 10' && end.missed.length === 1,
    JSON.stringify({ correct: end.correct, score: end.score, missed: end.missed }));
  // The missed entry must be the question actually got wrong, carrying the
  // REAL answer — the list exists to show what you didn't know.
  check(`${file}: the missed list names the right question and its correct answer`,
    end.missed.length === 1 &&
    end.missed[0].prompt === expected[wrongAt].prompt &&
    end.missed[0].answer === expected[wrongAt].answer,
    JSON.stringify({ got: end.missed[0], expected: expected[wrongAt] }));
  check(`${file}: the missed list is shown on screen, one row per miss`,
    end.missedWrapHidden === false && end.missedRows.length === 1 &&
    end.missedRows[0] === `${expected[wrongAt].prompt} = ${expected[wrongAt].answer}`,
    JSON.stringify(end.missedRows));
  check(`${file}: progress dots agree with the score (9 right, 1 wrong)`,
    end.rightDots === 9 && end.wrongDots === 1, JSON.stringify(end));
  check(`${file}: the summary reflects a strong round, not a perfect one`,
    end.verdict.length > 0 && !/Every one correct/.test(end.verdict), end.verdict);

  return dom;
}

async function checkPerfectRoundHidesMissedList(file) {
  const dom = loadGame(file);
  runInPage(dom, () => { el('start-btn').click(); });
  for (let i = 0; i < 10; i++) {
    runInPage(dom, (idx) => {
      el('answer-input').value = String(st.questions[idx].answer);
      el('check-btn').click();
    }, i);
    await sleep(STEP_MS);
  }
  const r = runInPage(dom, () => ({
    correct: st.correct,
    missedWrapHidden: document.getElementById('missed-wrap').classList.contains('hidden'),
    verdict: el('verdict').textContent,
  }));
  check(`${file}: a clean round hides the missed list entirely`,
    r.correct === 10 && r.missedWrapHidden === true && /Every one correct/.test(r.verdict),
    JSON.stringify(r));

  // "Another round" must genuinely reset, not resume the finished one.
  runInPage(dom, () => { el('again-btn').click(); });
  const again = runInPage(dom, () => ({
    idx: st.idx, correct: st.correct, missed: st.missed.length,
    onRound: !document.getElementById('screen-round').classList.contains('hidden'),
    currentDots: document.querySelectorAll('.lq-dot.current').length,
  }));
  check(`${file}: "Another round" resets the score and starts from question 1`,
    again.idx === 0 && again.correct === 0 && again.missed === 0 &&
    again.onRound === true && again.currentDots === 1, JSON.stringify(again));
}

async function main() {
  await playRound('lightning-multiplication.html', 3);
  await playRound('lightning-multi-step.html', 7);
  await checkPerfectRoundHidesMissedList('lightning-multiplication.html');

  if (failures > 0) {
    console.error(`\n  ${failures} case(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log(`\n  all lightning smoke cases passed`);
  }
}

main();
