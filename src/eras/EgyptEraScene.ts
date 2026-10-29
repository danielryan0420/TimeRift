import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { egyptHints, generateBlocks, checkAnswer, LEARN_GOAL, TOOL_INFO, TOOLS, type Tool, type BlockChallenge } from '../core/puzzles/egypt';
import type { EraAttemptResult } from '../core/types';
import { HintTracker } from '../core/hints';
import { EGYPT_TUTORIAL_STEPS, isTutorialPending } from '../core/onboarding';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, PALETTE, TOP_SHIFT, fitWidth } from '../ui/theme';
import { skyGradient } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';
import type { EraCompleteData } from '../scenes/EraCompleteScene';

const TOTAL_BLOCKS = 6;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 75 };

function situationText(block: BlockChallenge): string {
  return `This block weighs ${block.weightKg} kg and must move ${block.distanceM} m to its spot.`;
}

export class EgyptEraScene extends Phaser.Scene {
  private blocks: BlockChallenge[] = [];
  private index = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private hud!: EraHUD;
  private situationText!: Phaser.GameObjects.Text;
  private progressBlocks: Phaser.GameObjects.Rectangle[] = [];
  private locked = false;

  constructor() {
    super('EgyptEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.blocks = generateBlocks(TOTAL_BLOCKS, Math.floor(Math.random() * 1e9));
    this.index = 0;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    this.hud = new EraHUD(this, {
      title: 'Ancient Egypt: Raise the Pyramid',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });
    this.hud.setGoal('Move all 6 blocks by picking the right tool for each one.');

    this.add.text(GAME_WIDTH / 2, 100 + TOP_SHIFT, 'Pick the right tool to move each block!', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    const panelW = fitWidth(640);
    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.75);
    panel.fillRoundedRect(GAME_WIDTH / 2 - panelW / 2, 130 + TOP_SHIFT, panelW, 90, 14);

    this.situationText = this.add.text(GAME_WIDTH / 2, 175 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: panelW - 60 },
    }).setOrigin(0.5);

    this.drawToolButtons();
    this.drawProgressTracker();
    this.showCurrentBlock();

