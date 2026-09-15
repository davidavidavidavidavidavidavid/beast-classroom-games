# Game Rules Index

Quick-reference bullets for every game built so far, pulled from the actual
source docs. This is a summary for quick lookup during development — not a
replacement for re-reading the real doc if you're building a variant that
isn't listed here yet, or if something here seems ambiguous.

---

## Scuttle
*Standards vary by variant. Materials: 3-6 ten-sided dice per group.*

- Roll dice, arrange the digits into number(s), evaluate, repeat 3 rounds.
- No leading zeros on any built number, unless every available digit is 0.
- **Addition & Subtraction Scuttle** *(built: `scuttle-addition-subtraction.html`)* — build 1 number/round, then add/subtract all 3 at the end; **closest to a target (over or under) wins**.
- **Product Scuttle** *(built: `scuttle-product.html`)* — split shared dice into 2 numbers/round, multiply, sum 3 rounds; **smallest sum still over a minimum wins** (largest wins if nobody clears it). 4 format options (2×1, 3×1, 4×1, 2×2), each with its own minimum.
- **Remainder Scuttle** *(not built)* — same shell as Product, but divide and keep the remainder; minimum sum ~10.
- **Difference Scuttle** *(built: `scuttle-difference.html`)* — same shell as Product, but subtract; 2-digit(target 100)/3-digit(target 500) format options, scored as `Math.abs(num1-num2)` (never negative). Needed real bot-strategy tuning, not just an operator swap — see CLAUDE.md's Bot AI philosophy for the "maximize every round" trap this surfaced.
- **Decimal Scuttle** *(not built)* — 4 turns, roll 2 dice/turn, fill a personal 4-slot board (top/bottom/left/right); smallest difference between sum(top+bottom) and sum(left+right) wins. Same shell as Gems (not yet built either).
- **Super Product Scuttle** *(not built)* — like Product, but 6 dice with a *freely chosen* digit split (not a fixed format) + a d10 "modifier roll" that can change the win condition.
- **Super Decimal Scuttle** *(not built)* — like Product, but 5 dice, free digit split, one of the two numbers gets a decimal point.

---

## Pop
*Standards vary by variant. Materials: 10-sided die, paper/pencil (or digital blanks).*

- Roll one digit at a time; every player writes that same digit into one of their own remaining blanks (inside a "balloon" = counts, or a "throw-away" outside it = doesn't count).
- **Once written, a digit can never be moved or erased.**
- Whoever's inside-the-balloon number is **closest to the target without going over** wins. Going over pops the balloon — instant loss, not just a worse score.
- **Addition Pop** *(built: `pop-addition.html`)* — blanks form an addition expression, e.g. `_ _ + _`. Default: 2-digit + 1-digit, 2 throw-aways, target 50.
- **Subtraction Pop** *(not built)* — a subtraction expression; also pops if the subtrahend exceeds the minuend (negative result).
- **Expression Pop** *(not built)* — a mixed +/− expression, optionally with parentheses at higher levels.
- **Perimeter Pop** *(built: `pop-perimeter.html`)* — blanks are a rectangle's Length and Width, each counted TWICE toward the perimeter (a per-addend coefficient generalizing Subtraction/Expression Pop's ±1 sign, not a 4th blank). Only one bust cause (over target) — side lengths can't go negative. Triangle/pentagon (more distinct sides) still deferred.
- **Big Number Pop** *(not built)* — no expression at all, just build the biggest number without exceeding target; has a "two winners" (closest-under and closest-over) modification.
- **Fraction Multiplication Pop**, **Fraction Addition and Subtraction Pop**, **Mixed Number Multiplication Pop**, **Mixed Number Addition and Subtraction Pop** *(not built)* — same bust-if-over shell, fraction/mixed-number arithmetic instead of whole numbers; prefer a 6-sided die for simpler denominators.
- **Powers of Ten Pop** *(not built)* — different win condition, no target: build `_ _ × 10^_`, secretly place a decimal point, then compare — largest pops, then largest remaining wins.
- **Multiplication Pop** *(not built)* — multi-digit multiplication; uses a half-deck of number cards instead of a die by default (limited-supply digits change the strategy).

---

## Beeline
*Standards vary by variant. Materials: 2 tokens per pair, a printed game board (grid + 1-2 rows below it).*

