import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  evaluateFlight,
  flightHints,
  generateAttempts,
  LEARN_GOAL,
  MAX_SLIDER_SPEED_MS,
  type FlightAttempt,
} from '../core/puzzles/flight';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { drawZoneBand } from '../ui/zoneMeter';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, TOP_SHIFT, PALETTE, fitWidth } from '../ui/theme';
import { skyGradient } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const ATTEMPT_COUNT = 3;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 90 };
const SLIDER_W = IS_PORTRAIT ? GAME_WIDTH - 80 : 440;
const SLIDER_X = GAME_WIDTH / 2 - SLIDER_W / 2;
const SLIDER_Y = 420 + TOP_SHIFT;
const FLYER_START_X = GAME_WIDTH / 2 - (IS_PORTRAIT ? 90 : 260);
const FLYER_TAKEOFF_DX = IS_PORTRAIT ? 160 : 420;

export class FlightEraScene extends Phaser.Scene {
  private attempts: FlightAttempt[] = [];
  private index = 0;
  private airspeedMs = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private hud!: EraHUD;
  private locked = false;
  private draggingSlider = false;

  private attemptText!: Phaser.GameObjects.Text;
  private readoutText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private sliderHandle!: Phaser.GameObjects.Arc;
  private flyer!: Phaser.GameObjects.Container;
  private flyerBaseY = 230 + TOP_SHIFT;
  private zoneBand?: Phaser.GameObjects.Rectangle;

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

    this.hud = new EraHUD(this, {
      title: 'Age of Flight: Get the Flyer Airborne',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });
    this.hud.setGoal('Hit the green zone 3 times.');

