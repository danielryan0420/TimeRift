import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  applyRoundOutcome,
  BOSS_MAX_HP,
  currentRoundEra,
  initBossFight,
  isBossDefeated,
  isPlayerDefeated,
  type BossState,
} from '../core/puzzles/boss';
import { checkAnswer, generateBlocks, TOOL_INFO, TOOLS, type BlockChallenge } from '../core/puzzles/egypt';
import { checkLock, generateLockPuzzle, type LockPuzzle } from '../core/puzzles/rome';
import { evaluateLeg, generateVoyage, type VoyageLeg } from '../core/puzzles/vikings';
import { evaluateShot, generateTargets, projectileRangeM, type SiegeTarget } from '../core/puzzles/castle';
import { evaluatePlacement, generateCanvases, type CanvasChallenge } from '../core/puzzles/florence';
import { caesarDecode, checkShift, generateCiphers, type CipherChallenge } from '../core/puzzles/revolution';
import { evaluateOrder, generateSolvableOrder, outputRpm, type FactoryOrder } from '../core/puzzles/industrial';
import { deltaV, evaluateLaunch, thrustToWeightRatio } from '../core/puzzles/moon';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { burstError, burstSuccess } from '../ui/particles';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { skyGradient, starField } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';

const VILLAIN_X = GAME_WIDTH / 2;
const VILLAIN_Y = 170;
const PUZZLE_Y = 300;

const ERA_LABEL: Record<string, string> = {
  egypt: 'Ancient Egypt',
  rome: 'Ancient Rome',
  vikings: 'Viking Seas',
  castle: 'Medieval Castle',
  florence: 'Renaissance Florence',
  revolution: 'American Revolution',
  industrial: 'Industrial Revolution',
  moon: 'Moon Landing',
};

const MOON_MISSION = { dryMassKg: 5500, requiredDeltaVMs: 3400, thrustN: 300_000, exhaustVelocityMs: 3000, maxFuelKg: 24_000 };

/**
 * 45 degrees maximizes range, so a counterweight-only slider can never hit short-range
 * targets at that angle no matter how light it's set — 20 degrees still spans the full
 * generated target distance range (see tests/boss-solvability.test.ts).
 */
const BOSS_CASTLE_ANGLE_DEG = 20;

export class BossEraScene extends Phaser.Scene {
  private bossState!: BossState;
  private fightOver = false;
  private dragMode: 'vikings' | 'castle' | 'florence' | 'revolution' | 'industrial' | 'moon' | null = null;

  private puzzleLayer!: Phaser.GameObjects.Container;
  private villain!: Phaser.GameObjects.Container;
  private villainEyes!: Phaser.GameObjects.Arc[];
  private bossHpBar!: Phaser.GameObjects.Graphics;
  private heartsText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private submitBtn?: Phaser.GameObjects.Container;

  // Per-round working state.
  private egyptBlock?: BlockChallenge;
  private romePuzzle?: LockPuzzle;
  private romeAttempt: string[] = [];
  private romeTiles: Phaser.GameObjects.Container[] = [];
  private vikingsLeg?: VoyageLeg;
  private vikingsBearing = 0;
  private vikingsNeedle?: Phaser.GameObjects.Graphics;
  private castleTarget?: SiegeTarget;
  private castleCwKg = 1500;
  private castleHandle?: Phaser.GameObjects.Arc;
  private castleReadout?: Phaser.GameObjects.Text;
  private florenceCanvas?: CanvasChallenge;
  private florenceLineX = 0;
  private florenceFrameX = 0;
  private florenceHandle?: Phaser.GameObjects.Arc;
  private florenceLine?: Phaser.GameObjects.Graphics;
  private revolutionCipher?: CipherChallenge;
  private revolutionShift = 0;
  private revolutionNeedle?: Phaser.GameObjects.Graphics;
  private revolutionDecoded?: Phaser.GameObjects.Text;
  private industrialOrder?: FactoryOrder;
  private industrialDrivenTeeth = 40;
  private industrialHandle?: Phaser.GameObjects.Arc;
  private industrialReadout?: Phaser.GameObjects.Text;
  private moonFuelKg = 8000;
  private moonHandle?: Phaser.GameObjects.Arc;
  private moonReadout?: Phaser.GameObjects.Text;

