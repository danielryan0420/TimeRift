import { mulberry32 } from '../rng';

/** A drive gear turning a driven gear: output RPM scales by the teeth ratio. */
export interface GearConfig {
  driveTeeth: number;
  drivenTeeth: number;
  inputRpm: number;
}

export function outputRpm(cfg: GearConfig): number {
  return (cfg.inputRpm * cfg.driveTeeth) / cfg.drivenTeeth;
}

export const DRIVE_TEETH_OPTIONS = [10, 20, 30, 40];
export const MIN_DRIVEN_TEETH = 10;
export const MAX_DRIVEN_TEETH = 100;

export interface FactoryOrder {
  id: number;
  inputRpm: number;
  targetRpm: number;
  toleranceRpm: number;
  machine: string;
}

const MACHINES = ['the power loom', 'the spinning frame', 'the drill press', 'the stamping press'];

export function generateOrders(count: number, seed: number): FactoryOrder[] {
  const rand = mulberry32(seed);
  const orders: FactoryOrder[] = [];
  for (let i = 0; i < count; i++) {
    const inputRpm = 80 + Math.floor(rand() * 40);
    const targetRpm = 20 + Math.floor(rand() * 180);
    const toleranceRpm = Math.max(4, 12 - i * 2);
    orders.push({ id: i, inputRpm, targetRpm, toleranceRpm, machine: MACHINES[i % MACHINES.length] });
  }
  return orders;
}

export interface OrderOutcome {
  orderId: number;
  outputRpm: number;
  success: boolean;
  diffRpm: number;
}

export function evaluateOrder(order: FactoryOrder, cfg: Omit<GearConfig, 'inputRpm'>): OrderOutcome {
  const rpm = outputRpm({ ...cfg, inputRpm: order.inputRpm });
  const diffRpm = Math.abs(rpm - order.targetRpm);
  return { orderId: order.id, outputRpm: rpm, success: diffRpm <= order.toleranceRpm, diffRpm };
}

/** Whether some driven-gear setting in range can hit this order with a fixed drive gear. */
export function isOrderSolvable(
  order: FactoryOrder,
  driveTeeth: number,
  minDriven = MIN_DRIVEN_TEETH,
  maxDriven = MAX_DRIVEN_TEETH,
): boolean {
  for (let driven = minDriven; driven <= maxDriven; driven++) {
    if (evaluateOrder(order, { driveTeeth, drivenTeeth: driven }).success) return true;
  }
  return false;
}

/**
 * Boss trials fix the drive gear (no era-style gear picker), which occasionally makes a
 * randomly rolled order mathematically unreachable within the driven-gear slider's range.
 * Reroll with a derived seed until the order is solvable, so the trial never soft-locks.
 */
export function generateSolvableOrder(seed: number, driveTeeth: number): FactoryOrder {
  let order = generateOrders(1, seed)[0];
  let attempt = 1;
  while (!isOrderSolvable(order, driveTeeth) && attempt < 50) {
    order = generateOrders(1, seed + attempt * 7919)[0];
    attempt += 1;
  }
  return order;
}
