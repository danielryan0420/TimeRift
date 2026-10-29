import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  deltaV,
  evaluateLaunch,
  thrustToWeightRatio,
  totalMass,
  ENGINES,
  EXHAUST_VELOCITY_MS,
  MAX_FUEL_KG,
  MAX_STRUCTURAL_MASS_KG,
  MISSIONS,
  type RocketConfig,
} from '../core/puzzles/moon';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { drawThresholdTick } from '../ui/zoneMeter';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, TOP_SHIFT, PALETTE, fitWidth } from '../ui/theme';
import { skyGradient, starField } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const EXHAUST_VELOCITY = EXHAUST_VELOCITY_MS;
const MAX_FUEL = MAX_FUEL_KG;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 120 };

const SLIDER_W = IS_PORTRAIT ? GAME_WIDTH - 80 : 440;
const SLIDER_X = GAME_WIDTH / 2 - SLIDER_W / 2;
const SLIDER_Y = 420 + TOP_SHIFT;

const ROCKET_X = IS_PORTRAIT ? GAME_WIDTH / 2 : 150;
const ROCKET_BASE_Y = IS_PORTRAIT ? SLIDER_Y + 150 : 460;
const BAR_W = IS_PORTRAIT ? GAME_WIDTH - 140 : 320;
const BAR_X = GAME_WIDTH / 2 - BAR_W / 2 + (IS_PORTRAIT ? 20 : 0);
const PUSH_BAR_Y = IS_PORTRAIT ? ROCKET_BASE_Y + 90 : 470;
const FUEL_BAR_Y = IS_PORTRAIT ? PUSH_BAR_Y + 40 : 505;
const MAX_TWR_SCALE = 3;
const MAX_DV_SCALE = 6000;
const COLOR_SUCCESS = 0x5ee37a;
const COLOR_DANGER = 0xff6b6b;

export class MoonEraScene extends Phaser.Scene {
  private missionIndex = 0;
  private fuelMassKg = 8000;
  private engineIndex = 1;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private hud!: EraHUD;
  private locked = false;
  private draggingSlider = false;

  private missionText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private fuelText!: Phaser.GameObjects.Text;
  private sliderHandle!: Phaser.GameObjects.Arc;
  private engineButtons: Phaser.GameObjects.Container[] = [];
  private rocket!: Phaser.GameObjects.Container;
  private pushFill!: Phaser.GameObjects.Rectangle;
  private fuelFill!: Phaser.GameObjects.Rectangle;
  private fuelTick?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('MoonEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.missionIndex = 0;
    this.fuelMassKg = 8000;
    this.engineIndex = 1;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    this.hud = new EraHUD(this, {
      title: 'Moon Landing: Balance the Launch',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });
    this.hud.setGoal('Light up both gauges green, 3 times.');

    // Cleared against the HUD's actual goal-banner bottom (see CastleEraScene for why a
    // fixed offset isn't enough on the wide desktop canvas).
    this.missionText = this.add.text(GAME_WIDTH / 2, Math.max(76 + TOP_SHIFT, this.hud.goalBottom + 14), '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: fitWidth(640) },
    }).setOrigin(0.5);

    this.drawRocket();
    this.drawEngineButtons();
    this.drawFuelSlider();
    this.drawGauges();

    const statusY = IS_PORTRAIT ? FUEL_BAR_Y + 35 : 522;
    this.statusText = this.add.text(GAME_WIDTH / 2, statusY, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, '🚀 Launch!', () => this.launch(), { width: 220, height: 52 });

