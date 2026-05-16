const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FIXTURE_URL = pathToFileURL(
  path.join(__dirname, 'fixtures', 'abdulify-me-test-page.html')
).toString();

const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7M3qgAAAAASUVORK5CYII=';

test.describe('abdulify me browser smoke coverage', () => {
  test('feature surface is present with expected defaults', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    const requiredSelectors = [
      '.am-widget',
      '.am-photo-input',
      '[data-am-effect="frame"]',
      '[data-am-effect="text"]',
      '[data-am-effect="tint"]',
      '[data-am-effect="badge"]',
      '[data-am-apply]',
      '[data-am-download]',
      '[data-am-canvas]',
      '[data-am-status]'
    ];

    for (const selector of requiredSelectors) {
      await expect(page.locator(selector), `missing feature selector: ${selector}`).toHaveCount(1);
    }

    await expect(page.locator('[data-am-apply]')).toBeDisabled();
    await expect(page.locator('[data-am-download]')).toBeDisabled();
    await expect(page.locator('[data-am-status]')).toHaveText('Choose a photo to begin.');
  });

  test('loads without runtime errors', async ({ page }) => {
    const runtimeErrors = [];

    page.on('pageerror', (error) => {
      runtimeErrors.push(error.message);
    });

    await page.goto(FIXTURE_URL);
    await expect(page.locator('.am-widget')).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test('upload enables apply and download flow', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    await page.locator('.am-photo-input').setInputFiles({
      name: 'sample.png',
      mimeType: 'image/png',
      buffer: Buffer.from(SAMPLE_PNG_BASE64, 'base64')
    });

    await expect(page.locator('[data-am-apply]')).toBeEnabled();
    await expect(page.locator('[data-am-download]')).toBeEnabled();
    await expect(page.locator('[data-am-status]')).toHaveText(/Effects applied/);

    await page.locator('[data-am-download]').click();
    await expect(page.locator('[data-am-status]')).toHaveText('Download started.');
  });

  test('narrow viewport keeps widget usable', async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.setViewportSize({ width: 540, height: 960 });

    const gridColumns = await page.locator('.am-grid').evaluate((element) => {
      return window.getComputedStyle(element).gridTemplateColumns;
    });

    const columns = gridColumns.trim().split(/\s+/);
    expect(columns).toHaveLength(1);
  });
});
