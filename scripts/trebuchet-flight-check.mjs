// Visual regression check for the "trebuchet just bounces up and down, nothing flies" bug.
//
// Before the fix, CastleEraScene's live readout kept snapping the stone to the *predicted*
// landing x on every slider drag, so by the time Fire! ran, the flight tween's start and end
// x were already equal — only the vertical bounce was visible. This drives a real shot and
// captures mid-swing, mid-flight, and landed frames so the arc is visible at every viewport.
//
// Usage:
//   npm run build
//   npx vite preview --port 4173 &
//   SHOT_DIR=/some/writable/dir node scripts/trebuchet-flight-check.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.TIMERIFT_URL ?? 'http://localhost:4173/TimeRift/';
const OUT_DIR = process.env.SHOT_DIR ?? '.playwright-shots/timerift-trebuchet';

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

async function run() {
  const browser = await chromium.launch();
  const report = [];

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

    await page.evaluate(() => {
      const game = window.__timeriftGame;
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start('CastleEra');
    });
    await page.waitForTimeout(500);

    // Dial in a mid-range shot (bypassing slider drag, which the fire()/flight logic doesn't
    // care about) so the arc is clearly visible and lands inside the on-screen field.
    const before = await page.evaluate(() => {
      const scene = window.__timeriftGame.scene.getScene('CastleEra');
      scene.counterweightKg = 700;
      scene.releaseAngleDeg = 45;
      scene.updateReadout();
      const p = scene.projectile;
      const target = scene.targets[scene.index];
      return { x: p.x, y: p.y, target };
    });
    await page.waitForTimeout(150);
    await page.locator('canvas').screenshot({ path: `${OUT_DIR}/CastleEra-cocked-${viewport.name}.png` });

    await page.evaluate(() => window.__timeriftGame.scene.getScene('CastleEra').fire());

    // Mid-swing/mid-flight: ~260ms swing + partway into the 550ms flight tween.
    await page.waitForTimeout(450);
    const midFlight = await page.evaluate(() => {
      const p = window.__timeriftGame.scene.getScene('CastleEra').projectile;
      return { x: p.x, y: p.y };
    });
    await page.locator('canvas').screenshot({ path: `${OUT_DIR}/CastleEra-midflight-${viewport.name}.png` });

    // Landed: swing (260ms) + flight (550ms) = 810ms total from fire(). A miss holds the
    // stone at the landed spot for 700ms before resetting, a hit for 400ms+ — either way this
    // capture lands inside that window, well before the arm re-cocks.
    await page.waitForTimeout(400);
    const landed = await page.evaluate(() => {
      const scene = window.__timeriftGame.scene.getScene('CastleEra');
      const p = scene.projectile;
      return { x: p.x, y: p.y };
    });
    await page.locator('canvas').screenshot({ path: `${OUT_DIR}/CastleEra-landed-${viewport.name}.png` });

    const moved = Math.abs(midFlight.x - before.x) > 5 || Math.abs(landed.x - before.x) > 5;
    report.push({ viewport: viewport.name, before, midFlight, landed, horizontalMovementDetected: moved });

    if (pageErrors.length > 0) {
      console.error(`Page errors on ${viewport.name}:`, pageErrors);
    }
    await context.close();
  }
  await browser.close();

  console.log(JSON.stringify(report, null, 2));
  const anyStill = report.some((r) => !r.horizontalMovementDetected);
  if (anyStill) {
    console.error('FAIL: projectile did not move horizontally on at least one viewport.');
    process.exit(1);
  }
  console.log('PASS: projectile flew horizontally (not just up-and-down) on every viewport.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
