import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  evaluateShot,
  generateTargets,
  launchSpeedMs,
  MAX_ANGLE_DEG,
  MAX_COUNTERWEIGHT_KG,
  MIN_ANGLE_DEG,
  MIN_COUNTERWEIGHT_KG,
  projectileRangeM,
  type SiegeTarget,
  type TrebuchetConfig,
} from '../core/puzzles/castle';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { skyGradient } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const TARGET_COUNT = 3;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 100 };
const MAX_RANGE_M = 200;

const FIELD_X = 90;
const FIELD_Y = 420;
const FIELD_W = 760;

const CW_SLIDER_X = GAME_WIDTH / 2 - 220;
const CW_SLIDER_Y = 470;
const ANGLE_SLIDER_Y = 520;
const SLIDER_W = 440;

export class CastleEraScene extends Phaser.Scene {
  private targets: SiegeTarget[] = [];
  private index = 0;
  private counterweightKg = 1500;
  private releaseAngleDeg = 45;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private hud!: EraHUD;
  private locked = false;
  private draggingSlider: 'cw' | 'angle' | null = null;

  private targetText!: Phaser.GameObjects.Text;
  private readoutText!: Phaser.GameObjects.Text;
  private cwHandle!: Phaser.GameObjects.Arc;
  private angleHandle!: Phaser.GameObjects.Arc;
  private cwLabel!: Phaser.GameObjects.Text;
  private angleLabel!: Phaser.GameObjects.Text;
  private wallMarker!: Phaser.GameObjects.Rectangle;
  private projectile!: Phaser.GameObjects.Arc;

  constructor() {
    super('CastleEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.targets = generateTargets(TARGET_COUNT, Math.floor(Math.random() * 1e9));
    this.index = 0;
    this.counterweightKg = 1500;
    this.releaseAngleDeg = 45;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    this.hud = new EraHUD(this, {
      title: 'Medieval Castle: Aim the Trebuchet',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });
    this.hud.setGoal('Adjust the counterweight and angle to hit all 3 targets.');

    this.targetText = this.add.text(GAME_WIDTH / 2, 76, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5);

    this.drawField();

    this.readoutText = this.add.text(GAME_WIDTH / 2, 555, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    this.drawSliders();

    createButton(this, GAME_WIDTH - 110, 555, '🔥 Fire!', () => this.fire(), { width: 160, height: 44, fontSize: 18 });

    this.startTarget();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'Aim the Trebuchet',
      line: 'Drag the Counterweight (the heavy mass that flings the arm) and Release Angle sliders so the predicted range matches the target distance, then tap Fire!',
      quiz: {
        question: 'Quick check: which release angle usually gives the longest range?',
        options: [
          { label: '45°', correct: true },
          { label: '10°' },
          { label: '80°' },
        ],
      },
      onDismiss: () => {},
    });
  }

  private drawBackground(): void {
    const theme = ERA_THEME.castle;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    const hills = this.add.graphics();
    hills.fillStyle(theme.ground, 1);
    hills.fillRect(0, 400, GAME_WIDTH, GAME_HEIGHT - 400);
  }

  private drawField(): void {
    // Trebuchet silhouette near the left edge of the field.
    const treb = this.add.graphics();
    treb.lineStyle(8, 0x3a2f20, 1);
    treb.beginPath();
    treb.moveTo(FIELD_X - 20, FIELD_Y + 10);
    treb.lineTo(FIELD_X + 10, FIELD_Y - 70);
    treb.lineTo(FIELD_X + 40, FIELD_Y + 10);
    treb.strokePath();
    treb.lineStyle(5, 0x5a4a30, 1);
    treb.beginPath();
    treb.moveTo(FIELD_X - 15, FIELD_Y - 50);
    treb.lineTo(FIELD_X + 45, FIELD_Y - 20);
    treb.strokePath();

    this.wallMarker = this.add.rectangle(FIELD_X + FIELD_W, FIELD_Y - 50, 24, 110, 0x7a7a7a).setStrokeStyle(2, 0xffffff, 0.3);
    this.projectile = this.add.circle(FIELD_X, FIELD_Y - 10, 8, 0x3a3a3a, 1);

    this.add.text(FIELD_X - 20, FIELD_Y + 20, '0m', { fontFamily: FONT_FAMILY, fontSize: '12px', color: PALETTE.textMuted }).setOrigin(0.5, 0);
    this.add.text(FIELD_X + FIELD_W, FIELD_Y + 20, `${MAX_RANGE_M}m`, { fontFamily: FONT_FAMILY, fontSize: '12px', color: PALETTE.textMuted }).setOrigin(0.5, 0);
  }

