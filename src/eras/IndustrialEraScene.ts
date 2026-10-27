import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  DRIVE_TEETH_OPTIONS,
  evaluateOrder,
  generateOrders,
  MAX_DRIVEN_TEETH,
  MIN_DRIVEN_TEETH,
  outputRpm,
  type FactoryOrder,
} from '../core/puzzles/industrial';
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

const ORDER_COUNT = 3;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 90 };
const SLIDER_X = GAME_WIDTH / 2 - 220;
const SLIDER_Y = 420;
const SLIDER_W = 440;

export class IndustrialEraScene extends Phaser.Scene {
  private orders: FactoryOrder[] = [];
  private index = 0;
  private driveTeeth = DRIVE_TEETH_OPTIONS[1];
  private drivenTeeth = 40;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private locked = false;
  private draggingSlider = false;

  private orderText!: Phaser.GameObjects.Text;
  private rpmText!: Phaser.GameObjects.Text;
  private drivenText!: Phaser.GameObjects.Text;
  private sliderHandle!: Phaser.GameObjects.Arc;
  private gearButtons: Phaser.GameObjects.Container[] = [];
  private bigGear!: Phaser.GameObjects.Container;
  private smallGear!: Phaser.GameObjects.Container;

  constructor() {
    super('IndustrialEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.orders = generateOrders(ORDER_COUNT, Math.floor(Math.random() * 1e9));
    this.index = 0;
    this.driveTeeth = DRIVE_TEETH_OPTIONS[1];
    this.drivenTeeth = 40;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    new EraHUD(this, {
      title: 'Industrial Revolution: Set the Gear Ratio',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.orderText = this.add.text(GAME_WIDTH / 2, 76, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5);

    this.drawGears();
    this.drawDriveButtons();

    this.rpmText = this.add.text(GAME_WIDTH / 2, 490, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    this.drawDrivenSlider();

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, '⚙️ Engage!', () => this.engage(), { width: 220, height: 52 });

    this.startOrder();
    portalIn(this);
  }

  private drawBackground(): void {
    const theme = ERA_THEME.industrial;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    const ground = this.add.graphics();
    ground.fillStyle(theme.ground, 1);
    ground.fillRect(0, 520, GAME_WIDTH, GAME_HEIGHT - 520);
    for (let i = 0; i < 3; i++) {
      const stack = this.add.rectangle(140 + i * 90, 350, 24, 180, 0x2a2a2a);
      this.tweens.add({ targets: stack, alpha: { from: 0.9, to: 1 }, duration: 1 });
      this.add.ellipse(140 + i * 90, 260, 36, 16, 0x5c5a52, 0.5);
    }
  }

  private drawGears(): void {
    this.bigGear = this.makeGear(GAME_WIDTH / 2 - 100, 160, 46, 0xc77b2e);
    this.smallGear = this.makeGear(GAME_WIDTH / 2 + 90, 170, 30, 0x9a7b4f);
  }

  private makeGear(x: number, y: number, radius: number, color: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, radius);
    g.fillStyle(0x1a0b2e, 1);
    g.fillCircle(0, 0, radius * 0.3);
    const teeth = 8;
    g.fillStyle(color, 1);
    for (let i = 0; i < teeth; i++) {
      const angle = (i / teeth) * Math.PI * 2;
      const tx = Math.cos(angle) * radius;
      const ty = Math.sin(angle) * radius;
      g.fillRect(tx - 4, ty - 4, 8, 8);
    }
    container.add(g);
    this.tweens.add({ targets: container, angle: 360, duration: 4000, repeat: -1, ease: 'Linear' });
    return container;
  }

  private drawDriveButtons(): void {
    this.gearButtons.forEach((b) => b.destroy());
    this.gearButtons = [];
    const spacing = 110;
    const startX = GAME_WIDTH / 2 - (spacing * (DRIVE_TEETH_OPTIONS.length - 1)) / 2;
    DRIVE_TEETH_OPTIONS.forEach((teeth, i) => {
      const selected = teeth === this.driveTeeth;
      const btn = createButton(
        this,
        startX + i * spacing,
        250,
        `${teeth}T`,
        () => {
          this.driveTeeth = teeth;
          this.drawDriveButtons();
          this.updateReadout();
        },
        { width: 90, height: 44, fontSize: 16, fillColor: selected ? PALETTE.portalEdge : PALETTE.portalCore },
      );
      this.gearButtons.push(btn);
    });
    this.add.text(GAME_WIDTH / 2, 220, 'Drive gear teeth:', { fontFamily: FONT_FAMILY, fontSize: '14px', color: PALETTE.textMuted }).setOrigin(0.5);
  }

  private drawDrivenSlider(): void {
    this.add.text(GAME_WIDTH / 2, 380, 'Driven gear teeth:', { fontFamily: FONT_FAMILY, fontSize: '14px', color: PALETTE.textMuted }).setOrigin(0.5);

    const track = this.add.rectangle(SLIDER_X + SLIDER_W / 2, SLIDER_Y, SLIDER_W, 10, 0x4a3f3a).setStrokeStyle(2, 0xffffff, 0.3).setInteractive();
    this.sliderHandle = this.add.circle(SLIDER_X, SLIDER_Y, 18, 0xffd34d).setStrokeStyle(3, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true, draggable: true, hitArea: new Phaser.Geom.Circle(18, 18, 24), hitAreaCallback: Phaser.Geom.Circle.Contains });

    this.drivenText = this.add.text(GAME_WIDTH / 2, 448, '', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.gold }).setOrigin(0.5);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.draggingSlider || this.locked) return;
      this.setDrivenFromX(pointer.x);
    });
    this.input.on('pointerup', () => { this.draggingSlider = false; });
    this.sliderHandle.on('pointerdown', () => { this.draggingSlider = true; });
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.draggingSlider = true;
      this.setDrivenFromX(pointer.x);
    });

    this.updateSliderVisual();
  }

  private setDrivenFromX(x: number): void {
    const clamped = Phaser.Math.Clamp(x, SLIDER_X, SLIDER_X + SLIDER_W);
    const ratio = (clamped - SLIDER_X) / SLIDER_W;
    this.drivenTeeth = Math.round(MIN_DRIVEN_TEETH + ratio * (MAX_DRIVEN_TEETH - MIN_DRIVEN_TEETH));
    this.updateSliderVisual();
  }

  private updateSliderVisual(): void {
    const ratio = (this.drivenTeeth - MIN_DRIVEN_TEETH) / (MAX_DRIVEN_TEETH - MIN_DRIVEN_TEETH);
    this.sliderHandle.setX(SLIDER_X + ratio * SLIDER_W);
    this.drivenText.setText(`${this.drivenTeeth} teeth`);
    this.updateReadout();
  }

  private updateReadout(): void {
    const order = this.orders[this.index];
    if (!order) return;
    const rpm = outputRpm({ inputRpm: order.inputRpm, driveTeeth: this.driveTeeth, drivenTeeth: this.drivenTeeth });
    const inTolerance = Math.abs(rpm - order.targetRpm) <= order.toleranceRpm;
    this.rpmText.setText(`Output: ${rpm.toFixed(0)} RPM (need ${order.targetRpm} ± ${order.toleranceRpm} RPM) ${inTolerance ? '✅' : '❌'}`);
    this.rpmText.setColor(inTolerance ? PALETTE.success : PALETTE.danger);

    const speedFactor = Phaser.Math.Clamp(4000 / Math.max(rpm, 10), 400, 8000);
    this.tweens.killTweensOf(this.bigGear);
    this.tweens.killTweensOf(this.smallGear);
    this.tweens.add({ targets: this.bigGear, angle: 360, duration: speedFactor, repeat: -1, ease: 'Linear' });
    this.tweens.add({ targets: this.smallGear, angle: -360, duration: speedFactor * (this.driveTeeth / this.drivenTeeth), repeat: -1, ease: 'Linear' });
  }

  private startOrder(): void {
    const order = this.orders[this.index];
    this.orderText.setText(`Order ${this.index + 1} of ${ORDER_COUNT}: drive ${order.machine} at ${order.targetRpm} RPM (input shaft spins at ${order.inputRpm} RPM).`);
    this.hints = new HintTracker([
      { level: 1, text: 'Output RPM = input RPM × (drive teeth ÷ driven teeth). A bigger driven gear slows things down.' },
      { level: 2, text: `Try drive teeth near ${this.driveTeeth === 20 ? 30 : 20} and adjust the driven gear slider.` },
    ]);
    this.updateReadout();
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this order!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private engage(): void {
    if (this.locked) return;
    const order = this.orders[this.index];
    const outcome = evaluateOrder(order, { driveTeeth: this.driveTeeth, drivenTeeth: this.drivenTeeth });

    if (outcome.success) {
      sfx.success();
      burstSuccess(this, GAME_WIDTH / 2, 160, 0xc77b2e);
      this.index += 1;
      if (this.index >= ORDER_COUNT) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.time.delayedCall(400, () => this.startOrder());
      }
    } else {
      sfx.error();
      this.mistakes += 1;
      burstError(this, GAME_WIDTH / 2, 160);
      showToast(this, `${outcome.outputRpm.toFixed(0)} RPM is off by ${outcome.diffRpm.toFixed(0)} — adjust the gears!`, PALETTE.danger);
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
      eraId: 'industrial',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'Gear ratios powered the factory age',
        body: 'Steam-driven factories ran whole floors of machinery off one engine, using gear and belt ratios to speed up or slow down each individual loom, lathe, or press — exactly the output = input × (drive ÷ driven) math you just used.',
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
