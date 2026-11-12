import { FormEvent, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_USER_ID,
  NOTE_MAX,
  PEOPLE,
  countWorkingDays,
  createRequest,
  createSeedState,
  decideRequest,
  decidedRequests,
  formatRange,
  formatTimestamp,
  getPerson,
  loadState,
  pendingRequests,
  requestsForEmployee,
  saveState,
  statusLabel,
  workdayLabel,
  type RequestStatus,
  type VacationRequest,
} from "./model";

export default function App() {
  const [state, setState] = useState(loadState);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const fallback = PEOPLE.find((person) => person.id === DEFAULT_USER_ID) ?? PEOPLE[0];
  const user = getPerson(state.currentUserId) ?? fallback;
  const employees = PEOPLE.filter((person) => person.role === "employee");
  const managers = PEOPLE.filter((person) => person.role === "manager");
  const mine = requestsForEmployee(state.requests, user.id);
  const openRequests = pendingRequests(state.requests);
  const closedRequests = decidedRequests(state.requests);
  const workdays = start && end ? countWorkingDays(start, end) : null;

  function switchUser(userId: string) {
    if (!getPerson(userId)) return;
    setState((current) => ({ ...current, currentUserId: userId }));
    setStart("");
    setEnd("");
    setNote("");
    setError("");
    setNotice("");
    setConfirmReset(false);
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createRequest({
      employeeId: user.id,
      start,
      end,
      note,
      existing: state.requests,
    });
    if ("error" in result) {
      setError(result.error);
      setNotice("");
      return;
    }
    setState((current) => ({ ...current, requests: [...current.requests, result.request] }));
    setStart("");
    setEnd("");
    setNote("");
    setError("");
    setNotice("Ihr Antrag wurde eingereicht.");
  }

  function decide(requestId: string, status: "approved" | "rejected") {
    const comment = comments[requestId] ?? "";
    const next = decideRequest(state.requests, requestId, status, comment, user.id);
    if (!next) {
      setNotice("");
      setError("Der Antrag konnte nicht entschieden werden.");
      return;
    }
    setState((current) => ({ ...current, requests: next }));
    setComments((current) => {
      const rest = { ...current };
      delete rest[requestId];
      return rest;
    });
    setError("");
    setNotice(status === "approved" ? "Der Antrag wurde genehmigt." : "Der Antrag wurde abgelehnt.");
  }

  function resetDemo() {
    setState(createSeedState());
    setStart("");
    setEnd("");
    setNote("");
    setComments({});
    setError("");
    setNotice("Die Demodaten wurden wiederhergestellt.");
    setConfirmReset(false);
  }

  return (
    <div className="page">
      <header className="top">
        <div className="wrap top-inner">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div>
              <p className="kicker">Personal</p>
              <h1>Ferienanträge</h1>
            </div>
          </div>
          <div className="switcher">
            <label htmlFor="current-user">Ansicht als</label>
            <select
              id="current-user"
              value={user.id}
              onChange={(event) => switchUser(event.target.value)}
            >
              <optgroup label="Mitarbeitende">
                {employees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.team}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Vorgesetzte">
                {managers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.team}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </header>

      <main className="wrap main">
        <p className="intro">
          {user.role === "manager"
            ? "Prüfen Sie offene Anträge. Genehmigen oder ablehnen Sie sie, optional mit einem Kommentar."
            : "Erfassen Sie Ihre Ferien und verfolgen Sie, ob ein Antrag ausstehend, genehmigt oder abgelehnt ist."}
        </p>

        {notice ? (
          <p className="notice" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p id="request-error" className="error" role="alert">
            {error}
          </p>
        ) : null}

        {user.role === "employee" ? (
          <div className="layout">
            <section className="panel" aria-labelledby="capture-heading">
              <h2 id="capture-heading">Ferien erfassen</h2>
              <form className="form" onSubmit={submitRequest} noValidate>
                <div className="date-row">
                  <div className="field">
                    <label htmlFor="start">Startdatum</label>
                    <input
                      id="start"
                      name="start"
                      type="date"
                      lang="de-DE"
                      value={start}
                      required
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "workdays-count request-error" : "workdays-count"}
                      onChange={(event) => setStart(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="end">Enddatum</label>
                    <input
                      id="end"
                      name="end"
                      type="date"
                      lang="de-DE"
                      value={end}
                      min={start || undefined}
                      required
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "workdays-count request-error" : "workdays-count"}
                      onChange={(event) => setEnd(event.target.value)}
                    />
                  </div>
                </div>
                <p id="workdays-count" className={workdays === null ? "hint" : workdays === 0 ? "workdays warn" : "workdays"} aria-live="polite">
                  {workdays === null ? "Noch kein Zeitraum gewählt." : workdayLabel(workdays)}
                </p>
                <p className="hint">Gezählt werden nur Arbeitstage, Montag bis Freitag.</p>
                <div className="field">
                  <label htmlFor="note">
                    Bemerkung <span className="optional">optional</span>
                  </label>
                  <textarea
                    id="note"
                    name="note"
                    value={note}
                    maxLength={NOTE_MAX}
                    rows={3}
                    placeholder="Zum Beispiel Familienbesuch"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
                <button type="submit" className="button button-primary">
                  Antrag einreichen
                </button>
              </form>
            </section>

            <section className="section" aria-labelledby="mine-heading">
              <h2 id="mine-heading">Meine Anträge</h2>
              {mine.length === 0 ? (
                <p className="empty">Sie haben noch keine Ferienanträge.</p>
              ) : (
                <div className="stack">
                  {mine.map((request) => (
                    <RequestCard key={request.id} request={request} showPerson={false} />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="manager">
            <section className="section" aria-labelledby="pending-heading">
              <div className="section-head">
                <h2 id="pending-heading">Offene Anträge</h2>
                <p className="count">{openRequests.length === 1 ? "1 offen" : `${openRequests.length} offen`}</p>
              </div>
              {openRequests.length === 0 ? (
                <p className="empty">Keine offenen Anträge.</p>
              ) : (
                <div className="stack">
                  {openRequests.map((request) => {
                    const person = getPerson(request.employeeId);
                    const actionName = person
                      ? `${person.name}, ${formatRange(request.start, request.end)}`
                      : formatRange(request.start, request.end);
                    return (
                      <RequestCard key={request.id} request={request} showPerson>
                        <div className="decide">
                          <label htmlFor={`comment-${request.id}`}>Kommentar (optional)</label>
                          <textarea
                            id={`comment-${request.id}`}
                            value={comments[request.id] ?? ""}
                            maxLength={NOTE_MAX}
                            rows={2}
                            placeholder="Optionaler Hinweis an die mitarbeitende Person"
                            onChange={(event) =>
                              setComments((current) => ({ ...current, [request.id]: event.target.value }))
                            }
                          />
                          <div className="actions">
                            <button
                              type="button"
                              className="button button-approve"
                              aria-label={`Genehmigen: ${actionName}`}
                              onClick={() => decide(request.id, "approved")}
                            >
                              Genehmigen
                            </button>
                            <button
                              type="button"
                              className="button button-reject"
                              aria-label={`Ablehnen: ${actionName}`}
                              onClick={() => decide(request.id, "rejected")}
                            >
                              Ablehnen
                            </button>
                          </div>
                        </div>
                      </RequestCard>
                    );
                  })}
                </div>
              )}
            </section>

            {closedRequests.length > 0 ? (
              <section className="section" aria-labelledby="decided-heading">
                <h2 id="decided-heading">Entschieden</h2>
                <div className="stack">
                  {closedRequests.map((request) => (
                    <RequestCard key={request.id} request={request} showPerson />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>

      <footer className="wrap foot">
        <p>Keine Anmeldung. Anträge bleiben in diesem Browser gespeichert.</p>
        {confirmReset ? (
          <div className="reset-confirm">
            <p>Aktuelle Anträge verwerfen und die Demodaten laden?</p>
            <div className="actions">
              <button type="button" className="button button-reject" onClick={resetDemo}>
                Ja, zurücksetzen
              </button>
              <button type="button" className="button button-quiet" onClick={() => setConfirmReset(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-button" onClick={() => setConfirmReset(true)}>
            Demodaten zurücksetzen
          </button>
        )}
      </footer>
    </div>
  );
}

function RequestCard({
  request,
  showPerson,
  children,
}: {
  request: VacationRequest;
  showPerson: boolean;
  children?: ReactNode;
}) {
  const person = getPerson(request.employeeId);
  const decider = request.decidedBy ? getPerson(request.decidedBy) : undefined;
  const days = countWorkingDays(request.start, request.end);
  if (!person) return null;
  const title = showPerson ? person.name : formatRange(request.start, request.end);

  return (
    <article className="card" aria-labelledby={`request-${request.id}`}>
      <div className="card-top">
        <div>
          <h3 id={`request-${request.id}`}>{title}</h3>
          {showPerson ? <p className="team">{person.team}</p> : null}
        </div>
        <p className={`badge badge-${request.status}`}>{statusLabel(request.status)}</p>
      </div>
      {showPerson ? <p className="range">{formatRange(request.start, request.end)}</p> : null}
      <p className="meta">{days === null ? "Zeitraum" : workdayLabel(days)}</p>
      {request.note ? <p className="note">{request.note}</p> : null}
      <p className="meta">Eingereicht am {formatTimestamp(request.createdAt)}</p>
      {request.status !== "pending" && request.decidedAt ? (
        <p className="meta">
          <DecisionLine status={request.status} decider={decider?.name} when={formatTimestamp(request.decidedAt)} />
        </p>
      ) : null}
      {request.decisionComment ? (
        <p className="decision-comment">
          <span>Kommentar</span>
          {request.decisionComment}
        </p>
      ) : null}
      {children}
    </article>
  );
}

function DecisionLine({ status, decider, when }: { status: RequestStatus; decider?: string; when: string }) {
  const verb = status === "approved" ? "Genehmigt" : "Abgelehnt";
  return (
    <>
      {verb}
      {decider ? ` von ${decider}` : ""} am {when}
    </>
  );
}
