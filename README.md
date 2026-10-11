# Autos Colombia E2E

End-to-end Playwright tests for the [Parking-Management](https://github.com/CamiloLondonoDev/Parking-Management) app.

## How it runs in CI

1. A push to `main` in **Parking-Management** deploys to GitHub Pages.
2. Its workflow then POSTs a `repository_dispatch` (`event_type: app-deployed`) to this repo with
   `client_payload.deployed_url`.
3. [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) exposes that URL as `BASE_URL` and runs the suite.
   The HTML report is uploaded as the `playwright-report` artifact.

Requirement on the app repo: secret `QA_REPO_DISPATCH_TOKEN` (a PAT / fine-grained token with
*Contents: read & write* on this repo — needed by the dispatches API).

You can also run it by hand from *Actions > E2E tests > Run workflow* and passing a URL.

## Run locally

```bash
npm ci
npx playwright install chromium

# against a local copy of the app
git clone https://github.com/CamiloLondonoDev/Parking-Management.git ../Parking-Management
npx --yes http-server ../Parking-Management -p 8080 -s &

npm test                                   # BASE_URL defaults to http://localhost:8080/
BASE_URL=https://<user>.github.io/Parking-Management/ npm test
npm run test:p0                            # only @p0 tests
```

`BASE_URL` may or may not end with `/`; the config normalises it (the app is served under a
sub-path on GitHub Pages, so all navigation is relative: `HTML/login.html`).

## Layout

| Path | What |
| --- | --- |
| `fixtures/index.ts` | `app` (seed + `goto`), `dialogs` (alert/confirm recorder), `consoleErrors` |
| `helpers/data.ts` | Seeds the app creates on first load + builders for entries, exits, subscriptions |
| `helpers/time.ts` | Date maths in `America/Bogota` (same zone as the browser), `cop()` formatter |
| `helpers/actions.ts` | Form helpers shared by specs |
| `tests/*.spec.ts` | auth, navigation, entry, exit, spaces, payments, users, dashboard, reports, e2e-flow |

Tests are tagged `@p0` / `@p1` in the title.

## Conventions worth knowing

- **State**: every test gets a new browser context. The `app` fixture explicitly clears the app's
  localStorage keys and writes the scenario once (a sentinel stops re-seeding on reload, so
  persistence tests are real). `session` is injected so only `auth.spec.ts` uses the login form.
  Call `app.seed(...)` / `app.addActiveEntry(...)` **before** `app.goto(...)`.
- **Dialogs**: `alert()` / `confirm()` block the page; the `dialogs` fixture is always listening.
  Use `dialogs.last`, and `dialogs.dismissNext()` to press Cancel on a `confirm`.
- **Fees**: entries are seeded *mid-hour* (e.g. 2h30m ago for a "3 hours" charge). Hours round up, so
  this makes the result independent of how long the test itself takes.
- **Time**: entry date/time are chosen through the form/seed. `page.clock` is only used for the
  5-minute "recent vehicles" expiry.
- **Required plate**: the plate input is `required`, so the "Enter the vehicle plate." alert is only
  reachable with a whitespace-only value; that is what the test uses.
- Van has no seeded space; tests that need one add `D-01`.