  private metersToX(m: number): number {
    return FIELD_X + Phaser.Math.Clamp(m / MAX_RANGE_M, 0, 1) * FIELD_W;
  }

  private drawSliders(): void {
    this.add.text(CW_SLIDER_X - 10, CW_SLIDER_Y, 'Counterweight', { fontFamily: FONT_FAMILY, fontSize: '13px', color: PALETTE.textMuted }).setOrigin(0, 0.5);
    this.add.text(CW_SLIDER_X - 10, ANGLE_SLIDER_Y, 'Release Angle', { fontFamily: FONT_FAMILY, fontSize: '13px', color: PALETTE.textMuted }).setOrigin(0, 0.5);

    const cwTrack = this.add.rectangle(CW_SLIDER_X + 90 + SLIDER_W / 2, CW_SLIDER_Y, SLIDER_W, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    const angleTrack = this.add.rectangle(CW_SLIDER_X + 90 + SLIDER_W / 2, ANGLE_SLIDER_Y, SLIDER_W, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();

    const sliderBaseX = CW_SLIDER_X + 90;
    this.cwHandle = this.add.circle(sliderBaseX, CW_SLIDER_Y, 16, 0xc77b2e).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.angleHandle = this.add.circle(sliderBaseX, ANGLE_SLIDER_Y, 16, 0x9a7b4f).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });

    this.cwLabel = this.add.text(sliderBaseX + SLIDER_W + 60, CW_SLIDER_Y, '', { fontFamily: FONT_FAMILY, fontSize: '14px', color: PALETTE.gold }).setOrigin(0, 0.5);
    this.angleLabel = this.add.text(sliderBaseX + SLIDER_W + 60, ANGLE_SLIDER_Y, '', { fontFamily: FONT_FAMILY, fontSize: '14px', color: PALETTE.gold }).setOrigin(0, 0.5);

    this.cwHandle.on('pointerdown', () => { this.draggingSlider = 'cw'; });
    this.angleHandle.on('pointerdown', () => { this.draggingSlider = 'angle'; });
    cwTrack.on('pointerdown', (p: Phaser.Input.Pointer) => { this.draggingSlider = 'cw'; this.setCwFromX(p.x, sliderBaseX); });
    angleTrack.on('pointerdown', (p: Phaser.Input.Pointer) => { this.draggingSlider = 'angle'; this.setAngleFromX(p.x, sliderBaseX); });
    this.input.on('pointerup', () => { this.draggingSlider = null; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.locked || !this.draggingSlider) return;
      if (this.draggingSlider === 'cw') this.setCwFromX(p.x, sliderBaseX);
      else this.setAngleFromX(p.x, sliderBaseX);
    });

