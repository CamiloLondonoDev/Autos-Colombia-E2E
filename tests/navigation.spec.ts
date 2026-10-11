import { test, expect, PAGE_FILE, type PageName } from '../fixtures';

const APP_PAGES: PageName[] = ['dashboard', 'entry', 'exit', 'spaces', 'payments', 'reports', 'users'];

const LINKS: Record<PageName, string> = {
  login: '',
  dashboard: 'dashboard-link',
  entry: 'entry-link',
  exit: 'exit-link',
  spaces: 'spaces-link',
  payments: 'payments-link',
  reports: 'reports-link',
  users: 'users-link',
};

const fileRegex = (name: PageName) => new RegExp(`${PAGE_FILE[name].replace('.', '\\.')}$`);

test.describe('Sidebar links work from every page', () => {
  for (const from of APP_PAGES) {
    test(`@p0 from ${from}: all 7 links navigate to their page`, async ({ app, page }) => {
      for (const to of APP_PAGES) {
        await app.goto(from);
        await page.getByTestId(LINKS[to]).click();
        await expect(page, `${from} -> ${to}`).toHaveURL(fileRegex(to));
      }
    });
  }
});

test.describe('Active link', () => {
  for (const name of APP_PAGES) {
    test(`@p1 ${name}: only its own link is marked active`, async ({ app, page }) => {
      await app.goto(name);
      await expect(page.getByTestId(LINKS[name])).toHaveClass(/active/);
      for (const other of APP_PAGES.filter((p) => p !== name)) {
        await expect(page.getByTestId(LINKS[other])).not.toHaveClass(/active/);
      }
    });
  }
});

test.describe('Dashboard quick actions', () => {
  const actions: [string, PageName][] = [
    ['dashboard-register-entry-btn', 'entry'],
    ['dashboard-register-exit-btn', 'exit'],
    ['dashboard-view-spaces-btn', 'spaces'],
    ['dashboard-generate-report-btn', 'reports'],
  ];

  for (const [testId, target] of actions) {
    test(`@p1 ${testId} goes to ${target}`, async ({ app, page }) => {
      await app.goto('dashboard');
      await page.getByTestId(testId).click();
      await expect(page).toHaveURL(fileRegex(target));
    });
  }
});
