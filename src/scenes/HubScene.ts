import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import type { EraId } from '../core/types';
import { ERA_ORDER } from '../core/types';
import { isBossUnlocked, isEraUnlocked, totalStars } from '../core/progression';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { starField } from '../ui/parallax';
import { createButton } from '../ui/GameButton';
import { portalOut, portalIn } from '../ui/PortalTransition';
import { sfx } from '../audio/SoundManager';
import { showToast } from '../ui/toast';

const ERA_SCENE_KEY: Record<EraId, string> = {
  egypt: 'EgyptEra',
  rome: 'RomeEra',
  china: 'ChinaEra',
  vikings: 'VikingsEra',
  castle: 'CastleEra',
  florence: 'FlorenceEra',
  revolution: 'RevolutionEra',
  industrial: 'IndustrialEra',
  flight: 'FlightEra',
  moon: 'MoonEra',
};

const NODE_POSITIONS: Record<EraId, { x: number; y: number }> = {
  egypt: { x: 80, y: 460 },
  rome: { x: 210, y: 340 },
  china: { x: 330, y: 460 },
  vikings: { x: 450, y: 360 },
  castle: { x: 560, y: 460 },
  florence: { x: 470, y: 230 },
  revolution: { x: 610, y: 150 },
  industrial: { x: 730, y: 260 },
  flight: { x: 820, y: 170 },
  moon: { x: 900, y: 330 },
};

const BOSS_NODE_POS = { x: 900, y: 470 };

const ERA_ICON: Record<EraId, string> = {
  egypt: '🔺',
  rome: '🏛️',
  china: '🐉',
  vikings: '⛵',
  castle: '🏰',
  florence: '🎨',
  revolution: '🔔',
  industrial: '⚙️',
  flight: '🛩️',
  moon: '🚀',
};

export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();
    sfx.setMuted(profile.muted);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x120a24).setOrigin(0);
    starField(this, 90);

    this.add.text(16, 68, `Welcome back, ${profile.name}!`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.textMuted,
    });
    this.add.text(16, 92, `⭐ ${totalStars(profile)} / ${ERA_ORDER.length * 3}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    });

    createButton(this, GAME_WIDTH - 110, 40, '🏺 Museum', () => this.scene.start('Museum'), { width: 170, height: 48 });
    createButton(this, GAME_WIDTH - 110, 100, '🔄 Switch', () => this.scene.start('ProfileSelect'), { width: 170, height: 44, fontSize: 16 });

    this.drawPath();

    for (const era of ERA_ORDER) {
      this.drawNode(era, profile);
    }
    this.drawBossNode(profile);

    portalIn(this);
  }

  private drawPath(): void {
    const g = this.add.graphics();
    g.lineStyle(4, 0x7c3aed, 0.4);
    g.beginPath();
    const first = NODE_POSITIONS[ERA_ORDER[0]];
    g.moveTo(first.x, first.y);
    for (let i = 1; i < ERA_ORDER.length; i++) {
      const p = NODE_POSITIONS[ERA_ORDER[i]];
      g.lineTo(p.x, p.y);
    }
    const lastEra = NODE_POSITIONS[ERA_ORDER[ERA_ORDER.length - 1]];
    g.lineStyle(4, 0xff3b6b, 0.5);
    g.moveTo(lastEra.x, lastEra.y);
    g.lineTo(BOSS_NODE_POS.x, BOSS_NODE_POS.y);
    g.strokePath();
  }

  private drawNode(era: EraId, profile: ReturnType<GameState['requireProfile']>): void {
    const pos = NODE_POSITIONS[era];
    const theme = ERA_THEME[era];
    const unlocked = isEraUnlocked(profile, era);
    const progress = profile.eraProgress[era];

    const circle = this.add.circle(pos.x, pos.y, 34, unlocked ? theme.accent : 0x3a3450, 1)
      .setStrokeStyle(3, 0xffffff, unlocked ? 0.6 : 0.2)
      .setInteractive({ useHandCursor: unlocked });

    this.add.text(pos.x, pos.y, unlocked ? ERA_ICON[era] : '🔒', {
      fontSize: '28px',
    }).setOrigin(0.5);

    this.add.text(pos.x, pos.y + 44, theme.name, {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: unlocked ? PALETTE.textLight : PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: 100 },
    }).setOrigin(0.5, 0);

    if (progress.completed) {
      this.add.text(pos.x, pos.y - 46, '⭐'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars), {
        fontSize: '14px',
      }).setOrigin(0.5);
    }

    circle.on('pointerup', () => {
      if (!unlocked) {
        showToast(this, 'Finish the previous era to unlock this one!', PALETTE.danger);
        return;
      }
      sfx.click();
      portalOut(this, () => this.scene.start(ERA_SCENE_KEY[era]));
    });
  }

  private drawBossNode(profile: ReturnType<GameState['requireProfile']>): void {
    const pos = BOSS_NODE_POS;
    const unlocked = isBossUnlocked(profile);
    const defeated = profile.bossDefeated;

    const circle = this.add.circle(pos.x, pos.y, 40, unlocked ? 0x5a1030 : 0x3a3450, 1)
      .setStrokeStyle(3, unlocked ? 0xff3b6b : 0xffffff, unlocked ? 0.9 : 0.2)
      .setInteractive({ useHandCursor: unlocked });

    if (unlocked) {
      this.tweens.add({ targets: circle, scale: { from: 1, to: 1.08 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.add.text(pos.x, pos.y, defeated ? '🏆' : unlocked ? '👹' : '🔒', { fontSize: '30px' }).setOrigin(0.5);
    this.add.text(pos.x, pos.y + 50, 'Final Showdown', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: unlocked ? PALETTE.textLight : PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: 110 },
    }).setOrigin(0.5, 0);

    circle.on('pointerup', () => {
      if (!unlocked) {
        showToast(this, 'Mend every era of the timeline to challenge the Chronarch!', PALETTE.danger);
        return;
      }
      sfx.click();
      portalOut(this, () => this.scene.start('BossEra'));
    });
  }
}
