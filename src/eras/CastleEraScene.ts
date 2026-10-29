import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  castleHints,
  evaluateShot,
  generateTargets,
  LEARN_GOAL,
  MAX_ANGLE_DEG,
  MAX_COUNTERWEIGHT_KG,
  MIN_ANGLE_DEG,
  MIN_COUNTERWEIGHT_KG,
  projectileRangeM,
  type ShotOutcome,
  type SiegeTarget,
  type TrebuchetConfig,
} from '../core/puzzles/castle';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { drawZoneBand } from '../ui/zoneMeter';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, PALETTE, TOP_SHIFT, fitWidth } from '../ui/theme';
import { skyGradient } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const TARGET_COUNT = 3;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 100 };
const MAX_RANGE_M = 200;

const FIELD_X = IS_PORTRAIT ? 24 : 90;
const FIELD_Y = (IS_PORTRAIT ? 260 : 420) + TOP_SHIFT;
const FIELD_W = GAME_WIDTH - FIELD_X - (IS_PORTRAIT ? 24 : 110);

// Arm pivots at the frame's apex (matches the apex drawn in drawField()). Short end carries
// the counterweight, long end carries the sling/stone — a real trebuchet's asymmetric arm.
const PIVOT_X = FIELD_X + 10;
const PIVOT_Y = FIELD_Y - 70;
const ARM_LONG = 70;
const ARM_SHORT = 26;
// Cocked: long/sling arm low near the ground (loaded), counterweight raised. Release: arm has
// swung through so the sling arm whips up and forward, flinging the stone toward the target.
const REST_ANGLE_DEG = 125;
const RELEASE_ANGLE_DEG = -15;

