import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { ProfileSelectScene } from './scenes/ProfileSelectScene';
import { HubScene } from './scenes/HubScene';
import { MuseumScene } from './scenes/MuseumScene';
import { EraCompleteScene } from './scenes/EraCompleteScene';
import { EgyptEraScene } from './eras/EgyptEraScene';
import { RomeEraScene } from './eras/RomeEraScene';
import { VikingsEraScene } from './eras/VikingsEraScene';
import { MoonEraScene } from './eras/MoonEraScene';
import { GAME_HEIGHT, GAME_WIDTH } from './ui/theme';

new Phaser.Game({
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
    ProfileSelectScene,
    HubScene,
    MuseumScene,
    EraCompleteScene,
    EgyptEraScene,
    RomeEraScene,
    VikingsEraScene,
    MoonEraScene,
  ],
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline install is a nice-to-have, never block the game on it */
    });
  });
}
