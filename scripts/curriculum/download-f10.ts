/**
 * Downloads the Victorian Curriculum F–10 Version 2.0 as CSV from VCAA's
 * "Download curriculum" page (https://f10.vcaa.vic.edu.au/download-curriculum),
 * selecting every curriculum area and levels Foundation to 6.
 *
 *   npx playwright install --with-deps chromium
 *   npm run curriculum:download      # writes data/curriculum/raw/vc2-all.zip
 *   unzip -o data/curriculum/raw/vc2-all.zip -d data/curriculum/raw
 *   npm run curriculum:import        # writes data/curriculum/vc2/*.json
 *
 * On failure it saves the page HTML and a screenshot to data/curriculum/raw/debug/.
 * The raw files are git-ignored; only data/curriculum/vc2 is committed.
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

async function clickAll(page: Page, selector: string) {
  const loc = page.locator(selector);
  for (let i = 0; i < (await loc.count()); i++) await loc.nth(i).click().catch(() => {});
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 90_000 });

    // The page builds the export from one request per discipline; count them for the log.
    let disciplineRequests = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/export_data")) disciplineRequests++;
    });

    // 1. Use the form's own "Select all" controls, then open each area dropdown and tick its subjects.
    for (const label of ["Select all"]) {
      const btn = page.locator("button:visible", { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(500);
        console.log(`clicked "${label}"`);
      }
    }
    await clickAll(page, "button:visible:has-text('Expand all')");
    const triggers = page.locator("[data-orientation='vertical'] button[aria-expanded='false']:visible");
    for (let i = (await triggers.count()) - 1; i >= 0; i--) await triggers.nth(i).click().catch(() => {});
    await page.waitForTimeout(500);
    const boxes = page.locator("input[type='checkbox']:visible");
    const n = await boxes.count();
    for (let i = 0; i < n; i++) {
      const box = boxes.nth(i);
      const id = (await box.getAttribute("id")) ?? "";
      if (["ASconnections", "CCPconnections", "ASCCPconnections", "CCP"].includes(id)) continue;
      if (!(await box.isChecked())) await box.click({ force: true });
    }
    await page.waitForTimeout(500);
    console.log(`checkboxes visible: ${n}, checked: ${await page.locator("input[type='checkbox']:checked").count()}`);

    // 2. Levels: none are selected by default. Select Foundation to Level 6 in the first "Levels" group.
    for (const level of ["F", "1", "2", "3", "4", "5", "6"]) {
      const btn = page.locator("button:visible", { hasText: new RegExp(`^\\s*${level}\\s*$`) }).first();
      await btn.click();
      await page.waitForTimeout(300);
      console.log(`level ${level} selected`);
    }

    // 3. File type.
    const csv = page.locator("button:visible", { hasText: "CSV format (CSV)" }).first();
    await csv.click();
    await page.waitForTimeout(500);

    // 4. Export options: plain curriculum content (achievement standards, content descriptions, elaborations).
    await page.locator("#standard").check({ force: true });
    await page.waitForTimeout(500);

    const buttons = page.locator("button:visible", { hasText: /download/i });
    for (let i = 0; i < (await buttons.count()); i++) {
      const b = buttons.nth(i);
      console.log(`download button ${i}: "${(await b.textContent())?.trim()}" disabled=${await b.isDisabled()}`);
    }
    const button = page.locator("button:visible", { hasText: "Download CSV" }).first();
    console.log(`download button: "${(await button.textContent())?.trim()}"`);
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 300_000 }), button.click()]);
    await mkdir(RAW_DIR, { recursive: true });
    const target = path.join(RAW_DIR, "vc2-all.zip");
    await download.saveAs(target);
    console.log(`saved ${download.suggestedFilename()} -> ${target} (${disciplineRequests} disciplines fetched)`);
    await page.waitForTimeout(2000);
  } catch (err) {
    console.error(err);
    await dump(page, "99-error").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
