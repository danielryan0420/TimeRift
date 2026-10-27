import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from './theme';
import { createButton } from './GameButton';
import { sfx } from '../audio/SoundManager';

export interface QuizOption {
  label: string;
  correct?: boolean;
}

export interface QuizCheck {
  question: string;
  options: QuizOption[];
}

export interface HowToPlayOptions {
  emoji?: string;
  title: string;
  line: string;
  /** A tiny, low-stakes multiple-choice check — any answer lets the player continue. */
  quiz?: QuizCheck;
  dismissLabel?: string;
  onDismiss: () => void;
}

/**
 * A full-screen "how to play" card shown before a puzzle starts. The dim backdrop is interactive
 * so taps can't fall through to buttons underneath while the card is up.
 */
export function showHowToPlayCard(scene: Phaser.Scene, opts: HowToPlayOptions): void {
  const depth = 5000;
  const hasQuiz = !!opts.quiz;
  const panelW = 640;
  const panelH = hasQuiz ? 360 : 240;

  const backdrop = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.68)
    .setOrigin(0)
    .setDepth(depth)
    .setInteractive();

  const container = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(depth + 1).setScale(0.85).setAlpha(0);

  const bg = scene.add.graphics();
  bg.fillStyle(PALETTE.panelBg, 0.97);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
  bg.lineStyle(3, PALETTE.panelLine, 0.9);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
  container.add(bg);

  const titleText = scene.add.text(0, -panelH / 2 + 36, `${opts.emoji ?? '🎮'} ${opts.title}`, {
    fontFamily: FONT_FAMILY,
    fontSize: '24px',
    color: PALETTE.gold,
  }).setOrigin(0.5);
  container.add(titleText);

  const lineText = scene.add.text(0, -panelH / 2 + (hasQuiz ? 86 : 100), opts.line, {
    fontFamily: FONT_FAMILY,
    fontSize: '17px',
    color: PALETTE.textLight,
    align: 'center',
    wordWrap: { width: panelW - 70 },
  }).setOrigin(0.5);
  container.add(lineText);

  const finish = () => {
    sfx.click();
    scene.tweens.add({
      targets: [container, backdrop],
      alpha: 0,
      duration: 150,
      onComplete: () => {
        container.destroy();
        backdrop.destroy();
        opts.onDismiss();
      },
    });
  };

  if (opts.quiz) {
    const qText = scene.add.text(0, -6, opts.quiz.question, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: panelW - 70 },
    }).setOrigin(0.5);
    container.add(qText);

    const feedback = scene.add.text(0, 46, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '15px',
      color: PALETTE.success,
      align: 'center',
      wordWrap: { width: panelW - 70 },
    }).setOrigin(0.5);
    container.add(feedback);

    const goBtn = createButton(scene, 0, panelH / 2 - 36, opts.dismissLabel ?? "Let's Go!", finish, { width: 200, height: 52 });
    goBtn.setVisible(false);
    container.add(goBtn);

    let answered = false;
    const count = opts.quiz.options.length;
    const spacing = 190;
    const startX = -(spacing * (count - 1)) / 2;
    opts.quiz.options.forEach((option, i) => {
      const btn = createButton(scene, startX + i * spacing, 80, option.label, () => {
        if (answered) return;
        answered = true;
        if (option.correct) {
          sfx.success();
          feedback.setColor(PALETTE.success).setText('✅ Nice — that\'s it!');
        } else {
          sfx.error();
          feedback.setColor(PALETTE.textMuted).setText('Good guess — let\'s try it for real!');
        }
        goBtn.setVisible(true);
      }, { width: 170, height: 56, fontSize: 14 });
      container.add(btn);
    });
  } else {
    const goBtn = createButton(scene, 0, panelH / 2 - 44, opts.dismissLabel ?? 'Got it!', finish, { width: 220, height: 52 });
    container.add(goBtn);
  }

  scene.tweens.add({ targets: container, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
}
