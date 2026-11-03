# OUT

A small proof of concept for one job: show who on the team is off.

OUT is a month calendar. Time off sits on the days it covers as a solid colour bar, one colour per person. A panel lists who is off today, and you can log or remove a stretch of time off. Nothing leaves the browser.

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

## How it works

There is no account and no server. The board is a single JSON document in `localStorage` under the key `out-board-v1`.

```ts
type Person = {
  id: string;
  name: string;
  color: string;
  ink: string;
  allowance: number; // holiday days
};
type TimeOff = {
  id: string;
  personId: string;
  start: string; // YYYY-MM-DD, inclusive
  end: string;   // YYYY-MM-DD, inclusive
  type: "Vacation" | "Sick" | "Other";
  note: string;
  sample: boolean;
};
```

On the first visit the app seeds four people and a handful of entries around the current date. Those rows have `sample: true` and are labelled **Sample** in the today panel and the list. Adding a name that is not already on the team creates a person and assigns the next colour. Matching an existing name (ignoring case) reuses that person and their colour.

Each person has a holiday allowance in days, edited in the team list. A new person starts at 25 days. Boards saved before allowances existed load as before: anyone missing `allowance` is given 25, then the board is saved back to the same `out-board-v1` key.

Only **Vacation** counts against the allowance, and only Monday–Friday. A weekday covered by two vacation entries counts once. **Sick** and **Other** stay on the calendar and do not reduce the allowance. The team list shows days used, days left, and a short progress bar. Logging a vacation that would go over the allowance shows a warning and still saves the entry.

The calendar is a Monday-start month grid. Prev, Next, and Today change which month is on screen. "Who's off today" always uses the real current date, even if you are looking at another month. Click a bar to highlight its row, or use Remove on the row. Edits are written back to `localStorage` immediately. To start over, delete the `out-board-v1` key in devtools and reload.

## Limitations and next steps

- One shared browser profile. A teammate on another computer will not see your entries.
- No editing of a logged stretch, approvals, half days, or public holidays. Remove and add again to change a row. Weekends are not holiday days; bank holidays are not special-cased.
- Removing a stretch of time off leaves the person on the team list, so their colour stays for the next entry.
- Colours are assigned in order and are not chosen by the person.
- Sample data is only a starting point. After the first save, the stored board is the source of truth.

A real version would put the same board behind a shared store, add auth, and let people edit their own entries.
