import { describe, expect, it } from 'vitest';
import {
  evaluateOrder,
  generateOrders,
  generateSolvableOrder,
  isOrderSolvable,
  outputRpm,
} from '../src/core/puzzles/industrial';

describe('gear ratio factory floor', () => {
  it('computes output rpm as inputRpm * driveTeeth / drivenTeeth', () => {
    expect(outputRpm({ inputRpm: 100, driveTeeth: 20, drivenTeeth: 40 })).toBeCloseTo(50, 5);
    expect(outputRpm({ inputRpm: 90, driveTeeth: 30, drivenTeeth: 10 })).toBeCloseTo(270, 5);
  });

  it('generates deterministic orders for a given seed', () => {
    const a = generateOrders(5, 21);
    const b = generateOrders(5, 21);
    expect(a).toEqual(b);
  });

  it('tightens tolerance on later orders', () => {
    const orders = generateOrders(4, 21);
    expect(orders[3].toleranceRpm).toBeLessThanOrEqual(orders[0].toleranceRpm);
  });

  it('evaluateOrder reports success within tolerance and failure outside it', () => {
    const [order] = generateOrders(1, 9);
    const exactDriven = (order.inputRpm * 20) / order.targetRpm;
    const good = evaluateOrder(order, { driveTeeth: 20, drivenTeeth: exactDriven });
    expect(good.success).toBe(true);
    const bad = evaluateOrder(order, { driveTeeth: 10, drivenTeeth: 100 });
    expect(bad.success).toBe(order.targetRpm === outputRpm({ inputRpm: order.inputRpm, driveTeeth: 10, drivenTeeth: 100 }));
  });
});

describe('boss trial solvability (fixed drive gear, no gear picker)', () => {
  it('a raw roll can be unreachable with drive gear fixed at 20 teeth (regression guard)', () => {
    // Low input + high target is the known bad zone: input=80, target=199 needs
    // output >= 187, but with driveTeeth=20 the max reachable output at drivenTeeth=10
    // is only 160 — unreachable regardless of driven-gear slider position.
    const order = { id: 0, inputRpm: 80, targetRpm: 199, toleranceRpm: 12, machine: 'test' };
    expect(isOrderSolvable(order, 20)).toBe(false);
  });

  it('generateSolvableOrder always returns a solvable order for a fixed drive gear', () => {
    for (let seed = 0; seed < 500; seed++) {
      const order = generateSolvableOrder(seed, 20);
      expect(isOrderSolvable(order, 20)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(generateSolvableOrder(42, 20)).toEqual(generateSolvableOrder(42, 20));
  });
});
