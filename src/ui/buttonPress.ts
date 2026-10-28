/**
 * Press/release feedback wiring, kept separate from Phaser so the activation logic can be
 * unit tested without a canvas. Critically, `onActivate` only fires on `pointerup` (finger
 * lifted while still over the button) and the press-scale is applied to `visual`, never to
 * `interactive` itself: Phaser re-hit-tests `interactive` against its *current* transform at
 * release time, so shrinking the interactive object on press would shrink the hit area a
 * finger has to land back inside of to register the tap — exactly the kind of few-pixel miss
 * a touch tap (as opposed to a precise mouse click) is prone to.
 */
export interface PressEmitter {
  on(event: 'pointerdown' | 'pointerup' | 'pointerupoutside', handler: () => void): void;
}

export interface Scalable {
  setScale(scale: number): void;
}

export function attachPressFeedback(
  interactive: PressEmitter,
  visual: Scalable,
  onActivate: () => void,
  pressScale = 0.95,
): void {
  interactive.on('pointerdown', () => visual.setScale(pressScale));
  interactive.on('pointerup', () => {
    visual.setScale(1);
    onActivate();
  });
  interactive.on('pointerupoutside', () => visual.setScale(1));
}
