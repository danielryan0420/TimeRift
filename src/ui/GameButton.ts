import Phaser from 'phaser';
import { FONT_FAMILY, PALETTE } from './theme';
import { sfx } from '../audio/SoundManager';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  fillColor?: number;
  hoverColor?: number;
  textColor?: string;
}

/** A rounded, touch-friendly (min 44px tall) button with press feedback and a click sound. */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const width = opts.width ?? 220;
  const height = Math.max(opts.height ?? 56, 44);
  const fillColor = opts.fillColor ?? PALETTE.portalCore;
  const hoverColor = opts.hoverColor ?? PALETTE.portalEdge;

  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const drawBg = (color: number) => {
    bg.clear();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    bg.lineStyle(3, 0xffffff, 0.25);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
  };
  drawBg(fillColor);

  const text = scene.add.text(0, 0, label, {
    fontFamily: FONT_FAMILY,
    fontSize: `${opts.fontSize ?? 22}px`,
    color: opts.textColor ?? PALETTE.textLight,
  }).setOrigin(0.5);

  container.add([bg, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  container.on('pointerover', () => drawBg(hoverColor));
  container.on('pointerout', () => drawBg(fillColor));
  container.on('pointerdown', () => container.setScale(0.95));
  container.on('pointerup', () => {
    container.setScale(1);
    sfx.click();
    onClick();
  });

  return container;
}
