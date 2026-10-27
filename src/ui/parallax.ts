import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './theme';

interface Layer {
  container: Phaser.GameObjects.Container;
  factor: number;
}

/** A handful of depth layers that drift at different speeds as the pointer moves, for a cheap 2.5D feel. */
export class ParallaxBackground {
  private layers: Layer[] = [];

  constructor(private scene: Phaser.Scene) {
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
  }

  addLayer(factor: number, depth: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0).setDepth(depth);
    this.layers.push({ container, factor });
    return container;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const nx = Phaser.Math.Clamp(pointer.x / GAME_WIDTH - 0.5, -0.5, 0.5);
    for (const layer of this.layers) {
      const targetX = -nx * layer.factor * 40;
      this.scene.tweens.add({
        targets: layer.container,
        x: targetX,
        duration: 400,
        ease: 'Sine.easeOut',
      });
    }
  }
}

export function skyGradient(scene: Phaser.Scene, top: number, bottom: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  return g;
}

export function starField(scene: Phaser.Scene, count: number, areaHeight = GAME_HEIGHT * 0.6): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  for (let i = 0; i < count; i++) {
    const x = Phaser.Math.Between(0, GAME_WIDTH);
    const y = Phaser.Math.Between(0, areaHeight);
    const star = scene.add.circle(x, y, Phaser.Math.FloatBetween(0.6, 1.8), 0xffffff, Phaser.Math.FloatBetween(0.4, 1));
    container.add(star);
    scene.tweens.add({
      targets: star,
      alpha: { from: star.alpha, to: 0.2 },
      duration: Phaser.Math.Between(900, 2200),
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 1500),
    });
  }
  return container;
}