    this.startMission();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'Balance the Launch',
      line: 'Pick an engine and drag the fuel slider so your Thrust-to-weight ratio (whether your push is strong enough to beat gravity) is over 1 and your Delta-V (total speed change the rocket can produce) meets the mission need, then tap Launch!',
      quiz: {
        question: 'Quick check: what happens if you add too much fuel?',
        options: [
          { label: 'The rocket gets heavier and may not be able to lift off', correct: true },
          { label: 'Nothing changes' },
          { label: 'The engine gets stronger automatically' },
        ],
      },
      onDismiss: () => {},
    });
  }

  private drawBackground(): void {
    const theme = ERA_THEME.moon;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    starField(this, 100);
    const ground = this.add.graphics();
    ground.fillStyle(theme.ground, 1);
    ground.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT + 80, GAME_WIDTH * 1.4, 220);
    for (let i = 0; i < 8; i++) {
      ground.fillStyle(0x6a6a7a, 0.6);
      ground.fillCircle(80 + i * 120, GAME_HEIGHT - 40 + (i % 2) * 10, 14);
    }
  }

  private drawRocket(): void {
    this.rocket = this.add.container(ROCKET_X, ROCKET_BASE_Y);
    const g = this.add.graphics();
    g.fillStyle(0xd8d8e8, 1);
    g.fillRect(-16, -110, 32, 100);
    g.fillStyle(0xff6b6b, 1);
    g.fillTriangle(-16, -110, 16, -110, 0, -140);
    g.fillStyle(0x9a7b4f, 1);
    g.fillTriangle(-16, -16, -16, -46, -34, -16);
    g.fillTriangle(16, -16, 16, -46, 34, -16);
    g.fillStyle(0x3b5f8a, 1);
    g.fillCircle(0, -70, 9);
    this.rocket.add(g);
  }

  private drawGauges(): void {
    this.add.text(BAR_X - 10, PUSH_BAR_Y, 'Push', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(1, 0.5);
    this.add.rectangle(BAR_X + BAR_W / 2, PUSH_BAR_Y, BAR_W, 14, 0x2a2a2a).setStrokeStyle(2, 0xffffff, 0.25);
    this.pushFill = this.add.rectangle(BAR_X, PUSH_BAR_Y, 2, 10, COLOR_DANGER).setOrigin(0, 0.5);
    drawThresholdTick(this, BAR_X, PUSH_BAR_Y, BAR_W, 1 / MAX_TWR_SCALE, 22);

    // "Fuel" (not "Fuel reach") so this right-anchored label never grows past the canvas's
    // left edge in portrait, where BAR_X sits close to x=0.
    this.add.text(BAR_X - 10, FUEL_BAR_Y, 'Fuel', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(1, 0.5);
    this.add.rectangle(BAR_X + BAR_W / 2, FUEL_BAR_Y, BAR_W, 14, 0x2a2a2a).setStrokeStyle(2, 0xffffff, 0.25);
    this.fuelFill = this.add.rectangle(BAR_X, FUEL_BAR_Y, 2, 10, COLOR_DANGER).setOrigin(0, 0.5);
  }

  private drawEngineButtons(): void {
    this.engineButtons.forEach((b) => b.destroy());
    this.engineButtons = [];
    const n = ENGINES.length;
    const width = IS_PORTRAIT ? Math.min(150, (GAME_WIDTH - 32 - 10 * (n - 1)) / n) : 150;
    const spacing = width + 10;
    const startX = GAME_WIDTH / 2 - (spacing * (n - 1)) / 2;
    ENGINES.forEach((engine, i) => {
      const selected = i === this.engineIndex;
      const btn = createButton(
        this,
        startX + i * spacing,
        140 + TOP_SHIFT,
        `${engine.label} Engine`,
        () => {
          this.engineIndex = i;
          this.drawEngineButtons();
          this.updateReadouts();
        },
        { width, height: 48, fontSize: 16, fillColor: selected ? PALETTE.portalEdge : PALETTE.portalCore },
      );
      this.engineButtons.push(btn);
    });
  }

  private drawFuelSlider(): void {
    this.add.text(GAME_WIDTH / 2, 190 + TOP_SHIFT, 'Choose an engine, then set the fuel load:', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: fitWidth(640) },
    }).setOrigin(0.5);

    const track = this.add.rectangle(SLIDER_X + SLIDER_W / 2, SLIDER_Y, SLIDER_W, 10, 0x4a3f66).setStrokeStyle(2, 0xffffff, 0.3);
    track.setInteractive();

    this.sliderHandle = this.add.circle(SLIDER_X, SLIDER_Y, 18, 0xffd34d).setStrokeStyle(3, 0xffffff, 0.6).setInteractive({ useHandCursor: true, draggable: true });

    this.fuelText = this.add.text(GAME_WIDTH / 2, 365 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    }).setOrigin(0.5);

    this.add.text(SLIDER_X, SLIDER_Y + 30, 'Empty', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(0.5);
    this.add.text(SLIDER_X + SLIDER_W, SLIDER_Y + 30, 'Full Tank', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(0.5, 0).setX(SLIDER_X + SLIDER_W - 30);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.draggingSlider || this.locked) return;
      this.setFuelFromX(pointer.x);
    });
    this.input.on('pointerup', () => {
      this.draggingSlider = false;
    });
    this.sliderHandle.on('pointerdown', () => {
      this.draggingSlider = true;
    });
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.draggingSlider = true;
      this.setFuelFromX(pointer.x);
    });

    this.updateSliderVisual();
  }

  private setFuelFromX(x: number): void {
    const clamped = Phaser.Math.Clamp(x, SLIDER_X, SLIDER_X + SLIDER_W);
    const ratio = (clamped - SLIDER_X) / SLIDER_W;
    this.fuelMassKg = Math.round((ratio * MAX_FUEL) / 200) * 200;
    this.updateSliderVisual();
    this.updateReadouts();
  }

  private updateSliderVisual(): void {
    const ratio = this.fuelMassKg / MAX_FUEL;
    this.sliderHandle.setX(SLIDER_X + ratio * SLIDER_W);
    this.fuelText.setText(`Fuel: ${this.fuelMassKg.toLocaleString()} kg`);
  }

  private currentConfig(): RocketConfig {
    const mission = MISSIONS[this.missionIndex];
    return {
      thrustN: ENGINES[this.engineIndex].thrustN,
      dryMassKg: mission.dryMassKg,
      fuelMassKg: this.fuelMassKg,
      exhaustVelocityMs: EXHAUST_VELOCITY,
    };
  }

  private updateReadouts(): void {
    const cfg = this.currentConfig();
    const twr = thrustToWeightRatio(cfg);
    const dv = deltaV(cfg);
    const required = MISSIONS[this.missionIndex].requiredDeltaVMs;
    const overweight = totalMass(cfg) > MAX_STRUCTURAL_MASS_KG;

    const twrRatio = Phaser.Math.Clamp(twr / MAX_TWR_SCALE, 0, 1);
    this.pushFill.setSize(Math.max(2, twrRatio * BAR_W), 10);
    this.pushFill.setFillStyle(twr > 1 && !overweight ? COLOR_SUCCESS : COLOR_DANGER);

    const dvRatio = Phaser.Math.Clamp(dv / MAX_DV_SCALE, 0, 1);
    this.fuelFill.setSize(Math.max(2, dvRatio * BAR_W), 10);
    this.fuelFill.setFillStyle(dv >= required ? COLOR_SUCCESS : COLOR_DANGER);

    if (overweight) {
      this.statusText.setText('🪨 Too heavy for the launch frame — use less fuel.');
      this.statusText.setColor(PALETTE.danger);
    } else if (twr <= 1) {
      this.statusText.setText('🪫 Not enough push to lift off — try a bigger engine.');
      this.statusText.setColor(PALETTE.danger);
    } else if (dv < required) {
      this.statusText.setText('⛽ Good push, but not enough fuel to reach the Moon.');
      this.statusText.setColor(PALETTE.danger);
    } else {
      this.statusText.setText('🚀 Ready for liftoff!');
      this.statusText.setColor(PALETTE.success);
    }
  }

  private startMission(): void {
    const mission = MISSIONS[this.missionIndex];
    this.missionText.setText(`Mission ${this.missionIndex + 1} of ${MISSIONS.length}: ${mission.label}\nNeed Delta-V ≥ ${mission.requiredDeltaVMs} m/s with Thrust/Weight > 1.`);
    this.rocket.setPosition(ROCKET_X, ROCKET_BASE_Y).setAngle(0).setAlpha(1);
    this.fuelTick?.destroy();
    this.fuelTick = drawThresholdTick(this, BAR_X, FUEL_BAR_Y, BAR_W, mission.requiredDeltaVMs / MAX_DV_SCALE, 22);
    this.updateReadouts();
    this.hints = new HintTracker([
      { level: 1, text: 'More fuel adds delta-v, but also adds weight — it can tip the thrust/weight ratio below 1!' },
      { level: 2, text: 'A bigger engine raises thrust/weight without changing delta-v as much.' },
    ]);
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this mission!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private launch(): void {
    if (this.locked) return;
    const cfg = this.currentConfig();
    const mission = MISSIONS[this.missionIndex];
    const result = evaluateLaunch(cfg, mission.requiredDeltaVMs);

    this.tweens.killTweensOf(this.rocket);
    if (result.success) {
      sfx.success();
      this.hud.registerStreak(true);
      burstSuccess(this, this.rocket.x, this.rocket.y - 30, 0xd8d8e8);
      this.tweens.add({ targets: this.rocket, y: ROCKET_BASE_Y - 480, duration: 900, ease: 'Cubic.easeIn' });
      this.missionIndex += 1;
      if (this.missionIndex >= MISSIONS.length) {
        this.locked = true;
        this.time.delayedCall(900, () => this.finish());
      } else {
        this.time.delayedCall(900, () => this.startMission());
      }
    } else {
      sfx.error();
      this.hud.registerStreak(false);
      this.mistakes += 1;
      if (result.liftoff) {
        this.tweens.add({
          targets: this.rocket,
          y: ROCKET_BASE_Y - 130,
          duration: 350,
          ease: 'Sine.easeOut',
          yoyo: true,
          hold: 150,
          onComplete: () => burstError(this, this.rocket.x, this.rocket.y),
        });
      } else {
        burstError(this, this.rocket.x, this.rocket.y - 60);
        this.tweens.add({ targets: this.rocket, x: { from: ROCKET_X - 5, to: ROCKET_X + 5 }, duration: 60, yoyo: true, repeat: 6, onComplete: () => this.rocket.setX(ROCKET_X) });
      }
      showToast(this, result.reason, PALETTE.danger);
      const autoHint = this.hints.registerMistake();
      if (autoHint) {
        this.hintsUsedTotal += 1;
        this.time.delayedCall(2300, () => showToast(this, `💡 ${autoHint.text}`, PALETTE.gold));
      }
    }
  }

  private finish(): void {
    const timeSeconds = (this.time.now - this.startTime) / 1000;
    const result: EraAttemptResult = {
      mistakes: this.mistakes,
      hintsUsed: this.hintsUsedTotal,
      timeSeconds,
    };
    const data: EraCompleteData = {
      eraId: 'moon',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'The real Apollo 11 launch',
        body: "The Saturn V rocket's first stage produced about 7.5 million pounds of thrust and burned through over 2,000,000 kg of fuel in under 3 minutes just to beat gravity — the same thrust-to-weight and rocket-equation tradeoffs you just balanced!",
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
