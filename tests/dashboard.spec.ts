import { test, expect } from '../fixtures';
import { confirmExit, submitEntry } from '../helpers/actions';
import { subscription } from '../helpers/data';
import { cop } from '../helpers/time';

test.describe('Dashboard cards', () => {
  test('@p0 after an entry: Occupied Spaces 1/18 and Vehicles Today 1', async ({ app, page }) => {
    await app.goto('entry');
    await submitEntry(page, { plate: 'ABC123', space: 'A-10' });

    await page.getByTestId('dashboard-link').click();
    await expect(page.getByTestId('dashboard-occupied-spaces-value')).toHaveText('1/18');
    await expect(page.getByTestId('dashboard-vehicles-today-value')).toHaveText('1');
    await expect(page.getByTestId('dashboard-earnings-today-value')).toHaveText('$0');
  });

  test('@p0 after a paid exit: Earnings Today shows the total charged', async ({ app, page }) => {
    app.addActiveEntry({ plate: 'ABC123', since: { hours: 2, minutes: 30 } });
    await app.goto('exit');
    await confirmExit(page, 'ABC123');
    await page.getByTestId('exit-receipt-close-btn').click();

    await page.getByTestId('dashboard-link').click();
    await expect(page.getByTestId('dashboard-earnings-today-value')).toHaveText(cop(9000));
    await expect(page.getByTestId('dashboard-occupied-spaces-value')).toHaveText('0/18');
  });
});

test.describe('Recent vehicles', () => {
  test('@p1 shows the registered vehicle and drops it after 5 minutes', async ({ app, page }) => {
    await app.goto('entry');
    await submitEntry(page, { plate: 'RCT123', space: 'A-10' });

    // Fake timers start from "now"; the app re-renders the table every 30 s.
    await page.clock.install({ time: new Date() });
    await page.getByTestId('dashboard-link').click();

    const row = page.getByTestId('dashboard-recent-vehicle-RCT123');
    await expect(row).toBeVisible();
    await expect(row).toContainText('A-10');
    await expect(row).toContainText('Car');
    await expect(row).toContainText('Hourly');

    await page.clock.fastForward('06:00');
    await expect(row).toHaveCount(0);
    await expect(page.getByTestId('dashboard-no-recent-vehicles')).toContainText('No recent vehicles');
  });

  test('@p1 without recent vehicles shows "No recent vehicles"', async ({ app, page }) => {
    await app.goto('dashboard');
    await expect(page.getByTestId('dashboard-no-recent-vehicles')).toContainText('No recent vehicles');
  });
});

test.describe('Alerts', () => {
  test('@p1 maintenance space, expired and expiring subscriptions are listed', async ({ app, page }) => {
    app.seed({
      subscriptions: [
        subscription({ plate: 'EXP001', expiresIn: -3 }),
        subscription({ plate: 'UPC001', expiresIn: 2 }),
        subscription({ plate: 'OK0001', expiresIn: 25 }),
      ],
    });
    await app.goto('dashboard');

    const alerts = page.getByTestId('dashboard-active-alerts-list');
    await expect(alerts).toContainText('Spot A-12 (Zone A) under maintenance');
    await expect(alerts).toContainText('Subscription expired: EXP001 (expired 3 days ago)');
    await expect(alerts).toContainText('Subscription expiring: UPC001 (expires in 2 days)');
    await expect(alerts).not.toContainText('OK0001');
    await expect(alerts.locator('li')).toHaveCount(3);
  });

  test('@p1 with nothing to report shows "No active alerts"', async ({ app, page }) => {
    app.state.spots.find((s) => s.number === 'A-12')!.status = 'available';
    await app.goto('dashboard');
    // The li's data-testid is dropped once dashboard.js re-renders the list, so assert on the list.
    await expect(page.getByTestId('dashboard-active-alerts-list')).toHaveText('No active alerts');
  });
});
