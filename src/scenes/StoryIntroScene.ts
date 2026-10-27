import Phaser from 'phaser';
import { markIntroSeen } from '../core/intro';
import { createButton } from '../ui/GameButton';
import { starField } from '../ui/parallax';
import { portalIn, portalOut } from '../ui/PortalTransition';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/theme';

interface StorySlide {
  emoji: string;
  title: string;
  line: string;
}

const SLIDES: StorySlide[] = [
  {
    emoji: '⏳',
    title: 'Something Broke.',
    line: 'The Chronarch has shattered the timeline into 10 broken moments of history!',
  },
  {
    emoji: '🫵',
    title: "That's Where YOU Come In",
    line: "You're a Rift Runner. Jump into each era through its portal and set history right again.",
  },
  {
    emoji: '🏺',
    title: 'Earn Stars, Collect Artifacts',
    line: 'Every puzzle you solve earns stars and an artifact for your museum — and unlocks the next era.',
  },
  {
    emoji: '👹',
    title: 'Face the Chronarch',
    line: 'Mend every era, then challenge the Chronarch in a final showdown to save time itself!',
  },
];

export class StoryIntroScene extends Phaser.Scene {
  private index = 0;
  private emojiText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private lineText!: Phaser.GameObjects.Text;
  private nextButton!: Phaser.GameObjects.Container;
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('StoryIntro');
  }

  create(): void {
    this.index = 0;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0620).setOrigin(0);
    starField(this, 70);

    createButton(this, GAME_WIDTH - 90, 44, 'Skip ⏭', () => this.finish(), {
      width: 140,
      height: 48,
      fontSize: 16,
      fillColor: 0x2a2140,
      hoverColor: 0x3a3160,
    });

    this.emojiText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150, '', { fontSize: '90px' }).setOrigin(0.5);
    this.titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '34px',
      color: PALETTE.gold,
      align: 'center',
    }).setOrigin(0.5);
    this.lineText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: 640 },
    }).setOrigin(0.5);

    const dotsY = GAME_HEIGHT / 2 + 110;
    const dotSpacing = 24;
    const dotsStartX = GAME_WIDTH / 2 - (dotSpacing * (SLIDES.length - 1)) / 2;
    this.dots = SLIDES.map((_, i) => this.add.circle(dotsStartX + i * dotSpacing, dotsY, 6, 0x4a3f66));

    this.nextButton = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, 'Next', () => this.advance(), { width: 220, height: 56 });

    this.renderSlide();
    portalIn(this);
  }

  private renderSlide(): void {
    const slide = SLIDES[this.index];
    this.emojiText.setText(slide.emoji);
    this.titleText.setText(slide.title);
    this.lineText.setText(slide.line);
    this.dots.forEach((dot, i) => dot.setFillStyle(i === this.index ? 0xffd34d : 0x4a3f66));

    const label = this.nextButton.getAt(1) as Phaser.GameObjects.Text;
    label.setText(this.index === SLIDES.length - 1 ? "Let's Go!" : 'Next');

    [this.emojiText, this.titleText, this.lineText].forEach((t) => {
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 220 });
    });
  }

  private advance(): void {
    if (this.index >= SLIDES.length - 1) {
      this.finish();
      return;
    }
    this.index += 1;
    this.renderSlide();
  }

  private finish(): void {
    markIntroSeen();
    portalOut(this, () => this.scene.start('ProfileSelect'));
  }
}