    portalIn(this);
    this.showIntroCards(profile.tutorialDone);
  }

  private showIntroCards(tutorialDone: boolean | undefined): void {
    if (isTutorialPending(tutorialDone)) {
      this.showTutorialStep(0);
      return;
    }
    showHowToPlayCard(this, {
      title: 'Raise the Pyramid',
      learnGoal: LEARN_GOAL,
      line: 'Pick the right tool to move each block! Read the situation, then tap a tool below.',
      quiz: {
        question: 'Quick check: which tool is best for prying a block in a tight gap?',
        options: [
          { label: 'Lever', correct: true },
          { label: 'Wet Sand' },
          { label: 'Ramp' },
        ],
      },
      onDismiss: () => {},
    });
  }

  private showTutorialStep(step: number): void {
    const data = EGYPT_TUTORIAL_STEPS[step];
    const isLast = step === EGYPT_TUTORIAL_STEPS.length - 1;
    showHowToPlayCard(this, {
      emoji: '🧭',
      title: data.title,
      line: data.line,
      dismissLabel: isLast ? "Let's dig in!" : 'Next',
      onDismiss: () => {
        if (isLast) {
          const state = this.registry.get(GAME_STATE_KEY) as GameState;
          state.updateActiveProfile((p) => ({ ...p, tutorialDone: true }));
        } else {
          this.showTutorialStep(step + 1);
        }
      },
    });
  }

  private drawBackground(): void {
    const theme = ERA_THEME.egypt;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    this.add.circle(GAME_WIDTH - 140, 110, 56, 0xfff2c4, 0.9);
    this.add.circle(GAME_WIDTH - 140, 110, 56, 0xfff2c4, 0.3).setScale(1.6);

    const duneTop = GAME_HEIGHT * 0.733;
    const groundTop = GAME_HEIGHT * 0.8;
    const dunes = this.add.graphics();
    dunes.fillStyle(0xd9a85c, 1);
    dunes.beginPath();
    dunes.moveTo(0, GAME_HEIGHT);
    dunes.lineTo(0, duneTop);
    for (let x = 0; x <= GAME_WIDTH; x += 40) {
      dunes.lineTo(x, duneTop + Math.sin(x * 0.02) * 12);
    }
    dunes.lineTo(GAME_WIDTH, GAME_HEIGHT);
    dunes.closePath();
    dunes.fillPath();

    dunes.fillStyle(theme.ground, 1);
    dunes.fillRect(0, groundTop, GAME_WIDTH, GAME_HEIGHT - groundTop);

    const g = this.add.graphics();
    const pyramidY = GAME_HEIGHT * 0.767;
    g.fillStyle(0xb9793a, 0.9);
    this.triangle(g, GAME_WIDTH * 0.677, pyramidY, IS_PORTRAIT ? 50 : 100);
    this.triangle(g, GAME_WIDTH * 0.771, pyramidY, IS_PORTRAIT ? 35 : 70);
    g.fillStyle(0x9c6530, 1);
    this.triangle(g, GAME_WIDTH * 0.854, pyramidY, IS_PORTRAIT ? 75 : 150);
  }

  private triangle(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, size: number): void {
    g.beginPath();
    g.moveTo(cx - size, baseY);
    g.lineTo(cx, baseY - size * 1.3);
    g.lineTo(cx + size, baseY);
    g.closePath();
    g.fillPath();
  }

  private drawToolButtons(): void {
    const y = GAME_HEIGHT - 90;
    const n = TOOLS.length;
    const width = IS_PORTRAIT ? Math.min(150, (GAME_WIDTH - 32 - 10 * (n - 1)) / n) : 150;
    const spacing = width + 10;
    const startX = GAME_WIDTH / 2 - (spacing * (n - 1)) / 2;
    TOOLS.forEach((tool, i) => {
      createButton(
        this,
        startX + i * spacing,
        y,
        `${TOOL_INFO[tool].label}`,
        () => this.chooseTool(tool),
        { width, height: 56, fontSize: IS_PORTRAIT ? 16 : 17 },
      );
    });
  }

  private drawProgressTracker(): void {
    const startX = GAME_WIDTH / 2 - (TOTAL_BLOCKS * 36) / 2;
    const y = GAME_HEIGHT - 120;
    this.progressBlocks = [];
    for (let i = 0; i < TOTAL_BLOCKS; i++) {
      const rect = this.add.rectangle(startX + i * 36, y, 26, 26, 0x4a3f66).setStrokeStyle(2, 0xffffff, 0.3);
      this.progressBlocks.push(rect);
    }
  }

  private showCurrentBlock(): void {
    const block = this.blocks[this.index];
    this.situationText.setText(`Block ${this.index + 1} of ${TOTAL_BLOCKS}: ${situationText(block)}`);
    this.hints = new HintTracker(egyptHints(block));
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this block!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private chooseTool(tool: Tool): void {
    if (this.locked) return;
    const block = this.blocks[this.index];
    const correct = checkAnswer(block, tool);

    if (correct) {
      sfx.success();
      this.hud.registerStreak(true);
      this.progressBlocks[this.index].setFillStyle(0xffd34d);
      burstSuccess(this, this.progressBlocks[this.index].x, this.progressBlocks[this.index].y);
      this.index += 1;
      if (this.index >= TOTAL_BLOCKS) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.showCurrentBlock();
      }
    } else {
      sfx.error();
      this.hud.registerStreak(false);
      this.mistakes += 1;
      burstError(this, GAME_WIDTH / 2, GAME_HEIGHT - 90);
      showToast(this, `Not quite — ${TOOL_INFO[tool].fact}`, PALETTE.danger);
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
      eraId: 'egypt',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'How the pyramids were really built',
        body: 'Egyptologists believe workers used ramps, levers, wooden sledges, and wet sand to move multi-ton limestone blocks — all without the wheel! A 2014 physics study even confirmed that wetting sand ahead of a sledge roughly halves the dragging force needed.',
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
