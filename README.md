# TIME RIFT

A time-traveling history & science adventure built for curious middle
schoolers. A villain called the Chronarch has shattered the timeline —
jump through swirling time rifts across ten eras, from Ancient Egypt to
the Moon landing, and mend each one by solving puzzles woven into real
history and science (not quizzes): pick the right tool to raise a pyramid
block, crack a Roman numeral vault lock, load a Silk Road caravan, steer a
longship by the North Star, aim a trebuchet, compose a Renaissance canvas
by the golden ratio, crack a Culper Ring cipher wheel, set a factory's gear
ratio, balance lift against a fragile wing frame, and balance thrust
against fuel to launch a rocket. Mend every era and the Chronarch itself
challenges you to a final showdown mixing a trial from each one.

Built with **Vite + TypeScript + Phaser 3**. No accounts, no ads, no
tracking, no network calls during play — it's a static site that also works
offline as an installable PWA.

## Quick start

```bash
npm install
npm run dev       # start the dev server
npm test          # run the vitest suite (pure game-logic tests)
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
```

Open the printed `localhost` URL in a browser. On an iPhone, open it in
Safari, tap Share → "Add to Home Screen" to install it like a native app.

## How to play

1. Pick (or create) your explorer profile on the first screen.
2. On the Rift Map, tap a glowing, unlocked era to jump through the portal.
3. Solve that era's puzzle by experimenting — wrong answers just teach you
   something and let you try again. Tap **Hint 💡** if you're stuck (using a
   hint costs a star).
4. Finishing an era earns 1–3 stars, a museum artifact, and a short "what
   really happened" history/science card.
5. Visit the **Museum** from the map to see every artifact you've found.
   Earn enough total stars across eras to unlock new time-gadget skins.
6. Multiple kids can play on the same device — each has their own save
   under **Switch** on the Rift Map.

See [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) for a kid-friendly version of
these instructions, and [`docs/REBUILD.md`](docs/REBUILD.md) for how the
project is put together and how to extend it.

## What's built

All ten eras are fully playable, each with its own 2.5D parallax art,
animated time-rift transitions, particle effects, synthesized sound effects
(with a mute toggle), hints, scoring, and a historical "what really
happened" card:

- **Ancient Egypt** — match the right building technique (ramp, lever,
  sledge, wet sand) to each block's situation.
- **Ancient Rome** — assemble Roman numeral tiles to crack a sequence of
  numeral locks.
- **Ancient China** — load a Silk Road caravan with the trade good each
  merchant (silk, paper, tea, porcelain) actually wants.
- **Viking Seas** — rotate a star compass to steer by Polaris across
  several legs of a voyage.
- **Medieval Castle** — tune a trebuchet's counterweight and release angle
  (real projectile-motion physics) to hit siege targets.
- **Renaissance Florence** — drag a focal line to the golden-ratio point of
  a canvas, the way Renaissance painters composed their work.
- **American Revolution** — rotate a Culper Ring cipher wheel to decode
  intercepted messages.
- **Industrial Revolution** — set a drive/driven gear ratio to hit a target
  RPM, the same math that powered a steam-driven factory floor.
- **Age of Flight** — slide the 1903 Wright Flyer's airspeed into the
  window where the lift equation clears its weight but doesn't overstress
  the wood-and-fabric frame.
- **Moon Landing** — balance real thrust-to-weight ratio and the
  Tsiolkovsky rocket equation against a fuel slider to reach orbit.

Finish all ten and a **Final Showdown** unlocks: a boss fight against the
Chronarch that cycles through one trial from every era in a row, tracked by
a boss-HP bar and player hearts, reusing each era's own puzzle logic.

Shared systems: multi-profile local save (`localStorage`), era progression
with stars/artifacts/gadget-skin unlocks, a reusable hint system, a swirling
portal scene transition, and a PWA manifest + service worker for offline
installs.

### Possible next steps

- Real CC0/public-domain art or SFX assets could replace/augment the
  procedural visuals (see `CREDITS.md` for how to attribute them).
- Gadget skins currently only change a name/unlock state — give them a
  visible in-game sprite.

## Deploying

`.github/workflows/pages.yml` builds, tests, and deploys `dist/` to GitHub
Pages on every push to `main` — but **GitHub Pages is not enabled** for this
repo yet, so the workflow won't actually publish anything until a repo
admin turns it on (Settings → Pages → Source: GitHub Actions). `vite.config.ts`
already sets `base: '/TimeRift/'` to match a project-pages URL.
