import { test, expect } from '../fixtures';
import { defaultUsers } from '../helpers/data';
import { openUserModal } from '../helpers/actions';

// auth.spec is the only file that logs in through the UI; everything else injects `session`.
test.describe('Login', () => {
  test.beforeEach(async ({ app }) => {
    app.seed({ session: null });
    await app.goto('login');
  });

  const login = async (page: import('@playwright/test').Page, user: string, pass: string) => {
    await page.getByTestId('login-username-input').fill(user);
    await page.getByTestId('login-password-input').fill(pass);
    await page.getByTestId('login-submit-button').click();
  };

  test('@p0 valid admin / 12345 redirects to the dashboard', async ({ page }) => {
    await login(page, 'admin', '12345');
    await expect(page).toHaveURL(/dashboard\.html$/);
    await expect(page.getByTestId('dashboard-title')).toBeVisible();
  });

  test('@p0 seeded user (email + password) can log in', async ({ page }) => {
    await login(page, 'admin@autoscolombia.com', '12345');
    await expect(page).toHaveURL(/dashboard\.html$/);
    await expect(page.getByTestId('user-name')).toHaveText('Carlos Administrator');
  });

  test('@p0 wrong credentials show an error', async ({ page }) => {
    await login(page, 'admin', 'nope');
    await expect(page.getByTestId('login-error-message')).toHaveText('Incorrect username or password');
    await expect(page).toHaveURL(/login\.html$/);
  });

  test('@p0 empty fields show "All fields are required"', async ({ page }) => {
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('login-error-message')).toHaveText('All fields are required');
  });

  test('@p1 only one field filled still shows "All fields are required"', async ({ page }) => {
    await page.getByTestId('login-username-input').fill('admin');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('login-error-message')).toHaveText('All fields are required');
  });
});

test('@p1 a deactivated user cannot log in', async ({ app, page }) => {
  const users = defaultUsers();
  users[1].status = 'inactive'; // operator
  app.seed({ session: null, users });
  await app.goto('login');

  await page.getByTestId('login-username-input').fill('operator@autoscolombia.com');
  await page.getByTestId('login-password-input').fill('op123');
  await page.getByTestId('login-submit-button').click();

  await expect(page.getByTestId('login-error-message')).toHaveText('Incorrect username or password');
  await expect(page).toHaveURL(/login\.html$/);
  expect(await app.stored('session')).toBeNull();
});

test.describe('Session', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('dashboard');
  });

  test('@p1 log out clears the session and returns to login', async ({ app, page }) => {
    await openUserModal(page);
    await page.getByTestId('logout-btn').click();

    await expect(page).toHaveURL(/login\.html$/);
    expect(await app.stored('session')).toBeNull();
    // Only the session is removed, business data stays.
    expect(await app.stored('users_db')).not.toBeNull();
  });

  test('@p1 sidebar shows name, email and role of the user', async ({ page }) => {
    await expect(page.getByTestId('user-name')).toHaveText('Carlos Administrator');
    await expect(page.getByTestId('user-email')).toHaveText('admin@autoscolombia.com');
    await expect(page.getByTestId('user-role')).toHaveText('Administrator');
  });

  test('@p1 user modal shows phone and document, closes with button and by clicking outside', async ({ page }) => {
    const modal = page.getByTestId('user-modal');
    await expect(modal).not.toHaveClass(/visible/);

    await openUserModal(page);
    await expect(modal).toHaveClass(/visible/);
    await expect(page.getByTestId('modal-name')).toHaveText('Carlos Administrator');
    await expect(page.getByTestId('modal-phone')).toHaveText('300 000 0001');
    await expect(page.getByTestId('modal-document')).toHaveText('1000000001');
    await expect(page.getByTestId('modal-email')).toHaveText('admin@autoscolombia.com');

    await page.getByTestId('close-modal-btn').click();
    await expect(modal).not.toHaveClass(/visible/);

    // Clicking the overlay (outside the card) closes it as well.
    await openUserModal(page);
    await expect(modal).toHaveClass(/visible/);
    await modal.click({ position: { x: 5, y: 5 } });
    await expect(modal).not.toHaveClass(/visible/);
  });
});
