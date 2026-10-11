// All date maths is done in the same zone the browser runs in (see playwright.config.ts),
// so what the test computes is what the app computes with `new Date()`.
export const TZ = 'America/Bogota';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface Stamp {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export function stamp(d: Date): Stamp {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export interface Offset {
  days?: number;
  hours?: number;
  minutes?: number;
}

/** Date/time of "now minus offset" in app-local time. */
export function ago({ days = 0, hours = 0, minutes = 0 }: Offset): Stamp {
  const ms = ((days * 24 + hours) * 60 + minutes) * 60_000;
  return stamp(new Date(Date.now() - ms));
}

export const today = (): string => stamp(new Date()).date;

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> DD/MM/YYYY (how the app shows dates without time). */
export const display = (iso: string): string => iso.split('-').reverse().join('/');

/** Currency the way the app prints it: "$9.000". */
export const cop = (n: number): string => '$' + n.toLocaleString('es-CO');

/** Minutes between two HH:MM strings, circular over midnight. */
export function minutesApart(a: string, b: string): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const diff = Math.abs(toMin(a) - toMin(b));
  return Math.min(diff, 1440 - diff);
}
