import { test, expect } from '../fixtures';
import { exitRecord, pastEntry } from '../helpers/data';
import { addDays, cop, today } from '../helpers/time';

const GREEN = 'rgb(22, 163, 74)';
const RED = 'rgb(220, 38, 38)';

/**
 * Default range is the last 7 days (today-6 .. today). Scenario for that window:
 *   entries:  3 today, 2 two days ago, 2 five days ago      -> 7 vehicles, avg round(7/7) = 1
 *   exits:    9.000 today + 6.000 (2d ago) + 12.000 (5d ago) -> 27.000
 */
const currentPeriod = () => ({
  entries: [
    pastEntry(0, 'Car'),
    pastEntry(0, 'Car'),
    pastEntry(0, 'Motorcycle'),
    pastEntry(2, 'Pickup'),
    pastEntry(2, 'Car'),
    pastEntry(5, 'Car'),
    pastEntry(5, 'Van'),
  ],
  exits: [
    exitRecord({ total: 9000, daysAgo: 0 }),
    exitRecord({ total: 6000, daysAgo: 2 }),
    exitRecord({ total: 12000, daysAgo: 5 }),
  ],
});

test.describe('Report cards', () => {
  test('@p1 seeded data gives the right income, vehicles and daily average', async ({ app, page }) => {
    app.seed(currentPeriod());
    await app.goto('reports');

    await expect(page.getByTestId('reports-income-value')).toHaveText(cop(27000));
    await expect(page.getByTestId('reports-vehicles-value')).toHaveText('7');
    await expect(page.getByTestId('reports-average-value')).toHaveText('1');
  });

  test('@p1 changing the date range recalculates the cards', async ({ app, page }) => {
    app.seed(currentPeriod());
    await app.goto('reports');

    await page.getByTestId('reports-from-input').fill(today());
    await expect(page.getByTestId('reports-income-value')).toHaveText(cop(9000));
    await expect(page.getByTestId('reports-vehicles-value')).toHaveText('3');
    await expect(page.getByTestId('reports-average-value')).toHaveText('3'); // 3 vehicles / 1 day

    await page.getByTestId('reports-from-input').fill(addDays(today(), -3));
    await expect(page.getByTestId('reports-income-value')).toHaveText(cop(15000));
    await expect(page.getByTestId('reports-vehicles-value')).toHaveText('5');
  });

  test('@p1 comparison against the previous period is green when it grows', async ({ app, page }) => {
    const cur = currentPeriod();
    // Previous 7 days: today-13 .. today-7  -> 18.000 and 2 vehicles
    app.seed({
      entries: [...cur.entries, pastEntry(8, 'Car'), pastEntry(10, 'Car')],
      exits: [...cur.exits, exitRecord({ total: 18000, daysAgo: 9 })],
    });
    await app.goto('reports');

    const income = page.getByTestId('reports-income-comparison');
    await expect(income).toHaveText('+50% vs previous period');
    await expect(income).toHaveCSS('color', GREEN);

    const vehicles = page.getByTestId('reports-vehicles-comparison');
    await expect(vehicles).toHaveText('+250% vs previous period');
    await expect(vehicles).toHaveCSS('color', GREEN);
  });

  test('@p1 comparison is red when the period is worse than the previous one', async ({ app, page }) => {
    const cur = currentPeriod();
    app.seed({
      entries: [...cur.entries, ...Array.from({ length: 14 }, () => pastEntry(9, 'Car'))],
      exits: [...cur.exits, exitRecord({ total: 54000, daysAgo: 9 })],
    });
    await app.goto('reports');

    const income = page.getByTestId('reports-income-comparison');
    await expect(income).toHaveText('-50% vs previous period');
    await expect(income).toHaveCSS('color', RED);

    const vehicles = page.getByTestId('reports-vehicles-comparison');
    await expect(vehicles).toHaveText('-50% vs previous period');
    await expect(vehicles).toHaveCSS('color', RED);
  });

  test('@p1 an invalid range (from > to) does not update the data', async ({ app, page }) => {
    app.seed(currentPeriod());
    await app.goto('reports');
    await expect(page.getByTestId('reports-income-value')).toHaveText(cop(27000));

    await page.getByTestId('reports-from-input').fill(addDays(today(), 1)); // from > to (today)
    await expect(page.getByTestId('reports-income-value')).toHaveText(cop(27000));
    await expect(page.getByTestId('reports-vehicles-value')).toHaveText('7');
  });
});

test.describe('Charts', () => {
  test('@p1 the 4 canvases render and the console has no errors', async ({ app, page, consoleErrors }) => {
    app.seed(currentPeriod());
    await app.goto('reports');

    for (const id of ['income', 'vehicles', 'type', 'hour']) {
      const canvas = page.getByTestId(`reports-${id}-chart`);
      await expect(canvas).toBeVisible();
      await expect
        .poll(async () => (await canvas.boundingBox())?.height ?? 0, { message: `${id} chart size` })
        .toBeGreaterThan(50);
    }

    // Chart.js wires a chart onto each canvas (a failed CDN load would leave them blank).
    const drawn = await page.evaluate(() => ['incomeChart', 'vehiclesChart', 'typeChart', 'hourChart'].map((id) => {
      const c = document.getElementById(id) as HTMLCanvasElement;
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      return data.some((v) => v !== 0);
    }));
    expect(drawn).toEqual([true, true, true, true]);
    expect(consoleErrors).toEqual([]);
  });
});
