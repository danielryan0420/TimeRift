import Phaser from 'phaser';

const SPARK_TEXTURE = 'fx-spark';

/** Generates a small soft circle texture once per game instance, reused for all particle effects. */
export function ensureParticleTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists(SPARK_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture(SPARK_TEXTURE, 16, 16);
    g.destroy();
  }
  return SPARK_TEXTURE;
}

export function burstSuccess(scene: Phaser.Scene, x: number, y: number, tint = 0xffd34d): void {
  const texture = ensureParticleTexture(scene);
  const emitter = scene.add.particles(x, y, texture, {
    speed: { min: 80, max: 220 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.1, end: 0 },
    lifespan: 700,
    quantity: 24,
    tint,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(24);
  scene.time.delayedCall(800, () => emitter.destroy());
}

const CONFETTI_TINTS = [0xffd34d, 0x5ee37a, 0x22d3ee, 0xff6b6b, 0x7c3aed];

/** A big celebratory burst across the top of the screen for era/boss completion. */
export function burstConfetti(scene: Phaser.Scene, width: number): void {
  const texture = ensureParticleTexture(scene);
  for (const tint of CONFETTI_TINTS) {
    const emitter = scene.add.particles(0, 0, texture, {
      x: { min: 0, max: width },
      y: -10,
      speedY: { min: 120, max: 260 },
      speedX: { min: -60, max: 60 },
      scale: { start: 0.9, end: 0.2 },
      lifespan: 1600,
      quantity: 10,
      tint,
      rotate: { min: 0, max: 360 },
      gravityY: 220,
    });
    emitter.explode(10);
    scene.time.delayedCall(1800, () => emitter.destroy());
  }
}

export function burstError(scene: Phaser.Scene, x: number, y: number): void {
  const texture = ensureParticleTexture(scene);
  const emitter = scene.add.particles(x, y, texture, {
    speed: { min: 30, max: 90 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.6, end: 0 },
    lifespan: 450,
    quantity: 10,
    tint: 0xff6b6b,
  });
  emitter.explode(10);
  scene.time.delayedCall(500, () => emitter.destroy());
}
