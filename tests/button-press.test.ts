import { describe, expect, it, vi } from 'vitest';
import { attachPressFeedback } from '../src/ui/buttonPress';

function fakeEmitter() {
  const handlers: Record<string, () => void> = {};
  return {
    on(event: string, handler: () => void) {
      handlers[event] = handler;
    },
    fire(event: 'pointerdown' | 'pointerup' | 'pointerupoutside') {
      handlers[event]?.();
    },
  };
}

describe('attachPressFeedback', () => {
  it('activates on pointerup and resets the visual scale', () => {
    const interactive = fakeEmitter();
    const visual = { setScale: vi.fn() };
    const onActivate = vi.fn();

    attachPressFeedback(interactive, visual, onActivate);

    interactive.fire('pointerdown');
    expect(visual.setScale).toHaveBeenLastCalledWith(0.95);

    interactive.fire('pointerup');
    expect(visual.setScale).toHaveBeenLastCalledWith(1);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('never scales the interactive object itself, only the visual', () => {
    const interactive = fakeEmitter();
    const visual = { setScale: vi.fn() };
    const interactiveSetScale = vi.fn();
    // Simulate what would happen if someone re-introduced container.setScale(...) on the
    // interactive object: attachPressFeedback must not call it under any event.
    (interactive as unknown as { setScale: typeof interactiveSetScale }).setScale = interactiveSetScale;

    attachPressFeedback(interactive, visual, vi.fn());

    interactive.fire('pointerdown');
    interactive.fire('pointerup');
    interactive.fire('pointerupoutside');

    expect(interactiveSetScale).not.toHaveBeenCalled();
  });

  it('resets the visual scale but does not activate when the finger lifts off the button', () => {
    const interactive = fakeEmitter();
    const visual = { setScale: vi.fn() };
    const onActivate = vi.fn();

    attachPressFeedback(interactive, visual, onActivate);

    interactive.fire('pointerdown');
    interactive.fire('pointerupoutside');

    expect(visual.setScale).toHaveBeenLastCalledWith(1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('supports a custom press scale', () => {
    const interactive = fakeEmitter();
    const visual = { setScale: vi.fn() };

    attachPressFeedback(interactive, visual, vi.fn(), 0.8);

    interactive.fire('pointerdown');
    expect(visual.setScale).toHaveBeenLastCalledWith(0.8);
  });
});
