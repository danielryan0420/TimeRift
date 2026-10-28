import { afterEach, describe, expect, it, vi } from 'vitest';

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

describe('responsive game size', () => {
  afterEach(() => {
    setViewport(1024, 768);
    vi.resetModules();
  });

  it('keeps the original 960x600 landscape design for wide/short viewports', async () => {
    setViewport(1024, 768);
    vi.resetModules();
    const theme = await import('../src/ui/theme');
    expect(theme.GAME_WIDTH).toBe(960);
    expect(theme.GAME_HEIGHT).toBe(600);
    expect(theme.IS_PORTRAIT).toBe(false);
  });

  it('switches to a taller, narrower design for a portrait phone viewport', async () => {
    setViewport(390, 844);
    vi.resetModules();
    const theme = await import('../src/ui/theme');
    expect(theme.GAME_WIDTH).toBe(440);
    expect(theme.GAME_HEIGHT).toBe(920);
    expect(theme.IS_PORTRAIT).toBe(true);
  });

  it('fitWidth never exceeds the available game width minus margin', async () => {
    setViewport(390, 844);
    vi.resetModules();
    const theme = await import('../src/ui/theme');
    expect(theme.fitWidth(640)).toBe(400);
    expect(theme.fitWidth(100)).toBe(100);
  });

  it('fitWidth is a no-op on the wider landscape canvas when the desired width already fits', async () => {
    setViewport(1024, 768);
    vi.resetModules();
    const theme = await import('../src/ui/theme');
    expect(theme.fitWidth(640)).toBe(640);
  });
});
