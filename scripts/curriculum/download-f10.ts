/**
 * Downloads the Victorian Curriculum F–10 Version 2.0 as CSV from VCAA's
 * "Download curriculum" page (https://f10.vcaa.vic.edu.au/download-curriculum),
 * selecting every learning area and capability, levels Foundation to 6.
 *
 *   npx playwright install --with-deps chromium
 *   npm run curriculum:download      # writes data/curriculum/raw/vc2-f6.csv
 *
 * On failure it saves the page HTML and a screenshot to data/curriculum/raw/debug/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

const URL = "https://f10.vcaa.vic.edu.au/download-curriculum";
const RAW_DIR = path.resolve(__dirname, "../../data/curriculum/raw");
const DEBUG_DIR = path.join(RAW_DIR, "debug");
const WANTED_LEVELS = ["F", "1", "2", "3", "4", "5", "6"];

async function dump(page: Page, name: string) {
  await mkdir(DEBUG_DIR, { recursive: true });
  await writeFile(path.join(DEBUG_DIR, `${name}.html`), await page.content());
  await page.screenshot({ path: path.join(DEBUG_DIR, `${name}.png`), fullPage: true });
  console.log(`saved debug dump: ${name}`);
}

async function clickText(page: Page, text: string, opts: { exact?: boolean; nth?: number } = {}) {
  const loc = page.getByText(text, { exact: opts.exact ?? true });
  const n = await loc.count();
  console.log(`click "${text}" (${n} matches)`);
  if (n === 0) throw new Error(`No element with text "${text}"`);
  await loc.nth(opts.nth ?? 0).click();
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 90_000 });
    await dump(page, "01-loaded");

    // 1. Learning areas + capabilities.
    await clickText(page, "Select all learning areas");
    await clickText(page, "Select all capabilities");

    // 2. Levels: clear, then pick F–6 from the first ("Levels") group.
    await clickText(page, "Unselect all levels");
    for (const level of WANTED_LEVELS) await clickText(page, level);

    // 3. File type.
    await clickText(page, "CSV format (CSV)");
    await dump(page, "02-selected");

    const button = page.getByRole("button", { name: /download/i }).last();
    console.log(`download button: "${(await button.textContent())?.trim()}"`);
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 300_000 }), button.click()]);
    await mkdir(RAW_DIR, { recursive: true });
    const target = path.join(RAW_DIR, "vc2-f6.csv");
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
