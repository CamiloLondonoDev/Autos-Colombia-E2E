import { test, expect } from '../fixtures';
import { submitEntry, fillEntryForm } from '../helpers/actions';
import { subscription } from '../helpers/data';
import { addDays, ago, minutesApart, today, display } from '../helpers/time';

test.describe('Register entry', () => {
  test('@p0 registers a car: success alert and the space becomes occupied', async ({ app, page, dialogs }) => {
    await app.goto('entry');
    await submitEntry(page, { plate: 'ABC123', type: 'Car', space: 'A-10' });

    expect(dialogs.last).toBe('Vehicle ABC123 registered successfully in space A-10.');

    await page.getByTestId('spaces-link').click();
    const spot = page.getByTestId('spot-A-10');
    await expect(spot).toHaveClass(/occupied/);
    await expect(spot).toContainText('ABC123');
  });

  test('@p0 the space select only lists available spaces of the chosen type', async ({ app, page }) => {
    // A-12 is in maintenance by default; occupy A-10 on top of that.
    app.addActiveEntry({ plate: 'OCC111', space: 'A-10' });
    await app.goto('entry');

    const options = page.getByTestId('entry-space-select').locator('option');
    await expect(options).toHaveText([
      'Select a space',
      'A-11 — Zone A (Car)',
      'A-13 — Zone A (Car)',
      'A-14 — Zone A (Car)',
      'A-15 — Zone A (Car)',
    ]);

    await page.getByTestId('entry-type-select').selectOption('Motorcycle');
    await expect(options).toHaveCount(7); // placeholder + B-01..B-06
    await expect(options.nth(1)).toContainText('B-01');
    await expect(options.filter({ hasText: 'Car' })).toHaveCount(0);

    await page.getByTestId('entry-type-select').selectOption('Pickup');
    await expect(options).toHaveCount(7);
    await expect(options.nth(1)).toContainText('C-01');
  });

  test('@p1 whitespace-only plate shows "Enter the vehicle plate."', async ({ app, page, dialogs }) => {
    // The input is `required`, so an empty value is stopped by the browser before the
    // app's own check; whitespace passes the browser and reaches the alert.
    await app.goto('entry');
    await submitEntry(page, { plate: '   ', space: 'A-10' });
    expect(dialogs.last).toBe('Enter the vehicle plate.');
  });

  test('@p1 no space selected shows "Select an available parking space."', async ({ app, page, dialogs }) => {
    await app.goto('entry');
    await submitEntry(page, { plate: 'ABC123' });
    expect(dialogs.last).toBe('Select an available parking space.');
  });

  test('@p1 the plate is stored in uppercase', async ({ app, page }) => {
    await app.goto('entry');
    await submitEntry(page, { plate: 'abc123', space: 'A-10' });

    const entries = await app.stored<{ plate: string }[]>('entry_records');
    expect(entries.map((e) => e.plate)).toEqual(['ABC123']);
    await page.getByTestId('spaces-link').click();
    await expect(page.getByTestId('spot-A-10')).toContainText('ABC123');
  });

  test('@p1 a plate that is already inside is rejected', async ({ app, page, dialogs }) => {
    app.addActiveEntry({ plate: 'ABC123', space: 'A-10' });
    await app.goto('entry');
    await submitEntry(page, { plate: 'ABC123', space: 'A-11' });

    expect(dialogs.last).toContain('already has an active entry');
    expect(dialogs.last).toContain('A-10');
    await expect(page.getByTestId('entry-space-select')).toHaveValue('A-11'); // form untouched
  });

  test('@p1 no spaces left for the type shows "No spaces available for <type>"', async ({ app, page }) => {
    for (const s of app.state.spots.filter((s) => s.type === 'Pickup')) s.status = 'maintenance';
    await app.goto('entry');
    await page.getByTestId('entry-type-select').selectOption('Pickup');

    const select = page.getByTestId('entry-space-select');
    await expect(select.locator('option')).toHaveCount(1);
    await expect(select).toContainText('No spaces available for Pickup');
  });

  test('@p1 plate with an active subscription forces Monthly and shows the notice', async ({ app, page }) => {
    const sub = subscription({ plate: 'SUB123', expiresIn: 10 });
    app.seed({ subscriptions: [sub] });
    await app.goto('entry');

    await page.getByTestId('entry-plate-input').fill('sub123');
    await page.getByTestId('entry-owner-input').click(); // blur -> subscription check

    await expect(page.getByTestId('entry-modality-select')).toHaveValue('monthly');
    await expect(page.getByTestId('entry-modality-select')).toBeDisabled();
    const notice = page.getByTestId('entry-monthly-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('SUB123');
    await expect(notice).toContainText(display(sub.expirationDate));
  });

  test('@p1 an expired subscription does not lock the modality', async ({ app, page }) => {
    app.seed({ subscriptions: [subscription({ plate: 'OLD123', expiresIn: -1 })] });
    await app.goto('entry');

    await page.getByTestId('entry-plate-input').fill('OLD123');
    await page.getByTestId('entry-owner-input').click();

    await expect(page.getByTestId('entry-modality-select')).toBeEnabled();
    await expect(page.getByTestId('entry-modality-select')).toHaveValue('hour');
    await expect(page.getByTestId('entry-monthly-notice')).toBeHidden();
  });

  test('@p1 after registering, the form is cleared and date/time return to now', async ({ app, page }) => {
    await app.goto('entry');
    const past = ago({ days: 2 });
    await submitEntry(page, {
      plate: 'ABC123',
      space: 'A-10',
      owner: 'John',
      date: past.date,
      time: '07:15',
      modality: 'day',
    });

    await expect(page.getByTestId('entry-plate-input')).toHaveValue('');
    await expect(page.getByTestId('entry-owner-input')).toHaveValue('');
    await expect(page.getByTestId('entry-modality-select')).toHaveValue('hour');
    await expect(page.getByTestId('entry-date-input')).toHaveValue(today());

    const time = await page.getByTestId('entry-time-input').inputValue();
    expect(minutesApart(time, ago({}).time)).toBeLessThanOrEqual(2);
  });

  test('@p1 the entry keeps the chosen past date and time', async ({ app, page }) => {
    await app.goto('entry');
    const date = addDays(today(), -1);
    await submitEntry(page, { plate: 'ABC123', space: 'A-10', date, time: '06:45' });

    const [entry] = await app.stored<{ date: string; time: string }[]>('entry_records');
    expect(entry).toMatchObject({ date, time: '06:45' });
  });

  test('@p1 Cancel returns to the dashboard', async ({ app, page }) => {
    await app.goto('entry');
    await fillEntryForm(page, { plate: 'ABC123' });
    await page.getByTestId('entry-cancel-btn').click();
    await expect(page).toHaveURL(/dashboard\.html$/);
  });

});
