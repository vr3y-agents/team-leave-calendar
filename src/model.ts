export type Role = "employee" | "manager";

export type RequestStatus = "pending" | "approved" | "rejected";

export type Person = {
  id: string;
  name: string;
  role: Role;
  team: string;
};

export type VacationRequest = {
  id: string;
  employeeId: string;
  start: string;
  end: string;
  note: string;
  status: RequestStatus;
  createdAt: string;
  decisionComment: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

export type AppState = {
  currentUserId: string;
  requests: VacationRequest[];
};

export const STORAGE_KEY = "ferien-antraege-v1";
export const NOTE_MAX = 280;
const MAX_SPAN_DAYS = 366;
const DAY_MS = 86_400_000;

export const PEOPLE: readonly Person[] = [
  { id: "lea", name: "Lea Hofmann", role: "manager", team: "Teamleitung" },
  { id: "noah", name: "Noah Keller", role: "employee", team: "Entwicklung" },
  { id: "mara", name: "Mara Vogel", role: "employee", team: "Design" },
  { id: "jonas", name: "Jonas Frei", role: "employee", team: "Beratung" },
];

export const DEFAULT_USER_ID = "noah";

const STATUSES: readonly RequestStatus[] = ["pending", "approved", "rejected"];

export function getPerson(id: string): Person | undefined {
  return PEOPLE.find((person) => person.id === id);
}

export function statusLabel(status: RequestStatus): string {
  if (status === "approved") return "Genehmigt";
  if (status === "rejected") return "Abgelehnt";
  return "Ausstehend";
}

export function workdayLabel(count: number): string {
  return count === 1 ? "1 Arbeitstag" : `${count} Arbeitstage`;
}

export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function formatISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

export function formatRange(start: string, end: string): string {
  const first = parseISODate(start);
  const last = parseISODate(end);
  if (!first || !last) return `${start} – ${end}`;
  if (start === end) return formatLongDate(first);
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    const month = first.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    return `${first.getDate()}.–${last.getDate()}. ${month}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    const startText = first.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
    return `${startText} – ${formatLongDate(last)}`;
  }
  return `${formatLongDate(first)} – ${formatLongDate(last)}`;
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

export function countWorkingDays(start: string, end: string): number | null {
  const first = parseISODate(start);
  const last = parseISODate(end);
  if (!first || !last || start > end) return null;
  const span = Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1;
  if (span > MAX_SPAN_DAYS) return null;
  let count = 0;
  const cursor = new Date(first.getTime());
  while (cursor <= last) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function validateRequest(input: {
  start: string;
  end: string;
  note: string;
  employeeId: string;
  existing: readonly VacationRequest[];
}): string | null {
  const start = input.start.trim();
  const end = input.end.trim();
  if (!start || !end) return "Bitte geben Sie Start- und Enddatum an.";
  if (!parseISODate(start) || !parseISODate(end)) return "Bitte geben Sie gültige Daten an.";
  if (end < start) return "Das Enddatum darf nicht vor dem Startdatum liegen.";
  const days = countWorkingDays(start, end);
  if (days === null) return "Ein Antrag darf höchstens 366 Tage umfassen.";
  if (days === 0) return "Der Zeitraum enthält keine Arbeitstage. Samstag und Sonntag zählen nicht.";
  if (input.note.trim().length > NOTE_MAX) return `Die Bemerkung darf höchstens ${NOTE_MAX} Zeichen lang sein.`;
  const overlaps = input.existing.some(
    (request) =>
      request.employeeId === input.employeeId &&
      request.status !== "rejected" &&
      request.start <= end &&
      start <= request.end,
  );
  if (overlaps) return "Dieser Zeitraum überschneidet sich mit einem offenen oder genehmigten Antrag.";
  return null;
}

export function createRequest(input: {
  employeeId: string;
  start: string;
  end: string;
  note: string;
  existing: readonly VacationRequest[];
  now?: Date;
}): { request: VacationRequest } | { error: string } {
  const person = getPerson(input.employeeId);
  if (!person || person.role !== "employee") return { error: "Nur Mitarbeitende können Ferien erfassen." };
  const error = validateRequest(input);
  if (error) return { error };
  const now = input.now ?? new Date();
  return {
    request: {
      id: crypto.randomUUID(),
      employeeId: input.employeeId,
      start: input.start.trim(),
      end: input.end.trim(),
      note: input.note.trim(),
      status: "pending",
      createdAt: now.toISOString(),
      decisionComment: "",
      decidedAt: null,
      decidedBy: null,
    },
  };
}

export function decideRequest(
  requests: readonly VacationRequest[],
  requestId: string,
  status: "approved" | "rejected",
  comment: string,
  managerId: string,
  now = new Date(),
): VacationRequest[] | null {
  const manager = getPerson(managerId);
  if (!manager || manager.role !== "manager") return null;
  if (comment.trim().length > NOTE_MAX) return null;
  let changed = false;
  const next = requests.map((request) => {
    if (request.id !== requestId || request.status !== "pending") return request;
    changed = true;
    return {
      ...request,
      status,
      decisionComment: comment.trim(),
      decidedAt: now.toISOString(),
      decidedBy: managerId,
    };
  });
  return changed ? next : null;
}

export function requestsForEmployee(requests: readonly VacationRequest[], employeeId: string): VacationRequest[] {
  return requests.filter((request) => request.employeeId === employeeId).sort(compareByStart);
}

export function pendingRequests(requests: readonly VacationRequest[]): VacationRequest[] {
  return requests.filter((request) => request.status === "pending").sort(compareByStart);
}

export function decidedRequests(requests: readonly VacationRequest[]): VacationRequest[] {
  return requests.filter((request) => request.status !== "pending").sort((a, b) => {
    const aTime = a.decidedAt ?? "";
    const bTime = b.decidedAt ?? "";
    if (aTime !== bTime) return aTime < bTime ? 1 : -1;
    return compareByStart(a, b);
  });
}

function compareByStart(a: VacationRequest, b: VacationRequest): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

export function createSeedState(now = new Date()): AppState {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = nextWeekday(today, 1);
  const winter = addDays(upcoming, 21);
  const hike = addDays(upcoming, 7);
  const cityStart = addDays(upcoming, -10);

  return {
    currentUserId: DEFAULT_USER_ID,
    requests: [
      seedRequest({
        id: "seed-noah-family",
        employeeId: "noah",
        start: upcoming,
        end: addDays(upcoming, 4),
        note: "Familienbesuch",
        status: "pending",
        createdAt: atHour(addDays(today, -2), 9),
      }),
      seedRequest({
        id: "seed-mara-winter",
        employeeId: "mara",
        start: winter,
        end: addDays(winter, 4),
        note: "Winterferien",
        status: "pending",
        createdAt: atHour(addDays(today, -1), 11),
      }),
      seedRequest({
        id: "seed-mara-hike",
        employeeId: "mara",
        start: hike,
        end: addDays(hike, 4),
        note: "Wanderferien",
        status: "approved",
        createdAt: atHour(addDays(today, -20), 10),
        decisionComment: "Schöne Ferien.",
        decidedAt: atHour(addDays(today, -18), 15),
        decidedBy: "lea",
      }),
      seedRequest({
        id: "seed-mara-city",
        employeeId: "mara",
        start: cityStart,
        end: addDays(cityStart, 3),
        note: "Städtetrip",
        status: "rejected",
        createdAt: atHour(addDays(today, -30), 8),
        decisionComment: "Bitte auf die Projektwoche verschieben.",
        decidedAt: atHour(addDays(today, -28), 16),
        decidedBy: "lea",
      }),
    ],
  };
}

function seedRequest(input: {
  id: string;
  employeeId: string;
  start: Date;
  end: Date;
  note: string;
  status: RequestStatus;
  createdAt: string;
  decisionComment?: string;
  decidedAt?: string;
  decidedBy?: string;
}): VacationRequest {
  return {
    id: input.id,
    employeeId: input.employeeId,
    start: formatISODate(input.start),
    end: formatISODate(input.end),
    note: input.note,
    status: input.status,
    createdAt: input.createdAt,
    decisionComment: input.decisionComment ?? "",
    decidedAt: input.decidedAt ?? null,
    decidedBy: input.decidedBy ?? null,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function nextWeekday(from: Date, weekday: number): Date {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function atHour(date: Date, hour: number): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0).toISOString();
}

export function loadState(storage: Storage | null = browserStorage(), now = new Date()): AppState {
  if (!storage) return createSeedState(now);
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState(now);
    return migrateState(JSON.parse(raw)) ?? createSeedState(now);
  } catch {
    return createSeedState(now);
  }
}

export function saveState(state: AppState, storage: Storage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
  } catch {
    // The session still works if the browser refuses to persist.
  }
}

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function migrateState(value: unknown): AppState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.currentUserId !== "string" || !getPerson(raw.currentUserId)) return null;
  if (!Array.isArray(raw.requests)) return null;
  const seen = new Set<string>();
  const requests: VacationRequest[] = [];
  for (const entry of raw.requests) {
    const request = migrateRequest(entry);
    if (!request || seen.has(request.id)) continue;
    seen.add(request.id);
    requests.push(request);
  }
  return { currentUserId: raw.currentUserId, requests };
}

function migrateRequest(value: unknown): VacationRequest | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.employeeId !== "string" || !getPerson(raw.employeeId)) return null;
  if (typeof raw.start !== "string" || typeof raw.end !== "string") return null;
  if (!parseISODate(raw.start) || !parseISODate(raw.end) || raw.end < raw.start) return null;
  if (typeof raw.status !== "string" || !STATUSES.includes(raw.status as RequestStatus)) return null;
  if (typeof raw.createdAt !== "string" || Number.isNaN(new Date(raw.createdAt).getTime())) return null;
  const note = typeof raw.note === "string" ? raw.note.slice(0, NOTE_MAX) : "";
  const decisionComment = typeof raw.decisionComment === "string" ? raw.decisionComment.slice(0, NOTE_MAX) : "";
  const decidedAt = typeof raw.decidedAt === "string" && !Number.isNaN(new Date(raw.decidedAt).getTime()) ? raw.decidedAt : null;
  const decidedBy = typeof raw.decidedBy === "string" && getPerson(raw.decidedBy) ? raw.decidedBy : null;
  return {
    id: raw.id,
    employeeId: raw.employeeId,
    start: raw.start,
    end: raw.end,
    note,
    status: raw.status as RequestStatus,
    createdAt: raw.createdAt,
    decisionComment,
    decidedAt,
    decidedBy,
  };
}
