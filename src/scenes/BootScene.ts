import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { hasSeenIntro } from '../core/intro';
import { ensureParticleTexture } from '../ui/particles';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    ensureParticleTexture(this);
    if (!this.registry.has(GAME_STATE_KEY)) {
      this.registry.set(GAME_STATE_KEY, new GameState());
    }

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0620).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'TIME RIFT', {
      fontFamily: FONT_FAMILY,
      fontSize: '56px',
      color: PALETTE.gold,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Loading the timeline...', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    this.time.delayedCall(400, () => this.scene.start(hasSeenIntro() ? 'ProfileSelect' : 'StoryIntro'));
  }
}
