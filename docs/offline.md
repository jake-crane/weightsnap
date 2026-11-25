# Offline mode and slow starts

How WeightSnap behaves when the server is slow to wake up or there's no
connection. WeightSnap is installed on phones as a Home Screen web app (PWA).
It runs on Vercel with a Neon database, and both can take a few seconds to
respond after being idle. Both cases need to feel fast and honest.

The code lives in:

- [`public/sw.js`](../public/sw.js): the service worker (saves the dashboard
  and its build files on the device)
- [`src/components/offline-provider.tsx`](../src/components/offline-provider.tsx):
  connection state, the entry queue's sync, refreshing saved data
- [`src/lib/pending-entries.ts`](../src/lib/pending-entries.ts): the on-device
  queue of entries not yet on the server
- [`src/components/offline-banner.tsx`](../src/components/offline-banner.tsx):
  the offline, "Syncing…" and "Updating…" banner
- [`src/app/api/entries/route.ts`](../src/app/api/entries/route.ts): where
  queued entries are uploaded
- [`src/app/api/health/route.ts`](../src/app/api/health/route.ts): lets the
  app check it can reach the server
- [`src/components/service-worker-registrar.tsx`](../src/components/service-worker-registrar.tsx):
  registers the service worker (or removes it in development)

## Requirements

### Opening the app

1. The dashboard opens straight into your data. Once you've opened it signed
   in on a device, launching the app shows the copy saved last time right
   away. It doesn't wait for the server.
2. If the data on screen is more than 30 seconds old, fresh data is fetched
   immediately and replaces it in place, without reloading the page. Until
   it arrives, the banner says "Showing data from (time). Updating…".
3. Everything on the page works while it's updating: logging a weight, the
   chart and the list.
4. The first launch on a device, before anything is saved, has to wait for
   the server.
5. If the server says you're signed out (it redirects away from the
   dashboard), the saved copy is deleted and you land on the sign-in page.

### Being offline

6. The app is "offline" when the server can't be reached, not just when the
   phone reports no network. Wi-Fi with no internet, or the server being
   down, count too.
7. Offline, the dashboard shows the saved copy with a banner: "You're
   offline. Showing data from (time). New entries are saved on this device
   and sync when you reconnect."
8. If nothing is saved yet, the app shows a plain "You're offline" page with
   a Try again button.
9. While offline, the app checks whether the server is back every 15
   seconds, and also when the phone reports it's back online or the app
   returns to the foreground. When it's back, the banner goes away and
   saved data is refreshed (see 2).

### Logging weights

10. Logging a weight always works, online or offline. Every new entry is
    saved on the device first, then uploaded. Online, that happens right
    away.