    // Cleared against the HUD's actual goal-banner bottom (see CastleEraScene for why a
    // fixed offset isn't enough on the wide desktop canvas).
    this.attemptText = this.add.text(GAME_WIDTH / 2, Math.max(76 + TOP_SHIFT, this.hud.goalBottom + 14), '', {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: fitWidth(700) },
    }).setOrigin(0.5);

    this.drawFlyer();
    this.drawSlider();

    this.readoutText = this.add.text(GAME_WIDTH / 2, 490 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, '🛫 Take Off!', () => this.takeOff(), { width: 220, height: 52 });

    this.startAttempt();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'Get the Flyer Airborne',
      learnGoal: LEARN_GOAL,
      line: 'Drag the airspeed slider until you get enough lift (the upward push that beats gravity) to leave the ground, but not so fast that the frame breaks — then tap Take Off!',
      quiz: {
        question: 'Quick check: what happens to lift as airspeed increases?',
        options: [
          { label: 'Lift grows a lot — it depends on speed squared', correct: true },
          { label: 'Lift stays exactly the same' },
          { label: 'Lift shrinks' },
        ],
      },
      onDismiss: () => {},
    });
  }

  private drawBackground(): void {
    const theme = ERA_THEME.flight;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    const dunes = this.add.graphics();
    dunes.fillStyle(theme.ground, 1);
    dunes.beginPath();
    dunes.moveTo(0, GAME_HEIGHT);
    const duneTop = IS_PORTRAIT ? SLIDER_Y + 90 : 520;
    dunes.lineTo(0, duneTop);
    for (let x = 0; x <= GAME_WIDTH; x += 30) {
      dunes.lineTo(x, duneTop + Math.sin(x * 0.015) * 14);
    }
    dunes.lineTo(GAME_WIDTH, GAME_HEIGHT);
    dunes.closePath();
    dunes.fillPath();
  }

  private drawFlyer(): void {
    this.flyer = this.add.container(FLYER_START_X, this.flyerBaseY);
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
    this.startIdleBob();
  }

  private startIdleBob(): void {
    this.tweens.killTweensOf(this.flyer);
    this.tweens.add({ targets: this.flyer, y: this.flyerBaseY - 8, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawSlider(): void {
    // Grouped with the slider it labels (SLIDER_Y - 90), not floating mid-stage: at the old
    // fixed 190 + TOP_SHIFT, this text's full width (no wordWrap — also fixed here) landed
    // squarely on top of the Flyer graphic, which sits centered on the stage above the slider.
    this.add.text(GAME_WIDTH / 2, SLIDER_Y - 90, 'Set the airspeed (engine throttle + headwind):', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: fitWidth(640), useAdvancedWrap: true },
    }).setOrigin(0.5);

    const track = this.add.rectangle(SLIDER_X + SLIDER_W / 2, SLIDER_Y, SLIDER_W, 10, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.3).setInteractive();
    this.sliderHandle = this.add.circle(SLIDER_X, SLIDER_Y, 18, 0x3b5f8a).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(18, 18, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });

    this.speedText = this.add.text(GAME_WIDTH / 2, 365 + TOP_SHIFT, '', { fontFamily: FONT_FAMILY, fontSize: '18px', color: PALETTE.gold }).setOrigin(0.5);

    // Left-anchored (origin.x = 0) at 16px so "Standing still" grows right under the track
    // instead of centering on SLIDER_X and running off the canvas's left edge in portrait.
    this.add.text(SLIDER_X, SLIDER_Y + 30, 'Standing still', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(0, 0.5);
    this.add.text(SLIDER_X + SLIDER_W, SLIDER_Y + 30, 'Full throttle', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(1, 0);

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
    const outcome = evaluateFlight(attempt, this.airspeedMs);
    if (outcome.success) {
      this.readoutText.setText('🎯 Just right!');
      this.readoutText.setColor(PALETTE.success);
    } else if (outcome.tooSlow) {
      this.readoutText.setText('🐌 Too slow — not enough lift yet.');
      this.readoutText.setColor(PALETTE.danger);
    } else {
      this.readoutText.setText('💨 Too fast — the frame is shaking!');
      this.readoutText.setColor(PALETTE.danger);
    }
  }

  private startAttempt(): void {
    const attempt = this.currentAttempt();
    this.airspeedMs = 0;
    this.updateSliderVisual();
    this.attemptText.setText(
      `Attempt ${this.index + 1} of ${ATTEMPT_COUNT}: ${attempt.windLabel}. Get enough lift without overstressing the frame.`,
    );
    this.zoneBand?.destroy();
    this.zoneBand = drawZoneBand(
      this,
      SLIDER_X,
      SLIDER_Y,
      SLIDER_W,
      attempt.minSpeedMs / MAX_SLIDER_SPEED_MS,
      attempt.maxSafeSpeedMs / MAX_SLIDER_SPEED_MS,
    );
    this.flyer.setPosition(FLYER_START_X, this.flyerBaseY).setAlpha(1).setAngle(0);
    this.startIdleBob();
    this.hints = new HintTracker(flightHints(attempt));
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

    this.tweens.killTweensOf(this.flyer);
    if (outcome.success) {
      sfx.success();
      this.hud.registerStreak(true);
      burstSuccess(this, this.flyer.x, this.flyer.y, 0x3b5f8a);
      this.tweens.add({ targets: this.flyer, x: this.flyer.x + FLYER_TAKEOFF_DX, y: this.flyer.y - 220, angle: -12, duration: 700, ease: 'Sine.easeIn' });
      this.index += 1;
      if (this.index >= ATTEMPT_COUNT) {
        this.locked = true;
        this.time.delayedCall(700, () => this.finish());
      } else {
        this.time.delayedCall(700, () => this.startAttempt());
      }
    } else {
      sfx.error();
      this.hud.registerStreak(false);
      this.mistakes += 1;
      burstError(this, this.flyer.x, this.flyer.y);
      if (outcome.tooSlow) {
        this.tweens.add({ targets: this.flyer, y: this.flyerBaseY + 6, duration: 90, yoyo: true, repeat: 2, onComplete: () => this.startIdleBob() });
      } else {
        this.tweens.add({ targets: this.flyer, angle: { from: -4, to: 4 }, x: { from: this.flyer.x - 4, to: this.flyer.x + 4 }, duration: 60, yoyo: true, repeat: 6, onComplete: () => this.startIdleBob() });
      }
      const reason = outcome.tooSlow ? "Too slow! The Flyer won't leave the ground." : 'Too fast! The wood-and-fabric frame is shaking apart!';
      showToast(this, reason, PALETTE.danger);
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
