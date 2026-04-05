const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FIXTURE_URL = pathToFileURL(
  path.join(__dirname, 'fixtures', 'calculator-test-page.html')
).toString();

test.describe('wealth tax calculator browser smoke coverage', () => {
  test('feature surface is present with expected default state', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    const requiredSelectors = [
      '.calculator-container',
      '.mode-button[data-mode="basic"]',
      '.mode-button[data-mode="advanced"]',
      '#wtc-pr-slider',
      '#wtc-sliderHandle',
      '#wtc-sliderInfobox',
      '#wtc-sliderValue',
      '#wtc-annualPrice',
      '#wtc-moneyField',
      '#wtc-allocationResults',
      '#wtc-comparisonText',
      '#wtc-comparisonSource',
      '#wtc-sourcesList',
      '#wtc-policyHealthcare',
      '#wtc-policyEducation',
      '#wtc-policyBusiness',
      '#wtc-policyDirectRelief',
      '#wtc-policyHousing',
      '#wtc-policyChildcare',
    ];

    for (const selector of requiredSelectors) {
      await expect(page.locator(selector), `missing feature selector: ${selector}`).toHaveCount(1);
    }

    await expect(page.locator('.calculator-container')).toBeVisible();
    await expect(page.locator('.mode-button[data-mode="basic"]')).toBeVisible();
    await expect(page.locator('.mode-button[data-mode="advanced"]')).toBeVisible();
    await expect(page.locator('#wtc-sliderHandle')).toBeVisible();
    await expect(page.locator('#wtc-allocationResults')).toBeVisible();

    await expect(page.locator('#wtc-taxRate')).toHaveCount(1);
    await expect(page.locator('#wtc-taxRate')).toHaveAttribute('type', 'hidden');

    await expect(page.locator('#wtc-sliderHandle')).toHaveAttribute('role', 'slider');
    await expect(page.locator('#wtc-sliderHandle')).toHaveAttribute('aria-valuemin', '1');
    await expect(page.locator('#wtc-sliderHandle')).toHaveAttribute('aria-valuemax', '8');
    await expect(page.locator('.mode-button[data-mode="advanced"]')).toHaveClass(/active/);
    await expect(page.locator('#wtc-comparisonText')).toHaveText(/Sample baseline comparison/);
    await expect(page.locator('#wtc-comparisonSource a')).toHaveText('Sample Source A');
  });

  test('loads without runtime errors and shows key content', async ({ page }) => {
    const runtimeErrors = [];

    page.on('pageerror', (error) => {
      runtimeErrors.push(error.message);
    });

    await page.goto(FIXTURE_URL);

    await expect(page.locator('.calculator-container')).toBeVisible();
    await expect(page.locator('#wtc-annualPrice')).toContainText('$');
    await expect(page.locator('#wtc-comparisonText')).not.toContainText('Loading');

    expect(runtimeErrors).toEqual([]);
  });

  test('policy allocation summary and over-budget pinata behavior are present', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    await expect(page.locator('.allocation-summary')).toBeVisible();
    await expect(page.locator('.allocation-budget-warning')).toBeVisible();
    await expect(page.locator('.allocation-pinata-button')).toBeVisible();

    const sliderValue = page.locator('#wtc-sliderValue');
    const startingValue = await sliderValue.textContent();
    await page.locator('.allocation-pinata-button').evaluate((button) => {
      button.click();
    });

    await expect(sliderValue).not.toHaveText(startingValue || '2.0%');
  });

  test('deselecting all policy categories shows allocation prompt', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    const policyCheckboxes = page.locator('input[name="wtc-policy"]');
    const count = await policyCheckboxes.count();

    for (let i = 0; i < count; i += 1) {
      const checkbox = policyCheckboxes.nth(i);
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
      }
    }

    await expect(page.locator('#wtc-allocationResults .allocation-prompt')).toBeVisible();
    await expect(page.locator('#wtc-allocationResults .allocation-prompt')).toHaveText('Select categories above to see allocation');
  });

  test('keyboard slider updates tax rate and annual revenue', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    const sliderValue = page.locator('#wtc-sliderValue');
    const annualPrice = page.locator('#wtc-annualPrice');
    const sliderHandle = page.locator('#wtc-sliderHandle');

    const initialValue = await sliderValue.textContent();
    const initialAnnual = await annualPrice.textContent();

    await sliderHandle.focus();
    await page.keyboard.press('ArrowRight');

    await expect(sliderValue).not.toHaveText(initialValue || '2.0%');
    await expect(annualPrice).not.toHaveText(initialAnnual || '$306.0 Billion');
  });

  test('mode toggle hides and restores policy section', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    const basicButton = page.locator('.mode-button[data-mode="basic"]');
    const advancedButton = page.locator('.mode-button[data-mode="advanced"]');
    const policySection = page.locator('.policy-allocation-section');

    await expect(policySection).toBeVisible();

    await basicButton.click();
    await expect(policySection).toHaveClass(/hidden/);

    await advancedButton.click();
    await expect(policySection).not.toHaveClass(/hidden/);
  });

  test('applies responsive one-column layout on narrow viewport', async ({ page }) => {
    await page.goto(FIXTURE_URL);

    await page.setViewportSize({ width: 540, height: 960 });

    const gridColumns = await page.locator('.calculator-content').evaluate((element) => {
      return window.getComputedStyle(element).gridTemplateColumns;
    });

    const columns = gridColumns.trim().split(/\s+/);
    expect(columns).toHaveLength(1);
  });
});
