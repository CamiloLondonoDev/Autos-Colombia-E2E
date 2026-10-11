import { test, expect } from '../fixtures';
import { confirmExit, searchExit } from '../helpers/actions';
import { subscription, type VehicleType } from '../helpers/data';
import { cop } from '../helpers/time';

/*
 * Fee tests seed an active entry that started N hours ago and read the card.
 * Entries are "mid-hour" (2h30m instead of 3h) on purpose: the fee rounds hours up, so
 * the margin makes the result immune to the seconds/minutes the test itself takes.
 */

test.describe('Search vehicle', () => {
  test('@p0 an active plate shows the vehicle card with plate, type, space and time', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123', type: 'Car', space: 'A-10', since: { hours: 1, minutes: 30 } });
    await app.goto('exit');
    await searchExit(page, 'abc123');

    await expect(page.getByTestId('exit-vehicle-card')).toBeVisible();
    await expect(page.getByTestId('exit-vehicle-plate')).toHaveText('ABC123');
    await expect(page.getByTestId('exit-vehicle-type')).toHaveText('Car');
    await expect(page.getByTestId('exit-vehicle-space')).toHaveText('A-10');
    await expect(page.getByTestId('exit-vehicle-duration')).toHaveText(/^1h (29|3\d)min$/);
    await expect(page.getByTestId('exit-vehicle-detail')).toHaveText('2 hours');
  });

  test('@p0 unknown plate shows "No active vehicle found with plate X"', async ({ app, page }) => {
    await app.goto('exit');
    await searchExit(page, 'zzz999');

    await expect(page.getByTestId('exit-not-found-message')).toHaveText('No active vehicle found with plate ZZZ999.');
    await expect(page.getByTestId('exit-vehicle-card')).toBeHidden();
  });

  test('@p1 searching without a plate shows an alert', async ({ app, page, dialogs }) => {
    await app.goto('exit');
    await page.getByTestId('exit-search-btn').click();
    expect(dialogs.last).toBe('Enter a plate to search.');
  });

  test('@p1 Enter in the plate field triggers the search', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123' });
    await app.goto('exit');
    await page.getByTestId('exit-plate-input').fill('ABC123');
    await page.getByTestId('exit-plate-input').press('Enter');
    await expect(page.getByTestId('exit-vehicle-card')).toBeVisible();
  });
});

test.describe('Confirm exit', () => {
  test('@p0 receipt is shown, the space is freed and the payment is in Payments > History', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123', space: 'A-10', since: { hours: 2, minutes: 30 } });
    await app.goto('exit');
    await confirmExit(page, 'ABC123');

    await expect(page.getByTestId('exit-receipt-modal')).toBeVisible();
    await expect(page.getByTestId('exit-receipt-plate')).toHaveText('ABC123');
    await expect(page.getByTestId('exit-receipt-total')).toContainText(cop(9000));

    await page.getByTestId('exit-receipt-close-btn').click();
    await page.getByTestId('spaces-link').click();
    await expect(page.getByTestId('spot-A-10')).toHaveClass(/available/);

    await page.getByTestId('payments-link').click();
    const rows = page.locator('[data-testid^="payment-row-"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('ABC123');
    await expect(rows.first()).toContainText('Cash');
    await expect(rows.first()).toContainText(cop(9000));
  });

  test('@p1 after leaving, the plate can no longer be found', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123' });
    await app.goto('exit');
    await confirmExit(page, 'ABC123');
    await page.getByTestId('exit-receipt-close-btn').click();

    await searchExit(page, 'ABC123');
    await expect(page.getByTestId('exit-not-found-message')).toContainText('No active vehicle found');
    const entries = await app.stored<{ status: string }[]>('entry_records');
    expect(entries[0].status).toBe('inactive');
  });

  test('@p1 receipt shows #EXIT-xxxxxx, dates, duration and total, and closes', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123', since: { hours: 2, minutes: 30 } });
    await app.goto('exit');
    await confirmExit(page, 'ABC123');

    await expect(page.getByTestId('exit-receipt-number')).toHaveText(/RECEIPT\s+#EXIT-\d{6}/);
    const rows = page.getByTestId('exit-receipt-rows');
    await expect(rows).toContainText('Entry date');
    await expect(rows).toContainText('Exit date');
    await expect(rows).toContainText('Total time');
    await expect(rows).toContainText('3 hours');
    await expect(page.getByTestId('exit-receipt-total')).toContainText('Total charged');

    await page.getByTestId('exit-receipt-close-btn').click();
    await expect(page.getByTestId('exit-receipt-modal')).toBeHidden();
  });

  test('@p1 payment method defaults to Cash', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123' });
    await app.goto('exit');

    await searchExit(page, 'ABC123');
    await expect(page.getByTestId('exit-method-cash-btn')).toHaveClass(/active/);
    await page.getByTestId('exit-confirm-btn').click();
    await expect(page.getByTestId('exit-receipt-rows')).toContainText('Cash');
  });

  test('@p1 payment method can be switched to Transfer and shows on the receipt', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123' });
    await app.goto('exit');

    await searchExit(page, 'ABC123');
    await page.getByTestId('exit-method-transfer-btn').click();
    await expect(page.getByTestId('exit-method-transfer-btn')).toHaveClass(/active/);
    await expect(page.getByTestId('exit-method-cash-btn')).not.toHaveClass(/active/);
    await page.getByTestId('exit-confirm-btn').click();
    await expect(page.getByTestId('exit-receipt-rows')).toContainText('Transfer');
  });

  test('@p1 card payment appears on the receipt', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123' });
    await app.goto('exit');
    await confirmExit(page, 'ABC123', 'Card');
    await expect(page.getByTestId('exit-receipt-rows')).toContainText('Card');
  });
});

