// Visual regression check for the Rome 9-tile overflow fix and a sanity screenshot of the
// randomized Moon mission targets, across iPhone portrait + desktop viewports.
//
// Usage:
//   npm run build
//   npx vite preview --port 4173 &
//   SHOT_DIR=/some/writable/dir node scripts/rome-moon-check.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.TIMERIFT_URL ?? 'http://localhost:4173/TimeRift/';
const OUT_DIR = process.env.SHOT_DIR ?? '.playwright-shots/timerift-rome-moon';

mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-390x844', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'iphone-430x932', width: 430, height: 932, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: 'desktop-1280x800', width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

function seedProfile() {
  localStorage.setItem('timerift:introSeen:v1', '1');
  localStorage.setItem('timerift:e2eSkipCards', '1');
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
    tutorialDone: true,
  };
  const save = { version: 1, profiles: [profile], activeProfileId: 'shot-profile' };
  localStorage.setItem('timerift:save:v1', JSON.stringify(save));
}

// RomeEraScene re-rolls its puzzle from Math.random() every time the scene (re)starts, so
// instead of monkeypatching Math.random (which breaks Phaser's own internal uses of it, e.g.
// texture-key UUIDs), just retry scene starts until we land on the reported 9-tile case
// (round 1's only 6-symbol target, 28 = XXVIII, plus 3 distractors) or give up and show
// whatever rolled last — the layoutTileRow fix is verified for every count 1-15 either way.
async function rollUntilNineTiles(page, maxAttempts = 250) {
  for (let i = 0; i < maxAttempts; i++) {
    await page.evaluate(() => {
      const game = window.__timeriftGame;
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start('RomeEra');
    });
    await page.waitForTimeout(150);
    const count = await page.evaluate(() => window.__timeriftGame.scene.getScene('RomeEra').tileButtons.length);
    if (count === 9) return count;
  }
  return page.evaluate(() => window.__timeriftGame.scene.getScene('RomeEra').tileButtons.length);
}

async function run() {
  const browser = await chromium.launch();
  let failures = 0;
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

    // --- Rome: roll until the reported 9-tile case comes up, measure every tile against the canvas edges ---
    const rolledCount = await rollUntilNineTiles(page);
    await page.waitForTimeout(400);
    await page.locator('canvas').screenshot({ path: `${OUT_DIR}/RomeEra-${rolledCount}tile-${viewport.name}.png` });

    const canvasWidth = await page.evaluate(() => window.__timeriftGame.scale.gameSize.width);
    const bounds = await page.evaluate(() => {
      // `private` is erased at runtime, so the compiled scene's tileButtons array is a plain
      // property — read the live Container x/width Phaser assigned each tile via setSize().
      const scene = window.__timeriftGame.scene.getScene('RomeEra');
      const tiles = scene.tileButtons.map((b) => ({ x: b.x, w: b.width }));
      const left = Math.min(...tiles.map((t) => t.x - t.w / 2));
      const right = Math.max(...tiles.map((t) => t.x + t.w / 2));
      return { count: tiles.length, left, right };
    });
    console.log(`${viewport.name}: canvasWidth=${canvasWidth} tileCount=${bounds.count} left=${bounds.left.toFixed(2)} right=${bounds.right.toFixed(2)}`);
    if (bounds.left < 0 || bounds.right > canvasWidth) {
      console.error(`FAIL: Rome tiles overflow at ${viewport.name} (left=${bounds.left}, right=${bounds.right}, width=${canvasWidth})`);
      failures++;
    }

    // --- Moon: just a visual sanity screenshot that randomized missions still render fine ---
    await page.evaluate(() => {
      const game = window.__timeriftGame;
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start('MoonEra');
    });
    await page.waitForTimeout(700);
    await page.locator('canvas').screenshot({ path: `${OUT_DIR}/MoonEra-${viewport.name}.png` });

    if (pageErrors.length > 0) {
      console.error(`Page errors on ${viewport.name}:`, pageErrors);
      failures++;
    }
    await context.close();
  }
  await browser.close();
  if (failures > 0) {
    console.error(`${failures} failure(s).`);
    process.exit(1);
  }
  console.log('All viewports OK.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
