import { describe, expect, it } from 'vitest';
import { HintTracker } from '../src/core/hints';

describe('HintTracker', () => {
  const hints = [
    { level: 1, text: 'Look at the shape of the gap.' },
    { level: 2, text: 'Try a lever for tight spaces.' },
  ];

  it('reveals hints in order and tracks usage count', () => {
    const tracker = new HintTracker(hints);
    expect(tracker.hasMore).toBe(true);
    expect(tracker.next()?.text).toBe('Look at the shape of the gap.');
    expect(tracker.usedCount).toBe(1);
    expect(tracker.next()?.text).toBe('Try a lever for tight spaces.');
    expect(tracker.hasMore).toBe(false);
    expect(tracker.next()).toBeNull();
  });

  it('resets usage count', () => {
    const tracker = new HintTracker(hints);
    tracker.next();
    tracker.reset();
    expect(tracker.usedCount).toBe(0);
    expect(tracker.hasMore).toBe(true);
  });
});
