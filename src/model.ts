export type LeaveType = "Vacation" | "Sick" | "Other";

export type Person = {
  id: string;
  name: string;
  color: string;
  ink: string;
  /** Holiday allowance in working days (Mon–Fri). */
  allowance: number;
};

export type TimeOff = {
  id: string;
  personId: string;
  start: string;
  end: string;
  type: LeaveType;
  note: string;
  sample: boolean;
};

export type BoardState = {
  people: Person[];
  entries: TimeOff[];
};

export type Swatch = { bg: string; ink: string };

export const PALETTE: Swatch[] = [
  { bg: "#f0c2b4", ink: "#5c2e22" },
  { bg: "#c5d7ee", ink: "#1c3d66" },
  { bg: "#d5e3bc", ink: "#2d4318" },
  { bg: "#f0c9d6", ink: "#5c2940" },
  { bg: "#c5e3da", ink: "#14382e" },
  { bg: "#ead9b0", ink: "#4a3b16" },
  { bg: "#ddd0ee", ink: "#3d2f5c" },
  { bg: "#d5dbe3", ink: "#24303c" },
];

export const LEAVE_TYPES: LeaveType[] = ["Vacation", "Sick", "Other"];

/** Used when an older saved person has no allowance yet. */
export const DEFAULT_ALLOWANCE = 25;

const MAX_ALLOWANCE = 366;

export function countsAgainstAllowance(type: LeaveType): boolean {
  return type === "Vacation";
}

export function normalizeAllowance(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_ALLOWANCE;
  return Math.min(MAX_ALLOWANCE, Math.round(parsed));
}

