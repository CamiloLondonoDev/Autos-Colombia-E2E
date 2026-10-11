import { test, expect } from '../fixtures';
import { cop, display, addDays, today } from '../helpers/time';
import { submitEntry } from '../helpers/actions';

// Full journeys, driven only through the UI (login included).

test.describe('End-to-end flows', () => {
  test('@p0 full cycle: login > entry > dashboard > exit > history > report', async ({ app, page }) => {
    app.seed({ session: null });
    await app.goto('login');

    // Login
    await page.getByTestId('login-username-input').fill('admin');
    await page.getByTestId('login-password-input').fill('12345');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('dashboard-title')).toBeVisible();

    // Entry
    await page.getByTestId('dashboard-register-entry-btn').click();
    await submitEntry(page, { plate: 'FLW123', type: 'Car', space: 'A-10' });

    // Dashboard: 1 occupied
    await page.getByTestId('dashboard-link').click();
    await expect(page.getByTestId('dashboard-occupied-spaces-value')).toHaveText('1/18');
    await expect(page.getByTestId('dashboard-recent-vehicle-FLW123')).toBeVisible();

    // Exit: search shows the card, confirm charges the 1-hour minimum
    await page.getByTestId('dashboard-register-exit-btn').click();
    await page.getByTestId('exit-plate-input').fill('FLW123');
    await page.getByTestId('exit-search-btn').click();
    await expect(page.getByTestId('exit-vehicle-card')).toBeVisible();
    await expect(page.getByTestId('exit-total-value')).toHaveText(cop(3000));
    await page.getByTestId('exit-confirm-btn').click();
    await expect(page.getByTestId('exit-receipt-total')).toContainText(cop(3000));
    await page.getByTestId('exit-receipt-close-btn').click();

    // History
    await page.getByTestId('payments-link').click();
    const rows = page.locator('[data-testid^="payment-row-"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('FLW123');
    await expect(rows.first()).toContainText(cop(3000));

    // Report
    await page.getByTestId('reports-link').click();
    await expect(page.getByTestId('reports-income-value')).toHaveText(cop(3000));
    await expect(page.getByTestId('reports-vehicles-value')).toHaveText('1');
  });

  test('@p0 monthly cycle: subscription > locked entry > free exit > "No charge" in history', async ({ app, page }) => {
    await app.goto('payments');

    // Subscription
    await page.getByTestId('payments-subscriptions-tab').click();
    await page.getByTestId('subscriptions-new-btn').click();
    await page.getByTestId('subscription-plate-input').fill('MON123');
    await page.getByTestId('subscription-owner-input').fill('Monthly Owner');
    await page.getByTestId('subscription-save-btn').click();
    await expect(page.getByText(display(addDays(today(), 30)))).toBeVisible();

    // Entry: modality is locked to Monthly
    await page.getByTestId('entry-link').click();
    await page.getByTestId('entry-plate-input').fill('MON123');
    await page.getByTestId('entry-owner-input').click();
    await expect(page.getByTestId('entry-modality-select')).toHaveValue('monthly');
    await expect(page.getByTestId('entry-modality-select')).toBeDisabled();
    await expect(page.getByTestId('entry-monthly-notice')).toBeVisible();
    await page.getByTestId('entry-space-select').selectOption('A-10');
    await page.getByTestId('entry-submit-btn').click();

    // Exit: nothing to pay
    await page.getByTestId('exit-link').click();
    await page.getByTestId('exit-plate-input').fill('MON123');
    await page.getByTestId('exit-search-btn').click();
    await expect(page.getByTestId('exit-monthly-section')).toBeVisible();
    await expect(page.getByTestId('exit-charge-section')).toBeHidden();
    await page.getByTestId('exit-confirm-btn').click();
    await expect(page.getByTestId('exit-receipt-rows')).toContainText('No charge');
    await page.getByTestId('exit-receipt-close-btn').click();

    // History: subscription payment + the free exit
    await page.getByTestId('payments-link').click();
    const rows = page.locator('[data-testid^="payment-row-"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'No charge' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'No charge' })).toContainText('$0');
  });

  test('@p1 persistence: reloading keeps spaces, entries and payments', async ({ app, page }) => {
    await app.goto('entry');
    await submitEntry(page, { plate: 'PER123', space: 'A-10' });

    // Spaces survive a reload
    await page.getByTestId('spaces-link').click();
    await page.reload();
    await expect(page.getByTestId('spot-A-10')).toHaveClass(/occupied/);
    await expect(page.getByTestId('spot-A-10')).toContainText('PER123');

    // The entry survives a reload: it can still be found and charged
    await page.getByTestId('exit-link').click();
    await page.reload();
    await page.getByTestId('exit-plate-input').fill('PER123');
    await page.getByTestId('exit-search-btn').click();
    await expect(page.getByTestId('exit-vehicle-card')).toBeVisible();
    await page.getByTestId('exit-confirm-btn').click();
    await page.getByTestId('exit-receipt-close-btn').click();

    // The payment survives a reload
    await page.getByTestId('payments-link').click();
    await page.reload();
    await expect(page.locator('[data-testid^="payment-row-"]')).toHaveCount(1);
    await expect(page.getByTestId('payments-total-value')).toHaveText(cop(3000));

    // And the space is free again after reload
    await page.getByTestId('spaces-link').click();
    await page.reload();
    await expect(page.getByTestId('spot-A-10')).toHaveClass(/available/);
  });
});
