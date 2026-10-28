import Phaser from 'phaser';

/** A translucent "target zone" band drawn on a horizontal track, between two 0..1 ratios. */
export function drawZoneBand(
  scene: Phaser.Scene,
  trackX: number,
  trackY: number,
  trackW: number,
  loRatio: number,
  hiRatio: number,
  height = 16,
  color = 0x5ee37a,
): Phaser.GameObjects.Rectangle {
  const lo = Phaser.Math.Clamp(Math.min(loRatio, hiRatio), 0, 1);
  const hi = Phaser.Math.Clamp(Math.max(loRatio, hiRatio), 0, 1);
  const x = trackX + lo * trackW;
  const w = Math.max(4, (hi - lo) * trackW);
  return scene.add.rectangle(x + w / 2, trackY, w, height, color, 0.3);
}

/** A thin vertical tick marking a single threshold value on a horizontal track. */
export function drawThresholdTick(
  scene: Phaser.Scene,
  trackX: number,
  trackY: number,
  trackW: number,
  ratio: number,
  height = 24,
  color = 0xffd34d,
): Phaser.GameObjects.Rectangle {
  const r = Phaser.Math.Clamp(ratio, 0, 1);
  return scene.add.rectangle(trackX + r * trackW, trackY, 4, height, color, 0.9);
}
