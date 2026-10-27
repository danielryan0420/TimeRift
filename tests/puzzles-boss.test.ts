import { describe, expect, it } from 'vitest';
import {
  applyRoundOutcome,
  BOSS_MAX_HP,
  BOSS_ROUND_ORDER,
  currentRoundEra,
  initBossFight,
  isBossDefeated,
  isFightOver,
  isPlayerDefeated,
  PLAYER_MAX_HP,
} from '../src/core/puzzles/boss';
import { ERA_ORDER } from '../src/core/types';

describe('final boss fight state machine', () => {
  it('starts at full hp for both sides on round 0', () => {
    const state = initBossFight();
    expect(state.roundIndex).toBe(0);
    expect(state.bossHp).toBe(BOSS_MAX_HP);
    expect(state.playerHp).toBe(PLAYER_MAX_HP);
    expect(isFightOver(state)).toBe(false);
  });

  it('covers every era exactly once, in chronological order', () => {
    expect(BOSS_ROUND_ORDER).toEqual(ERA_ORDER);
  });

  it('a correct answer damages the boss and advances the round', () => {
    let state = initBossFight();
    state = applyRoundOutcome(state, true);
    expect(state.bossHp).toBe(BOSS_MAX_HP - 1);
    expect(state.roundIndex).toBe(1);
    expect(currentRoundEra(state)).toBe(ERA_ORDER[1]);
  });

  it('a mistake costs the player a heart but does not advance the round', () => {
    let state = initBossFight();
    state = applyRoundOutcome(state, false);
    expect(state.playerHp).toBe(PLAYER_MAX_HP - 1);
    expect(state.roundIndex).toBe(0);
  });

  it('the boss is defeated after enough correct rounds', () => {
    let state = initBossFight();
    for (let i = 0; i < BOSS_MAX_HP; i++) state = applyRoundOutcome(state, true);
    expect(isBossDefeated(state)).toBe(true);
    expect(isFightOver(state)).toBe(true);
    expect(currentRoundEra(state)).toBeNull();
  });

  it('the player is defeated after losing all hearts', () => {
    let state = initBossFight();
    for (let i = 0; i < PLAYER_MAX_HP; i++) state = applyRoundOutcome(state, false);
    expect(isPlayerDefeated(state)).toBe(true);
    expect(isFightOver(state)).toBe(true);
  });

  it('ignores further outcomes once the fight is over', () => {
    let state = initBossFight();
    for (let i = 0; i < PLAYER_MAX_HP; i++) state = applyRoundOutcome(state, false);
    const frozen = state;
    state = applyRoundOutcome(state, true);
    expect(state).toEqual(frozen);
  });
});
