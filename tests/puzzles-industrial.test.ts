import { describe, expect, it } from 'vitest';
import { evaluateOrder, generateOrders, outputRpm } from '../src/core/puzzles/industrial';

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
