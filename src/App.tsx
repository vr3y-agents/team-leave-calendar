import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  LEAVE_TYPES,
  LeaveType,
  assignLanes,
  formatISODate,
  formatRange,
  isLeaveType,
  loadBoard,
  longDate,
  monthName,
  nextSwatch,
  offOn,
  saveBoard,
  segmentsForWeek,
  weeksForMonth,
  type BoardState,
  type Person,
  type TimeOff,
} from "./model";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FormState = {
  name: string;
  start: string;
  end: string;
  type: LeaveType;
  note: string;
};

function todayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function emptyForm(today: string): FormState {
  return { name: "", start: today, end: today, type: "Vacation", note: "" };
}

function barLabel(person: Person, entry: TimeOff, span: number): string {
  const first = person.name.split(" ")[0] ?? person.name;
  if (span <= 1) return first;
  if (span === 2) return person.name;
  return `${person.name} · ${entry.type}`;
}

export default function App() {
  const today = useMemo(() => todayDate(), []);
  const todayIso = formatISODate(today);
  const [board, setBoard] = useState<BoardState>(() => loadBoard());
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(todayIso));
  const [error, setError] = useState("");

  useEffect(() => {
    saveBoard(board);
  }, [board]);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`entry-${selectedId}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const peopleById = useMemo(
    () => new Map(board.people.map((person) => [person.id, person])),
    [board.people],
  );
  const weeks = useMemo(
    () => weeksForMonth(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );
  const awayToday = useMemo(() => {
    return offOn(board.entries, todayIso).sort((a, b) => {
      const aName = peopleById.get(a.personId)?.name ?? "";
      const bName = peopleById.get(b.personId)?.name ?? "";
      return aName.localeCompare(bName);
    });
  }, [board.entries, peopleById, todayIso]);
  const awayCount = useMemo(
    () => new Set(awayToday.map((entry) => entry.personId)).size,
    [awayToday],
  );
  const listed = useMemo(
    () => [...board.entries].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)),
    [board.entries],
  );

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function jumpToday() {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function addEntry(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Add a person's name.");
      return;
    }
    if (!form.start || !form.end) {
      setError("Pick a start and end date.");
      return;
    }
    if (form.end < form.start) {
      setError("The end date is before the start date.");
      return;
    }

    const existing = board.people.find((person) => person.name.toLowerCase() === name.toLowerCase());
    const swatch = nextSwatch(board.people);
    const person: Person = existing ?? {
      id: crypto.randomUUID(),
      name,
      color: swatch.bg,
      ink: swatch.ink,
    };
    const entry: TimeOff = {
      id: crypto.randomUUID(),
      personId: person.id,
      start: form.start,
      end: form.end,
      type: form.type,
      note: form.note.trim(),
      sample: false,
    };
    setBoard({
      people: existing ? board.people : [...board.people, person],
      entries: [...board.entries, entry],
    });

    const start = parseStart(form.start);
    setCursor({ year: start.getFullYear(), month: start.getMonth() });
    setSelectedId(entry.id);
    setForm((current) => ({ ...current, note: "" }));
    setError("");
  }

  function removeEntry(id: string) {
    setBoard((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
    }));
    setSelectedId((current) => (current === id ? null : current));
  }

  return (
    <div className="page">
      <header className="top">
        <div className="wrap top-inner">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div>
              <h1 className="word">Out</h1>
              <p className="tag">Team leave</p>
            </div>
          </div>
          <p className="header-count">
            <span className="count-num">{awayCount}</span>
            <span className="count-label">{awayCount === 1 ? "person out today" : "people out today"}</span>
          </p>
        </div>
      </header>

      <main className="wrap main">
        <div className="app-grid">
          <section className="calendar-col" aria-label="Month calendar">
            <div className="month-bar">
              <div className="month-lockup">
                <h2>{monthName(cursor.year, cursor.month)}</h2>
                <span>{cursor.year}</span>
              </div>
              <div className="month-nav">
                <button type="button" className="nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  Prev
                </button>
                <button type="button" className="nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                  Next
                </button>
                <button type="button" className="today-btn" onClick={jumpToday}>
                  Today
                </button>
              </div>
            </div>

            <div className="cal-scroll">
              <div className="cal">
                <div className="dow">
                  {WEEKDAYS.map((day) => (
                    <span key={day} className={day === "Sat" || day === "Sun" ? "dow-end" : undefined}>
                      {day}
                    </span>
                  ))}
                </div>
                {weeks.map((week) => {
                  const lanes = assignLanes(segmentsForWeek(board.entries, week));
                  const dayMin = 84 + Math.max(0, lanes.length - 1) * 44;
                  const weekKey = formatISODate(week[0]);
                  return (
                    <div className="week" key={weekKey}>
                      <div className="day-grid">
                        {week.map((day) => {
                          const iso = formatISODate(day);
                          const outside = day.getMonth() !== cursor.month;
                          const weekend = day.getDay() === 0 || day.getDay() === 6;
                          const isToday = iso === todayIso;
                          const className = ["day", outside ? "outside" : "", weekend ? "weekend" : "", isToday ? "today" : ""]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <div key={iso} className={className} style={{ minHeight: dayMin }}>
                              <span className="num" aria-current={isToday ? "date" : undefined}>
                                {day.getDate()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {lanes.length > 0 && (
                        <div className="bar-layer">
                          {lanes.map((lane, laneIndex) => (
                            <div className="lane" key={`${weekKey}-${laneIndex}`}>
                              {lane.map((segment) => {
                                const person = peopleById.get(segment.entry.personId);
                                if (!person) return null;
                                const span = segment.endCol - segment.startCol + 1;
                                const selected = selectedId === segment.entry.id;
                                return (
                                  <button
                                    key={segment.entry.id}
                                    type="button"
                                    className={selected ? "bar selected" : "bar"}
                                    style={{
                                      gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                                      background: person.color,
                                      color: person.ink,
                                    }}
                                    aria-pressed={selected}
                                    aria-label={`${person.name}, ${segment.entry.type}, ${formatRange(segment.entry.start, segment.entry.end)}${segment.entry.sample ? ", sample" : ""}${segment.entry.note ? `, ${segment.entry.note}` : ""}`}
                                    onClick={() => setSelectedId(segment.entry.id)}
                                  >
                                    <span className="bar-label">{barLabel(person, segment.entry, span)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="rail">
            <section className="panel today-panel" aria-label="Who is off today">
              <p className="kicker">Who's off today</p>
              <p className="today-date">{longDate(today)}</p>
              {awayToday.length === 0 ? (
                <div className="slab slab-empty">
                  <p className="who">Everyone's in.</p>
                  <p className="meta">No time off covers today.</p>
                </div>
              ) : (
                <div className="slabs">
                  {awayToday.map((entry) => {
                    const person = peopleById.get(entry.personId);
                    if (!person) return null;
                    return (
                      <article
                        key={entry.id}
                        className="slab"
                        style={{ background: person.color, color: person.ink }}
                      >
                        <h3 className="who">{person.name}</h3>
                        <p className="meta">
                          {entry.type}
                          {entry.sample ? " · Sample" : ""}
                          {" · "}
                          {formatRange(entry.start, entry.end)}
                        </p>
                        {entry.note ? <p className="note">{entry.note}</p> : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="rail-rest">
            <section className="panel" aria-label="Team">
              <p className="kicker">Team</p>
              <ul className="legend">
                {board.people.map((person) => (
                  <li key={person.id} className="chip">
                    <span className="swatch" style={{ background: person.color }} />
                    {person.name}
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <p className="kicker">Add time off</p>
              <h2 className="panel-title">Log a stretch out.</h2>
              <form onSubmit={addEntry} className="form">
                <label>
                  Name
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    list="team-names"
                    maxLength={40}
                    placeholder="Add a name"
                    autoComplete="off"
                    required
                  />
                </label>
                <datalist id="team-names">
                  {board.people.map((person) => (
                    <option key={person.id} value={person.name} />
                  ))}
                </datalist>
                <div className="date-row">
                  <label>
                    Start
                    <input
                      type="date"
                      value={form.start}
                      onChange={(event) => updateForm("start", event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="date"
                      value={form.end}
                      min={form.start}
                      onChange={(event) => updateForm("end", event.target.value)}
                      required
                    />
                  </label>
                </div>
                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(event) => {
                      if (isLeaveType(event.target.value)) updateForm("type", event.target.value);
                    }}
                  >
                    {LEAVE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note <span className="optional">optional</span>
                  <input
                    value={form.note}
                    onChange={(event) => updateForm("note", event.target.value)}
                    maxLength={80}
                    placeholder="Cabin, no signal"
                  />
                </label>
                {error ? (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="primary">
                  Add to the board
                </button>
                <p className="hint">A new name joins the team and picks up the next colour. Dates include both ends.</p>
              </form>
            </section>

            <section className="panel" aria-label="Time off entries">
              <p className="kicker">On the board</p>
              {listed.length === 0 ? (
                <p className="empty-copy">Nothing logged. Add the first stretch above.</p>
              ) : (
                <ul className="entries">
                  {listed.map((entry) => {
                    const person = peopleById.get(entry.personId);
                    if (!person) return null;
                    const selected = selectedId === entry.id;
                    return (
                      <li key={entry.id} id={`entry-${entry.id}`} className={selected ? "entry selected" : "entry"}>
                        <span className="entry-swatch" style={{ background: person.color }} />
                        <div className="entry-copy">
                          <strong>{person.name}</strong>
                          <span>
                            {formatRange(entry.start, entry.end)} · {entry.type}
                            {entry.sample ? " · Sample" : ""}
                          </span>
                          {entry.note ? <span className="entry-note">{entry.note}</span> : null}
                        </div>
                        <button type="button" className="remove" onClick={() => removeEntry(entry.id)}>
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            </div>
          </aside>
        </div>
        <p className="foot">Saved in this browser. Sample rows are marked and can be removed.</p>
      </main>
    </div>
  );
}

function parseStart(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}