test.describe('Hourly and daily fees', () => {
  const hourly: { type: VehicleType; total: number }[] = [
    { type: 'Car', total: 9000 },
    { type: 'Pickup', total: 9000 },
    { type: 'Motorcycle', total: 6000 },
    { type: 'Van', total: 12000 },
  ];

  for (const { type, total } of hourly) {
    test(`@p1 ${type} for 3 hours is charged ${cop(total)}`, async ({ app, page }) => {
      if (type === 'Van') app.addSpot({ number: 'D-01', zone: 'D', type: 'Van' });
      app.addActiveEntry({ plate: 'FEE123', type, since: { hours: 2, minutes: 30 } });
      await app.goto('exit');
      await searchExit(page, 'FEE123');

      await expect(page.getByTestId('exit-vehicle-detail')).toHaveText('3 hours');
      await expect(page.getByTestId('exit-total-value')).toHaveText(cop(total));
    });
  }

  test('@p1 less than one hour is charged as one hour (minimum)', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'MIN123', since: { minutes: 20 } });
    await app.goto('exit');
    await searchExit(page, 'MIN123');

    await expect(page.getByTestId('exit-vehicle-detail')).toHaveText('1 hour');
    await expect(page.getByTestId('exit-total-value')).toHaveText(cop(3000));
  });

  test('@p1 an hour fraction rounds up (2h10m -> 3 hours)', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'FRC123', since: { hours: 2, minutes: 10 } });
    await app.goto('exit');
    await searchExit(page, 'FRC123');

    await expect(page.getByTestId('exit-vehicle-detail')).toHaveText('3 hours');
    await expect(page.getByTestId('exit-total-value')).toHaveText(cop(9000));
  });

  test('@p1 1 day + 2 h = day rate + 2 x hour rate ($31.000 for a car)', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'DAY123', modality: 'day', since: { days: 1, hours: 1, minutes: 30 } });
    await app.goto('exit');
    await searchExit(page, 'DAY123');

    await expect(page.getByTestId('exit-vehicle-detail')).toHaveText('1 day + 2 hours');
    await expect(page.getByTestId('exit-total-value')).toHaveText(cop(31000));
  });
});

test.describe('Subscriptions at exit', () => {
  test('@p1 customer with an active subscription pays nothing', async ({ app, page }) => {
    app.seed({ subscriptions: [subscription({ plate: 'SUB123', expiresIn: 15 })] });
    app.addActiveEntry({ plate: 'SUB123', modality: 'monthly', since: { hours: 5 } });
    await app.goto('exit');
    await searchExit(page, 'SUB123');

    await expect(page.getByTestId('exit-monthly-section')).toBeVisible();
    await expect(page.getByTestId('exit-charge-section')).toBeHidden();

    await page.getByTestId('exit-confirm-btn').click();
    await expect(page.getByTestId('exit-receipt-rows')).toContainText('No charge');
    await expect(page.getByTestId('exit-receipt-total')).toContainText('No additional charge');
  });

  test('@p1 Monthly entry with an expired subscription is charged by time', async ({ app, page }) => {
    app.seed({ subscriptions: [subscription({ plate: 'OLD123', expiresIn: -2 })] });
    app.addActiveEntry({ plate: 'OLD123', modality: 'monthly', since: { hours: 2, minutes: 30 } });
    await app.goto('exit');
    await searchExit(page, 'OLD123');

    await expect(page.getByTestId('exit-vehicle-modality')).toContainText('EXPIRED — charged by time');
    await expect(page.getByTestId('exit-monthly-section')).toBeHidden();
    await expect(page.getByTestId('exit-total-value')).toHaveText(cop(9000));
  });
});
