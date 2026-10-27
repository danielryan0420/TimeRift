import type { EraId } from '../types';
import { ERA_ORDER } from '../types';

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
