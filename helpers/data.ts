import { addDays, ago, today, type Offset } from './time';

export type VehicleType = 'Car' | 'Motorcycle' | 'Pickup' | 'Van';
export type SpotStatus = 'available' | 'occupied' | 'maintenance';
export type Modality = 'hour' | 'day' | 'monthly';
export type Method = 'Cash' | 'Transfer' | 'Card' | 'No charge';

export interface Spot {
  number: string;
  zone: string;
  type: VehicleType;
  status: SpotStatus;
  plate: string | null;
}

export interface User {
  id: number;
  name: string;
  document: string;
  email: string;
  phone: string;
  role: 'Administrator' | 'Operator';
  password: string;
  status: 'active' | 'inactive';
}

export interface Session {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  document: string;
}

export interface Entry {
  id: number;
  plate: string;
  type: VehicleType;
  owner: string;
  phone: string;
  space: string;
  modality: Modality;
  date: string;
  time: string;
  notes: string;
  status: 'active' | 'inactive';
}

export interface ExitRecord {
  id: number;
  plate: string;
  type: VehicleType;
  space: string;
  modality: Modality;
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime: string;
  durationMin: number;
  chargeDetail: string;
  totalCharged: number;
  paymentMethod: Method;
  isMonthly: boolean;
}

export interface Subscription {
  id: string;
  plate: string;
  owner: string;
  type: VehicleType;
  paymentMethod: string;
  startDate: string;
  expirationDate: string;
  amount: number;
}

// ─── Seed that the app itself creates on first load ──────────────────────────

const spot = (number: string, zone: string, type: VehicleType, status: SpotStatus = 'available'): Spot => ({
  number,
  zone,
  type,
  status,
  plate: null,
});

export const defaultSpots = (): Spot[] => [
  spot('A-10', 'A', 'Car'),
  spot('A-11', 'A', 'Car'),
  spot('A-12', 'A', 'Car', 'maintenance'),
  spot('A-13', 'A', 'Car'),
  spot('A-14', 'A', 'Car'),
  spot('A-15', 'A', 'Car'),
  ...[1, 2, 3, 4, 5, 6].map((n) => spot(`B-0${n}`, 'B', 'Motorcycle')),
  ...[1, 2, 3, 4, 5, 6].map((n) => spot(`C-0${n}`, 'C', 'Pickup')),
];

export const defaultUsers = (): User[] => [
  {
    id: 1,
    name: 'Carlos Administrator',
    document: '1000000001',
    email: 'admin@autoscolombia.com',
    phone: '300 000 0001',
    role: 'Administrator',
    password: '12345',
    status: 'active',
  },
  {
    id: 2,
    name: 'María Operator',
    document: '1000000002',
    email: 'operator@autoscolombia.com',
    phone: '300 000 0002',
    role: 'Operator',
    password: 'op123',
    status: 'active',
  },
];

export const adminSession = (): Session => ({
  id: 1,
  name: 'Carlos Administrator',
  email: 'admin@autoscolombia.com',
  role: 'Administrator',
  phone: '300 000 0001',
  document: '1000000001',
});

// ─── Builders for scenario data ──────────────────────────────────────────────

let seq = 0;
const nextId = () => 1_700_000_000_000 + ++seq * 1000 + Math.floor(Math.random() * 999);

export interface ActiveEntryInput {
  plate: string;
  type?: VehicleType;
  space?: string;
  modality?: Modality;
  /** How long ago the vehicle entered. Defaults to "now". */
  since?: Offset;
}

export function entryRecord(i: ActiveEntryInput & { space: string }): Entry {
  const { date, time } = ago(i.since ?? {});
  return {
    id: nextId(),
    plate: i.plate,
    type: i.type ?? 'Car',
    owner: '',
    phone: '',
    space: i.space,
    modality: i.modality ?? 'hour',
    date,
    time,
    notes: '',
    status: 'active',
  };
}

export interface ExitInput {
  plate?: string;
  type?: VehicleType;
  total?: number;
  method?: Method;
  /** Days before today the exit happened (0 = today). */
  daysAgo?: number;
  isMonthly?: boolean;
  id?: number;
}

export function exitRecord(i: ExitInput = {}): ExitRecord {
  const date = addDays(today(), -(i.daysAgo ?? 0));
  return {
    id: i.id ?? nextId(),
    plate: i.plate ?? 'ABC123',
    type: i.type ?? 'Car',
    space: 'A-10',
    modality: i.isMonthly ? 'monthly' : 'hour',
    entryDate: date,
    entryTime: '08:00',
    exitDate: date,
    exitTime: '11:00',
    durationMin: 180,
    chargeDetail: '3 hours',
    totalCharged: i.total ?? 9000,
    paymentMethod: i.method ?? 'Cash',
    isMonthly: i.isMonthly ?? false,
  };
}

export interface SubscriptionInput {
  plate: string;
  owner?: string;
  type?: VehicleType;
  /** Days until expiration (negative = already expired). */
  expiresIn: number;
  id?: string;
}

export function subscription(i: SubscriptionInput): Subscription {
  const expirationDate = addDays(today(), i.expiresIn);
  const type = i.type ?? 'Car';
  return {
    id: i.id ?? String(nextId()),
    plate: i.plate,
    owner: i.owner ?? 'Test Owner',
    type,
    paymentMethod: 'Cash',
    startDate: addDays(expirationDate, -30),
    expirationDate,
    amount: { Car: 80000, Motorcycle: 70000, Pickup: 80000, Van: 100000 }[type],
  };
}

/** A finished entry that happened `daysAgo` days ago (used for report scenarios). */
export function pastEntry(daysAgo: number, type: VehicleType = 'Car'): Entry {
  const id = nextId();
  return {
    ...entryRecord({ plate: `P${id % 100000}`, type, space: 'A-10' }),
    id,
    date: addDays(today(), -daysAgo),
    time: '09:30',
    status: 'inactive',
  };
}
