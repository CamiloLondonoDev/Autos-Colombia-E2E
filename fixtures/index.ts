import { test as base, expect, type Page } from '@playwright/test';
import {
  adminSession,
  defaultSpots,
  defaultUsers,
  entryRecord,
  type ActiveEntryInput,
  type Entry,
  type ExitRecord,
  type Session,
  type Spot,
  type Subscription,
  type User,
  type VehicleType,
} from '../helpers/data';

export type PageName = 'login' | 'dashboard' | 'entry' | 'exit' | 'spaces' | 'payments' | 'reports' | 'users';

export const PAGE_FILE: Record<PageName, string> = {
  login: 'login.html',
  dashboard: 'dashboard.html',
  entry: 'entry.html',
  exit: 'registerexit.html',
  spaces: 'spaces.html',
  payments: 'payments.html',
  reports: 'reports.html',
  users: 'users.html',
};

export interface Seed {
  /** `null` = nobody logged in. Default: the seeded admin (login "by API"). */
  session: Session | null;
  users: User[];
  spots: Spot[];
  entries: Entry[];
  exits: ExitRecord[];
  subscriptions: Subscription[];
  recent: unknown[];
}

const SENTINEL = '__e2e_seeded';

/**
 * Owns the browser state of one test. Playwright gives every test a brand-new
 * context (empty localStorage); on top of that the init script explicitly wipes the
 * app keys and writes the scenario, once. Reloads keep whatever the app wrote.
 */
export class App {
  state: Seed = {
    session: adminSession(),
    users: defaultUsers(),
    spots: defaultSpots(),
    entries: [],
    exits: [],
    subscriptions: [],
    recent: [],
  };
  private installed = false;

  constructor(readonly page: Page) {}

  /** Merge scenario data. Must be called before the first `goto`. */
  seed(patch: Partial<Seed>): this {
    if (this.installed) throw new Error('app.seed() must be called before app.goto()');
    Object.assign(this.state, patch);
    return this;
  }

  addSpot(s: Partial<Spot> & Pick<Spot, 'number' | 'zone' | 'type'>): this {
    this.state.spots.push({ status: 'available', plate: null, ...s });
    return this;
  }

  /** Vehicle that is already inside: active entry + occupied spot. */
  addActiveEntry(input: ActiveEntryInput): Entry {
    const type: VehicleType = input.type ?? 'Car';
    const target = input.space
      ? this.state.spots.find((s) => s.number === input.space)
      : this.state.spots.find((s) => s.type === type && s.status === 'available');
    if (!target) throw new Error(`No spot available for ${type}`);
    target.status = 'occupied';
    target.plate = input.plate;
    const record = entryRecord({ ...input, type, space: target.number });
    this.state.entries.push(record);
    return record;
  }

  async goto(name: PageName): Promise<void> {
    if (!this.installed) {
      this.installed = true;
      await this.page.addInitScript(
        ([seed, sentinel]) => {
          try {
            if (localStorage.getItem(sentinel as string)) return;
            const s = seed as unknown as Record<string, unknown>;
            [
              'spots_db',
              'entry_records',
              'exit_records',
              'payments_db',
              'users_db',
              'recent_vehicles',
              'session',
            ].forEach((k) => localStorage.removeItem(k));
            const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
            set('spots_db', s.spots);
            set('users_db', s.users);
            set('entry_records', s.entries);
            set('exit_records', s.exits);
            set('payments_db', s.subscriptions);
            set('recent_vehicles', s.recent);
            if (s.session) set('session', s.session);
            localStorage.setItem(sentinel as string, '1');
          } catch {
            /* storage unavailable: nothing to seed */
          }
        },
        [this.state, SENTINEL],
      );
    }
    // Relative (no leading slash) so it resolves under the Pages sub-path.
    await this.page.goto(`HTML/${PAGE_FILE[name]}`);
  }

  /** Parsed value of a localStorage key. */
  async stored<T = unknown>(key: string): Promise<T> {
    return this.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key) as Promise<T>;
  }
}

/** alert()/confirm() recorder. They block the page, so a listener is always attached. */
export class Dialogs {
  readonly messages: string[] = [];
  readonly types: string[] = [];
  private next: 'accept' | 'dismiss' = 'accept';

  get last(): string | undefined {
    return this.messages[this.messages.length - 1];
  }
  /** The next dialog is dismissed (Cancel) instead of accepted. */
  dismissNext(): void {
    this.next = 'dismiss';
  }
  consume(): 'accept' | 'dismiss' {
    const a = this.next;
    this.next = 'accept';
    return a;
  }
}

export const test = base.extend<{
  app: App;
  dialogs: Dialogs;
  consoleErrors: string[];
}>({
  dialogs: [
    async ({ page }, use) => {
      const log = new Dialogs();
      page.on('dialog', async (d) => {
        log.messages.push(d.message());
        log.types.push(d.type());
        if (log.consume() === 'dismiss') await d.dismiss();
        else await d.accept();
      });
      await use(log);
    },
    { auto: true },
  ],
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });
      await use(errors);
    },
    { auto: true },
  ],
  app: async ({ page }, use) => {
    await use(new App(page));
  },
});

export { expect };
