import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from './theme';

let activeToast: Phaser.GameObjects.Text | undefined;

export function showToast(scene: Phaser.Scene, message: string, color = PALETTE.textLight): void {
  activeToast?.destroy();
  activeToast = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, message, {
    fontFamily: FONT_FAMILY,
    fontSize: '16px',
    color,
    backgroundColor: '#1a0b2ecc',
    padding: { x: 14, y: 8 },
    align: 'center',
    wordWrap: { width: GAME_WIDTH - 120 },
  }).setOrigin(0.5).setDepth(950);
  scene.time.delayedCall(2200, () => {
    activeToast?.destroy();
    activeToast = undefined;
  });
}
