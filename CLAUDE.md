# Beast Classroom — Digital Games Project

Digital bot-vs-human adaptations of Beast Classroom's in-person math fluency
games. Built as single-file-per-game HTML/CSS/JS (no build step, no
dependencies beyond Google Fonts), sharing a common design system.

## Where things stand

**Built and tested:**
- `scuttle-addition-subtraction.html` — closest-to-target, build 1 number/round
- `scuttle-product.html` — split shared dice into 2 numbers, multiply, smallest-sum-over-threshold wins
- `pop-addition.html` — one shared digit revealed at a time, sequential/irrevocable placement into inside-blanks or throwaways, closest-to-target-without-busting wins (busting = instant loss). Not yet linked from `scuttle-menu.html`.
- `scuttle-menu.html` — hub/landing page with an NES-style boot sequence, links out to each game (Scuttle games only so far — see above)

**Designed but not built** (see `/design/` folder):
- `beeline-board-mockup.html` — Connect-4-style claiming grid (new component)
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
components/
  dice-slot.css             <- Shared by Scuttle-family games only (dice tiles +
                               place-value slots). Non-Scuttle games won't link it.
  (future: claim-grid.css, risk-meter.css, flip-card.css — one per new
   engine family, extracted from the /design/ mockups when first built for real)
<game>-<variant>.html       <- Each game: a couple of <link> tags to the shared
                               CSS, plus a SMALL <style> block for whatever's
                               genuinely unique to that game (10-20 lines, not 300)
                               See "File naming convention" below for how
                               <game> and <variant> are chosen.
scuttle-menu.html            <- Hub page
design/                      <- Mockups + the catalog CSV, reference material only
```

**Why this matters:** we deliberately refactored out of "each game has its own
full copy of the CSS" specifically so a future design change is a one-file
edit, not a 100-file edit. Preserve this — when adding a new game, prefer
reusing/extending the shared files over re-inlining styles.

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
- **`DIFF_DESC`, `DIFF_NAME`** — difficulty metadata constants (description
  string and display name, keyed by `'easy'|'medium'|'hard'`).
- **`decideWinner(...)`** — win-condition logic lives in a standalone, pure
  function by this name. It takes whatever final values it needs as
  arguments (e.g. Add/Sub: `decideWinner(humanDist, botDist)`; Product:
  `decideWinner(humanSum, botSum, target)`) and returns `'human'`, `'bot'`,
  or `'tie'` — zero DOM access, zero side effects. It's called from the
  reveal button's click handler; the comparison logic doesn't live inside
  that handler. This is what makes Testing methodology point 4 below
  possible without a browser: a plain Node script can `new Function(...)`
  the extracted script and call `decideWinner` directly with edge-case
  inputs.

## Testing methodology

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

## Suggested next steps, in priority order

1. **More Pop variants** — `pop-addition.html` is built; ~10 more content
   variants (subtraction, other blank/throwaway counts, etc.) reuse the same
   engine (`legalTargets`/bot tiers/`decideWinner` all generalize on
   `insideLens`/`throwaways`/`target` already — see that file). Also: link
   `pop-addition.html` from `scuttle-menu.html`, which doesn't know about it yet.
2. **Beeline** — biggest variant payoff (~15 variants) but needs the new
   claim-grid component (mocked up in `/design/beeline-board-mockup.html`).
3. **Remainder / Difference Scuttle** — near-identical engine to Product
   Scuttle, just swap the operator and format table.
4. Extract `components/claim-grid.css`, `components/risk-meter.css`,
   `components/flip-card.css` from the mockups the first time each engine
   family actually gets built, following the `dice-slot.css` pattern.

Full catalog with mechanic summaries and digital-fit notes for all ~50 base
games: `/design/game-catalog.csv`.
