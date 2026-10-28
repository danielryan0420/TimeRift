// Regression check for the "tapping the profile button does nothing on iPhone Safari" bug.
//
// Drives a production build with real touch emulation (iPhone 13, hasTouch, touchscreen.tap —
// not mouse clicks, which never exercised the bug because Phaser's hit-test-on-release only
// missed when the interactive object itself had been scaled down on press).
//
// Usage:
//   npm run build
//   npx vite preview --port 4173 &
//   node scripts/touch-tap-check.mjs
//   (stop the preview server afterwards)
import { chromium, devices } from 'playwright';

const BASE_URL = process.env.TIMERIFT_URL ?? 'http://localhost:4173/TimeRift/';

async function activeSceneKey(page) {
  return page.evaluate(() => {
    const game = window.__timeriftGame;
    const active = game?.scene.getScenes(true) ?? [];
    return active.map((s) => s.scene.key);
  });
}

async function tapAt(page, x, y) {
  await page.touchscreen.tap(x, y);
}

function seedExistingProfile() {
  localStorage.setItem('timerift:introSeen:v1', '1');
  const eraIds = [
    'egypt', 'rome', 'china', 'vikings', 'castle',
    'florence', 'revolution', 'industrial', 'flight', 'moon',
  ];
  const eraProgress = {};
  for (const era of eraIds) {
    eraProgress[era] = { completed: false, stars: 0, bestTimeSeconds: null, hintsUsedBest: 0 };
  }
  const profile = {
    id: 'test-profile-dan',
    name: 'Dan',
    createdAt: new Date().toISOString(),
    gadgetSkin: 'default',
    unlockedSkins: ['default'],
    muted: false,
    eraProgress,
    artifactsCollected: [],
    bossDefeated: false,
    tutorialDone: false,
  };
  const save = { version: 1, profiles: [profile], activeProfileId: null };
  localStorage.setItem('timerift:save:v1', JSON.stringify(save));
}

async function run() {
  const browser = await chromium.launch();
  const device = devices['iPhone 13'];
  let failures = 0;

  // --- Scenario 1: existing saved profile, tap the "Dan" row button ---
  {
    const context = await browser.newContext({ ...device, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.addInitScript(seedExistingProfile);
    await page.goto(BASE_URL);
    await page.waitForFunction(() => window.__timeriftGame?.scene.getScenes(true).length > 0);
    await page.waitForFunction(
      () => window.__timeriftGame.scene.getScenes(true)[0]?.scene.key === 'ProfileSelect',
      { timeout: 10000 },
    );

    // The profile row button sits at (GAME_WIDTH/2 - 55, 140) in design space for portrait
    // (440x920), 190 wide (half-width 95). Tap 92px off its center, on purpose: that's inside
    // the button at full scale but just outside where its hit area lands once pointerdown
    // shrinks it to 95% (shrunk half-width 90.25) — the exact few-pixel-near-the-edge tap a
    // real finger (as opposed to a mouse click, or Playwright's own default center-tap) lands
    // all the time. A fix that only re-centers the tap point would hide this; a real fix must
    // not shrink the hit area at all. Read back the canvas's own bounding box and the design
    // resolution to compute the real tap point instead of hardcoding pixels.
    const tapPoint = await page.evaluate(() => {
      const game = window.__timeriftGame;
      const canvas = game.canvas;
      const rect = canvas.getBoundingClientRect();
      const designX = game.scale.width / 2 - 55 + 92;
      const designY = 140;
      return {
        x: rect.left + (designX / game.scale.width) * rect.width,
        y: rect.top + (designY / game.scale.height) * rect.height,
      };
    });

    await tapAt(page, tapPoint.x, tapPoint.y);
    await page.waitForFunction(
      () => window.__timeriftGame.scene.getScenes(true)[0]?.scene.key === 'Hub',
      { timeout: 5000 },
    ).catch(() => {});

    const scenesAfter = await activeSceneKey(page);
    if (!scenesAfter.includes('Hub')) {
      failures += 1;
      console.error(`[FAIL] Scenario 1 (existing profile tap): expected Hub scene, got ${JSON.stringify(scenesAfter)}`);
    } else {
      console.log('[PASS] Scenario 1: tapping the existing "Dan" profile button entered the Hub');
    }
    if (errors.length) {
      failures += 1;
      console.error('[FAIL] Scenario 1: console/page errors:', errors);
    }

    await context.close();
  }

  // --- Scenario 2: fresh profile (no localStorage), skip the intro then create a profile ---
  {
    const context = await browser.newContext({ ...device, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(BASE_URL);
    await page.waitForFunction(
      () => window.__timeriftGame?.scene.getScenes(true)[0]?.scene.key === 'StoryIntro',
      { timeout: 10000 },
    );

    const skipPoint = await page.evaluate(() => {
      const game = window.__timeriftGame;
      const rect = game.canvas.getBoundingClientRect();
      const designX = game.scale.width - 90;
      const designY = 44;
      return {
        x: rect.left + (designX / game.scale.width) * rect.width,
        y: rect.top + (designY / game.scale.height) * rect.height,
      };
    });
    await tapAt(page, skipPoint.x, skipPoint.y);

    await page.waitForFunction(
      () => window.__timeriftGame.scene.getScenes(true)[0]?.scene.key === 'ProfileSelect',
      { timeout: 5000 },
    ).catch(() => {});

    const afterSkip = await activeSceneKey(page);
    if (!afterSkip.includes('ProfileSelect')) {
      failures += 1;
      console.error(`[FAIL] Scenario 2 (skip intro tap): expected ProfileSelect, got ${JSON.stringify(afterSkip)}`);
    } else {
      console.log('[PASS] Scenario 2: tapping "Skip" on a fresh install left the StoryIntro for ProfileSelect');
    }

    if (errors.length) {
      failures += 1;
      console.error('[FAIL] Scenario 2: console/page errors:', errors);
    }

    await context.close();
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll touch-tap checks passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
