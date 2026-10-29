import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import type { EraId } from '../core/types';
import { ERA_ORDER } from '../core/types';
import { isBossUnlocked, isEraUnlocked, totalStars } from '../core/progression';
import { ERA_THEME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, PALETTE, fitWidth } from '../ui/theme';
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

const LANDSCAPE_NODE_POSITIONS: Record<EraId, { x: number; y: number }> = {
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
const LANDSCAPE_BOSS_NODE_POS = { x: 900, y: 470 };

/** Node radius shrinks a bit in portrait so the whole vertical path fits the taller, narrower canvas. */
export const NODE_RADIUS = IS_PORTRAIT ? 26 : 34;
export const BOSS_RADIUS = IS_PORTRAIT ? 30 : 40;

/**
 * A zigzag path down the screen. Columns cycle through 3 x-positions (not 2) so that a node's
 * name label (below it) never shares a column with the node 2 steps later — with only 2
 * columns those two labels/tags landed close enough in y to overlap at 16px+ font sizes.
 */
function buildPortraitPositions(): { nodes: Record<EraId, { x: number; y: number }>; boss: { x: number; y: number } } {
  const topY = 220;
  const dy = 62;
  const columns = [GAME_WIDTH * 0.18, GAME_WIDTH / 2, GAME_WIDTH * 0.82];
  const nodes = {} as Record<EraId, { x: number; y: number }>;
  ERA_ORDER.forEach((era, i) => {
    nodes[era] = { x: columns[i % columns.length], y: topY + i * dy };
  });
  const boss = { x: GAME_WIDTH / 2, y: topY + ERA_ORDER.length * dy };
  return { nodes, boss };
}

const PORTRAIT = IS_PORTRAIT ? buildPortraitPositions() : undefined;
const NODE_POSITIONS: Record<EraId, { x: number; y: number }> = PORTRAIT?.nodes ?? LANDSCAPE_NODE_POSITIONS;
const BOSS_NODE_POS = PORTRAIT?.boss ?? LANDSCAPE_BOSS_NODE_POS;

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

    // Stacked from measured heights, not fixed y's: a long profile name wraps the welcome
    // line to 2 lines in portrait (headerWrap is only ~220px to leave room for the Museum/
    // Switch buttons), which used to run straight into the star count line below it.
    const headerWrap = IS_PORTRAIT ? GAME_WIDTH - 220 : fitWidth(700);
    let headerY = 64;
    const welcomeText = this.add.text(16, headerY, `Welcome back, ${profile.name}!`, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
      wordWrap: { width: headerWrap, useAdvancedWrap: true },
    });
    headerY += welcomeText.displayHeight + 4;

    const starsText = this.add.text(16, headerY, `⭐ ${totalStars(profile)} / ${ERA_ORDER.length * 3}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.gold,
      wordWrap: { width: headerWrap, useAdvancedWrap: true },
    });
    headerY += starsText.displayHeight + 4;

    const eraCount = ERA_ORDER.filter((era) => profile.eraProgress[era].completed).length;
    const goalLine = isBossUnlocked(profile)
      ? '🏺 All eras mended — the Chronarch awaits!'
      : `🏺 ${eraCount} / ${ERA_ORDER.length} eras mended — tap a glowing portal to continue!`;
    this.add.text(16, headerY, goalLine, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textMuted,
      wordWrap: { width: headerWrap, useAdvancedWrap: true },
    });

    createButton(this, GAME_WIDTH - 110, 40, '🏺 Museum', () => this.scene.start('Museum'), { width: 170, height: 48 });
    createButton(this, GAME_WIDTH - 110, 100, '🔄 Switch', () => this.scene.start('ProfileSelect'), { width: 170, height: 44, fontSize: 16 });

    this.drawPath();

    const nextUpEra = ERA_ORDER.find((era) => isEraUnlocked(profile, era) && !profile.eraProgress[era].completed);
    for (const era of ERA_ORDER) {
      this.drawNode(era, profile, era === nextUpEra);
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

  private drawNode(era: EraId, profile: ReturnType<GameState['requireProfile']>, isNextUp: boolean): void {
    const pos = NODE_POSITIONS[era];
    const theme = ERA_THEME[era];
    const unlocked = isEraUnlocked(profile, era);
    const progress = profile.eraProgress[era];

    const r = NODE_RADIUS;
    if (unlocked) {
      const glow = this.add.circle(pos.x, pos.y, r + 10, theme.accent, 0.35);
      this.tweens.add({
        targets: glow,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 0.35, to: 0.08 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const circle = this.add.circle(pos.x, pos.y, r, unlocked ? theme.accent : 0x3a3450, 1)
      .setStrokeStyle(3, isNextUp ? 0xffd34d : 0xffffff, unlocked ? (isNextUp ? 1 : 0.6) : 0.2)
      .setInteractive({ useHandCursor: unlocked });

    if (unlocked) {
      this.tweens.add({
        targets: circle,
        scale: { from: 1, to: isNextUp ? 1.1 : 1.04 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add.text(pos.x, pos.y, unlocked ? ERA_ICON[era] : '🔒', {
      fontSize: IS_PORTRAIT ? '22px' : '28px',
    }).setOrigin(0.5);

    this.add.text(pos.x, pos.y + r + 10, theme.name, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: unlocked ? PALETTE.textLight : PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: 100, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    if (progress.completed) {
      this.add.text(pos.x, pos.y - r - 14, '⭐'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars), {
        fontSize: '16px',
      }).setOrigin(0.5);
    } else if (isNextUp) {
      const tagY = pos.y - r - 20;
      const tag = this.add.text(pos.x, tagY, '👉 Start here!', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: PALETTE.gold,
        align: 'center',
      }).setOrigin(0.5);
      this.tweens.add({ targets: tag, y: { from: tagY, to: tagY - 8 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    circle.on('pointerup', () => {
      if (!unlocked) {
        sfx.error();
        this.tweens.add({ targets: circle, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 4, onComplete: () => circle.setAngle(0) });
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

    const r = BOSS_RADIUS;
    const circle = this.add.circle(pos.x, pos.y, r, unlocked ? 0x5a1030 : 0x3a3450, 1)
      .setStrokeStyle(3, unlocked ? 0xff3b6b : 0xffffff, unlocked ? 0.9 : 0.2)
      .setInteractive({ useHandCursor: unlocked });

    if (unlocked) {
      this.tweens.add({ targets: circle, scale: { from: 1, to: 1.08 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.add.text(pos.x, pos.y, defeated ? '🏆' : unlocked ? '👹' : '🔒', { fontSize: IS_PORTRAIT ? '24px' : '30px' }).setOrigin(0.5);
    this.add.text(pos.x, pos.y + r + 10, 'Final Showdown', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: unlocked ? PALETTE.textLight : PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: 130, useAdvancedWrap: true },
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
