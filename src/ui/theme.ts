import type { EraId } from '../core/types';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 600;

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
  vikings: { name: 'Viking Seas', skyTop: 0x16213a, skyBottom: 0x3c5c7a, accent: 0x7ad1e0, ground: 0x1b3a4b },
  castle: { name: 'Medieval Castle', skyTop: 0x4a5a73, skyBottom: 0x8a9bb0, accent: 0x9a7b4f, ground: 0x4f5d4f },
  florence: { name: 'Renaissance Florence', skyTop: 0xf6d9a0, skyBottom: 0xeab676, accent: 0xb5422e, ground: 0xc9a876 },
  revolution: { name: 'American Revolution', skyTop: 0x2b4d6b, skyBottom: 0x7d9bb0, accent: 0xb22234, ground: 0x5a4632 },
  industrial: { name: 'Industrial Revolution', skyTop: 0x5c5a52, skyBottom: 0x938f80, accent: 0xc77b2e, ground: 0x3a3a3a },
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
