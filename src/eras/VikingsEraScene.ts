import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { evaluateLeg, generateVoyage, type VoyageLeg } from '../core/puzzles/vikings';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, TOP_SHIFT, PALETTE, fitWidth } from '../ui/theme';
import { skyGradient, starField } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const LEG_COUNT = 4;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 90 };
const DIAL_X = GAME_WIDTH / 2;
const DIAL_Y = 340 + TOP_SHIFT;
const DIAL_R = 110;

export class VikingsEraScene extends Phaser.Scene {
  private legs: VoyageLeg[] = [];
  private legIndex = 0;
  private bearing = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private hud!: EraHUD;
  private dragging = false;
  private locked = false;

  private needle!: Phaser.GameObjects.Graphics;
  private clueText!: Phaser.GameObjects.Text;
  private legText!: Phaser.GameObjects.Text;
  private bearingText!: Phaser.GameObjects.Text;

  constructor() {
    super('VikingsEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.legs = generateVoyage(LEG_COUNT, Math.floor(Math.random() * 1e9));
    this.legIndex = 0;
    this.bearing = 0;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    this.hud = new EraHUD(this, {
      title: 'Viking Seas: Steer by the Stars',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });
    this.hud.setGoal('Use Polaris to steer the right heading on all 4 legs of the voyage.');

    this.legText = this.add.text(GAME_WIDTH / 2, 76 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    this.clueText = this.add.text(GAME_WIDTH / 2, 98 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: fitWidth(640) },
    }).setOrigin(0.5);

    this.drawDial();

    this.bearingText = this.add.text(DIAL_X, DIAL_Y + DIAL_R + 30, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    }).setOrigin(0.5);

    createButton(this, DIAL_X, DIAL_Y + DIAL_R + 70, 'Set Course!', () => this.submit(), { width: 220, height: 52 });

    this.startLeg();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'Steer by the Stars',
      line: 'Drag inside the dial to turn the bow until your heading (direction, in degrees) matches the clue about Polaris, the North Star, then tap Set Course!',
      quiz: {
        question: 'Quick check: if Polaris sits dead ahead over the bow, what heading should you set?',
        options: [
          { label: '0° (straight ahead)', correct: true },
          { label: '180° (behind you)' },
          { label: '90° (to the side)' },
        ],
      },
      onDismiss: () => {},
    });
  }

  private drawBackground(): void {
    const theme = ERA_THEME.vikings;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    starField(this, 70, 300);
    this.add.circle(GAME_WIDTH / 2, 60 + TOP_SHIFT, 5, 0xffffff, 1);
    this.add.text(GAME_WIDTH / 2, 60 + TOP_SHIFT, '★', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 34 + TOP_SHIFT, 'Polaris', { fontFamily: FONT_FAMILY, fontSize: '12px', color: PALETTE.textMuted }).setOrigin(0.5);

    const sea = this.add.graphics();
    sea.fillStyle(theme.ground, 1);
    sea.fillRect(0, 500, GAME_WIDTH, GAME_HEIGHT - 500);
    for (let i = 0; i < 10; i++) {
      sea.lineStyle(2, 0x6fb6c9, 0.4);
      sea.beginPath();
      sea.moveTo(0, 520 + i * 7);
      sea.lineTo(GAME_WIDTH, 520 + i * 7);
      sea.strokePath();
    }
  }

  private drawDial(): void {
    const ring = this.add.graphics();
    ring.lineStyle(4, 0x7ad1e0, 0.8);
    ring.strokeCircle(DIAL_X, DIAL_Y, DIAL_R);
    ring.fillStyle(0x0d1b2a, 0.6);
    ring.fillCircle(DIAL_X, DIAL_Y, DIAL_R - 4);

    this.add.text(DIAL_X, DIAL_Y - DIAL_R - 14, 'N', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight }).setOrigin(0.5);
    this.add.text(DIAL_X, DIAL_Y + DIAL_R + 14, 'S', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight }).setOrigin(0.5);
    this.add.text(DIAL_X - DIAL_R - 14, DIAL_Y, 'W', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight }).setOrigin(0.5);
    this.add.text(DIAL_X + DIAL_R + 14, DIAL_Y, 'E', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight }).setOrigin(0.5);

    this.needle = this.add.graphics();
    this.drawNeedle();

    const zone = this.add.circle(DIAL_X, DIAL_Y, DIAL_R).setInteractive();
    zone.on('pointerdown', () => {
      this.dragging = true;
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || this.locked) return;
      const angle = Phaser.Math.Angle.Between(DIAL_X, DIAL_Y, pointer.x, pointer.y);
      const deg = (Phaser.Math.RadToDeg(angle) + 90 + 360) % 360;
      this.bearing = Math.round(deg / 5) * 5;
      this.drawNeedle();
      this.updateBearingText();
    });
  }

  private drawNeedle(): void {
    this.needle.clear();
    const rad = Phaser.Math.DegToRad(this.bearing - 90);
    const tipX = DIAL_X + Math.cos(rad) * (DIAL_R - 16);
    const tipY = DIAL_Y + Math.sin(rad) * (DIAL_R - 16);
    this.needle.lineStyle(6, 0xffd34d, 1);
    this.needle.beginPath();
    this.needle.moveTo(DIAL_X, DIAL_Y);
    this.needle.lineTo(tipX, tipY);
    this.needle.strokePath();
    this.needle.fillStyle(0xffd34d, 1);
    this.needle.fillCircle(DIAL_X, DIAL_Y, 8);
  }

  private updateBearingText(): void {
    this.bearingText.setText(`Heading: ${this.bearing}°`);
  }

  private startLeg(): void {
    const leg = this.legs[this.legIndex];
    this.legText.setText(`Leg ${this.legIndex + 1} of ${LEG_COUNT}`);
    this.clueText.setText(leg.clue);
    this.updateBearingText();
    this.hints = new HintTracker([
      { level: 1, text: 'Drag inside the dial to rotate the bow.' },
      { level: 2, text: `Aim for about ${leg.targetBearing}°.` },
    ]);
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this leg!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private submit(): void {
    if (this.locked) return;
    const leg = this.legs[this.legIndex];
    const outcome = evaluateLeg(leg, this.bearing);
    if (outcome.success) {
      sfx.success();
      this.hud.registerStreak(true);
      burstSuccess(this, DIAL_X, DIAL_Y, 0x7ad1e0);
      this.legIndex += 1;
      if (this.legIndex >= LEG_COUNT) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.time.delayedCall(400, () => this.startLeg());
      }
    } else {
      sfx.error();
      this.hud.registerStreak(false);
      this.mistakes += 1;
      burstError(this, DIAL_X, DIAL_Y);
      showToast(this, `Off course by ${outcome.diffDeg}°. Watch Polaris and try again!`, PALETTE.danger);
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
      eraId: 'vikings',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'How Vikings really navigated',
        body: 'Viking sailors watched Polaris, the North Star, which barely moves in the sky, to hold a steady heading at night. Some sagas also mention a "sunstone" crystal that may have helped find the sun through clouds and fog.',
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
