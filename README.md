# Leave Tracker

React frontend for the Leave Tracker. Employees see balances, upcoming and past leaves and holidays, and their requests. Admins approve or reject requests, manage people, and keep the holiday list. The API lives in [leave-tracker-backend](https://github.com/Mohan-Kumar-Dalei/leave-tracker-backend).

## Run it locally

Start the backend first, then:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` to `http://localhost:5000`.

```bash
npm run build
```

The build goes to `dist/`. In production nginx serves it and forwards `/api` to the backend, so no API address is built into the app and sessions stay in httpOnly cookies on one origin.

## Design

Simple and light, close to the leave tools people already know:

- Soft grey page `#F5F6F8`, white cards, ink `#12141A`, one blue accent `#2F5BEA` for actions.
- Geist for all text, self hosted, with tabular figures for numbers.
- Left sidebar on desktop, bottom tabs on phones, soft status pills for leave states.

Colours are tokens at the top of `src/index.css`. Change them there and the whole app follows.

## Layout of the code

| Path | What is there |
| --- | --- |
| `src/pages/employee` | Summary and request history |
| `src/pages/TeamCalendar.jsx` | Who is away, for employees and admins |
| `src/pages/admin` | Overview, requests, people, setup |
| `src/pages/auth` | Sign in, forgot and reset password |
| `src/components` | Shell, apply form, review list, calendar, tabs, status badge, shared UI |
| `src/lib` | API client, auth, dates, toasts |
| `src/hooks/useLiveUpdates.js` | Live dashboard updates over server-sent events |
