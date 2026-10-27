import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { generateBlocks, checkAnswer, TOOL_INFO, TOOLS, type Tool, type BlockChallenge, type BlockSituation } from '../core/puzzles/egypt';
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

const TOTAL_BLOCKS = 6;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 75 };

const SITUATION_TEXT: Record<BlockSituation, string> = {
  'steep-rise': 'This block must climb a steep slope to the next level.',
  'tight-gap': 'This block is jammed sideways in a tight gap between stones.',
  'long-haul': 'This block has to be dragged a long way across hot, dry sand.',
  'final-lift': 'This block just needs one last careful nudge into its slot.',
};

const SITUATION_HINT: Record<BlockSituation, string> = {
  'steep-rise': 'Think about something long and gently sloped...',
  'tight-gap': 'Think about something short you can pry with...',
  'long-haul': 'Think about reducing friction on sand...',
  'final-lift': 'Think about something short you can pry with...',
};

export class EgyptEraScene extends Phaser.Scene {
  private blocks: BlockChallenge[] = [];
  private index = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
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

    new EraHUD(this, {
      title: 'Ancient Egypt: Raise the Pyramid',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.add.text(GAME_WIDTH / 2, 100, 'Pick the right tool to move each block!', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.75);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 320, 130, 640, 90, 14);

    this.situationText = this.add.text(GAME_WIDTH / 2, 175, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 580 },
    }).setOrigin(0.5);

    this.drawToolButtons();
    this.drawProgressTracker();
    this.showCurrentBlock();

    portalIn(this);
  }

  private drawBackground(): void {
    const theme = ERA_THEME.egypt;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    this.add.circle(GAME_WIDTH - 140, 110, 56, 0xfff2c4, 0.9);
    this.add.circle(GAME_WIDTH - 140, 110, 56, 0xfff2c4, 0.3).setScale(1.6);

    const dunes = this.add.graphics();
    dunes.fillStyle(0xd9a85c, 1);
    dunes.beginPath();
    dunes.moveTo(0, GAME_HEIGHT);
    dunes.lineTo(0, 440);
    for (let x = 0; x <= GAME_WIDTH; x += 40) {
      dunes.lineTo(x, 440 + Math.sin(x * 0.02) * 12);
    }
    dunes.lineTo(GAME_WIDTH, GAME_HEIGHT);
    dunes.closePath();
    dunes.fillPath();

    dunes.fillStyle(theme.ground, 1);
    dunes.fillRect(0, 480, GAME_WIDTH, GAME_HEIGHT - 480);

    const g = this.add.graphics();
    g.fillStyle(0xb9793a, 0.9);
    this.triangle(g, 650, 460, 100);
    this.triangle(g, 740, 460, 70);
    g.fillStyle(0x9c6530, 1);
    this.triangle(g, 820, 460, 150);
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
    const spacing = 160;
    const startX = GAME_WIDTH / 2 - (spacing * (TOOLS.length - 1)) / 2;
    TOOLS.forEach((tool, i) => {
      createButton(
        this,
        startX + i * spacing,
        y,
        `${TOOL_INFO[tool].label}`,
        () => this.chooseTool(tool),
        { width: 150, height: 56, fontSize: 17 },
      );
    });
  }

  private drawProgressTracker(): void {
    const startX = GAME_WIDTH / 2 - (TOTAL_BLOCKS * 36) / 2;
    const y = 480;
    this.progressBlocks = [];
    for (let i = 0; i < TOTAL_BLOCKS; i++) {
      const rect = this.add.rectangle(startX + i * 36, y, 26, 26, 0x4a3f66).setStrokeStyle(2, 0xffffff, 0.3);
      this.progressBlocks.push(rect);
    }
  }

  private showCurrentBlock(): void {
    const block = this.blocks[this.index];
    this.situationText.setText(`Block ${this.index + 1} of ${TOTAL_BLOCKS}: ${SITUATION_TEXT[block.situation]}`);
    this.hints = new HintTracker([
      { level: 1, text: SITUATION_HINT[block.situation] },
      { level: 2, text: `Use the ${TOOL_INFO[block.correctTool].label}!` },
    ]);
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
      this.mistakes += 1;
      burstError(this, GAME_WIDTH / 2, GAME_HEIGHT - 90);
      showToast(this, `Not quite — ${TOOL_INFO[tool].fact}`, PALETTE.danger);
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
