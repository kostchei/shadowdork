import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke-tests the real boot → new-game → Dungeon flow in an actual browser
 * tab (not the Claude Code preview pane's hidden tab, so RAF and input work
 * normally). Drives Phaser Text buttons the same way documented for this
 * codebase's headless tooling: emit a synthetic `pointerdown` on the
 * button's Phaser Text object rather than computing canvas-relative pixel
 * coordinates, so the test survives canvas scale/DPI/window-size changes.
 *
 * `window.__game` is declared (DEV-only) in src/game/main.ts — reused here,
 * not redeclared, so the two `declare global` blocks don't conflict.
 */

async function clickTextButton(page: Page, sceneKey: string, textIncludes: string): Promise<void> {
  await page.waitForFunction(
    ({ sceneKey, textIncludes }) => {
      const scene = window.__game?.scene.keys[sceneKey];
      return (
        scene?.children.list.some(
          (o) => o.type === "Text" && (o as Phaser.GameObjects.Text).text.includes(textIncludes),
        ) ?? false
      );
    },
    { sceneKey, textIncludes },
    { timeout: 10_000 },
  );
  await page.evaluate(
    ({ sceneKey, textIncludes }) => {
      const scene = window.__game!.scene.keys[sceneKey]!;
      const btn = scene.children.list.find(
        (o) => o.type === "Text" && (o as Phaser.GameObjects.Text).text.includes(textIncludes),
      )!;
      btn.emit("pointerdown", {}, 0, 0, { stopPropagation() {} });
    },
    { sceneKey, textIncludes },
  );
}

/** Boot → "Start New Game" → NewGame's beginning-choice screen → "Begin Expedition" → Dungeon. */
async function startNewGame(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__game), undefined, { timeout: 10_000 });
  await clickTextButton(page, "Boot", "Start New Game");
  await page.waitForFunction(() => window.__game?.scene.isActive("NewGame") ?? false, undefined, {
    timeout: 10_000,
  });
  await clickTextButton(page, "NewGame", "BEGIN EXPEDITION");
  await page.waitForFunction(() => window.__game?.scene.isActive("Dungeon") ?? false, undefined, {
    timeout: 10_000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("boots to the title screen with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);

  await page.waitForFunction(() => Boolean(window.__game), undefined, { timeout: 10_000 });
  await page.waitForFunction(
    () => {
      const boot = window.__game?.scene.keys.Boot;
      return (
        boot?.children.list.some(
          (o) => o.type === "Text" && (o as Phaser.GameObjects.Text).text.includes("Start New Game"),
        ) ?? false
      );
    },
    undefined,
    { timeout: 10_000 },
  );

  expect(errors).toEqual([]);
});

test("starts a new game and reaches the Dungeon + Hud scenes", async ({ page }) => {
  await startNewGame(page);
  expect(await page.evaluate(() => window.__game?.scene.isActive("Hud") ?? false)).toBe(true);
  await page.screenshot({ path: "e2e/.artifacts/dungeon-start.png" });
});

test("moving right actually advances the party leader", async ({ page }) => {
  await startNewGame(page);

  // Give the scene's create() a couple of frames to finish spawning the party.
  await page.waitForFunction(
    () => {
      const dungeon = window.__game?.scene.keys.Dungeon as unknown as { party?: { leader?: { x: number } } };
      return typeof dungeon.party?.leader?.x === "number";
    },
    undefined,
    { timeout: 10_000 },
  );

  // A real click, not just the synthetic `pointerdown` used to drive menu
  // buttons above, is what actually gives the page/canvas keyboard focus —
  // without it, Phaser's keyboard capture is flaky and `page.keyboard.down`
  // silently does nothing. A real player always clicks in before playing, so
  // this also matches how the game is actually used.
  await page.locator("canvas").click();

  const startX = await page.evaluate(
    () => (window.__game!.scene.keys.Dungeon as unknown as { party: { leader: { x: number } } }).party.leader.x,
  );

  await page.keyboard.down("KeyD");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyD");

  const endX = await page.evaluate(
    () => (window.__game!.scene.keys.Dungeon as unknown as { party: { leader: { x: number } } }).party.leader.x,
  );

  // Bounded, not just "greater than": at speed 160px/s over ~300ms we expect
  // roughly 30-70px. A wider-than-expected jump is as much a real bug signal
  // (e.g. a runaway physics delta) as no movement at all.
  expect(endX - startX).toBeGreaterThan(10);
  expect(endX - startX).toBeLessThan(120);
});
