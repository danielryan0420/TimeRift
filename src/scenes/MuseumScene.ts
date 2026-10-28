import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { ARTIFACTS, artifactMeterText } from '../core/progression';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, PALETTE } from '../ui/theme';
import { createButton } from '../ui/GameButton';
import { starField } from '../ui/parallax';

export class MuseumScene extends Phaser.Scene {
  constructor() {
    super('Museum');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const profile = state.requireProfile();

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a0f2b).setOrigin(0);
    starField(this, 40);

    this.add.text(GAME_WIDTH / 2, 40, 'Museum of Mended Time', {
      fontFamily: FONT_FAMILY,
      fontSize: '30px',
      color: PALETTE.gold,
    }).setOrigin(0.5);

    const collected = profile.artifactsCollected.length;
    const meterW = 360;
    const meterX = GAME_WIDTH / 2 - meterW / 2;
    const meterY = 78;
    const meter = this.add.graphics();
    meter.fillStyle(0x241a38, 1);
    meter.fillRoundedRect(meterX, meterY, meterW, 16, 8);
    const fillW = Math.max(16, (meterW * collected) / ARTIFACTS.length);
    meter.fillStyle(0xffd34d, 1);
    meter.fillRoundedRect(meterX, meterY, fillW, 16, 8);
    meter.lineStyle(2, 0x4a3f66, 1);
    meter.strokeRoundedRect(meterX, meterY, meterW, 16, 8);

    this.add.text(GAME_WIDTH / 2, meterY + 30, artifactMeterText(collected, ARTIFACTS.length), {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: PALETTE.textLight,
    }).setOrigin(0.5, 0);

    const cols = IS_PORTRAIT ? 3 : ARTIFACTS.length > 8 ? 5 : 4;
    const cellW = GAME_WIDTH / cols;
    const cardW = Math.min(cols > 4 ? 150 : 180, cellW - 16);
    const cellH = IS_PORTRAIT ? 160 : 180;
    const startX = cellW / 2;
    const startY = 190;

    ARTIFACTS.forEach((artifact, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * cellW;
      const y = startY + row * cellH;
      const collected = profile.artifactsCollected.includes(artifact.id);

      const card = this.add.graphics();
      card.fillStyle(collected ? 0x3a2a5c : 0x241a38, 1);
      card.fillRoundedRect(x - cardW / 2, y - 60, cardW, 150, 12);
      card.lineStyle(2, collected ? 0xffd34d : 0x4a3f66, 1);
      card.strokeRoundedRect(x - cardW / 2, y - 60, cardW, 150, 12);

      this.add.text(x, y - 25, collected ? '🏺' : '❔', { fontSize: '40px' }).setOrigin(0.5);
      this.add.text(x, y + 20, collected ? artifact.name : '???', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: collected ? PALETTE.textLight : PALETTE.textMuted,
        align: 'center',
        wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5, 0);
      this.add.text(x, y + 55, collected ? artifact.blurb : 'Find this in its era.', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: PALETTE.textMuted,
        align: 'center',
        wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5, 0);
    });

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 44, '< Back to Map', () => this.scene.start('Hub'), { width: 220 });
  }
}
