# TIME RIFT

A time-traveling history & science adventure built for curious middle
schoolers. A villain has shattered the timeline — jump through swirling
time rifts to eras like Ancient Egypt, Rome, the Viking seas, and the Moon
landing, and mend each one by solving puzzles woven into real history and
science (not quizzes): pick the right tool to raise a pyramid block, crack
a Roman numeral vault lock, steer a longship by the North Star, and balance
thrust against fuel to launch a rocket.

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

## What's built in this pass

Four fully playable eras, each with its own 2.5D parallax art, animated
time-rift transitions, particle effects, synthesized sound effects (with a
mute toggle), hints, scoring, and a historical "what really happened" card:

- **Ancient Egypt** — match the right building technique (ramp, lever,
  sledge, wet sand) to each block's situation.
- **Ancient Rome** — assemble Roman numeral tiles to crack a sequence of
  numeral locks.
- **Viking Seas** — rotate a star compass to steer by Polaris across
  several legs of a voyage.
- **Moon Landing** — balance real thrust-to-weight ratio and the
  Tsiolkovsky rocket equation against a fuel slider to reach orbit.

Shared systems: multi-profile local save (`localStorage`), era progression
with stars/artifacts/gadget-skin unlocks, a reusable hint system, a swirling
portal scene transition, and a PWA manifest + service worker for offline
installs.

### Next steps (not yet built)

Four more eras are stubbed as "Coming soon" on the map and share the same
engine, so they follow the pattern in `docs/REBUILD.md`:

- Medieval Castle, Renaissance Florence, the American Revolution, the
  Industrial Revolution.
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
