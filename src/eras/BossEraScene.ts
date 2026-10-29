import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  applyRoundOutcome,
  BOSS_MAX_HP,
  BOSS_ROUND_GOAL,
  BOSS_ROUND_HOWTO,
  castleBossHints,
  chinaBossHints,
  currentRoundEra,
  egyptBossHints,
  flightBossHints,
  florenceBossHints,
  industrialBossHints,
  initBossFight,
  isBossDefeated,
  isPlayerDefeated,
  moonBossHints,
  revolutionBossHints,
  romeBossHints,
  vikingsBossHints,
  type BossState,
} from '../core/puzzles/boss';
import { checkAnswer, generateBlocks, TOOL_INFO, TOOLS, type BlockChallenge } from '../core/puzzles/egypt';
import { checkLock, generateLockPuzzle, type LockPuzzle } from '../core/puzzles/rome';
import { checkGood, generateStops, GOOD_INFO, GOOD_STATS, GOODS, type CaravanStop } from '../core/puzzles/china';
import { evaluateLeg, generateVoyage, type VoyageLeg } from '../core/puzzles/vikings';
import { evaluateShot, generateTargets, type SiegeTarget } from '../core/puzzles/castle';
import { evaluatePlacement, generateCanvases, type CanvasChallenge } from '../core/puzzles/florence';
import { caesarDecode, checkShift, generateCiphers, type CipherChallenge } from '../core/puzzles/revolution';
import { evaluateOrder, generateSolvableOrder, type FactoryOrder } from '../core/puzzles/industrial';
import { evaluateLaunch } from '../core/puzzles/moon';
import { evaluateFlight, generateAttempts, MAX_SLIDER_SPEED_MS, type FlightAttempt } from '../core/puzzles/flight';
import { HintTracker } from '../core/hints';
import { EraHUD } from '../ui/HUD';
import { createButton } from '../ui/GameButton';
import { showHowToPlayCard } from '../ui/HowToPlayCard';
import { burstError, burstSuccess } from '../ui/particles';
import { drawZoneBand } from '../ui/zoneMeter';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, TOP_SHIFT, PALETTE, fitWidth } from '../ui/theme';
import { skyGradient, starField } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { showToast } from '../ui/toast';

const VILLAIN_X = GAME_WIDTH / 2;
const VILLAIN_Y = 170 + TOP_SHIFT;
// 340 (not 300): howToText above this can wrap to 2 lines ("Drag the slider into the green
// zone, then Engage.") at the same time as a round's own instruction text 2-lines too (e.g.
// industrial's long machine/RPM readout) — 300 let those collide by ~30px in portrait.
const PUZZLE_Y = 340 + TOP_SHIFT;
/** Round sliders (castle/industrial/moon/flight) share this narrower-on-portrait width. */
const ROUND_SLIDER_W = IS_PORTRAIT ? GAME_WIDTH - 80 : 400;
const ROUND_SLIDER_X = GAME_WIDTH / 2 - ROUND_SLIDER_W / 2;

