# REBUILD.md — Architecture & how to extend TIME RIFT

This doc is for a developer picking up the project cold: how it's put
together, how to run/verify it, and how to add the remaining eras.

## Stack

- **Vite** (build/dev server), **TypeScript** (strict mode), **Phaser 3**
  (rendering/scenes/input/audio-adjacent helpers), **Vitest** (unit tests).
- No backend, no network calls at play time, no analytics. `vite.config.ts`
  sets `base: '/TimeRift/'` for GitHub Pages project hosting.

## Directory layout

```
src/
  core/            Pure TypeScript, no Phaser imports, fully unit-tested.
    types.ts        Shared types: EraId, PlayerProfile, SaveData, etc.
    rng.ts           Seeded PRNG (mulberry32) so puzzle generation is testable.
    save.ts          localStorage read/write, multi-profile CRUD.
    progression.ts  Stars, artifacts, gadget-skin unlocks, era-unlock rules.
    hints.ts         Generic HintTracker (ordered hint reveal + usage count).
    puzzles/
      egypt.ts, rome.ts, vikings.ts, castle.ts, florence.ts, revolution.ts,
      industrial.ts, moon.ts   One pure logic module per era.
      boss.ts   Final-boss round sequencing/HP state machine (reuses the
                above modules' generators/validators; no duplicated logic).
  state/
    GameState.ts     Wraps SaveData, stored in Phaser's registry (key "gameState").
  audio/
    SoundManager.ts  All SFX synthesized via WebAudio — no audio files.
  ui/                Reusable Phaser helpers shared by every scene/era.
    theme.ts          Colors, fonts, per-era palettes, canvas size (960x600).
    GameButton.ts     Touch-friendly rounded button factory.
    HUD.ts            Top bar: title, timer, hint button, mute, back.
    parallax.ts       Sky gradients, starfields, a cheap pointer-parallax layer helper.
    particles.ts      One shared particle texture + success/error burst helpers.
    PortalTransition.ts  The swirling time-rift portalOut()/portalIn() effect.
    toast.ts          Small floating message (hints, mistakes).
  scenes/            Non-era scenes: Boot, ProfileSelect, Hub, Museum,
                     EraComplete, BossComplete.
  eras/              One Phaser Scene per playable era (the gameplay + art),
                     plus BossEraScene for the final showdown.
tests/               Vitest specs, one file per core/ module.
public/              manifest.webmanifest, sw.js, icons/ — the PWA shell.
```

The **only** hard rule that keeps this maintainable: puzzle *logic* (what's
correct, scoring, generation) lives in `src/core/puzzles/*.ts` with zero
Phaser dependency, so it's unit-testable without a canvas/DOM. Phaser scenes
in `src/eras/*.ts` only handle presentation and call into that logic.

## Running & verifying

```bash
npm install
npm test            # vitest run — all core logic, no browser needed
npm run build       # tsc -b (type-check) && vite build
npm run preview      # serve dist/ for a manual smoke test
curl -sI http://localhost:4173/TimeRift/   # should return HTTP 200
```

`npm run dev` serves with hot reload at `/` by default in dev mode (Vite
ignores `base` for the dev server root unless you navigate to it directly);
`npm run preview` serves the production build under `/TimeRift/`, matching
how it'll be hosted on GitHub Pages.

## How the game flows

`Boot` → loads/creates `GameState` in the registry → `ProfileSelect` →
`Hub` (the rift map). Tapping an unlocked era node calls `portalOut()` then
`scene.start('<Era>Era')`. Each era scene calls `portalIn()` on `create()`
for the reveal animation. On puzzle completion, the era scene builds an
`EraCompleteData` payload (era id, attempt result, star thresholds, and the
"what really happened" fact) and starts the `EraComplete` scene, which
calls `recordEraCompletion()` to mutate and persist the save, then shows
stars/artifact/fact and a button back to `Hub`.

All 8 eras (Egypt, Rome, Vikings, Medieval Castle, Renaissance Florence,
American Revolution, Industrial Revolution, Moon Landing) are implemented.
`HubScene.ts` gates them with the full-chain `isEraUnlocked()` from
`core/progression.ts` — no playable-subset override remains.

## The final boss: "The Chronarch"

Once every era is completed, a "Final Showdown" node unlocks on the Hub
map (`isBossUnlocked()` in `core/progression.ts`) and starts `BossEraScene`
(`src/eras/BossEraScene.ts`). The fight is a pure state machine in
`src/core/puzzles/boss.ts` (`initBossFight`/`applyRoundOutcome`/etc.,
tested in `tests/puzzles-boss.test.ts`): 8 rounds, one per era in
`BOSS_ROUND_ORDER` (= `ERA_ORDER`), each generating a single-instance
challenge via that era's own `core/puzzles/*.ts` generator/validator (no
duplicated puzzle logic). A correct answer chips the boss's HP and
advances the round; a mistake costs the player one of `PLAYER_MAX_HP`
hearts. Winning calls `recordBossVictory()` and shows `BossCompleteScene`;
losing offers a scene restart.

## Adding a new era (e.g. a 9th one)

1. **Design the puzzle as pure logic first.** Add
   `src/core/puzzles/<era>.ts` with generation + validation functions (see
   `vikings.ts` for a simple example, `moon.ts` or `castle.ts` for a
   physics-driven one). Write `tests/puzzles-<era>.test.ts` alongside it.
   Get this green before touching Phaser at all.
2. **Add the era's theme** to `ERA_THEME` in `src/ui/theme.ts`, add the id
   to `EraId`/`ERA_ORDER` in `core/types.ts`, and add entries to
   `ARTIFACTS`/`GADGET_SKINS` thresholds in `core/progression.ts` if the
   total-star count changes.
3. **Create `src/eras/<Era>EraScene.ts`.** Copy the shape of an existing
   scene: draw a background with `skyGradient`/`starField`/`Graphics`
   shapes, build an `EraHUD`, wire buttons/drag input to your
   `core/puzzles/<era>.ts` functions, track `mistakes`/`hintsUsed`/elapsed
   time, and call `portalOut()` into `EraComplete` with an
   `EraCompleteData` payload. Create text objects that an `update*()`
   method writes to *before* calling any draw function that triggers that
   `update*()` (see the git history for a `setText` ordering bug fixed in
   `CastleEraScene`/`IndustrialEraScene` for exactly this trap).
4. **Register the scene** in `src/main.ts`'s `scene: [...]` array.
5. **Add it to `HubScene.ts`**: add its node to `NODE_POSITIONS`/`ERA_ICON`
   and its scene key to `ERA_SCENE_KEY`.
6. **Add a round to the boss fight**: import the new puzzle module into
   `BossEraScene.ts` and add a `start<Era>Round()`/case in
   `startCurrentRound()`'s switch, following the pattern of the other
   rounds (single generated challenge, draw minimal controls into
   `puzzleLayer`, call `resolveRound()` with the validation result).
7. Run `npm test && npm run build` and manually play through it with
   `npm run dev`.

## PWA / offline notes

`public/sw.js` uses a cache-first-with-background-refresh strategy against
same-origin GET requests, so it doesn't need a build-time list of Vite's
hashed filenames — anything fetched during normal play gets cached and
works offline afterward. `public/manifest.webmanifest` points at PNG icons
generated in `public/icons/` (procedurally, via Pillow — see
`CREDITS.md`). If you change `vite.config.ts`'s `base`, update
`start_url`/`scope` in the manifest to match.
