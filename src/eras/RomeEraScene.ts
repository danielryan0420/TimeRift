import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { checkLock, generateLockPuzzle, toRoman, type LockPuzzle } from '../core/puzzles/rome';
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

const ROUNDS: Array<{ min: number; max: number }> = [
  { min: 1, max: 30 },
  { min: 31, max: 200 },
  { min: 201, max: 900 },
];
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 90 };

export class RomeEraScene extends Phaser.Scene {
  private round = 0;
  private puzzle!: LockPuzzle;
  private attempt: string[] = [];
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private locked = false;

  private tileButtons: Phaser.GameObjects.Container[] = [];
  private attemptText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;

  constructor() {
    super('RomeEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.round = 0;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    new EraHUD(this, {
      title: 'Ancient Rome: Crack the Numeral Lock',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.roundText = this.add.text(GAME_WIDTH / 2, 90, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.8);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 300, 120, 600, 150, 16);
    panel.lineStyle(2, 0xd94f3d, 0.8);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 300, 120, 600, 150, 16);

    this.targetText = this.add.text(GAME_WIDTH / 2, 145, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5, 0);

    this.attemptText = this.add.text(GAME_WIDTH / 2, 220, '_', {
      fontFamily: FONT_FAMILY,
      fontSize: '40px',
      color: PALETTE.gold,
      letterSpacing: 6 as unknown as number,
    }).setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2 - 160, 300, 'Clear', () => this.clearAttempt(), { width: 140, height: 44, fontSize: 16 });
    createButton(this, GAME_WIDTH / 2 + 160, 300, 'Open Lock', () => this.submit(), { width: 160, height: 44, fontSize: 16 });

    this.startRound();
    portalIn(this);
  }

  private drawBackground(): void {
    const theme = ERA_THEME.rome;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    this.add.circle(130, 100, 44, 0xfff6d9, 0.95);

    const ground = this.add.graphics();
    ground.fillStyle(theme.ground, 1);
    ground.fillRect(0, 470, GAME_WIDTH, GAME_HEIGHT - 470);

    const columns = this.add.graphics();
    columns.fillStyle(0xe8e0cf, 1);
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 150;
      columns.fillRect(x, 360, 24, 120);
      columns.fillRect(x - 8, 350, 40, 14);
    }
    columns.fillStyle(0xcfc6ab, 1);
    columns.fillRect(0, 470, GAME_WIDTH, 14);
  }

  private startRound(): void {
    const range = ROUNDS[this.round];
    this.puzzle = generateLockPuzzle(Math.floor(Math.random() * 1e9), range.min, range.max);
    this.attempt = [];
    this.roundText.setText(`Lock ${this.round + 1} of ${ROUNDS.length}`);
    this.targetText.setText(`Build the Roman numeral for the number ${this.puzzle.target}.`);
    this.updateAttemptText();
    this.hints = new HintTracker([
      { level: 1, text: `It uses ${toRoman(this.puzzle.target).length} symbols.` },
      { level: 2, text: `The answer is ${toRoman(this.puzzle.target)}.` },
    ]);
    this.drawTiles();
  }

  private drawTiles(): void {
    this.tileButtons.forEach((b) => b.destroy());
    this.tileButtons = [];
    const spacing = 80;
    const startX = GAME_WIDTH / 2 - (spacing * (this.puzzle.tiles.length - 1)) / 2;
    this.puzzle.tiles.forEach((symbol, i) => {
      const btn = createButton(
        this,
        startX + i * spacing,
        360,
        symbol,
        () => this.tapTile(symbol, btn),
        { width: 64, height: 64, fontSize: 28, fillColor: 0xb8402f, hoverColor: 0xd94f3d },
      );
      this.tileButtons.push(btn);
    });
  }

  private tapTile(symbol: string, btn: Phaser.GameObjects.Container): void {
    if (this.locked || !btn.active) return;
    this.attempt.push(symbol);
    btn.disableInteractive();
    btn.setAlpha(0.35);
    this.updateAttemptText();
  }

  private updateAttemptText(): void {
    this.attemptText.setText(this.attempt.length > 0 ? this.attempt.join('') : '_');
  }

  private clearAttempt(): void {
    if (this.locked) return;
    this.attempt = [];
    this.updateAttemptText();
    this.tileButtons.forEach((b) => {
      b.setInteractive({ useHandCursor: true });
      b.setAlpha(1);
    });
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this lock!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private submit(): void {
    if (this.locked || this.attempt.length === 0) return;
    const attemptStr = this.attempt.join('');
    if (checkLock(this.puzzle.target, attemptStr)) {
      sfx.success();
      burstSuccess(this, GAME_WIDTH / 2, 220, 0xd94f3d);
      this.round += 1;
      if (this.round >= ROUNDS.length) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.time.delayedCall(400, () => this.startRound());
      }
    } else {
      sfx.error();
      this.mistakes += 1;
      burstError(this, GAME_WIDTH / 2, 220);
      showToast(this, `That opens ${attemptStr.length ? 'a different' : 'no'} vault. Try again!`, PALETTE.danger);
      this.clearAttempt();
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
      eraId: 'rome',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'Roman numerals in real life',
        body: 'Romans used letters like I, V, X, L, C, D and M for numbers because they had no zero and no place-value system. You can still spot numerals like this on clock faces, movie sequels, and the Super Bowl!',
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