- Move tokens along row(s) below a grid to produce a value (via whatever operation that variant defines), then mark the matching grid cell with your symbol (X/O).
- **One row below the grid:** both tokens move on that same row (can share a space); the value is a function of both token positions (e.g., product of the two numbers).
- **Two rows below the grid:** one token per row; the value combines one number from each row (e.g., difference, sum, "reads as a time/date/decimal").
- Moving to a cell that's already marked wastes your turn (no mark, turn passes).
- **First to get 4 in a line (any direction) wins** — "BEELINE!"
- **Product Beeline** *(built — file may vary, check project)* — one row, 1-9; value = product. This is the classic "Product Game." Has Tens and Tens-and-Hundreds two-row variants.
- **Difference Beeline, Addition Beeline** *(not built unless noted)* — two rows; value = difference or sum of the two token values.
- **Multiplication Representations Beeline** *(not built)* — two rows, one is expressions, one is visual representations; match them.
- **Mixed Number Beeline** *(not built)* — two rows (numerator/denominator or whole/fraction); value = the equivalent mixed number or fraction.
- **Decimal Beeline** *(not built)* — two rows (tenths/hundredths); value = the sum written as a decimal.
- **Time Beeline** *(not built)* — two rows; value = the time on an analog clock the two numbers indicate.
- **Rounding Beeline** *(not built)* — two rows; value = one number rounded to the place value the other indicates.
- **Fractions and Whole Numbers Beeline, Multiplying Unit Fractions Beeline, Multiplying Fractions Beeline** *(not built)* — one or two rows; value = a fraction product.
- **Equivalent Fraction Beeline** *(not built)* — two rows (numerator/denominator); value = any equivalent fraction to what the tokens show.

---

## Nim
*Standards vary by variant. No dice — pure alternating-turn strategy, no randomness.*

- Two players alternate adding (or removing) a fixed amount to/from a running total.
- Optimal play is a **provable formula**, not a search or simulation: track distance-to-target mod (largest move + 1) — see `shared-game.js` for the extracted logic.
- **Nim (base)** *(built: `nim.html`)* — add 1 or 2, first to reach/exceed 10 wins. Whoever moves first can force a win with perfect play — the "who goes first" choice matters and must be explicit.
- **Nickeled & Dimed** *(built: `nim-nickeled-and-dimed.html`)* — add a nickel (5¢) or dime (10¢), reach exactly 50¢. Mathematically identical to base Nim scaled by 5.
- **Subtraction Nim** *(built: `nim-subtraction.html`)* — start at a pile of 20 tokens, remove 1-3 per turn, whoever takes the last token wins. Uses the same shared solver as base Nim/Nickeled & Dimed (distance-to-target is just the current pile size here) — but a real, verified surprise: for pile=20/moves={1,2,3}, going SECOND is the forced-win seat (20 mod 4 === 0), the opposite of base Nim's and Nickeled & Dimed's own math. See CLAUDE.md's Bot AI philosophy.
- **Nickeled, Dimed & Quartered** *(not built — harder than it looks)* — adds a quarter (25¢) option, target 75¢. The move set {5,10,25} does **not** reduce to a clean 1..k range, so the simple formula doesn't directly apply — needs the same harder P-position search as Division Nim.
- **Division Nim** *(not built, different family)* — subtract any factor of the current number; whoever is forced to write 0 loses. Needs real dynamic programming over divisors, not a closed-form formula.
- **Hexagon Nim** *(not built, different family)* — fill 3 hexagons with pattern-block pieces (values 1/2/3 in sixths); effectively a 3-pile Grundy-value game.
- **Place Value Nim** *(not built, different family)* — add 1-3 tens toward exactly 250; has a "regroup 10 tens into a hundred → take an extra turn" mechanic that breaks the simple alternating-turn assumption.

---

## Detective
*Single-player puzzle — no bot opponent, no win/lose against an AI.*

- **Fraction Equivalence** *(built: `detective-fraction-equivalence.html`)* — Wordle-style: given a target fraction, guess an equivalent one digit-by-digit. Each digit gets feedback (right digit/right slot, right digit/wrong slot, absent), computed across *all four numbers flattened into one digit sequence* (not per-number — an earlier per-number approach broke on 2-digit numbers).
- 6 guesses per puzzle. A guess matching the target fraction **in either order** (`n1/d1 = n2/d2` or flipped) counts as a win.
- Difficulty auto-progresses by round number (see `LEVELS` table in the file: single-digit → 2-digit → improper fractions → larger numbers).
- After round 10, "endurance mode" replaces round-based play: a 50-guess budget across unlimited puzzles.
- Hint (reveals the simplified form) unlocks after 2 wrong guesses in a puzzle.
- No other Detective variants exist yet — this was ported from a prior project, not the Beast Classroom catalog, so there's no source doc with sibling variants to check against.

---

## Where to find the rest

The other ~45 base games (and their ~70 remaining variants) are cataloged in
`/design/game-catalog.csv` with mechanic summaries and engine-family
groupings, but **not** full rules bullets like above — that gets added here
the first time each one is actually built, using the real source doc at
build time, not from the catalog's one-line summary.
