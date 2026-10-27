import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { deltaV, evaluateLaunch, thrustToWeightRatio, type RocketConfig } from '../core/puzzles/moon';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { burstError, burstSuccess } from '../ui/particles';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { skyGradient, starField } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

interface Mission {
  label: string;
  dryMassKg: number;
  requiredDeltaVMs: number;
}

const MISSIONS: Mission[] = [
  { label: 'Test Hop', dryMassKg: 4000, requiredDeltaVMs: 2600 },
  { label: 'Orbit Insertion', dryMassKg: 5000, requiredDeltaVMs: 3200 },
  { label: 'Trans-Lunar Injection', dryMassKg: 6000, requiredDeltaVMs: 3700 },
];

const ENGINES = [
  { id: 'small', label: 'Small', thrustN: 900_000 },
  { id: 'medium', label: 'Medium', thrustN: 1_600_000 },
  { id: 'large', label: 'Large', thrustN: 2_400_000 },
];

const EXHAUST_VELOCITY = 3000;
const MAX_FUEL = 24_000;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 120 };

const SLIDER_X = GAME_WIDTH / 2 - 220;
const SLIDER_Y = 420;
const SLIDER_W = 440;

export class MoonEraScene extends Phaser.Scene {
  private missionIndex = 0;
  private fuelMassKg = 8000;
  private engineIndex = 1;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private locked = false;
  private draggingSlider = false;

  private missionText!: Phaser.GameObjects.Text;
  private twrText!: Phaser.GameObjects.Text;
  private deltaVText!: Phaser.GameObjects.Text;
  private fuelText!: Phaser.GameObjects.Text;
  private sliderHandle!: Phaser.GameObjects.Arc;
  private engineButtons: Phaser.GameObjects.Container[] = [];

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

    new EraHUD(this, {
      title: 'Moon Landing: Balance the Launch',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.missionText = this.add.text(GAME_WIDTH / 2, 76, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 640 },
    }).setOrigin(0.5);

    this.drawEngineButtons();
    this.drawFuelSlider();

    this.twrText = this.add.text(GAME_WIDTH / 2, 490, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);
    this.deltaVText = this.add.text(GAME_WIDTH / 2, 515, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, '🚀 Launch!', () => this.launch(), { width: 220, height: 52 });

    this.startMission();
    portalIn(this);
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

  private drawEngineButtons(): void {
    this.engineButtons.forEach((b) => b.destroy());
    this.engineButtons = [];
    const spacing = 160;
    const startX = GAME_WIDTH / 2 - spacing;
    ENGINES.forEach((engine, i) => {
      const selected = i === this.engineIndex;
      const btn = createButton(
        this,
        startX + i * spacing,
        140,
        `${engine.label} Engine`,
        () => {
          this.engineIndex = i;
          this.drawEngineButtons();
          this.updateReadouts();
        },
        { width: 150, height: 48, fontSize: 15, fillColor: selected ? PALETTE.portalEdge : PALETTE.portalCore },
      );
      this.engineButtons.push(btn);
    });
  }

  private drawFuelSlider(): void {
    this.add.text(GAME_WIDTH / 2, 190, 'Choose an engine, then set the fuel load:', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    const track = this.add.rectangle(SLIDER_X + SLIDER_W / 2, SLIDER_Y, SLIDER_W, 10, 0x4a3f66).setStrokeStyle(2, 0xffffff, 0.3);
    track.setInteractive();

    this.sliderHandle = this.add.circle(SLIDER_X, SLIDER_Y, 18, 0xffd34d).setStrokeStyle(3, 0xffffff, 0.6).setInteractive({ useHandCursor: true, draggable: true });

    this.fuelText = this.add.text(GAME_WIDTH / 2, 365, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    }).setOrigin(0.5);

    this.add.text(SLIDER_X, SLIDER_Y + 30, 'Empty', { fontFamily: FONT_FAMILY, fontSize: '13px', color: PALETTE.textMuted }).setOrigin(0.5);
    this.add.text(SLIDER_X + SLIDER_W, SLIDER_Y + 30, 'Full Tank', { fontFamily: FONT_FAMILY, fontSize: '13px', color: PALETTE.textMuted }).setOrigin(0.5, 0).setX(SLIDER_X + SLIDER_W - 30);

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
    this.twrText.setText(`Thrust/Weight: ${twr.toFixed(2)} ${twr > 1 ? '✅ liftoff' : '❌ too heavy'}`);
    this.twrText.setColor(twr > 1 ? PALETTE.success : PALETTE.danger);
    this.deltaVText.setText(`Delta-V: ${Math.round(dv)} m/s (need ${required} m/s) ${dv >= required ? '✅' : '❌'}`);
    this.deltaVText.setColor(dv >= required ? PALETTE.success : PALETTE.danger);
  }

  private startMission(): void {
    const mission = MISSIONS[this.missionIndex];
    this.missionText.setText(`Mission ${this.missionIndex + 1} of ${MISSIONS.length}: ${mission.label}\nNeed Delta-V ≥ ${mission.requiredDeltaVMs} m/s with Thrust/Weight > 1.`);
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

    if (result.success) {
      sfx.success();
      burstSuccess(this, GAME_WIDTH / 2, GAME_HEIGHT - 120, 0xd8d8e8);
      this.missionIndex += 1;
      if (this.missionIndex >= MISSIONS.length) {
        this.locked = true;
        this.time.delayedCall(600, () => this.finish());
      } else {
        this.time.delayedCall(500, () => this.startMission());
      }
    } else {
      sfx.error();
      this.mistakes += 1;
      burstError(this, GAME_WIDTH / 2, GAME_HEIGHT - 120);
      showToast(this, result.reason, PALETTE.danger);
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
