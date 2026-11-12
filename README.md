# Ferienanträge

A small vacation-request app for one team. Employees submit a date range and an optional note. A manager approves or rejects each open request, with an optional comment. The decision shows up on the employee’s own list.

The interface is in German. There is no account and no server. Everything stays in the browser.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://127.0.0.1:5173).

Other commands:

```bash
npm run lint    # TypeScript check
npm run build   # typecheck and production build
npm run preview # serve the build
```

## How to use the demo

Choose a person with **Ansicht als**. There is no password.

| Person | Role | Team |
| --- | --- | --- |
| Noah Keller | Employee | Entwicklung |
| Mara Vogel | Employee | Design |
| Jonas Frei | Employee | Beratung |
| Lea Hofmann | Manager | Teamleitung |

Noah and Mara already have sample requests, so the pending, approved, and rejected states are visible. Jonas starts with an empty list. Lea sees every open request and can approve or reject it.

The footer button **Demodaten zurücksetzen** replaces the saved requests with that sample set.

## What is stored

The app keeps one JSON document in `localStorage` under `ferien-antraege-v1`.

```ts
type VacationRequest = {
  id: string;
  employeeId: string;
  start: string; // YYYY-MM-DD, inclusive
  end: string;   // YYYY-MM-DD, inclusive
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decisionComment: string;
  decidedAt: string | null;
  decidedBy: string | null;
};
```

People are fixed in the app. Only the current person and the requests are stored. A missing or unreadable document loads the sample requests. To start over, use the reset button or delete the `ferien-antraege-v1` key and reload.

## Rules

- Start and end are required, and the end cannot be before the start.
- Only Monday–Friday counts. The form and each request show that working-day total. A range with no working day is rejected.
- A request can cover at most 366 calendar days.
- A new request cannot overlap one of your pending or approved requests. A rejected request does not block the dates.
- The note and the manager’s comment are optional and limited to 280 characters.
- Public holidays are ordinary working days. There are no half days, and a submitted request cannot be edited or withdrawn.

## Limitations

- One shared browser profile. A teammate on another computer will not see your requests.
- The person switcher is a demo stand-in for sign-in. Anyone using the browser can act as the manager.
- Sample requests are only the starting point. After the first save, the stored document is the source of truth.
