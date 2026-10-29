# TimeRift text + puzzles — what changed

Branch: `task/timerift-text-puzzles`.

## Part 1: Text layout

- **Buttons** (`src/ui/GameButton.ts`): labels now word-wrap to the button width and the font
  auto-shrinks (down to a 16px floor) or the button grows taller, instead of clipping or
  spilling past the edge. Covered by a new `tests/game-button-fit.test.ts` (fuzz-tests the
  wrap/shrink algorithm across many label/width combos).
- **Audited every scene** and fixed real, confirmed overlaps (verified with Playwright
  screenshots, not just reading code):
  - Hub screen: a long profile name wrapped the welcome line onto the star-count line below it.
    Now stacked from measured text heights.
  - The shared `EraHUD` goal banner (used by all 11 puzzle screens) sat *behind* its own Back/
    Hint buttons, and below that, several scenes' first line of text sat on top of the goal
    banner itself (worst on the wide desktop canvas, where the banner doesn't wrap and reads as
    a wide pill). Fixed by: resizing the button row to fit inside the HUD bar, giving the goal
    banner its own background pill so it's legible against any art behind it, and having the 7
    affected scenes (Castle, Industrial, Moon, Flight, Revolution, Florence, Vikings) position
    their first text against the HUD's actual measured bottom edge instead of a guessed offset.
  - Vikings: the "Polaris" label/star sat under the (now taller) goal banner; also its clue
    text could collide with the "Leg X of Y" line above it when the clue wrapped to 2 lines.
  - Florence: `subjectText` had **no `wordWrap` at all** — at 19px it measured ~770px wide, far
    wider than the 440px portrait canvas, and ran off both edges.
  - Flight: the "Set the airspeed..." instruction text overlapped the Flyer graphic; moved it
    next to the slider it actually labels.
  - Rome, Revolution, Egypt, China, Boss: fixed-offset text overlapping below it when the
    content above wrapped to more lines than the layout assumed. Restacked from measured
    heights.
  - Museum: artifact blurbs at a readable 16px no longer fit the grid card, so blurbs moved to
    a tap-to-view toast instead of being crammed into the card.
- Raised every remaining 11–14px label to ≥16px (HubScene node labels, Museum captions, slider
  endpoint labels in Castle/Moon/Flight, the Revolution cipher-wheel letters, Vikings' "Polaris"
  label).
- Screenshots: `.playwright-shots/timerift-text/` inside this repo (51 PNGs — every scene ×
  390×844, 430×932 touch, and 1280×800 desktop; gitignored, not pushed). `/workspace/apps/shots/`
  from the task brief was outside this session's writable paths — regenerate anytime with
  `npm run build && npx vite preview --port 4173 &` then `node scripts/screenshot-check.mjs`.

## Part 2: Puzzles — duplicates found and replaced

**Found:** Egypt and China were mechanically identical — a 4-option multiple-choice match
against a *static* lookup table (situation→tool / request→good), with no randomization beyond
shuffling which of the 4 fixed options came up. With 6 rounds drawn from only 4 options,
repeats within a single playthrough were guaranteed by the pigeonhole principle. Egypt was
worse: two different "situations" (tight-gap, final-lift) both mapped to the same tool (lever),
so there were really only 3 distinct answers behind 4 prompts.

**Replaced:**
- **Egypt** (`src/core/puzzles/egypt.ts`): now generates a random `weightKg` (300–1400) and
  `distanceM` (5–80) per block; the correct tool is derived from a small decision tree (long
  haul → wet sand; otherwise heavy → ramp, medium → lever, light → sledge). Every block has
  exactly one correct, computed answer — genuine reasoning, fully randomized per play. Verified
  with a 300-seed uniqueness sweep in `tests/puzzles-egypt.test.ts`.
- **China** (`src/core/puzzles/china.ts`): now presents a weight cap + a silver-price floor;
  the player compares against a shown reference table of the 4 goods' stats and picks the one
  good that satisfies both. Threshold ranges are constructed per-good so exactly one good
  always qualifies (verified with the same 300-seed sweep). Distinct from Egypt's mechanic
  (two independent numeric constraints vs. a branching decision tree).
- Boss-fight versions of both rounds were quietly *not showing the player the numbers at all*
  (pre-existing gap — you could only solve them by burning a hint); both now show the real
  weight/distance or weight/price numbers, same as the standalone eras.
- Save-data compatibility: both puzzle files keep their public function names/shapes
  (`generateBlocks`/`checkAnswer`/`correctTool`, `generateStops`/`checkGood`/`correctGood`), so
  nothing in `src/core/save.ts` or player progress needed to change.

**Not touched:** Vikings, Castle, Florence, Industrial, Flight, Rome, and Revolution already
randomize their target values every play and aren't mechanically identical to each other —
left alone. Moon's three mission targets are still static (not randomized) — lower priority
than the Egypt/China fix since it's a continuous-slider puzzle, not a lookup-table repeat;
noted as an open item.

## Tests / build

- `npm test` → **22 files, 169 tests passing** (added `tests/game-button-fit.test.ts`; extended
  `tests/puzzles-egypt.test.ts` and `tests/puzzles-china.test.ts` with decision-logic and
  300-seed uniqueness coverage).
- `npm run build` passes (`tsc -b && vite build`).
- `node scripts/touch-tap-check.mjs` (pre-existing iPhone tap-registration regression test)
  still passes.
- Service worker cache bumped `timerift-cache-v3` → `v4` (`public/sw.js`).

## Open items

- Rome's numeral-tile row overflows the canvas edge by ~2px when a puzzle rolls 9 tiles
  (pre-existing, cosmetic, not from this change).
- Moon's mission targets aren't randomized per play (see above).
