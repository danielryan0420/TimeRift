import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { caesarDecode, checkShift, generateCiphers, type CipherChallenge } from '../core/puzzles/revolution';
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

const CIPHER_COUNT = 3;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 90 };
const DIAL_X = GAME_WIDTH / 2;
const DIAL_Y = 360 + TOP_SHIFT;
const DIAL_R = 110;

export class RevolutionEraScene extends Phaser.Scene {
  private ciphers: CipherChallenge[] = [];
  private index = 0;
  private shift = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private hud!: EraHUD;
  private dragging = false;
  private locked = false;

  private needle!: Phaser.GameObjects.Graphics;
  private roundText!: Phaser.GameObjects.Text;
  private cipherText!: Phaser.GameObjects.Text;
  private decodedText!: Phaser.GameObjects.Text;
  private shiftText!: Phaser.GameObjects.Text;

  constructor() {
    super('RevolutionEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.ciphers = generateCiphers(CIPHER_COUNT, Math.floor(Math.random() * 1e9));
    this.index = 0;
    this.shift = 0;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    this.hud = new EraHUD(this, {
      title: 'American Revolution: Crack the Culper Code',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });
    this.hud.setGoal('Rotate the wheel to decode all 3 secret messages.');

    this.roundText = this.add.text(GAME_WIDTH / 2, 70 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: fitWidth(700) },
    }).setOrigin(0.5);

    this.cipherText = this.add.text(GAME_WIDTH / 2, 100 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.danger,
      align: 'center',
      wordWrap: { width: fitWidth(700) },
      letterSpacing: 2 as unknown as number,
    }).setOrigin(0.5);

    this.decodedText = this.add.text(GAME_WIDTH / 2, 136 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.success,
      align: 'center',
      wordWrap: { width: fitWidth(700) },
      letterSpacing: 2 as unknown as number,
    }).setOrigin(0.5);

    this.drawDial();

    this.shiftText = this.add.text(DIAL_X, DIAL_Y + DIAL_R + 30, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    }).setOrigin(0.5);

    createButton(this, DIAL_X, DIAL_Y + DIAL_R + 70, 'Decode!', () => this.submit(), { width: 220, height: 52 });

    this.startCipher();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'Crack the Culper Code',
      line: 'Drag the wheel to shift (slide) the letters until the green preview text makes sense, then tap Decode!',
      quiz: {
        question: 'Quick check: how do you know you picked the right shift?',
        options: [
          { label: 'The decoded preview text reads as real words', correct: true },
          { label: 'The needle points straight up' },
          { label: 'The shift number is 13' },
        ],
      },
      onDismiss: () => {},
    });
  }

  private drawBackground(): void {
    const theme = ERA_THEME.revolution;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    starField(this, 40, 250);
    const ground = this.add.graphics();
    ground.fillStyle(theme.ground, 1);
    const groundTop = TOP_SHIFT > 0 ? DIAL_Y + DIAL_R + 100 : 500;
    ground.fillRect(0, groundTop, GAME_WIDTH, GAME_HEIGHT - groundTop);
  }

  private drawDial(): void {
    const ring = this.add.graphics();
    ring.lineStyle(4, 0xb22234, 0.8);
    ring.strokeCircle(DIAL_X, DIAL_Y, DIAL_R);
    ring.fillStyle(0x16263a, 0.7);
    ring.fillCircle(DIAL_X, DIAL_Y, DIAL_R - 4);

    for (let i = 0; i < 26; i++) {
      const rad = Phaser.Math.DegToRad((i * 360) / 26 - 90);
      const lx = DIAL_X + Math.cos(rad) * (DIAL_R - 20);
      const ly = DIAL_Y + Math.sin(rad) * (DIAL_R - 20);
      this.add.text(lx, ly, String.fromCharCode(65 + i), { fontFamily: FONT_FAMILY, fontSize: '11px', color: PALETTE.textMuted }).setOrigin(0.5);
    }

    this.needle = this.add.graphics();
    this.drawNeedle();

    const zone = this.add.circle(DIAL_X, DIAL_Y, DIAL_R).setInteractive();
    zone.on('pointerdown', () => { this.dragging = true; });
    this.input.on('pointerup', () => { this.dragging = false; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || this.locked) return;
      const angle = Phaser.Math.Angle.Between(DIAL_X, DIAL_Y, pointer.x, pointer.y);
      const deg = (Phaser.Math.RadToDeg(angle) + 90 + 360) % 360;
      this.shift = Math.round(deg / (360 / 26)) % 26;
      this.drawNeedle();
      this.updateShiftText();
    });
  }

  private drawNeedle(): void {
    this.needle.clear();
    const rad = Phaser.Math.DegToRad((this.shift * 360) / 26 - 90);
    const tipX = DIAL_X + Math.cos(rad) * (DIAL_R - 30);
    const tipY = DIAL_Y + Math.sin(rad) * (DIAL_R - 30);
    this.needle.lineStyle(6, 0xffd34d, 1);
    this.needle.beginPath();
    this.needle.moveTo(DIAL_X, DIAL_Y);
    this.needle.lineTo(tipX, tipY);
    this.needle.strokePath();
    this.needle.fillStyle(0xffd34d, 1);
    this.needle.fillCircle(DIAL_X, DIAL_Y, 8);
  }

  private updateShiftText(): void {
    this.shiftText.setText(`Shift: ${this.shift}`);
    const challenge = this.ciphers[this.index];
    this.decodedText.setText(caesarDecode(challenge.ciphertext, this.shift));
  }

  private startCipher(): void {
    const challenge = this.ciphers[this.index];
    this.roundText.setText(`Intercepted message ${this.index + 1} of ${CIPHER_COUNT} — ${challenge.hint}`);
    this.cipherText.setText(challenge.ciphertext);
    this.updateShiftText();
    this.hints = new HintTracker([
      { level: 1, text: 'Rotate the wheel — watch the green preview text below the code.' },
      { level: 2, text: `The shift is ${challenge.shift}.` },
    ]);
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this message!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private submit(): void {
    if (this.locked) return;
    const challenge = this.ciphers[this.index];
    if (checkShift(challenge, this.shift)) {
      sfx.success();
      this.hud.registerStreak(true);
      burstSuccess(this, DIAL_X, DIAL_Y, 0xb22234);
      this.index += 1;
      if (this.index >= CIPHER_COUNT) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.time.delayedCall(400, () => this.startCipher());
      }
    } else {
      sfx.error();
      this.hud.registerStreak(false);
      this.mistakes += 1;
      burstError(this, DIAL_X, DIAL_Y);
      showToast(this, 'That shift reads as gibberish — keep turning the wheel!', PALETTE.danger);
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
      eraId: 'revolution',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'Spycraft of the Culper Ring',
        body: "George Washington's Culper spy ring used codebooks, invisible ink, and letter-substitution ciphers to smuggle intelligence past British lines in New York — decades before Thomas Jefferson's famous cipher wheel formalized the idea.",
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