  // Slider/frame geometry for the currently active round (set when each round builds its layout).
  private sliderX = 0;
  private sliderW = 0;
  private florenceFrameY = 0;
  private florenceFrameH = 0;

  constructor() {
    super('BossEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.bossState = initBossFight();
    this.fightOver = false;
    this.dragMode = null;

    this.drawBackground();
    this.drawVillain();

    new EraHUD(this, {
      title: 'Final Showdown: The Chronarch',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.bossHpBar = this.add.graphics();
    this.heartsText = this.add.text(GAME_WIDTH / 2, 100, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
    }).setOrigin(0.5);

    this.roundText = this.add.text(GAME_WIDTH / 2, 230, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 760 },
    }).setOrigin(0.5);

    this.puzzleLayer = this.add.container(0, 0);

    this.input.on('pointerup', () => { this.dragMode = null; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));

    this.updateHpDisplays();
    this.startCurrentRound();
    portalIn(this);
  }

  private drawBackground(): void {
    skyGradient(this, 0x1a0a2e, 0x3a0d2e);
    starField(this, 80);
    const ground = this.add.graphics();
    ground.fillStyle(0x0d0620, 1);
    ground.fillRect(0, 540, GAME_WIDTH, GAME_HEIGHT - 540);
  }

  private drawVillain(): void {
    this.villain = this.add.container(VILLAIN_X, VILLAIN_Y);
    const cloak = this.add.graphics();
    cloak.fillStyle(0x2a1240, 1);
    cloak.fillTriangle(-50, 50, 50, 50, 0, -60);
    cloak.fillCircle(0, -60, 34);
    cloak.lineStyle(3, 0x7c3aed, 0.8);
    cloak.strokeTriangle(-50, 50, 50, 50, 0, -60);
    this.villainEyes = [
      this.add.circle(-12, -62, 5, 0xff3b3b, 1),
      this.add.circle(12, -62, 5, 0xff3b3b, 1),
    ];
    this.villain.add([cloak, ...this.villainEyes]);
    this.tweens.add({ targets: this.villain, y: VILLAIN_Y - 10, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.villainEyes, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1 });
  }

  private shakeVillain(): void {
    this.tweens.add({ targets: this.villain, x: VILLAIN_X + 12, duration: 60, yoyo: true, repeat: 4 });
  }

  private updateHpDisplays(): void {
    this.bossHpBar.clear();
    const barW = 500;
    const barX = GAME_WIDTH / 2 - barW / 2;
    const barY = 64;
    this.bossHpBar.fillStyle(0x3a2a40, 1);
    this.bossHpBar.fillRoundedRect(barX, barY, barW, 18, 8);
    const ratio = this.bossState.bossHp / BOSS_MAX_HP;
    this.bossHpBar.fillStyle(0xff3b6b, 1);
    this.bossHpBar.fillRoundedRect(barX, barY, barW * ratio, 18, 8);
    this.bossHpBar.lineStyle(2, 0xffffff, 0.4);
    this.bossHpBar.strokeRoundedRect(barX, barY, barW, 18, 8);

    this.heartsText.setText('❤️'.repeat(this.bossState.playerHp) + '🖤'.repeat(5 - this.bossState.playerHp));
  }

  private clearPuzzleLayer(): void {
    this.puzzleLayer.removeAll(true);
    this.romeTiles = [];
    this.submitBtn?.destroy();
    this.submitBtn = undefined;
  }

