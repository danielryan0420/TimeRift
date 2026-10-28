import type { EraId } from '../types';
import { ERA_ORDER } from '../types';
import type { HintDef } from '../hints';
import { TOOL_INFO, type BlockChallenge, type BlockSituation } from './egypt';
import { GOOD_INFO, type CaravanRequest, type CaravanStop } from './china';
import type { VoyageLeg } from './vikings';
import type { SiegeTarget } from './castle';
import type { CanvasChallenge } from './florence';
import type { CipherChallenge } from './revolution';
import { MAX_DRIVEN_TEETH, MIN_DRIVEN_TEETH, outputRpm, type FactoryOrder } from './industrial';
import type { FlightAttempt } from './flight';
import { toRoman } from './rome';

/** The final showdown cycles through one puzzle round per era, in chronological order. */
export const BOSS_ROUND_ORDER: EraId[] = ERA_ORDER;
export const BOSS_MAX_HP = BOSS_ROUND_ORDER.length;
export const PLAYER_MAX_HP = 5;

export interface BossState {
  roundIndex: number;
  bossHp: number;
  playerHp: number;
}

export function initBossFight(): BossState {
  return { roundIndex: 0, bossHp: BOSS_MAX_HP, playerHp: PLAYER_MAX_HP };
}

export function currentRoundEra(state: BossState): EraId | null {
  return state.roundIndex < BOSS_ROUND_ORDER.length ? BOSS_ROUND_ORDER[state.roundIndex] : null;
}

export function isBossDefeated(state: BossState): boolean {
  return state.bossHp <= 0;
}

export function isPlayerDefeated(state: BossState): boolean {
  return state.playerHp <= 0;
}

export function isFightOver(state: BossState): boolean {
  return isBossDefeated(state) || isPlayerDefeated(state);
}

/** A correct answer chips the boss and advances the round; a mistake costs the player a heart. */
export function applyRoundOutcome(state: BossState, success: boolean): BossState {
  if (isFightOver(state)) return state;
  if (success) {
    return {
      ...state,
      bossHp: Math.max(0, state.bossHp - 1),
      roundIndex: Math.min(state.roundIndex + 1, BOSS_ROUND_ORDER.length),
    };
  }
  return { ...state, playerHp: Math.max(0, state.playerHp - 1) };
}

/** One-line reminder of how to interact with each trial, shown when its round starts. */
export const BOSS_ROUND_HOWTO: Record<EraId, string> = {
  egypt: 'Tap the tool that matches the situation below.',
  rome: 'Tap numeral tiles in order, then tap Open Lock.',
  china: 'Tap the trade good the caravan is asking for.',
  vikings: 'Drag inside the dial to aim toward the clue.',
  castle: 'Drag the slider to set the counterweight, then Fire.',
  florence: 'Drag the line left or right, then set the composition.',
  revolution: 'Drag inside the wheel until the green preview reads clearly.',
  industrial: 'Drag the slider to set the driven gear, then Engage.',
  flight: 'Drag the slider to set airspeed, then Take Off.',
  moon: 'Drag the slider to set fuel, then Launch.',
};

/** The current objective for the HUD goal banner, specific to whichever trial is active. */
export const BOSS_ROUND_GOAL: Record<EraId, string> = {
  egypt: 'Pick the right tool to break this round\'s shield.',
  rome: 'Build the Roman numeral lock, then open it.',
  china: 'Load the trade good this merchant demands.',
  vikings: 'Steer to the bearing Polaris points out.',
  castle: 'Set the counterweight to hit the target.',
  florence: 'Drag the focal line to the golden ratio spot.',
  revolution: 'Rotate the wheel to decode the message.',
  industrial: 'Set the driven gear to hit the target RPM.',
  flight: 'Set a safe airspeed that gives enough lift.',
  moon: 'Set the fuel load to reach escape velocity safely.',
};

const BOSS_EGYPT_SITUATION_HINT: Record<BlockSituation, string> = {
  'steep-rise': 'Think about something long and gently sloped...',
  'tight-gap': 'Think about something short you can pry with...',
  'long-haul': 'Think about reducing friction on sand...',
  'final-lift': 'Think about something short you can pry with...',
};

