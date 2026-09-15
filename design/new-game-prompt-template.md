# New Game/Variant Prompt Template

How to use this: copy everything below the line, fill in every `[BRACKETED]`
section, delete any `(template note: ...)` instructional asides, delete any
section that genuinely doesn't apply (say why, briefly, in the prompt itself
so Claude Code knows it was a deliberate omission, not a gap) — then paste
the result into Claude Code. The sections marked **(always include, do not
cut)** exist because skipping them is exactly what caused a real bug or a
real duplication problem earlier in this project — they're not boilerplate
for its own sake.

---

## PROMPT STARTS HERE

Read `CLAUDE.md` in full before doing anything else.

**(always include, do not cut) Naming, checked before writing a single line:**
File is `[game-name]-[variant-name].html`, following the established
convention — the prefix is the actual game's name, never a different game's
name reused as a catch-all (this has happened twice already: Pop and Nim
both needed correcting after inheriting "Scuttle" as if it were a project-
wide brand rather than one specific game). If this is variant #1 for this
game, link directly from `index.html`; if this is variant #2+, this
prompt must also produce/update a `[game-name]-menu.html` (mirroring
`scuttle-menu.html`'s pattern) and flip `index.html`'s card for this game
from a direct link to a "See variants →" link, per the two-tier nav
convention.

**The H1 for this file must read "[GAME NAME]"** — not any other game's
name. (This exact bug has shipped before from copy-pasting an existing
file as a starting template without updating this line. Say explicitly in
the prompt, not just in your own head, so it survives being read literally.)

---

### 1. The actual rules

**(always include, do not cut)** Paste the rules **verbatim from the actual
source doc** — not a summary, not "same as [other game] but with X." Two
real bugs already happened from assuming a mechanic carried over from a
sibling-looking game without reading the real rules (Product Scuttle's
threshold-win rule vs. the assumed closest-to-target rule; Beeline's actual
Connect-4 mechanic vs. the race-track mechanic its filenames implied). If
you (the human writing this prompt) haven't re-read the source doc for this
specific variant recently, do that before filling in this section, not after.

```
[PASTE VERBATIM RULES HERE]
```

---

### 2. What this reuses vs. what's genuinely new

**Reuses:** [Name the existing engine/component this is a sibling of, if
any — e.g. "Product Scuttle's split-two-numbers-and-multiply engine, just
swap the operator." If this is a rescale of an existing solved game (like
Nickeled & Dimed was to Nim), say so explicitly and instruct that the
underlying formula/logic gets extracted to `shared-game.js` if this is the
*second* real consumer of that logic — not before a second consumer exists,
per the "don't abstract prematurely" lesson from the CSS/JS refactors.]

**Genuinely new, needs real design work:** [Name the specific new mechanic,
UI component, or bot-AI approach this variant needs that nothing existing
covers. If you're not sure whether something is "new" or "a reskin," that
uncertainty itself is worth naming in the prompt rather than guessing either
way.]

**Explicitly out of scope for this prompt (future family, don't bundle in):**
[Name any sibling variants/modifications that LOOK like simple reskins but
actually need harder logic — e.g. Nickeled Dimed & Quartered's broken move-
set gap, or Division/Hexagon/Place-Value Nim's genuinely different solvers.
If none apply, say "none for this variant" rather than omitting the section,
so it's clear the check was made.]

---

### 3. Bot AI

[Describe the win condition's shape first: closest-to-target? threshold-
over/under? provably-solved combinatorial game? push-your-luck risk
decision? memory/hidden-information? This determines which kind of bot
design applies — don't default to "Monte Carlo simulation" out of habit if
the game is actually a solved formula (Nim-family) or a simple probability
threshold (Pig-family).]

**Easy:** [usually: a uniformly random valid choice]
**Medium:** [a simple, human-plausible heuristic — describe it precisely
enough that "plausible" doesn't mean "whatever seems reasonable," since a
plausible-sounding heuristic has already turned out to be *worse than
random* once in this project (Product Scuttle's original "biggest digits to
the bigger number" medium bot) — describe the mechanism, not just the vibe]
**Hard:** [exhaustive search if the space is small enough; Monte Carlo
simulation if it isn't; the exact provable formula if this is a solved game]

**(always include, do not cut) Verify empirically before wiring into HTML:**
write a standalone Node script simulating many head-to-head matches (shared
randomness where applicable, real win-condition logic) and confirm Hard
never loses to Medium, and Medium beats Easy, across a meaningful sample.
Show this output before moving on to the actual game file. Do not assume a
heuristic is better than random without checking — this is not a formality,
it has caught a real, shipped-adjacent bug.

---

### 4. Interaction / UI

[Describe the actual input mechanism if it's not a straightforward reuse of
an existing component: dice+slots, drag-to-swap, drag-along-a-track,
push-your-luck roll/bank, card flip, etc. If it's a new pattern, point to
whatever mockup already prototyped it in `/design/mockups/` — build one
first if none exists and the pattern is genuinely novel, rather than having
Claude Code invent interaction feel sight-unseen.]

**(always include, do not cut) Layout stability:** any within-round content
that changes size across phases (dice appearing, answer-check appearing,
hint text appearing) must exist in the DOM at full real size from initial
render, with only `visibility` toggled — never conditionally constructed at
reveal-time into a "reserved" container. (This exact bug shipped once
already — an empty wrapper marked `visibility:hidden` doesn't reserve space
for content that doesn't exist yet.)

**(always include, do not cut) Motion:** any celebration/reveal animation
plays a small fixed number of times and then rests in a calm static state.
Nothing loops. Nothing exceeds a gentle pulse rate. Respect
`prefers-reduced-motion` by skipping straight to the final state. This is a
deliberate child-safety/screen-time decision, not just aesthetic restraint —
don't let a future "make it more exciting" request quietly reverse it
without that tradeoff being re-raised explicitly.

---

### 5. Navigation integration

**(always include, do not cut)**
- Add/update this game's card on `index.html` per the single-vs-multi-variant
  rule above.
- Add/update the global nav bar's Games dropdown entry.
- If this required a new `[game-name]-menu.html`, make sure it has no boot
  sequence of its own (that's exclusive to `index.html`).

---

### 6. Testing

**(always include, do not cut)**
- `node --check` on every new/modified file.
- Full jsdom playthrough exercising the complete flow start to finish, with
  the actual math/logic asserted correct at each step (not just "didn't
  throw an error").
- [Add any game-specific edge cases here — e.g. a specific win-condition
  branch that's easy to get backwards (over/under threshold, exact-tie,
  flipped-equation-still-counts), a boundary condition in generation logic,
  or — per the container-height bug — an explicit assertion that a
  variable-content container's bounding height doesn't change unexpectedly
  between phases.]

---

### 7. Documentation

**(always include, do not cut)** Update `CLAUDE.md` with anything this
variant establishes that future variants should follow: a new shared
function, a newly-identified family boundary (what's a cheap reskin vs.
what needs its own design pass), a new interaction pattern now proven in a
real build rather than just a mockup.

## PROMPT ENDS HERE
