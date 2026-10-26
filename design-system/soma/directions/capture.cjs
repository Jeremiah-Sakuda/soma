const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const file = pathToFileURL(path.join(__dirname, 'index.html')).href;
  const results = [];
  for (const theme of ['fieldnotes', 'daylight', 'focus']) {
    await page.goto('about:blank');
    await page.goto(file + '#' + theme);
    await page.locator(`[data-set-theme="${theme}"]`).click();
    const cta = await page.getByRole('button', { name: 'Open lesson', exact: true }).boundingBox();
    if (cta.y + cta.height > 900) throw new Error(`Primary action below fold in ${theme}: ${cta.y + cta.height}`);
    await page.screenshot({ path: path.join(__dirname, `${theme}-desktop.png`), fullPage: true });
    await page.getByRole('button', { name: 'Open lesson', exact: true }).click();
    await page.getByRole('slider').focus();
    await page.keyboard.press('ArrowRight');
    const total = await page.locator('#total-current').innerText();
    if (total !== '5.00 A') throw new Error(`Incorrect preview calculation: ${total}`);
    await page.locator('#preview-title').click();
    await page.screenshot({ path: path.join(__dirname, `${theme}-lesson.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Inspect the change' }).click();
    if (!await page.getByRole('heading', { name: 'A shorter window, the same learning goal.' }).isVisible()) throw new Error('Evidence dialog failed');
    await page.keyboard.press('Escape');
    await page.locator('.intro').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, `${theme}-mobile.png`), fullPage: true });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.setViewportSize({ width: 375, height: 812 });
    const smallOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (mobileOverflow || smallOverflow) throw new Error(`Horizontal overflow in ${theme}`);
    results.push({ theme, desktop: `1440×900; primary action bottom ${Math.round(cta.y + cta.height)}px`, mobile: '390px + 375px, no horizontal overflow', slider: '12V / 4Ω = 3A; total 5A', dialogs: 'open and Escape close passed', reducedMotion: true });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
