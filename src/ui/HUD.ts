import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH, PALETTE } from './theme';
import { sfx } from '../audio/SoundManager';
import { createButton } from './GameButton';

export interface HUDOptions {
  title: string;
  muted: boolean;
  onBack: () => void;
  onHint: () => void;
  onToggleMute: (muted: boolean) => void;
}

export class EraHUD {
  readonly hintButton: Phaser.GameObjects.Container;
  private muteLabel: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private muted: boolean;

  constructor(scene: Phaser.Scene, opts: HUDOptions) {
    this.muted = opts.muted;
    const bar = scene.add.graphics().setDepth(900);
    bar.fillStyle(PALETTE.panelBg, 0.55);
    bar.fillRect(0, 0, GAME_WIDTH, 56);

    scene.add.text(16, 16, opts.title, {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: PALETTE.textLight,
    }).setDepth(901);

    this.timerText = scene.add.text(GAME_WIDTH / 2, 18, '0:00', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: PALETTE.textLight,
    }).setOrigin(0.5, 0).setDepth(901);

    createButton(scene, GAME_WIDTH - 220, 28, '< Back', opts.onBack, { width: 100, height: 40, fontSize: 16 }).setDepth(901);

    this.hintButton = createButton(scene, GAME_WIDTH - 110, 28, 'Hint 💡', opts.onHint, { width: 100, height: 40, fontSize: 16 }).setDepth(901);

    this.muteLabel = scene.add.text(GAME_WIDTH - 260, 18, this.muted ? '🔇' : '🔊', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
    }).setDepth(901).setInteractive({ useHandCursor: true });
    this.muteLabel.on('pointerup', () => {
      this.muted = !this.muted;
      this.muteLabel.setText(this.muted ? '🔇' : '🔊');
      sfx.setMuted(this.muted);
      opts.onToggleMute(this.muted);
    });
  }

  setTimer(seconds: number): void {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.timerText.setText(`${m}:${s.toString().padStart(2, '0')}`);
  }
}
