import type { Page } from '@playwright/test';
import type { Modality, VehicleType } from './data';

export interface EntryForm {
  plate?: string;
  type?: VehicleType;
  space?: string;
  modality?: Modality;
  owner?: string;
  date?: string;
  time?: string;
}

export async function fillEntryForm(page: Page, f: EntryForm): Promise<void> {
  // Plate first: its blur handler is what applies the subscription lock.
  if (f.plate !== undefined) await page.getByTestId('entry-plate-input').fill(f.plate);
  if (f.type) await page.getByTestId('entry-type-select').selectOption(f.type);
  if (f.space) await page.getByTestId('entry-space-select').selectOption(f.space);
  if (f.modality) await page.getByTestId('entry-modality-select').selectOption(f.modality);
  if (f.owner) await page.getByTestId('entry-owner-input').fill(f.owner);
  if (f.date) await page.getByTestId('entry-date-input').fill(f.date);
  if (f.time) await page.getByTestId('entry-time-input').fill(f.time);
}

export async function submitEntry(page: Page, f: EntryForm): Promise<void> {
  await fillEntryForm(page, f);
  await page.getByTestId('entry-submit-btn').click();
}

export async function searchExit(page: Page, plate: string): Promise<void> {
  await page.getByTestId('exit-plate-input').fill(plate);
  await page.getByTestId('exit-search-btn').click();
}

export async function confirmExit(page: Page, plate: string, method?: 'Cash' | 'Transfer' | 'Card') {
  await searchExit(page, plate);
  if (method) await page.getByTestId(`exit-method-${method.toLowerCase()}-btn`).click();
  await page.getByTestId('exit-confirm-btn').click();
}

/** Open the user modal from the sidebar (needed before using logout-btn). */
export async function openUserModal(page: Page): Promise<void> {
  await page.getByTestId('user-profile').click();
}

export function spotsInGrid(page: Page) {
  return page.getByTestId('spaces-grid').locator('[data-testid^="spot-"]');
}
