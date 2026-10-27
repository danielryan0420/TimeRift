import Phaser from 'phaser';
import { createButton } from './GameButton';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from './theme';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

/** A Phaser-rendered Yes/No modal, used where a destructive action needs confirmation. */
export function showConfirmDialog(scene: Phaser.Scene, options: ConfirmDialogOptions): void {
  const panelW = 420;
  const panelH = 220;

  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setOrigin(0);
  dim.setInteractive();

  const panel = scene.add.graphics();
  panel.fillStyle(PALETTE.panelBg, 1);
  panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
  panel.lineStyle(3, PALETTE.panelLine, 0.6);
  panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);

  const title = scene.add.text(0, -panelH / 2 + 36, options.title, {
    fontFamily: FONT_FAMILY,
    fontSize: '24px',
    color: PALETTE.textLight,
  }).setOrigin(0.5);

  const message = scene.add.text(0, -8, options.message, {
    fontFamily: FONT_FAMILY,
    fontSize: '18px',
    color: PALETTE.textMuted,
    align: 'center',
    wordWrap: { width: panelW - 56 },
  }).setOrigin(0.5);

  const container = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2, [panel, title, message]);

  const close = () => {
    dim.destroy();
    container.destroy(true);
  };

  const cancelBtn = createButton(scene, -96, panelH / 2 - 42, 'Cancel', () => {
    close();
    options.onCancel?.();
  }, { width: 150, height: 48, fillColor: 0x2a2140, hoverColor: 0x3a3160 });

  const confirmBtn = createButton(scene, 96, panelH / 2 - 42, options.confirmLabel ?? 'Confirm', () => {
    close();
    options.onConfirm();
  }, { width: 150, height: 48, fillColor: 0x5a2140, hoverColor: 0x8a2a50 });

  container.add([cancelBtn, confirmBtn]);

  dim.on('pointerup', () => {
    close();
    options.onCancel?.();
  });
}
