import { test, expect } from '../fixtures';
import { spotsInGrid } from '../helpers/actions';

const counters = (page: import('@playwright/test').Page) => ({
  total: page.getByTestId('spaces-total-value'),
  available: page.getByTestId('spaces-available-value'),
  occupied: page.getByTestId('spaces-occupied-value'),
  maintenance: page.getByTestId('spaces-maintenance-value'),
});

test.describe('Spaces overview', () => {
  test('@p0 loads the 18 seeded spaces with correct counters', async ({ app, page }) => {
    await app.goto('spaces');
    const c = counters(page);

    await expect(spotsInGrid(page)).toHaveCount(18);
    await expect(c.total).toHaveText('18');
    await expect(c.available).toHaveText('17');
    await expect(c.occupied).toHaveText('0');
    await expect(c.maintenance).toHaveText('1');
    await expect(page.getByTestId('spot-A-12')).toHaveClass(/maintenance/);
  });

  test('@p0 changing A-10 to maintenance updates its colour and the counters', async ({ app, page }) => {
    await app.goto('spaces');
    const c = counters(page);

    await page.getByTestId('spot-A-10').click();
    await expect(page.getByTestId('spaces-modal-spot-id')).toHaveText('A-10');
    await page.getByTestId('spaces-status-maintenance-btn').click();

    await expect(page.getByTestId('spot-A-10')).toHaveClass(/maintenance/);
    await expect(c.available).toHaveText('16');
    await expect(c.maintenance).toHaveText('2');
    await expect(c.total).toHaveText('18');
  });

  test('@p1 status modal can be cancelled without changes', async ({ app, page }) => {
    await app.goto('spaces');
    await page.getByTestId('spot-A-10').click();
    await page.getByTestId('spaces-status-cancel-btn').click();
    await expect(page.getByTestId('spaces-status-modal')).toBeHidden();
    await expect(page.getByTestId('spot-A-10')).toHaveClass(/available/);
  });

  test('@p1 zone filter shows only that zone and "All Zones" restores the grid', async ({ app, page }) => {
    await app.goto('spaces');

    await page.getByTestId('spaces-filter-a-btn').click();
    await expect(spotsInGrid(page)).toHaveCount(6);
    await expect(page.getByTestId('spot-A-10')).toBeVisible();
    await expect(page.getByTestId('spot-B-01')).toHaveCount(0);

    await page.getByTestId('spaces-filter-b-btn').click();
    await expect(spotsInGrid(page)).toHaveCount(6);
    await expect(page.getByTestId('spot-B-01')).toBeVisible();

    await page.getByTestId('spaces-filter-c-btn').click();
    await expect(spotsInGrid(page)).toHaveCount(6);

    await page.getByTestId('spaces-filter-d-btn').click();
    await expect(spotsInGrid(page)).toHaveCount(0);

    await page.getByTestId('spaces-filter-all-btn').click();
    await expect(spotsInGrid(page)).toHaveCount(18);
  });

  test('@p1 setting an occupied space to available clears the plate', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123', space: 'A-10' });
    await app.goto('spaces');
    const spot = page.getByTestId('spot-A-10');
    await expect(spot).toHaveClass(/occupied/);
    await expect(spot).toContainText('ABC123');

    await spot.click();
    await page.getByTestId('spaces-status-available-btn').click();

    await expect(spot).toHaveClass(/available/);
    await expect(spot).not.toContainText('ABC123');
    await expect(counters(page).occupied).toHaveText('0');
  });
});

test.describe('New space', () => {
  test('@p1 creates a space: it appears in the grid and adds to the total', async ({ app, page, dialogs }) => {
    await app.goto('spaces');
    await page.getByTestId('spaces-new-spot-btn').click();
    await page.getByTestId('spaces-new-id-input').fill('D-01');
    await page.getByTestId('spaces-new-zone-select').selectOption('D');
    await page.getByTestId('spaces-new-type-select').selectOption('Van');
    await page.getByTestId('spaces-new-spot-save-btn').click();

    expect(dialogs.last).toBe('Spot D-01 registered successfully.');
    await expect(page.getByTestId('spot-D-01')).toBeVisible();
    await expect(spotsInGrid(page)).toHaveCount(19);
    await expect(counters(page).total).toHaveText('19');
    await expect(counters(page).available).toHaveText('18');
  });

  test('@p1 missing identifier or zone: alert and error marks', async ({ app, page, dialogs }) => {
    await app.goto('spaces');
    await page.getByTestId('spaces-new-spot-btn').click();
    await page.getByTestId('spaces-new-spot-save-btn').click();

    expect(dialogs.last).toBe('Please complete the required fields.');
    await expect(page.getByTestId('spaces-new-id-input')).toHaveClass(/error/);
    await expect(page.getByTestId('spaces-new-zone-select')).toHaveClass(/error/);
    await expect(spotsInGrid(page)).toHaveCount(18);
  });

  test('@p1 only the zone missing is flagged', async ({ app, page, dialogs }) => {
    await app.goto('spaces');
    await page.getByTestId('spaces-new-spot-btn').click();
    await page.getByTestId('spaces-new-id-input').fill('D-09');
    await page.getByTestId('spaces-new-spot-save-btn').click();

    expect(dialogs.last).toBe('Please complete the required fields.');
    await expect(page.getByTestId('spaces-new-id-input')).not.toHaveClass(/error/);
    await expect(page.getByTestId('spaces-new-zone-select')).toHaveClass(/error/);
  });

  test('@p1 duplicate identifier is rejected', async ({ app, page, dialogs }) => {
    await app.goto('spaces');
    await page.getByTestId('spaces-new-spot-btn').click();
    await page.getByTestId('spaces-new-id-input').fill('a-10');
    await page.getByTestId('spaces-new-zone-select').selectOption('A');
    await page.getByTestId('spaces-new-spot-save-btn').click();

    expect(dialogs.last).toContain('already exists');
    await expect(spotsInGrid(page)).toHaveCount(18);
  });

  test('@p1 the identifier is stored in uppercase', async ({ app, page }) => {
    await app.goto('spaces');
    await page.getByTestId('spaces-new-spot-btn').click();
    await page.getByTestId('spaces-new-id-input').fill('d-02');
    await page.getByTestId('spaces-new-zone-select').selectOption('D');
    await page.getByTestId('spaces-new-spot-save-btn').click();

    await expect(page.getByTestId('spot-D-02')).toBeVisible();
    await expect(page.getByTestId('spot-d-02')).toHaveCount(0);
  });

  test('@p1 a space in maintenance is not offered in the entry form', async ({ app, page }) => {
    await app.goto('spaces');
    await page.getByTestId('spot-A-11').click();
    await page.getByTestId('spaces-status-maintenance-btn').click();

    await page.getByTestId('entry-link').click();
    const options = page.getByTestId('entry-space-select').locator('option');
    await expect(options.filter({ hasText: 'A-11' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'A-12' })).toHaveCount(0); // seeded maintenance
    await expect(options.filter({ hasText: 'A-10' })).toHaveCount(1);
  });
});
