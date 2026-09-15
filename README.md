# Beast Classroom — Digital Games

**[▶ Play now](https://davidavidavidavidavidavidavid.github.io/beast-classroom-games/)**
*(link goes live once GitHub Pages is enabled on this repo — Settings →
Pages → Deploy from branch → `main` / root)*

Digital bot-vs-human adaptations of Beast Classroom's in-person math fluency
games. Roll dice, race a bot, and practice arithmetic fluency — addition,
subtraction, multiplication, fractions, decimals, and more — through short,
replayable head-to-head rounds instead of a worksheet.

Every game is a single self-contained HTML file: no build step, no server,
no dependencies beyond a couple of Google Fonts. Open a file, or visit the
Pages link above, and you're playing.

## What's playable today

**Scuttle** — build a number from rolled digits, closest to the target wins.
- Addition & Subtraction · Product · Difference

**Pop** — place one revealed digit at a time; go over (or negative) and you
bust.
- Addition · Subtraction · Expression · Perimeter

**Beeline** — a turn-based, Connect-4-style claiming game: move shared
tokens along a number row, claim the resulting value on a 36-cell board,
four in a row wins.
- Product · Difference · Addition · Decimal · Rounding · Equivalent Fraction

**Nim** — a race to (or away from) a target total, alternating moves with a
bot that plays perfectly at the hardest tier.
- Race to 10 · Nickeled & Dimed · Subtraction Nim

**Numbo** — roll four digits, build an expression as close to a target as
possible using `+ − × ÷` and parentheses (the "24 game").
- Operations

**Detective** — a solo Wordle-style puzzle: guess a fraction equivalent to a
hidden target, one digit at a time.
- Fraction Equivalence

Every game has adjustable bot difficulty (Easy / Medium / Hard), a
player-selectable avatar, and no ads, accounts, or tracking.

## Running it locally

No build step — clone the repo and open any `<game>.html` file directly in
a browser, or serve the folder with any static file server:

```bash
python3 -m http.server
# then open http://localhost:8000/index.html
```

`index.html` is the hub; every game and sub-menu links back to it.

## How this was built

This project was built collaboratively with Claude: design, scoping, and
iteration happened in conversation with Claude.ai, and the actual
implementation — HTML/CSS/JS, bot logic, and test suite — was written with
Claude Code. It's a genuinely interesting (and genuinely real) part of how
this project came together, so it's public here rather than hidden.

The deeper build process — design conventions, bot-AI philosophy, testing
methodology, and the full history of decisions behind each game — lives in
[`CLAUDE.md`](CLAUDE.md), the internal build log this project was developed
against. It's long and written for continuing the build, not for a general
audience, but it's the real record if you want it.

## Tests

A Node-based test suite (jsdom smoke tests, bot-simulation scripts, pure
unit tests) covers every built game — see [`CLAUDE.md`](CLAUDE.md)'s
"Testing methodology" for what it checks and why.

```bash
npm install
npm test
```
