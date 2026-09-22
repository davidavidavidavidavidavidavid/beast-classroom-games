# Beast Classroom — Digital Games Project

Digital bot-vs-human adaptations of Beast Classroom's in-person math fluency
games. Built as single-file-per-game HTML/CSS/JS (no build step, no
dependencies beyond Google Fonts), sharing a common design system.

## Where things stand

**Built and tested:**
- `scuttle-addition-subtraction.html` — closest-to-target, build 1 number/round.
  Within-round phase content (dice row, slot row, lock/next-round buttons,
  reveal button) now uses `.phase-hidden` instead of `.hidden` so the round
  card's height stays constant across phases — see "Layout stability" above;
  first game fixed after the bug was caught project-wide. Reveal screen now
  plays the two `design/mockups/win-visuals-mockup.html` effects (typewriter
  + single-flash banner, odometer count-up totals) — see "Celebration
  animations" below. Now has the avatar picker/badges from "Avatars" above.
  Bot difficulty description removed (not user-facing) — see "Layout
  stability" and Code conventions' `DIFF_NAME` note. Its dice/permutation
  math and screen/scorecard scaffolding now come from `shared-game.js`
  (`uniqueArrangements()` replaces the old 3-digit-only `uniquePerms()`) —
  see "File structure & the point of it". The compute screen's number
  reordering is now real drag-to-swap (◀▶ buttons gone), animated via FLIP
  — see "Drag interactions". Post-playtest: a real prominent `.stat-pill.
  target-pill` in `#top-bar` (target used to be subtle plain tagline text),
  and the drag-to-swap drop-target highlight no longer flickers (nearest-
  tile hit-testing replaced exact-pixel `elementsFromPoint`) — see
  "Post-playtest navigation & UX fixes".
- `scuttle-product.html` — split shared dice into 2 numbers, multiply, smallest-sum-over-threshold wins.
  Same `.phase-hidden` layout-stability fix applied (dice row, number frames,
  answer-check row, next-round/reveal buttons). Same win-visual reveal
  effects applied too, with `.toLocaleString()`-formatted count-up totals.
  Same avatar picker/badges from "Avatars" above. Bot difficulty description
  removed; format description converted to `.desc-line-stack` so its box no
  longer grows/shrinks between formats — see "Layout stability". First game
  whose generic `permutations()`/`combinations()`/`buildNumber()` moved into
  `shared-game.js`, since Add/Sub's own versions were the more-specialized
  ones — see "File structure & the point of it". Post-playtest: same
  target-pill treatment as Add/Sub — see "Post-playtest navigation & UX
  fixes".
