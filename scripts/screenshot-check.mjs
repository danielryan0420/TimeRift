// Captures every scene / puzzle type at iPhone portrait (touch) and desktop viewports, for
// manual review of text layout (word-wrap, overlap, font size) after the GameButton/scene
// fixes in this branch. Not a pass/fail test — inspect the PNGs it writes.
//
// Usage:
//   npm run build
//   npx vite preview --port 4173 &
//   node scripts/screenshot-check.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.TIMERIFT_URL ?? 'http://localhost:4173/TimeRift/';
const OUT_DIR = process.env.SHOT_DIR ?? '.playwright-shots/timerift-text';

mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-390x844', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'iphone-430x932', width: 430, height: 932, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: 'desktop-1280x800', width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

const LONG_FACT = {
  title: 'A deliberately long fact title to stress-test wrapping',
  body: 'This is a deliberately long fact body used only for screenshot verification, written to be longer than any real fact in the game so the panel sizing and text wrapping can be checked against a worst-case instead of only the actual shipped copy.',
};

const SCENES = [
  { key: 'ProfileSelect' },
  { key: 'Hub' },
  { key: 'Museum' },
  { key: 'StoryIntro' },
  { key: 'EgyptEra' },
  { key: 'RomeEra' },
  { key: 'ChinaEra' },
  { key: 'VikingsEra' },
  { key: 'CastleEra' },
  { key: 'FlorenceEra' },
  { key: 'RevolutionEra' },
  { key: 'IndustrialEra' },
  { key: 'FlightEra' },
  { key: 'MoonEra' },
  { key: 'BossEra' },
  {
    key: 'EraComplete',
    data: {
      eraId: 'egypt',
      result: { mistakes: 1, hintsUsed: 2, timeSeconds: 61 },
      starOpts: { mistakeLimit: 1, timeTargetSeconds: 75 },
      fact: LONG_FACT,
    },
  },
  { key: 'BossComplete' },
];

function seedProfile() {
  localStorage.setItem('timerift:introSeen:v1', '1');
  localStorage.setItem('timerift:e2eSkipCards', '1');
  const eraIds = ['egypt', 'rome', 'china', 'vikings', 'castle', 'florence', 'revolution', 'industrial', 'flight', 'moon'];
  const eraProgress = {};
  eraIds.forEach((era, i) => {
    eraProgress[era] = i < 3
      ? { completed: true, stars: (i % 3) + 1, bestTimeSeconds: 42, hintsUsedBest: 1 }
      : { completed: false, stars: 0, bestTimeSeconds: null, hintsUsedBest: 0 };
  });
  const profile = {
    id: 'shot-profile',
    name: 'Screenshot Explorer',
    createdAt: new Date().toISOString(),
    gadgetSkin: 'default',
    unlockedSkins: ['default'],
    muted: true,
    eraProgress,
    artifactsCollected: ['egypt-scarab', 'rome-seal'],
    bossDefeated: false,
    tutorialDone: true,
  };
  const save = { version: 1, profiles: [profile], activeProfileId: 'shot-profile' };
  localStorage.setItem('timerift:save:v1', JSON.stringify(save));
}

async function run() {
  const browser = await chromium.launch();
  for (const viewport of VIEWPORTS) {
    const base = viewport.isMobile ? devices['iPhone 13'] : {};
    const context = await browser.newContext({
      ...base,
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      deviceScaleFactor: viewport.deviceScaleFactor,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.addInitScript(seedProfile);
    await page.goto(BASE_URL);
    await page.waitForFunction(() => window.__timeriftGame?.scene.getScenes(true).length > 0, { timeout: 15000 });
    await page.waitForFunction(
      () => ['ProfileSelect', 'StoryIntro'].includes(window.__timeriftGame.scene.getScenes(true)[0]?.scene.key),
      { timeout: 15000 },
    );

    for (const { key, data } of SCENES) {
      await page.evaluate(
        ([k, d]) => {
          const game = window.__timeriftGame;
          game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
          game.scene.start(k, d);
        },
        [key, data],
      );
      await page.waitForTimeout(700);
      const fileName = `${key}-${viewport.name}.png`;
      await page.locator('canvas').screenshot({ path: `${OUT_DIR}/${fileName}` });
      console.log(`captured ${fileName}`);
    }

    if (pageErrors.length > 0) {
      console.error(`Page errors on ${viewport.name}:`, pageErrors);
    }
    await context.close();
  }
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
