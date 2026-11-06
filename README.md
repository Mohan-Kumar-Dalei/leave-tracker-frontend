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

Built with the ApexUI skill. The direction is a paper leave register:

- Palette: paper `#F4F1EA`, surface `#FBF9F4`, ink `#1C2321`, one accent in register green `#1F5C4D`.
- Type: Fraunces for headings and numbers, Hanken Grotesk for everything else, both self hosted.
- Layout: ruled rows and hairlines, radius 4px, no gradients.
- Signature moment: a rubber stamp lands on a request when an admin decides it (`src/components/Stamp.jsx`).
- ApexUI components: Animated Tabs, Toast Stack and Rolling Counter, restyled in `src/ApexUI-Kit`.

Colours and fonts are tokens at the top of `src/index.css`. Change them there and the whole app follows.

## Layout of the code

| Path | What is there |
| --- | --- |
| `src/pages/employee` | Summary and request history |
| `src/pages/admin` | Overview, requests, team calendar, people, setup |
| `src/pages/auth` | Sign in, forgot and reset password |
| `src/components` | Shell, apply form, review list, calendar, stamp, shared UI |
| `src/lib` | API client, auth, dates, toasts |
| `src/hooks/useLiveUpdates.js` | Live dashboard updates over server-sent events |