/** Unique vacation weekdays for one person. Overlapping entries count once. */
export function usedWorkingDays(entries: TimeOff[], personId: string): number {
  const days = new Set<string>();
  for (const entry of entries) {
    if (entry.personId !== personId || !countsAgainstAllowance(entry.type)) continue;
    let cursor = parseISODate(entry.start);
    const endDate = parseISODate(entry.end);
    if (entry.end < entry.start) continue;
    for (let guard = 0; cursor <= endDate && guard < 4000; guard += 1) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) days.add(formatISODate(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  return days.size;
}

const STORAGE_KEY = "out-board-v1";

export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeekMonday(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

export function weeksForMonth(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let cursor = startOfWeekMonday(first);
  const weeks: Date[][] = [];
  while (cursor <= last) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function formatRange(start: string, end: string): string {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  const monthDay: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (start === end) return startDate.toLocaleDateString("en-US", monthDay);
  if (startDate.getFullYear() !== endDate.getFullYear()) {
    const withYear: Intl.DateTimeFormatOptions = { ...monthDay, year: "numeric" };
    return `${startDate.toLocaleDateString("en-US", withYear)} – ${endDate.toLocaleDateString("en-US", withYear)}`;
  }
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.toLocaleDateString("en-US", monthDay)}–${endDate.getDate()}`;
  }
  return `${startDate.toLocaleDateString("en-US", monthDay)} – ${endDate.toLocaleDateString("en-US", monthDay)}`;
}

export function longDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function monthName(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long" });
}

export function nextSwatch(people: Person[]): Swatch {
  const used = new Set(people.map((person) => person.color));
  return PALETTE.find((swatch) => !used.has(swatch.bg)) ?? PALETTE[people.length % PALETTE.length];
}

export function seedBoard(now = new Date()): BoardState {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const later = startOfWeekMonday(addDays(today, 14));
  const breakStart = new Date(today.getFullYear(), today.getMonth() + 1, 21);
  const breakEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const people: Person[] = [
    { id: "maya", name: "Maya Chen", color: PALETTE[0].bg, ink: PALETTE[0].ink, allowance: 0 },
    { id: "jules", name: "Jules Okonkwo", color: PALETTE[1].bg, ink: PALETTE[1].ink, allowance: 0 },
    { id: "sam", name: "Sam Rivera", color: PALETTE[2].bg, ink: PALETTE[2].ink, allowance: 0 },
    { id: "priya", name: "Priya Nair", color: PALETTE[3].bg, ink: PALETTE[3].ink, allowance: 0 },
  ];

  const entries: TimeOff[] = [
    {
      id: "sample-maya",
      personId: "maya",
      start: formatISODate(addDays(today, -1)),
      end: formatISODate(addDays(today, 3)),
      type: "Vacation",
      note: "Autumn week",
      sample: true,
    },
    {
      id: "sample-jules",
      personId: "jules",
      start: formatISODate(today),
      end: formatISODate(today),
      type: "Sick",
      note: "Out sick",
      sample: true,
    },
    {
      id: "sample-priya-offsite",
      personId: "priya",
      start: formatISODate(addDays(today, -4)),
      end: formatISODate(addDays(today, -1)),
      type: "Other",
      note: "Offsite",
      sample: true,
    },
    {
      id: "sample-sam",
      personId: "sam",
      start: formatISODate(later),
      end: formatISODate(addDays(later, 4)),
      type: "Vacation",
      note: "Family visit",
      sample: true,
    },
    {
      id: "sample-priya-break",
      personId: "priya",
      start: formatISODate(breakStart),
      end: formatISODate(breakEnd),
      type: "Vacation",
      note: "Winter break",
      sample: true,
    },
  ];

  for (const person of people) person.allowance = seededAllowance(person.id, entries);
  return { people, entries };
}

function seededAllowance(personId: string, entries: TimeOff[]): number {
  const used = usedWorkingDays(entries, personId);
  if (personId === "jules") return 25;
  if (personId === "priya") return used + 4;
  if (personId === "sam") return used + 5;
  return used + 7;
}

function migratePerson(value: unknown): Person | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Person>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (typeof raw.color !== "string" || typeof raw.ink !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    color: raw.color,
    ink: raw.ink,
    allowance: normalizeAllowance(raw.allowance),
  };
}

function migrateEntry(value: unknown): TimeOff | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<TimeOff>;
  if (typeof raw.id !== "string" || typeof raw.personId !== "string") return null;
  if (typeof raw.start !== "string" || typeof raw.end !== "string") return null;
  if (typeof raw.type !== "string" || !isLeaveType(raw.type)) return null;
  return {
    id: raw.id,
    personId: raw.personId,
    start: raw.start,
    end: raw.end,
    type: raw.type,
    note: typeof raw.note === "string" ? raw.note : "",
    sample: raw.sample === true,
  };
}

function migrateBoard(value: unknown): BoardState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { people?: unknown; entries?: unknown };
  if (!Array.isArray(raw.people) || !Array.isArray(raw.entries)) return null;
  return {
    people: raw.people.map(migratePerson).filter((person): person is Person => person !== null),
    entries: raw.entries.map(migrateEntry).filter((entry): entry is TimeOff => entry !== null),
  };
}

export function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedBoard();
    const parsed: unknown = JSON.parse(raw);
    return migrateBoard(parsed) ?? seedBoard();
  } catch {
    return seedBoard();
  }
}

export function saveBoard(board: BoardState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

export function isLeaveType(value: string): value is LeaveType {
  return value === "Vacation" || value === "Sick" || value === "Other";
}

export type WeekSegment = {
  entry: TimeOff;
  startCol: number;
  endCol: number;
};

export function segmentsForWeek(entries: TimeOff[], week: Date[]): WeekSegment[] {
  const weekStart = formatISODate(week[0]);
  const weekEnd = formatISODate(week[6]);
  const segments: WeekSegment[] = [];

  for (const entry of entries) {
    if (entry.end < weekStart || entry.start > weekEnd) continue;
    const start = entry.start > weekStart ? entry.start : weekStart;
    const end = entry.end < weekEnd ? entry.end : weekEnd;
    const startCol = week.findIndex((day) => formatISODate(day) === start);
    const endCol = week.findIndex((day) => formatISODate(day) === end);
    if (startCol < 0 || endCol < 0) continue;
    segments.push({ entry, startCol, endCol });
  }

  segments.sort((a, b) => {
    const spanA = a.endCol - a.startCol;
    const spanB = b.endCol - b.startCol;
    return spanB - spanA || a.startCol - b.startCol || a.entry.personId.localeCompare(b.entry.personId);
  });
  return segments;
}

function overlaps(a: WeekSegment, b: WeekSegment): boolean {
  return a.startCol <= b.endCol && b.startCol <= a.endCol;
}

export function assignLanes(segments: WeekSegment[]): WeekSegment[][] {
  const lanes: WeekSegment[][] = [];
  for (const segment of segments) {
    const lane = lanes.find((items) => items.every((other) => !overlaps(other, segment)));
    if (lane) lane.push(segment);
    else lanes.push([segment]);
  }
  return lanes;
}

export function offOn(entries: TimeOff[], iso: string): TimeOff[] {
  return entries
    .filter((entry) => entry.start <= iso && iso <= entry.end)
    .sort((a, b) => a.personId.localeCompare(b.personId));
}
