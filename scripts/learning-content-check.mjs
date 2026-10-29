// Captures each era's "how to play" card (title + What you'll learn + instructions + quiz) at
// iPhone portrait, for manual review that every era shows its learning goal before the puzzle
// starts. Not a pass/fail test — inspect the PNGs it writes.
//
// Usage:
//   npm run build
//   npx vite preview --port 4173 &
//   node scripts/learning-content-check.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.TIMERIFT_URL ?? 'http://localhost:4173/TimeRift/';
const OUT_DIR = process.env.SHOT_DIR ?? '.playwright-shots/timerift-learning';

mkdirSync(OUT_DIR, { recursive: true });

const ERAS = ['EgyptEra', 'RomeEra', 'ChinaEra', 'VikingsEra', 'CastleEra', 'FlorenceEra', 'RevolutionEra', 'IndustrialEra', 'FlightEra', 'MoonEra'];

function seedProfile() {
  localStorage.setItem('timerift:introSeen:v1', '1');
  // Deliberately NOT setting timerift:e2eSkipCards — we want the how-to-play card itself.
  const eraIds = ['egypt', 'rome', 'china', 'vikings', 'castle', 'florence', 'revolution', 'industrial', 'flight', 'moon'];
  const eraProgress = {};
  eraIds.forEach((era) => {
    eraProgress[era] = { completed: false, stars: 0, bestTimeSeconds: null, hintsUsedBest: 0 };
  });
  const profile = {
    id: 'shot-profile',
    name: 'Screenshot Explorer',
    createdAt: new Date().toISOString(),
    gadgetSkin: 'default',
    unlockedSkins: ['default'],
    muted: true,
    eraProgress,
    artifactsCollected: [],
    bossDefeated: false,
    tutorialDone: true, // skip the one-time Egypt tutorial so every era shows its real how-to-play card
  };
  const save = { version: 1, profiles: [profile], activeProfileId: 'shot-profile' };
  localStorage.setItem('timerift:save:v1', JSON.stringify(save));
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 },
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

  for (const key of ERAS) {
    await page.evaluate((k) => {
      const game = window.__timeriftGame;
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start(k);
    }, key);
    await page.waitForTimeout(700);
    const fileName = `${key}-howtoplay-iphone-390x844.png`;
    await page.locator('canvas').screenshot({ path: `${OUT_DIR}/${fileName}` });
    console.log(`captured ${fileName}`);
  }

  if (pageErrors.length > 0) {
    console.error('Page errors:', pageErrors);
  }
  await context.close();
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
