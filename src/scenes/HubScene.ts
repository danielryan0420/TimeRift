import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import type { EraId } from '../core/types';
import { totalStars } from '../core/progression';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { starField } from '../ui/parallax';
import { createButton } from '../ui/GameButton';
import { portalOut, portalIn } from '../ui/PortalTransition';
import { sfx } from '../audio/SoundManager';
import { showToast } from '../ui/toast';

/** Eras with a playable scene in this build. The rest show as "Coming soon" on the map. */
const PLAYABLE_ERAS: EraId[] = ['egypt', 'rome', 'vikings', 'moon'];
const ERA_SCENE_KEY: Partial<Record<EraId, string>> = {
  egypt: 'EgyptEra',
  rome: 'RomeEra',
  vikings: 'VikingsEra',
  moon: 'MoonEra',
};

const NODE_POSITIONS: Record<EraId, { x: number; y: number }> = {
  egypt: { x: 110, y: 420 },
  rome: { x: 260, y: 300 },
  vikings: { x: 430, y: 420 },
  castle: { x: 580, y: 280 },
  florence: { x: 430, y: 180 },
  revolution: { x: 620, y: 150 },
  industrial: { x: 770, y: 260 },
  moon: { x: 860, y: 140 },
};

const ERA_ICON: Record<EraId, string> = {
  egypt: '🔺',
  rome: '🏛️',
  vikings: '⛵',
  castle: '🏰',
  florence: '🎨',
  revolution: '🔔',
  industrial: '⚙️',
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
    this.add.text(16, 92, `⭐ ${totalStars(profile)} / 24`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    });

    createButton(this, GAME_WIDTH - 110, 40, '🏺 Museum', () => this.scene.start('Museum'), { width: 170, height: 48 });
    createButton(this, GAME_WIDTH - 110, 100, '🔄 Switch', () => this.scene.start('ProfileSelect'), { width: 170, height: 44, fontSize: 16 });

    this.drawPath();

    for (const era of Object.keys(NODE_POSITIONS) as EraId[]) {
      this.drawNode(era, profile);
    }

    portalIn(this);
  }

  private drawPath(): void {
    const order: EraId[] = ['egypt', 'rome', 'vikings', 'castle', 'florence', 'revolution', 'industrial', 'moon'];
    const g = this.add.graphics();
    g.lineStyle(4, 0x7c3aed, 0.4);
    g.beginPath();
    const first = NODE_POSITIONS[order[0]];
    g.moveTo(first.x, first.y);
    for (let i = 1; i < order.length; i++) {
      const p = NODE_POSITIONS[order[i]];
      g.lineTo(p.x, p.y);
    }
    g.strokePath();
  }

  private isPlayableUnlocked(profile: ReturnType<GameState['requireProfile']>, era: EraId): boolean {
    const idx = PLAYABLE_ERAS.indexOf(era);
    if (idx <= 0) return true;
    const prev = PLAYABLE_ERAS[idx - 1];
    return profile.eraProgress[prev].completed;
  }

  private drawNode(era: EraId, profile: ReturnType<GameState['requireProfile']>): void {
    const pos = NODE_POSITIONS[era];
    const theme = ERA_THEME[era];
    const implemented = PLAYABLE_ERAS.includes(era);
    const unlocked = implemented && this.isPlayableUnlocked(profile, era);
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
    if (!implemented) {
      this.add.text(pos.x, pos.y + 64, 'Coming soon', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: '#8a7fa8',
      }).setOrigin(0.5, 0);
    }

    circle.on('pointerup', () => {
      if (!implemented) {
        showToast(this, 'This era is still being built!', PALETTE.danger);
        return;
      }
      if (!unlocked) {
        showToast(this, 'Finish the previous era to unlock this one!', PALETTE.danger);
        return;
      }
      sfx.click();
      const sceneKey = ERA_SCENE_KEY[era];
      if (!sceneKey) return;
      portalOut(this, () => this.scene.start(sceneKey));
    });
  }
}
