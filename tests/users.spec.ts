import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openUserModal } from '../helpers/actions';

interface UserForm {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  role?: 'Administrator' | 'Operator';
  password?: string;
  confirm?: string;
}

const VALID: Required<UserForm> = {
  name: 'Laura Test',
  document: '1000000099',
  email: 'laura@autoscolombia.com',
  phone: '300 111 2222',
  role: 'Operator',
  password: 'secret1',
  confirm: 'secret1',
};

async function fillUserForm(page: Page, f: UserForm) {
  if (f.name !== undefined) await page.getByTestId('users-name-input').fill(f.name);
  if (f.document !== undefined) await page.getByTestId('users-document-input').fill(f.document);
  if (f.email !== undefined) await page.getByTestId('users-email-input').fill(f.email);
  if (f.phone !== undefined) await page.getByTestId('users-phone-input').fill(f.phone);
  if (f.role !== undefined) await page.getByTestId('users-role-select').selectOption(f.role);
  if (f.password !== undefined) await page.getByTestId('users-password-input').fill(f.password);
  if (f.confirm !== undefined) await page.getByTestId('users-confirm-input').fill(f.confirm);
}

async function createUser(page: Page, f: UserForm = {}) {
  await page.getByTestId('users-new-btn').click();
  await fillUserForm(page, { ...VALID, ...f });
  await page.getByTestId('users-save-btn').click();
}

test.describe('User list', () => {
  test('@p0 lists the 2 seeded users with role and status', async ({ app, page }) => {
    await app.goto('users');

    await expect(page.locator('[data-testid^="user-row-"]')).toHaveCount(2);
    const admin = page.getByTestId('user-row-1');
    await expect(admin).toContainText('Carlos Administrator');
    await expect(admin).toContainText('admin@autoscolombia.com');
    await expect(page.getByTestId('user-role-1')).toHaveText('Administrator');
    await expect(page.getByTestId('user-status-1')).toHaveText('Active');

    await expect(page.getByTestId('user-row-2')).toContainText('María Operator');
    await expect(page.getByTestId('user-role-2')).toHaveText('Operator');
    await expect(page.getByTestId('user-status-2')).toHaveText('Active');
  });

  test('@p1 search by name and by document; no match shows "No users found"', async ({ app, page }) => {
    await app.goto('users');
    const search = page.getByTestId('users-search-input');

    await search.fill('marÍa');
    await expect(page.locator('[data-testid^="user-row-"]')).toHaveCount(1);
    await expect(page.getByTestId('user-row-2')).toBeVisible();

    await search.fill('1000000001');
    await expect(page.locator('[data-testid^="user-row-"]')).toHaveCount(1);
    await expect(page.getByTestId('user-row-1')).toBeVisible();

    await search.fill('does-not-exist');
    await expect(page.locator('[data-testid^="user-row-"]')).toHaveCount(0);
    await expect(page.getByTestId('users-empty-message')).toHaveText('No users found.');

    await search.fill('');
    await expect(page.locator('[data-testid^="user-row-"]')).toHaveCount(2);
  });
});