const ERA_LABEL: Record<string, string> = {
  egypt: 'Ancient Egypt',
  rome: 'Ancient Rome',
  china: 'Ancient China',
  vikings: 'Viking Seas',
  castle: 'Medieval Castle',
  florence: 'Renaissance Florence',
  revolution: 'American Revolution',
  industrial: 'Industrial Revolution',
  flight: 'Age of Flight',
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
  private dragMode: 'vikings' | 'castle' | 'florence' | 'revolution' | 'industrial' | 'moon' | 'flight' | null = null;

  private puzzleLayer!: Phaser.GameObjects.Container;
  private hud!: EraHUD;
  private villain!: Phaser.GameObjects.Container;
  private villainEyes!: Phaser.GameObjects.Arc[];
  private bossHpBar!: Phaser.GameObjects.Graphics;
  private heartsText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private howToText!: Phaser.GameObjects.Text;
  private hints!: HintTracker;
  private submitBtn?: Phaser.GameObjects.Container;

  // Per-round working state.
  private egyptBlock?: BlockChallenge;
  private romePuzzle?: LockPuzzle;
  private romeAttempt: string[] = [];
  private romeTiles: Phaser.GameObjects.Container[] = [];
  private chinaStop?: CaravanStop;
  private vikingsLeg?: VoyageLeg;
  private vikingsBearing = 0;
  private vikingsNeedle?: Phaser.GameObjects.Graphics;
  private castleTarget?: SiegeTarget;
  private castleCwKg = 1500;
  private castleHandle?: Phaser.GameObjects.Arc;
  private castleReadout?: Phaser.GameObjects.Text;
  private castleZoneBand?: Phaser.GameObjects.Rectangle;
  private florenceCanvas?: CanvasChallenge;
  private florenceLineX = 0;
  private florenceFrameX = 0;
  private florenceVisualScale = 1;
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
  private industrialZoneBand?: Phaser.GameObjects.Rectangle;
  private moonFuelKg = 8000;
  private moonHandle?: Phaser.GameObjects.Arc;
  private moonReadout?: Phaser.GameObjects.Text;
  private moonZoneBand?: Phaser.GameObjects.Rectangle;
  private flightAttempt?: FlightAttempt;
  private flightSpeedMs = 0;
  private flightHandle?: Phaser.GameObjects.Arc;
  private flightReadout?: Phaser.GameObjects.Text;
  private flightZoneBand?: Phaser.GameObjects.Rectangle;

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

    this.hud = new EraHUD(this, {
      title: 'Final Showdown: The Chronarch',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.bossHpBar = this.add.graphics();
    this.heartsText = this.add.text(GAME_WIDTH / 2, 100 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
    }).setOrigin(0.5);

    this.roundText = this.add.text(GAME_WIDTH / 2, 215 + TOP_SHIFT, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: fitWidth(760), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    // Repositioned in startCurrentRound() from roundText's measured height: some howTo
    // lines ("Drag inside the wheel until the green preview reads clearly.") wrap to 2
    // lines in portrait and used to sit only ~4px below roundText at the old fixed y's.
    this.howToText = this.add.text(GAME_WIDTH / 2, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: fitWidth(700), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    this.puzzleLayer = this.add.container(0, 0);

    this.input.on('pointerup', () => { this.dragMode = null; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));

    this.updateHpDisplays();
    this.startCurrentRound();
    portalIn(this);
    this.showIntroCards();
  }

  private showIntroCards(): void {
    showHowToPlayCard(this, {
      title: 'The Final Showdown',
      line: 'Each round reuses a skill you already learned from an earlier era — tools, numerals, trade goods, navigation, and more. Solve the round to chip the Chronarch\'s health; a wrong answer costs you one of your hearts.',
      dismissLabel: 'Got it!',
      onDismiss: () => {},
    });
  }

  private drawBackground(): void {
    skyGradient(this, 0x1a0a2e, 0x3a0d2e);
    starField(this, 80);
    const ground = this.add.graphics();
    ground.fillStyle(0x0d0620, 1);
    const groundTop = 540 + TOP_SHIFT;
    ground.fillRect(0, groundTop, GAME_WIDTH, GAME_HEIGHT - groundTop);
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
    const barW = fitWidth(500);
    const barX = GAME_WIDTH / 2 - barW / 2;
    const barY = 64 + TOP_SHIFT;
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
    this.howToText.setText(BOSS_ROUND_HOWTO[era]);
    this.howToText.setY(this.roundText.y + this.roundText.displayHeight + 8);
    this.hud.setGoal(BOSS_ROUND_GOAL[era]);

    switch (era) {
      case 'egypt': return this.startEgyptRound(seed);
      case 'rome': return this.startRomeRound(seed);
      case 'china': return this.startChinaRound(seed);
      case 'vikings': return this.startVikingsRound(seed);
      case 'castle': return this.startCastleRound(seed);
      case 'florence': return this.startFlorenceRound(seed);
      case 'revolution': return this.startRevolutionRound(seed);
      case 'industrial': return this.startIndustrialRound(seed);
      case 'flight': return this.startFlightRound(seed);
      case 'moon': return this.startMoonRound();
    }
  }

  private showHint(): void {
    if (this.fightOver) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this trial!');
      return;
    }
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
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
    } else if (this.dragMode === 'flight' && this.flightHandle) {
      this.setFlightFromX(pointer.x);
    }
  }

  private resolveRound(success: boolean): void {
    if (this.fightOver) return;
    this.hud.registerStreak(success);
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
      const autoHint = this.hints.registerMistake();
      if (autoHint) {
        this.time.delayedCall(2300, () => showToast(this, `💡 ${autoHint.text}`, PALETTE.gold));
      }
    }
  }

  // --- Egypt round: tap the right tool. ---
  private startEgyptRound(seed: number): void {
    this.egyptBlock = generateBlocks(1, seed)[0];
    this.hints = new HintTracker(egyptBossHints(this.egyptBlock));
    const text = this.add.text(
      GAME_WIDTH / 2,
      PUZZLE_Y,
      `The Chronarch's shield block weighs ${this.egyptBlock.weightKg} kg and must move ${this.egyptBlock.distanceM} m. Choose the right tool!`,
      { fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(600), useAdvancedWrap: true } },
    ).setOrigin(0.5);
    this.puzzleLayer.add(text);
    const n = TOOLS.length;
    const width = IS_PORTRAIT ? Math.min(150, (GAME_WIDTH - 32 - 10 * (n - 1)) / n) : 150;
    const spacing = width + 10;
    const startX = GAME_WIDTH / 2 - (spacing * (n - 1)) / 2;
    TOOLS.forEach((tool, i) => {
      const btn = createButton(this, startX + i * spacing, PUZZLE_Y + 80, TOOL_INFO[tool].label, () => {
        this.resolveRound(checkAnswer(this.egyptBlock!, tool));
      }, { width, height: 56, fontSize: IS_PORTRAIT ? 16 : 22 });
      this.puzzleLayer.add(btn);
    });
  }

  // --- Rome round: build the numeral, then submit. ---
  private startRomeRound(seed: number): void {
    this.romePuzzle = generateLockPuzzle(seed, 1, 40);
    this.hints = new HintTracker(romeBossHints(this.romePuzzle.target));
    this.romeAttempt = [];
    const target = this.add.text(GAME_WIDTH / 2, PUZZLE_Y, `Build the Roman numeral lock for ${this.romePuzzle.target} to pierce the shield.`, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(600) },
    }).setOrigin(0.5);
    const attemptText = this.add.text(GAME_WIDTH / 2, PUZZLE_Y + 36, '_', {
      fontFamily: FONT_FAMILY, fontSize: '28px', color: PALETTE.gold,
    }).setOrigin(0.5);
    this.puzzleLayer.add([target, attemptText]);

    const count = this.romePuzzle.tiles.length;
    const spacing = Math.min(70, (GAME_WIDTH - 40) / Math.max(1, count - 1));
    const tileSize = Math.max(44, Math.min(56, spacing - 6));
    const startX = GAME_WIDTH / 2 - (spacing * (count - 1)) / 2;
    this.romePuzzle.tiles.forEach((symbol, i) => {
      const btn = createButton(this, startX + i * spacing, PUZZLE_Y + 90, symbol, () => {
        if (!btn.active) return;
        this.romeAttempt.push(symbol);
        btn.disableInteractive();
        btn.setAlpha(0.35);
        attemptText.setText(this.romeAttempt.join('') || '_');
      }, { width: tileSize, height: tileSize, fontSize: Math.round(tileSize * 0.43), fillColor: 0xb8402f, hoverColor: 0xd94f3d });
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

  // --- China round: tap the right trade good. ---
  private startChinaRound(seed: number): void {
    this.chinaStop = generateStops(1, seed)[0];
    this.hints = new HintTracker(chinaBossHints(this.chinaStop));
    const text = this.add.text(
      GAME_WIDTH / 2,
      PUZZLE_Y - 14,
      `Needs cargo under ${this.chinaStop.maxWeightKg} kg, worth ${this.chinaStop.minValueSilver}+ silver.`,
      { fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(600), useAdvancedWrap: true } },
    ).setOrigin(0.5);
    const reference = this.add.text(
      GAME_WIDTH / 2,
      PUZZLE_Y + 18,
      GOODS.map((g) => `${GOOD_INFO[g].label} ${GOOD_STATS[g].weightKg}kg/${GOOD_STATS[g].valueSilver}💰`).join('  •  '),
      { fontFamily: FONT_FAMILY, fontSize: '14px', color: PALETTE.gold, align: 'center', wordWrap: { width: fitWidth(650), useAdvancedWrap: true } },
    ).setOrigin(0.5, 0);
    this.puzzleLayer.add([text, reference]);
    const n = GOODS.length;
    const width = IS_PORTRAIT ? Math.min(150, (GAME_WIDTH - 32 - 10 * (n - 1)) / n) : 150;
    const spacing = width + 10;
    const startX = GAME_WIDTH / 2 - (spacing * (n - 1)) / 2;
    GOODS.forEach((good, i) => {
      const btn = createButton(this, startX + i * spacing, PUZZLE_Y + 80, GOOD_INFO[good].label, () => {
        this.resolveRound(checkGood(this.chinaStop!, good));
      }, { width, height: 56, fontSize: IS_PORTRAIT ? 16 : 22 });
      this.puzzleLayer.add(btn);
    });
  }

  // --- Vikings round: drag the dial to the bearing. ---
  private startVikingsRound(seed: number): void {
    this.vikingsLeg = generateVoyage(1, seed)[0];
    this.hints = new HintTracker(vikingsBossHints(this.vikingsLeg));
    this.vikingsBearing = 0;
    const clue = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 10, this.vikingsLeg.clue, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(600) },
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

  /** Scans a slider's full range at a fixed step and returns the [lo, hi] band where isHit is true, by re-using the real win condition — never a derived formula that could drift from it. */
  private findZone(min: number, max: number, step: number, isHit: (v: number) => boolean): [number, number] | null {
    let lo = -1;
    let hi = -1;
    for (let v = min; v <= max; v += step) {
      if (isHit(v)) {
        if (lo === -1) lo = v;
        hi = v;
      }
    }
    return lo === -1 ? null : [lo, hi];
  }

  // --- Castle round: one slider (counterweight, angle fixed at BOSS_CASTLE_ANGLE_DEG). ---
  private startCastleRound(seed: number): void {
    this.castleTarget = generateTargets(1, seed)[0];
    this.hints = new HintTracker(castleBossHints(this.castleTarget));
    this.castleCwKg = 1500;
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 20, `Hit ${this.castleTarget.wallLabel}, ${this.castleTarget.targetDistanceM} m away.`, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight,
    }).setOrigin(0.5);

    const sliderX = ROUND_SLIDER_X;
    const sliderW = ROUND_SLIDER_W;
    const sliderY = PUZZLE_Y + 30;
    const track = this.add.rectangle(sliderX + sliderW / 2, sliderY, sliderW, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    this.castleHandle = this.add.circle(sliderX, sliderY, 16, 0xc77b2e).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.castleReadout = this.add.text(GAME_WIDTH / 2, sliderY + 40, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    const zone = this.findZone(500, 3000, 50, (cw) => evaluateShot(this.castleTarget!, { counterweightKg: cw, releaseAngleDeg: BOSS_CASTLE_ANGLE_DEG }).success);
    if (zone) {
      this.castleZoneBand = drawZoneBand(this, sliderX, sliderY, sliderW, (zone[0] - 500) / 2500, (zone[1] - 500) / 2500, 18);
      this.puzzleLayer.add(this.castleZoneBand);
    }

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
    const outcome = evaluateShot(this.castleTarget!, { counterweightKg: this.castleCwKg, releaseAngleDeg: BOSS_CASTLE_ANGLE_DEG });
    if (outcome.success) {
      this.castleReadout?.setText('🎯 In the green zone!').setColor(PALETTE.success);
    } else if (outcome.tooShort) {
      this.castleReadout?.setText('⬅️ Too short — add more weight.').setColor(PALETTE.danger);
    } else {
      this.castleReadout?.setText('➡️ Too far — ease off the weight.').setColor(PALETTE.danger);
    }
  }

  // --- Florence round: drag the focal line to the golden ratio point. ---
  private startFlorenceRound(seed: number): void {
    this.florenceCanvas = generateCanvases(1, seed)[0];
    this.hints = new HintTracker(florenceBossHints(this.florenceCanvas));
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, `Place the focal line for ${this.florenceCanvas.subject} using the golden ratio.`, {
      fontFamily: FONT_FAMILY, fontSize: '17px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(600) },
    }).setOrigin(0.5);

    const maxFrameW = GAME_WIDTH - 60;
    const displayWidthPx = Math.min(this.florenceCanvas.widthPx, maxFrameW);
    this.florenceVisualScale = displayWidthPx / this.florenceCanvas.widthPx;
    this.florenceFrameX = (GAME_WIDTH - displayWidthPx) / 2;
    const frameY = PUZZLE_Y;
    const frameH = 150;
    const frame = this.add.rectangle(GAME_WIDTH / 2, frameY + frameH / 2, displayWidthPx, frameH, 0xf6ead0, 0.15).setStrokeStyle(3, 0xeab676, 0.8);
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
    this.florenceLineX = Phaser.Math.Clamp((pointerX - this.florenceFrameX) / this.florenceVisualScale, 0, this.florenceCanvas.widthPx);
    this.redrawFlorenceLine();
  }

  private redrawFlorenceLine(): void {
    if (!this.florenceLine || !this.florenceHandle) return;
    const absoluteX = this.florenceFrameX + this.florenceLineX * this.florenceVisualScale;
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
    this.hints = new HintTracker(revolutionBossHints(this.revolutionCipher));
    this.revolutionShift = 0;
    const cipherText = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, this.revolutionCipher.ciphertext, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.danger, align: 'center', wordWrap: { width: fitWidth(650) },
    }).setOrigin(0.5);
    this.revolutionDecoded = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 6, '', {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.success, align: 'center', wordWrap: { width: fitWidth(650) },
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
    this.hints = new HintTracker(industrialBossHints(this.industrialOrder, 20));
    this.industrialDrivenTeeth = 40;
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, `Drive ${this.industrialOrder.machine} at ${this.industrialOrder.targetRpm} RPM (input: ${this.industrialOrder.inputRpm} RPM, drive gear: 20 teeth).`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(650) },
    }).setOrigin(0.5);

    const sliderX = ROUND_SLIDER_X;
    const sliderW = ROUND_SLIDER_W;
    const sliderY = PUZZLE_Y + 40;
    const track = this.add.rectangle(sliderX + sliderW / 2, sliderY, sliderW, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    this.industrialHandle = this.add.circle(sliderX, sliderY, 16, 0xffd34d).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.industrialReadout = this.add.text(GAME_WIDTH / 2, sliderY + 40, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    const zone = this.findZone(10, 100, 1, (driven) => evaluateOrder(this.industrialOrder!, { driveTeeth: 20, drivenTeeth: driven }).success);
    if (zone) {
      this.industrialZoneBand = drawZoneBand(this, sliderX, sliderY, sliderW, (zone[0] - 10) / 90, (zone[1] - 10) / 90, 18);
      this.puzzleLayer.add(this.industrialZoneBand);
    }

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
    const outcome = evaluateOrder(this.industrialOrder, { driveTeeth: 20, drivenTeeth: this.industrialDrivenTeeth });
    if (outcome.success) {
      this.industrialReadout?.setText(`✅ Just right! (${outcome.outputRpm.toFixed(0)} RPM)`).setColor(PALETTE.success);
    } else if (outcome.tooSlow) {
      this.industrialReadout?.setText(`🐢 Too slow (${outcome.outputRpm.toFixed(0)} RPM) — try a smaller driven gear.`).setColor(PALETTE.danger);
    } else {
      this.industrialReadout?.setText(`🐇 Too fast (${outcome.outputRpm.toFixed(0)} RPM) — try a bigger driven gear.`).setColor(PALETTE.danger);
    }
  }

  // --- Moon round: fuel slider (engine fixed). ---
  private startMoonRound(): void {
    this.hints = new HintTracker(moonBossHints(MOON_MISSION));
    this.moonFuelKg = 8000;
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, `Reach the escape velocity delta-v of ${MOON_MISSION.requiredDeltaVMs} m/s without overloading the launch frame.`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(650) },
    }).setOrigin(0.5);

    const sliderX = ROUND_SLIDER_X;
    const sliderW = ROUND_SLIDER_W;
    const sliderY = PUZZLE_Y + 40;
    const track = this.add.rectangle(sliderX + sliderW / 2, sliderY, sliderW, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    this.moonHandle = this.add.circle(sliderX, sliderY, 16, 0xd8d8e8).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.moonReadout = this.add.text(GAME_WIDTH / 2, sliderY + 40, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    const zone = this.findZone(0, MOON_MISSION.maxFuelKg, 200, (fuel) => {
      const cfg = { thrustN: MOON_MISSION.thrustN, dryMassKg: MOON_MISSION.dryMassKg, fuelMassKg: fuel, exhaustVelocityMs: MOON_MISSION.exhaustVelocityMs };
      return evaluateLaunch(cfg, MOON_MISSION.requiredDeltaVMs).success;
    });
    if (zone) {
      this.moonZoneBand = drawZoneBand(this, sliderX, sliderY, sliderW, zone[0] / MOON_MISSION.maxFuelKg, zone[1] / MOON_MISSION.maxFuelKg, 18);
      this.puzzleLayer.add(this.moonZoneBand);
    }

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
    const result = evaluateLaunch(cfg, MOON_MISSION.requiredDeltaVMs);
    const emoji = result.success ? '🚀' : result.overweight ? '🪨' : !result.liftoff ? '🪫' : '⛽';
    this.moonReadout?.setText(`${emoji} ${result.reason}`).setColor(result.success ? PALETTE.success : PALETTE.danger);
  }

  // --- Flight round: airspeed slider (wing fixed). ---
  private startFlightRound(seed: number): void {
    this.flightAttempt = generateAttempts(1, seed)[0];
    this.hints = new HintTracker(flightBossHints(this.flightAttempt));
    this.flightSpeedMs = 0;
    const text = this.add.text(GAME_WIDTH / 2, PUZZLE_Y - 30, `Get the Flyer airborne in ${this.flightAttempt.windLabel} without breaking the frame.`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight, align: 'center', wordWrap: { width: fitWidth(650) },
    }).setOrigin(0.5);

    const sliderX = ROUND_SLIDER_X;
    const sliderW = ROUND_SLIDER_W;
    const sliderY = PUZZLE_Y + 40;
    const track = this.add.rectangle(sliderX + sliderW / 2, sliderY, sliderW, 8, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.25).setInteractive();
    this.flightHandle = this.add.circle(sliderX, sliderY, 16, 0x3b5f8a).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(16, 16, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });
    this.flightReadout = this.add.text(GAME_WIDTH / 2, sliderY + 40, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    this.flightZoneBand = drawZoneBand(
      this,
      sliderX,
      sliderY,
      sliderW,
      this.flightAttempt.minSpeedMs / MAX_SLIDER_SPEED_MS,
      this.flightAttempt.maxSafeSpeedMs / MAX_SLIDER_SPEED_MS,
      18,
    );
    this.puzzleLayer.add(this.flightZoneBand);

    this.flightHandle.on('pointerdown', () => { this.dragMode = 'flight'; });
    track.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragMode = 'flight'; this.setFlightFromX(p.x); });
    this.puzzleLayer.add([text, track, this.flightHandle, this.flightReadout]);
    this.sliderX = sliderX;
    this.sliderW = sliderW;
    this.updateFlightReadout();

    this.setSubmit('🛫 Take Off!', () => {
      const outcome = evaluateFlight(this.flightAttempt!, this.flightSpeedMs);
      this.resolveRound(outcome.success);
    });
  }

  private setFlightFromX(pointerX: number): void {
    const ratio = Phaser.Math.Clamp((pointerX - this.sliderX) / this.sliderW, 0, 1);
    this.flightSpeedMs = Math.round(ratio * MAX_SLIDER_SPEED_MS * 2) / 2;
    this.flightHandle?.setX(this.sliderX + ratio * this.sliderW);
    this.updateFlightReadout();
  }

  private updateFlightReadout(): void {
    if (!this.flightAttempt) return;
    const outcome = evaluateFlight(this.flightAttempt, this.flightSpeedMs);
    if (outcome.success) {
      this.flightReadout?.setText('🎯 Just right!').setColor(PALETTE.success);
    } else if (outcome.tooSlow) {
      this.flightReadout?.setText('🐌 Too slow — not enough lift yet.').setColor(PALETTE.danger);
    } else {
      this.flightReadout?.setText('💨 Too fast — the frame is shaking!').setColor(PALETTE.danger);
    }
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
    const panelW = fitWidth(520);
    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.92);
    panel.fillRoundedRect(GAME_WIDTH / 2 - panelW / 2, PUZZLE_Y - 20, panelW, 160, 16);
    this.add.text(GAME_WIDTH / 2, PUZZLE_Y + 10, 'The Chronarch overwhelms you this time...', {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: PALETTE.danger, align: 'center', wordWrap: { width: fitWidth(460) },
    }).setOrigin(0.5);
    createButton(this, GAME_WIDTH / 2, PUZZLE_Y + 90, 'Try Again', () => this.scene.restart(), { width: 220 });
  }
}