const SLIDER_W = IS_PORTRAIT ? GAME_WIDTH - 100 : 440;
const CW_SLIDER_X = IS_PORTRAIT ? (GAME_WIDTH - SLIDER_W) / 2 - 90 : GAME_WIDTH / 2 - 220;
const CW_SLIDER_Y = (IS_PORTRAIT ? 480 : 470) + TOP_SHIFT;
const ANGLE_SLIDER_Y = (IS_PORTRAIT ? 580 : 520) + TOP_SHIFT;

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
  private firing = false;
  private draggingSlider: 'cw' | 'angle' | null = null;

  private targetText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private readoutText!: Phaser.GameObjects.Text;
  private cwHandle!: Phaser.GameObjects.Arc;
  private angleHandle!: Phaser.GameObjects.Arc;
  private cwLabel!: Phaser.GameObjects.Text;
  private angleLabel!: Phaser.GameObjects.Text;
  private wallMarker!: Phaser.GameObjects.Rectangle;
  private zoneBand?: Phaser.GameObjects.Rectangle;
  private projectile!: Phaser.GameObjects.Arc;
  private armContainer!: Phaser.GameObjects.Container;
  private armGfx!: Phaser.GameObjects.Graphics;
  private counterweightBall!: Phaser.GameObjects.Arc;
  private previewMarker!: Phaser.GameObjects.Arc;

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
    this.hud.setGoal('Land inside the green zone 3 times.');

    // Cleared against the HUD's actual goal-banner bottom, not just a fixed offset: on the
    // wide desktop canvas the goal banner rarely wraps, but as a left-aligned pill it still
    // shares the same row as this centered text at the old fixed y, with nothing stopping
    // them from overlapping.
    this.targetText = this.add.text(GAME_WIDTH / 2, Math.max(76 + TOP_SHIFT, this.hud.goalBottom + 14), '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: fitWidth(700) },
    }).setOrigin(0.5);

    this.drawField();

    this.statusText = this.add.text(GAME_WIDTH / 2, FIELD_Y + (IS_PORTRAIT ? 70 : 28), '', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    this.readoutText = this.add.text(GAME_WIDTH / 2, FIELD_Y + (IS_PORTRAIT ? 110 : 135), '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    this.drawSliders();

    const fireX = IS_PORTRAIT ? GAME_WIDTH / 2 : GAME_WIDTH - 110;
    const fireY = IS_PORTRAIT ? ANGLE_SLIDER_Y + 80 : 555;
    createButton(this, fireX, fireY, '🔥 Fire!', () => this.fire(), { width: 160, height: 44, fontSize: 18 });

    this.startTarget();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'Aim the Trebuchet',
      learnGoal: LEARN_GOAL,
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
    const horizon = IS_PORTRAIT ? FIELD_Y + 20 : 400;
    hills.fillRect(0, horizon, GAME_WIDTH, GAME_HEIGHT - horizon);
  }

  private drawField(): void {
    // Trebuchet A-frame near the left edge of the field; the arm pivots at its apex.
    const treb = this.add.graphics();
    treb.lineStyle(8, 0x3a2f20, 1);
    treb.beginPath();
    treb.moveTo(FIELD_X - 20, FIELD_Y + 10);
    treb.lineTo(PIVOT_X, PIVOT_Y);
    treb.lineTo(FIELD_X + 40, FIELD_Y + 10);
    treb.strokePath();

    this.armContainer = this.add.container(PIVOT_X, PIVOT_Y);
    this.armGfx = this.add.graphics();
    this.counterweightBall = this.add.circle(0, 0, 10, 0x2a2a2a, 1);
    this.armContainer.add([this.armGfx, this.counterweightBall]);

    this.wallMarker = this.add.rectangle(FIELD_X + FIELD_W, FIELD_Y - 50, 24, 110, 0x7a7a7a).setStrokeStyle(2, 0xffffff, 0.3);
    // Faint ghost ring that tracks the *predicted* landing spot while the sliders move — kept
    // separate from the stone itself, which stays loaded in the sling until Fire! is tapped.
    this.previewMarker = this.add.circle(FIELD_X, FIELD_Y - 10, 8, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.35);
    this.projectile = this.add.circle(0, 0, 8, 0x3a3a3a, 1);
    this.setArmAngle(REST_ANGLE_DEG);

    // Left-anchored (origin.x = 0), not centered: centering "0m" on FIELD_X - 20 ran a few
    // px off the left edge of the canvas once this label's font grew to a readable 16px.
    this.add.text(Math.max(4, FIELD_X - 20), FIELD_Y + 20, '0m', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(0, 0);
    this.add.text(FIELD_X + FIELD_W, FIELD_Y + 20, `${MAX_RANGE_M}m`, { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(0.5, 0);
  }

  private metersToX(m: number): number {
    return FIELD_X + Phaser.Math.Clamp(m / MAX_RANGE_M, 0, 1) * FIELD_W;
  }

  /** World-space position of the long (sling) end of the arm at a given rotation. */
  private armTip(angleDeg: number): { x: number; y: number } {
    const rad = Phaser.Math.DegToRad(angleDeg);
    return { x: PIVOT_X + ARM_LONG * Math.cos(rad), y: PIVOT_Y + ARM_LONG * Math.sin(rad) };
  }

  /** Redraws the arm at the given rotation. The stone stays glued to the sling end up until
   * the flight tween in fire() takes over and flies it independently toward the landing spot. */
  private setArmAngle(angleDeg: number): void {
    const rad = Phaser.Math.DegToRad(angleDeg);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    this.armGfx.clear();
    this.armGfx.lineStyle(6, 0x5a4a30, 1);
    this.armGfx.beginPath();
    this.armGfx.moveTo(-ARM_SHORT * dx, -ARM_SHORT * dy);
    this.armGfx.lineTo(ARM_LONG * dx, ARM_LONG * dy);
    this.armGfx.strokePath();
    this.counterweightBall.setPosition(-ARM_SHORT * dx, -ARM_SHORT * dy);
    const tip = this.armTip(angleDeg);
    this.projectile.setPosition(tip.x, tip.y);
  }

  private drawSliders(): void {
    const sliderBaseX = CW_SLIDER_X + 90;

    if (IS_PORTRAIT) {
      this.add.text(sliderBaseX + SLIDER_W / 2, CW_SLIDER_Y - 36, 'Counterweight', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(0.5);
      this.add.text(sliderBaseX + SLIDER_W / 2, ANGLE_SLIDER_Y - 36, 'Release Angle', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(0.5);
    } else {
      // Right-anchored (origin.x = 1) so a larger, readable font grows left away from the
      // slider track instead of growing right into the handle's starting position.
      this.add.text(CW_SLIDER_X - 14, CW_SLIDER_Y, 'Counterweight', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(1, 0.5);
      this.add.text(CW_SLIDER_X - 14, ANGLE_SLIDER_Y, 'Release Angle', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textMuted }).setOrigin(1, 0.5);
    }

    const cwTrack = this.add.rectangle(sliderBaseX + SLIDER_W / 2, CW_SLIDER_Y, SLIDER_W, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    const angleTrack = this.add.rectangle(sliderBaseX + SLIDER_W / 2, ANGLE_SLIDER_Y, SLIDER_W, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();

    this.cwHandle = this.add.circle(sliderBaseX, CW_SLIDER_Y, 16, 0xc77b2e).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.angleHandle = this.add.circle(sliderBaseX, ANGLE_SLIDER_Y, 16, 0x9a7b4f).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });

    if (IS_PORTRAIT) {
      this.cwLabel = this.add.text(sliderBaseX + SLIDER_W / 2, CW_SLIDER_Y + 26, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);
      this.angleLabel = this.add.text(sliderBaseX + SLIDER_W / 2, ANGLE_SLIDER_Y + 26, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);
    } else {
      this.cwLabel = this.add.text(sliderBaseX + SLIDER_W + 60, CW_SLIDER_Y, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0, 0.5);
      this.angleLabel = this.add.text(sliderBaseX + SLIDER_W + 60, ANGLE_SLIDER_Y, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0, 0.5);
    }

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
    const range = projectileRangeM(cfg);
    const target = this.targets[this.index];
    if (target) {
      const inTolerance = Math.abs(range - target.targetDistanceM) <= target.toleranceM;
      if (inTolerance) {
        this.statusText.setText('🎯 In the green zone!');
        this.statusText.setColor(PALETTE.success);
      } else if (range < target.targetDistanceM) {
        this.statusText.setText('⬅️ Too short — add more weight or swing!');
        this.statusText.setColor(PALETTE.danger);
      } else {
        this.statusText.setText('➡️ Too far — ease off the weight or swing!');
        this.statusText.setColor(PALETTE.danger);
      }
    }
    this.readoutText.setText(`Landing spot: ${range.toFixed(0)} m`);
    this.previewMarker.setPosition(this.metersToX(range), FIELD_Y - 10);
  }

  private startTarget(): void {
    const target = this.targets[this.index];
    this.targetText.setText(`Target ${this.index + 1} of ${TARGET_COUNT}: hit ${target.wallLabel}, ${target.targetDistanceM} m away.`);
    this.wallMarker.setX(this.metersToX(target.targetDistanceM));
    this.zoneBand?.destroy();
    this.zoneBand = drawZoneBand(
      this,
      this.metersToX(Math.max(0, target.targetDistanceM - target.toleranceM)),
      FIELD_Y - 50,
      this.metersToX(target.targetDistanceM + target.toleranceM) - this.metersToX(Math.max(0, target.targetDistanceM - target.toleranceM)),
      0,
      1,
      110,
    );
    this.hints = new HintTracker(castleHints(target));
    this.resetArm();
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
    if (this.locked || this.firing) return;
    this.firing = true;
    const target = this.targets[this.index];
    const outcome = evaluateShot(target, this.currentConfig());

    // Phase 1: swing the arm from cocked to release — the counterweight drops, the sling
    // whips the stone up and forward. The stone stays glued to the sling tip throughout.
    this.tweens.add({
      targets: this.armContainer,
      rotation: Phaser.Math.DegToRad(RELEASE_ANGLE_DEG),
      duration: 260,
      ease: 'Cubic.easeIn',
      onUpdate: () => this.setArmAngle(Phaser.Math.RadToDeg(this.armContainer.rotation)),
      onComplete: () => this.releaseProjectile(outcome),
    });
  }

  /** Phase 2: the stone flies independently from the release point to its landing spot,
   * arcing higher for longer throws, then phase 3 resolves the hit/miss outcome. */
  private releaseProjectile(outcome: ShotOutcome): void {
    const launchPoint = this.armTip(RELEASE_ANGLE_DEG);
    const landingX = this.metersToX(outcome.distanceM);
    const arcHeight = 50 + Phaser.Math.Clamp(outcome.distanceM, 0, MAX_RANGE_M) * 0.9;
    this.projectile.setPosition(launchPoint.x, launchPoint.y);

    this.tweens.add({
      targets: this.projectile,
      x: landingX,
      duration: 550,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const t = tween.progress;
        this.projectile.y = Phaser.Math.Linear(launchPoint.y, FIELD_Y - 10, t) - Math.sin(t * Math.PI) * arcHeight;
      },
      onComplete: () => this.resolveShot(outcome, landingX),
    });
  }

  private resolveShot(outcome: ShotOutcome, landingX: number): void {
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
      const missReason = outcome.tooShort ? 'Too short!' : 'Too far!';
      showToast(this, `${missReason} Landed ${outcome.distanceM.toFixed(0)} m away.`, PALETTE.danger);
      const autoHint = this.hints.registerMistake();
      if (autoHint) {
        this.hintsUsedTotal += 1;
        this.time.delayedCall(2300, () => showToast(this, `💡 ${autoHint.text}`, PALETTE.gold));
      }
      // Leave the stone resting at the missed spot for a beat so the player can see where
      // it landed relative to the zone band before the arm re-cocks for the retry.
      this.time.delayedCall(700, () => this.resetArm());
    }
  }

  /** Snaps the arm (and the stone glued to it) back to the cocked position for the next shot. */
  private resetArm(): void {
    this.tweens.killTweensOf(this.armContainer);
    this.armContainer.rotation = Phaser.Math.DegToRad(REST_ANGLE_DEG);
    this.setArmAngle(REST_ANGLE_DEG);
    this.firing = false;
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
