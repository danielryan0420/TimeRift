import Phaser from 'phaser';
import { GameState, GAME_STATE_KEY } from '../state/GameState';
import { createProfile, deleteProfile, selectProfile } from '../core/save';
import { createButton } from '../ui/GameButton';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';
import { starField } from '../ui/parallax';
import { sfx } from '../audio/SoundManager';

export class ProfileSelectScene extends Phaser.Scene {
  constructor() {
    super('ProfileSelect');
  }

  create(): void {
    const state = this.registry.get(GAME_STATE_KEY) as GameState;
    sfx.setMuted(state.activeProfile?.muted ?? false);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0620).setOrigin(0);
    starField(this, 60);

    this.add.text(GAME_WIDTH / 2, 60, 'Who is jumping through the rift?', {
      fontFamily: FONT_FAMILY,
      fontSize: '28px',
      color: PALETTE.textLight,
    }).setOrigin(0.5);

    this.renderProfiles(state);
  }

  private renderProfiles(state: GameState): void {
    this.children.list
      .filter((c) => c.getData('profileRow'))
      .forEach((c) => c.destroy());

    const startY = 140;
    const rowHeight = 64;
    state.save.profiles.forEach((profile, i) => {
      const y = startY + i * rowHeight;
      const row = createButton(
        this,
        GAME_WIDTH / 2 - 60,
        y,
        `${profile.name}`,
        () => {
          state.setSave(selectProfile(state.save, profile.id));
          this.scene.start('Hub');
        },
        { width: 320, height: 52 },
      );
      row.setData('profileRow', true);

      const del = createButton(
        this,
        GAME_WIDTH / 2 + 180,
        y,
        '🗑',
        () => {
          state.setSave(deleteProfile(state.save, profile.id));
          this.renderProfiles(state);
        },
        { width: 56, height: 52, fillColor: 0x5a2140, hoverColor: 0x8a2a50 },
      );
      del.setData('profileRow', true);
    });

    const addY = startY + state.save.profiles.length * rowHeight + 20;
    const addBtn = createButton(this, GAME_WIDTH / 2, addY, '+ New Explorer', () => {
      const name = window.prompt('What is your explorer name?', '')?.trim();
      if (!name) return;
      const { save } = createProfile(state.save, name);
      state.setSave(save);
      this.renderProfiles(state);
    }, { width: 320 });
    addBtn.setData('profileRow', true);
  }
}
