import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import {
  checkGood,
  generateStops,
  GOOD_INFO,
  GOODS,
  type CaravanRequest,
  type CaravanStop,
  type Good,
} from '../core/puzzles/china';
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

const TOTAL_STOPS = 6;
const STAR_OPTS = { mistakeLimit: 1, timeTargetSeconds: 75 };

const REQUEST_TEXT: Record<CaravanRequest, string> = {
  'scholar-baghdad': 'A scholar in Baghdad wants a light material for recording knowledge.',
  'noble-rome': 'A noble in Rome wants brilliant cloth for a ceremonial robe.',
  'trader-persia': 'A trader in Persia wants a warming drink that survives the long road dried.',
  'merchant-venice': "A merchant in Venice wants delicate dishware that won't rust or rot.",
};

const REQUEST_HINT: Record<CaravanRequest, string> = {
  'scholar-baghdad': 'Think about something thin you can write on...',
  'noble-rome': 'Think about something woven from a shimmering thread...',
  'trader-persia': 'Think about dried leaves brewed into a drink...',
  'merchant-venice': 'Think about fine, fired clay...',
};

export class ChinaEraScene extends Phaser.Scene {
  private stops: CaravanStop[] = [];
  private index = 0;
  private mistakes = 0;
  private hintsUsedTotal = 0;
  private startTime = 0;
  private hints!: HintTracker;
  private requestText!: Phaser.GameObjects.Text;
  private progressStops: Phaser.GameObjects.Rectangle[] = [];
  private locked = false;

  constructor() {
    super('ChinaEra');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.drawBackground();

    this.stops = generateStops(TOTAL_STOPS, Math.floor(Math.random() * 1e9));
    this.index = 0;
    this.mistakes = 0;
    this.hintsUsedTotal = 0;
    this.locked = false;
    this.startTime = this.time.now;

    new EraHUD(this, {
      title: 'Ancient China: The Silk Road Caravan',
      muted: profile.muted,
      onBack: () => portalOut(this, () => this.scene.start('Hub')),
      onHint: () => this.showHint(),
      onToggleMute: (muted) => state.updateActiveProfile((p) => ({ ...p, muted })),
    });

    this.add.text(GAME_WIDTH / 2, 100, 'Load the right trade good for each stop on the road!', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
    }).setOrigin(0.5);

    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.75);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 320, 130, 640, 90, 14);

    this.requestText = this.add.text(GAME_WIDTH / 2, 175, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 580 },
    }).setOrigin(0.5);

    this.drawGoodButtons();
    this.drawProgressTracker();
    this.showCurrentStop();

    portalIn(this);
  }

  private drawBackground(): void {
    const theme = ERA_THEME.china;
    skyGradient(this, theme.skyTop, theme.skyBottom);
    this.add.circle(140, 110, 50, 0xfff0c0, 0.9);

    const mountains = this.add.graphics();
    mountains.fillStyle(0x5a3a2a, 1);
    this.ridge(mountains, 0, 460, [0, 420, 160, 470, 320, 410, 500, 460, 680, 400, 860, 450, 960, 420]);

    mountains.fillStyle(theme.ground, 1);
    mountains.fillRect(0, 480, GAME_WIDTH, GAME_HEIGHT - 480);

    const wall = this.add.graphics();
    wall.lineStyle(14, 0xc9a876, 1);
    wall.beginPath();
    wall.moveTo(0, 430);
    wall.lineTo(180, 400);
    wall.lineTo(360, 440);
    wall.lineTo(560, 390);
    wall.lineTo(760, 430);
    wall.lineTo(960, 400);
    wall.strokePath();

    for (const x of [100, 320, 540, 760]) {
      const towerY = x === 320 || x === 760 ? 410 : x === 100 ? 420 : 400;
      wall.fillStyle(0xb5906a, 1);
      wall.fillRect(x - 12, towerY - 26, 24, 30);
      wall.fillStyle(0x8a6a4a, 1);
      wall.fillTriangle(x - 16, towerY - 26, x + 16, towerY - 26, x, towerY - 42);
    }
  }

  private ridge(g: Phaser.GameObjects.Graphics, baseX: number, baseY: number, points: number[]): void {
    g.beginPath();
    g.moveTo(baseX, baseY);
    for (let i = 0; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
    g.lineTo(GAME_WIDTH, baseY);
    g.closePath();
    g.fillPath();
  }

  private drawGoodButtons(): void {
    const y = GAME_HEIGHT - 90;
    const spacing = 160;
    const startX = GAME_WIDTH / 2 - (spacing * (GOODS.length - 1)) / 2;
    GOODS.forEach((good, i) => {
      createButton(
        this,
        startX + i * spacing,
        y,
        `${GOOD_INFO[good].label}`,
        () => this.chooseGood(good),
        { width: 150, height: 56, fontSize: 17 },
      );
    });
  }

  private drawProgressTracker(): void {
    const startX = GAME_WIDTH / 2 - (TOTAL_STOPS * 36) / 2;
    const y = 480;
    this.progressStops = [];
    for (let i = 0; i < TOTAL_STOPS; i++) {
      const rect = this.add.rectangle(startX + i * 36, y, 26, 26, 0x4a3f66).setStrokeStyle(2, 0xffffff, 0.3);
      this.progressStops.push(rect);
    }
  }

  private showCurrentStop(): void {
    const stop = this.stops[this.index];
    this.requestText.setText(`Stop ${this.index + 1} of ${TOTAL_STOPS}: ${REQUEST_TEXT[stop.request]}`);
    this.hints = new HintTracker([
      { level: 1, text: REQUEST_HINT[stop.request] },
      { level: 2, text: `Offer the ${GOOD_INFO[stop.correctGood].label}!` },
    ]);
  }

  private showHint(): void {
    if (this.locked) return;
    const hint = this.hints.next();
    if (!hint) {
      showToast(this, 'No more hints for this stop!');
      return;
    }
    this.hintsUsedTotal += 1;
    showToast(this, `💡 ${hint.text}`, PALETTE.gold);
  }

  private chooseGood(good: Good): void {
    if (this.locked) return;
    const stop = this.stops[this.index];
    const correct = checkGood(stop, good);

    if (correct) {
      sfx.success();
      this.progressStops[this.index].setFillStyle(0xd4af37);
      burstSuccess(this, this.progressStops[this.index].x, this.progressStops[this.index].y);
      this.index += 1;
      if (this.index >= TOTAL_STOPS) {
        this.locked = true;
        this.time.delayedCall(500, () => this.finish());
      } else {
        this.showCurrentStop();
      }
    } else {
      sfx.error();
      this.mistakes += 1;
      burstError(this, GAME_WIDTH / 2, GAME_HEIGHT - 90);
      showToast(this, `Not quite — ${GOOD_INFO[good].fact}`, PALETTE.danger);
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
      eraId: 'china',
      result,
      starOpts: STAR_OPTS,
      fact: {
        title: 'The Silk Road and the Great Wall',
        body: "The Silk Road wasn't one road but a web of trade routes linking China to the Mediterranean, carrying silk, paper, tea, and porcelain west and glass, wool, and horses east. The Great Wall, rebuilt and extended over centuries (most of what stands today is Ming dynasty, 14th-17th century), used watchtowers to relay troop warnings by smoke and fire.",
      },
    };
    portalOut(this, () => this.scene.start('EraComplete', data));
  }
}