- `scuttle-difference.html` — same split-into-two-numbers shell as Product
  Scuttle, subtract instead of multiply, same smallest-sum-over-threshold
  win rule (per `design/game-catalog.csv`: "same shell as Product but
  subtract"). Two formats, not four (2-digit/target 100, 3-digit/target
  500 — the exact numbers the catalog gives), each splitting the shared
  dice into two EQUAL-length numbers. One real design call the source text
  doesn't address: a "difference" is scored as `Math.abs(num1-num2)` (never
  negative), and the on-screen equation always displays larger-minus-
  smaller regardless of which frame the player put the bigger digits in —
  a signed result reading like `23 − 87 = ?` while expecting `64` would
  contradict the standard (2.NBT.B.5/7) this variant targets, which doesn't
  expect negative results. Bots reuse Product's exact split-enumeration
  machinery but needed genuinely different tuning, caught empirically (not
  assumed from Product's own heuristics) — see Bot AI philosophy and
  `test/scuttle-difference-bot-simulation.js` for the "maximize the round,
  refine only the last one" trap this surfaced. Has the avatar picker,
  target pill, and variant switcher from the start (built after the
  Post-playtest pass, so no separate retrofit needed).
- `pop-addition.html` — one shared digit revealed at a time, sequential/irrevocable placement into inside-blanks or throwaways, closest-to-target-without-busting wins (busting = instant loss).
  Bot difficulty description removed; format description converted to
  `.desc-line-stack` — see "Layout stability". Post-playtest: the shared
  die now sits between the two players' own number groups (was below
  both), who-places-first alternates every roll, and a real target pill
  replaced the plain-tagline treatment; no emoji in win/tie banners — see
  "Post-playtest navigation & UX fixes" (this game can't go negative, so
  the negative-result-display fix there doesn't apply here).
- `pop-subtraction.html` — same Pop engine, generalized to a *signed* place-value per inside addend (minuend positive, subtrahend negative) so the inside value is minuend − subtrahend. Busting has two causes here, not one: going over the target, OR the difference coming out negative (both are an outright pop, per the real rules — a negative result is NOT just "far below target," it shipped that way once and got caught/fixed, see Known Traps). Bot tiers re-verified from scratch, not assumed from Addition Pop (see `test/pop-subtraction-bot-simulation.js`).
  Bot difficulty description removed; format description converted to
  `.desc-line-stack` — its two format strings are the most extreme length
  mismatch in the project (one line vs. four), the case that actually
  proved the fix in a real browser — see "Layout stability". Post-playtest:
  same dice-position/turn-alternation/target-pill/no-emoji fixes as
  Addition Pop, PLUS a real fix for showing a negative inside result —
  `.result-total` now shows "No score" instead of a bare negative number
  (`displaySum()`) — see "Post-playtest navigation & UX fixes".
- `pop-expression.html` — same engine generalized further: 3 signed addends instead of 2 (e.g. `_ _ + _ _ − _`), confirmed direct reuse only after reading the full Teacher Instructions doc for every Pop variant at once (not assumed from the catalog's identical one-line summaries). Shares Subtraction Pop's exact two-cause bust rule.
  Bot difficulty description removed; format description converted to
  `.desc-line-stack` — see "Layout stability". Post-playtest: same full
  set of Pop fixes as Subtraction Pop (dice position, turn alternation,
  target pill, `displaySum()`'s "No score" for a negative result, no
  emoji) — see "Post-playtest navigation & UX fixes".
- `pop-perimeter.html` — same engine as Addition Pop (only ONE bust cause —
  over target — since side lengths can't go negative, unlike Subtraction/
  Expression Pop's two-cause rule), generalized with a per-addend integer
  **coefficient**: the two inside addends are a rectangle's Length and
  Width, each counted **twice** toward the perimeter — generalizes
  Subtraction/Expression Pop's ±1 `insideSigns` into an arbitrary positive
  integer (`insideCoeffs`), the exact extension `insideSigns`' own code
  comment already anticipated. `placeWeight()`/`committedInsideSum()`/
  `remainingInsideWeight()` all became coefficient-aware; every function
  built on top of them (both bot tiers, the answer-check, the hint) just
  worked once that one change was made. Two formats (1-digit sides/target
  18, 2-digit sides/target 200), each showing the perimeter equation
  explicitly as `2×length + 2×width = ?` rather than silently pre-summing
  it, reinforcing the actual 3.MD.D.8 standard (apply the perimeter
  formula) instead of just adding four numbers. Verified via
  `test/pop-perimeter-bot-simulation.js` before writing any HTML, per Bot
  AI philosophy.
- `beeline-product.html` — turn-based, deterministic, no dice: two shared tokens move along a 1-9 row, their product gets marked on a fixed 36-cell grid, first to connect four in a row wins. A genuinely different game shape than Scuttle/Pop (adversarial, perfect-information) — see Bot AI philosophy below for how that changed the bot design and verification approach. New shared component: `components/claim-grid.css`.
  Reveal now plays the banner typewriter+flash effect plus a winning-line-
  specific stagger-reveal-then-flash-then-settle (adapted from the mockup's
  color-reveal to an outline-ring reveal, since real cells are already
  colored) — see "Celebration animations" below. Replaced the prior ad hoc
  `claimWinPulse` scale-bounce, which predated that section's rules. Bot
  difficulty description removed (no format chips here, so no
  `.desc-line-stack` need) — see "Layout stability". Moving a token is now
  a real drag (continuous pointer-following, snap-to-nearest-number on
  release) instead of click-a-destination-cell-only — click still works
  too, as a fallback. Second game to link `shared-game.js`, but only for
  the drag helpers (`makeDraggable`, `prefersReducedMotion`) — its own
  `showScreen`/`updateScorePills`/etc. stay un-migrated, deliberately, see
  "Drag interactions" and "File structure & the point of it". Post-playtest
  (a real reversal of the design a few paragraphs above — see "Post-playtest
  navigation & UX fixes" for the full story): tokens now have a FIXED
  per-token color and lane (no more color/lane changing with whose turn it
  is), both are draggable/clickable at all times (the "Move token at N"
  switch-button row is gone), and the claim grid's own numbers are larger.
  **Second post-playtest round** (see "Beeline anti-stalemate fix, board
  randomization, and 5 new variants" below for the full story): a real,
  previously-shipped BUG fixed — Hard's minimax could get stuck ping-
  ponging (or, in a longer cycle, still looping) between already-claimed
  cells forever, since nothing stopped it from moving into a
  tokens-configuration the game had already visited. Fixed with
  `st.visitedTokenPairs`, enforced for both the bot's search and the
  human's own clicks/drags. Also: the 36-cell grid's layout is no longer a
  single fixed arrangement — `rebuildBoardLayout()` reshuffles cell
  POSITIONS (same 36 values) fresh every `startMatch()`. Retrofitted with
  `#variant-row`/`renderVariantSwitcher()` now that Beeline has siblings —
  see the new `beeline-menu.html`. **Third post-playtest round:** the
  claim grid and the playing space (turn status, operand row, answer-
  check) are now a side-by-side `.game-layout` (board right, play left on
  wide screens; unchanged board-on-top stacking on narrow ones) — see
  "Side-by-side board/playing-space layout" below. `#app` widened to
  900px to give that layout real room.
- `beeline-difference.html`, `beeline-addition.html`, `beeline-decimal.html`,
  `beeline-rounding.html`, `beeline-equivalent-fraction.html` — Beeline's
  first five TWO-ROW variants (one token per row, not two tokens sharing
  Product's one row), all built in the same pass and all sharing a new
  `shared-game.js` engine (`beelineLegalMoves`/`beelineApplyMove`/
  `beelineBotEasy`/`Medium`/`Hard`/etc. — see "File structure & the point
  of it" and "Beeline anti-stalemate fix, board randomization, and 5 new
  variants" below) — extracted immediately given 5 simultaneous real
  consumers, a far stronger case than this project's usual "wait for a
  second consumer" bar. Each file supplies only its own row ranges, value
  function, and board-building; the win-detection/minimax/anti-stalemate
  machinery is identical, byte-for-byte shared code. Verified together in
  one `test/beeline-two-row-bot-simulation.js` (tier ordering + zero
  stalls, per variant's own state space) before any HTML was written.
  Same side-by-side `.game-layout`/900px-`#app` treatment as Product — see
  "Side-by-side board/playing-space layout" below, including a real
  claim-grid overflow bug this pass's own Playwright check found and fixed
  (Decimal's own 4-character cell text needed both a shared `minmax(0,1fr)`
  grid fix and its own smaller `.claim-cell` font-size).
  - **Difference**: rows 1-9 × 1-9, value = unsigned `|a-b|` (0-8, 9
    distinct values) — matches Scuttle Difference's own precedent for why
    unsigned, not signed.
  - **Addition**: rows 1-9 × 1-9, value = `a+b` (2-18, 17 distinct values).
  - **Decimal**: rows deliberately scoped to 1-6 × 1-6 (not 1-9 like every
    sibling) — a tenths row and a hundredths row, value = their decimal
    sum. Unlike difference/sum, this value function is injective (no
    natural collisions), so a full 1-9×1-9 range would need 81 cells for
    only 36 available; 6×6=36 is an exact fit instead, mirroring Product
    Beeline's own elegant 1:1 board. Represented internally as an integer
    "hundredths" value, never a raw float sum (see CLAUDE.md's Numbo
    float-precision lesson) — `formatValue()` only builds the "0.37"
    display string from that integer, and the answer-check parses the
    player's typed decimal back into the same integer form before
    comparing, never float-to-float.
  - **Rounding**: rows 1-9 (tens digit) × 0-9 (ones digit), value = that
    2-digit number rounded to the nearest ten. A deliberately SCOPED-DOWN
    reading of the source catalog's "round to the place value the OTHER
    row indicates" — that fuller mechanic would need a genuinely bigger
    number and a place-selector token, not modeled in this pass; flagged,
    not silently assumed away.
  - **Equivalent Fraction**: rows 1-7 × 1-7 (not 1-9 — a,b in 1-9 yields 55
    distinct reduced fractions, too many for 36 cells; 1-7 yields 35, an
    almost-exact fit), value = the fraction's own REDUCED "na/nb" form —
    this is what makes "value = ANY equivalent fraction" (the source
    catalog's own phrasing) work with the shared engine's existing
    single-value-per-move shape unchanged: 6/8, 3/4, and 9/12 all reduce to
    the same key and claim the same cell, no new "pick which matching
    cell" UI needed. The answer-check asks a DIFFERENT question than the
    claimed value — "what did you divide both by?" (the GCF), not the
    fraction's decimal value — a deliberate scope choice avoiding a
    single-number-input fight with repeating decimals (1/3, 1/7, ...); see
    that file's own design note.
- `beeline-menu.html` — Beeline's own sub-menu, built the moment Beeline
  crossed from 1 to 6 built variants — same shape/purpose as
  `scuttle-menu.html`/`pop-menu.html`/`nim-menu.html`. 15 cards: 6 built +
  9 catalogued-unbuilt (Product of Tens, Product of 10s and 100s,
  Multiplication Representations, Mixed Number, Time, Fractions and Whole
  Numbers, Multiplying Unit Fractions, Multiplying Fractions, Angle
  Addition).
- `nim.html` — a wholly different game shape from Scuttle/Pop/Beeline: no dice, no digit arrangement, no board — just a single shared running total, alternating +1/+2 moves, race to reach or exceed a target (10). Turn-based/adversarial like Beeline, but small enough to be a genuinely SOLVED combinatorial game rather than a heuristic/depth-limited search — see Bot AI philosophy below for the first-move-forced-win nuance this surfaced (not fully covered by the existing Beeline-derived guidance) and `test/nim-bot-simulation.js`. New shared component: `components/nim-track.css` (a running-total-vs-target strip, written generically so the rest of the Nim family — Subtraction Nim, Nickeled & Dimed, Place Value Nim — can reuse it as-is). First of the six Nim-family curriculum variants; the other five (see Suggested next steps) were deliberately deferred rather than built in the same pass, at the user's explicit direction, given the real mechanical differences between them (exact-target vs. at-least-target, countdown vs. count-up, Division Nim's dynamic per-state legal moves) — see "Bot AI philosophy" and Known Traps for why the catalog's identical one-line summary across all six variants (as usual) undersells those differences, and Hexagon Nim in particular is a spatial pattern-block board game, not a running-total race, and doesn't belong to this engine at all. (One of those five, Nickeled & Dimed, has since been built too — see its own bullet immediately below; 4 curriculum variants now remain deferred, per Suggested next steps.) Has the avatar picker/top-bar badges now too (propagated project-wide — see "Avatars" above), but still no persistent 3-round scorecard (a Scuttle-only pattern — Pop/Beeline don't have one either; see the design note below), so no scoreboard-header avatar badges either, just the top-bar pair. Links `shared-game.js` for `randInt`/`prefersReducedMotion`/`fadeIn` only — writes its own local `showScreen()`/`updateScorePills()` (no `#scorecard`, no `#s-ties` pill — see below), same "only migrate what's actually needed" restraint as Beeline. Its own P-position solver (`wouldWin`/`solve`/`solveCache`) was refactored OUT into `shared-game.js` once a second real Nim consumer existed (`nim-nickeled-and-dimed.html`, below) — see that file's bullet and "File structure & the point of it" for why now, not preemptively. Post-playtest: you can now change which move you've picked before checking (clicking a different amount while awaiting the answer-check swaps `st.pendingMove` instead of being ignored) — see "Post-playtest navigation & UX fixes".
- `nim-nickeled-and-dimed.html` — Nim's second built variant, themed as money: alternately add a nickel (5¢) or a dime (10¢) to a shared pile; whoever's move brings it to **exactly** 50¢ wins. Presented as "scaled by 5" from base Nim in the source rules, but this is NOT a pure rescale and was NOT implemented as one — see the design note below for why. Triggered the shared-solver extraction: `nimLegalMoves()`/`nimImmediateWinMove()`/`nimIsWinningPosition()`/`nimOptimalMove()` now live in `shared-game.js`, parameterized by `moveSet` and a `reachOrExceed` boolean (`true` = base Nim's "reach-or-pass-target-wins" shape, `false` = this game's "exactly-on-target-only" shape) — both `nim.html` and this file call the same functions; neither has its own local solver anymore. `botChooseRound`/`decideWinner` stay per-file (Code conventions), but their bodies are now thin calls into the shared solver. Presentation-only differences from base Nim: currency-formatted display (`fmtCents()`, "35¢" not "35"), button labels ("Add a nickel (+5¢)"/"Add a dime (+10¢)"), and `renderTrack()` stepping by 5s (11 cells: 0,5,...,50) instead of by 1s, since every reachable total is a multiple of 5. Who-goes-first alternation (`nextStarter`, kept outside `st`, untouched by score resets) is identical to base Nim's, for the identical reason — see the design note below on why this wasn't turned into a manual picker despite "explicit choice" phrasing in the request. No new fluency feature was added for "say the total out loud" — see the design note below for why the existing retry-until-correct new-total check already covers it. Verified via `test/nim-nickeled-and-dimed-bot-simulation.js`, including a direct cross-scale equivalence check against base Nim's already-solved values (see Bot AI philosophy). Post-playtest: same change-your-move-before-checking fix as base Nim, layered on top of its own existing per-coin legal-move disabling — see "Post-playtest navigation & UX fixes".
- `nim-subtraction.html` — Nim's third built variant: a pile starts at 20
  tokens, each turn removes 1, 2, or 3, and whoever removes the LAST token
  (brings the pile to exactly 0) wins — a countdown, not a count-up, but
  maps onto the exact same shared solver with zero new machinery:
  `distanceToTarget` is just the current pile size (not `TARGET - total`,
  the count-up siblings' own formula — that would have the wrong sign
  here), and `reachOrExceed=false` does the same "can't overshoot" job it
  does for Nickeled & Dimed, just meaning "can't remove more tokens than
  remain" instead of "can't pass the target." A genuinely new, real finding
  this variant surfaced (see Bot AI philosophy and the design note below,
  not assumed from either count-up sibling): for THIS starting pile (20)
  and move set ({1,2,3}), going **second** — not first — is the forced-win
  seat, the opposite of base Nim's and Nickeled & Dimed's own math.
  Verified directly against the real shared solver (`nimIsWinningPosition
  (20, [1,2,3], false) === false`) before writing a single "never loses"
  assertion — `test/nim-subtraction-bot-simulation.js` asserts "Hard moving
  SECOND: 500/500" as the exact claim instead, and separately confirms
  (without requiring an exact record) that Hard moving FIRST still wins
  comfortably against imperfect opponents despite starting from a real
  disadvantage. `nextStarter` still alternates every round for the
  identical fairness reason as both siblings — it's just the advantaged
  seat itself that's flipped.
- `nim-menu.html` — Nim's own sub-menu, same shape/purpose as `scuttle-menu.html`/`pop-menu.html` (built the moment Nim turned out to ALSO have a second built variant — Nickeled & Dimed — not "exactly one" the way Beeline/Numbo/Detective genuinely still do; see the "Pop needed its own sub-menu" design note below, which generalizes the same way). 6 cards: 3 built (Race to 10, Nickeled & Dimed, Subtraction Nim) + 3 catalogued-unbuilt (Division Nim, Hexagon Nim, Place Value Nim). `index.html`'s Nim card and the global nav dropdown both now point at this page (`multiVariant: true`, `href: 'nim-menu.html'` in `GLOBAL_GAMES`) instead of straight at `nim.html` — see the corrections to the design notes below, which were written before Nim had a second variant and said the opposite.
- `numbo-operations.html` — a genuinely new engine shape for this project: no fixed arrangement to fill, an OPEN expression-construction problem (the classic "24 game"). Roll 4d10; the active player (alternates) sets a target under 100; everyone builds one expression from all four rolled digits (each used exactly once, `+ - * /` and parentheses, no concatenating digits into multi-digit numbers) as close to the target as possible; closest scores a point, **a tie scores BOTH players a point** (the real rule — see the design note below, a genuine deviation from every other game's tie handling); first to 5 points wins the match. Needed two wholly new pieces of engineering: a real recursive-descent expression parser/evaluator for the human's typed input (never `eval()`/`Function()` on raw text) that validates syntax, precedence, and that the typed expression's digit multiset exactly matches what was rolled; and an exhaustive "24-game" solver bot (every ordering × all 5 binary-tree parenthesizations × every operator triple = up to 7680 candidate expressions, evaluated to find the true closest-to-target value) — see Bot AI philosophy below for why this makes "Hard never loses" an *exact*, not statistical, claim, closer to Nim's solved-game guarantee than to Beeline's turn-based one, despite Numbo not being adversarial/turn-based at all. "Numbo" itself has no standalone win condition — only its named variants do (a correction in the same spirit as "Big Number Pop is NOT this engine at all," see Suggested next steps) — so this file is named for its variant, `numbo-operations.html`, not a bare `numbo.html` the way `nim.html` could be. First of three named Numbo variants; the other two (Equivalent Fraction Numbo, Fractions of Amounts Numbo) both depend on a physical "game board" this project doesn't have — see the design note below for the placeholder specs written up (not built) for them, at the user's explicit direction, pending the real boards. Has the avatar picker/top-bar badges now too (see "Avatars" above — this reverses an earlier version of this note, which grouped avatars in with the reasons below; that grouping no longer holds now that avatars are project-wide, see the Avatars section's own note on this), but still no persistent scorecard, no `#s-ties` pill (same reasoning as Nim's design note, extended below). Post-playtest: free typing into `#expr-input` replaced with a clickable keyboard (digits/operators/parens/backspace/clear), and the round's own sub-phase blocks were switched from `.phase-hidden` to `.hidden` (they're mutually exclusive, not within-round phase content — reserving all five's space at once was producing real dead blank space) — see "Post-playtest navigation & UX fixes".
- `detective-fraction-equivalence.html` — a genuinely different SOURCE and SHAPE from every other game: ported from `design/legacy/fraction-detective-original.html`, a complete working game from a prior (non-Beast-Classroom) project, not from the curriculum catalog at all (it isn't in `design/game-catalog.csv`). **Single-player** — no bot, no opponent, no `decideWinner`, no avatar picker, no You/Bot scoreboard; see the design note below for which two-player conventions genuinely don't apply here and which single-player ones take their place. A Wordle-style equivalence puzzle: given a hidden target fraction, build any *equivalent-but-different-looking* fraction one digit at a time, six guesses per puzzle, with Wordle digit feedback (right digit/right slot, right digit/wrong slot, absent) accumulating on an on-screen keyboard across guesses. Difficulty auto-progresses by round number via a `LEVELS` table and `getRoundLevel()`; after round 10, "endurance mode" replaces round-based progression with a shared 50-guess budget across unlimited puzzles. The original's game logic — the `LEVELS` table, `generatePuzzle()`'s rejection-sampling (retries up to 2000 times per puzzle), the flattened-digit Wordle-coloring algorithm, the endurance trigger/mechanics, the flipped-equation win rule, and the hint-at-2-misses pattern — is preserved EXACTLY, per explicit instruction; only its throwaway CSS was replaced (with a new shared component, `components/wordle-slot.css`) and its state/rendering reorganized around this project's conventions (`st`, `el()`, `showScreen()`, `.phase-hidden`/`.hidden`) — including renaming the original's `init()`/`fullReset()` to this project's fixed `startRound()`/`startMatch()` (a new puzzle within the same running round/streak counts IS "start a round"; a full reset back to round 1 IS "start a match" — a clean, exact mapping, and a pure rename with zero behavior change, unlike the preserved logic itself). The one change to the preserved logic itself: `Math.floor(Math.random() * X)` calls became `shared-game.js`'s `randInt(X)` — the identical formula, so the actual puzzle distribution is untouched; this is the same "check shared-game.js first" discipline as every other game, not a rewrite. `generatePuzzle()` now returns a GENERIC puzzle contract (`parts`, `equivalentOrderings()`, `isValidGuess()`, `hintText`, `displayText`) that the rest of the game loop consumes without knowing it's a fraction — see the design note below for why, and for how much of "Detective" is actually meant to be a family. First of a NEW single-player test-file naming pattern (`puzzle-logic.*`, not `decide-winner.*` — see Code conventions and Testing methodology). Post-playtest: input now sits in its own column to the left, guess history in its own column to the right (`.game-columns`/`.game-input-col`/`.game-history-col`, stacking below ~560px) instead of history stacking above the input and pushing the keyboard down the page; the fraction bar (`.fbar`) is thicker, nudged down, and extended past the digit boxes so it no longer blends into a digit box's own drop shadow — see "Post-playtest navigation & UX fixes".
- `index.html` — the project's actual landing page (was `scuttle-menu.html`, until this restructuring — see below). Hosts the boot sequence (see "Boot sequence"). Below it: one card per GAME, never per variant (see "File naming convention") — the H1 reads the umbrella brand "BEAST 64" (`.logo`, its own bigger pixel-font treatment, scoped to this one page — renamed from plain "BEAST" on 2026-09-15, see "Print button, BEAST 64 rebrand, and a trimmed 'Coming Soon' catalog" below), not a single game's name, since this page isn't any one game. Cards render dynamically from `shared-game.js`'s `GLOBAL_GAMES` — the SAME list `renderGlobalNav()`'s dropdown reads — laid out 2-up in `.game-grid` (1 column below 480px). Originally every catalogued-but-unbuilt game (43 of them, everything in `design/game-catalog.csv` besides the 6 built games) got its own locked "Coming soon" card too, at the user's explicit direction, for a genuinely comprehensive roadmap view — **as of 2026-09-15, only 2 of those locked cards remain (Pig, Math Match)**, every other catalogued-but-unbuilt game trimmed from `GLOBAL_GAMES` itself at the user's later, explicit direction — see that same section below for the full reasoning. **Redesigned after real playtesting — see "Post-playtest navigation & UX fixes" for the full story:** every playable game's card now has a real "Play →" link straight into an actual game file (never a "choose one" menu page in between). A single-variant game (Beeline, Numbo, Detective) is still one big clickable `<a>`, unchanged. A multi-variant game (`multiVariant: true` — Scuttle, Pop, Nim, each genuinely more than one shipped file) is now a plain `<div>` (its "Play →" badge is its own `<a>`, straight to that family's DEFAULT/first-listed variant) with a small expandable "▾ N variants" disclosure underneath, listing every sibling as its own direct link — replacing the old "See variants →" link into that family's own sub-menu page.
- `scuttle-menu.html` — Scuttle's own sub-menu now (no longer the whole-project hub, no boot sequence) — one card per Scuttle variant: 3 built (Addition & Subtraction, Product, Difference) + 4 catalogued-but-unbuilt (Remainder, Decimal, Super Product, Super Decimal), the same 7 this family has always listed. `<h1>SCUTTLE</h1>`, kicker "Choose your variant" — matches the same Kicker Chip Pattern every actual game page uses, since this page names one specific game family, unlike `index.html`.
- `pop-menu.html` — Pop's own sub-menu, same shape as `scuttle-menu.html` (built the moment Pop turned out to ALSO have multiple built variants — addition/subtraction/expression — not "exactly one" the way Beeline/Numbo/Detective genuinely do; see "Global navigation"'s note on why Pop needed this and Beeline/Numbo/Detective don't). 11 cards: 4 built (Addition, Subtraction, Expression, Perimeter) + 7 catalogued-unbuilt (Big Number, Powers of Ten, Multiplication, Fraction Multiplication, Fraction Addition & Subtraction, Mixed Number Multiplication, Mixed Number Addition & Subtraction — the same "~8 more" Suggested next steps already tracked, now visible in the UI as locked cards instead of only living in this doc).

**Design note — Pop needed its own sub-menu because it has 3 built variants, not "exactly one," despite an early version of this restructuring's plan listing it under the single-variant bucket:** the actual rule is, and always was, about SHIPPED FILE COUNT — Scuttle (2 files) and Pop (3 files) both need a "which one do you mean" sub-menu; Beeline/Numbo/Detective (1 file each) don't. `scuttle-menu.html`'s own pre-existing "Scuttle" section was always evidence this rule was already in effect for Scuttle specifically; Pop's 3 built files were always the same situation, just not initially recognized as such. **Nim later joined Scuttle/Pop in this bucket too** the moment `nim-nickeled-and-dimed.html` shipped as a second built Nim file — see that file's own bullet and `nim-menu.html`'s. The rule itself didn't change; a game's bucket membership is just a live fact about shipped-file count, re-checked each time a new variant of an existing single-file game gets built, not a one-time classification frozen at whatever count a game happened to have when this restructuring was first written.

**Design note — `.variant-list`/`.variant-card`/`.badge`/etc. moved from being `scuttle-menu.html`-only CSS into `design-system.css`** the moment a second file (`pop-menu.html`) needed the exact same card look — the same "don't just extract shared CSS" discipline (see "File structure & the point of it") applied to a THIRD kind of file this time: not a game, but a sub-menu. `index.html`'s own `.game-grid` reuses these same `.variant-card` etc. classes for its cards too, just inside a 2-column CSS grid container instead of `.variant-list`'s single flex column — the cards themselves are identical either way.

**Design note — a real, deliberate loss of visibility this restructuring
introduces, flagged rather than silently accepted:** the OLD all-in-one
`scuttle-menu.html` (before this restructuring) showed every single-
variant game's own catalogued-but-unbuilt SIBLING variants as their own
"Coming soon" cards right next to that game — Nim's section showed
Subtraction Nim/Nickeled & Dimed/Division Nim/Place Value Nim/Hexagon Nim;
Numbo's showed Equivalent Fraction/Fractions of Amounts; Detective had
none yet to show. None of those variant-level cards had a live UI home
at the time this note was first written. This followed directly and
correctly from the user's own stated rules (one card per GAME on
`index.html`, never per variant; a single-built-variant game's card links
straight to its one file, no sub-menu) — at the time, Nim/Numbo/Detective
didn't qualify for their own sub-menu page the way Scuttle/Pop did (2-3
built files each), and `index.html` itself only ever showed ONE "Nim"
card, not five. **Nim's own locked siblings got their visibility back
since this note was first written** — once `nim-nickeled-and-dimed.html`
shipped as a second built Nim file, Nim gained its own `nim-menu.html`
(same as Scuttle/Pop) and its 4 remaining catalogued variants (Subtraction
Nim, Division Nim, Hexagon Nim, Place Value Nim) are locked "Coming soon"
cards there again — this wasn't a deliberate re-add, just the natural
consequence of Nim crossing the same built-file-count threshold Pop
already had. Numbo and Detective's own sibling variants are still only
visible in this doc, not in the live UI, for the same reason as ever:
neither has a second built file yet. If Numbo/Detective's visibility is
wanted back before either actually gets a second built variant, the
natural fix (not implemented here, since it wasn't asked for) would be
giving every game family a sub-menu regardless of built-variant count — a
bigger, different decision than what was requested, so flagged rather
than made unilaterally.

**Design note — Nim has no "Ties" pill and no persistent scorecard, and this is a real mechanical fact about the game, not just an omission:**
a round of Nim can never end in a tie — the total only ever increases, so
someone always eventually crosses the target — so a "Ties: 0" stat pill
(the pattern every other game's top bar uses) would be permanently dead UI,
not just usually zero. `decideWinner(total, mover)` reflects this directly:
it only ever returns `'human'` or `'bot'`, never `'tie'`, unlike every
other game's 3-way contract. Relatedly, there's no persistent 3-round
`#scorecard` either — that turned out to be a Scuttle-only pattern all
along, not a universal one: Pop and Beeline's own "Play again" buttons both
call `startMatch()`, which resets the score to zero and starts over — there
is no multi-round "match" concept in either of them, despite `st.round`
existing in Pop's state. Nim follows that same Pop/Beeline shape (a single
race is a whole "match"; cumulative score across repeated plays lives only
in the top-bar pills), not Scuttle's. One new wrinkle Nim adds on top of
that shared shape: going first is a real, PROVEN advantage in this exact
race (see Bot AI philosophy below), so `nextStarter` alternates who starts
each round — deliberately kept outside `st` and untouched by `startMatch()`'s
score reset, so fairness holds across a whole session of repeated
"Play again" clicks, not just within one already-decided match.

**Design note — Nickeled & Dimed is NOT a pure rescale of base Nim, despite
the source rules literally saying "same structure... scaled by 5," and the
one place that distinction actually mattered was overshoot:** the user's
own framing offered a "divide by 5, call the base solver, multiply the
result back by 5" shortcut, which was deliberately NOT taken. Rescaling
only actually holds for the *optimal-move* math — the WIN CONDITION shape
is genuinely different. Base Nim wins on reaching *or passing* the target
(`reachOrExceed=true` — an overshoot still wins, so every move is always
legal). Nickeled & Dimed's real rule is landing on the target **exactly**
("brings the pile to exactly 50¢") — overshooting doesn't win, and the
source text never says what happens if it occurs. Rather than inventing an
answer to a question the rules don't address (does the game just... never
end? is overshoot a bust?), the shared solver takes a `reachOrExceed`
boolean that ALSO gates move *legality*, not just win-checking
(`nimLegalMoves()`): when `false`, a move that would pass the target is
filtered out before a player (human or bot) ever gets to choose it — the
dime button disables itself the instant adding it would exceed 50¢, and
every bot tier's random/greedy/optimal choice is drawn only from the
legal set. This is provably safe, not just convenient: every reachable
total under {5,10} starting from 0 is a multiple of 5 (verified by a
breadth-first reachability search before writing any game code), so a
nickel is *always* a legal move whenever the game is still in progress —
the pile can never get stuck one coin short with no legal move at all.
`decideWinner` itself still checks `total === TARGET` with a plain `===`,
defensively correct on its own even though overshoot should never reach it
in real play (see `test/decide-winner.nim-nickeled-and-dimed.test.js`'s
explicit overshoot cases). Net effect: no rescaling layer exists anywhere
in the code — `nimOptimalMove(distanceToTarget, moveSet, reachOrExceed)`
and its siblings are called directly with each game's own real numbers
(`[1,2]`/10/`true` for base Nim, `[5,10]`/50/`false` here), and the two
games' decisions are proven to correspond via a direct cross-scale
equivalence test (see Bot AI philosophy and
`test/nim-nickeled-and-dimed-bot-simulation.js`) rather than by sharing a
literal rescale step.

**Design note — "say the total value of the pile" needed no new feature,
because the existing engine already IS that fluency moment:** the source
rules ask the player to state the running total out loud after each move.
Every game in this project already gates a move behind typing the new
value into an answer-check box before it commits (retry-until-correct,
hint after 2 misses) — for Nickeled & Dimed that box asks for exactly the
new pile total, currency-formatted. That's the same fluency check the
rules ask for, just written instead of spoken; adding a SEPARATE "say it
out loud" step on top would be redundant busywork, not a real addition to
what 2.MD.C.8 (counting coin values) is actually assessing. No new UI was
added for this. This is a judgment call, not a rule the source text spells
out explicitly — flagged here in case a future variant's fluency ask is
NOT already covered by the existing answer-check shape and genuinely
needs something new.

**Design note — who-goes-first stayed automatic alternation, not a manual
picker, matching base Nim exactly:** the request's "keep this as an
explicit choice" language describes what `nim.html` already does
(`nextStarter` flips automatically between rounds, kept outside `st` so it
isn't reset by `startMatch()`) — it does not mean a player-facing "who
goes first?" UI control. Going first is a real, provable advantage under
perfect play in this exact race too (the underlying combinatorics are
identical, just at real coin values instead of bare numbers — see the
cross-scale equivalence design note above), so the same automatic
fairness mechanism applies unchanged, not a new one.

**Design note — Operations Numbo's tie rule is the opposite of every other
game's, and this is the real rule, not a bug:** every other game's
`decideWinner` treats `'tie'` as a third, non-scoring outcome (Scuttle/Pop
track it in a separate `score.ties` bucket; Beeline's board-full tie scores
neither side). The real Numbo rule is explicit: *"In the event of a tie,
all players who were closest get a point."* `applyRoundScore(score,
winner)` implements this literally — on `'tie'`, **both** `score.human`
and `score.bot` increment. That also means a tie round can push both sides
to the win threshold in the same round, so `matchWinnerFromScore(score)` is
a genuinely separate check from `decideWinner` (which stays the ordinary
per-round pure comparison, per Code Conventions) — it can return `'tie'`
too, for a real simultaneous match-level tie, not a coin-flip tiebreak.
Same no-`#s-ties`-pill reasoning as Nim's note above, but for the opposite
underlying fact: Nim has no ties pill because a tie is *impossible*;
Numbo has no ties pill because a tie *isn't a separate bucket* — it's both
sides' own scores moving together, which the existing "You N · Bot N" pills
already show correctly without a third number. Two more deliberate
divisions of labor worth noting: (1) a **structural** submission problem
(bad syntax, wrong digit multiset, divides by zero) shows its own specific,
already-self-explanatory error message and does **not** increment
`wrongAttempts` or trigger the hint mechanic — only a **value mismatch**
against an otherwise-valid expression does, mirroring every other game's
"type the right number" gate specifically (see Testing methodology's new
point 11). (2) claimed-value matching uses a *human*-scale tolerance
(`HUMAN_TOLERANCE = 0.01`, accepting reasonable decimal rounding, e.g. for
a `7/3` result) that's deliberately looser than the *float-noise* tolerance
(`EPS = 1e-9`) used everywhere the engine compares two of its own exactly-
computed values — conflating these two would either reject reasonable human
rounding or silently accept a real arithmetic mistake.

**Design note — placeholder specs for the two Numbo variants not yet
built**, written at the user's explicit direction (not implemented — no
HTML shipped for either), since both depend on a physical "game board" this
project doesn't have and the source text doesn't fully specify:
- **Equivalent Fraction Numbo**: the real doc gives no dice count and never
  explains how rolled digits combine with a board's printed target
  fractions — proposed placeholder: roll 2d10, draw one target fraction
  from a fixed pool of simple fractions (denominators 2-10), build a
  numerator/denominator from the rolled digits (cross-multiplication check
  for equivalence: `humanNum * targetDen === targetNum * humanDen`, plus a
  distinctness check so the target itself doesn't count). Note this is
  **not** Operations Numbo's round shape — the real rule ("each distinct
  answer is worth 1 point") implies finding *several* answers per round,
  closer to the base Numbo page's original "find as many as you can" loop
  than to Operations Numbo's one-expression-race-to-5. Needs its own round
  structure, not a copy of `numbo-operations.html`'s.
- **Fractions of Amounts Numbo**: dice count IS given (2d6 + 4d10), but
  "number frames" is a board-image-dependent term with no description —
  proposed placeholder: a `_/_ of _ _` frame (a fraction times a 2-digit
  amount, matching 5.NBT.B.4's actual standard), 4 of the 6 rolled digits
  filling it. Also not Operations Numbo's shape: score is 1 point per
  *distinct target hit*, for **each** of 1 through 10 in a single sitting —
  a multi-target coverage game, not a single closest-wins race.

Both need their real game boards (or at least a description of them) before
being built for real, per the "a rules doc describes mechanics, not a
physical board's exact layout" lesson already learned once from Beeline
(see Known Traps) — swap these placeholders out the moment the real boards
turn up, the same way Beeline's own placeholder cell layout is flagged to be.

**Design note — Detective is single-player, and that changes which
conventions apply:** every convention keyed to a bot-vs-human match doesn't
transfer here, and shouldn't be forced to. No `decideWinner` (there's no
opponent to compare a result against — winning a puzzle is just "did the
guess match," not a comparison). No avatar picker, no You/Bot scoreboard,
no `#s-ties`/score pills of any kind (`st.solved`/`st.streak`/`st.round` are
plain running counters, not a match score). No `botChooseRound`/Bot AI
philosophy tiers (nothing computes a move on the player's behalf). What
*does* still apply, unchanged: `st` as the state object name; `el(id) =>
document.getElementById(id)`; a `showScreen()`-style lifecycle for the one
real top-level swap this game has (`screen-game` / `screen-gameover` — the
endurance-mode "out of guesses" summary, the only place play stops
entirely rather than a fresh puzzle just starting); the shared visual
system (`design-system.css` tokens, the pixel-shadow button language,
Rubik/Press Start 2P, the Kicker Chip Pattern); the retry-with-hint answer-
check shape (wrong guess → try again, hint unlocks after 2 misses) that
every other game already uses, just applied to "guess the right fraction"
instead of "guess the right sum."

**Design note — "Detective" is a potential FAMILY, and the file is
structured so a sibling variant's generator is swappable without touching
the game loop:** the user's framing (decimal equivalence, factor pairs,
...) is exactly the same shape as Nim/Numbo's families — one shared engine,
several possible variants — so `generatePuzzle()` doesn't hand the game
loop a fraction-shaped object directly. It returns a small generic
contract instead: `parts` (the flat guessable values), `equivalentOrderings
(parts)` (every arrangement that represents the SAME underlying claim —
generalizes the "flipped equation still wins" rule, and doubles as the
duplicate-guess check, since both are really the same symmetry concept:
"does this parts-array say the same thing as that one"), `isValidGuess
(parts)` (this variant's cross-multiplication check — a sibling with no
such validity concept could just always return true), and `hintText`/
`displayText` (precomputed human-readable strings, so the generic loop
never needs to know these are numerator/denominator pairs). Slot
management (`buildSlots`, `slotInput`, `slotDel`, `getPartValue`,
`colorDigits`, `updateKbColors`, guess history/duplicate-checking) is
written purely in terms of this contract — genuinely part-count- and
structure-agnostic, not just fraction code with the word "fraction"
find-replaced out. What's deliberately NOT generalized: `renderInputSlots()`
(the fraction-bar-and-equals visual layout) stays bespoke to this variant,
same as every other game's own rendering is bespoke on top of shared
scaffolding — a sibling variant would write its own version of this one
function, not configure a generic one. `LEVELS`/`getRoundLevel()`/the
round-based-progression-then-endurance-mode shape are treated as
Fraction-Equivalence-specific tuning, not asserted to be a Detective-family
universal (a sibling variant might use a completely different difficulty
curve, or no endurance mode at all) — nothing in the game loop hardcodes
"round <= 3" or "round >= 10" outside this variant's own progression logic.

**Design note — two new, deliberate `.hidden` vs `.phase-hidden` judgment
calls this game needed, beyond CLAUDE.md's existing categories:**
1. `#endurance-bar`/`#guesses-pill` — a ONE-TIME, whole-session transition
   (round >= 10, never reversed short of a full restart). Reserving their
   space from round 1 (the `.phase-hidden` default instinct) would mean a
   permanent visible gap for the several rounds before either is ever
   relevant; a single one-time jump the moment endurance actually starts
   is the better tradeoff for a transition this rare — the same call
   already made, without controversy, for every other game's end-of-match
   banner. Deliberately `.hidden`.
2. `#input-wrap` — NOT a visibility toggle at all (it's always visible,
   just rebuilt every puzzle), so neither category technically applies,
   but the underlying concern does: the number of digit boxes per part
   grows from 1 to 2 digits as puzzles get harder, and everything below it
   (message, keyboard, hint, buttons) would jump if that ever changed its
   height. Worked out by exact box-model arithmetic instead of assuming
   the worst: a `.num-group`'s height never actually depends on how many
   boxes are in it (44px either way — width is what grows), and the
   computed worst-case content width (both fractions 2-digit numerator AND
   denominator, Level 6's hardest case) is ~204px — comfortably inside any
   realistic container this project targets, so the row-wrapping that
   WOULD change the height is never actually reachable. `min-height:108px`
   here is therefore a deliberate, provable GUARANTEE bounded by an exact
   constant (no `LEVELS` entry ever exceeds 2 digits per part, `maxAns`
   never exceeds 99) — not a fix for a jump that was empirically
   happening, since arithmetic shows there wasn't one. Worth remembering
   as its own case of the general principle: a `min-height` fixes nothing
   by itself (Layout Stability's own `.desc-line-stack` note: "a floor,
   not a ceiling") — it only becomes a real guarantee once the actual
   worst-case content height is independently known, computed here rather
   than measured in a real browser (unlike `.desc-line-stack`'s text-
   wrapping, this is fixed pixel arithmetic with no rendering ambiguity to
   check).

**Designed but not built** (see `/design/` folder):
- `beeline-board-mockup.html` — Connect-4-style claiming grid; already extracted into `components/claim-grid.css` and built for real in `beeline-product.html`, kept here as the original sketch/reference.
- `pig-mockup.html` — push-your-luck risk meter (new component)
- `mathmatch-mockup.html` — flip-card memory grid (new component)
- `decimal-tile-concept.html` — a small diamond tile for decimal points, extending the dice-tile family

**Catalog:** `/design/game-catalog.csv` — 126 total game variants cataloged from
the full Beast Classroom curriculum (~50 base games), grouped into ~20 reusable
"engine families." Read this before starting any new game — there's a good
chance it's a variant of something already scoped, not a new build.

## File structure & the point of it

```
design-system.css          <- EVERY game links this. Universal tokens + generic
                               components (buttons, cards, scoreboard, answer-
                               checking UI, reveal screens). Change the whole
                               system's look by editing ONLY this file.
shared-game.js              <- The JS equivalent of design-system.css — pure math
                               (dice rolls, permutations/combinations, digit
                               arrangement, shuffleArray()), a Nim-family
                               P-position solver
                               (nimLegalMoves/nimImmediateWinMove/
                               nimIsWinningPosition/nimOptimalMove —
                               parameterized by moveSet + a reachOrExceed
                               boolean, see Nim's own "Where things stand"
                               entries and Bot AI philosophy), a Beeline
                               two-row engine (beelineLegalMoves/
                               beelineApplyMove/beelineBotEasy/Medium/Hard/
                               beelineDecideWinner/etc. — see "Beeline
                               anti-stalemate fix, board randomization, and
                               5 new variants" and each two-row variant's own
                               "Where things stand" entry), game-shell
                               scaffolding (showScreen, score pills, the
                               persistent scorecard), the global navigation bar
                               (renderGlobalNav()/GLOBAL_GAMES — see "Global
                               navigation"), and pointer-drag plumbing
                               (makeDraggable, the FLIP helpers — see "Drag
                               interactions" below) that's identical in *shape*
                               across games, parameterized by each game's own
                               state/DOM ids rather than assumed. Linked via a
                               <script src="shared-game.js"> tag placed BEFORE
                               a game's own inline <script> tag. Linked by every
                               built game/menu page at this point
                               (scuttle-addition-subtraction.html,
                               scuttle-product.html, every Pop/Numbo/Detective
                               file, beeline-product.html, nim.html,
                               nim-nickeled-and-dimed.html, index.html, and
                               every *-menu.html sub-menu) for at least
                               renderGlobalNav(); which of a game's OWN
                               screen/scorecard/drag functions are actually
                               migrated on top of that varies per file and is
                               called out in that file's own "Where things
                               stand" entry (e.g. beeline-product.html links it
                               only for the drag helpers, deliberately keeping
                               its own showScreen()/updateScorePills() local —
                               see "Drag interactions" for why). Before writing
                               a new helper in a game's inline <script>, check
                               whether an equivalent already exists here first
                               — see "Don't just extract shared CSS" below.
components/
  dice-slot.css             <- Shared by Scuttle-family games only (dice tiles +
                               place-value slots). Non-Scuttle games won't link it.
  claim-grid.css            <- Shared by Beeline-family games only (the 36-cell
                               claim grid + operand row + token switcher).
                               Extracted from design/beeline-board-mockup.html
                               when Product Beeline was first built for real.
  nim-track.css              <- Shared by the Nim family (a running-total-vs-
                               target strip). Extracted on Nim's first real
                               build rather than a prior mockup, since the
                               visual is simple enough to design directly —
                               written generically (no game-specific numbers),
                               confirmed by reuse: nim-nickeled-and-dimed.html
                               links it unchanged (just stepping its track by
                               5s instead of 1s — see its own "Where things
                               stand" entry), and Subtraction Nim / Place Value
                               Nim can still reuse it as-is once built.
  (future: risk-meter.css, flip-card.css — one per new engine family,
   extracted from the /design/ mockups when first built for real)
<game>-<variant>.html       <- Each game: a couple of <link> tags to the shared
                               CSS, plus a SMALL <style> block for whatever's
                               genuinely unique to that game (10-20 lines, not 300)
                               See "File naming convention" below for how
                               <game> and <variant> are chosen.
index.html                  <- Hub page (the project's actual landing page — see
                               "Where things stand" and "Global navigation").
                               <game>-menu.html sub-menus (scuttle-menu.html,
                               pop-menu.html, nim-menu.html) are each a single
                               game family's own variant picker, not the hub.
design/                      <- Mockups, the catalog CSV, the rules index and the
                               fluency-tracking design plan. Reference material,
                               with ONE exception: BC_Logo_Whiteoutline.png is a
                               real production asset (the global nav's wordmark).
                               Referenced from here rather than copied elsewhere,
                               so there is only ever one copy of the artwork.
```

**Why this matters:** we deliberately refactored out of "each game has its own
full copy of the CSS" specifically so a future design change is a one-file
edit, not a 100-file edit. Preserve this — when adding a new game, prefer
reusing/extending the shared files over re-inlining styles.

**Don't just extract shared CSS — the same check applies to JS.** This gap
is exactly what prompted `shared-game.js` to get created after the fact
instead of the first time it was needed: `design-system.css`'s existence
made "did I duplicate CSS?" an easy habit to remember, but there was no
equivalent prompt for JS, so `scuttle-addition-subtraction.html` and
`scuttle-product.html` accumulated real duplicated logic — dice rolls,
permutations, screen swapping, scoreboard updates, some of it duplicated
with small hardcoded differences (a 3-digit-only permutation helper in one
file, a generic one already sitting in the other) — with nobody checking
whether it already existed elsewhere until it was pointed out directly.
Before writing a new helper function in a game's inline `<script>`, check
whether an equivalent already exists in `shared-game.js` or another game's
file first — the same "read before you build" discipline already applied
to CSS, and to the game-catalog CSV before starting a new game.

## File naming convention

Game files are named `<game-name>-<variant>.html`, where the prefix is the
**actual game's name** — never "scuttle" used as a catch-all for every game in
this project. Pop is a different game from Scuttle. Beeline is a different
game from both. Its files are `pop-addition.html`, `pop-subtraction.html`,
etc. — never `scuttle-pop-addition.html` or similar. This is a hard
constraint, not a style preference: it's what lets a filename tell you which
game engine a file belongs to at a glance, even as the catalog grows toward
~50 base games.

(The existing `scuttle-*.html` files predate this rule and are exempt —
`scuttle-addition-subtraction.html` and `scuttle-product.html` are correctly
named, since Scuttle genuinely is their game name. It applies starting with
the next game built.)

## Design system conventions (locked in — don't re-derive)

- **Colors:** Beast Blue `#125392` = You, Beast Red `#CD2027` = Bot. Sampled
  directly from the real Beast Classroom logo. Never invent new brand colors.
- **Type:** Press Start 2P *only* for the page H1 title and the win/lose
  banner — nowhere else, it hurts readability at small sizes. Rubik for
  everything else (body text, buttons, numbers).
- **Shadows:** hard-offset "pixel shadow," no blur (`--shadow-card`,
  `--shadow-btn`, `--shadow-sm`). This came from an explicit NES.css reference
  the user provided — don't drift back toward soft/blurred shadows.
- **Buttons press into their own shadow** on `:active` (translate by the exact
  shadow offset, shadow drops to 0) — that's the core tactile interaction,
  reused everywhere.
- **Kicker chip pattern:** every game has an H1 naming the *game* (SCUTTLE,
  POP, ...) + a bordered kicker chip naming the specific variant + a
  free-text tagline stating that variant's actual objective. Don't force
  every game's win condition into one sentence shape.
- **The H1 is never a hardcoded placeholder copied from another game's
  file — it is always that specific file's own real game name.** Say this
  plainly because the ambiguity that causes the bug is real: **"Scuttle" is
  the name of one specific game** — the first one built — **not a brand
  name for the whole system.** "Beast Classroom" is the umbrella brand
  (the boot sequence's byline, the hub's own H1); "Scuttle" is a sibling of
  "Pop," "Beeline," "Nim," "Numbo," and "Detective," not their container.
  A new game built by copying an existing file as a starting template
  (a completely reasonable way to bootstrap boilerplate) must have its H1
  updated as part of that copy, every time, with zero exceptions — check
  it explicitly before considering a new game file done, the same way a
  win condition or a file name gets checked against its own rules doc
  rather than assumed from whatever was copied. (Audited on 2026-09-09,
  prompted by a suspicion this had already happened: every built game's H1
  — `BEELINE`, `DETECTIVE`, `NIM`, `NUMBO`, `POP` ×3, `SCUTTLE` ×2 — was
  already correct at that point; the bug this rule guards against hadn't
  actually occurred yet, but the rule is worth stating explicitly rather
  than relying on it having gone unnoticed by luck.)

## Global navigation — required on every page, hub included

A persistent thin bar (`#global-nav`), fixed to the very top of the
viewport on every single page in this project — every game, `index.html`
itself, and each game family's own sub-menu (`scuttle-menu.html`, and any
future one). It sits ABOVE a game's own existing round/difficulty/score top
bar; it never replaces it. Three parts, left to right: a "Beast Classroom"
wordmark (links to `index.html`), a "Games ▾" dropdown listing every known
game with its status, and a quiet, right-aligned label naming the CURRENT
page's own game.

**Implementation is entirely JS-injected, not per-file markup** —
`renderGlobalNav(currentKey)` in `shared-game.js` builds the whole bar and
`document.body.insertBefore(nav, document.body.firstChild)`s it, rather
than every page carrying a copy-pasted `<nav>` block. Same "one edit
changes everything" reasoning as `design-system.css` itself, just for a
piece of UI instead of a style rule — there is exactly ONE real
implementation, so every page's nav is byte-identical by construction, not
by discipline. Every page's own script just needs one line,
`renderGlobalNav('<key>')`, called right after that page's own `el`
helper is defined (works safely even on pages that don't otherwise use
`el` — `renderGlobalNav()` talks to `document` directly, it doesn't rely
on the calling page's own conventions). Pass no key (or an unrecognized
one) on `index.html` itself, where no single game is "current" — the
right-aligned label is simply omitted in that case, rather than showing
something empty or wrong.

**`GLOBAL_GAMES`** (same file) is the ONE canonical list of games — both
the nav dropdown and `index.html`'s own landing-page cards read from it,
so the two surfaces can never drift out of sync with each other (adding a
newly-built game updates both at once). Originally all 49 catalogued games
were in it (6 playable, 43 locked — see "Where things stand"'s `index.html`
bullet for why that was the full catalog, not a curated subset); **as of
2026-09-15, the locked entries were trimmed down to just 2 (Pig, Math
Match)** at the user's explicit direction — see "Print button, BEAST 64
rebrand, and a trimmed 'Coming Soon' catalog" below — so the dropdown is no
longer the long, ~49-item scrolling list this paragraph originally
described; `#global-nav-dropdown`'s internal-scroll CSS
(`max-height: min(60vh, 420px); overflow-y: auto`) is left in place
regardless, since nothing about the mechanism changed, only the list's
length. Each entry: `key`, `name`, `status` (`'playable'` — at
least one variant shipped, or `'locked'` — catalogued but not yet built),
`href` (playable only — always a real game file, single-variant or
multi-, never a "choose your variant" menu page — see "Post-playtest
navigation & UX fixes" below for why this changed), `multiVariant`
(playable only — `true` for Scuttle/Pop/Nim specifically, see the design
note above on why Pop needed this despite an early miscount, and Nim's own
note on joining that bucket later), `variants` (multi-variant games only —
the family's own ordered `{name, href}` list, read by both index.html's
expandable card disclosure and each variant file's own in-game
`renderVariantSwitcher()` — see "Post-playtest navigation & UX fixes"), and
`desc` (a short player-facing description — `index.html`'s cards show it
for every game, built or locked; the nav dropdown itself doesn't need it,
just name/status).

**CSS lives in `design-system.css`** (not a per-game `<style>` block,
since every page needs it identically): `#global-nav` is `position:fixed`
with `z-index:40` — deliberately BELOW the boot screen's `z-index:100`
(see "Boot sequence" below), so the boot overlay still fully covers it
during the intro on `index.html`, and the nav bar is simply revealed
underneath once the boot screen fades. **Every page needs a top-padding
equal to the bar's height** so real content doesn't render underneath the
fixed bar — done once, universally, via `--nav-height` (a CSS variable,
so the bar's own height and the compensating padding can never drift
apart) folded into `body`'s existing padding rule, not as a per-game
`margin-top` some future game could forget to add.

Currently wired into every built game file (`scuttle-addition-
subtraction.html`, `scuttle-product.html`, `scuttle-difference.html`,
`pop-addition/subtraction/expression/perimeter.html`, `beeline-product.html`,
`beeline-difference/addition/decimal/rounding/equivalent-fraction.html`,
`nim.html`, `nim-nickeled-and-dimed.html`, `nim-subtraction.html`,
`numbo-operations.html`, `detective-fraction-equivalence.html`) plus every
hub/sub-menu page
(`index.html`, `scuttle-menu.html`, `pop-menu.html`, `nim-menu.html`,
`beeline-menu.html`) — the
Pop files didn't previously link `shared-game.js` at all, so that link was
added too; their own local same-named helpers (`randInt`, etc.) simply
continue to shadow `shared-game.js`'s identical versions in the shared
script-tag global scope (classic, non-module scripts: whichever same-named
`function` declaration parses LAST wins, and each page's own inline
`<script>` always comes after the `<script src="shared-game.js">` tag) — a
safe, zero-behavior-change addition, not a migration of any of those
games' own existing logic. `nim-menu.html` is the newest addition to this
list, wired in the same way every other sub-menu was.

## Post-playtest navigation & UX fixes

A real playtesting pass across every built game produced a batch of
concrete, specific fixes — not new features, corrections to how existing
ones actually felt to use. Grouped by area; several of these REVERSE an
earlier documented design decision on purpose, called out explicitly
below rather than silently overwritten.

### Navigation redesign: "Play" always lands in a real game

**The problem:** a multi-variant game's card/nav entry read "See
variants →" and linked to that family's own `*-menu.html` sub-menu — an
extra click before ever reaching a real game, and no way back to a
sibling variant except returning to the hub. Real feedback: "I want to be
able to click PLAY on a game. But I need an expandable toggle to see
variants... When I click PLAY I should be able to toggle between variants
on that screen."

**The fix, in `GLOBAL_GAMES` (shared-game.js) plus two new pieces:**
- `href` for every multi-variant game (Scuttle, Pop, Nim) now points
  straight at that family's DEFAULT (first-listed) variant file, not a
  menu page — `renderGlobalNav()`'s dropdown needed zero code changes,
  since it already just uses `g.href`.
- A new `variants` array per multi-variant entry — `{name, href}` per
  variant, family order (the same order each `*-menu.html` already
  listed them in).
- `index.html`'s `renderGameGrid()` was rewritten: a multi-variant card is
  now a plain `<div>` (not one big enclosing `<a>`) with its own real
  "Play →" `<a>` badge linking to the default variant, PLUS a small
  expandable "▾ N variants" toggle underneath — a player-triggered
  disclosure (CLAUDE.md "Layout stability" category 2: plain `.hidden` +
  `fadeIn()`, not `.phase-hidden` — there's no within-round content on
  this page needing reserved space) that reveals every sibling as its own
  direct link. A single-variant/locked card is completely unchanged (still
  one big clickable `<a>`, or a locked `<div>`).
- `renderVariantSwitcher(containerId, currentKey, currentHref)`
  (shared-game.js) — the in-game half: every multi-variant game's own
  settings screen gets a `<div class="chip-row" id="variant-row">` (same
  convention as that game's own difficulty chip-row) populated with one
  chip per sibling, the CURRENT file rendered as a non-navigating
  `.active` `<span>`, every other variant a real `<a>`. `currentHref` is
  passed explicitly by each file (its own filename, e.g.
  `'scuttle-addition-subtraction.html'`) rather than inferred from
  `location.pathname` — every test harness in this project loads a page's
  raw HTML into either a fixed fake URL (jsdom-helpers.js's
  `'http://localhost/'`) or no `document`/`location` at all
  (vm-load-page.js's bare sandbox), so `location` can never actually
  identify which file is running; this is the same "genuinely
  game-specific info is a parameter, not assumed" principle this file's
  own header comment already states elsewhere.
- New shared CSS: `a.chip`/`span.chip.active` (design-system.css) —
  `.chip`'s existing look comes from the bare `button` tag selector, which
  an `<a>`/`<span>` never picks it up automatically, so this gives the
  identical look to those two tags specifically for `renderVariantSwitcher`'s
  own chips. `.variant-expand-toggle`/`.variant-sublist`/`.variant-sublink`
  for index.html's disclosure. `.stat-pill.target-pill` (see the Scuttle/Pop
  section below).
- **The old `*-menu.html` sub-menu pages (`scuttle-menu.html`,
  `pop-menu.html`, `nim-menu.html`) were kept, not deleted** — they still
  work fine if linked to directly, but nothing in the primary nav paths
  (hub cards, nav dropdown) points at them anymore; the expandable card
  disclosure and the in-game switcher together now cover what they were
  for. Flagged here rather than silently leaving them an undocumented
  dead end.
- `test/site-structure.test.js`'s hub-card assertions were rewritten
  around the new DIV/badge/toggle/sublist shape (not "one big `<a>`, badge
  reads 'See variants'"), plus new assertions driving the expand toggle's
  actual open/close click, and a new block driving `renderVariantSwitcher`
  on all 7 multi-variant files directly.

### Scuttle: target prominence + drag "blue box" flicker

**Target prominence:** the target was shown only as a small bolded number
inside the plain-text tagline sentence ("Get as close as you can to
**500**.") — real feedback: "too subtle... should be more embedded into
the game screen where the scores are tracked." Fixed with a new
`.stat-pill.target-pill` (design-system.css, shared with Pop below) in
`#top-bar` — the SAME always-visible bar the round/difficulty/score pills
already live in, so it's on screen through every phase of a round, not
just settings. Styled with `--color-warn` (an existing semantic token, not
a new brand color) plus a 🎯 emoji, visually distinct from the plain pills
next to it. The tagline sentence itself was left in place (still useful
context) — this is an ADDITION, not a replacement.

**The "blue box jumps around" bug** — real feedback, confirmed by
literally screenshotting a slow real-browser drag across the compute
screen's equation row: the blue `.drop-target` highlight (the tile a
dragged number is about to swap with) flickered on and off unpredictably
as the pointer moved smoothly across the row, rather than tracking
smoothly. Root cause: `findDropTile()` used
`document.elementsFromPoint(e.clientX, e.clientY)` — exact-pixel
hit-testing — so the instant the pointer passed over the gap between
tiles, an operator button, or the "=" sign, it found no tile at all and
the highlight blinked off, then back on over whichever tile the pointer
next happened to land squarely on. Fixed by replacing it with
nearest-tile-by-center-X comparison (the same pattern Beeline's own
`nearestNumForX()` already established) — comparing the pointer against
every OTHER `.eq-tile`'s real center and picking the closest always finds
SOMETHING, so the highlighted tile can only ever change at the exact
midpoint between two tiles, a single clean flip, never a flicker.
Confirmed directly: sampling the drop-target at each step of a slow drag
showed `[]/[]/636/[]/[]/965` before the fix (on/off/on/off — a real
flicker) and a clean `359/359/359/359/775/775` after it (one flip, at the
midpoint). `test/smoke-addition-subtraction.test.js`'s drag stub changed
from stubbing `document.elementsFromPoint` to stubbing
`Element.prototype.getBoundingClientRect` at the prototype level (survives
`renderEquation()`'s full tear-down/rebuild of the `.eq-tile` nodes on
every drag, per the existing Known Traps pattern) — same production code
path, fake but consistent geometry, matching the drag-testing convention
already used elsewhere (e.g. Beeline's own smoke test).

### Pop: shared-dice position, turn alternation, target, busted-result display, no emoji

Applies identically across `pop-addition.html`/`pop-subtraction.html`/
`pop-expression.html` unless noted:

- **Dice position:** `#current-digit-wrap` moved from BELOW both players'
  blank groups to BETWEEN "Your number"/"Throw away" and "Bot's number"/
  "Bot's throw away" — real feedback: "Dice should appear between bot and
  your number to look truly shared." A pure DOM-order move; no JS changed.
- **Turn alternation:** the bot previously always placed its own digit
  the INSTANT it was revealed, before the human ever chose theirs — real
  feedback: "Alternate who places first between bot and player." A new
  `st.rollFirst` (`'bot'`/`'human'`) flips after every roll, starting
  `'bot'` fresh each round (NOT persisted across "Play again" like Nim's
  `nextStarter` — there's no real strategic first-move advantage here the
  way there is in a race/adversarial game, since every blank is each
  player's own and nobody's choice depends on seeing the other's; this is
  purely about turn-taking FEEL, not a fairness-across-rounds concern).
  When `rollFirst==='bot'`, behavior is unchanged (bot decides
  immediately). When `rollFirst==='human'`, the bot's own placement for
  that roll is deliberately withheld until AFTER the human clicks a slot —
  resolved via a "Bot is thinking…" message + the same ~450ms delay
  pattern every other bot-delay in this project already uses — rather
  than computed and shown before the human has even chosen. Both Pop
  smoke tests' roll-loop had to change from a fixed sleep to POLLING for
  `st.currentDigit !== null` before each click, since a human-first roll
  now takes an extra ~450ms the old fixed sleep didn't budget for (see
  Known Traps).
- **Target prominence:** identical `.stat-pill.target-pill` treatment to
  Scuttle (shared CSS) — 🎯 Target for Addition/Subtraction, 🎯 Min for
  wherever "target" reads oddly... (all three Pop files use "Target").
- **Never show a negative result — Subtraction/Expression only** (Addition
  Pop's inside sum can never go negative, nothing to fix there): a
  negative inside value/expression result is a real, valid intermediate
  computation (the subtrahend can legitimately exceed the minuend) but real
  feedback found the raw negative number in `.result-total` ("-7") read as
  broken, not as a bust. `statusText()` already said "Popped — negative
  difference/result!" in the status line; the new `displaySum(sum)`
  (`sum < 0 ? 'No score' : sum`) covers just the raw number display next
  to it. Both smoke tests updated: the old `Number(el('human-total')
  .textContent) === humanSum` assertion (which assumed the displayed text
  was always numeric) became a string comparison against `'No score'` for
  the negative case, plus a direct deterministic probe of `displaySum`
  itself (0 → real zero, not the placeholder; negative → placeholder;
  positive → passed through).
- **No emoji in win/tie banners:** `🎉`/`🤝` removed from all three files'
  `winner-banner` text (e.g. "You win this match! 🎉" → "You win this
  match!").
- All three files also got the new `#variant-row` chip-row +
  `renderVariantSwitcher('variant-row', 'pop', '<own-filename>')` call —
  see the navigation redesign above.

### Beeline: token identity reversed, no separate switcher, bigger grid numbers

**Token color/lane REVERSAL — deliberate, explicit supersession of an
earlier documented design.** The original design (see the "Drag
interactions" section above, still describing the OLD behavior in its own
historical comments) used two FIXED LANES but a color/lane that changed
with whose move a token represented (blue = human's turn, red = bot's;
whichever token was "active" always sat in the lower lane). Real
playtesting feedback was explicit and unambiguous: "Never change their
color (one black one white) or flip the position." This is now REVERSED:
token 0 is always the light/white token, always in the below-row lane;
token 1 is always the dark/black token, always above — permanent
per-token identity, like a real board game's two physical pieces, never
repainted turn to turn. This does NOT reintroduce the ORIGINAL mockup's
text-overlap bug the lane system was built to fix: `.operand-row`'s own
`margin: 34px 0` already reserves BOTH lanes' space unconditionally,
regardless of which token sits in which lane or whether that ever changes
— the reserved space was never actually conditional on "activeness" to
begin with, so a fixed assignment is exactly as safe as the swapping one
was. (Cell-ownership coloring on the CLAIM GRID itself — blue/red for
who claimed that cell — is unrelated and unchanged; this reversal is
about the TOKEN circles specifically, the two things you drag along the
1-9 row, not the board.)

**"Move token at N" button-row removed; both tokens directly
clickable/draggable at all times instead.** The old design had exactly
ONE token "active" (draggable) at a time, switched via a separate
`#token-switch-row` of two buttons reading "Move token at 6"/"Move token
at 3". Real feedback: "Remove the 'Move token at 6' button. Make both
tokens clickable... Click and drag to place." Now: BOTH tokens are always
draggable (no more `isActive` gating in `renderTokens()`); a plain click
on either token SELECTS it (`st.selectedTokenIdx`, shown as a blue outline
ring via `.token.selected`) for the click-a-destination-number fallback
path — a direct drag on either token is unambiguous on its own and needs
no selection step at all. `#token-switch-row`'s HTML, its
`renderTokenSwitch()` function, and its CSS were deleted outright, not
left dead.

**Claim-grid numbers enlarged:** `.claim-cell`'s font-size went from 15px
to 21px — real feedback: "Numbers in the gameboard should be larger."
(The 1-9 operand row's own numbers were left as-is — "gameboard" reads as
the 36-cell claim grid specifically, the actual board, not the row of
numbers a token moves along.)

`test/smoke-beeline-product.test.js` updated throughout: `st.activeTokenIdx`
→ `st.selectedTokenIdx`; `document.querySelector('.token.active')` (a class
that no longer exists) → `document.querySelector('.token.token-' + idx)`
(the new fixed per-token identity class); the Hard-bot playthrough helper
no longer clicks a switch-token button before dragging — it drags
whichever token the move actually names directly.

### Nim (both files): changing your move before checking

Previously, clicking a move button (`+1`/`+2`, or a coin) locked in
`st.pendingMove` and disabled the whole row until the answer-check either
succeeded or the player kept retrying the SAME move's total — there was no
way to pick a different amount first. Real feedback: "I should be allowed
to change my guess if I haven't done the calculation yet." Fixed
identically in `nim.html` and `nim-nickeled-and-dimed.html`: the move row
now stays enabled through BOTH `'idle'` and `'awaiting-answer'` phases (not
just `'idle'`), and `handleMoveClick()` accepts a click in either phase —
clicking a DIFFERENT amount while already awaiting an answer swaps
`st.pendingMove` and calls `enterAwaitingAnswer()` again (a full reset:
fresh equation text, cleared wrong-attempts, cleared hint), rather than
being ignored. A new `.move-btn.selected` ring (`--color-warn` outline —
both buttons are already `.primary`/always blue, so a ring is the only way
to show which one is currently picked) marks the live pending choice.
Nickeled & Dimed's version layers this on top of its existing per-button
legal-move disabling (a coin that would overshoot 50¢ stays disabled
regardless of whether you're switching or picking fresh). Both smoke tests
gained a "change-your-mind" probe: click one move, confirm the pending
amount/equation/wrong-attempt-reset, click a DIFFERENT legal move, confirm
the swap, then submit the answer for the NEW amount and confirm THAT one
(not the original pick) is what actually commits.

**A real, thorough false-alarm investigated and ruled out, not just
ignored:** running `nim-nickeled-and-dimed.html`'s smoke test many times
in a tight sequential shell loop repeatedly appeared to "hang" partway
through a batch. Instrumented the test with step-by-step `console.error`
markers and ran dozens of isolated, individually-timed repetitions — every
single one completed normally (consistently ~9-10 seconds each, with
correct output). The apparent hangs were an artifact of the OVERALL shell
command timeout being sized for a fixed wall-clock budget rather than
scaled to (number of runs × per-run time) — a loop of many runs
occasionally has enough of them land on the slower end that the batch's
total exceeds too-tight an overall budget, killing whatever run happened
to still be in flight when the axe fell, which then LOOKS identical to
that specific run hanging. No code change was needed; this is a
test-running methodology lesson, not a game bug — worth remembering
before assuming a repeated-loop timeout means an actual infinite loop.

### Numbo: clickable expression keyboard, round-phase blank space

**Clickable keyboard, replacing free typing.** Real feedback: "I want a
clickable keyboard rather than typing. I need the operations, parentheses,
and given numbers." `#expr-input` is now `readonly` — a pure display of
the expression being built, populated by a new `#numbo-keyboard`: one
button per rolled digit (keyed to a specific rolled SLOT, `data-slot`-style
tracking via `st.exprDigitUsed[i]`, not the digit's own value — two rolled
digits can be equal, e.g. two 7s, and are still spent independently),
`+ − × ÷`, `( )`, and Backspace/Clear. Every press writes into
`#expr-input`'s `.value` through the EXACT same string
`tryParseAndValidate()`/`checkAnswer()` already consumed — the parser
needed zero changes, since the keyboard only changes how that string gets
BUILT, not what it looks like once built. A light, cheap legality guard
(`canPressOp`/`canPressParenOpen`/`canPressParenClose`) disables illegal
next-presses (no leading operator, no double operators, no "(" glued
straight onto a digit with no operator between them, no ")" with nothing
open to close) — this is NOT a full re-implementation of the real parser;
an incomplete expression (not all 4 digits used yet) or a divide-by-zero
is still caught the same way it always was, at Check time, by
`tryParseAndValidate()` itself, which is exactly why the structural-error
and value-mismatch probes in the smoke test needed no changes. Backspace
pops the last token and, if it was a digit, re-enables the EXACT slot
button that placed it (not just "a" button showing that value). New test
coverage drives the real buttons through a full press → disable →
re-enable-on-backspace → build-a-complete-expression → Check cycle, not a
direct `st.exprTokens` manipulation.

**Round sub-phase blank-space bug.** Real feedback: "lots of empty space
at the end of the round." The round screen's five sub-phase blocks
(`target-setup-human`, `target-setup-bot`, `dice-expr-wrap`,
`round-result`, `next-round-wrap`) were ALL `.phase-hidden` on the
assumption that's the correct default for anything hideable within a
round (per "Layout stability" above) — but `.phase-hidden` reserves an
element's space even while hidden, and these five are never
partway-visible together the way genuine within-round phase content is;
at any moment exactly ONE of them is the entire round screen, the same
shape as a top-level screen swap, just nested one level inside
`#screen-game` instead of living at the top. Reserving all five's height
AT ONCE (since none of them ever actually overlap) is exactly what
produced the reported blank space — confirmed directly with a real-browser
screenshot showing a large empty gap above "Round result" before the fix,
gone after it. Fixed by switching all five to plain `.hidden` (real
removal from flow) via a new `showPhaseBlock(node, visible)` helper that
also calls `fadeIn()` on becoming visible, matching the fade convention
every other screen swap in this project already gets.
`test/smoke-numbo-operations.test.js`'s phase-block snapshot helper
inverted accordingly (asserting exactly the right block is unhidden at
each step, not "never `.hidden`, only `.phase-hidden` toggles").
**Lesson worth generalizing:** "Layout stability"'s own two-category
sort — reserve space vs. remove from flow — depends on whether hideable
elements ever coexist partway, not on whether they're nested inside a
top-level screen or not; a block bundled onto one visible card can still
be a top-level-screen-swap in disguise.

### Detective: input-left/history-right layout, fraction bar visibility

**Layout.** Real feedback: "Input on left, tracked answers on the right.
This stops the clicking space growing and being unreadable." The old
layout stacked `#history` (one row per past guess, up to 6 per puzzle)
directly ABOVE `#input-wrap`/`#keyboard` — every new guess pushed the
actual clickable keyboard further down the page. Restructured into
`.game-columns` containing `.game-input-col` (dots, input, keyboard, hint,
action buttons) and `.game-history-col` (`#history`, now labeled "Your
guesses") side by side above a ~560px breakpoint (the narrowest width the
digit keyboard's own 10 keys can actually fit in, ~385px, plus a usable
history column next to it — the numeric breakpoint is a real computed
constraint, not an arbitrary round number), stacking to a single column
(input first) below it — the same collapse-to-one-column pattern
`index.html`'s own `.game-grid` already uses at its own breakpoint. A
second, independent layer of the same fix: `#history` itself now has
`max-height: 360px; overflow-y: auto` — bounded and internally scrollable,
so even a long endurance-mode tally, or the stacked narrow-viewport
fallback, still can't push the input/keyboard/page footer around.

**Fraction bar (vinculum) visibility.** Real feedback: "Line separating
fractions is hidden because it blends with the drop shadow. It should be
thicker, slightly down, and longer." Root cause: `.dbox`'s hard drop
shadow (`--shadow-sm: 3px 3px 0 var(--color-ink)`) extends 3px below each
numerator digit box, landing right in the same narrow 3px gap where the
old 2px-thick `.fbar` sat — same ink color, so the bar visually blended
into the shadow already there. Fixed with all three asks at once:
`height` 2px → 5px (thicker), `margin: 3px -5px 0` (pushed down 3px,
clear of the shadow zone, AND extended 5px past each edge so it overhangs
the digit boxes slightly — the traditional look of a real vinculum,
"longer"), `.frac`'s own gap widened 3px → 5px to give the extra offset
room. Confirmed directly in a real-browser screenshot, both in the
live-input display and in a rendered history row.

Both fixes verified with real Playwright screenshots (installed as a
throwaway local dependency per the existing Testing methodology
precedent, removed again after — never added to package.json), not just
inferred from source; `test/smoke-detective-fraction-equivalence.test.js`
needed no changes (nothing about the puzzle logic or DOM ids moved).

## Boot sequence

Lives on the project's true entry point (`index.html`, formerly hosted on
`scuttle-menu.html` before that file became — see "Where things stand" —
Scuttle's own sub-menu rather than the whole-project hub). A full-screen
overlay (`#boot-screen`, `position:fixed; inset:0; z-index:100`) plays a
short intro, then fades to reveal the real hub content underneath.

**Once per browser session, not once ever.** `sessionStorage` (a real
hosted site, not a claude.ai artifact — no restriction on browser storage
here), keyed `beastClassroomBootSeen`, checked and set defensively (wrapped
in `try`/`catch`, the same guard style `prefersReducedMotion()` already
uses for `matchMedia` elsewhere in this project) so storage being
unavailable just means "always show the animation" rather than throwing.
A fresh session (new tab, browser restart, or storage genuinely
unavailable) plays the full intro; any repeat visit to the hub within that
SAME session skips straight to the menu — no animation, no delay, nothing
to click through again. Set the flag as soon as the decision to play the
animation is made (not deferred until the animation finishes), so
navigating away mid-animation and back doesn't replay it.

**Copy: exactly one clean line, "BEAST CLASSROOM."** The boot screen
previously rendered THREE separate elements in sequence — a small
"presents" line, the byline ("BEAST CLASSROOM," correctly split red/blue
even before this fix), and then a SEPARATE, bigger, redundant "BEAST" logo
underneath it — which is what actually produced the reported "Present
beast classroom BEAST" bug: not a single wrong string, but genuine
duplication left over from an earlier version of the boot sequence never
being fully removed. Fixed by deleting both `#boot-presents` and
`#boot-logo` (divs, CSS, and their animations) entirely, leaving
`#boot-byline` as the sole surviving line — sized up from its old small-
aside treatment (since it now carries the whole reveal by itself) and
retimed (the remaining `#boot-prompt` "Tap to start" now follows quickly
behind it, and the auto-advance `setTimeout` was shortened accordingly,
since the sequence is now a single beat instead of four staged elements).
**Verify this by reading the ACTUAL rendered text** (`#boot-byline`'s
`textContent`), not just eyeballing the markup — see
`test/site-structure.test.js`.

## Layout stability — two different toggles for two different jobs

Every game hides and reveals UI elements as the player progresses, and it
matters *how*, or the round card's height snaps at every change and
everything below it jumps. See `design/mockups/layout-stability-mockup.html`
— it renders the same 4-step sequence (dice → slots filling → answer-check
appearing → correct) in an unstable mode and a stable mode side by side; the
bug and the fix are the literal difference between those two render
functions.

**THE RULE, CORRECTED — read this version, not the older phrasing it
replaces.** The original wording ("within-round content uses
`.phase-hidden`") was right about the bug and far too broad about the
remedy, and it got over-applied until the round card reserved space for its
*entire eventual lifecycle* from first paint: Scuttle's pre-roll card
reserved the dice row, the slot row, the answer-check row and every advance
button at once, so an empty round showed a ~290px dead box with a lone
"Roll dice" button floating at the bottom of it. Reserving space is not
free — every reservation is empty space the player is looking at.

Ask the question that actually matters: **would this element's arrival
shove something the player is interacting with right now?**

- **Yes → reserve it (`.phase-hidden`).** This is content that appears
  *while the player is working inside the phase it belongs to*: a feedback
  or validation line under the control they're using, a hint that unlocks
  after two wrong attempts, a shared die that pops in and out on every roll
  while the player keeps placing digits on the same screen. Their hand is
  already on that screen; nothing may move under it.
- **No → remove it (`.hidden` + `showPhaseBlock()`).** This is content that
  belongs to a **later phase** — it arrives as the result of a deliberate,
  one-way action that also retires whatever control caused it. Clicking
  "Roll dice" is not an event that must leave the pre-roll card the height
  of a fully-populated one; the click has already landed and the button is
  spent.

**The test is "one step ahead", not "same screen".** Same-screen was the
part that was wrong — a screen can hold four sequential phases, and
reserving all four at once is exactly the bug. Reserve for the transition
the player is *in the middle of*, never for the whole round.

**This cuts both ways, and both directions were real bugs found by the same
audit.** Scuttle and Nim were over-reserving (dead box: Nim's
`#answer-area` held ~145px empty from first paint for a phase reached only
by clicking a move button). Pop was *under*-reserving in the opposite
direction: `#current-digit-wrap` — the shared die that appears and
disappears on every single roll while the player stays put — used `.hidden`,
so the card jumped ~74px on every roll and back on every placement, and its
own `min-height: 74px` sat there as dead code because `display:none` beats
it. Getting the rule right moved elements in *both* directions.

Use `showPhaseBlock(node, visible)` (`shared-game.js`) for every later-phase
toggle — it handles `.hidden` plus the `fadeIn()` every swap gets.

Two further notes that survive unchanged from the original rule:

1. **A `.phase-hidden` element must already exist at its full markup shape
   before you first reveal it** — a wrapper that's *empty* until JS
   populates it reserves zero space and reintroduces the identical jump.
   This shipped once anyway: `#slots-row` grew Scuttle's card 375px → 431px
   on first roll until it was given a `min-height`.
2. `visibility: hidden` also takes the element out of the tab order and
   blocks clicks, which matters because reserved content is usually
   interactive (dice, slots).

The two categories below are the original framing, kept because the
`.hidden` half of it was always correct:

1. **Within-round / within-phase content** — see the corrected rule above
   for which content genuinely qualifies. **Use `.phase-hidden`
   (`visibility: hidden`), never `.hidden`, never removing the node.**
2. **Top-level screen swaps and one-off disclosures** — switching between
   `screen-settings` / `screen-round` / `screen-compute-or-sum` /
   `screen-reveal` (there's nothing else on screen to jump, since the whole
   view is being replaced), plus the persistent scorecard's show/hide tied
   to that same swap, plus a player-triggered expand/collapse like the
   settings screen's "How does this game work?" rules box. **Keep
   `.hidden` (`display: none`) for these** — removing them from the layout
   is correct here, not the bug. Screen-level swaps should still call
   `fadeIn()` (defined alongside `showScreen()`; add it if a game doesn't
   have it yet) on the newly-active screen right after unhiding it, which
   replays a ~180ms opacity animation via the same
   remove-class/reflow/add-class trick already used for `.shake` — so the
   swap fades in instead of popping. Don't add this fade to `.phase-hidden`
   toggles; it's for screen swaps only.

When building a new game, sort every hideable element into one of these two
buckets *before* writing the show/hide code, the same way you'd decide a
win condition from the rules doc before coding it — don't default to
`.hidden` everywhere and only fix it if someone notices the jump.

**A third source of the same bug: a box whose one active option is a
DIFFERENT LENGTH than the others.** This isn't about hiding/showing an
element at all — it's a single always-visible box (a format-chip
description, say) whose *text* swaps to a shorter or longer string. A
`min-height` guess doesn't fix this the way you'd expect: it sets a floor,
not a ceiling, so the box still grows the moment a longer option is picked,
and everything below it still jumps — this is exactly what happened with
`#diff-desc` on `scuttle-addition-subtraction.html`'s settings screen
before it was removed (Easy's description wrapped to 2 lines, Medium's and
Hard's didn't). **Fix: `.desc-line-stack` / `.desc-line-option`, in
`design-system.css`.** Render every option's text at once as sibling
`.desc-line-option` divs inside a `.desc-line-stack` container, all placed
in the *same* CSS Grid cell (`grid-area: 1 / 1`) so they overlap instead of
flowing — only the active one gets `visibility: visible` (`.active`), the
rest stay `visibility: hidden` (reserving space, per category 1 above). The
grid row's `auto` track sizes to the tallest overlapping option
automatically — real browser layout, not a hand-counted line estimate — so
it's correct today and stays correct if a description is edited to be
longer or shorter later, with nothing to re-check. Confirmed in a real
headless-Chromium render (not just jsdom, which has no layout engine — see
Testing methodology point 8): clicking through every format on
`scuttle-product.html` and `pop-subtraction.html` (a 4-line-worst-case
description vs. a 1-line one) produced *zero* pixel movement in anything
below the box. Use this for any settings-screen description driven by a
chip/selector; plain `.desc-line` + `textContent` stays fine for a
genuinely static, single-string line (e.g. Beeline's `#setup-hint`) where
there's no second option to jump between.

## Celebration animations

Reveal screens use a small set of shared visual effects for showing the
outcome, ported from `design/mockups/win-visuals-mockup.html` — open that
file to compare its "unstable"-style raw version against the timed version
side by side before touching any of this. `typewriterReveal()` and
`countUp()` are still duplicated per-file in each game's own inline
`<script>`, not pulled into `shared-game.js` — unlike the dice/permutation/
screen-swap helpers (see "File structure & the point of it"), they're
specific to a reveal screen's own visual polish rather than underlying
game-shell mechanics, so they weren't in scope for that refactor. Worth
checking whether they belong there too next time this area gets touched.
`prefersReducedMotion()` itself, though, **did** move into `shared-game.js`
— not as part of this refactor, but later, once "Drag interactions"'
FLIP/snap helpers needed it too and a third per-file copy stopped making
sense; see that section. The shared CSS half (`.flash` +
`@keyframes singleFlash` + `prefers-reduced-motion` override) *does* live
in `design-system.css`,
scoped to `#winner-banner`, since every game already shares that element.

**Governing rule — read this before adding or editing any celebration
effect:** every celebration animation plays a small, fixed number of times,
then rests static. Nothing loops. Nothing exceeds a gentle pulse rate (one
soft flash, never a strobe). This is a **deliberate child-safety /
screen-time decision**, not just an aesthetic preference — these games are
played repeatedly, back-to-back, by kids in a classroom. If a future
request would reverse this (an animation that loops, repeats on a timer,
or flashes more than once per win) **flag it explicitly instead of just
implementing it** — don't treat "make it more exciting" as license to add
a loop.

All three mockup effects are now built and live:

1. **Win banner: typewriter, then one flash, then rest.** Live on every
   game with a `winner-banner` (both Scuttle games, plus
   `beeline-product.html`'s `endGame()`). `typewriterReveal(el,
   text)` reveals `text` into `el` one character at a time, 45ms/character
   (`text.slice(0, i)` on each tick — plain UTF-16 code units, same as the
   mockup, not grapheme-aware). The instant it finishes, it adds `.flash`
   (the single 0.35s brightness pulse from `design-system.css`) and removes
   it again after a fixed 400ms — comfortably past the 0.35s animation, not
   tied to its `animationend` event. `prefers-reduced-motion: reduce` (real
   `matchMedia`, guarded so it never throws where `matchMedia` doesn't
   exist — see `prefersReducedMotion()`) skips straight to the final text
   with no typewriter and no flash.
2. **Score count-up.** Live on both Scuttle reveal screens (`countUp(el,
   target, format, steps=18, duration=650)`), which tick `el`'s text from 0
   toward `target` in 18 equal steps over a fixed 650ms, snapping to the
   exact `target` on the last step (never a rounding artifact). `format`
   lets a game keep its own display convention — Product passes `v =>
   v.toLocaleString()` to match its comma-formatted totals elsewhere;
   Add/Sub passes nothing (plain digits, some totals can be negative — the
   same linear step math handles that with no special case).
   `prefers-reduced-motion` skips straight to the final formatted value.
   Called once per reveal, for both the human and bot total — never
   re-triggered without a fresh reveal. **Does not apply to Beeline** —
   it's a turn-based claiming game with no running numeric score to reveal,
   just the board.
3. **Winning-line reveal** (`revealWinningLine()` in `beeline-product.html`,
   styles in `components/claim-grid.css`) — the mockup's third pattern,
   ported with one deliberate adaptation. The mockup's demo cells reveal
   their *color* one at a time, but a real claim-grid cell is already
   colored well before a line wins (ownership is visible live, turn by
   turn — there's nothing to "reveal" color-wise). So the staggered cue
   here is a `.win` outline ring added to each of the 4 winning cells one
   at a time (180ms apart) instead — same stagger timing and purpose
   ("connecting the dots" before the payoff), adapted to what's actually
   still hidden at that moment. After the last cell's ring (+150ms), all
   four get `.flash` together — the *exact same* `singleFlash` keyframes
   the banner uses, reused rather than redefined — then settle
   (`filter: brightness(0.82)`, permanent) once the flash ends (+400ms).
   `st.winRevealDone` gates `cellClassesFor()`'s own `.win`/`.settled`
   output so a normal `render()` never shows the line early and an
   incidental later render still shows it correctly once the sequence has
   actually finished — the one-shot stagger/flash itself is driven by
   direct DOM manipulation on the already-rendered cells, not through
   `render()`. `prefers-reduced-motion` skips straight to every winning
   cell showing `.win.settled` with no stagger and no flash. This replaced
   `claim-grid.css`'s prior ad hoc `claimWinPulse` (a 2x scale-bounce with
   no stagger, no shared flash, no settled state) — that pulse predated
   this section and didn't follow its rules, so it's gone, not layered on.
   The same pattern applies as-is to whichever future claim-grid Beeline
   variant (see Suggested next steps) needs it.

## Drag interactions

Two games needed real pointer-driven dragging — Scuttle's number-tile
reordering and Beeline's token-along-a-row — ported from
`design/mockups/drag-interactions-mockup.html`. **Never native HTML5
drag-and-drop** — it has poor/unreliable touch support and these games must
work reliably on tablets. Pointer Events (`pointerdown`/`pointermove`/
`pointerup`, pointer capture) instead, same as every other interactive
element in this project.

**The low-level plumbing is shared** (`makeDraggable()` in `shared-game.js`
— see "File structure & the point of it" for why this, not just the CSS,
needed checking for duplication): pointerdown starts a drag, pointer
capture keeps events flowing to the dragged element even once the pointer
leaves it (no shared/module-level drag state needed — multiple simultaneous
draggables just work), `touch-action: none` is set on the element
automatically so a touch drag doesn't fight the page's own scrolling, and a
`dragClass` (default `'dragging'`) is toggled for whatever CSS hook a
game's stylesheet already has. `onMove(dx, dy, e)` fires every pointermove
with the raw delta from drag-start — the CALLER decides what "following the
pointer" looks like and does its own hit-testing there; nothing is snapped
or resolved automatically. `onDrop(dx, dy, e)` fires once when the drag
ends (pointerup and pointercancel treated identically, since every caller's
resolution already just reads wherever the pointer actually is/was — an
interrupted gesture naturally finds no valid target rather than needing
special-case handling). What dragging **means** — swap two tiles vs. snap a
token to the nearest number — is entirely up to the two games built on top;
`makeDraggable()` itself has no opinion.

**FLIP** (`flipBefore()`/`flipAfter()`, same file) is the other shared
piece: the technique for animating a full destroy-and-rebuild re-render
instead of it just popping into place. `flipBefore(elements, keyAttr)`
snapshots each element's current `getBoundingClientRect()`, keyed by a
stable identity (`element.dataset[keyAttr]`) that survives the rebuild —
**the underlying value's identity, never its display position**, since
position is exactly what a swap changes. After the destroy-and-rebuild,
`flipAfter(elements, keyAttr, snapshot)` matches each fresh element back to
its old position by that same key and animates the delta (an inverted
transform played back to zero) — it visibly slides even though the DOM
node itself is new. `prefers-reduced-motion` (also moved into
`shared-game.js` from being duplicated per-file, once these helpers needed
it too — see "Celebration animations," which no longer lists it as
duplicated) skips straight to final position, no snapshot needed either
way.

**Governing rule — same one as Celebration animations, read that section's
version before touching either:** every drag-driven animation (the FLIP
slide, a token's snap-into-place) plays once, to a fixed conclusion, then
rests static. Nothing loops, nothing repeats on its own. The one thing
genuinely exempt is the drag's own live pointer-following — that's direct
manipulation, not autoplay, and reduced-motion doesn't touch it; only the
*autonomous* animation that plays after release (the slide, the snap) is
gated on it.

1. **Scuttle (`scuttle-addition-subtraction.html`): drag-to-swap, replacing
   the old ◀▶ stepper buttons.** `st.order` is untouched by this — only the
   interaction method changed; `swapOrder(posA, posB)` is the exact same
   function it always was, still just swapping two `st.order` entries and
   re-rendering. `renderEquation()` now wraps its own rebuild in
   `flipBefore()`/`flipAfter()` automatically, keyed by `data-origIndex`
   (`st.order[pos]` — the tile's real underlying `humanNums` index, not its
   display position) — every call gets FLIP for free, including the
   harmless no-op ones (initial render with nothing to animate from,
   operator toggles where no tile actually moves). Each tile's `.eq-num`
   is the drag handle directly (`.draggable`, bordered/shadowed so it reads
   as grabbable — the old plain-text `.eq-num` didn't need that affordance,
   ◀▶ buttons did the work); `onMove` translates it and highlights whichever
   OTHER `.eq-tile` is currently under the pointer (`.drop-target`, found
   via `document.elementsFromPoint` + `.closest('.eq-tile')`); `onDrop`
   calls `swapOrder()` on the two positions if a different tile was found.
   Once the answer checks out, tiles get `.locked` (dragging becomes a
   no-op, checked at the top of both callbacks) — the same "can't
   re-edit after answering" rule the old disabled-buttons enforced, just
   expressed differently since there's no button `.disabled` to set anymore.
   `.reorder-btns` (the old button-row CSS) is gone from `design-system.css`
   — nothing uses it anymore, don't resurrect it.
2. **Beeline (`beeline-product.html`): a draggable token per active turn**
   (both are draggable at all times now — see "Post-playtest navigation &
   UX fixes" for the later reversal; this section's own bullets below
   still describe the mechanics accurately, just re-read with "both
   tokens, always" instead of "one active token" in mind where relevant).
   Setup (placing both tokens for the first time, before `st.tokens`
   exists) stays click-only, unchanged — there's no existing position to
   drag *from* yet, only two brand-new ones being chosen; dragging only
   makes sense for repositioning something that's already somewhere.
   Clicking a destination number directly still works too as a quick-jump
   fallback, unchanged, alongside the new drag.
   - **Continuous following, snap only on release.** The mockup's own
     Beeline prototype jumped the token discretely between number
     positions on every `pointermove` (recomputing which cell, then a full
     re-render) — exactly the bug this needed to NOT repeat. The real
     token is a `position: absolute` circle inside `.operand-row`
     (`position: relative`), moved during the drag via a plain
     `translateX` transform — decoupled from any specific cell, so it
     glides continuously with the pointer. Only on `onDrop` does
     `nearestNumForX()` resolve the actual nearest number (comparing
     pointer X against every `.op-num`'s real `getBoundingClientRect()`
     center), and `snapTokenTo()` animates from wherever the drag left
     off to that number's resting position — a real settle, not a jump,
     over the same 220ms `TOKEN_SNAP_MS` FLIP's own default uses (kept in
     sync by comment, not by sharing a constant — see Known traps for why
     that's a real drag-testing pitfall, not a shortcut worth taking).
   - **Fixed per-token color AND fixed lane — REVERSED after real
     playtesting, see "Post-playtest navigation & UX fixes" for the full
     story.** This originally shipped as two fixed LANES but a color/lane
     that changed with whose move a token represented (blue for human's
     turn, red for bot's; whichever token was "active" sat in the lower
     lane) — the reasoning below describes that ORIGINAL version, kept for
     history. Real feedback ("never change their color or flip the
     position") reversed it: token 0 is always the light/white token,
     always in the below-row lane; token 1 is always the dark/black token,
     always above, regardless of whose turn it is or which one is
     currently selected. `.operand-row`'s margin is `34px 0` (not the
     original `8px`-bottom-only) to reserve BOTH lanes' space —
     **unconditionally**, whether or not a token is currently rendered
     there (during setup, none are) — which is exactly why the fixed
     assignment is just as safe against the original mockup's text-overlap
     bug as the swapping one was: that reserved space was never actually
     conditional on which token/color sat in which lane to begin with, only
     on the lane itself always being reserved. The exact "Layout stability"
     pattern from above, just applied to a fixed CSS margin instead of a
     `.phase-hidden` toggle. (Original reasoning, for history: color used
     to reflect whose move was being proposed since Beeline's two tokens
     are genuinely **shared** — either player moves either one on their
     turn — so there was no "your token" identity to paint permanently,
     unlike the mockup's simplified demo which fixed one token to "you" and
     one to "bot" purely to make the demo legible; the ACTIVE token concept
     this relied on is itself gone now too, see "Post-playtest" — both
     tokens are draggable at all times, with `st.selectedTokenIdx` only
     disambiguating the click-a-destination-number fallback.)
   - **Dragging never claims the cell by itself.** `onDrop` only ever sets
     `st.pendingMove` and calls `enterAwaitingAnswer()` — the same
     function a click already called, showing the same answer-check UI
     with the same retry-until-correct gate. `commitMove()` — the only
     thing that actually writes to `st.owner`/`st.tokens` — is still
     called from exactly one place: `checkAnswer()`'s correct-guess
     branch. There is no "Mark it" shortcut anywhere in the drag path;
     don't add one. A subtlety worth remembering if this code is touched
     again: `onDrop` doesn't set `pendingMove` immediately — it waits
     `TOKEN_SNAP_MS` (via `setTimeout`, 0 under reduced motion) so the
     snap animation actually gets to play before `enterAwaitingAnswer()`'s
     `render()` would otherwise tear down and rebuild the very token
     that's mid-animation. Setting `pendingMove` synchronously on drop
     was the first thing tried, and it silently ate the entire animation
     — see Known traps.
   - **Known, accepted limitation — narrow-viewport row wrapping.**
     `.operand-row`'s 9 cells wrap to two lines below roughly a 408px page
     width (34px × 9 + 4px × 8 gaps ≈ 338px content needed) — narrower
     than this app's own 480px max-width, so this mainly bites small
     phones, not the tablets this was actually built for. The two fixed
     lanes (`top: 100%` / `bottom: 100%` relative to the ROW'S overall
     box, both wrapped lines combined) don't know which specific line a
     given number is on, so a token can visually sit below/above the
     *whole* two-line block rather than snug against its own number's
     line specifically. Drag/drop targeting itself still works correctly
     (`nearestNumForX` compares real per-cell rects, wrapping or not) —
     only the vertical alignment looks a little off. Not fixed here;
     would need per-cell (not per-lane) vertical positioning to do
     properly.
   - **Found while verifying this, fixed since it was cheap and directly
     adjacent: `#setup-hint`** (the "Click two numbers below..." line
     above the row) was still toggling plain `.hidden`, not
     `.phase-hidden` — its disappearance right as setup finishes shifted
     `#operand-row` up by its old height, a real "Layout stability"
     violation sitting right next to the row this feature depends on.
     Now `.phase-hidden`, confirmed stable in a real browser across 0/1/2
     tokens. **Not fixed, flagged instead:** `#answer-area` and
     `#token-switch-row` have the exact same pre-existing issue (plain
     `.hidden`, appear/disappear on this same screen) — lower severity
     (they sit below the row, shift only `#winner-banner`/`#end-btn-row`,
     nothing a player needs mid-turn) and not adjacent to what this task
     actually touched, so left alone rather than turning a drag-interaction
     task into an unscoped full audit of this screen. Worth a real pass
     next time this screen is touched for anything.

## Avatars

Optional cosmetic identity layer, built on top of (never instead of) the
blue=you/red=bot color coding. Assets live in `/avatars/`, referenced as
`avatars/<name>.png`; reference layout for both rosters is
`design/mockups/full-roster-mockup.html`.

- **Player roster (8, player-selectable):** `grogg`, `alex`, `winnie`,
  `lizzie`, `ralph`, `nellie`, `cammy`, `max`.
- **Bot roster (3, auto-selected — never player-chosen):** `bot-easy`,
  `bot-medium`, `bot-hard`, mapped 1:1 to the `easy`/`medium`/`hard`
  difficulty tiers. Picking a difficulty *is* picking the bot's avatar —
  there's no separate bot picker. This mapping is `BOT_AVATAR_BY_DIFF` in
  each game's script.
- **Hard constraint — additive, not a replacement.** The blue=you/red=bot
  color coding is the primary identity signal everywhere, full stop. Every
  place an avatar renders, the color coding still has to be legible on its
  own with the avatar removed — the avatar sits *inside* that system (e.g.
  a blue-bordered frame around your avatar, red around the bot's), it never
  substitutes for the color, replaces the "You"/"Bot" text labels, or
  becomes the only way to tell the two sides apart. Concretely: the shared
  `.avatar-badge` class (`design-system.css`) is colorless on its own —
  `.avatar-badge.you`/`.avatar-badge.bot` are what add the blue/red border,
  and every avatar badge in the codebase must carry one of those two
  modifier classes, never bare `.avatar-badge`. If a future request would
  make the avatar the *primary* way to distinguish sides (e.g. dropping the
  colored borders, or the "You"/"Bot" text), flag it explicitly rather than
  just implementing it — same spirit as the Celebration animations
  no-looping rule above.
- **Where it lives, per game:** an avatar picker (`#avatar-row`, the larger
  `.avatar-slot` tiles) on the settings screen, persisted as `st.avatar`;
  small `.avatar-badge` thumbnails next to "You" and "Bot" in the top bar's
  score pill (`#you-badge`/`#bot-badge`) — and, on the 3 Scuttle games only
  (the sole family with a persistent `#scorecard`), again in the
  scoreboard's header row (`#sc-you-badge`/`#sc-bot-badge`). Every badge
  pair on a given game is updated together by one `renderAvatarBadges()`
  call so they can never drift out of sync with each other. The bot badges
  re-render automatically whenever difficulty changes (wired into each
  game's existing `renderDiffChips()`), independent of whatever avatar the
  player has picked. **Now live on every bot-vs-human game in the
  project**: the 3 Scuttle games (with scoreboard-header badges too, as
  above), all 4 Pop games, all 6 Beeline games, all 3 Nim games, and
  Numbo Operations — 17 files total, propagated in one pass once the user
  asked for avatars in "all games" rather than one at a time. Everywhere
  outside Scuttle, there is NO scoreboard-header pair to update, since none
  of those families has a persistent `#scorecard` (a real, pre-existing
  fact about those games' own match shape — see each family's own design
  note above, e.g. Nim's "no persistent 3-round `#scorecard`" and Numbo's
  "same reasoning as Nim's design note" — nothing about that changed here,
  only the avatar layer was added on top of it); `renderAvatarBadges()` on
  those 14 files simply has two lines instead of four. **Numbo is a
  deliberate, explicit reversal of this file's own earlier "No avatars"
  design note** — that note's reasoning was really about the scorecard/
  ties-pill shape (grouped together with avatars only because Nim had no
  avatars yet either at the time it was written), not a structural reason
  avatars couldn't apply to a simultaneous, non-adversarial game; once the
  user asked for avatars everywhere, that old exclusion no longer held and
  Numbo got the same top-bar-only treatment as Pop/Beeline/Nim. **Detective
  remains the one genuine exception, and this is structural, not a scope
  choice**: it's single-player with no bot opponent at all (see its own
  design note above) — the entire avatar system is a "you vs. bot" identity
  layer, and there is no second side for a bot avatar to represent there,
  so "all games" cannot mean Detective the way it means every other built
  game. Flagged explicitly rather than silently left out.
- **Not pulled into `shared-game.js`**, same as Celebration animations'
  effects: `AVATAR_ROSTER`, `BOT_AVATAR_BY_DIFF`, `avatarSrc()`,
  `renderAvatarPicker()`, and `renderAvatarBadges()` are still duplicated
  per-file, now across all 17 files — avatar-feature-specific rendering,
  not the game-shell mechanics (screens/scorecard/dice math) that prompted
  `shared-game.js` in the first place, so still out of scope, but worth
  checking whether they belong there too next time this area gets touched
  (17 near-identical copies is a stronger case for extraction than the 3
  Scuttle-only copies were — flagged, not acted on unilaterally here, since
  it wasn't what was asked). The CSS half (`.avatar-row`, `.avatar-slot`,
  `.avatar-badge`, etc.) *is* shared, in `design-system.css`, since the
  picker/badge markup is identical across every game family, unlike
  `dice-slot.css`/`claim-grid.css`/`nim-track.css`/`components/wordle-
  slot.css` which are genuinely per-family — this is exactly why 14 more
  files could pick it up with zero CSS changes.
- **Test coverage propagated too**: every one of the 14 newly-avatared
  files' own smoke test now carries the same default-state-agreement +
  independent-click assertions Testing methodology point 7 already
  established for Scuttle, adapted for having no scoreboard-header pair
  (those two fields are simply not asserted, rather than asserted against
  a nonexistent element — `test/jsdom-helpers.js`'s `snapshotAvatarState()`
  was made defensive about this: `sc-you-badge`/`sc-bot-badge` now resolve
  to `null` via `document.getElementById` instead of throwing when a game
  has no `#scorecard`, rather than every non-Scuttle test needing its own
  workaround). Each family's avatar click was folded into whatever
  difficulty click that file's existing deterministic playthrough already
  depended on, rather than introducing a second, conflicting difficulty
  pick.

## Beeline anti-stalemate fix, board randomization, and 5 new variants

Real playtesting report: **"hard bot keeps returning to a square number to
stop the game from advancing. We need an anti-stalemate rule. Basically you
cannot return to the previous move immediately. If the board says 4x7,
someone moves to 9x7, the next move cannot be to 4x7."** Alongside this, two
more requests: randomize the claim-grid's cell layout (not one fixed
arrangement forever), and build 5 new Beeline variants (Difference,
Addition, Decimal, Rounding, Equivalent Fraction).

### The bug, and why the literal fix as described wasn't enough

The reported mechanism is real: `beeline-product.html`'s shared row has two
tokens, and a move that changes the state from (4,7) to (9,7) can be
immediately reversed by moving right back to (4,7) — if BOTH resulting
products are already-claimed cells, this is a "safe," never-losing,
never-progressing move Hard's minimax had no built-in reason to avoid, so
the game could run forever.

The literal fix described — forbid only the move that would exactly
reverse the IMMEDIATELY PRIOR move — was implemented first, and then
**verified insufficient by direct simulation before shipping**, per this
project's own standing discipline of checking bot behavior empirically
rather than trusting it by inspection. A dedicated diagnostic script
(`node`, not part of the test suite, thrown away after use) played
Hard-vs-Hard with the reversal-only rule in place and found it still
settled into a **longer repeating cycle** (period > 2 — e.g. `(2,2) →
(9,2) → (4,2) → (2,2) → (2,4) → (2,9) → (2,2) → ...`) that never once
reverses a single move but still loops forever. This makes sense once
stated plainly: a deterministic search over a finite state space (only 81
possible tokens-configurations exist) must eventually repeat SOMETHING
once no new progress is available — blocking only the single
most-recent state doesn't block a return to a state from two, four, or six
moves back.

**The real fix**: `st.visitedTokenPairs`, a `Set` of every
tokens-configuration ("a,b" keys) actually reached so far THIS game
(seeded at setup, grown in `commitMove()`), and `legalMoves()` forbids
moving into ANY of them — not just the immediately-prior one. This
guarantees real forward progress: with only 81 possible configurations
total and a 36-cell board, the board fills or someone wins long before
every configuration could possibly be exhausted (confirmed directly: the
same diagnostic script, re-run with this fix, resolves in well under 40
turns every time, deterministically, since Hard-vs-Hard has no randomness).
Applied at the TOP-LEVEL move actually being chosen — bot AND human alike
(`isLegalHumanMove()` backs both `handleRowClick` and the drag `onDrop`,
so a human can't ping-pong either) — but deliberately NOT threaded through
minimax's own internal recursive lookahead, since that search already
always terminates via its fixed depth cutoff regardless, and copying a
growing visited-set at every recursive node would be real overhead for a
search that's already correct without it (a documented, deliberate
simplicity/performance tradeoff, not an oversight).

`test/beeline-product-bot-simulation.js` gained: a direct, deterministic
check of the exact reported scenario ((9,7)/visited={4,7,9,7} must forbid
moving token 0 back to 4); a second direct check of the LONGER-cycle case
that proved the simpler fix insufficient; and an emergent check (30
Hard-vs-Hard games, none may hit the turn cap). `test/smoke-beeline-
product.test.js` gained a matching DOM-level probe (a real click rejected,
with the real "would just repeat" message, then a genuinely new move
accepted) — `isLegalHumanMove()` is the exact function both the click and
drag paths call, so probing it via click also covers the drag path.

### Board layout randomization

`VALUES`/`VALUE_INDEX` were a `const`, fixed forever. Now `let`, rebuilt
via a new shared `shuffleArray()` (Fisher-Yates, `shared-game.js`) inside
`rebuildBoardLayout()`, called from `startMatch()` — so every "Start game"
and every "Play again" gets a freshly shuffled arrangement of the SAME 36
values, not the one memorizable layout from before. Verified in both
smoke tests: two separate matches' `VALUES` arrays contain the identical
SET of values (sorted-compare) but are NOT identical arrays (overwhelmingly
likely to differ, confirmed directly).

### Five new two-row Beeline variants, one shared engine

Product Beeline's own engine (one row, two tokens sharing it) stays local
to that file, per its existing "don't do a big unrelated migration"
restraint. The 5 new variants are a genuinely different shape — one token
PER row, two independent rows — and having 5 real consumers at once was a
far stronger case than this project's usual "wait for a second consumer"
bar for extracting shared code, so a new **Beeline two-row engine** was
added to `shared-game.js` from the start (`beelineLegalMoves`/
`beelineApplyMove`/`beelineBotEasy`/`Medium`/`Hard`/`beelineDecideWinner`/
etc.), already carrying the anti-stalemate fix in its PROVEN-correct shape
(not the simpler, later-found-insufficient one) — every new consumer
inherits the already-verified rule for free, not a 5th independent
reimplementation of it. Per-file `decideWinner` stays a one-line wrapper
into the shared function, per Code conventions. See each variant's own
"Where things stand" bullet above for its specific row ranges, value
function, and board-building decisions (Difference's unsigned distance,
Decimal's deliberately-scoped 1-6 rows and integer-hundredths
representation, Rounding's scoped-down fixed-place reading, Equivalent
Fraction's reduced-form value key and GCF-based answer-check) — each is a
real, documented judgment call where the source catalog's one-line summary
didn't fully specify the mechanic, matching this project's standing "read
the real rules, don't assume, flag what's genuinely a scoping choice"
discipline.

A board whose achievable-value count is smaller than 36 (Difference's 9,
Addition's 17, Rounding's 9, Equivalent Fraction's 35) repeats a value
across several cells, round-robin filled via a new shared
`beelineBuildBoardValues()`/`beelineBuildValueToCells()` (`VALUE_TO_CELLS`
is now `Map<value, number[]>`, not `Map<value, number>` — a real, if
subtle, shape change from Product Beeline's own exact-1:1 board). One real
bug this surfaced during testing, not just a design nuance: a "seed one
cell as claimed" wasted-turn test probe that only marks `cells[0]` for a
repeated value is NOT actually testing a wasted turn, since the other
cells sharing that value are still open — `beelineApplyMove()` happily
marks one of THOSE instead. Fixed by seeding every cell for that value,
not just one — see `test/smoke-beeline-difference.test.js`'s own comment.

All 5 variants verified together in `test/beeline-two-row-bot-simulation.js`
(tier ordering AND zero stalls, per variant's own real state space) before
any HTML was written — deliberately not 5 separate simulation scripts,
since the win-detection/minimax logic being verified is the SAME shared
code every time; what genuinely differs per variant (and is what this
script actually checks) is each one's own value function and board size.
Smoke-test depth is intentionally uneven across the 5: `test/smoke-beeline-
difference.test.js` is as deep as Product's own (board randomization,
wasted-turn rule, anti-stalemate rule, a full drag probe, a complete
playthrough to a real win) since it's the first real two-row consumer and
needed to prove the shared engine works end-to-end through actual DOM
interaction; the other four share one leaner `test/smoke-beeline-two-row-
variants.test.js` (setup → correct claim → second move → correct claim →
anti-stalemate rejection, no drag mechanics, no full win) since those
mechanics are already proven shared code — re-driving a full drag+win
playthrough 4 more times would mostly re-prove the engine, not find
anything genuinely new to that file's own value function and wiring. A
single `test/decide-winner.beeline-two-row.test.js` covers all 5 files'
`decideWinner` wrappers with the same board-state cases Product's own test
already established, since the underlying win-detection is identical code.

## Side-by-side board/playing-space layout

Real design feedback: **"Where appropriate, switch to side by side
containers, broadly 'game board' on right and 'playing space' on left...
avoid as much as possible the need to scroll down."** Detective was named
as a specific case: "game board" becomes "prior guesses," "playing space"
is "current guess."

**Detective already did this — confirmed, not changed.** Its `.game-
columns`/`.game-input-col`/`.game-history-col` layout (built during an
earlier playtesting round, see "Post-playtest navigation & UX fixes") puts
`.game-input-col` (current guess) FIRST in DOM order and
`.game-history-col` ("Your guesses" — the board analog) SECOND, which in a
row-direction flexbox with no `order` override means input-col renders
LEFT and history-col RIGHT — exactly this convention, already. Verified by
screenshot, not just by reading the CSS, before concluding no change was
needed.

**Beeline (all 6 variants) got the actual new layout** — the clear
"game board" (the 36-cell claim grid) vs. "playing space" (turn status,
operand row(s), answer-check) split the request's own example named. New
shared classes in `components/claim-grid.css`: `.game-layout` (flex
container, column by default), `.game-board-col`, `.game-play-col`. DOM
order is kept board-FIRST/play-SECOND in every file (matching the
pre-existing narrow-viewport stacked order: see the board's state, then
act on it) — the row layout doesn't reorder the DOM, it reorders VISUALLY
via CSS `order` (`.game-play-col{order:1}`/`.game-board-col{order:2}`
inside the media query), so narrow-viewport stacking is byte-identical to
before this feature existed and only the wide-viewport case is new.

The 820px breakpoint and the columns' own widths are real computed
numbers, not round guesses: the operand row needs ~408px to avoid its
own already-documented 2-line wrap (see the "known, accepted limitation"
note under Drag interactions), and a 6-column claim grid stays legible at
~300px. `#app`'s own max-width is widened per-file (600px → 900px) so
there's real room once the breakpoint fires — `#rules-box` caps itself
back down to 640px (readable line length) since the wider `#app` isn't
otherwise needed on the settings screen. Confirmed with real Playwright
screenshots at 375px (narrow, stacked, board-on-top unchanged) and 1000px
(wide, side-by-side, board genuinely right of play, zero horizontal
overflow) for every one of the 6 files, per Testing methodology point 8 —
arithmetic alone doesn't prove a real pixel-layout claim.

**A real, pre-existing bug found (not caused) by this verification pass:**
`#claim-grid`'s `grid-template-columns: repeat(6, 1fr)` used a bare `1fr`,
whose implicit track minimum is its content's min-content size — fine for
every variant whose cell text is short, but `beeline-decimal.html`'s "0.37"
(4 characters, the longest of any variant) is wide enough at a narrow
viewport to force the grid wider than its container, overflowing the card
horizontally. This predates today's layout work (the grid's own CSS wasn't
touched by it) and wasn't caught when Decimal Beeline first shipped, since
its own verification never included a real-browser narrow-viewport
screenshot of the claim grid specifically. Fixed in two parts: `claim-
grid.css` now uses `minmax(0, 1fr)` (the standard fix — lets a track
actually shrink to its even share instead of being forced wide by content)
plus `min-width:0; overflow:hidden` on `.claim-cell`, benefiting every
variant defensively; `beeline-decimal.html` alone also dials its own
`.claim-cell` font-size down from the shared 21px to 15px, since even a
properly-constrained ~47px-wide cell (at a 375px viewport) is still too
narrow for "0.XX" at the larger size. Confirmed fixed with the same
Playwright pass (zero overflow, screenshot-verified legible digits).

**Scuttle, Pop, Nim, and Numbo were deliberately left unchanged** — none of
them has a real spatial "board" the way Beeline's claim grid or
Detective's guess history do (Scuttle's persistent scorecard is a 3-row
score table, not a board to view alongside play; Nim's track is a single
short strip that doesn't cost much vertical space to begin with; Pop and
Numbo have no board concept at all), so there's no natural board/playing-
space split to apply the same treatment to. Flagged explicitly rather
than silently skipped, per this project's standing "flag a scope decision,
don't just make it and move on" discipline — if a future request wants
this pattern applied more broadly regardless (e.g. treating a persistent
scorecard as a "board"), that's a bigger, different decision than what was
asked here.

**SUPERSEDED for Scuttle — see "Design sweep (panels left/right, demo
markers, stats reporting)" below.** The "bigger, different decision" this
paragraph flagged (treating a persistent scorecard as the "board" half of
the split) is exactly what a later request asked for, by name: "the
scoreboard and gameboard in scuttle can be left and right." All three
Scuttle files now get it, via `initPlayLayout()`. Pop, Nim and Numbo are
still genuinely unchanged, for the reasons above — none of them has any
persistent panel to move aside, so there's still nothing to split.

## Dynamic sizing, Detective's keyboard overflow, and no emoji anywhere

Real feedback, three parts: **"make sizing more dynamic to fill a great
proportion of the window. Detective elements overflow from box currently.
Remove any emoji."**

**Dynamic sizing.** `#app`'s `max-width` (design-system.css) was a flat
600px for literally every game — on any normal desktop window, that's a
narrow column with huge unused margins on both sides, since `width:100%`
already means "use all available width up to this cap," the cap itself
was just set low. Raised the universal default to 860px; Beeline (which
has genuinely more horizontal content — two side-by-side columns) goes
further still, to 1100px in its own per-file `<style>` override. Beeline's
own `.game-board-col`/`.game-play-col` (components/claim-grid.css) also
changed from a fixed-300px board with an unbounded-growth play column to
BOTH columns growing (board up to 500px, play up to 560px, board growing
faster) — the first version technically used the wider `#app` already, but
comparing real screenshots at 1000px and 1400px showed it as a bigger
board with a mostly-empty play column (that column's own content — one
status line, one row of buttons — doesn't get more USEFUL past a certain
width the way a 6-column grid's cells genuinely do), not the more balanced
result the current ratio gives. No other game's own layout needed
touching — a wider `#app` alone is what "fill a greater proportion of the
window" mostly meant for a single-column game.

**Detective's real overflow bug**, found by an actual Playwright check at
a genuine mobile width (375px), not by assumption: `#keyboard`'s digit row
(`.kb-key`, from `components/wordle-slot.css`) was a FIXED 34px per key —
10 digits × 34px + 9×5px gaps needs ~385px, wider than the input column
ever gets on a real narrow phone (~343px), so the row silently overflowed
the card on both edges (`left: -5px`, `right: 380px` against a 375px
viewport). This is a genuinely different bug shape than Beeline's own
claim-grid overflow from the previous round (that was a grid track sizing
issue; this is a flatly fixed-width row with no shrink and no wrap at
all) — fixed the same principled way regardless: `.kb-key` is now
`flex: 1 1 0; min-width: 0; max-width: 44px` (fits any container width by
shrinking, rather than wrapping to a second line the way Numbo's own
on-screen keyboard already does, or silently overflowing) — a bonus side
effect being it also grows a little on wide screens, one more small piece
of "dynamic sizing." Confirmed fixed with the same Playwright check (zero
overflow at 375px, 768px, and 1280px) plus a real screenshot.

**Emoji removed everywhere**, project-wide: 🎯 (every target-pill), 🎲
(every "Roll [dice]" button and Scuttle Add/Sub's "Random target" button),
🎉/🤝 (Scuttle Add/Sub's and Scuttle Product's win/tie banners — Pop's own
banners had already lost theirs in an earlier round, this just finished
the job project-wide), and 💡 (Detective's Hint button) — 21 occurrences
across 9 files, found via a Unicode-range scan (not just grep for a few
remembered examples) so nothing was missed. Left alone, deliberately: `▾`/
`▴` (the expand/collapse arrows), `⌫` (the on-screen keyboard's backspace
glyph, both Numbo's and Detective's), and Detective's own `✎`-turned-
`(dev)` marker for its dev-mode level override — none of these are emoji
in the colorful/decorative sense the feedback meant; they're small
functional UI glyphs a game genuinely needs to communicate a control or
state, the same category as an arrow or a checkmark, not a "fun" addition
to text that already reads fine without it. (The `✎` WAS changed anyway,
to the unambiguous `(dev)` — it sat in the same Unicode block real emoji
often come from, so plain text sidesteps any ambiguity for a purely
internal/testing-facing indicator with no real design stake in staying a
symbol.) One test assertion (`test/smoke-beeline-product.test.js`) still
expected the old `'BEELINE! You win! 🎉'` banner text and was updated to
match.

## Print button, BEAST 64 rebrand, and a trimmed "Coming Soon" catalog

Three small, unrelated requests handled together in one pass (2026-09-15):

**A Print button next to Settings, on every built game.** Real request:
inactive everywhere except Product Beeline, which links to a real, already-
prepared printable slide deck. Implementation is deliberately uniform
across all 18 built games — the SAME markup shape everywhere
(`<button id="print-btn">Print</button>`), so there's exactly one CSS rule
to style it (`#settings-btn, #print-btn` in `design-system.css`) rather
than one per file. The only per-file difference is the `disabled`
attribute: present (native HTML disabled state — grayed out, unclickable,
no JS needed) on all 17 other games; absent on `beeline-product.html`
alone, where a real click handler opens the deck in a new tab:
```js
el('print-btn').addEventListener('click', ()=> {
  window.open('https://docs.google.com/presentation/d/1sXPQNOObcHZiCxyIvMfYe55ZRueU6WHocV8R_RJLm0s/edit?slide=id.p#slide=id.p', '_blank', 'noopener,noreferrer');
});
```
A new `.top-bar-actions` wrapper (`design-system.css`) groups Print with
whatever already sat at the right end of `#top-bar` — Settings on every
game but one — into a single flex item, so `#top-bar`'s own
`justify-content: space-between` still splits into exactly two groups
(pills on the left, this group on the right) instead of spreading three
items apart evenly, which is what would happen if Print were added as a
third bare child of `#top-bar` directly. **Detective needed a genuinely
different placement, not just a copy-paste**: it has no Settings button at
all (single-player, no settings screen at all — see its own design note),
so its top bar had nothing to put Print "next to." It gets the same
`.top-bar-actions` wrapper, just grouping Print with the level-badge pill
that already lived at that same right-hand position instead of with a
Settings button that doesn't exist there.

**The hub's own H1 renamed "BEAST" → "BEAST 64".** A pure text change to
`index.html`'s `<h1 class="logo">` — this is the umbrella-brand title
(see "Design system conventions"'s note that "Scuttle" etc. are sibling
game names, not the project's own brand), not any individual game's H1,
so no other file's H1 was touched. The boot screen's own separate
"BEAST CLASSROOM" byline (see "Boot sequence") and the browser `<title>`
tag ("Beast Classroom Games") are both distinct strings from the hub's H1
and were deliberately left alone — the request named the "overall page
title" specifically, which reads as the one big visual H1 a visitor
actually sees as this page's title, not every string that happens to
contain "BEAST" anywhere in the file. `test/site-structure.test.js`'s
H1 assertion for `index.html` updated to match.

**"Coming Soon" catalog trimmed from 43 locked games down to 2 (Pig, Math
Match), at the user's explicit direction.** This was done by editing
`GLOBAL_GAMES` itself (`shared-game.js`), not by adding a separate filter
somewhere — since `GLOBAL_GAMES` is documented as the ONE canonical list
both `index.html`'s own cards AND the global nav dropdown read from (see
"Global navigation"), trimming the source list is what actually declutters
both surfaces at once, consistently, rather than needing two independent
fixes that could drift apart from each other later. Pig and Math Match
specifically were the two locked entries requested to survive — both
already existed in `GLOBAL_GAMES` beforehand (`key: 'pig'`/`'math-match'`),
so this was a pure removal, nothing needed adding. The other 41 locked
entries' full descriptions still live in `design/game-catalog.csv` and in
this file's own git history if any of them need to come back later — they
weren't deleted from the actual catalog research, just from the live
UI's `GLOBAL_GAMES` list. **Deliberately NOT touched: each built game
family's own `*-menu.html` sub-menu** (`scuttle-menu.html`, `pop-menu.html`,
`nim-menu.html`, `beeline-menu.html`) — these still show their own
family's locked, catalogued-but-unbuilt SIBLING variants (e.g.
`scuttle-menu.html` still lists "Remainder Scuttle"/"Decimal Scuttle" as
locked cards). The request said "remove... from the menu," and this
project's own docs consistently call `index.html` "the hub"/"the menu" and
call these other four pages "sub-menus" — a different, narrower kind of
locked card (an unbuilt VARIANT of an already-built game family) than the
kind the request was about (an entirely different, unbuilt GAME). Flagged
here rather than silently deciding to touch — or not touch — the four
sub-menu pages without saying so; if the user wants those trimmed too,
that's a small, separate follow-up, not assumed as part of this one.
`test/site-structure.test.js`'s `TOTAL_CATALOGUED_GAMES` constant dropped
from 49 to 8 (6 playable + 2 locked) — every assertion that already read
off this one constant (dropdown length, hub card count) updated for free;
nothing hardcoded the old number in more than one place.

## Answer-explanation modal & stats-demo experiment

Real request (2026-09-17), explicitly framed as an experiment: **"What to
do when someone gets the answer wrong — show a representation that shows
how to work out the answer,"** with a representation named per skill
category (ten-strips for basic addition facts, arrays for basic
multiplication facts, area model for long multiplication, column method
for long addition/subtraction, the long-division algorithm for division,
number lines for rounding and for fractions), **plus a separate, explicitly
"temporary... just demo how this looks" stats page** tracking
skill/correct-count/accuracy-%. The user asked to "keep track of the
changes so we can reverse easily."

**Everything here lives on a dedicated branch,
`experiment/answer-explanations-and-stats-demo`, not on `main`** — the
single biggest lever for "reverse easily" a request like this could ask
for, and a call made unprompted rather than asked about, since branching
is safe/non-destructive on its own (nothing is lost either way) and directly
serves the user's own stated goal. Nothing here has been merged to `main`;
reversing this experiment entirely is deleting the branch, not hunting down
individual diffs.

**Scope was explicitly negotiated before writing any code, not assumed**,
since a literal full build-out (6 representations × every applicable built
game, ~15 files) is a dramatically bigger effort than what "an experiment"
usually implies. Asked and answered: a **3-game pilot** (Scuttle Add/Sub →
column method, Scuttle Product → area model, Beeline Rounding → number
line) to react to the actual look/feel before deciding whether to expand —
NOT the 1-per-representation or full-rollout options also offered. Ten-
strips, arrays, and the long-division algorithm are therefore **not
built anywhere yet** — flagged here so a future pass doesn't assume they
exist because this section does.

**Trigger timing was also explicitly clarified, and it's a real behavior
change, not just a visual add-on**: the user's own follow-up was *"replace
the existing hint, but students should no longer have to actually answer —
this should be a modal that tells them the answer and then we move on."*
This is a genuine reversal of this project's own standing retry-until-
correct convention (see Code conventions / Testing methodology point 7,
which describes "wrong guess → try again, hint unlocks after 2 misses" as
the shape *every* game already uses) — for these 3 pilot games specifically,
at the SAME 2-wrong-attempts trigger point that used to just reveal a
text hint, the round/move now completes automatically (using the real
correct value) once the player dismisses the explanation, rather than
requiring them to keep retyping it. Every other game's own retry-until-
correct hint mechanic is completely untouched.

### Shared modal shell, bespoke visuals

`showExplanationModal({ title, answerHtml, visualHtml, onContinue })`
(`shared-game.js`) owns only the generic modal shell — lazily built into
the DOM on first call, shown/hidden via `.hidden`, "Got it — continue"
firing `onContinue` exactly once (the button is cloned/replaced on each
call specifically to prevent a stale closure from an earlier call also
firing — plain `addEventListener` would stack listeners on the same
persistent node across calls). CSS lives in `design-system.css`
(`.explain-modal-backdrop`/`.explain-modal`/etc.), `z-index:200` —
deliberately above both `#global-nav` (40) and the boot screen (100),
since this can appear well after either. Extracted to shared code
immediately, given 3 simultaneous real consumers at once — this project's
own established bar (see the Beeline two-row engine, extracted at 5
consumers; Avatars' own note that even 3 was "a stronger case... than the
usual 'wait for a second consumer' bar").

The actual visual INSIDE the modal is bespoke per game, matching this
project's standing "shared scaffolding, bespoke rendering on top" split
(same shape as Detective's `renderInputSlots()`):
- **Scuttle Add/Sub — column method** (`renderColumnMethodExplanation()`,
  scuttle-addition-subtraction.html): real digit-by-digit addition-with-
  carry and subtraction-with-borrow (including cascading borrows across
  zeros, e.g. 300−7 — verified against many hand-computed cases in a
  throwaway Node script before any HTML was touched, the same "verify
  before shipping" discipline Bot AI philosophy already applies to bot
  logic), rendered as two chained steps (`a op1 b`, then `result op2 c`),
  matching the existing hint text's own two-step framing. **Known,
  flagged scope limit**: only handles non-negative intermediate/final
  results with the full grid — this game's chained `a±b±c` can genuinely
  go negative (subtracting a bigger number from a smaller one), and a
  standard column-borrow visual has no standard meaning at this grade
  level for that case. Falls back to a plain worked-out equation (still
  the real, correct arithmetic, just not the grid) whenever a step would
  go negative, rather than inventing a non-standard negative-number
  column visual.
- **Scuttle Product — area model** (`renderAreaModel()`,
  scuttle-product.html): real place-value decomposition of both factors
  (`placeValueParts()`, e.g. 342 → [300,40,2]) into a genuine `d1 × d2`
  grid of partial products that actually sum to the true product —
  verified across all 4 formats (2x1/3x1/4x1/2x2) in the same kind of
  throwaway verification script. A 1-digit second factor (2x1/3x1/4x1)
  is naturally just a 1-column grid; 2x2 is a real 2×2 grid — one function
  handles every format, no format-specific branching needed.
- **Beeline Rounding — number line** (`renderNumberLine()`,
  beeline-rounding.html): a CSS-positioned dot between the floor-ten and
  ceiling-ten ticks, highlighting whichever tick the SAME `valueFn`
  formula the game itself already uses (`Math.round(ab/10)*10`, passed in
  as `correct`, never re-derived independently) says is the answer —
  same "never duplicate the real computation with a second, possibly-
  drifting version" discipline as Numbo's EPS/HUMAN_TOLERANCE split.
  Explicitly special-cases the exactly-halfway case (ones digit = 5): says
  "exactly halfway always rounds up" rather than the misleading "closer
  to," since the two ticks are genuinely equidistant there, not actually
  closer to one side.

### What changed in each pilot game's answer-check

All 3 follow the identical shape: the correct-guess branch's completion
logic was extracted into its own named function (`commitCorrectTotal()` /
`lockInRound()` already existed for Product / `commitPendingRoundedValue()`)
so both a correct typed guess AND the modal's "Continue" reach the exact
same completion path — no second, parallel copy of "what happens when this
round/move is done." The `wrongAttempts >= 2` branch that used to write
plain text into a `hint-line` element now calls `showExplanationModal()`
instead; the `hint-line`/`product-hint-line` DOM elements themselves were
deliberately left in the markup, just no longer written to — minimal-
footprint changes, on the theory that a reviewer deciding to revert this
specific piece should be able to just restore the 2-3 lines that used to
set that text, not also reconstruct removed markup.

### Test coverage

Each pilot game's existing smoke test gained a real wrong-answer→modal→
continue probe (2 deliberately wrong submissions, assert the modal appears
and states the REAL correct value — not a hardcoded expected string, read
off the same computation the game itself trusts — assert nothing commits
before Continue, click Continue, assert the round/move completes with the
correct value). For Scuttle Product (12 format×difficulty combinations)
and the shared two-row Beeline variants file, the probe runs only ONCE
(first combination for Product; only for `beeline-rounding.html` among the
4 variants in that shared file) — the mechanism itself is format/variant-
independent, so re-probing it in every combination would be redundant, not
more thorough, the same reasoning `checkAvatarsAndScorecard` already uses
in `smoke-product.test.js`.

### Stats-demo page

`stats-demo.html` — a standalone page, deliberately **not** added to
`GLOBAL_GAMES`/`index.html`/any nav, per its own explicit "temporary...
just demo how this looks" framing: reversing this later is deleting one
file, no site-structure cleanup needed anywhere else. Renders a per-skill
table (skill name / correct-out-of-attempts / an accuracy-% bar) from a
hardcoded `SAMPLE_STATS` array — genuinely fake data, not wired to any real
game's actual play, exactly as asked ("no need to track over sessions, just
demo how this looks"). Still links `design-system.css`/`shared-game.js` and
calls `renderGlobalNav()` (with no key, so no page is marked "current") for
a consistent look and an easy way back to the hub, and carries a visible
"DEMO ONLY — sample data, not live tracking" banner so it can never be
mistaken for a real feature if stumbled onto directly. **Not built**: any
real per-game event pipeline that would feed this from actual play — that
would be a substantially bigger, separate task, out of scope for "just
demo how this looks."

### Second iteration — what the first pilot got wrong

The first pilot was reviewed and came back **"not quite right"**, with
four specific corrections. All four are now implemented; keeping the
original reasoning above intact, with what changed called out here,
since several of these REVERSE a judgment call the first pass made.

1. **"It should definitely give the answer... that wasn't the case in
   rounding beeline where it was more of a hint."** The rounding visual
   led with `"34 is closer to 30 than to 40, so it rounds to 30"` —
   reasoning-first phrasing, with the answer only arriving at the end of
   a sentence and the correct tick marked by nothing louder than a green
   text color. Now the settled frame leads with a large, unambiguous
   **"Rounds to 30"** headline (`.numline-headline`), with the
   closer-to/halfway reasoning demoted to small supporting text beneath
   it, and the answer tick/dot visibly enlarged and recolored. General
   rule this established for any future representation added here: **the
   answer is a statement, not a conclusion the visual leaves the player
   to draw.** `#explain-modal-answer` (the modal's own answer line) is
   also now shown in full the INSTANT the modal opens — never staged
   behind the animation — so the answer is never ambiguous no matter
   where the animation happens to be.
2. **"The addition and subtraction is too calculation heavy. It should
   be... 3rd grade accessible math, using the column addition/subtraction
   algorithms."** The column method itself was right (that's what was
   asked for both times) — the DENSITY was wrong: the first version drew
   every carry, every strikethrough-and-rewrite, and a superscript borrow
   mark for BOTH chained steps at once, as one static block. Now each
   cell shows exactly ONE value at a time and the borrow/carry is
   conveyed by that value visibly CHANGING between two quick frames
   (a borrowed-from digit dropping by 1, a borrowing digit gaining 10,
   `.colm-changed`) instead of stacking old+new+marker in one cell.
   `.colm-strike`/`.colm-borrow-mark` are gone entirely.
3. **"Ideally the solutions should quickly animate in, show the steps and
   then the answer. This needs to be quick because speed is an element in
   fluency and we don't want to slow them down."** New shared
   `revealSteps(containerEl, frames, msPerFrame, onDone)` in
   `shared-game.js`, and `showExplanationModal()` now takes
   `visualFrames` (an array) + `msPerFrame` instead of a single static
   `visualHtml` string. Same governing rule as "Celebration animations":
   a short FIXED sequence, once, never looping, skipping straight to the
   final frame under `prefers-reduced-motion`. Deliberately faster than
   this project's other animations (350ms/frame default, vs. the ~650ms
   count-up) because of the fluency argument above. Frame counts adapt to
   the actual problem — a step with no carrying/borrowing renders 2
   frames (blank → solved), not 3 — so easy problems resolve faster
   still. `revealSteps()` returns a `stop()` that jumps straight to the
   final frame; the modal's Continue button calls it, so a player who
   already gets it is NEVER forced to sit through the animation, and the
   interval can't leak past the modal closing.
4. **Stats: "also track — time on game, and time since playing. For time
   on game, stop counting after 2 mins without a mouseclick or keystroke.
   And stop counting if tab out."** "Time on game" is now REAL, live
   tracking on `stats-demo.html` (not sample data like everything else on
   that page — the specific mechanical rules asked for are the whole
   point, so faking it would demo nothing): a `performance.now()`-delta
   accumulator that only adds time while BOTH the tab is visible
   (`document.hidden === false`) AND a real `mousedown`/`keydown`
   happened within the last 2 minutes, with a live status line showing
   which of the three states it's in ("Counting…" / "Paused — tab not
   visible" / "Paused — no activity for 2 minutes") so the behavior is
   actually demonstrable rather than just claimed. Idle/hidden time is
   DISCARDED per-tick rather than paused-and-resumed across a gap, which
   is what makes it correct regardless of how aggressively a background
   tab's timers get throttled before the next tick fires. "Time since
   playing" is a per-skill **"Last played"** column — deliberately still
   fake sample data, since real values need cross-session persistence,
   which the original ask explicitly ruled out ("no need to track over
   sessions").

**Test coverage followed the animation change**, per Testing methodology
point 6's existing convention for async effects: each pilot game's probe
now asserts the MID-FLIGHT state right after the modal opens (only step 1
showing / grid cells still empty / no verdict announced yet — which is
what actually proves the reveal is staged rather than instant), then
sleeps past the worst-case duration and asserts the SETTLED state.
`test/smoke-beeline-two-row-variants.test.js` had to become async
(`for...of` inside an async `main()`, not `VARIANTS.forEach`) to support
that sleep — `.forEach` with an async callback would not have awaited
anything.

### Third iteration — polish pass

1. **Stats: the live timer was cut.** The second iteration built "time on
   game" as real idle/tab-aware session tracking; review came back "the
   time tracking on stats is wrong. Just add a column to the table: Total
   time. Hard code fake data." So the whole timer (and its status line) is
   gone, and `stats-demo.html` is back to one uniform thing: a table where
   **every** column is sample data, now including **Total time** and
   **Last played**. Worth remembering as a scoping lesson rather than just
   a revert: the specific mechanical rules in that request ("stop after 2
   mins idle", "stop if tab out") read as a spec to implement, but they
   were describing what the eventual real metric should MEAN, not asking
   for it to be built inside a mock-up.
2. **Area model: annotations, not headers, and sized by digit count.**
   The factors were header cells inside the bordered table; they're now
   annotations OUTSIDE the rectangle (`.am-col-labels`/`.am-row-labels`),
   and the rectangle holds nothing but partial products. New house rule,
   applied by `areaUnits()`: **a row/column for an n-digit part is n+1
   units** — 6 is 2 units, 40 is 3, 300 is 4 — so bigger place values get
   visibly bigger boxes without a 4-digit case crushing the small parts to
   slivers (true-to-value proportions would make a 300x6 box 50:1). Unit
   size is then scaled to keep even the 4-digit-by-1-digit case inside the
   modal. Per the same feedback, the frame and its outside annotations are
   **fully drawn in frame 0** — the animation only fills the inner cells,
   one per frame, then adds the addition line.
3. **Column method keeps both steps.** "Show both, don't let the first one
   disappear, we want students to be able to see the full working at the
   end" — every step-2 frame now carries step 1's solved frame above it,
   so the modal ends on the complete worked problem.
4. **~5s total, not a fixed per-frame delay.** `EXPLAIN_TOTAL_MS` (5000)
   in `shared-game.js` is divided by the frame count, so every explanation
   takes about the same time to watch regardless of how many frames its
   particular problem needs (2 for a no-carry step, 10 for a 9-column
   array). Callers can still pass an explicit `msPerFrame`.
5. **Beeline Product joined the pilot** (4 games now, not 3) with the
   **array + skip-counting** representation the original request named for
   basic multiplication facts — which is exactly what this game is, two
   single-digit factors. `renderArrayFrames(a, b)` reveals `a` columns of
   `b` dots one at a time with the running skip-count (b, 2b, 3b…) under
   each, so the final count under the final column IS the product. All
   column slots exist from frame 0 (just hidden) so nothing shifts as they
   fill — the same reserve-the-space rule as "Layout stability".
6. **A temporary "▶ Demo" button** sits in the top bar of all four pilot
   games (`#demo-explain-btn`, styled deliberately as obviously-not-
   shipping-UI: dashed, warn-coloured). It opens the modal on a FIXED
   sample problem with a no-op Continue, so it works from any screen
   (including settings, before a round exists) and commits nothing. One
   consolidated block at the end of `test/site-structure.test.js` checks
   all four actually open a populated modal — a demo button that throws is
   the worst possible failure for a button whose whole purpose is being
   clicked in front of people. **Delete that block along with the
   buttons** when the experiment ends.

**Two real bugs this pass's own browser check caught** (jsdom can't see
either — both are pixel/rendering claims, per Testing methodology point
8): the column method printed a leading zero on any sum that didn't use
`columnAdd()`'s reserved carry column (342 + 179 rendered as "0 5 2 1"),
now fixed by `resultCells()` suppressing leading zeros plus dropping the
unused column entirely; and a borrowed column's genuinely two-digit
working value (521 − 168 really does work as 4 | 11 | 11) overflowed its
single-digit-wide column, now given a smaller font rather than being
faked into something arithmetically wrong.

### Fourth iteration — polish, and one real giveaway bug

1. **Beeline was drawing a box around the correct answer.**
   `.claim-cell.pending` (components/claim-grid.css) outlined the grid cell
   whose value matched the pending move, and it applied *only* while
   `st.phase === 'awaiting-answer'` — i.e. it highlighted the answer at
   exactly the moment the player was being asked to work it out, in all
   six Beeline variants. Removed from all six `cellClassesFor()`s and from
   the shared CSS. This is a **gameplay bug, not a styling preference**,
   and it long predates this experiment — the dotted frames added for the
   demo are what made it noticeable. Don't reintroduce any highlight keyed
   to the pending value.
2. **Dotted frames marking what's demo-ready.** `DEMO_READY_HREFS` in
   `shared-game.js` is the one canonical list of the four variant files
   that have the explanation built; `index.html`'s grid frames both the
   game card (via `gameHasDemo()`) and the specific variant sublinks, and
   the Scuttle/Beeline sub-menus call `markDemoReadyCards()` to do the same
   for their hand-written cards. `.demo-framed` uses `outline` rather than
   `border` so it can't resize a card or shift the grid. One list to
   delete when the experiment ends.
3. **Array dot spacing was uneven** — 8px between columns vs. 3px between
   rows, which made the array read as columns of stacked bars instead of a
   grid. Both now come from one `--arr-gap` custom property on
   `.arr-wrap`, so they can't drift apart again. (For the record, since it
   came up: the array's design lives in `beeline-product.html`'s own
   `<style>` block — per-game bespoke, like every other representation's
   visual. Only the modal SHELL is shared in `design-system.css`.)
4. **Pacing slowed, and now clamped.** `EXPLAIN_TOTAL_MS` 5000 → 7000, but
   the bigger fix is that dividing a budget by frame count alone produced
   very different per-beat speeds (a 10-frame array got 555ms/frame and
   read as a flicker; a 2-frame visual got the whole budget). The result is
   now clamped to `EXPLAIN_MIN_FRAME_MS`/`EXPLAIN_MAX_FRAME_MS`
   (700–1800ms), which makes the total approximate rather than exact —
   the right trade, since no individual beat should be too quick to follow
   or slow enough to stall. **Any test that waits out an explanation needs
   ~10s**, not the old 7s.

### Design sweep (menus)

A review pass over the listing pages — "drop shadows cut off, organization
messy, dotted demo lines too subtle" — plus a full-site audit. The
aesthetic is unchanged; this is hierarchy and hygiene.

1. **`* { overflow-x: hidden }` was clipping the pixel shadows.** On
   `index.html` that universal rule made EVERY element a clipping box, so
   any card sitting flush against `#app`/`#game-grid`'s edge had its own
   `6px 6px 0` shadow (and its demo frame) sliced off — at 380px wide the
   card's right edge and `#app`'s right edge were both at 404, so the
   shadow had nowhere to paint. Now `html, body { overflow-x: hidden }`,
   which still prevents the page-level horizontal scroll the rule was
   there for (the boot byline is sized in `vw`). **Never scope
   `overflow` with `*` in a design system built on outset shadows.**
   Separately, `.variant-list`/`.game-grid` now carry right/bottom padding
   and a wider gap, so a shadow never has to paint outside its container
   or onto the next card.
2. **Playable and coming-soon games were one undifferentiated list**, with
   a footnote at the very bottom as the only signal — on `beeline-menu.html`
   that meant 9 locked cards visually outweighing the 6 real ones. Now both
   tiers sit under `.menu-section-head` headings ("Playable now" / "Coming
   soon"), injected by `renderMenuSections()` for the static sub-menus and
   emitted as full-width grid items by `renderGameGrid()` (so every card
   stays a direct child of `#game-grid` and existing selectors still work).
3. **Locked cards were structurally as loud as playable ones** — identical
   4px border and full shadow, receding only via `opacity: 0.55`, which
   also pushed their text below comfortable contrast. They now recede
   structurally (2px border, no shadow, recessed background) at a higher
   opacity, so they read as a lower tier AND are easier to read.
4. **The demo marker is three signals now, not one.** A thin dotted
   outline alone read as noise against the card's own heavy black border.
   It's now a heavier dotted outline + a `DEMO` chip next to the name
   (`.badge.demo`, injected for both the rendered hub cards and the static
   sub-menu ones) + a one-line legend above each list. Deliberately NO
   background tint at card scale — tried it, and over that much white it
   read as aged paper rather than highlighted; the tint survives only on
   the chip-sized marks (framed sublinks, legend swatch). Relatedly,
   `.variant-sublist`'s divider went from dashed to solid: dotted/dashed
   now means one specific thing on these pages, and a dashed rule inside
   the same card competed with it.
5. **`--color-warn` was near-invisible in dark mode.** Dark goldenrod
   (#b8860b) on the #1b2530 ground had failed to get the same lift
   beast-red/blue already get in the dark block. Added an override (plus
   `--color-warn-bg`), which also helps the target pills and Nim's
   selected-move ring, not just the demo markers.

### Design sweep (settings screens)

A second review pass, this time on the settings screen itself. All of it is
done by `initSettingsChrome()` (shared-game.js) restructuring the DOM at
runtime — same "one real implementation" reasoning as `renderGlobalNav()` —
so **no game's settings markup was edited**; each game just calls it once,
right after `renderVariantSwitcher()`.

1. **Variant is now its own card, above the settings card.** It swaps the
   entire game, unlike difficulty/target/avatar which only tune the current
   one — but it was just another `.section-label` inside the same card,
   carrying the same weight as picking a bot tier. The card is hidden and
   shown in step with `#screen-settings`, so it never sits above the board
   mid-game.
2. **The avatar picker moved into a modal** behind one button that shows
   the current pick ("Choose avatar · Grogg"). Eight avatar tiles were the
   visually dominant element of the settings card while being its least
   consequential choice. The picker's own nodes are MOVED, not rebuilt, so
   every handler each game bound to them still works untouched — picking
   still updates `st.avatar` and the badges exactly as before.
3. **Chips are centered and sized to their content.** `.chip-row button`
   had `flex: 1`, which stretched "Easy / Medium / Hard" across the full
   card width — three buttons far wider than their labels, left-aligned
   against a lot of empty space. The rest of the settings stack is centered
   to match, since centered controls under left-aligned labels read as two
   different alignments in one column.
4. **The top bar's pills are hidden on the settings screen** (they report a
   game that hasn't started) **and given more presence during play** (they
   were under-emphasized exactly where they matter). The `Settings` button
   also hides itself on the settings screen. Driven by a
   `body.settings-active` class, kept in sync three ways: an initial call, a
   `MutationObserver` on `#screen-settings` (guarded — the bare
   `vm-load-page.js` sandbox has no `MutationObserver`, same as its lack of
   `setPointerCapture`), and a bubble-phase document click listener, which
   is what makes the switch synchronous for both players and tests rather
   than landing a microtask late.

**`initSettingsChrome()` gates itself on being in a real DOM** —
`vm-load-page.js`'s sandbox returns the same stub element for every query,
so the function probes for a `children` collection and no-ops rather than
having a guard bolted onto every DOM call in it.

### Design sweep (click positions, modal height)

1. **The explanation modal grew mid-sequence.** Every one of these visuals
   ADDS content as it animates (the column method keeps step 1 on screen
   and builds step 2 below it; the number line adds its verdict lines; the
   area model adds its addition row), so the modal — and the Continue
   button under it — jumped while the reader was watching.
   `reserveFrameHeight()` (shared-game.js) now renders every frame once
   into a hidden probe at the container's real width, takes the tallest,
   and sets that as a `min-height` before the sequence starts. Measured
   rather than hardcoded per visual, so it stays right for any future
   representation and for whatever a given problem's numbers render as.
   All four are now single-height for their whole reveal.
2. **Advance buttons wandered.** Roll dice / Lock in number / Next round
   are the same "advance" click at different moments, but they lived at
   different depths in the round card — measured on Scuttle Add/Sub, the
   button the player clicks over and over appeared at y=557, then y=788,
   then y=851. They're now collected into one `.action-stack` at the
   bottom of the card, overlapping in a single grid cell (the same trick
   `.desc-line-stack` already uses), so whichever is showing renders in
   exactly the same place — verified at a constant y=794 across a whole
   round. `stackAdvanceControls()` does this at runtime, per game.
   **Deliberately scoped to bare advance BUTTONS**: an answer-check row
   (input + submit) is a different kind of control, much taller, and
   overlapping it with a lone button would reserve its height on every
   step. **Checked and left alone:** Numbo's five round sub-phases are
   mutually exclusive `.hidden` blocks that all collapse to the same top
   edge, so its Next round button is already positionally consistent; Pop
   and Beeline have one advance control per screen; Nim's move buttons
   never move. Scuttle was the family with the real problem.

**And a real layout bug an earlier pass surfaced:** `#slots-row` was EMPTY in the
markup and only got its slot boxes once a roll happened, so Scuttle's round
card grew from 375px to 431px the instant you rolled. `.phase-hidden`
reserves the space an element's CONTENT occupies — an empty wrapper
reserves nothing, which is exactly the trap "Layout stability" already
warns about, shipped anyway. `#dice-row` next to it already had the
`min-height` that prevents this; `#slots-row` now does too, and
`test/layout-stability.test.js` statically asserts that both keep one (a
static check because jsdom has no layout engine to catch it dynamically).

**Audit method, worth reusing:** rather than eyeballing pages, a throwaway
Playwright script walked all 24 pages at 1100px and 380px and reported (a)
any shadowed element clipped by an `overflow` ancestor, (b) anything
sticking out past the viewport, (c) page-level horizontal scroll, and (d)
uncaught page errors. That's what caught a regression this very sweep
introduced — the stats table's new 5th column pushed `stats-demo.html`
into horizontal scroll on a phone (fixed by giving the table its own
`overflow-x: auto` box, since a table is the one thing allowed to be wider
than the layout). Worth re-running after any layout change; the check for
"legitimately wider, but inside its own scroll container" is the one
refinement it needs to avoid false positives.

**A real test-timing trap from an earlier pass, worth remembering:**
`setTimeout(botTurn, 550)` captures the function VALUE at scheduling
time, so stubbing `botTurn` afterwards does NOT stop an already-queued bot
move. The two-row variants test only started failing once a probe waited
out the ~5s animation — long enough for a bot move scheduled several
steps earlier to fire and move a token out from under the assertions
(tokens came back `[5,9]`, then `[5,1]`, instead of `[5,2]`). Fixed by
stubbing `botTurn` **before** any commit schedules one. Any future test
that adds a long `await` to a previously-synchronous Beeline/Nim probe
will hit this same thing.

### Design sweep (panels left/right, demo markers, stats reporting)

Three parts, one pass. Real feedback: **"Redesign with more separation of
panels left and right. I want to avoid ever needing to scroll up or down,
and there is a lot of dead space to the left and right sides of the screen.
For example the scoreboard and gameboard in scuttle can be left and right.
Beeline is already good. The demo button is good, we don't need the dotted
border anymore. But we should also have the identifier on the variants
we're demoing. Stats/Reporting: I want stats to be clickable from anywhere.
A small bar chart glyph icon stuck to the corner somewhere. When I click I
want to see a list of collapsed skills. if I access from a specific game, I
want that skill expanded. E.g. Product Beeline has the skill
'multiplication facts'."**

**1. Scuttle's scoreboard and gameboard are now left and right**
(`initPlayLayout()` in `shared-game.js`, `.play-layout`/`.play-side`/
`.play-main` in `design-system.css`). Same runtime-restructuring approach
as `initSettingsChrome()` — it keys off `#scorecard` alone, so all three
Scuttle files got it with zero markup edits and any future game that grows
a scorecard gets it for free. DOM order is unchanged (scorecard first,
play screens after), which is both what the narrow-viewport stacked view
still renders AND what makes scorecard-left/board-right fall out with no
`order` override — the same reasoning the Beeline section below already
records, applied to a persistent scoreboard instead of a claim grid.
`#app` widens to 1060px only for a game that actually has two columns to
fill (`#app.has-play-layout`), with the settings step capped back to 680px
— and the top bar capped with it *during settings only*, since there it
holds just the Demo/Print group and at full width drifted off to the
right, detached from the cards below it. **This reverses the earlier
"Scuttle was deliberately left unchanged" note in the Beeline section
below** — that call was made on the grounds that a 3-row score table isn't
a "board," which the feedback here explicitly overrides by name.

**Measured, not assumed.** A throwaway Playwright pass over all 23 pages at
1280×900 recorded document height on the settings screen AND after starting
a game. Before: every Scuttle/Pop settings screen and all four sub-menus
scrolled. After: **every game screen, in every phase, fits without
scrolling** — verified by driving a complete Scuttle match (roll → place →
lock → all 3 rounds → compute → reveal) and measuring at each step, not
just on entry. The sub-menus were the other half of the same "dead space
left and right" complaint: `.variant-list` was a single flex column, so
`beeline-menu.html`'s 15 cards ran 2116px down the middle of a 1280px
window. It's now the same 2-column grid `index.html`'s `.game-grid`
already used (one column below 620px), which took Beeline 2116→1456px,
Pop 1682→1220px, Scuttle 1169→905px, Nim 1044→927px. A 15-card list still
scrolls, and should — you can't fit 15 readable cards on one screen — but
it's now half the distance.

**2. The demo marker moved from a frame to a per-variant chip.**
`.demo-framed` no longer draws anything; the class survives purely as the
hook that marks which items are demo-ready and gets a `Demo` chip. The new
part is that `index.html`'s variant sublinks carry the chip too, not just
the family card — a `DEMO` badge on "Beeline" can't say which of its six
variants it means. `test/site-structure.test.js`'s sublink assertion had to
stop reading `a.textContent` (now "ProductDemo") and read the link's own
text nodes, with the chips asserted separately against a mirrored copy of
`DEMO_READY_HREFS`.

**3. Stats are reachable from every page** — `renderStatsLauncher()`,
called from `renderGlobalNav()`, so it's on every page by the same
one-implementation guarantee the nav itself has. A fixed bottom-right
button with an inline SVG bar chart (no emoji, per this file's own rule),
opening a modal listing every skill collapsed, with the current game's own
skill already expanded.

The one real design decision: **stats are keyed by SKILL, not by game.**
Several games train one skill (Beeline Difference and Scuttle Difference
are both subtraction) and one family spreads across several, so a
game-keyed list would say much less than it looks like it does.
`SKILL_STATS` holds 10 skills, each with the list of game hrefs that feed
it — the numbers are sample data like the rest of this experiment, but the
skill→games mapping is real and worth keeping accurate as games get built.

**The subtlety worth remembering: the panel resolves "which page is this"
at CLICK time, not at render time.** `renderGlobalNav()` runs before a
game's own `renderVariantSwitcher()`, which is what supplies the exact
variant href (`location` can't — see this file's note on why every test
harness loads pages under a fake URL). So the launcher stores nothing;
`currentPageHref()` reads `CURRENT_PAGE_HREF` when the panel is first
built. Two sources feed it: `renderVariantSwitcher` sets it for
multi-variant games, and `renderGlobalNav` sets it from the nav key for
**single-variant** games only — a single-variant key identifies one file,
a multi-variant key names a family and would guess the wrong default. A
page with neither (the hub, a sub-menu) opens with nothing expanded, which
is the right outcome rather than an error.

## Spacing scale — use the tokens, not arbitrary values

`design-system.css`'s `:root` defines `--space-xs: 8px` / `--space-sm: 16px`
/ `--space-md: 24px` / `--space-lg: 32px` / `--space-xl: 48px`. **New
margin, padding and gap values come from this scale.** Roughly: `xs` inside
a control, `sm` between related controls, `md` between blocks in a stack,
`lg` between sections, `xl` between major regions.

The problem this solves isn't any single wrong number — it's that spacing
accumulated as 4/6/8/10/12/14/18/20px all meaning "a small gap" in files
written months apart, so there was no vertical rhythm to speak of and no
way to change density globally. The steps are a ~1.5x progression,
deliberately far enough apart that choosing between two adjacent ones is an
easy call.

**Genuinely optical values are NOT spacing and stay literal** — the 3px
nudge that drops `.fbar` clear of a digit box's drop shadow, its -5px
overhang, a 2px label offset. Forcing those onto the scale would be
cargo-culting it. The test is whether the number is "how far apart should
these two things be" (scale) or "this specific shadow is 3px tall"
(literal).

Migration is **opportunistic, not a big-bang rewrite**: values were moved
onto the scale in the blocks this pass actually touched (page rhythm, the
HUD, the play layout, the round card, action stacks, button rows). Plenty
of older per-component values are still literal. Convert them when you're
next editing that block for another reason — a blanket find-and-replace
across every component would be a large untested visual change for no
behavioural gain.

## Type scale — seven steps, 13px floor

Real feedback: **"Too much font is too small. For example the header banner
is too small. Too many font sizes, indents, font types on a page looks
cluttered."**

There were **28 distinct font sizes** across the project. 10, 10.5, 11, 12,
12.5, 13, 13.5, 14, 14.5, 15, 15.5 all existed as separate values — eleven
ways to say "small text", which is why pages read as cluttered: nothing
signalled what the hierarchy was meant to be.

`design-system.css`'s `:root` now defines seven steps, and **every**
`font-size` in the project uses one (144 declarations migrated):

| token | px | for |
|---|---|---|
| `--text-xs` | 13 | the FLOOR — captions, legends. Nothing is smaller. |
| `--text-sm` | 15 | supporting text, labels, secondary buttons |
| `--text-md` | 17 | body and primary controls — the default |
| `--text-lg` | 21 | sub-headings, board cells, the numbers you tap |
| `--text-xl` | 27 | page H1, a big in-game statement |
| `--text-2xl` | 36 | the hub wordmark; the HUD primary when short |
| `--text-3xl` | 48 | the HUD primary — the loudest thing on the page |

`test/site-structure.test.js` **forbids raw px font sizes** anywhere outside
that `:root` block, and asserts the floor stays ≥13px. Pick a step; don't
invent a value between two. Something that genuinely needs an in-between
size is a sign the hierarchy is wrong, not that the scale needs an eighth
entry.

**Banner sizes specifically**, since "too small" was the complaint: the
global nav grew 44px → 56px with a 17px wordmark (was 14px); a game's H1 is
27px (was 23px); the hub's own `BEAST 64` wordmark is 36px, a clear step
above a game's H1. Press Start 2P runs small for its point size, so a pixel
H1 sits a step above where a sans one would.

**Font FAMILIES were already fine and are unchanged** — two, and only two:
Press Start 2P for the H1 and the win banner, Rubik for everything else.
Worth stating because the feedback mentioned "font types": the clutter was
sizes and alignment, not families, and adding a third family to "fix" it
would make it worse.

## Settings screens — two columns

Real feedback: **"pop settings page is too cluttered - lots of rows of
unequal lengths. Better to arrange in 2 columns."**

A settings card was one column of `.section-label` + control pairs, each a
different width (three difficulty chips, two format chips, one number
input), stacked down the page — nothing to line up against, and a long card
for very little content.

`initSettingsColumns()` (`shared-game.js`) wraps each label with the
controls that belong to it into a `.setting-group` and lays the groups out
2-up. Actions — Start, the avatar button, the rules disclosure — are pulled
into a full-width `.settings-footer` underneath, as a wrapping ROW, because
they aren't settings and shouldn't compete for a column. Runtime, after the
variant lift and the avatar move, so it groups the final DOM. 18 screens,
one implementation, no markup edits.

The settings step is capped at 820px and **left-aligned, not centred** — at
full card width its two columns were ~500px each holding ~250px of chips,
and centring the capped card under a left-aligned page header put the page
on two different left edges, which was the "indents" half of the clutter
feedback. One left axis for the whole page.

`@media (max-height: 940px)` covers the ordinary laptop as well as an iPad
in landscape, tightening chrome (the HUD primary, card padding, header
margins) so a content-heavy settings screen doesn't scroll. **The H1 is
deliberately excluded from that tightening** — shrinking the banner on the
most common screen size would undo the feedback that made it bigger.

## 1024×600 zero-scroll architecture

A design handoff set the floor explicitly: **the app must fit a landscape
small tablet (1024×600) with no scrolling in either axis.** Measured before
starting: **13/13 game pages overflowed**, by up to 335px, and "Start game"
sat below the fold on 8 of them. After: **0/13**, verified settings, play
and mid-round.

Three mechanisms, in the order they do the work:

**1. Fluid spacing.** `--space-*` are now `clamp(floor, Nvh, ceiling)`
rather than fixed px. On a desktop the ceiling wins and nothing is cramped;
at 600px tall the vh term wins and the whole page compresses. **The air
between elements goes before the elements themselves** — that ordering is
the whole point. `.card` padding is `clamp()` on the same principle.

*Accepted tradeoff:* these tokens are used for horizontal gaps too, so a
short-but-wide window tightens those more than it strictly needs to. Not
worth a parallel set of horizontal tokens — that doubles the vocabulary the
scale exists to shrink.

**2. Fluid components.** Fixed px dimensions in `dice-slot.css` and
`claim-grid.css` became `clamp()` too. This caught a real bug the height
work would otherwise have masked: at a fixed 52px, Beeline's nine operand
cells needed 516px and **wrapped to two lines at 1024px wide**, costing
122px instead of 58. Any reservation paired with a fluid item (`#dice-row`
vs `.die-wrap`, Pop's `#current-digit-wrap` vs the die) must use a matching
expression — a stale constant beside a clamped item is how Pop over-reserved
its die slot by ~20px. `test/layout-stability.test.js` now checks that
pairing directly, at both ends of the fluid range, instead of against a
hardcoded number.

**3. A hard outer boundary.** `body` is exactly `100vh`; `#app` is a flex
column with `min-height: 0` (without which a flex child cannot compress,
and the clamp() spacing has nothing to compress into).

**Deliberate deviation from the handoff: `#app` uses `overflow-y: auto`,
not `overflow: hidden`.** Hidden gives the same boundary but makes any
overflow invisible *and unreachable* — a long rules box or the 15-card
Beeline menu would silently lose content with no way to get at it, and it
would also break the "scroll below 768px wide" rule from the previous
round. `auto` fails safe. The compression that makes things *fit* is the
clamp() spacing; clipping was never what would have achieved it.

**Short-viewport tiers live at the END of design-system.css, on purpose.**
They override by *source order*, not specificity — a later single-class
rule like `.feedback-msg { margin: 8px 0 }` was silently beating the
identical-specificity override inside a media query defined earlier in the
file, so several trims were doing nothing at all. Anything added to those
blocks must stay below every rule it intends to override. Two tiers:
`max-height: 940px` (ordinary laptop and iPad landscape — chrome tightens)
and `max-height: 640px` (the floor itself — the header collapses to one
row via `.page-head`, the HUD primary becomes a compact inline strip, the
variant card goes single-line, and the settings kicker hides because the
highlighted variant chip below it already says the same thing).

**What was NOT sacrificed:** no control's font size shrinks below the
scale, no tap target goes under ~40px, and the H1 is explicitly excluded
from the 940px tightening — "the header banner is too small" was the
feedback that made it bigger, and clawing it back on the commonest screen
size would undo exactly that.

## Settings screen: capped, centred, and the rules launcher

**Cards capped at 820px and CENTRED.** Uncapped on a large monitor the
chips stretch into distorted bars — a settings form has a natural maximum
useful width. Centring rather than left-aligning is what stops the cap
simply moving the void to the right-hand side.

This is the third position this cap has been in, so the reasoning matters:
it was 820px left-aligned, then removed entirely (it was leaving a void),
now 820px centred. What makes centred work where left-aligned didn't is
that **the header block centres with it** (`body.settings-active` only) —
the "two different left edges" problem was never the cap, it was capping
the cards while the header stayed left. In PLAY everything remains
left-aligned and full-width.

**Capped card means capped padding — they are one decision.** `.card`'s
horizontal padding grows to `3vw`, sized for a card that can be 1600px
wide. Left at that inside an 820px card it ate ~77px of a fixed width and
squeezed the variant chips until "Addition & Subtraction" wrapped to a
second line, pushing the settings screen back into scrolling at 1280x800 —
a constraint set two passes earlier. If you ever cap a container's width,
cap its fluid padding in the same edit.

**Header rhythm** comes from the spacing scale: `--space-xs` under the h1,
`--space-sm` under the kicker, `--space-md` under the tagline (that last
gap separates two regions, not two lines of one block). The kicker is
`inline-flex` with `align-self: flex-start` — without the `align-self` a
flex child stretches, and the badge becomes a full-width bar.

### Persistent rules launcher

The inline "How does this game work?" link was reachable only from the
settings card, so a student who forgot a rule mid-round had to leave the
game. It is now `#rules-launcher`, a fixed bottom-LEFT button mirroring
`#stats-launcher` bottom-right — they share one rule set in
design-system.css, differing only in side and glyph.

**The rules text is MOVED into the modal, not copied.** Each game still
owns its own `#rules-box` wording exactly where it wrote it; the modal
takes that node on first open. One copy, nothing to keep in sync — the
test asserts `copies === 1`.

`#how-link` was deleted from all 19 files: the markup, its click handler
(which existed in three different syntactic forms across the files), and
its now-dead CSS. A page with no `#rules-box` (the hub, the sub-menus)
gets no button at all.

**Injected from `renderGlobalNav()`, not `DOMContentLoaded`** — same as
`renderStatsLauncher()`, and for the same reason: every page calls
`renderGlobalNav` inline, whereas `DOMContentLoaded` fires too late for
the jsdom harness to see the button (see the loader note in Testing
methodology).

## Control language: buttons vs text fields

**An outset pixel shadow is this project's "press me" signal.** A text
input wearing one reads as a broken button, which is exactly what happened.
Fields are ENGRAVED instead — `box-shadow: inset 3px 3px 0 rgba(0,0,0,0.08)`
on a recessed `--color-input-bg` ground (tokenised, with a dark-mode
value). No new colour was invented for it.

**Matching an input's height to a button's cannot be done with padding.**
An input carries a 2px border against a button's 4px AND a much larger font
(`--text-xl` vs `--text-md`), so equal padding gives unequal boxes and every
settings row's baseline goes ragged. `--control-h`
(`calc(8px + 2.5 * var(--text-md))` — the button's own geometry: 2x4px
border + 2x0.65em padding + 1.2 line-height) is applied as `min-height` to
both. Measured identical at 57.5px. Use this token for any future control
that has to sit in a row with a button.

`.icon-btn` is a small circular affordance (the target field's info
button) deliberately OUTSIDE the pixel-shadow language: it sits beside a
field and explains it, rather than being an action in its own right.

**Helper text moved into an info modal.** The grey "the number to land
closest to" beside a target input was clutter that also broke the row's
grid alignment by wrapping under the field. `initTargetInfo()` READS that
text off the label each game already wrote, removes the label, and wires an
info button to a modal — so no wording is duplicated into shared code and
Pop still says "without going over" while Scuttle says "land closest to".
Same move-don't-copy discipline as the rules modal.

**The kicker is a label, not a button** — flat, tinted
(`--color-beast-blue-bg`), 1px tertiary border, no shadow. It names the
variant and does nothing; the button language was miscommunication. The
tagline is `--text-lg` in primary ink: it states the objective, which is
the second most important thing on the page after the game's name.

### The recurring cost of header changes

Three passes running, a design change has added a few px of chrome and
landed in the 600-800px-tall band. Making the tagline a true subtitle cost
~14px of header (6px of type + an 8px margin-top) and pushed Beeline's play
screen 9px into scrolling at 1280x800.

**The fix is always the same shape: tighten the GAPS in the
`max-height: 940px` tier, never the type.** The cascade's ORDER is
preserved there (title-gap < kicker-gap < tagline-gap) so the hierarchy
still reads; only the absolute spacing gives. Re-run the viewport sweep
after any header change — a locally correct change is not automatically a
globally safe one.

**A process note worth keeping:** two edits in this pass used
string-replacements that silently matched nothing, so `--control-h` was
never defined — and `min-height: var(--undefined)` falls back to `auto`,
meaning the height-matching quietly did nothing while looking right in the
diff. It was only caught by reading COMPUTED values in a real browser.
Assert every scripted replacement, and verify a new token is both defined
and referenced before believing a measurement.

## Information hierarchy — three tiers, on every game's status area

Real design feedback: the status row gave the number that DEFINES the win
condition exactly the same weight as the bot-difficulty readout and the
Settings button — one flat row of identically-styled pills, nothing telling
you what to look at.

Three tiers, built at runtime by `initHud()` (`shared-game.js`), styled in
`design-system.css`'s HUD block:

1. **PRIMARY** (`.hud-primary`) — the ONE fact that defines *this* game's
   win condition. Big value, small caption, its own bordered block, warn-
   coloured, at the top of the left-hand reading column (inside `.play-side`
   where a two-column game has one, otherwise a band under the header).
   Never a pill.
2. **SECONDARY** (`.hud-secondary`) — round counter, bot difficulty,
   running score. Still pills, grouped, one clear step down.
3. **UTILITY** (`.hud-utility`) — Settings, Print, and the temporary Demo
   button. Deliberately stripped of the pixel-shadow button language:
   small, thin-bordered, muted, transparent. Giving chrome the same tactile
   weight as "Roll dice" is what put it in the gameplay sightline.

**`initHud()` never invents or recomputes game state.** It MIRRORS an
element the game already owns and already keeps up to date, and hides the
original — the same move/mirror-don't-rebuild discipline
`initSettingsChrome()` uses for the avatar picker, so every existing render
function and click handler keeps working untouched. A game nominates its
own primary with `data-hud-primary` + `data-hud-label` (+ optional
`data-hud-sub`, and `data-hud-value` on the inner node holding the number).
A `.target-pill` is adopted automatically, so the 7 Scuttle/Pop files
needed no markup change at all.

**What each family's primary actually is** — genuinely per-game, not one
shape repeated six times:

| Family | Primary | Source |
|---|---|---|
| Scuttle ×3 | Target N | existing `.target-pill` (automatic) |
| Pop ×4 | Target N | existing `.target-pill` (automatic) |
| Nim ×3 | the running total, captioned by the win rule ("Total / First to reach 10 or more wins") | `.nim-total-wrap` |
| Numbo | the round's target | the target `.section-label` |
| Beeline ×6 | **none, deliberately** | — |
| Detective | **none, deliberately** | — |

**Beeline and Detective deliberately have no tier 1, and this is a real
judgment call, not an omission.** Beeline's win condition is *spatial* —
four in a row — and the 36-cell claim grid that expresses it is already the
largest element on screen; a band reading "Connect 4" would be hierarchy
theatre, restating in small type what the board says at full size. Its
`#turn-status` was considered and rejected as the primary because that same
element doubles as the error channel ("That would just repeat a position
from earlier this game…"), so promoting it would render rule-violation
messages at 42px in a warn-coloured box. Detective is single-player with no
opponent and no target; its closest analogue, the six-guess dot track, is
already a dedicated visual sitting directly above the input. Both still get
tiers 2 and 3. If a future pass wants a tier-1 block everywhere for
consistency's sake, that's a real decision to make deliberately — don't
assume it was just missed here.

**Page alignment is left, one axis for the whole page.** The title / kicker
/ tagline block used to be centred directly above left-aligned cards, which
read as two different layouts stacked. Game pages are now left-aligned
throughout, sharing the cards' own left edge. Listing pages (the hub, family
sub-menus) keep centring via `body.page-centered` — added by
`markCenteredPage()` to pages that have a card grid and no `#top-bar` —
because there a title genuinely heads a symmetric grid.

**Also fixed here:** `body` was a flex container with `#app { margin: auto }`
— four-sided auto margins on a flex child, which vertically centred every
page shorter than the viewport and pushed the title ~190px below the nav
bar with nothing in between. Now `align-items: flex-start` plus
`margin: 0 auto`. Content is top-anchored on every page.

## Page sizing model — tablet floor, grow to fit

Real design feedback: **"Make minimum size a small iPad/tablet proportion.
If bigger, dynamically grow to fit the screen. Only if smaller than the
minimum allow a scroll bar."**

`--min-page-width: 768px` (a small iPad's portrait width) on `body`. At or
above it the layout fills whatever the window offers; below it the page
scrolls horizontally rather than reflowing further. **This is a deliberate
reversal of the project's earlier phone-first responsiveness** — these are
classroom tablet games, and the previous 375px/480px/560px collapse
breakpoints were being designed around for devices nobody plays them on.
The old collapse rules now apply to menu/listing pages only, which are
plain content that genuinely still reads fine narrow.

`index.html`'s `html, body { overflow-x: hidden }` had to become
`html { overflow-x: auto }` — the old rule would CLIP the horizontal scroll
this model deliberately offers. (The boot byline that originally needed it
is sized in `vw` and can't exceed the floor's width.)

Widths: `#app` is 1100px by default, **1440px for a two-column game**
(`.has-play-layout` — Scuttle's scorecard+play rail, and now Beeline, whose
six per-file `#app { max-width: 1100px }` overrides were deleted in favour
of that shared class). Both are ceilings, not fixed widths.

`@media (max-height: 820px)` tightens the chrome — an iPad in *landscape*
is only 768px tall, and the HUD's tier-1 block plus the header stack cost
enough height there to push a content-heavy game into vertical scroll. It
shrinks the primary, the H1 and the card padding, never the gameplay.

## Consistent play container — and why it isn't the dead box again

Real feedback, after the dead-box fix landed: **"Scuttle, try to keep the
right container a consistent height, rather than changing as the internal
content changes."** A card that resizes on every phase is its own
distraction, even when every size is honestly earned.

**These are two different claims, and both now hold:**
- The **container** is a stable frame whose height comes from the
  **viewport**, not from its contents, with its content vertically centred.
  `#app` is a flex column, `.play-layout` takes `flex: 1`, and
  `.play-main > .card` fills it. Single-card games (Nim, Pop, Numbo,
  Detective) get the same via `.play-frame`, tagged by `initPlayFrames()`.
- The **content** still does not reserve space for phases the player hasn't
  reached — that's the corrected `.phase-hidden` rule, unchanged.

The second is what stops the first from being the old bug wearing a new
name. The original dead box wasn't "a tall card" — it was *invisible
reserved blocks stacking up and stranding the roll button at the bottom of
them*. A stable frame with centred content reads as a deliberate empty
frame; the old one read as a mis-measurement. **If you ever find yourself
making the frame smaller to fix "too much empty space", check which of
these two you actually have** — the fix for a stranded control is centring
and un-reserving, not shrinking the frame.

Measured: Scuttle 654px empty and 654px populated at 1280×900 (0px drift),
554px at 1024×768, and it tracks the viewport (546px at 760px tall → 794px
at 1040px tall). `test/layout-density.playwright.js` asserts exactly this —
**its assertion was deliberately reversed** from the earlier
"empty must be much shorter" version; read its header before changing it
back.

## Beeline: separate containers, matching Scuttle

Real feedback: **"Beeline, match the layout style of scuttle. With separate
containers. For the numbers to select the product, make those larger."**

Beeline already had two side-by-side columns, but both lived inside one
bordered card, so it read as a single panel split down the middle rather
than Scuttle's two distinct containers. `initBoardLayout()`
(`shared-game.js`) promotes each column to its own `.card` and demotes the
wrapper to `.card-shell` (chrome stripped, ids/classes kept so
`showScreen()` and the tests are untouched). Six files, zero markup edits.

Done in JS rather than CSS because the CSS-only version needs `:has()` to
find the one card containing a `.game-layout`, and these run on older
classroom tablets.

**`.op-num` went from 34×40px/15px to 52×58px/24px** — it was the smallest
touch target in the project, on games built for fingers. It now clears the
~44px touch-target minimum comfortably, and `.token` grew 26px → 34px to
stay proportionate. The row still fits: 9 × 52px + 8 × 6px gaps = 516px
against the play column's 440px minimum plus card padding.

`#claim-grid` gained `max-width: min(100%, 57vh)`. Its cells are
`aspect-ratio: 1`, so height follows width — once the board column was free
to grow with the window (the old fixed `max-width: 500px` is gone), a wide
viewport made the grid taller than the room under the header and the page
picked up a stray scrollbar. Capping the width in `vh` is what bounds the
height, and it scales instead of being a number that only works at one size.

## Global nav: brand bar

The bar is **brand blue** (`--color-beast-blue`) carrying exactly two
things: the **BC logo** on the left (`design/BC_Logo_Whiteoutline.png`,
height-driven since the art is ~1:1.17) and the **Games dropdown on the
right**. Everything sitting on the blue is white.

**The current game's name was removed from it.** The bar sat directly above
that game's own H1 and kicker, so it was repeating what the page said one
line further down. What survives from that block is the
`CURRENT_PAGE_HREF` assignment, which is load-bearing — it is how the stats
panel knows which page it is on — so removing the label means removing the
label only.

The dropdown anchors `right: 0`, not `left: 0`: its trigger now sits at the
right end of the bar, so a left-anchored panel would hang off the viewport.

## PILOT MODE + the fluency views (reversible)

A hardcoded UI demonstration of `design/fluency-tracking-design-plan.md`'s
two-bucket model, run on two games so the views can be judged without the
rest of the catalogue in the way. **No gameplay data is collected, no
taxonomy is classified, nothing persists** — this validates the UI/UX
direction before the real tracking engine is built.

### Reversing it

`const PILOT_MODE = true;` in `shared-game.js`. **Set it to `false` and
everything comes back.** Nothing is deleted and no file is removed.

It works by transforming `GLOBAL_GAMES` ONCE, in `applyPilotLock()`, rather
than teaching each nav surface its own rule. There are FOUR surfaces — the
hub grid, the nav dropdown, the in-game variant switcher, and the
hand-written `*-menu.html` cards — and GLOBAL_GAMES is documented as the
single canonical list, which is exactly why one documented transform on it
beats four filters that could drift. The static sub-menu cards are the one
surface the transform can't reach, so `applyPilotLockToMenu()` converts
them at runtime.

**The tests derive their expectations from the flag** (`pilotModeOn()` /
`pilotUnlockedHrefs()` — accessors, because a top-level `const` isn't
readable off a loaded page). The full suite passes in BOTH states, verified
by round-tripping the flag. If flipping it back required editing tests, it
would not actually be reversible.

**Two bugs this surfaced, both fixed at the source:**
1. Locking families in the MIDDLE of the list left a still-playable Beeline
   under the "Coming soon" heading — `renderGameGrid` emitted section heads
   inline, assuming the list was ordered playable-first. It now partitions.
2. `applyPilotLock()` deletes `href` so nothing can link to a locked game —
   but `renderGlobalNav` identified the CURRENT PAGE by that same href, so a
   locked single-variant game opened directly showed a stats panel with
   nothing expanded. Being unlisted in the nav and being unable to identify
   yourself are different things: the original is kept as `lockedHref`, a
   key no renderer reads.

### The two views

Both hang off the existing `#stats-launcher` (the corner chart glyph),
which was already the stats entry point — extended, not replaced.

**FACTS (Product Beeline).** Finite and enumerable, so the lower tier is a
grid of every individual fact. Sized **9x9 from the game's own
`ROWMIN`/`ROWMAX`**, not a generic 10x10 — these are the facts that board
can actually produce. Cells are shaded by mastery in four bands using the
existing semantic tokens, because the colour IS the information; an
unshaded grid of numbers is just the raw table. **"Not practised yet" is
its own neutral state, deliberately not a low score** — no evidence and bad
evidence are different claims.

**PROCEDURES (Addition & Subtraction Scuttle).** Not enumerable, so the
lower tier is a taxonomy: Addition / Subtraction / Multi-step problems.
All three are listed for completeness, but only **Multi-step** carries a
visible "From this game" badge — this game combines three numbers with two
operators (see `design/game-rules-index.md`), so its evidence genuinely
says nothing about single-operation addition or subtraction, and the view
must not imply otherwise. The badge is on the row, not in a tooltip,
because that distinction is the single most important thing the view
communicates.

**The panel lists only the two skills this pilot demonstrates**
(`PILOT_SKILL_IDS`, reversed by the same flag). `visibleSkills()` is the
single source both the panel and the tests read, and `skillForHref()`
searches only those — otherwise a page could "expand" a row that was never
rendered.

**The highlight is CONTEXTUAL, and this was a real bug worth naming.** The
sub-skill originally carried `evidence: true`, a property of the DATA — so
the row was highlighted no matter how you reached the panel, which said
"this row is special" rather than "this is where your numbers from THIS
game went". It is now `evidenceFrom: [hrefs]`, and the highlight is derived
from the page you opened the panel from:

| Opened from | Expanded | Marked |
|---|---|---|
| the hub or a sub-menu | nothing | nothing |
| Product Beeline | Multiplication Facts | that skill row |
| Scuttle Add/Sub | Addition & Subtraction of Larger Numbers | that skill row + the Multi-step sub-row |

The **"From this game" badge was removed** — it stated a claim the data
could not back up once the highlight became conditional. The highlight
alone carries it now (a heavier left rule plus the tint), and the
explanatory note only renders when something actually is highlighted.

**Both headline scores are DERIVED, never stored beside the detail they
summarise** (`skillOverall()`): the facts headline is the mean of graded
cells, the procedures headline is the attempts-weighted mean of sub-skills.
A stored headline drifts the moment a cell is edited, and this view exists
to be edited and re-judged. Tests assert both relationships.

**Mock data is shaped, not sprinkled.** Two earlier drafts were rejected:
one averaged 78% with a single cell under 60 (too flat to show anything),
the next produced `1x5 = 69` (a learner who knows x1 knows all of x1). The
shipped table uses heteroscedastic noise — variance shrinks at the easy end
and widens at the hard end, which is how mastery actually distributes —
giving a visible weak cluster at 6-8 x 6-8 (mean 47.6) against 1/2/5 rows
at 80.3, and five never-attempted pairs.

## Bot AI philosophy — read this before writing any bot logic

- Bots must **always compute arithmetic correctly** regardless of difficulty.
  Only *strategy* should vary by difficulty tier — never let a "harder" bot
  also get the math wrong, and never let an "easier" bot be dumb about
  arithmetic (only dumb about decision-making).
- Tiering pattern: **Easy** = random valid choice. **Medium** = a simple,
  human-plausible heuristic. **Hard** = exhaustive search where the search
  space is small enough, or Monte Carlo simulation where it isn't.
- **A naive-seeming heuristic can be worse than random — always verify
  empirically.** We shipped a bug where Medium's "sort digits big-to-small,
  fill the bigger number first" heuristic was *worse than Easy's random play*
  for asymmetric Product Scuttle formats, because it starved the
  high-leverage single-digit multiplier. Caught it by simulating head-to-head
  win rates, not by inspecting the code. **Before shipping any bot tier,
  run a head-to-head simulation (shared-rolls, real win-condition logic) and
  confirm Hard never loses to Medium, and Medium beats Easy, across many
  trials.** See the pattern in the build history — a plain Node script,
  no browser needed, run before ever touching the HTML.
- **A "same shell as an existing game" mechanic swap can still break the
  bot's whole STRATEGY SHAPE, not just its move-scoring, if the new
  operation's value distribution relates to the target differently.**
  `scuttle-difference.html` reuses Product Scuttle's exact "split shared
  dice into two numbers, sum 3 rounds, smallest total still over a minimum
  wins" shell (per `design/game-catalog.csv`) — a straight copy of
  Product's own Hard bot (maximize non-final rounds outright, exact-optimize
  only the final round) initially seemed like the obvious port. Simulating
  it first (`test/scuttle-difference-bot-simulation.js`) caught a real bug
  before it ever shipped: for the 3-digit format (target 500), a SINGLE
  round's own max achievable difference can be ~999 — nearly double the
  target — so "maximize every non-final round" massively overshoots almost
  immediately, and Hard actually LOST to random Easy play (13.7% vs 86.3%
  in the first simulation run). Product's own thresholds never expose this,
  because a single round there can never reach the (much larger) target
  alone — real accumulation across all 3 rounds is required, so "maximize
  early, refine late" is close to correct for Product specifically, not a
  property of the shared shell in general. The fix: both Medium and Hard
  became TARGET-AWARE per round — pacing toward an even share of whatever
  target distance remains (`(target-runningSum)/roundsLeft`) rather than
  blindly maximizing — which automatically converges to "maximize" when a
  format genuinely needs full accumulation (the 2-digit/100 format, where
  per-round max is *below* the target) and to "stay small, aim precisely"
  when it doesn't (the 3-digit/500 format) — see that file's own header
  comment for the full before/after numbers. **Whenever a new variant
  reuses an existing engine's round-shape (not just its move-scoring),
  compare the new operation's realistic per-round value RANGE against the
  target before assuming the original bot's early-round strategy still
  makes sense — a threshold that's small relative to a single round's
  reach needs the opposite of a threshold that requires real accumulation.**
- **Turn-based/adversarial games (Beeline) need this same discipline, but
  the mechanics differ from Scuttle/Pop's shared-roll simulations:**
  Easy/Medium/Hard still mean random / simple heuristic / exhaustive-or-
  simulated search, but "search" here means depth-limited minimax with
  alpha-beta pruning (a Connect-4-style window-scoring heuristic at the
  cutoff), not Monte Carlo over future dice — see
  `test/beeline-product-bot-simulation.js`. Two things specifically don't
  carry over from the dice-game pattern: (1) a turn-based game has a real
  first-move advantage, so a head-to-head simulation must alternate which
  tier goes first across trials, or the result measures turn order more
  than skill; (2) tune search depth/trial-count against *actual measured
  wall-clock time* for a single live decision (tens of ms is fine, seconds
  is not), not just against total simulation runtime — a slow simulation
  is merely inconvenient, a slow live bot move is a real UX bug.
- **A genuinely SOLVED game (Nim) needs "Hard never loses" reinterpreted,
  not dropped.** Nim (base) is small enough that Hard isn't a heuristic or
  even a depth-limited search — `nimIsWinningPosition()`/`nimOptimalMove()`
  (in `shared-game.js` — originally a local `solve()` in `nim.html` itself,
  before a second Nim consumer existed to extract for, see below) are a
  full exhaustive minimax over the entire reachable state space, memoized
  once, an exact perfect-play oracle. That exposed a real gap in the
  turn-based guidance above:
  for TARGET=10/MOVES={1,2}, going first isn't just an advantage, it's a
  **proven forced win under optimal play** ((TARGET - total) mod 3 === 0 is
  a loss for whoever must move from it, and (10 - 0) mod 3 === 1 — an
  N-position — so the very first mover already holds a forced win before
  either side has moved). That means a weaker tier can occasionally beat
  Hard purely by guessing right on a handful of binary choices WHILE
  holding the forced-win seat — a property of this game's mathematics, not
  a bot-tiering flaw, and alternating first move (the existing Beeline
  fix) doesn't make it go away, it just means both sides get the lucky
  seat equally often. Verified this precisely rather than assuming it away:
  `test/nim-bot-simulation.js` first asserts, exactly (500/500, not
  statistically), that Hard moving FIRST never loses — the one claim that
  really is absolute here — then, separately, asserts Hard/Medium/Easy's
  OVERALL win rates (first move alternated) are strictly ordered by a wide
  empirical margin (~95% vs ~5%, ~67% vs ~33% — see that script's own
  header for the reasoning and thresholds), rather than requiring Hard's
  raw loss count to hit exactly zero. **Before assuming "never loses"
  applies literally to a new turn-based game, check whether the game is
  small enough to be fully solved, and if so, whether going first is
  merely an edge or a mathematically forced win** — the difference changes
  what "verified" even means for that matchup.
- **A second consumer of an already-solved game (Nim: Nickeled & Dimed)
  adds ONE new verification technique on top of everything above, not a
  replacement for it: cross-scale equivalence against the first,
  already-verified consumer.** Nickeled & Dimed re-runs every check
  `test/nim-bot-simulation.js` already established for base Nim (exact
  500/500 for Hard-moving-first, strictly-ordered overall win rates
  alternating first move — same thresholds, since it's the identical
  underlying combinatorics) in its own
  `test/nim-nickeled-and-dimed-bot-simulation.js`, using the real coin
  values (target 50, moves {5,10}, `reachOrExceed=false`) rather than a
  rescaled {1,2}/10 — see the "not a pure rescale" design note above for
  why. What's genuinely new: this script also asserts
  `nimIsWinningPosition(d, [1,2], true)` (base Nim) and
  `nimIsWinningPosition(5*d, [5,10], false)` (this variant) agree on every
  winning/losing classification for every reachable `d`, and that wherever
  the optimal move is even deterministic (a winning position — a losing
  position's move is an arbitrary, meaningless-once-you're-doomed random
  fallback, so asserting a specific value there would test randomness, not
  the solver), the coin move is exactly 5× the base move. This is a
  stronger check than either script's own tier-ordering assertions alone:
  it directly proves the SHARED extraction (`nimOptimalMove` etc. in
  `shared-game.js`) didn't quietly change the math for either consumer,
  which a same-scale-only simulation can't show by itself (it could pass
  even if both games had subtly-wrong-but-internally-consistent solvers).
  **Whenever a shared function gains a second real consumer at a different
  scale or parameterization, consider whether a direct cross-
  parameterization equivalence check — not just re-running the first
  consumer's own test a second time — is the strongest available proof
  that the extraction preserved the original behavior**, the same
  principle Testing methodology's point 9 already applies to syntax
  checking a `shared-game.js` consumer, just for a solver's *decisions*
  instead of its *parseability*. The standalone simulation script itself
  also deliberately breaks with every prior bot-simulation script's own
  convention of reimplementing the solver locally before "porting" it into
  the HTML — see that script's own header comment for why: the point here
  is verifying the ALREADY-SHARED implementation, so it loads the real
  `shared-game.js` into a small `vm` sandbox and calls the actual shipped
  functions directly, rather than risking a parallel reimplementation that
  could quietly drift from what's really shipped.
- **A third consumer of the shared Nim solver (Subtraction Nim) can flip
  which SEAT the "never loses" guarantee even applies to — verify the
  forced-win seat directly, don't assume it matches the earlier
  consumers'.** Base Nim (target 10, moves {1,2}) and Nickeled & Dimed
  (target 50, moves {5,10}) both happen to start from an N-position (their
  own distance-to-target mod (largest move + 1) is nonzero: `10 mod 3 ===
  1`, `50 mod 15 === 5`), so "Hard moving FIRST never loses" is their real,
  exact claim. `nim-subtraction.html` counts DOWN from a pile of 20 with
  moves `{1,2,3}` — `20 mod 4 === 0`, a genuine P-position, meaning the
  player TO MOVE from a fresh pile of 20 is under a forced LOSS with
  perfect play on both sides; going SECOND is what actually holds the
  forced win here, the opposite seat from both earlier consumers.
  `test/nim-subtraction-bot-simulation.js` checks this directly against the
  real solver (`nimIsWinningPosition(20, [1,2,3], false) === false`, not
  assumed from the mod-4 subtraction-game formula by hand) BEFORE writing
  any exact-record assertion, then asserts "Hard moving SECOND: 500/500"
  as the real exact claim, and separately (NOT asserted exact) confirms
  Hard moving FIRST still wins comfortably against imperfect opponents
  despite the disadvantaged seat — since a P-position's forced loss only
  holds against an opponent who also plays perfectly at every single
  branch, and Easy/Medium rarely do. **Whenever a shared combinatorial-game
  solver gains a new consumer, check which seat that consumer's own
  starting position actually favors — a solved game's "never loses" claim
  is a property of the specific starting distance and move set, not
  something later consumers can assume carries over from earlier ones just
  because they share the same solver.**
- **A genuinely SIMULTANEOUS game (Operations Numbo) gets the ORIGINAL,
  strictest bar back — no turn-order caveat needed at all.** Unlike Nim and
  Beeline, nobody moves first here: both sides see the same rolled digits
  and the same target, then independently build their own best expression
  — there's no seat to alternate, so none of the turn-based reasoning above
  (Nim's forced-win seat, Beeline's alternate-who-goes-first) applies.
  That puts it back under the *original* Scuttle/Pop-style bar this section
  opened with, and makes it an even STRONGER version of that bar: Hard
  isn't just empirically dominant, it's a full exhaustive search over the
  entire legal expression space (every ordering × every parenthesization ×
  every operator triple), so its result is the mathematically best
  achievable distance for that specific roll+target — it is not possible
  for anything to beat it, only tie it. `test/numbo-operations-bot-
  simulation.js` asserts this as an EXACT per-trial claim (zero tolerance
  for Hard ever being strictly beaten, across every trial, not a
  statistical threshold), the same rigor Nim's "Hard moving first never
  loses" claim used for the one thing that actually was exact there. The
  general lesson combining both entries: **whether a bot's "never loses"
  claim can be exact or must be statistical depends on the game's actual
  structure (solved + forced-win seat vs. simultaneous vs. genuinely
  adversarial-with-real-uncertainty) — decide this before writing the
  simulation, not by defaulting to whichever bar the last game used.**
- **An exhaustive search over an OPEN expression space (Operations Numbo)
  is a different shape of "Hard" than exhaustive search over a small FIXED
  state space (Nim) or a depth-limited game tree (Beeline).** Nim's
  `solve()` recurses over ~11 reachable totals; Beeline's minimax stops at
  a fixed depth with a heuristic cutoff. Numbo's Hard instead enumerates
  every *syntactically distinct expression* buildable from the rolled
  digits (permutations × parenthesizations × operator assignments) and
  evaluates each one — closer in spirit to Scuttle Product's "smallest sum
  over threshold" search than to either turn-based bot, but over a much
  richer combinatorial space (up to 7680 candidates per roll, still
  trivially fast — sub-millisecond). Confirm the search space's actual size
  before assuming "exhaustive" needs Monte Carlo instead (Bot AI
  philosophy's own general tiering pattern already says as much — "Hard =
  exhaustive search where the search space is small enough, or Monte Carlo
  simulation where it isn't" — this is a concrete instance of "small
  enough" that isn't obviously small at first glance).

## Code conventions

So any future game — or an audit script — can find "the bot logic" or "the
win logic" by name alone, without reading the whole file, these names are
fixed across every game:

- **`st`** — the game state object. Always this name, never `state`/`gameState`/etc.
- **`botChooseRound(...)`** — the bot's per-round decision entry point.
  Signature varies per game's needs (Add/Sub's is `(round, digits, n1,
  target, difficulty)`, Product's is `(round, digits, d1, d2, runningSum,
  target, difficulty)`), but the name and its role — the single place
  difficulty is dispatched on (`if (difficulty==='easy') ...`) — stay fixed.
- **`showScreen(name)`, `startMatch()`, `startRound()`** — screen/lifecycle
  functions. Always these names.
- **`DIFF_NAME`** — the difficulty display-name constant, keyed by
  `'easy'|'medium'|'hard'`; still shown in the top-bar pill. There used to
  be a matching `DIFF_DESC` (a description string per tier, shown under the
  difficulty chips) — removed project-wide, not just from one game: bot
  descriptions aren't user-facing. Don't reintroduce one without checking
  whether it's actually wanted; it was also the original trigger for the
  option-description-stability bug documented under "Layout stability".
- **`decideWinner(...)`** — win-condition logic lives in a standalone, pure
  function by this name. It takes whatever final values it needs as
  arguments (e.g. Add/Sub: `decideWinner(humanDist, botDist)`; Product:
  `decideWinner(humanSum, botSum, target)`) and returns `'human'`, `'bot'`,
  or `'tie'` — zero DOM access, zero side effects. It's called from the
  reveal button's click handler; the comparison logic doesn't live inside
  that handler. This is what makes Testing methodology point 4 below
  possible without a browser: a plain Node script can `new Function(...)`
  the extracted script and call `decideWinner` directly with edge-case
  inputs. **Exception: a single-player game (Detective) has no
  `decideWinner` at all** — there's no opponent to compare a result
  against, so don't invent one just to satisfy this convention. See the
  next point for what such a game's pure-logic test file is named instead.
- **`test/puzzle-logic.<game>.test.js`** — a single-player game's pure-logic
  unit test file, parallel in role to `decide-winner.<game>.test.js` but
  named honestly for what it actually covers when there's no `decideWinner`
  to test (Detective: `gcd`, `generatePuzzle`'s structural invariants across
  many trials per level, `colorDigits`'s known Wordle cases including
  duplicate-digit edge cases, `getRoundLevel`'s boundaries). Use this name
  for any future single-player game's equivalent file rather than either
  forcing the `decide-winner.*` name onto a file with no such function, or
  inventing a different one-off name per game.

For every new game, before considering it done:
1. `node --check` on the extracted `<script>` contents — catches syntax errors free.
2. A `jsdom`-based full-playthrough smoke test that actually clicks through
   the UI (roll dice, place digits, answer checks, reveal) and asserts the
   math shown matches what was computed — not just "it didn't throw."
3. For any bot logic: a standalone Node script simulating many matches to
   verify difficulty tiers are real (see above).
4. Test the *edge cases* of win-condition logic explicitly (e.g. both-over,
   both-under, one-over-one-under, exact ties) — these are where copy-pasted
   assumptions from a previous game's different win condition tend to hide.
   Do this as a standalone unit test directly against `decideWinner` (see
   Code conventions above) — no browser or jsdom needed, since it's pure.
5. Layout stability (see the section above): drive the same jsdom
   playthrough through every within-round phase and assert none of the
   phase-content elements ever pick up `.hidden` — only `.phase-hidden`
   should toggle on them, for the whole round. jsdom has no real layout
   engine (`getBoundingClientRect` is always zero), so this can't measure
   actual pixel height; asserting `.hidden` never appears is the correct
   proxy, since CSS guarantees `visibility:hidden` preserves an element's
   box — "never removed from flow" *is* "height never changes." Pair it
   with a static check that `design-system.css` still maps `.hidden` to
   `display:none` and `.phase-hidden` to `visibility:hidden`, so a future
   CSS edit can't quietly break the guarantee the dynamic check relies on.
   See `test/layout-stability.test.js` for the pattern.
6. Celebration animations (see the section above) turn the reveal into an
   async, multi-hundred-millisecond sequence instead of an instant DOM
   write — a smoke test that reads `#human-total`/`#winner-banner` in the
   same tick as the reveal click is now testing the *pre-animation* state,
   not the outcome. Snapshot those elements once right after the click and
   assert they're still mid-flight (banner cleared, total unchanged from
   its pre-reveal value, and — for a claim-grid game — no winning cell has
   `.win` yet) — this is what actually proves the effect is animated rather
   than silently short-circuited to instant — then `await sleep(...)` past
   every effect's worst case (longest possible banner string × 45ms + the
   400ms flash buffer; the fixed 650ms count-up; a winning-line reveal's
   4-cell stagger + pause + flash; 2000ms clears all of these with room to
   spare) before asserting final values, including that a winning-line
   reveal actually landed on `win settled` (not still `flash`, and not
   bare `win`). See `smoke-addition-subtraction.test.js` /
   `smoke-product.test.js` / `smoke-beeline-product.test.js` for the
   pattern.
7. For any game with the avatar picker (see "Avatars" above): assert the
   picker's `.selected` slot, `st.avatar`, and every badge's `src` all agree
   *before* touching anything (catches the picker and badges silently
   defaulting out of sync), then click a different avatar slot and a
   different difficulty chip in the same test and re-assert — the avatar
   pick should move only the "you" badges (top bar + scoreboard header) and
   difficulty should move only the bot badges, independent of each other.
   `test/jsdom-helpers.js`'s `snapshotAvatarState()` returns exactly these
   fields so this doesn't need reimplementing per game; see
   `smoke-addition-subtraction.test.js` / `smoke-product.test.js` for the
   pattern.
8b. **Empty-state density.** A test that only asserts "height doesn't
   change during a phase" will happily pass a card that reserves its entire
   eventual content from first paint — that is exactly how the dead-box
   regression shipped, with a green test file actively locking it in. Every
   game with a multi-phase play card needs the *other* assertion too: its
   pre-action container must occupy **meaningfully fewer layout boxes** than
   its populated one. `test/layout-stability.test.js` does this in jsdom by
   counting blocks actually in flow (a block inside a `display:none` subtree
   contributes no height; a `visibility:hidden` one contributes its whole
   box), which is a real structural statement about height rather than a
   restatement of the class names. Measured: Scuttle 1 box empty vs 4
   populated, Nim 0 vs 1. The real pixel numbers need a browser and live in
   `test/layout-density.playwright.js` (run by hand, per point 8):
   Scuttle's round card 139px empty → 320px populated (was ~320px empty),
   Nim's 199px → 354px.
8. For an actual pixel-layout claim (a box stays the same height, nothing
   moves), jsdom isn't enough on its own — it has no layout engine, so
   structural proxies (point 5's ".hidden never appears") are the strongest
   thing it can prove, and are the right default for most such claims. When
   the claim is specifically about a *size computed from real content*
   (e.g. `.desc-line-stack` sizing to the tallest of several strings — see
   "Layout stability"), verify it for real: install Playwright
   (`npm install playwright && npx playwright install chromium --with-deps`
   — not a project dependency, just a throwaway local check), serve the
   file (`python3 -m http.server` is enough for these dependency-free
   static pages), launch headless Chromium, click through every option, and
   read real `boundingBox()` coordinates before/after — not jsdom's. This
   is what actually confirmed `.desc-line-stack`'s fix: identical pixel Y
   for every element below the box across every format option, on both the
   shortest and longest real description strings in the project.
9. A game linking `shared-game.js` needs two extra things beyond points 1-2
   above. First, `node --check` on the extracted `<script>` alone no longer
   proves the page parses — concatenate `shared-game.js` and the inline
   script in the same order a browser would load them (`<script src>` tag,
   then the inline `<script>` tag) and check *that* combined file, or a
   syntax error only `shared-game.js` introduces (like a stray closing
   script tag — see Known traps) won't surface. Second, both jsdom loaders
   (`test/jsdom-helpers.js`'s `loadGame()`, `test/vm-load-page.js`'s
   `loadPage()`) inline any local `<script src="....js"></script>` tag's
   file content into the page before running it — plain `runScripts:
   'dangerously'` executes inline scripts but does not fetch external
   ones without `resources: "usable"` (deliberately not set — see those
   files), so a real `<script src>` tag would otherwise silently never
   run, leaving every shared function undefined the instant a test tries
   to call it. If you add a game that links `shared-game.js`, its smoke
   test gets this for free through the existing loaders; nothing new to
   write for that part. For a format/difficulty-driven game (chip-selected
   variants, not just one fixed setup), sweep every real combination
   `shared-game.js`'s functions get called with, not just one — see
   `smoke-product.test.js`'s 4-format × 3-difficulty loop, which is what
   actually exercises `updateScorecard()`'s formatter parameter and
   different `st.slotsN1`/`st.slotsN2` shapes through the same shared code.
10. Drag interactions (see that section) split across two tiers, for two
    different questions. **jsdom, driven with real dispatched
    `PointerEvent`s through the actual `makeDraggable()`/`onMove`/`onDrop`
    code** (not a direct call into the underlying state function, which
    would only prove the state transition is correct, not that dragging
    actually reaches it) — for "does a real drag resolve to the right
    state change and the right downstream math/UI." jsdom has no
    `elementsFromPoint` and no real layout, so meaningful hit-testing
    needs the geometry stubbed (per-element or, if the element gets
    recreated on re-render, at `Element.prototype` — see Known traps) —
    the point isn't to test jsdom's geometry, it's to run the real
    production resolution logic against *controlled* geometry instead of
    *absent* geometry. Assert the FULL sequence a real drag goes through,
    not just the end state: mid-drag, the visual follow-transform is
    non-empty and no state has changed yet (no premature commit); right
    after drop, an animation-gated state change (Beeline's delayed
    `pendingMove`) genuinely hasn't landed yet; only after waiting out
    the animation duration does it land, and only THEN does the
    downstream UI/math reflect it. **A real headless browser** (Playwright
    — see point 8's pattern) — for "does the actual container stay the
    height it's supposed to," since that's a real-layout claim jsdom
    fundamentally can't make. Use `page.mouse.down()`/`.move()`/`.up()`
    for a real drag gesture (real hit-testing, no stubbing needed at
    all), and compare a `getBoundingClientRect()`-based measurement
    before/during(mid-drag)/immediately-after — not before/after some
    much later point, since an intentional phase transition past the drag
    itself (e.g. the answer-check UI appearing once a Beeline drag
    resolves) is EXPECTED to change the height and isn't part of this
    claim; isolate the specific element whose reserved space is actually
    being tested (e.g. `#operand-row`'s own margin-box) from the rest of
    the screen's other, unrelated toggles if the screen has any — see
    Known traps for one this surfaced. Also worth checking in the real
    browser while already there: `prefers-reduced-motion` (Playwright's
    `reducedMotion: 'reduce'` context option) actually skips the
    animation and lands on final state with no lingering
    `transition`/`transform`, not just "looks unanimated" — remember a
    `setTimeout(fn, 0)` still needs the event loop to turn at least once
    (`page.waitForTimeout` a few ms) before checking its effect landed,
    same as any other deferred callback.
11. A game whose answer-check has more than one FAILURE KIND (Operations
    Numbo: a structural problem — bad syntax, wrong digits, divide-by-zero
    — versus a value mismatch on an otherwise-valid expression) needs each
    kind probed separately, not lumped into one generic "wrong answer"
    check. Specifically assert the structural case does NOT increment
    `wrongAttempts` or touch the hint mechanic (it has its own specific,
    self-explanatory message instead — see CLAUDE.md's Numbo design note),
    then separately drive the value-mismatch case through 2 wrong attempts
    and confirm the hint appears only there. A test that only ever submits
    one flavor of "wrong" can't catch a mismatched failure kind touching
    the wrong counter. Also worth doing for this kind of game: a
    DETERMINISTIC probe of a rare-but-real outcome (Numbo's tie-scores-both
    rule) by having the human submit — via the in-page pure functions
    directly, not by hoping for a lucky random roll — the bot's own exact
    optimal expression for that round (`exprString(botHard(digits,
    target).tree)`), guaranteeing an identical value and therefore an
    exact tie every run, the same spirit as Beeline's seeded-cell probe for
    its wasted-turn rule.
12. Pure logic beyond `decideWinner` is worth unit-testing the same way,
    through the same `vm-load-page.js` harness — Operations Numbo's
    expression parser/validator (`tryParseAndValidate`) has no DOM
    dependency at all, so `test/decide-winner.numbo-operations.test.js`
    exercises it directly with a table of inputs (precedence, duplicate
    digits, concatenation, wrong digit count, divide-by-zero, syntax
    errors) far more thoroughly and far faster than driving each case
    through a real jsdom click would allow. The file is still named
    `decide-winner.*` per the existing convention even though it now
    covers more than just `decideWinner` — matching the established
    per-game unit-test file, not introducing a new naming scheme for one
    game's extra pure helpers.
13. A game whose core generator is RANDOMIZED (Detective's `generatePuzzle`
    — rejection sampling, preserved exactly, see CLAUDE.md's design note)
    can't be unit-tested with fixed expected outputs the way `decideWinner`
    is — assert STRUCTURAL INVARIANTS across many trials per configuration
    instead (every generated puzzle stays in range, respects its level's
    `mustSimplified`/`factorsOnly`/`improper` constraints, is actually a
    valid equation) — see `test/puzzle-logic.detective-fraction-
    equivalence.test.js`'s per-level loop. Separately, a jsdom smoke test
    that needs to probe a SPECIFIC rare-but-real rule (a valid-but-wrong
    guess that must differ from an earlier wrong guess to avoid tripping a
    duplicate-guess check instead of registering as a genuine second miss;
    an exact flipped-equation win) is much simpler against a hand-picked,
    deterministic puzzle injected directly into `st.puzzle` via `runInPage`
    than against whatever the random generator happens to produce that
    run — same spirit as point 11's deterministic tie probe, applied here
    to sidestep constructing a valid alternate answer for an arbitrary
    random target on the fly.

## Known traps from this project's history

- **Don't assume mechanics carry over between games.** Addition/Subtraction
  Scuttle uses "closest to target" but Product Scuttle actually uses the base
  game's real rule: smallest sum still over a threshold (largest if nobody
  clears it). This was only caught by reading the actual source doc rules,
  not by pattern-matching the previous game. Always read a game's real rules
  doc before designing its engine.
- **Read the actual Teacher Instructions doc, not just filenames.** Beeline's
  game-board filenames suggested a race-track game; the real rules doc showed
  it's actually a Connect-4-style claiming game. Misjudging this from
  metadata alone would have produced the wrong UI entirely.
- **Leading zeros:** any digit-arrangement game needs a "can't start with 0
  unless forced" rule (check the whole shared digit pool, not just the
  current number, since digits are often split across two numbers).
- **A catalog's mechanic summary can be identical across variants that
  are NOT actually identical.** `pop-subtraction.html` shipped (and got
  committed) with only one bust cause — going over the target — because
  that's the only cause Addition Pop has, and the catalog's one-line
  summary ("different expression template") gave no reason to suspect
  Subtraction Pop's bust rule was different in kind, not just in formula.
  The real Teacher Instructions doc says a *negative* difference busts
  the balloon too, exactly like going over does — caught only when the
  full doc for every Pop variant was fetched at once and read end to end,
  not by pattern-matching "same engine family" from the catalog. Fixed:
  `isBusted()` now checks both directions, and Medium/Hard's risk
  projections check both bounds, not just the upper one — see
  `test/pop-subtraction-bot-simulation.js`. **When a family's variants
  share an engine, still read each variant's own rules text for its win
  condition specifically — "same expression-building mechanic" does not
  imply "same bust condition."**
- **A rules doc describes mechanics, not a physical board's exact spatial
  layout.** Product Beeline's 36-cell grid arrangement in `beeline-
  product.html` (which value sits in which cell) is a placeholder I
  generated with a fixed deterministic shuffle, not a transcription of the
  real printed board — the rules doc has no reason to spell out cell
  positions. Fine for a first build, but swap it for the real board's
  layout if it's ever provided, since the exact arrangement does affect
  which lines are actually easy/hard to complete.
- **`check-css-classes.js` can't see a class assigned via a helper
  function's return value** (e.g. `el.className = someFn(i)` where `someFn`
  builds up the string internally) — it only traces literals inside the
  same statement as the `.className =`/`.classList.` call itself. Seen in
  `beeline-product.html`'s `cellClassesFor()`: `.claim-cell`, `.pending`,
  and `.win` all get flagged as "unreferenced" even though they're
  genuinely applied every render. (`.pending` has since been removed
  outright — it outlined the cell holding the correct answer while the
  answer-check was open; see "Answer-explanation modal & stats-demo
  experiment" — so only `.claim-cell`/`.win` still hit this.) Eyeball flagged classes against the
  actual JS before assuming they're dead, especially in files with this
  build-a-className-in-a-helper pattern. **Same blind spot, new shape:**
  `shared-game.js`'s `makeDraggable()` toggles its drag-state class via a
  *parameter* (`dragClass = 'dragging'`), so the literal string `'dragging'`
  never appears in any of the three games that actually use it — all three
  get flagged as never referencing `.dragging`, despite it genuinely being
  applied (confirmed live in a real browser — see "Drag interactions").
  Same rule applies: eyeball it, don't trust the flag alone. **Third
  instance, same root cause:** `nim.html`'s `renderTrack()` builds
  `.nim-cell`/`.target`/`.current` via `let cls = 'nim-cell'; cls += ' ' +
  ...; cell.className = cls;` — all three get flagged as unreferenced
  despite being applied every render (confirmed by the smoke test's own
  track rendering and manual inspection). This pattern (build a class
  string up across several statements, assign it once at the end) keeps
  recurring across unrelated files, so treat "flagged + built via a local
  variable, not a literal at the assignment site" as the default
  explanation to check first, not a surprise each time. **Fourth instance:**
  `detective-fraction-equivalence.html` builds `.dbox`'s Wordle-color
  classes (`.correct`/`.wrong-pos`/`.absent`/`.inv`), `.g-dot`'s state
  (`.used`/`.won`/`.lost`/`.danger`), and `#msg`'s severity
  (`.error`/`.success`/`.warning`) all via template-string interpolation of
  a variable, never a literal — every one of these gets flagged despite
  being genuinely applied throughout real play (confirmed by the smoke
  test's own wrong-guess/hint/win probes). Same rule, fourth file: eyeball
  it, don't trust the flag alone. **Fifth instance:**
  `nim-nickeled-and-dimed.html`'s own `renderTrack()` is a direct,
  deliberate copy of `nim.html`'s (same shared `nim-track.css` classes,
  same string-building shape, just stepping by 5s instead of 1s) — so it
  hits the identical `.nim-cell`/`.target`/`.current` false-positive for
  the identical reason. Expected, not a new bug; noted only so a future
  reader doesn't waste time re-diagnosing a pattern this doc already names
  four times over. **Sixth instance:** `beeline-product.html`'s
  `renderTokens()` builds each token's fixed per-token identity class via
  `'token token-' + idx + ' ' + (...)` (see "Post-playtest navigation & UX
  fixes"'s Beeline section) — `.token-0`/`.token-1` get flagged as
  unreferenced despite being genuinely applied every render (confirmed
  live in a real browser, and by the smoke test's own drag probes). Same
  rule, sixth file. **Seventh instance:** `nim-subtraction.html`'s own
  `renderTrack()` is the same direct copy as `nim-nickeled-and-dimed.html`'s
  (see the fifth instance above) — same `nim-track.css` classes, same
  string-building shape, just stepping by 1s across 21 cells (0-20) instead
  of by 5s. Hits the identical `.nim-cell`/`.target` false-positive for the
  identical reason (confirmed by this file's own smoke test and manual
  inspection); expected, not a new bug. **Eighth instance:** every one of
  the 5 new two-row Beeline variants builds `.claim-cell` (in
  `cellClassesFor()`; `.pending` used to be built here too, until it was
  removed as an answer giveaway) and `.token-0`/`.token-1` (in `renderOneRow()`) the
  same way `beeline-product.html` always has — string concatenation, not a
  literal at the assignment site — so all three get flagged as
  unreferenced in all 5 files, for the same reason as the sixth instance
  above (and, on inspection, in `beeline-product.html` itself, which was
  never called out as its own numbered instance before now despite hitting
  the identical pattern). Expected, not a new bug.
- **An `animation:` referencing an undefined `@keyframes` name fails
  completely silently** — no console error, no warning, in any browser.
  `scuttle-menu.html`'s big boot-logo reveal (`animation: logoIn ...`) has
  had no matching `@keyframes logoIn` since the initial commit, so that
  entire dramatic reveal has never once been visible, this whole time —
  only caught by screenshotting the actual boot sequence while doing an
  unrelated rebrand of its text. Any new `animation:` name needs its
  `@keyframes` grep'd for, or actually watched render, since nothing will
  ever flag a typo here.
- **The literal text of an HTML closing script tag ends that script
  element immediately, even inside a JS comment or string.** The HTML
  parser's raw-text rules for `<script>` don't know or care that they're
  inside a JS comment — the instant they see that exact byte sequence
  anywhere in the content, the element ends right there, and everything
  after it either becomes a syntax error in a truncated fragment or, worse,
  gets parsed as ordinary HTML. `shared-game.js`'s own header comment
  originally *named* the tag it teaches games to use, literally, to explain
  the file's own loading convention — which meant every page that linked
  it failed to parse. Caught immediately by the jsdom smoke tests (a
  `SyntaxError` pointing at the comment text itself), not by `node --check`
  on the extracted script (which never sees the surrounding HTML, so it
  can't reproduce this). Never write that literal sequence anywhere in a
  file a browser will parse as HTML, including deep inside a comment or
  string — describe it in prose instead ("a closing script tag").
- **jsdom implements `PointerEvent` and `getBoundingClientRect()` (always
  returning all-zero), but NOT `document.elementsFromPoint()` or
  `el.setPointerCapture()` at all** — calling either throws
  `TypeError: ... is not a function`. `makeDraggable()` in `shared-game.js`
  guards its own `setPointerCapture` call (`typeof el.setPointerCapture
  === 'function'`) specifically so jsdom smoke tests can dispatch real
  `PointerEvent`s without that throwing — every real target browser has
  it, the guard is purely for this. `elementsFromPoint` isn't guarded in
  production code (Scuttle's drop-target hit-testing genuinely needs real
  hit-testing, which no guard can substitute for) — a test that needs it
  must stub it itself (`document.elementsFromPoint = () => [...]`,
  injected once via `runInPage`, persists for that jsdom window's whole
  lifetime). Since real layout doesn't exist in jsdom either
  (`getBoundingClientRect` always zero), a test asserting a SPECIFIC drop
  target or snap position (not just "some drag handler ran") additionally
  needs `Element.prototype.getBoundingClientRect` overridden with fake but
  *consistent* per-element geometry — done at the prototype level, not
  per-node, so it survives a re-render that tears down and rebuilds the
  actual DOM nodes (which `#operand-row`/`.eq-tile` both do on every
  change). See `smoke-addition-subtraction.test.js` and
  `smoke-beeline-product.test.js` for the pattern; real per-pixel layout
  claims (does a container's height actually stay put) still need a real
  browser regardless — see Testing methodology.
- **A state-mutating callback called synchronously right after starting a
  CSS animation can tear the animating element out of the DOM before a
  single frame of it ever paints.** Beeline's token-drag `onDrop` handler
  originally called `enterAwaitingAnswer()` (which `render()`s, and
  `renderOperandRow()` does `innerHTML = ''` on every call) immediately
  after starting the snap-into-place transition on the SAME element that
  render was about to destroy and recreate — the transition was started,
  then the element was deleted before the browser painted even one frame
  of it, so the "animation" was never actually visible, exactly the kind
  of bug the FLIP/Celebration-animations testing already guards against
  elsewhere (see Testing methodology) but this one slipped through
  initial manual testing since jsdom can't render frames to notice it
  either. Fixed by delaying the state change with `setTimeout(fn,
  TOKEN_SNAP_MS)` (0 under `prefers-reduced-motion`) so the animation gets
  to actually run before anything tears its element down. **Whenever a
  CSS transition/animation on an element is immediately followed by code
  that might re-render (and thus destroy) that same element, the
  re-render needs to wait for the animation, not race it** — the same
  principle Celebration animations' `typewriterReveal()`/`countUp()`
  already follow by construction (their `setInterval`/`setTimeout` chains
  own the whole sequence), just easier to violate by accident with a
  one-shot CSS transition plus a separate, differently-timed state change.
- **A `phase === 'idle'` poll for "has the bot finished its turn" is not
  the same as "is it the human's turn again"** — Beeline's `checkAnswer()`
  sets `st.phase = 'idle'` SYNCHRONOUSLY the instant a human move is
  confirmed, immediately followed by `st.turn = 'bot'`; the bot's own
  `botTurn()` only actually runs ~550ms later via `setTimeout`. A test
  polling on `phase === 'idle'` alone stops in that in-between window,
  before the bot has done anything — harmless if what follows doesn't
  depend on whose turn it actually is (the original wasted-turn-probe
  wait immediately called `startRound()`, which resets everything
  regardless), but a real bug once something later assumed a draggable
  human token would exist (`.token.active` came back `null`, a
  `TypeError` deep in a dispatched-event's stack). Poll `phase === 'idle'
  && turn === 'human'` together for "control has actually returned to the
  human," not phase alone — see `smoke-beeline-product.test.js`.
- **`test/vm-load-page.js`'s sandbox exposes top-level `function`
  declarations but NOT top-level `const`/`let` bindings.** A classic script
  run via Node's `vm` module attaches sloppy-mode function declarations to
  the context's global object, but `const TARGET = 10;` creates a lexical
  binding that isn't an own property of that object — so
  `loadPage('nim.html').TARGET` comes back `undefined` even though
  `nim.html`'s own inline script can obviously see and use `TARGET` just
  fine internally. Caught immediately by `decide-winner.nim.test.js`
  trying to pull `TARGET` off the loaded page to sanity-check it against
  the hardcoded `10` used in its own test cases. Fix: don't try to read a
  `const`/`let` off a `loadPage()` result — mirror the value as a local
  constant in the test instead (with a comment explaining why), the way
  that test now does. `function`-declared things (`decideWinner`, etc.)
  are unaffected and work exactly as every other `decide-winner.*.test.js`
  already relies on.
- **A jsdom smoke test's "assert the reveal banner is still empty right
  after gameOver flips" pattern (used by every prior game with a
  typewriter reveal) silently assumes the WINNING move is always the
  human's, made synchronously inside a `runInPage()` call.** That's true
  for Beeline's own smoke test (its playthrough always has the human play
  the decisive move against a weaker bot), so `bannerText === ''` is a
  safe exact assertion there. It is NOT true for Nim: because going first
  is such a strong advantage in this exact game (see Bot AI philosophy),
  the BOT sometimes makes the decisive move — reached through `botTurn()`'s
  own two chained ~550ms `setTimeout`s, not a synchronous click — so a
  test loop's own `sleep(700)` between polls can land 100-150ms into the
  typewriter interval by the time it notices `gameOver`, and a strict
  `=== ''` check flakes (observed directly: `'Bot wi' !== ''`, roughly 1 in
  6-10 runs, matching how often the bot's move ends up deciding the game).
  Fixed in `smoke-nim.test.js` by asserting the mid-flight banner text is
  *shorter than the eventual final text* instead of asserting it's empty —
  proves the same thing (animated, not instant) without depending on which
  side made the winning move or exactly how many polling cycles elapsed
  before it was noticed. **Before copying the exactly-empty-banner pattern
  into a new game, check whether that game's playthrough loop can let
  either side make the decisive move** — if so, use the
  shorter-than-final comparison instead. (Applied proactively in
  `smoke-numbo-operations.test.js` too, for the same reason — a tie round
  is common enough there that either side, or both, can be "the" scoring
  move.)
- **A "generous margin" sleep copied from a sibling game's smoke test isn't
  actually generous once the reveal text itself is longer, or the
  assertion checks a substring near the END of that text.** `smoke-
  nim.test.js` sleeps 1500ms after `gameOver` before reading the final
  typewriter-revealed banner, safe there because base Nim's banner strings
  are short (~34 chars, ~1530ms of typing) AND its own assertion
  (`/win/i`) matches text within the first ~8 characters — so even a
  banner caught mid-typewriter almost always already contains "win."
  `smoke-nim-nickeled-and-dimed.test.js` initially copied that same
  1500ms sleep and failed: this variant's real banner strings are longer
  ("You win! You brought the pile to exactly 50¢." / "Bot wins. Bot
  brought the pile to exactly 50¢." — 45-46 chars, ~2025-2070ms of typing
  alone, +400ms flash buffer), AND the assertion that actually matters
  here (`/exactly 50/i`, confirming the EXACT-match win condition's own
  wording) sits near the END of the string, not the beginning — so a
  banner caught at 1500ms had only typed `"You win! You brought the pile
  to"`, missing "exactly 50" entirely, and the assertion failed on real,
  correct game behavior, not a bug. Fixed by computing the actual worst-
  case duration for THIS game's real strings (not reusing a sibling's
  already-derived number) and using a 3000ms sleep instead. **Whenever a
  smoke test copies a "safe" sleep duration from a sibling game, re-derive
  it for the new game's own actual banner text length and check WHERE in
  that text the assertion's match target sits** — a shorter sleep can
  silently work by luck if the checked substring happens to appear early,
  and stop working the moment either the string gets longer or the
  assertion moves later in it.
- **Floating-point division makes "closest to target" and "is this an
  exact hit" genuinely different questions from every prior game, which
  only ever dealt in whole numbers.** `8 / (3 - 8/3)` — the classic "24
  game" answer for digits 3,3,8,8 — evaluates in JS to
  `23.99999999999999`, not exactly `24`. Every prior game's arithmetic
  (addition, subtraction, multiplication of integers) never produced this
  problem; Operations Numbo's division does, unavoidably, as soon as any
  bot or human expression divides. Two DIFFERENT tolerances are needed, and
  conflating them is the actual trap: `EPS = 1e-9` for comparing two of the
  engine's own exactly-computed values against each other (detecting a
  genuine tie between human/bot distances, or confirming the solver found
  an exact hit) — float noise only, no forgiveness intended; `HUMAN_TOLERANCE
  = 0.01` for accepting a human's *typed* claimed value against the true
  computed one — deliberately loose, since a student reasonably rounds
  `7/3` to `2.33` rather than typing ten more digits. Using the tight
  epsilon for the human check would reject correct-but-rounded answers;
  using the loose one for internal tie detection would call two genuinely
  different values "the same." See CLAUDE.md's Numbo design note and
  `test/numbo-operations-bot-simulation.js`'s own classic-24 spot check
  (asserted against `EPS`, not `===`) for where this was caught before it
  ever reached a real playthrough.
- **At least two smoke tests have a rare, pre-existing intermittent flake,
  unrelated to this project's other work** — `test/smoke-product.test.js`
  and `test/smoke-pop-subtraction.test.js` (confirmed: both reproduce
  identically with the Global-navigation changes fully reverted from their
  respective game files, so neither is a regression from that task).
  Roughly 1-in-15-to-20 runs each, at a DIFFERENT point each time (a
  different one of `smoke-product.test.js`'s 12 format×difficulty
  combinations; a different roll sequence for `smoke-pop-subtraction.test.js`),
  something throws or an assertion fails in a way consistent with a timing
  or state race rather than a deterministic logic bug: `TypeError: Cannot
  read properties of null (reading 'length')` deep in a `runInPage`
  callback, a displayed human total not matching `st.finalHumanSum`
  (consistent with catching the count-up animation mid-flight rather than
  settled), or (Pop-subtraction) "all of the human blanks should be filled
  after totalBlanks rolls" reading false. Both affected tests loop over
  MANY sub-cases, each opening its own full jsdom window via `loadGame()`
  that's never explicitly closed — a plausible shared contributing factor
  (accumulated live timers/windows across iterations competing for
  scheduling) but NOT verified as the actual root cause; flagging this
  rather than shipping an unverified fix, and rather than guessing whether
  the two files' flakes even share one root cause. Not investigated
  further here since it's orthogonal to whatever task surfaced it — worth
  a real look (start by adding `dom.window.close()` after each iteration
  in both files and stress-running dozens of times to see if the rate
  actually drops) the next time either file is touched for any reason.
  **Re-encountered during the dynamic-sizing/emoji-removal pass:** a full
  `npm test` run hit `smoke-product.test.js` with the exact same
  `TypeError: Cannot read properties of null (reading 'length')` signature
  documented above. Re-ran that file alone twice more immediately after —
  both passed cleanly — confirming it's this same pre-existing flake, not
  a regression from that session's changes (which never touched Scuttle
  Product's own game file). No fix attempted, per the same reasoning as
  above; noted here only as a second confirmed sighting.
  **A THIRD FILE now shows the identical signature:**
  `test/smoke-scuttle-difference.test.js` failed one full-suite run with
  the same `TypeError: Cannot read properties of null (reading 'length')`
  inside a `runInPage` callback, then passed 5/5 in isolation immediately
  after. It has exactly the shape the other two share — a loop over
  format x difficulty combinations, each opening its own `loadGame()`
  window that is never closed — which is the common factor across all
  three affected files and remains the best available explanation. Treat
  "a looping smoke test threw a null-length TypeError once" as this flake
  until proven otherwise, and confirm by re-running that file ALONE before
  investigating further.

    **Third sighting, and the first with an identified TRIGGER — worth
  remembering before diagnosing this file again:** running a Playwright
  check (`test/layout-density.playwright.js`) concurrently with `npm test`
  reliably produced a DIFFERENT failure in `smoke-product.test.js` —
  `once the reveal finishes, every cell should hold a real partial product
  (1 !== 2)`, the area-model explanation's settled state. That probe waits
  a fixed 10s for a ~7s animation, so a machine saturated by a headless
  browser can miss the last frame. It looked exactly like a regression
  from the same session's CSS work. Resolved by evidence, not assumption:
  **6 of 6 isolated runs passed**, while both failures happened only under
  concurrent load. **Never run the jsdom suite and a headless-browser
  check at the same time** — and when a timing-sensitive assertion fails,
  re-run it alone before believing it.

## Suggested next steps, in priority order

1. **More Pop variants** — `pop-addition.html`, `pop-subtraction.html`,
   `pop-expression.html`, and `pop-perimeter.html` are built; ~7 more per
   the catalog. The catalog's one-line mechanic summary is identical for
   every one of these ("different expression template") and is NOT enough
   to design from — it hid that Subtraction Pop's real bust rule has two
   causes (fixed after shipping wrong once, see Known Traps), so the real
   Teacher Instructions text was fetched for the base game + every variant
   below before writing any of this list. Don't build any of these from the
   catalog line alone. Optional stretch for Expression Pop, not yet built:
   parentheses in later grades. Perimeter Pop's own coefficient
   generalization (`insideCoeffs`, generalizing `insideSigns`'s ±1 to an
   arbitrary positive integer) is now built and documented under "Where
   things stand" — a later shape (triangle/pentagon = more than 2 distinct
   sides) is still deferred, not attempted in this pass.
   - **Big Number Pop is NOT this engine at all** (corrected — an earlier
     version of this note wrongly called it "direct reuse"). It's a
     single number (no addition/subtraction), and its base rule has no
     bust-if-over condition — the "Two Winners" modification explicitly
     awards a closest-below AND a closest-above winner, which only makes
     sense if going over isn't a loss in the base game. This is Scuttle
     Add/Sub's plain closest-to-target win condition wearing Pop's
     sequential-one-digit-at-a-time UI — a real hybrid, design it as such.
   - **Powers of Ten Pop** has no target number at all, and its win
     condition is a secret-decimal-placement + ranking/elimination scheme
     ("largest pops, then largest of the remaining wins") — nothing like
     any engine built so far. Design fresh.
   - **Multiplication Pop** draws from a depleting half-deck of cards
     (digits become unavailable once drawn), not a repeatable die roll —
     a genuinely new resource-tracking mechanic on top of needing a
     product (Product Scuttle's engine, not `committedInsideSum`).
   - **Fraction/Mixed-Number variants** (Fraction Multiplication,
     Fraction Add/Sub, Mixed Number Multiplication, Mixed Number Add/Sub)
     all need real fraction math (multiply, add/subtract unlike
     denominators, simplify) and fractional display — a new component,
     not a value-function swap. Don't lump these in as "just another Pop
     variant."
2. **More Beeline variants** — `beeline-product.html` (the one-row case),
   `beeline-difference.html`, `beeline-addition.html`, `beeline-decimal.html`,
   `beeline-rounding.html`, and `beeline-equivalent-fraction.html` (the
   two-row case, sharing `shared-game.js`'s Beeline two-row engine — see
   "Where things stand" and "Beeline anti-stalemate fix, board
   randomization, and 5 new variants") are all built, with `beeline-
   menu.html` as Beeline's own sub-menu; 9 more curriculum variants remain.
   Representation-matching (Multiplication Representations),
   fraction/mixed-number value functions, and Time Beeline's clock-face
   rendering are each a bigger lift than the numeric variants already
   built — don't lump them in as "just another Beeline variant." Rounding
   Beeline's own build only modeled a FIXED "round to nearest ten," not the
   source catalog's fuller "round to whichever place the other row
   indicates" — a real, flagged scope reduction worth revisiting if a
   future pass wants the complete mechanic.
3. **More Nim variants** — `nim.html` (base game: add 1 or 2, race to reach
   or exceed 10), `nim-nickeled-and-dimed.html` (add a nickel or a dime,
   race to land EXACTLY on 50¢), and `nim-subtraction.html` (remove 1, 2,
   or 3 from a pile of 20, whoever takes the last token wins) are all
   built, with `nim-menu.html` as Nim's own sub-menu (see "Where things
   stand"); 3 more curriculum variants remain. The catalog's mechanic
   summary is identical for all six ("Alternately add/remove fixed amounts
   from a running total; reach or avoid a target") and is NOT enough to
   design from — it already hid that Hexagon Nim isn't a running-total game
   at all (see below), that Nickeled & Dimed's own win condition is EXACT-
   target, not at-least-target like base Nim (see "Where things stand"'s
   design note on why that wasn't a pure rescale), and that Subtraction
   Nim's own forced-win seat is the SECOND player, not the first — the
   reverse of both other built variants (see "Where things stand"'s own
   entry and Bot AI philosophy) — even among the genuinely numeric ones
   there's real mechanical variety this list spells out so a future pass
   doesn't assume "same family" means "just swap the numbers." Base Nim's
   own settings screen deliberately left out its own curriculum
   "Modifications" (Skip-Counting, Countdown, More numbers, Fractions) as
   format chips for now — Countdown in particular doesn't restate its own
   win condition in the source text (see the full rules dump this list was
   built from), so implementing it means inventing a rule not actually
   given, not reading one — worth doing as real format chips on `nim.html`
   later, following the established chip-row pattern, once each
   modification's actual win condition is confirmed rather than assumed.
   - **Division Nim**: subtract a FACTOR of the current number each turn
     (not a fixed {1,2,3} set) — legal moves depend on the current state,
     not a constant list. This needs a real `legalMoves()` to compute
     divisors of the running total rather than iterating a fixed `MOVES`
     array — the shared `nimLegalMoves(distanceToTarget, moveSet,
     reachOrExceed)` signature assumes a fixed, state-independent
     `moveSet` and would need to become state-dependent (or Division Nim
     needs its own local legal-move function instead of calling the shared
     one) — a genuinely different shape from every other Nim variant,
     worth designing (and re-verifying bot tiers for) on its own, not
     copy-pasted from base Nim's or Nickeled & Dimed's engine.
   - **Place Value Nim**: add 1, 2, or 3 TENS (base rule) to a pile, win by
     landing on exactly 250 — same "exact target" wrinkle as Nickeled &
     Dimed (`reachOrExceed=false` should transfer directly), PLUS a
     "regroup 10 tens into a hundred for an extra turn" bonus rule with no
     equivalent anywhere else in this family. Design and verify that
     bonus-turn mechanic explicitly; don't assume it's cosmetic.
   - **Hexagon Nim is NOT this engine at all** (already scoped out of this
     pass, not just postponed) — it's a spatial pattern-block board-filling
     game (place a triangle/rhombus/trapezoid into a shared hexagon board;
     completing the last hexagon wins), nothing like a running total. Needs
     its own board component (`components/hexagon-nim.css` or similar,
     following the `claim-grid.css` precedent) and its own bot design from
     scratch — do not attempt to fit it into `nim-track.css` or any
     numeric-total engine.
   - **"Nickeled, Dimed, and Quartered" (a modification of Nickeled &
     Dimed, not a 7th catalog variant) is out of scope, and looks like a
     third rescale but isn't:** target 75¢, add a nickel/dime/QUARTER
     (25¢) each turn. Dividing everything by 5 gives moves {1,2,5} against
     a target of 15 — a move set with a gap at 3-4, which breaks the clean
     "moves are 1..k, every remaining distance has a legal move" shape
     `nimLegalMoves`/`nimOptimalMove`'s exhaustive minimax already handles
     correctly as-is without needing special-casing. It would still WORK
     with the existing shared solver (arbitrary move sets are already
     supported), but needs the same harder P-position dynamic-programming
     verification-from-scratch treatment already scoped out for Division
     Nim above, not an assumption that it "just works" because Nickeled &
     Dimed did — a gapped move set can have a genuinely different
     winning-position pattern than a contiguous one, and that needs
     checking empirically before shipping, same discipline as everything
     else in this section.
4. **More Numbo variants** — `numbo-operations.html` (Operations Numbo) is
   built; 2 more named variants remain, both explicitly requested as
   "design the placeholders, don't build yet" — see the design note under
   "Where things stand" for the actual proposed specs (dice counts, frame
   shapes, scoring shape) rather than repeating them here. Both need their
   real physical game boards (or at least a clear description) before
   being built for real, not just polished from the placeholder — this
   isn't the same "swap the arrangement, keep the engine" situation as
   Remainder Scuttle below, since neither variant's ROUND SHAPE
   even matches Operations Numbo's (both are "find as many distinct
   answers as you can" scoring, not "one expression, race to 5" — see the
   design note for why). Base "Numbo" itself has no game of its own to
   build (see "Where things stand" — only the named variants are real
   games), so there's no fourth "base" file to add here.
   - **Equivalent Fraction Numbo**: needs a fraction-equivalence checker
     (cross-multiplication) and a distinctness check (the built fraction
     must not equal the target, even if reduced) — genuinely new math the
     engine doesn't have yet (Operations Numbo only ever compares two
     plain numbers).
   - **Fractions of Amounts Numbo**: needs a "fraction of a 2-digit amount"
     value function and a multi-target (1 through 10) coverage-scoring
     loop, not a single closest-wins comparison — a different WIN
     CONDITION shape than every game built so far, not just different math.
5. **More Detective variants** — `detective-fraction-equivalence.html` is
   built; no others exist yet even as named ideas (Detective isn't in
   `design/game-catalog.csv` at all — it came from a prior project's
   working reference implementation, not the Beast Classroom curriculum).
   The user's own framing named decimal equivalence and factor pairs as
   plausible siblings, and the file is structured so a sibling only needs
   to supply its own `generatePuzzle()`-equivalent returning the same
   generic contract (`parts`, `equivalentOrderings`, `isValidGuess`,
   `hintText`, `displayText` — see CLAUDE.md's Detective design note) plus
   its own bespoke `renderInputSlots()`-equivalent visual layout; the slot
   management, Wordle-coloring, guess history, on-screen keyboard, and
   endurance-budget mechanics should all be reusable as-is. Don't assume a
   future sibling wants round-based-progression-then-endurance-mode,
   though — that shape is this variant's own tuning, not asserted as a
   Detective-family universal. Nothing to extract into a shared JS file yet
   (only one variant exists) — revisit once a second one actually needs
   the same generic-contract shape, the same "don't just extract shared
   CSS/JS preemptively" discipline as everywhere else in this project.
6. **Remainder Scuttle** — near-identical engine to Product Scuttle, swap
   the operator to division-with-remainder. Flagged in the catalog as
   needing real bot-tuning attention ("tiny score range needs bot
   redesign") — take that seriously rather than assuming it's a drop-in
   swap: `scuttle-difference.html` (see "Where things stand") already
   surfaced exactly this kind of trap once for a supposedly-trivial
   Product-engine reuse (its naive "maximize every round" Hard bot actually
   lost to random play once a single round's max value could dwarf the
   target — verified and fixed via `test/scuttle-difference-bot-
   simulation.js` before any of it shipped) — check Remainder's own actual
   value range against its own target before assuming either the original
   Product heuristics OR Difference's fix transfers unmodified. Difference
   Scuttle itself is now built — see "Where things stand".
7. Extract `components/risk-meter.css`, `components/flip-card.css` from
   the mockups the first time each engine family actually gets built,
   following the `dice-slot.css`/`claim-grid.css` pattern.

Full catalog with mechanic summaries and digital-fit notes for all ~50 base
games: `/design/game-catalog.csv`.
