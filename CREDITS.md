# Credits

## Art & Audio

Every visual in TIME RIFT — skies, dunes, pyramids, columns, ships, compass
dials, moon dust, particles, portals, icons — is drawn procedurally at
runtime with Phaser's Graphics API and a few generated textures. No external
image, font, or audio files are used.

All sound effects (clicks, success chimes, error buzzes, the portal whoosh)
are synthesized on the fly with the Web Audio API in
[`src/audio/SoundManager.ts`](src/audio/SoundManager.ts). There is nothing to
license or credit for art/audio because nothing was downloaded — this also
keeps the game fully offline-capable and network-free at play time, per the
project requirements.

If real CC0/public-domain art or audio assets are added later, list them
here with their source and license, e.g.:

```
- `public/sfx/example.ogg` — "Example Sound" by Author, CC0, https://example.com
```

## Code & Libraries

- [Phaser 3](https://phaser.io/) — MIT License — the game engine.
- [Vite](https://vitejs.dev/) — MIT License — build tool / dev server.
- [Vitest](https://vitest.dev/) — MIT License — test runner.
- [TypeScript](https://www.typescriptlang.org/) — Apache-2.0 License.

## Fonts

UI text uses the system font stack (`'Baloo 2', 'Comic Sans MS', system-ui,
sans-serif`) so no font files are downloaded at runtime. If `Baloo 2` isn't
installed on a device, it falls back gracefully.
