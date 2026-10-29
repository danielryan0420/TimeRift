import { describe, expect, it } from 'vitest';
import { estimateTextWidth, fitLabel, wrapLines, MIN_BUTTON_FONT } from '../src/ui/GameButton';

/** Deterministic stand-in for canvas measureText, scaled the same way for every test here. */
const measure = (text: string, fontSize: number) => estimateTextWidth(text, fontSize);

describe('wrapLines', () => {
  it('keeps a short label on one line', () => {
    expect(wrapLines('Next', 200, 22, measure)).toEqual(['Next']);
  });

  it('splits a long label across multiple lines at word boundaries', () => {
    const lines = wrapLines('Back to the Rift Map', 90, 20, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('Back to the Rift Map');
  });

  it('never splits a single word, even if it overflows the width', () => {
    const lines = wrapLines('Supercalifragilisticexpialidocious', 40, 20, measure);
    expect(lines).toEqual(['Supercalifragilisticexpialidocious']);
  });
});

describe('fitLabel', () => {
  it('fits every wrapped line within maxWidth for a wide range of buttons and labels', () => {
    const labels = [
      'Next',
      'Hint',
      'Back to the Rift Map',
      'Set Composition',
      '+ New Explorer',
      'Decode the Secret Message',
      'Launch the Rocket Into Orbit',
      '< Back',
      "Let's Go!",
    ];
    const widths = [60, 80, 100, 140, 180, 220, 260, 320];

    for (const label of labels) {
      for (const width of widths) {
        const maxTextWidth = width - 32;
        const fit = fitLabel(label, maxTextWidth, 400, measure, 22);
        for (const line of fit.lines) {
          const isUnbreakableWord = !line.includes(' ');
          const lineWidth = measure(line, fit.fontSize);
          if (!isUnbreakableWord) {
            expect(lineWidth).toBeLessThanOrEqual(maxTextWidth + 0.01);
          }
        }
        expect(fit.fontSize).toBeGreaterThanOrEqual(MIN_BUTTON_FONT);
      }
    }
  });

  it('shrinks the font toward the minimum when the block is too tall for the button', () => {
    const fit = fitLabel('Back to the Rift Map and Explore More', 100, 40, measure, 22);
    expect(fit.fontSize).toBeLessThan(22);
    expect(fit.fontSize).toBeGreaterThanOrEqual(MIN_BUTTON_FONT);
  });

  it('reports a blockHeight taller than maxHeight instead of silently clipping when minFontSize still overflows', () => {
    const fit = fitLabel('A Very Long Label That Will Not Fit No Matter What', 80, 20, measure, 22);
    expect(fit.fontSize).toBe(MIN_BUTTON_FONT);
    expect(fit.blockHeight).toBeGreaterThan(20);
  });

  it('never lets fontSize drop below the caller-provided minimum', () => {
    const fit = fitLabel('Tiny', 200, 10, measure, 18, 18);
    expect(fit.fontSize).toBe(18);
  });
});
