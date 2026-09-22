# Fluency Tracking & Nudge Design Plan

*(Saved from a Claude Doc design conversation — see original at
https://claude.ai/artifact/5hffiw7sBUKGhayTww7bYa for comment history.)*

## Overview

This doc lays out how we plan to track math fluency across Beast Classroom
games, and how we can nudge students toward practicing what they need
without forcing it.

Core idea: most of our games give students choice, and choice is what makes
them fun and strategic. Rather than fighting choice with forced problems, we
want games designed so that playing to win tends to route students through
what they need most — nudging, not forcing.

## Two fluency buckets: facts and procedures

Fluency splits into two buckets, each with its own data model.

**Math facts** (CCSS core facts: addition and subtraction within 20,
single-digit multiplication and 10, and their inverses) are a finite,
enumerable set — track per-fact mastery over a fixed grid. Top tier: a
whole fact family (e.g. 1-digit × 1-digit multiplication). Lower tier: an
individual fact (e.g. 7×9).

**Procedures** aren't finite — students should be able to reconstruct a
forgotten fact from a strategy (7×9 from 7×10 minus 7) and work quickly
through problems never meant to be memorized (17+19, 43×53). Track fluency
per problem-classifier bucket instead. Top tier: a whole procedure (e.g.
multi-digit addition). Lower tiers: a sub-skill (e.g. 2-digit + 2-digit
without exchange). This needs a taxonomy that classifies any generated
problem into its bucket — specific to each skill, not one shared schema.

**Facts are lookup; procedures are tagging — two systems, one UI.**

## Choice, force, strategy & drill matrix

Two axes describe a game:
- **x — strategy:** how much genuine strategic thinking the game rewards
- **y — forcing power:** how much we can make a student engage with a
  specific problem

We want x as high as possible everywhere — strategy is what makes these
games engaging. But for every skill we need at least one game at the top
of the y axis, where we can assign specific numbers directly — even if
that means x stays low for that game. That's the flashcard drill:
near-zero x, maximum y, a deliberate instrument alongside the strategy
games, not a compromise we settle for.

| | Low forcing power | High forcing power |
|---|---|---|
| **High strategy** | Most games (target) — Beeline, Scuttle | Ideal, but rare |
| **Low strategy** | Avoid | Flashcard drill — needed once per skill |

## Nudging philosophy

Nudging shapes what's available or attractive — it never forces a choice.
It assumes students are motivated to win, and that motivation can be
routed through the facts we want practiced. Board position is where we
lean hardest (e.g. a high-leverage number like 63 toward the center of
Beeline — a good player wants that spot anyway). Dice and bot behavior can
nudge too, but risk feeling rigged if visible, so they need a lighter
touch.

That win-motivation assumption needs a backup for when it doesn't hold —
that's what the flashcard drill above is for.

**Key rule: nudges only touch selection/exposure, never correctness — bots
always calculate correctly.** A nudged and unnudged attempt at the same
fact are equally valid evidence of what a student knows, so we blend them
in the data rather than tracking separately.

## Open questions

Deliberately unsolved for now:

1. **Nudge intensity/calibration.** No formula yet — to be worked out per
   lever, with examples, as we build.
2. **Taxonomy authoring.** Procedure taxonomies are skill-specific. We need
   a lightweight, repeatable template for defining a taxonomy per skill
   that a shared engine can consume, rather than one shared schema.
3. **Progression gating ("boss-lock") details.** Noted as an option, **not
   adopted**. If revisited: what exactly gates the unlock (a single fact
   vs. an aggregate top-tier score — a student could clear the aggregate
   while individual facts underneath are still weak), whether the gate is
   per-skill or per-game, and whether it transfers across game families
   touching the same skill.
4. **Cross-game aggregation.** How top-tier fluency scores blend evidence
   from multiple games once more than one game touches the same
   fact/skill set.