  private setSubmit(label: string, onClick: () => void): void {
    this.submitBtn?.destroy();
    this.submitBtn = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 44, label, onClick, { width: 220, height: 50 });
  }

  private startCurrentRound(): void {
    this.clearPuzzleLayer();
    const era = currentRoundEra(this.bossState);
    if (!era) return;
    const seed = Math.floor(Math.random() * 1e9);
    this.roundText.setText(`Trial ${this.bossState.roundIndex + 1} of ${BOSS_MAX_HP}: ${ERA_LABEL[era]}`);

    switch (era) {
      case 'egypt': return this.startEgyptRound(seed);
      case 'rome': return this.startRomeRound(seed);
      case 'vikings': return this.startVikingsRound(seed);
      case 'castle': return this.startCastleRound(seed);
      case 'florence': return this.startFlorenceRound(seed);
      case 'revolution': return this.startRevolutionRound(seed);
      case 'industrial': return this.startIndustrialRound(seed);
      case 'moon': return this.startMoonRound();
    }
  }

  private showHint(): void {
    const era = currentRoundEra(this.bossState);
    const hints: Record<string, string> = {
      egypt: 'Match the tool to the situation, just like raising the pyramid.',
      rome: 'Build the Roman numeral tile by tile, then open the lock.',
      vikings: 'Drag inside the dial to aim toward the clue bearing.',
      castle: 'A bigger counterweight sends the shot farther.',
      florence: 'The golden ratio splits the frame unevenly — favor one side.',
      revolution: 'Watch the green decoded preview as you turn the wheel.',
      industrial: 'Output RPM = input RPM × drive teeth ÷ driven teeth.',
      moon: 'More fuel adds delta-v but also weight — balance thrust against mass.',
    };
    showToast(this, `💡 ${hints[era ?? ''] ?? 'Trust your training!'}`, PALETTE.gold);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragMode || this.fightOver) return;
    if (this.dragMode === 'vikings' && this.vikingsNeedle) {
      const angle = Phaser.Math.Angle.Between(GAME_WIDTH / 2, PUZZLE_Y + 70, pointer.x, pointer.y);
      const deg = (Phaser.Math.RadToDeg(angle) + 90 + 360) % 360;
      this.vikingsBearing = Math.round(deg / 5) * 5;
      this.drawVikingsNeedle();
    } else if (this.dragMode === 'castle' && this.castleHandle) {
      this.setCastleFromX(pointer.x);
    } else if (this.dragMode === 'florence' && this.florenceHandle) {
      this.setFlorenceFromX(pointer.x);
    } else if (this.dragMode === 'revolution' && this.revolutionNeedle) {
      const angle = Phaser.Math.Angle.Between(GAME_WIDTH / 2, PUZZLE_Y + 70, pointer.x, pointer.y);
      const deg = (Phaser.Math.RadToDeg(angle) + 90 + 360) % 360;
      this.revolutionShift = Math.round(deg / (360 / 26)) % 26;
      this.drawRevolutionNeedle();
    } else if (this.dragMode === 'industrial' && this.industrialHandle) {
      this.setIndustrialFromX(pointer.x);
    } else if (this.dragMode === 'moon' && this.moonHandle) {
      this.setMoonFromX(pointer.x);
    }
  }

  private resolveRound(success: boolean): void {
    if (this.fightOver) return;
    if (success) {
      sfx.success();
      burstSuccess(this, VILLAIN_X, VILLAIN_Y, 0xff3b6b);
      this.shakeVillain();
    } else {
      sfx.error();
      burstError(this, GAME_WIDTH / 2, PUZZLE_Y);
    }
    this.bossState = applyRoundOutcome(this.bossState, success);
    this.updateHpDisplays();

    if (isBossDefeated(this.bossState)) {
      this.fightOver = true;
      this.time.delayedCall(700, () => this.victory());
      return;
    }
    if (isPlayerDefeated(this.bossState)) {
      this.fightOver = true;
      this.time.delayedCall(700, () => this.defeat());
      return;
    }
    if (success) {
      this.time.delayedCall(500, () => this.startCurrentRound());
    } else {
      showToast(this, 'The Chronarch resists — try again!', PALETTE.danger);
    }
  }

  // --- Egypt round: tap the right tool. ---
  private startEgyptRound(seed: number): void {
    this.egyptBlock = generateBlocks(1, seed)[0];
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y, 'Choose the right tool to break the Chronarch\'s stone shield!', {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5);
    this.puzzleLayer.add(text);
    const spacing = 160;
    const startX = GAME_WIDTH / 2 - (spacing * (TOOLS.length - 1)) / 2;
    TOOLS.forEach((tool, i) => {
      const btn = createButton(this, startX + i * spacing, PUZZLE_Y + 80, TOOL_INFO[tool].label, () => {
        this.resolveRound(checkAnswer(this.egyptBlock!, tool));
      }, { width: 150, height: 56 });
      this.puzzleLayer.add(btn);
    });
  }

  // --- Rome round: build the numeral, then submit. ---
  private startRomeRound(seed: number): void {
    this.romePuzzle = generateLockPuzzle(seed, 1, 40);
    this.romeAttempt = [];
    const target = this.add.text(GAME_WIDTH / 2, PUZZLE_Y, `Build the Roman numeral lock for ${this.romePuzzle.target} to pierce the shield.`, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5);
    const attemptText = this.add.text(GAME_WIDTH / 2, PUZZLE_Y + 36, '_', {
      fontFamily: FONT_FAMILY, fontSize: '28px', color: PALETTE.gold,
    }).setOrigin(0.5);
    this.puzzleLayer.add([target, attemptText]);

    const spacing = 70;
    const startX = GAME_WIDTH / 2 - (spacing * (this.romePuzzle.tiles.length - 1)) / 2;
    this.romePuzzle.tiles.forEach((symbol, i) => {
      const btn = createButton(this, startX + i * spacing, PUZZLE_Y + 90, symbol, () => {
        if (!btn.active) return;
        this.romeAttempt.push(symbol);
        btn.disableInteractive();
        btn.setAlpha(0.35);
        attemptText.setText(this.romeAttempt.join('') || '_');
      }, { width: 56, height: 56, fontSize: 24, fillColor: 0xb8402f, hoverColor: 0xd94f3d });
      this.romeTiles.push(btn);
      this.puzzleLayer.add(btn);
    });

    this.setSubmit('Open Lock!', () => {
      const success = checkLock(this.romePuzzle!.target, this.romeAttempt.join(''));
      if (!success) {
        this.romeAttempt = [];
        attemptText.setText('_');
        this.romeTiles.forEach((b) => { b.setInteractive({ useHandCursor: true }); b.setAlpha(1); });
      }
      this.resolveRound(success);
    });
  }

  // --- Vikings round: drag the dial to the bearing. ---
  private startVikingsRound(seed: number): void {
    this.vikingsLeg = generateVoyage(1, seed)[0];
    this.vikingsBearing = 0;
    const clue = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 10, this.vikingsLeg.clue, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5);
    const dialY = PUZZLE_Y + 70;
    const ring = this.add.graphics();
    ring.lineStyle(4, 0x7ad1e0, 0.8);
    ring.strokeCircle(GAME_WIDTH / 2, dialY, 90);
    ring.fillStyle(0x0d1b2a, 0.6);
    ring.fillCircle(GAME_WIDTH / 2, dialY, 86);
    this.vikingsNeedle = this.add.graphics();
    const zone = this.add.circle(GAME_WIDTH / 2, dialY, 90).setInteractive();
    zone.on('pointerdown', () => { this.dragMode = 'vikings'; });
    this.puzzleLayer.add([clue, ring, this.vikingsNeedle, zone]);
    this.drawVikingsNeedle();

    this.setSubmit('Set Course!', () => {
      const outcome = evaluateLeg(this.vikingsLeg!, this.vikingsBearing);
      this.resolveRound(outcome.success);
    });
  }

  private drawVikingsNeedle(): void {
    if (!this.vikingsNeedle) return;
    const dialY = PUZZLE_Y + 70;
    this.vikingsNeedle.clear();
    const rad = Phaser.Math.DegToRad(this.vikingsBearing - 90);
    const tipX = GAME_WIDTH / 2 + Math.cos(rad) * 74;
    const tipY = dialY + Math.sin(rad) * 74;
    this.vikingsNeedle.lineStyle(6, 0xffd34d, 1);
    this.vikingsNeedle.beginPath();
    this.vikingsNeedle.moveTo(GAME_WIDTH / 2, dialY);
    this.vikingsNeedle.lineTo(tipX, tipY);
    this.vikingsNeedle.strokePath();
    this.vikingsNeedle.fillStyle(0xffd34d, 1);
    this.vikingsNeedle.fillCircle(GAME_WIDTH / 2, dialY, 7);
  }

  // --- Castle round: one slider (counterweight, angle fixed at BOSS_CASTLE_ANGLE_DEG). ---
  private startCastleRound(seed: number): void {
    this.castleTarget = generateTargets(1, seed)[0];
    this.castleCwKg = 1500;
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 20, `Hit ${this.castleTarget.wallLabel}, ${this.castleTarget.targetDistanceM} m away.`, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight,
    }).setOrigin(0.5);

    const sliderX = GAME_WIDTH / 2 - 200;
    const sliderW = 400;
    const sliderY = PUZZLE_Y + 30;
    const track = this.add.rectangle(sliderX + sliderW / 2, sliderY, sliderW, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    this.castleHandle = this.add.circle(sliderX, sliderY, 16, 0xc77b2e).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.castleReadout = this.add.text(GAME_WIDTH / 2, sliderY + 40, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    this.castleHandle.on('pointerdown', () => { this.dragMode = 'castle'; });
    track.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragMode = 'castle'; this.setCastleFromX(p.x); });
    this.puzzleLayer.add([text, track, this.castleHandle, this.castleReadout]);
    this.sliderX = sliderX;
    this.sliderW = sliderW;
    this.updateCastleReadout();

    this.setSubmit('🔥 Fire!', () => {
      const outcome = evaluateShot(this.castleTarget!, { counterweightKg: this.castleCwKg, releaseAngleDeg: BOSS_CASTLE_ANGLE_DEG });
      this.resolveRound(outcome.success);
    });
  }

  private setCastleFromX(pointerX: number): void {
    const ratio = Phaser.Math.Clamp((pointerX - this.sliderX) / this.sliderW, 0, 1);
    this.castleCwKg = Math.round((500 + ratio * 2500) / 50) * 50;
    this.castleHandle?.setX(this.sliderX + ratio * this.sliderW);
    this.updateCastleReadout();
  }

  private updateCastleReadout(): void {
    const range = projectileRangeM({ counterweightKg: this.castleCwKg, releaseAngleDeg: BOSS_CASTLE_ANGLE_DEG });
    this.castleReadout?.setText(`${this.castleCwKg} kg counterweight → predicted range ${range.toFixed(0)} m`);
  }

  // --- Florence round: drag the focal line to the golden ratio point. ---
  private startFlorenceRound(seed: number): void {
    this.florenceCanvas = generateCanvases(1, seed)[0];
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, `Place the focal line for ${this.florenceCanvas.subject} using the golden ratio.`, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5);

    this.florenceFrameX = (GAME_WIDTH - this.florenceCanvas.widthPx) / 2;
    const frameY = PUZZLE_Y;
    const frameH = 150;
    const frame = this.add.rectangle(GAME_WIDTH / 2, frameY + frameH / 2, this.florenceCanvas.widthPx, frameH, 0xf6ead0, 0.15).setStrokeStyle(3, 0xeab676, 0.8);
    this.florenceLine = this.add.graphics();
    this.florenceLineX = this.florenceCanvas.widthPx / 2;
    this.florenceHandle = this.add.circle(0, frameY - 14, 14, 0xb5422e).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(14, 14, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.florenceHandle.on('pointerdown', () => { this.dragMode = 'florence'; });
    this.puzzleLayer.add([text, frame, this.florenceLine, this.florenceHandle]);
    this.florenceFrameY = frameY;
    this.florenceFrameH = frameH;
    this.redrawFlorenceLine();

    this.setSubmit('Set Composition', () => {
      const outcome = evaluatePlacement(this.florenceCanvas!, this.florenceLineX);
      this.resolveRound(outcome.success);
    });
  }

  private setFlorenceFromX(pointerX: number): void {
    if (!this.florenceCanvas) return;
    this.florenceLineX = Phaser.Math.Clamp(pointerX - this.florenceFrameX, 0, this.florenceCanvas.widthPx);
    this.redrawFlorenceLine();
  }

  private redrawFlorenceLine(): void {
    if (!this.florenceLine || !this.florenceHandle) return;
    const absoluteX = this.florenceFrameX + this.florenceLineX;
    this.florenceHandle.setX(absoluteX);
    this.florenceLine.clear();
    this.florenceLine.lineStyle(4, 0xb5422e, 0.9);
    this.florenceLine.beginPath();
    this.florenceLine.moveTo(absoluteX, this.florenceFrameY);
    this.florenceLine.lineTo(absoluteX, this.florenceFrameY + this.florenceFrameH);
    this.florenceLine.strokePath();
  }

  // --- Revolution round: rotate the cipher wheel. ---
  private startRevolutionRound(seed: number): void {
    this.revolutionCipher = generateCiphers(1, seed)[0];
    this.revolutionShift = 0;
    const cipherText = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, this.revolutionCipher.ciphertext, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.danger, align: 'center', wordWrap: { width: 650 },
    }).setOrigin(0.5);
    this.revolutionDecoded = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 6, '', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.success, align: 'center', wordWrap: { width: 650 },
    }).setOrigin(0.5);

    const dialY = PUZZLE_Y + 70;
    const ring = this.add.graphics();
    ring.lineStyle(4, 0xb22234, 0.8);
    ring.strokeCircle(GAME_WIDTH / 2, dialY, 85);
    ring.fillStyle(0x16263a, 0.7);
    ring.fillCircle(GAME_WIDTH / 2, dialY, 81);
    this.revolutionNeedle = this.add.graphics();
    const zone = this.add.circle(GAME_WIDTH / 2, dialY, 85).setInteractive();
    zone.on('pointerdown', () => { this.dragMode = 'revolution'; });
    this.puzzleLayer.add([cipherText, this.revolutionDecoded, ring, this.revolutionNeedle, zone]);
    this.drawRevolutionNeedle();

    this.setSubmit('Decode!', () => {
      this.resolveRound(checkShift(this.revolutionCipher!, this.revolutionShift));
    });
  }

  private drawRevolutionNeedle(): void {
    if (!this.revolutionNeedle || !this.revolutionCipher) return;
    const dialY = PUZZLE_Y + 70;
    this.revolutionNeedle.clear();
    const rad = Phaser.Math.DegToRad((this.revolutionShift * 360) / 26 - 90);
    const tipX = GAME_WIDTH / 2 + Math.cos(rad) * 68;
    const tipY = dialY + Math.sin(rad) * 68;
    this.revolutionNeedle.lineStyle(6, 0xffd34d, 1);
    this.revolutionNeedle.beginPath();
    this.revolutionNeedle.moveTo(GAME_WIDTH / 2, dialY);
    this.revolutionNeedle.lineTo(tipX, tipY);
    this.revolutionNeedle.strokePath();
    this.revolutionNeedle.fillStyle(0xffd34d, 1);
    this.revolutionNeedle.fillCircle(GAME_WIDTH / 2, dialY, 7);
    this.revolutionDecoded?.setText(caesarDecode(this.revolutionCipher.ciphertext, this.revolutionShift));
  }

  // --- Industrial round: slider for driven gear teeth (drive fixed at 20). ---
  private startIndustrialRound(seed: number): void {
    this.industrialOrder = generateSolvableOrder(seed, 20);
    this.industrialDrivenTeeth = 40;
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, `Drive ${this.industrialOrder.machine} at ${this.industrialOrder.targetRpm} RPM (input: ${this.industrialOrder.inputRpm} RPM, drive gear: 20 teeth).`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight, align: 'center', wordWrap: { width: 650 },
    }).setOrigin(0.5);

    const sliderX = GAME_WIDTH / 2 - 200;
    const sliderW = 400;
    const sliderY = PUZZLE_Y + 40;
    const track = this.add.rectangle(sliderX + sliderW / 2, sliderY, sliderW, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    this.industrialHandle = this.add.circle(sliderX, sliderY, 16, 0xffd34d).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.industrialReadout = this.add.text(GAME_WIDTH / 2, sliderY + 40, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    this.industrialHandle.on('pointerdown', () => { this.dragMode = 'industrial'; });
    track.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragMode = 'industrial'; this.setIndustrialFromX(p.x); });
    this.puzzleLayer.add([text, track, this.industrialHandle, this.industrialReadout]);
    this.sliderX = sliderX;
    this.sliderW = sliderW;
    this.updateIndustrialReadout();

    this.setSubmit('⚙️ Engage!', () => {
      const outcome = evaluateOrder(this.industrialOrder!, { driveTeeth: 20, drivenTeeth: this.industrialDrivenTeeth });
      this.resolveRound(outcome.success);
    });
  }

  private setIndustrialFromX(pointerX: number): void {
    const ratio = Phaser.Math.Clamp((pointerX - this.sliderX) / this.sliderW, 0, 1);
    this.industrialDrivenTeeth = Math.round(10 + ratio * 90);
    this.industrialHandle?.setX(this.sliderX + ratio * this.sliderW);
    this.updateIndustrialReadout();
  }

  private updateIndustrialReadout(): void {
    if (!this.industrialOrder) return;
    const rpm = outputRpm({ inputRpm: this.industrialOrder.inputRpm, driveTeeth: 20, drivenTeeth: this.industrialDrivenTeeth });
    this.industrialReadout?.setText(`${this.industrialDrivenTeeth} driven teeth → output ${rpm.toFixed(0)} RPM`);
  }

  // --- Moon round: fuel slider (engine fixed). ---
  private startMoonRound(): void {
    this.moonFuelKg = 8000;
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, `Reach the escape velocity delta-v of ${MOON_MISSION.requiredDeltaVMs} m/s without overloading the launch frame.`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight, align: 'center', wordWrap: { width: 650 },
    }).setOrigin(0.5);

    const sliderX = GAME_WIDTH / 2 - 200;
    const sliderW = 400;
    const sliderY = PUZZLE_Y + 40;
    const track = this.add.rectangle(sliderX + sliderW / 2, sliderY, sliderW, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    this.moonHandle = this.add.circle(sliderX, sliderY, 16, 0xd8d8e8).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.moonReadout = this.add.text(GAME_WIDTH / 2, sliderY + 40, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    this.moonHandle.on('pointerdown', () => { this.dragMode = 'moon'; });
    track.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragMode = 'moon'; this.setMoonFromX(p.x); });
    this.puzzleLayer.add([text, track, this.moonHandle, this.moonReadout]);
    this.sliderX = sliderX;
    this.sliderW = sliderW;
    this.updateMoonReadout();

    this.setSubmit('🚀 Launch!', () => {
      const cfg = { thrustN: MOON_MISSION.thrustN, dryMassKg: MOON_MISSION.dryMassKg, fuelMassKg: this.moonFuelKg, exhaustVelocityMs: MOON_MISSION.exhaustVelocityMs };
      const result = evaluateLaunch(cfg, MOON_MISSION.requiredDeltaVMs);
      this.resolveRound(result.success);
    });
  }

  private setMoonFromX(pointerX: number): void {
    const ratio = Phaser.Math.Clamp((pointerX - this.sliderX) / this.sliderW, 0, 1);
    this.moonFuelKg = Math.round((ratio * MOON_MISSION.maxFuelKg) / 200) * 200;
    this.moonHandle?.setX(this.sliderX + ratio * this.sliderW);
    this.updateMoonReadout();
  }

  private updateMoonReadout(): void {
    const cfg = { thrustN: MOON_MISSION.thrustN, dryMassKg: MOON_MISSION.dryMassKg, fuelMassKg: this.moonFuelKg, exhaustVelocityMs: MOON_MISSION.exhaustVelocityMs };
    const twr = thrustToWeightRatio(cfg);
    const dv = deltaV(cfg);
    this.moonReadout?.setText(`Fuel: ${this.moonFuelKg.toLocaleString()} kg — T/W ${twr.toFixed(2)}, Δv ${Math.round(dv)} m/s`);
  }

  private victory(): void {
    this.puzzleLayer.removeAll(true);
    this.submitBtn?.destroy();
    this.submitBtn = undefined;
    showToast(this, 'The Chronarch dissolves — the timeline is whole again!', PALETTE.success);
    this.time.delayedCall(1200, () => portalOut(this, () => this.scene.start('BossComplete')));
  }

  private defeat(): void {
    this.puzzleLayer.removeAll(true);
    this.submitBtn?.destroy();
    this.submitBtn = undefined;
    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.92);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 260, PUZZLE_Y - 20, 520, 160, 16);
    this.add.text(GAME_WIDTH / 2, PUZZLE_Y + 10, 'The Chronarch overwhelms you this time...', {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: PALETTE.danger, align: 'center', wordWrap: { width: 460 },
    }).setOrigin(0.5);
    createButton(this, GAME_WIDTH / 2, PUZZLE_Y + 90, 'Try Again', () => this.scene.restart(), { width: 220 });
  }
}