const BOSS_CHINA_REQUEST_HINT: Record<CaravanRequest, string> = {
  'scholar-baghdad': 'Think about something thin you can write on...',
  'noble-rome': 'Think about something woven from a shimmering thread...',
  'trader-persia': 'Think about dried leaves brewed into a drink...',
  'merchant-venice': 'Think about fine, fired clay...',
};

/**
 * Two-level hints for each boss trial: a conceptual nudge first, then the concrete answer.
 * Mirrors the per-era HintTracker content so a player who's stuck in the final fight gets the
 * same kind of help they got the first time they met that skill.
 */
export function egyptBossHints(block: BlockChallenge): HintDef[] {
  return [
    { level: 1, text: BOSS_EGYPT_SITUATION_HINT[block.situation] },
    { level: 2, text: `Use the ${TOOL_INFO[block.correctTool].label}!` },
  ];
}

export function romeBossHints(target: number): HintDef[] {
  return [
    { level: 1, text: `It uses ${toRoman(target).length} symbols.` },
    { level: 2, text: `The answer is ${toRoman(target)}.` },
  ];
}

export function chinaBossHints(stop: CaravanStop): HintDef[] {
  return [
    { level: 1, text: BOSS_CHINA_REQUEST_HINT[stop.request] },
    { level: 2, text: `Offer the ${GOOD_INFO[stop.correctGood].label}!` },
  ];
}

export function vikingsBossHints(leg: VoyageLeg): HintDef[] {
  return [
    { level: 1, text: 'Drag inside the dial to rotate the needle toward the clue.' },
    { level: 2, text: `Aim for about ${leg.targetBearing}°.` },
  ];
}

export function castleBossHints(target: SiegeTarget): HintDef[] {
  return [
    { level: 1, text: "A bigger counterweight sends the shot farther (the angle's locked this round)." },
    { level: 2, text: `Aim for about ${target.targetDistanceM} m of range.` },
  ];
}

export function florenceBossHints(canvas: CanvasChallenge): HintDef[] {
  return [
    { level: 1, text: 'The golden ratio splits the frame unevenly — favor one side.' },
    { level: 2, text: `Aim for about ${Math.round(canvas.targetXPx)}px from the left edge.` },
  ];
}

export function revolutionBossHints(cipher: CipherChallenge): HintDef[] {
  return [
    { level: 1, text: 'Watch the green decoded preview as you turn the wheel.' },
    { level: 2, text: `The shift is ${cipher.shift}.` },
  ];
}

/** Searches the full driven-gear range for the setting closest to the order's target RPM. */
function bestDrivenTeeth(order: FactoryOrder, driveTeeth: number): number {
  let best = MIN_DRIVEN_TEETH;
  let bestDiff = Infinity;
  for (let driven = MIN_DRIVEN_TEETH; driven <= MAX_DRIVEN_TEETH; driven++) {
    const diff = Math.abs(outputRpm({ inputRpm: order.inputRpm, driveTeeth, drivenTeeth: driven }) - order.targetRpm);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = driven;
    }
  }
  return best;
}

export function industrialBossHints(order: FactoryOrder, driveTeeth: number): HintDef[] {
  return [
    { level: 1, text: 'Output RPM = input RPM × drive teeth ÷ driven teeth.' },
    { level: 2, text: `Try about ${bestDrivenTeeth(order, driveTeeth)} driven teeth.` },
  ];
}

export function flightBossHints(attempt: FlightAttempt): HintDef[] {
  return [
    { level: 1, text: 'Lift grows with speed squared, but too much speed breaks the frame.' },
    { level: 2, text: `Try somewhere between ${attempt.minSpeedMs} and ${attempt.maxSafeSpeedMs} m/s.` },
  ];
}

export function moonBossHints(mission: { dryMassKg: number; requiredDeltaVMs: number; exhaustVelocityMs: number }): HintDef[] {
  const neededFuelKg = Math.round(mission.dryMassKg * (Math.exp(mission.requiredDeltaVMs / mission.exhaustVelocityMs) - 1));
  return [
    { level: 1, text: 'More fuel adds delta-v, but also adds weight — it can tip the thrust/weight ratio below 1!' },
    { level: 2, text: `Try around ${neededFuelKg.toLocaleString()} kg of fuel.` },
  ];
}