    this.updateSliderVisuals(sliderBaseX);
  }

  private setCwFromX(x: number, baseX: number): void {
    const ratio = Phaser.Math.Clamp((x - baseX) / SLIDER_W, 0, 1);
    this.counterweightKg = Math.round((MIN_COUNTERWEIGHT_KG + ratio * (MAX_COUNTERWEIGHT_KG - MIN_COUNTERWEIGHT_KG)) / 50) * 50;
    this.updateSliderVisuals(baseX);
  }

  private setAngleFromX(x: number, baseX: number): void {
    const ratio = Phaser.Math.Clamp((x - baseX) / SLIDER_W, 0, 1);
    this.releaseAngleDeg = Math.round(MIN_ANGLE_DEG + ratio * (MAX_ANGLE_DEG - MIN_ANGLE_DEG));
    this.updateSliderVisuals(baseX);
  }

  private updateSliderVisuals(baseX: number): void {
    const cwRatio = (this.counterweightKg - MIN_COUNTERWEIGHT_KG) / (MAX_COUNTERWEIGHT_KG - MIN_COUNTERWEIGHT_KG);
    this.cwHandle.setX(baseX + cwRatio * SLIDER_W);
    this.cwLabel.setText(`${this.counterweightKg} kg`);

    const angleRatio = (this.releaseAngleDeg - MIN_ANGLE_DEG) / (MAX_ANGLE_DEG - MIN_ANGLE_DEG);
    this.angleHandle.setX(baseX + angleRatio * SLIDER_W);
    this.angleLabel.setText(`${this.releaseAngleDeg}°`);

    this.updateReadout();
  }

  private currentConfig(): TrebuchetConfig {
    return { counterweightKg: this.counterweightKg, releaseAngleDeg: this.releaseAngleDeg };
  }

  private updateReadout(): void {
    const cfg = this.currentConfig();
    const speed = launchSpeedMs(cfg.counterweightKg);
    const range = projectileRangeM(cfg);
    const target = this.targets[this.index];
    const inTolerance = target ? Math.abs(range - target.targetDistanceM) <= target.toleranceM : false;
    this.readoutText.setText(`Launch speed: ${speed.toFixed(1)} m/s   Predicted range: ${range.toFixed(0)} m`);
    this.readoutText.setColor(inTolerance ? PALETTE.success : PALETTE.textLight);
    this.projectile.setPosition(this.metersToX(range), FIELD_Y - 10);
  }

  private startTarget(): void {
    const target = this.targets[this.index];
    this.targetText.setText(`Target ${this.index + 1} of ${TARGET_COUNT}: hit ${target.wallLabel}, ${target.targetDistanceM} m away.`);
    this.wallMarker.setX(this.metersToX(target.targetDistanceM));
    this.hints = new HintTracker([
      { level: 1, text: 'A 45° release angle gives the longest range for a given counterweight.' },
      { level: 2, text: `Aim for about ${target.targetDistanceM} m of range.` },
    ]);
    this.updateReadout();
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this shot!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private fire(): void {
    if (this.locked) return;
    const target = this.targets[this.index];
    const outcome = evaluateShot(target, this.currentConfig());

    const landingX = this.metersToX(outcome.distanceM);
    this.tweens.add({
      targets: this.projectile,
      x: landingX,
      duration: 500,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const t = tween.progress;
        this.projectile.y = FIELD_Y - 10 - Math.sin(t * Math.PI) * 90;
      },
      onComplete: () => {
        if (outcome.success) {
          sfx.success();
          this.hud.registerStreak(true);
          burstSuccess(this, landingX, FIELD_Y - 10, 0x9a7b4f);
          this.index += 1;
          if (this.index >= TARGET_COUNT) {
            this.locked = true;
            this.time.delayedCall(500, () => this.finish());
          } else {
            this.time.delayedCall(400, () => this.startTarget());
          }
        } else {
          sfx.error();
          this.hud.registerStreak(false);
          this.mistakes += 1;
          burstError(this, landingX, FIELD_Y - 10);
          showToast(this, `Landed ${outcome.distanceM.toFixed(0)} m away — off by ${outcome.diffM.toFixed(0)} m!`, PALETTE.danger);
          const autoHint = this.hints.registerMistake();
          if (autoHint) {
            this.hintsUsedTotal += 1;
            this.time.delayedCall(2300, () => showToast(this, `💡 ${autoHint.text}`, PALETTE.gold));
          }
        }
      },
    });
  }

  private finish(): void {
    const timeSeconds = (this.time.now - this.startTime) / 1000;
    const result: EraAttemptResult = {
      mistakes: this.mistakes,
      hintsUsed: this.hintsUsedTotal,
      timeSeconds,
    };
    const data: EraCompleteData = {
      eraId: 'castle',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'The real engineering of trebuchets',
        body: 'Medieval siege engineers balanced a heavy counterweight against a long sling arm, trading mass and release angle for range — the same thrust-and-arc tradeoffs you just tuned. A well-built trebuchet could hurl stones over 300 meters.',
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
