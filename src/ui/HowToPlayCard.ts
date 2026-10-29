import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, IS_PORTRAIT, PALETTE, fitWidth } from './theme';
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
  /** The one real-world idea this puzzle teaches, shown as a highlighted callout above the how-to-play line. */
  learnGoal?: string;
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
  // Escape hatch for automated screenshot/E2E tooling only (see scripts/screenshot-check.mjs)
  // so it can capture the puzzle underneath without having to blind-tap through every card's
  // quiz, which varies in height per era. Never set by the game itself.
  if (typeof localStorage !== 'undefined' && localStorage.getItem('timerift:e2eSkipCards') === '1') {
    opts.onDismiss();
    return;
  }

  const depth = 5000;
  const panelW = fitWidth(640);

  const backdrop = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.68)
    .setOrigin(0)
    .setDepth(depth)
    .setInteractive();

  const container = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(depth + 1).setScale(0.85).setAlpha(0);

  const bg = scene.add.graphics();
  container.add(bg);

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

  if (IS_PORTRAIT) {
    // Stack everything top-down, measuring each piece's real height, so long instructions
    // (which wrap to many lines on a narrow phone) never overlap the quiz or buttons below.
    let cursorY = 26;
    const toShift: Phaser.GameObjects.GameObject[] = [];
    const place = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      container.add(obj);
      toShift.push(obj);
      return obj;
    };

    const titleText = place(scene.add.text(0, cursorY, `${opts.emoji ?? '🎮'} ${opts.title}`, {
      fontFamily: FONT_FAMILY, fontSize: '22px', color: PALETTE.gold, align: 'center', wordWrap: { width: panelW - 60 },
    }).setOrigin(0.5, 0));
    cursorY += titleText.displayHeight + 16;

    if (opts.learnGoal) {
      const learnText = place(scene.add.text(0, cursorY, `🎯 What you'll learn: ${opts.learnGoal}`, {
        fontFamily: FONT_FAMILY, fontSize: '15px', color: PALETTE.success, align: 'center', wordWrap: { width: panelW - 60 },
      }).setOrigin(0.5, 0));
      cursorY += learnText.displayHeight + 16;
    }

    const lineText = place(scene.add.text(0, cursorY, opts.line, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight, align: 'center', wordWrap: { width: panelW - 60 },
    }).setOrigin(0.5, 0));
    cursorY += lineText.displayHeight + 18;

    let feedback: Phaser.GameObjects.Text | undefined;
    let goBtn: Phaser.GameObjects.Container;

    if (opts.quiz) {
      const qText = place(scene.add.text(0, cursorY, opts.quiz.question, {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.textLight, align: 'center', wordWrap: { width: panelW - 60 },
      }).setOrigin(0.5, 0));
      cursorY += qText.displayHeight + 16;

      let answered = false;
      opts.quiz.options.forEach((option) => {
        const btnY = cursorY + 26;
        const btn = place(createButton(scene, 0, btnY, option.label, () => {
          if (answered) return;
          answered = true;
          if (option.correct) {
            sfx.success();
            feedback!.setColor(PALETTE.success).setText('✅ Nice — that\'s it!');
          } else {
            sfx.error();
            feedback!.setColor(PALETTE.textMuted).setText('Good guess — let\'s try it for real!');
          }
          goBtn.setVisible(true);
        }, { width: fitWidth(320, 80), height: 52, fontSize: 16 }));
        void btn;
        cursorY += 62;
      });
      cursorY += 6;

      feedback = place(scene.add.text(0, cursorY, '', {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: PALETTE.success, align: 'center', wordWrap: { width: panelW - 60 },
      }).setOrigin(0.5, 0));
      cursorY += 28;

      goBtn = place(createButton(scene, 0, cursorY + 26, opts.dismissLabel ?? "Let's Go!", finish, { width: 200, height: 52 }));
      goBtn.setVisible(false);
      cursorY += 52 + 26;
    } else {
      goBtn = place(createButton(scene, 0, cursorY + 26, opts.dismissLabel ?? 'Got it!', finish, { width: 220, height: 52 }));
      cursorY += 52 + 26;
    }

    const panelH = cursorY + 20;
    bg.fillStyle(PALETTE.panelBg, 0.97);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
    bg.lineStyle(3, PALETTE.panelLine, 0.9);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
    for (const obj of toShift) {
      (obj as unknown as { y: number }).y -= panelH / 2;
    }
  } else {
    const hasQuiz = !!opts.quiz;
    // Learning-goal callout adds a fixed extra row (it's a short single sentence at this
    // width); every element below it shifts down by the same amount.
    const learnOffset = opts.learnGoal ? 34 : 0;
    const panelH = (hasQuiz ? 360 : 240) + learnOffset;
    bg.fillStyle(PALETTE.panelBg, 0.97);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
    bg.lineStyle(3, PALETTE.panelLine, 0.9);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);

    const titleText = scene.add.text(0, -panelH / 2 + 36, `${opts.emoji ?? '🎮'} ${opts.title}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: PALETTE.gold,
    }).setOrigin(0.5);
    container.add(titleText);

    if (opts.learnGoal) {
      const learnText = scene.add.text(0, -panelH / 2 + 66, `🎯 What you'll learn: ${opts.learnGoal}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: PALETTE.success,
        align: 'center',
        wordWrap: { width: panelW - 70 },
      }).setOrigin(0.5);
      container.add(learnText);
    }

    const lineText = scene.add.text(0, -panelH / 2 + (hasQuiz ? 86 : 100) + learnOffset, opts.line, {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      color: PALETTE.textLight,
      align: 'center',
      wordWrap: { width: panelW - 70 },
    }).setOrigin(0.5);
    container.add(lineText);

    if (opts.quiz) {
      const qText = scene.add.text(0, -6 + learnOffset, opts.quiz.question, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: PALETTE.textLight,
        align: 'center',
        wordWrap: { width: panelW - 70 },
      }).setOrigin(0.5);
      container.add(qText);

      const feedback = scene.add.text(0, 46 + learnOffset, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
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
      opts.quiz.options.forEach((option, i) => {
        const btnX = -(190 * (count - 1)) / 2 + i * 190;
        const btn = createButton(scene, btnX, 80 + learnOffset, option.label, () => {
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
        }, { width: 170, height: 56, fontSize: 16 });
        container.add(btn);
      });
    } else {
      const goBtn = createButton(scene, 0, panelH / 2 - 44, opts.dismissLabel ?? 'Got it!', finish, { width: 220, height: 52 });
      container.add(goBtn);
    }
  }

  scene.tweens.add({ targets: container, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
}
