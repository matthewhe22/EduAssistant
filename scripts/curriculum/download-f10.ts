/**
 * Downloads the Victorian Curriculum F–10 Version 2.0 as CSV from VCAA's
 * "Download curriculum" page (https://f10.vcaa.vic.edu.au/download-curriculum),
 * selecting every curriculum area and all levels (filtered to Foundation–Level 6 on import).
 *
 *   npx playwright install --with-deps chromium
 *   npm run curriculum:download      # writes data/curriculum/raw/vc2-all.csv
 *
 * On failure it saves the page HTML and a screenshot to data/curriculum/raw/debug/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

const URL = "https://f10.vcaa.vic.edu.au/download-curriculum";
const RAW_DIR = path.resolve(__dirname, "../../data/curriculum/raw");
const DEBUG_DIR = path.join(RAW_DIR, "debug");

async function dump(page: Page, name: string) {
  await mkdir(DEBUG_DIR, { recursive: true });
  await writeFile(path.join(DEBUG_DIR, `${name}.html`), await page.content());
  await page.screenshot({ path: path.join(DEBUG_DIR, `${name}.png`), fullPage: true });
  console.log(`saved debug dump: ${name}`);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 90_000 });
    await dump(page, "01-loaded");

    // 1. Tick every curriculum area checkbox (learning areas, capabilities, cross-curriculum priorities).
    const boxes = page.locator("input[type='checkbox']:visible");
    const n = await boxes.count();
    console.log(`checkboxes: ${n}`);
    if (n === 0) throw new Error("No curriculum area checkboxes found");
    for (let i = 0; i < n; i++) {
      const box = boxes.nth(i);
      if (!(await box.isChecked())) await box.check({ force: true });
    }
    await page.waitForTimeout(500);
    console.log(`checked: ${await page.locator("input[type='checkbox']:checked").count()}`);

    // 2. Levels: all are selected by default. We keep them and filter to F–6 when importing.

    // 3. File type.
    const csv = page.locator("button:visible", { hasText: "CSV format (CSV)" }).first();
    await csv.click();
    await page.waitForTimeout(500);

    // 4. Export options: plain curriculum content (achievement standards, content descriptions, elaborations).
    await page.locator("#standard").check({ force: true });
    await page.waitForTimeout(500);
    await dump(page, "02-selected");

    const buttons = page.locator("button:visible", { hasText: /download/i });
    for (let i = 0; i < (await buttons.count()); i++) {
      const b = buttons.nth(i);
      console.log(`download button ${i}: "${(await b.textContent())?.trim()}" disabled=${await b.isDisabled()}`);
    }
    const button = page.locator("button:visible", { hasText: "Download CSV" }).first();
    console.log(`download button: "${(await button.textContent())?.trim()}"`);
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 300_000 }), button.click()]);
    await mkdir(RAW_DIR, { recursive: true });
    const target = path.join(RAW_DIR, "vc2-all.csv");
    await download.saveAs(target);
    console.log(`saved ${download.suggestedFilename()} -> ${target}`);
  } catch (err) {
    console.error(err);
    await dump(page, "99-error").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
