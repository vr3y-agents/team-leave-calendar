export type LeaveType = "Vacation" | "Sick" | "Other";

export type Person = {
  id: string;
  name: string;
  color: string;
  ink: string;
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
  { bg: "#FF4D1C", ink: "#1A1008" },
  { bg: "#2A45FF", ink: "#FFFFFF" },
  { bg: "#D6FF3C", ink: "#1A1008" },
  { bg: "#FF2E88", ink: "#1A1008" },
  { bg: "#14A35A", ink: "#FFFFFF" },
  { bg: "#FFB000", ink: "#1A1008" },
  { bg: "#6E3BFF", ink: "#FFFFFF" },
  { bg: "#1A1208", ink: "#F4EFE4" },
];

export const LEAVE_TYPES: LeaveType[] = ["Vacation", "Sick", "Other"];

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
    { id: "maya", name: "Maya Chen", color: PALETTE[0].bg, ink: PALETTE[0].ink },
    { id: "jules", name: "Jules Okonkwo", color: PALETTE[1].bg, ink: PALETTE[1].ink },
    { id: "sam", name: "Sam Rivera", color: PALETTE[2].bg, ink: PALETTE[2].ink },
    { id: "priya", name: "Priya Nair", color: PALETTE[3].bg, ink: PALETTE[3].ink },
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

  return { people, entries };
}

function isBoardState(value: unknown): value is BoardState {
  if (!value || typeof value !== "object") return false;
  const board = value as BoardState;
  return Array.isArray(board.people) && Array.isArray(board.entries);
}

export function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedBoard();
    const parsed: unknown = JSON.parse(raw);
    if (!isBoardState(parsed)) return seedBoard();
    return parsed;
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
