import Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH, IS_PORTRAIT, PALETTE } from './theme';
import { sfx } from '../audio/SoundManager';
import { createButton } from './GameButton';
import { comboMessage, goalBannerText } from '../core/onboarding';

export interface HUDOptions {
  title: string;
  muted: boolean;
  onBack: () => void;
  onHint: () => void;
  onToggleMute: (muted: boolean) => void;
}

/** Height of the top HUD bar; portrait needs a second row since the title no longer fits beside the buttons. */
export const HUD_BAR_HEIGHT = IS_PORTRAIT ? 104 : 56;

export class EraHUD {
  readonly hintButton: Phaser.GameObjects.Container;
  private muteLabel: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private goalText: Phaser.GameObjects.Text;
  private streakText: Phaser.GameObjects.Text;
  private streak = 0;
  private muted: boolean;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, opts: HUDOptions) {
    this.scene = scene;
    this.muted = opts.muted;
    const bar = scene.add.graphics().setDepth(900);
    bar.fillStyle(PALETTE.panelBg, 0.55);
    bar.fillRect(0, 0, GAME_WIDTH, HUD_BAR_HEIGHT);

    scene.add.text(16, 12, opts.title, {
      fontFamily: FONT_FAMILY,
      fontSize: IS_PORTRAIT ? '16px' : '22px',
      color: PALETTE.textLight,
      wordWrap: { width: GAME_WIDTH - 32 },
    }).setDepth(901);

    this.goalText = scene.add.text(16, HUD_BAR_HEIGHT + 6, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.gold,
      wordWrap: { width: GAME_WIDTH - 32 },
    }).setDepth(901);

    this.streakText = scene.add.text(GAME_WIDTH / 2, HUD_BAR_HEIGHT + 60, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.gold,
    }).setOrigin(0.5, 0).setDepth(901).setScale(0);

    const controlsY = IS_PORTRAIT ? 72 : 18;
    this.timerText = scene.add.text(GAME_WIDTH / 2, IS_PORTRAIT ? 48 : 18, '0:00', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: PALETTE.textLight,
    }).setOrigin(0.5, 0).setDepth(901);

    const backX = IS_PORTRAIT ? GAME_WIDTH * 0.24 : GAME_WIDTH - 220;
    const hintX = IS_PORTRAIT ? GAME_WIDTH * 0.76 : GAME_WIDTH - 110;
    createButton(scene, backX, controlsY + 22, '< Back', opts.onBack, { width: 100, height: 40, fontSize: 16 }).setDepth(901);

    this.hintButton = createButton(scene, hintX, controlsY + 22, 'Hint 💡', opts.onHint, { width: 100, height: 40, fontSize: 16 }).setDepth(901);

    this.muteLabel = scene.add.text(IS_PORTRAIT ? GAME_WIDTH - 32 : GAME_WIDTH - 260, IS_PORTRAIT ? 10 : 18, this.muted ? '🔇' : '🔊', {
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

  /** Keeps the current objective visible at all times, so a player never has to guess what to do. */
  setGoal(goal: string): void {
    this.goalText.setText(goalBannerText(goal));
  }

  /** Call with true on a correct answer, false on a mistake, to drive the streak/combo callout. */
  registerStreak(correct: boolean): void {
    this.streak = correct ? this.streak + 1 : 0;
    if (!correct) {
      this.streakText.setScale(0);
      return;
    }
    const message = comboMessage(this.streak);
    if (!message) return;
    this.streakText.setText(message);
    sfx.starPop();
    this.scene.tweens.add({
      targets: this.streakText,
      scale: { from: 0, to: 1 },
      duration: 200,
      ease: 'Back.easeOut',
      yoyo: false,
      onComplete: () => {
        this.scene.time.delayedCall(1100, () => {
          this.scene.tweens.add({ targets: this.streakText, scale: 0, duration: 150 });
        });
      },
    });
  }
}
