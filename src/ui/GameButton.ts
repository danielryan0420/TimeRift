import Phaser from 'phaser';
import { FONT_FAMILY, PALETTE } from './theme';
import { sfx } from '../audio/SoundManager';
import { attachPressFeedback } from './buttonPress';

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

  // Press-scale feedback is applied to this inner `visual` container, never to the outer
  // `container` that holds the hit area. Phaser re-hit-tests the interactive object against
  // its *current* transform on pointerup, so scaling the interactive object itself on
  // pointerdown would shrink the hit area a finger has to land back inside of to register the
  // tap — on a touch screen that few-pixel-smaller target reliably ate taps near the edge.
  const visual = scene.add.container(0, 0, [bg, text]);

  const container = scene.add.container(x, y, [visual]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  container.on('pointerover', () => drawBg(hoverColor));
  container.on('pointerout', () => drawBg(fillColor));

  attachPressFeedback(container, visual, () => {
    sfx.click();
    onClick();
  });

  // Callers that need to update the label after creation (see StoryIntroScene) should use
  // this instead of reaching into the container's children by index — that structure is an
  // implementation detail and has already changed once (see buttonPress.ts).
  container.setData('labelText', text);

  return container;
}

export function getButtonLabel(button: Phaser.GameObjects.Container): Phaser.GameObjects.Text {
  return button.getData('labelText') as Phaser.GameObjects.Text;
}
