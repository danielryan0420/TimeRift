import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { GADGET_SKINS, recordBossVictory } from '../core/progression';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { createButton } from '../ui/GameButton';
import { burstConfetti, burstSuccess } from '../ui/particles';
import { starField } from '../ui/parallax';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { sfx } from '../audio/SoundManager';

export class BossCompleteScene extends Phaser.Scene {
  constructor() {
    super('BossComplete');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    const before = state.requireProfile();
    const updated = state.updateActiveProfile((p) => recordBossVictory(p));
    const cosmicJustUnlocked = updated.unlockedSkins.includes('cosmic') && !before.unlockedSkins.includes('cosmic');

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0620).setOrigin(0);
    starField(this, 140);
    burstConfetti(this, GAME_WIDTH);

    this.add.text(GAME_WIDTH / 2, 90, 'The Timeline Is Mended!', {
      fontFamily: FONT_FAMILY,
      fontSize: '40px',
      color: PALETTE.gold,
    }).setOrigin(0.5);

    sfx.success();
    this.time.delayedCall(200, () => burstSuccess(this, GAME_WIDTH / 2, 90, 0x7c3aed));

    this.add.text(GAME_WIDTH / 2, 160, 'You out-puzzled the Chronarch using everything you learned\nacross ten eras of history. TIME RIFT is sealed... for now.', {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5, 0);

    let y = 260;
    if (cosmicJustUnlocked) {
      const skin = GADGET_SKINS.find((s) => s.id === 'cosmic');
      this.add.text(GAME_WIDTH / 2, y, `🛠️ New gadget skin unlocked: ${skin?.name}!`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: PALETTE.success,
      }).setOrigin(0.5);
      y += 40;
    }

    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.9);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 340, y, 680, 180, 16);
    panel.lineStyle(2, PALETTE.panelLine, 0.8);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 340, y, 680, 180, 16);

    this.add.text(GAME_WIDTH / 2, y + 24, '📜 Who was the Chronarch, really?', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PALETTE.gold,
    }).setOrigin(0.5, 0);

    this.add.text(
      GAME_WIDTH / 2,
      y + 60,
      "The Chronarch isn't any one historical figure — it's a stand-in for how real breakthroughs happen: someone combines ideas from ramps and levers to gear ratios and rocket equations to solve a problem nobody single era could solve alone.",
      {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: PALETTE.textLight,
        align: 'center',
        wordWrap: { width: 620 },
      },
    ).setOrigin(0.5, 0);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 50, 'Back to the Rift Map', () => {
      portalOut(this, () => this.scene.start('Hub'));
    }, { width: 280 });

    portalIn(this);
  }
}
