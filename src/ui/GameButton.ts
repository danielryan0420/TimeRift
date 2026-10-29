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

/** Horizontal/vertical breathing room between a button's edge and its label. */
export const BUTTON_PAD_X = 16;
export const BUTTON_PAD_Y = 10;

/** Labels never shrink below this size — smaller than ~16px is hard to read on a phone. */
export const MIN_BUTTON_FONT = 16;

const LINE_HEIGHT_RATIO = 1.2;

export type MeasureTextWidth = (text: string, fontSize: number) => number;

/**
 * Greedy word-wrap: packs as many words per line as fit `maxWidth` at `fontSize`. A single
 * word wider than maxWidth still gets its own line (it can't be split further) — fitLabel
 * compensates for that case by shrinking fontSize, which shrinks the word's measured width too.
 */
export function wrapLines(label: string, maxWidth: number, fontSize: number, measure: MeasureTextWidth): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || measure(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface LabelFit {
  fontSize: number;
  lines: string[];
  lineHeight: number;
  blockHeight: number;
}

/**
 * Finds the largest font size (down to minFontSize) whose wrapped block fits maxHeight. If
 * even minFontSize overflows, returns the wrapped-at-minFontSize result anyway so the caller
 * can grow the button to match blockHeight instead of clipping text.
 */
export function fitLabel(
  label: string,
  maxWidth: number,
  maxHeight: number,
  measure: MeasureTextWidth,
  startFontSize: number,
  minFontSize = MIN_BUTTON_FONT,
): LabelFit {
  const floor = Math.min(startFontSize, minFontSize);
  let fontSize = startFontSize;
  let lines = wrapLines(label, maxWidth, fontSize, measure);
  let lineHeight = fontSize * LINE_HEIGHT_RATIO;
  let blockHeight = lines.length * lineHeight;

  while (fontSize > floor && blockHeight > maxHeight) {
    fontSize -= 1;
    lines = wrapLines(label, maxWidth, fontSize, measure);
    lineHeight = fontSize * LINE_HEIGHT_RATIO;
    blockHeight = lines.length * lineHeight;
  }

  return { fontSize, lines, lineHeight, blockHeight };
}

/** Rough average glyph width used only as a fallback when canvas text measuring is unavailable. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

function makeMeasure(): MeasureTextWidth {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  return (text: string, fontSize: number) => {
    if (!ctx) return estimateTextWidth(text, fontSize);
    ctx.font = `${fontSize}px ${FONT_FAMILY}`;
    const width = ctx.measureText(text).width;
    return width > 0 ? width : estimateTextWidth(text, fontSize);
  };
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
  const minHeight = Math.max(opts.height ?? 56, 44);
  const fillColor = opts.fillColor ?? PALETTE.portalCore;
  const hoverColor = opts.hoverColor ?? PALETTE.portalEdge;
  const startFontSize = opts.fontSize ?? 22;

  const maxTextWidth = Math.max(width - BUTTON_PAD_X * 2, 20);
  const fit = fitLabel(label, maxTextWidth, minHeight - BUTTON_PAD_Y * 2, makeMeasure(), startFontSize);
  const height = Math.max(minHeight, fit.blockHeight + BUTTON_PAD_Y * 2);

  const bg = scene.add.graphics();
  const drawBg = (color: number) => {
    bg.clear();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    bg.lineStyle(3, 0xffffff, 0.25);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
  };
  drawBg(fillColor);

  const text = scene.add.text(0, 0, fit.lines.join('\n'), {
    fontFamily: FONT_FAMILY,
    fontSize: `${fit.fontSize}px`,
    color: opts.textColor ?? PALETTE.textLight,
    align: 'center',
    lineSpacing: fit.lineHeight - fit.fontSize,
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
