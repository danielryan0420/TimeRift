import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from './theme';
import { sfx } from '../audio/SoundManager';

const CX = GAME_WIDTH / 2;
const CY = GAME_HEIGHT / 2;
const MAX_R = Math.hypot(GAME_WIDTH, GAME_HEIGHT) / 2 + 40;

function drawSwirl(g: Phaser.GameObjects.Graphics, radius: number, rotation: number): void {
  g.clear();
  g.fillStyle(0x05010f, 1);
  g.fillCircle(CX, CY, radius);
  const rings = 5;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const r = radius * (0.25 + t * 0.7);
    g.lineStyle(6 - i, i % 2 === 0 ? PALETTE.portalCore : PALETTE.portalEdge, 0.8 - t * 0.4);
    g.beginPath();
    g.arc(CX, CY, Math.max(r, 1), rotation + t * 2, rotation + t * 2 + Math.PI * 1.4);
    g.strokePath();
  }
}

/** Swirling time-rift portal that grows to cover the screen, then invokes onCovered. */
export function portalOut(scene: Phaser.Scene, onCovered: () => void): void {
  sfx.portal();
  const g = scene.add.graphics().setDepth(10000);
  const state = { r: 0, rot: 0 };
  scene.tweens.add({
    targets: state,
    r: MAX_R,
    rot: Math.PI * 2.5,
    duration: 650,
    ease: 'Cubic.easeIn',
    onUpdate: () => drawSwirl(g, state.r, state.rot),
    onComplete: () => {
      g.destroy();
      onCovered();
    },
  });
}

/** Call at the start of a new scene to reveal it by shrinking the portal away. */
export function portalIn(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(10000);
  const state = { r: MAX_R, rot: 0 };
  drawSwirl(g, state.r, state.rot);
  scene.tweens.add({
    targets: state,
    r: 0,
    rot: Math.PI * 1.2,
    duration: 650,
    ease: 'Cubic.easeOut',
    onUpdate: () => drawSwirl(g, state.r, state.rot),
    onComplete: () => g.destroy(),
  });
}