test.describe('Create user', () => {
  test('@p0 a valid user appears in the table as Active', async ({ app, page, dialogs }) => {
    await app.goto('users');
    await createUser(page);

    expect(dialogs.last).toBe('User registered successfully.');
    await expect(page.getByTestId('users-list-view')).toBeVisible();
    const row = page.getByTestId('user-row-3');
    await expect(row).toContainText('Laura Test');
    await expect(row).toContainText('1000000099');
    await expect(page.getByTestId('user-role-3')).toHaveText('Operator');
    await expect(page.getByTestId('user-status-3')).toHaveText('Active');
  });

  const invalid: { name: string; patch: UserForm; field: string }[] = [
    { name: 'empty name', patch: { name: '' }, field: 'users-name-input' },
    { name: 'empty document', patch: { document: '' }, field: 'users-document-input' },
    { name: 'empty email', patch: { email: '' }, field: 'users-email-input' },
    { name: 'email without @', patch: { email: 'laura.autoscolombia.com' }, field: 'users-email-input' },
    { name: 'password shorter than 6', patch: { password: '12345', confirm: '12345' }, field: 'users-password-input' },
    { name: 'confirmation does not match', patch: { confirm: 'different' }, field: 'users-confirm-input' },
  ];

  for (const { name, patch, field } of invalid) {
    test(`@p1 validation: ${name}`, async ({ app, page, dialogs }) => {
      await app.goto('users');
      await createUser(page, patch);

      expect(dialogs.last).toBe('Please correctly complete the fields marked in red.');
      await expect(page.getByTestId(field)).toHaveClass(/error/);
      await expect(page.getByTestId('users-form-view')).toBeVisible();
      expect(await app.stored<unknown[]>('users_db')).toHaveLength(2);
    });
  }

  test('@p1 validation: role not chosen', async ({ app, page, dialogs }) => {
    await app.goto('users');
    await page.getByTestId('users-new-btn').click();
    await fillUserForm(page, { ...VALID, role: undefined });
    await page.getByTestId('users-save-btn').click();

    expect(dialogs.last).toBe('Please correctly complete the fields marked in red.');
    await expect(page.getByTestId('users-role-select')).toHaveClass(/error/);
  });

  test('@p1 duplicate email is rejected', async ({ app, page, dialogs }) => {
    await app.goto('users');
    await createUser(page, { email: 'admin@autoscolombia.com' });

    expect(dialogs.last).toContain('already registered');
    await expect(page.getByTestId('users-email-input')).toHaveClass(/error/);
    expect(await app.stored<unknown[]>('users_db')).toHaveLength(2);
  });

  test('@p1 a created user can log in (integration with login)', async ({ app, page }) => {
    await app.goto('users');
    await createUser(page, { email: 'laura@autoscolombia.com', password: 'secret1', confirm: 'secret1' });
    await expect(page.getByTestId('user-row-3')).toBeVisible();

    await openUserModal(page);
    await page.getByTestId('logout-btn').click();
    await expect(page).toHaveURL(/login\.html$/);

    await page.getByTestId('login-username-input').fill('laura@autoscolombia.com');
    await page.getByTestId('login-password-input').fill('secret1');
    await page.getByTestId('login-submit-button').click();

    await expect(page).toHaveURL(/dashboard\.html$/);
    await expect(page.getByTestId('user-name')).toHaveText('Laura Test');
    await expect(page.getByTestId('user-role')).toHaveText('Operator');
  });
});

test.describe('Edit, deactivate and navigation', () => {
  test('@p1 edit changes data and does not ask for a password', async ({ app, page, dialogs }) => {
    await app.goto('users');
    await page.getByTestId('user-edit-btn-2').click();

    await expect(page.getByTestId('users-form-title')).toHaveText('Edit User');
    await expect(page.getByTestId('users-password-field')).toBeHidden();
    await expect(page.getByTestId('users-confirm-field')).toBeHidden();
    await expect(page.getByTestId('users-name-input')).toHaveValue('María Operator');

    await page.getByTestId('users-name-input').fill('María Updated');
    await page.getByTestId('users-role-select').selectOption('Administrator');
    await page.getByTestId('users-save-btn').click();

    expect(dialogs.last).toBe('User updated successfully.');
    await expect(page.getByTestId('user-row-2')).toContainText('María Updated');
    await expect(page.getByTestId('user-role-2')).toHaveText('Administrator');
  });

  test('@p1 deactivate and reactivate go through the confirmation modal', async ({ app, page, dialogs }) => {
    await app.goto('users');

    await page.getByTestId('user-toggle-btn-2').click();
    await expect(page.getByTestId('users-modal-title')).toHaveText('Deactivate user?');
    await page.getByTestId('users-modal-confirm-btn').click();
    expect(dialogs.last).toBe('User deactivated successfully.');
    await expect(page.getByTestId('user-status-2')).toHaveText('Inactive');

    await page.getByTestId('user-toggle-btn-2').click();
    await expect(page.getByTestId('users-modal-title')).toHaveText('Reactivate user?');
    await page.getByTestId('users-modal-confirm-btn').click();
    expect(dialogs.last).toBe('User reactivated successfully.');
    await expect(page.getByTestId('user-status-2')).toHaveText('Active');
  });

  test('@p1 cancelling the modal leaves the status unchanged', async ({ app, page }) => {
    await app.goto('users');
    await page.getByTestId('user-toggle-btn-2').click();
    await page.getByTestId('users-modal-cancel-btn').click();

    await expect(page.getByTestId('users-deactivate-modal')).toBeHidden();
    await expect(page.getByTestId('user-status-2')).toHaveText('Active');
  });

  test('@p1 "Back to list" and "Cancel" return to the list and clear the form', async ({ app, page }) => {
    await app.goto('users');

    for (const exit of ['users-back-link', 'users-cancel-btn']) {
      await page.getByTestId('users-new-btn').click();
      await fillUserForm(page, { name: 'Draft Name', email: 'draft@x.com' });
      await page.getByTestId(exit).click();

      await expect(page.getByTestId('users-list-view')).toBeVisible();
      await page.getByTestId('users-new-btn').click();
      await expect(page.getByTestId('users-name-input')).toHaveValue('');
      await expect(page.getByTestId('users-email-input')).toHaveValue('');
      await page.getByTestId('users-back-link').click();
    }
    expect(await app.stored<unknown[]>('users_db')).toHaveLength(2);
  });
});
