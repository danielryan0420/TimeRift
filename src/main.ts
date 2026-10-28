import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StoryIntroScene } from './scenes/StoryIntroScene';
import { ProfileSelectScene } from './scenes/ProfileSelectScene';
import { HubScene } from './scenes/HubScene';
import { MuseumScene } from './scenes/MuseumScene';
import { EraCompleteScene } from './scenes/EraCompleteScene';
import { BossCompleteScene } from './scenes/BossCompleteScene';
import { EgyptEraScene } from './eras/EgyptEraScene';
import { RomeEraScene } from './eras/RomeEraScene';
import { ChinaEraScene } from './eras/ChinaEraScene';
import { VikingsEraScene } from './eras/VikingsEraScene';
import { CastleEraScene } from './eras/CastleEraScene';
import { FlorenceEraScene } from './eras/FlorenceEraScene';
import { RevolutionEraScene } from './eras/RevolutionEraScene';
import { IndustrialEraScene } from './eras/IndustrialEraScene';
import { FlightEraScene } from './eras/FlightEraScene';
import { MoonEraScene } from './eras/MoonEraScene';
import { BossEraScene } from './eras/BossEraScene';
import { GAME_HEIGHT, GAME_WIDTH } from './ui/theme';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0d0620',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 2,
  },
  scene: [
    BootScene,
    StoryIntroScene,
    ProfileSelectScene,
    HubScene,
    MuseumScene,
    EraCompleteScene,
    BossCompleteScene,
    EgyptEraScene,
    RomeEraScene,
    ChinaEraScene,
    VikingsEraScene,
    CastleEraScene,
    FlorenceEraScene,
    RevolutionEraScene,
    IndustrialEraScene,
    FlightEraScene,
    MoonEraScene,
    BossEraScene,
  ],
});

// Exposed only so Playwright (see scripts/touch-tap-check.mjs) can read the active scene key
// from outside the canvas; the game draws to <canvas> so there's nothing else in the DOM to
// assert against.
(window as unknown as { __timeriftGame: Phaser.Game }).__timeriftGame = game;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline install is a nice-to-have, never block the game on it */
    });
  });
}

// GAME_WIDTH/GAME_HEIGHT pick a portrait-vs-landscape design resolution once at load time.
// If the phone is physically rotated mid-session, reload so layout picks the right one
// again — safe because every save happens through localStorage, not in-memory-only state.
let wasPortrait = window.innerHeight > window.innerWidth;
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait !== wasPortrait) {
      wasPortrait = isPortrait;
      window.location.reload();
    }
  }, 300);
});
