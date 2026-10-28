import type { EraId } from '../core/types';

/**
 * The game's virtual (design) resolution. Landscape/desktop keeps the original 960x600
 * the whole game was designed against. Portrait phones get their own, taller design
 * resolution close to a real iPhone's aspect ratio (~0.46-0.56) so Phaser.Scale.FIT
 * scales the canvas up close to 1:1 instead of shrinking a 960-wide landscape canvas
 * down to a sliver — that shrink-to-fit is what made every font/button look tiny.
 */
function computeGameSize(): { width: number; height: number } {
  const w = typeof window !== 'undefined' ? window.innerWidth : 960;
  const h = typeof window !== 'undefined' ? window.innerHeight : 600;
  if (h > w) return { width: 440, height: 920 };
  return { width: 960, height: 600 };
}

const SIZE = computeGameSize();
export const GAME_WIDTH = SIZE.width;
export const GAME_HEIGHT = SIZE.height;
export const IS_PORTRAIT = GAME_HEIGHT > GAME_WIDTH;

/** Clamp a desktop-sized panel/card width down so it never overflows the portrait canvas. */
export function fitWidth(desired: number, margin = 40): number {
  return Math.min(desired, GAME_WIDTH - margin);
}

/**
 * Extra vertical offset era scenes should add to their "just below the HUD" content row.
 * Portrait's HUD is a taller two-row bar (see EraHUD) and its wrapped goal text can run to
 * 2-3 lines, so anything placed right under it needs to move down to stay clear.
 */
export const TOP_SHIFT = IS_PORTRAIT ? 130 : 0;

/** Multiply hand-tuned, landscape-sized (960px-wide) decorative x-coordinates by this to keep them on-canvas in portrait. */
export const WIDTH_SCALE = GAME_WIDTH / 960;

export interface EraTheme {
  name: string;
  skyTop: number;
  skyBottom: number;
  accent: number;
  ground: number;
}

export const ERA_THEME: Record<EraId, EraTheme> = {
  egypt: { name: 'Ancient Egypt', skyTop: 0xf7c873, skyBottom: 0xe88a3c, accent: 0xffd34d, ground: 0xc8964b },
  rome: { name: 'Ancient Rome', skyTop: 0x8fc6e8, skyBottom: 0xdce9f0, accent: 0xd94f3d, ground: 0xb8a98a },
  china: { name: 'Ancient China', skyTop: 0xffb199, skyBottom: 0xc9433a, accent: 0xd4af37, ground: 0x7a5a3c },
  vikings: { name: 'Viking Seas', skyTop: 0x16213a, skyBottom: 0x3c5c7a, accent: 0x7ad1e0, ground: 0x1b3a4b },
  castle: { name: 'Medieval Castle', skyTop: 0x4a5a73, skyBottom: 0x8a9bb0, accent: 0x9a7b4f, ground: 0x4f5d4f },
  florence: { name: 'Renaissance Florence', skyTop: 0xf6d9a0, skyBottom: 0xeab676, accent: 0xb5422e, ground: 0xc9a876 },
  revolution: { name: 'American Revolution', skyTop: 0x2b4d6b, skyBottom: 0x7d9bb0, accent: 0xb22234, ground: 0x5a4632 },
  industrial: { name: 'Industrial Revolution', skyTop: 0x5c5a52, skyBottom: 0x938f80, accent: 0xc77b2e, ground: 0x3a3a3a },
  flight: { name: 'Age of Flight', skyTop: 0xaee3f5, skyBottom: 0xe8e3c9, accent: 0x3b5f8a, ground: 0xd8c99a },
  moon: { name: 'Moon Landing', skyTop: 0x05051a, skyBottom: 0x1a1a3d, accent: 0xd8d8e8, ground: 0x8a8a9a },
};

export const PALETTE = {
  portalCore: 0x7c3aed,
  portalEdge: 0x22d3ee,
  panelBg: 0x1a0b2e,
  panelLine: 0x7c3aed,
  textLight: '#f5f0ff',
  textMuted: '#b9a8dd',
  gold: '#ffd34d',
  success: '#5ee37a',
  danger: '#ff6b6b',
};

export const FONT_FAMILY = "'Baloo 2', 'Comic Sans MS', system-ui, sans-serif";
