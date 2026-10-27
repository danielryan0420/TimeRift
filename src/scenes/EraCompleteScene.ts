import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import type { EraAttemptResult, EraId } from '../core/types';
import { ARTIFACTS, GADGET_SKINS, computeStars, recordEraCompletion } from '../core/progression';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { createButton } from '../ui/GameButton';
import { burstConfetti, burstSuccess } from '../ui/particles';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { sfx } from '../audio/SoundManager';

export interface EraCompleteData {
  eraId: EraId;
  result: EraAttemptResult;
  starOpts: { mistakeLimit: number; timeTargetSeconds: number };
  fact: { title: string; body: string };
}

export class EraCompleteScene extends Phaser.Scene {
  private payload!: EraCompleteData;

  constructor() {
    super('EraComplete');
  }

  init(data: EraCompleteData): void {
    this.payload = data;
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const before = state.requireProfile();
    const hadArtifact = ARTIFACTS.find((a) => a.eraId === this.payload.eraId);
    const hadBefore = hadArtifact ? before.artifactsCollected.includes(hadArtifact.id) : true;

    const stars = computeStars(this.payload.result, this.payload.starOpts);
    const updated = state.updateActiveProfile((p) => recordEraCompletion(p, this.payload.eraId, stars, this.payload.result));
    const skinsUnlocked = GADGET_SKINS.filter(
      (skin) => updated.unlockedSkins.includes(skin.id) && !before.unlockedSkins.includes(skin.id),
    );

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x120a24).setOrigin(0);
    if (stars > 0) burstConfetti(this, GAME_WIDTH);

    this.add.text(GAME_WIDTH / 2, 60, 'Era Mended!', {
      fontFamily: FONT_FAMILY,
      fontSize: '38px',
      color: PALETTE.gold,
    }).setOrigin(0.5);

    for (let i = 0; i < 3; i++) {
      const filled = i < stars;
      const star = this.add.text(GAME_WIDTH / 2 - 60 + i * 60, 130, filled ? '⭐' : '☆', { fontSize: '48px' }).setOrigin(0.5).setScale(0);
      this.tweens.add({ targets: star, scale: 1, duration: 300, delay: i * 180, ease: 'Back.easeOut' });
      if (filled) this.time.delayedCall(i * 180 + 100, () => burstSuccess(this, star.x, star.y));
    }
    sfx.success();

    const newArtifact = hadArtifact && !hadBefore;
    let y = 210;
    if (newArtifact) {
      this.add.text(GAME_WIDTH / 2, y, `🏺 New artifact collected: ${hadArtifact!.name}!`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: PALETTE.success,
      }).setOrigin(0.5);
      y += 40;
    }
    if (skinsUnlocked.length > 0) {
      this.add.text(GAME_WIDTH / 2, y, `🛠️ New gadget skin unlocked: ${skinsUnlocked[0].name}!`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: PALETTE.success,
      }).setOrigin(0.5);
      y += 40;
    }

    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.9);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 340, y, 680, 220, 16);
    panel.lineStyle(2, PALETTE.panelLine, 0.8);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 340, y, 680, 220, 16);

    this.add.text(GAME_WIDTH / 2, y + 24, `📜 What really happened: ${this.payload.fact.title}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    }).setOrigin(0.5, 0);

    this.add.text(GAME_WIDTH / 2, y + 60, this.payload.fact.body, {
      fontFamily: FONT_FAMILY,
      fontSize: '15px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 620 },
    }).setOrigin(0.5, 0);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 50, 'Back to the Rift Map', () => {
      portalOut(this, () => this.scene.start('Hub'));
    }, { width: 280 });

    portalIn(this);
  }
}
