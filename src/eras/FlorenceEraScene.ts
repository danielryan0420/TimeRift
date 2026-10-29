import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { evaluatePlacement, generateCanvases, type CanvasChallenge } from '../core/puzzles/florence';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, TOP_SHIFT, PALETTE, fitWidth } from '../ui/theme';
import { skyGradient } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const CANVAS_COUNT = 3;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 80 };
const FRAME_Y = 190 + TOP_SHIFT;
const FRAME_H = 260;
/** Widest a canvas frame is ever allowed to render, so puzzle widths wider than the portrait canvas still fit. */
const MAX_FRAME_W = GAME_WIDTH - 60;

export class FlorenceEraScene extends Phaser.Scene {
  private canvases: CanvasChallenge[] = [];
  private index = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private hud!: EraHUD;
  private locked = false;
  private dragging = false;
  private lineXWithinFrame = 0;

  private subjectText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private frameX = 0;
  /** Visual width the frame is drawn at, which may be smaller than the challenge's logical widthPx. */
  private displayWidthPx = 0;
  private visualScale = 1;
  private frame!: Phaser.GameObjects.Rectangle;
  private line!: Phaser.GameObjects.Graphics;
  private handle!: Phaser.GameObjects.Arc;

  constructor() {
    super('FlorenceEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.canvases = generateCanvases(CANVAS_COUNT, Math.floor(Math.random() * 1e9));
    this.index = 0;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    this.hud = new EraHUD(this, {
      title: 'Renaissance Florence: Find the Golden Ratio',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });
    this.hud.setGoal('Drag the focal line to the golden ratio spot on all 3 canvases.');

    // Cleared against the HUD's actual goal-banner bottom (see CastleEraScene for why a
    // fixed offset isn't enough on the wide desktop canvas).
    this.roundText = this.add.text(GAME_WIDTH / 2, Math.max(66 + TOP_SHIFT, this.hud.goalBottom + 14), '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5, 0);

    // Was missing wordWrap entirely: "Place the focal line for the courtyard mural using
    // the golden ratio." at 19px measures ~770px wide with no wrap, more than the whole
    // 440px portrait canvas, and ran off both edges. Also repositioned from roundText's
    // measured height instead of a fixed y, since roundText is now a single short line but
    // this one still needs room to wrap to 2 lines without colliding.
    this.subjectText = this.add.text(GAME_WIDTH / 2, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: fitWidth(640), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    this.line = this.add.graphics();
    this.handle = this.add.circle(0, FRAME_Y - 18, 14, 0xb5422e).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(14, 14, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });

    this.handle.on('pointerdown', () => { this.dragging = true; });
    this.input.on('pointerup', () => { this.dragging = false; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || this.locked) return;
      this.setLineFromX(p.x);
    });

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, 'Set Composition', () => this.submit(), { width: 260, height: 52 });

    this.startCanvas();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'Find the Golden Ratio',
      line: 'Drag the red line to split the canvas using the golden ratio (a pleasing split where the big part compares to the whole the same way the small part compares to the big part) — about two-thirds of the way across — then tap Set Composition.',
      quiz: {
        question: 'Quick check: roughly where should the focal line sit for a pleasing golden-ratio split?',
        options: [
          { label: 'About 62% of the way across', correct: true },
          { label: 'Exactly in the middle' },
          { label: 'Right at the edge' },
        ],
      },
      onDismiss: () => {},
    });
  }

  private drawBackground(): void {
    const theme = ERA_THEME.florence;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    const ground = this.add.graphics();
    ground.fillStyle(theme.ground, 1);
    const groundTop = GAME_HEIGHT * 0.833;
    ground.fillRect(0, groundTop, GAME_WIDTH, GAME_HEIGHT - groundTop);

    // A faint decorative golden spiral in the corner for flavor.
    const spiral = this.add.graphics();
    spiral.lineStyle(2, 0xb5422e, 0.3);
    let r = 6;
    let angle = 0;
    spiral.beginPath();
    spiral.moveTo(GAME_WIDTH - 80, 90);
    for (let i = 0; i < 60; i++) {
      angle += 0.25;
      r *= 1.045;
      spiral.lineTo(GAME_WIDTH - 80 + Math.cos(angle) * r, 90 + Math.sin(angle) * r);
    }
    spiral.strokePath();
  }

  private startCanvas(): void {
    const challenge = this.canvases[this.index];
    this.roundText.setText(`Canvas ${this.index + 1} of ${CANVAS_COUNT}`);
    this.subjectText.setText(`Place the focal line for ${challenge.subject} using the golden ratio.`);
    this.subjectText.setY(this.roundText.y + this.roundText.displayHeight + 8);
    this.hints = new HintTracker([
      { level: 1, text: `The golden ratio splits a span of ${challenge.widthPx}px so the whole is to the long part as the long part is to the short part.` },
      { level: 2, text: `Aim for about ${Math.round(challenge.targetXPx)}px from the left edge.` },
    ]);

    this.frame?.destroy();
    this.displayWidthPx = Math.min(challenge.widthPx, MAX_FRAME_W);
    this.visualScale = this.displayWidthPx / challenge.widthPx;
    this.frameX = (GAME_WIDTH - this.displayWidthPx) / 2;
    this.frame = this.add.rectangle(GAME_WIDTH / 2, FRAME_Y + FRAME_H / 2, this.displayWidthPx, FRAME_H, 0xf6ead0, 0.15)
      .setStrokeStyle(3, 0xeab676, 0.8);

    this.lineXWithinFrame = challenge.widthPx / 2;
    this.redrawLine();
  }

  private setLineFromX(pointerX: number): void {
    const challenge = this.canvases[this.index];
    this.lineXWithinFrame = Phaser.Math.Clamp((pointerX - this.frameX) / this.visualScale, 0, challenge.widthPx);
    this.redrawLine();
  }

  private redrawLine(): void {
    const absoluteX = this.frameX + this.lineXWithinFrame * this.visualScale;
    this.handle.setX(absoluteX);
    this.line.clear();
    this.line.lineStyle(4, 0xb5422e, 0.9);
    this.line.beginPath();
    this.line.moveTo(absoluteX, FRAME_Y);
    this.line.lineTo(absoluteX, FRAME_Y + FRAME_H);
    this.line.strokePath();
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this canvas!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private submit(): void {
    if (this.locked) return;
    const challenge = this.canvases[this.index];
    const outcome = evaluatePlacement(challenge, this.lineXWithinFrame);
    if (outcome.success) {
      sfx.success();
      this.hud.registerStreak(true);
      burstSuccess(this, this.frameX + this.lineXWithinFrame * this.visualScale, FRAME_Y + FRAME_H / 2, 0xb5422e);
      this.index += 1;
      if (this.index >= CANVAS_COUNT) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.time.delayedCall(400, () => this.startCanvas());
      }
    } else {
      sfx.error();
      this.hud.registerStreak(false);
      this.mistakes += 1;
      burstError(this, this.frameX + this.lineXWithinFrame * this.visualScale, FRAME_Y + FRAME_H / 2);
      showToast(this, `Off by ${outcome.diffPx.toFixed(0)}px — try to feel the balance!`, PALETTE.danger);
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
      eraId: 'florence',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'The golden ratio in Renaissance art',
        body: "Artists like Leonardo da Vinci composed paintings and studies (like the Vitruvian Man) around proportions close to the golden ratio, about 1.618 — a ratio also found in nautilus shells and sunflower seed spirals.",
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
