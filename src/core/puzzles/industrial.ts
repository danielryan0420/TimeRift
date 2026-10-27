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
