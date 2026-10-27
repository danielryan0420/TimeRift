import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  evaluateFlight,
  generateAttempts,
  liftForceN,
  MAX_SLIDER_SPEED_MS,
  type FlightAttempt,
} from '../core/puzzles/flight';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { burstError, burstSuccess } from '../ui/particles';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { skyGradient } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const ATTEMPT_COUNT = 3;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 90 };
const SLIDER_X = GAME_WIDTH / 2 - 220;
const SLIDER_Y = 420;
const SLIDER_W = 440;

export class FlightEraScene extends Phaser.Scene {
  private attempts: FlightAttempt[] = [];
  private index = 0;
  private airspeedMs = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private locked = false;
  private draggingSlider = false;

  private attemptText!: Phaser.GameObjects.Text;
  private readoutText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private sliderHandle!: Phaser.GameObjects.Arc;
  private flyer!: Phaser.GameObjects.Container;

  constructor() {
    super('FlightEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.attempts = generateAttempts(ATTEMPT_COUNT, Math.floor(Math.random() * 1e9));
    this.index = 0;
    this.airspeedMs = 0;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    new EraHUD(this, {
      title: 'Age of Flight: Get the Flyer Airborne',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.attemptText = this.add.text(GAME_WIDTH / 2, 76, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5);

    this.drawFlyer();
    this.drawSlider();

    this.readoutText = this.add.text(GAME_WIDTH / 2, 490, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, '🛫 Take Off!', () => this.takeOff(), { width: 220, height: 52 });

    this.startAttempt();
    portalIn(this);
  }

  private drawBackground(): void {
    const theme = ERA_THEME.flight;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    const dunes = this.add.graphics();
    dunes.fillStyle(theme.ground, 1);
    dunes.beginPath();
    dunes.moveTo(0, GAME_HEIGHT);
    dunes.lineTo(0, 520);
    for (let x = 0; x <= GAME_WIDTH; x += 30) {
      dunes.lineTo(x, 520 + Math.sin(x * 0.015) * 14);
    }
    dunes.lineTo(GAME_WIDTH, GAME_HEIGHT);
    dunes.closePath();
    dunes.fillPath();
  }

  private drawFlyer(): void {
    this.flyer = this.add.container(GAME_WIDTH / 2 - 260, 230);
    const g = this.add.graphics();
    g.fillStyle(0x4a3826, 1);
    g.fillRect(-60, -6, 120, 10);
    g.fillRect(-60, -46, 120, 10);
    g.lineStyle(4, 0x2a1e14, 1);
    g.strokeLineShape(new Phaser.Geom.Line(-50, -6, -50, -46));
    g.strokeLineShape(new Phaser.Geom.Line(50, -6, 50, -46));
    g.fillStyle(0x6a5030, 1);
    g.fillRect(-18, -30, 36, 24);
    g.fillStyle(0x2a2a2a, 1);
    g.fillCircle(66, -36, 10);
    this.flyer.add(g);
    this.tweens.add({ targets: this.flyer, y: 222, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawSlider(): void {
    this.add.text(GAME_WIDTH / 2, 190, 'Set the airspeed (engine throttle + headwind):', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    const track = this.add.rectangle(SLIDER_X + SLIDER_W / 2, SLIDER_Y, SLIDER_W, 10, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.3).setInteractive();
    this.sliderHandle = this.add.circle(SLIDER_X, SLIDER_Y, 18, 0x3b5f8a).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(18, 18, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });

    this.speedText = this.add.text(GAME_WIDTH / 2, 365, '', { fontFamily: FONT_FAMILY, fontSize: '18px', color: PALETTE.gold }).setOrigin(0.5);

    this.add.text(SLIDER_X, SLIDER_Y + 30, 'Standing still', { fontFamily: FONT_FAMILY, fontSize: '13px', color: PALETTE.textMuted }).setOrigin(0.5);
    this.add.text(SLIDER_X + SLIDER_W, SLIDER_Y + 30, 'Full throttle', { fontFamily: FONT_FAMILY, fontSize: '13px', color: PALETTE.textMuted }).setOrigin(0.5, 0).setX(SLIDER_X + SLIDER_W - 35);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.draggingSlider || this.locked) return;
      this.setSpeedFromX(pointer.x);
    });
    this.input.on('pointerup', () => { this.draggingSlider = false; });
    this.sliderHandle.on('pointerdown', () => { this.draggingSlider = true; });
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.draggingSlider = true;
      this.setSpeedFromX(pointer.x);
    });

    this.updateSliderVisual();
  }

  private setSpeedFromX(x: number): void {
    const clamped = Phaser.Math.Clamp(x, SLIDER_X, SLIDER_X + SLIDER_W);
    const ratio = (clamped - SLIDER_X) / SLIDER_W;
    this.airspeedMs = Math.round((ratio * MAX_SLIDER_SPEED_MS) * 2) / 2;
    this.updateSliderVisual();
    this.updateReadout();
  }

  private updateSliderVisual(): void {
    const ratio = this.airspeedMs / MAX_SLIDER_SPEED_MS;
    this.sliderHandle.setX(SLIDER_X + ratio * SLIDER_W);
    this.speedText.setText(`Airspeed: ${this.airspeedMs.toFixed(1)} m/s`);
  }

  private currentAttempt(): FlightAttempt {
    return this.attempts[this.index];
  }

  private updateReadout(): void {
    const attempt = this.currentAttempt();
    if (!attempt) return;
    const liftN = liftForceN({ airspeedMs: this.airspeedMs, wingAreaM2: attempt.wingAreaM2, liftCoefficient: attempt.liftCoefficient });
    const liftOk = liftN >= attempt.weightN;
    const speedOk = this.airspeedMs <= attempt.maxSafeSpeedMs;
    this.readoutText.setText(
      `Lift: ${liftN.toFixed(0)} N (need ${attempt.weightN.toFixed(0)} N) ${liftOk ? '✅' : '❌'}  |  Frame limit: ${attempt.maxSafeSpeedMs} m/s ${speedOk ? '✅' : '❌'}`,
    );
    this.readoutText.setColor(liftOk && speedOk ? PALETTE.success : PALETTE.danger);
  }

  private startAttempt(): void {
    const attempt = this.currentAttempt();
    this.airspeedMs = 0;
    this.updateSliderVisual();
    this.attemptText.setText(
      `Attempt ${this.index + 1} of ${ATTEMPT_COUNT}: ${attempt.windLabel}. Get enough lift without overstressing the frame.`,
    );
    this.hints = new HintTracker([
      { level: 1, text: 'Lift grows with the square of airspeed — small speed increases matter a lot.' },
      { level: 2, text: `Try somewhere between ${attempt.minSpeedMs} and ${attempt.maxSafeSpeedMs} m/s.` },
    ]);
    this.updateReadout();
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this attempt!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private takeOff(): void {
    if (this.locked) return;
    const attempt = this.currentAttempt();
    const outcome = evaluateFlight(attempt, this.airspeedMs);

    if (outcome.success) {
      sfx.success();
      burstSuccess(this, this.flyer.x, this.flyer.y, 0x3b5f8a);
      this.index += 1;
      if (this.index >= ATTEMPT_COUNT) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.time.delayedCall(500, () => this.startAttempt());
      }
    } else {
      sfx.error();
      this.mistakes += 1;
      burstError(this, this.flyer.x, this.flyer.y);
      const reason = outcome.tooSlow ? "Not enough lift — the Flyer won't leave the ground." : 'Too fast — the wood-and-fabric frame is shaking apart!';
      showToast(this, reason, PALETTE.danger);
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
      eraId: 'flight',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'The real Wright Flyer, December 17, 1903',
        body: "The 1903 Wright Flyer weighed about 274 kg (605 lbs) and flew just 36.5 meters on its first flight — shorter than a modern airliner's wingspan — at roughly 10.9 km/h groundspeed. The Wrights' real breakthrough was control: wing-warping, a steerable rudder, and an elevator let a pilot balance on all three axes, which is what every aircraft still does today.",
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