11. Entries not yet on the server show "Not synced" in the list and a hollow
    dot on the chart. The banner counts them ("1 entry is waiting to
    sync").
12. Waiting entries are uploaded when the app opens, when the connection
    comes back, when the app returns to the foreground, and every 30 seconds
    while any are waiting. iPhone doesn't allow background sync, so this
    only happens while the app is open.
13. Waiting entries survive the app being closed or the phone restarting.
14. Retrying an upload never creates a duplicate. Each entry gets its ID on
    the device, and the server ignores an ID it already has.
15. If the server rejects an entry, it stays in the list marked "Couldn't
    save this entry" so it can be deleted by hand. It's never dropped
    silently. If the session has ended, it's marked "Sign in again to
    sync".
16. An entry's date is the calendar day picked in the form, the same
    wherever you are.

### Other changes

17. Changing units, editing the goal, deleting entries already on the server
    and signing out need a connection. Offline, those controls are disabled,
    with a tooltip saying why (visible on hover, so on desktop only).
18. Entries still waiting to sync can be deleted offline. That just removes
    them from the device.

### Privacy

19. Signing out deletes the saved copy of the dashboard from the device.
20. Waiting entries are stored per account, so another account signed in on
    the same device never uploads them.
21. Sign-in, sign-out, API calls and Server Actions are never answered from
    the device.

### Updates

22. A new deploy reaches the device the next time the app is opened online.
    The new service worker takes over at once.
23. If the saved copy is from an older deploy, the first refresh notices the
    mismatch and reloads the page once to pick up the new version.
24. An automatic refresh never runs more than once a minute. If one fails,
    Next.js reloads the page, and this limit stops that from turning into a
    reload loop. If the server comes back within that minute, the refresh
    runs as soon as the minute is up.

## How it works

### Service worker (`sw.js`)

| Request | Strategy |
| --- | --- |
| Opening `/dashboard` | Saved copy first if there is one. The network is asked at the same time, and a good response is saved for next time, along with the `/_next/static/` files it uses. A redirect (signed out) deletes the saved copy. With nothing saved: network, then the offline page. |
| Opening any other page | Network first. With no answer within 4 s, or no network, it goes to the saved dashboard if there is one, otherwise the offline page. |
| `/_next/static/*` (hashed build files) | Saved copy first. These never change for a given URL. Matched on URL alone, ignoring `Vary`. The newest 300 are kept. |
| Anything else (`/api/*`, Server Actions, RSC requests, other origins) | Not touched. |

The page can also ask the service worker to save a fresh copy of the
dashboard (`cache-page` message). It does this whenever the data on screen
changes, so the saved copy stays current.

`sw.js` is served with `Cache-Control: no-cache` (see `next.config.ts`) so
updates to it reach phones quickly. The service worker only runs in
production builds. In development, the app removes any service worker left
over from running a production build on the same port.

### Connection state and refreshing (`offline-provider.tsx`)

- Online means the browser reports a network and the last request to the
  server got through. With nothing to upload, the sync just calls
  `/api/health`.
- The server renders `renderedAt` into the dashboard. Data older than 30
  seconds is treated as a saved copy. It's refreshed with
  `router.refresh()`: right away on open if the browser reports a network,
  otherwise once a sync shows the server is reachable.
- The once-a-minute limit on automatic refreshes is stored in
  `sessionStorage` (`weightsnap:auto-refresh-at`), so it survives the reload
  Next.js does when a refresh fails. Only refreshes that actually run are
  recorded. Refused attempts don't push the window forward.

### Entry queue (`pending-entries.ts`)

- Stored in `localStorage` under `weightsnap:pending:<user id>`.
- Each entry has a status: `pending`, `synced` or `error`. Synced entries
  stay until the server's list includes them, so they don't flicker out
  between upload and refresh. They're dropped after an hour anyway.
- Uploads go to `POST /api/entries`, a route handler rather than a Server
  Action, so a page opened from an older saved copy can still upload. Server
  Action IDs change between builds.

## Testing

- Offline mode needs a production build: `npm run build`, then
  `AUTH_TRUST_HOST=true npm run start`. Without `AUTH_TRUST_HOST`, Auth.js
  rejects sign-ins on `localhost` in production mode. Vercel sets this up
  automatically.
- To mimic a cold start, put a small proxy on port 3000 in front of
  `next start` on another port, and hold every response except
  `/_next/static/` and `/api/auth/` for a few seconds. Set
  `AUTH_URL=http://localhost:3000` on the Next.js server, or Google rejects
  the sign-in callback. Then check:
  - The dashboard shows within a fraction of a second, with "Updating…".
  - Fresh data replaces it when the server answers, without a reload.
  - With the server stopped, the page reloads at most once, then shows the
    offline banner.
- Wait until the saved copy is over 30 seconds old before reopening.
  Otherwise it counts as fresh and nothing refreshes. After a failed
  refresh, wait out the one-minute limit too.
- A real network failure (airplane mode) is best tested on a phone. The
  browser pane in the Claude app can't cut its own connection.
- iOS reads some settings when the app is added to the Home Screen. After
  changing the manifest or the iOS meta tags, remove and re-add the app.
