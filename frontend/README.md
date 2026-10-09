# Frontend boundaries

`app` owns composition, `features` owns auth/chat/history/settings/admin modules, `shared` owns API access and typed contracts, and `theme` owns centralized MUI tokens and appearance preferences. TanStack Query manages server state; transient state stays local. Authentication uses same-origin cookies and in-memory CSRF tokens. Only non-sensitive appearance preferences are persisted in browser storage.

Run `npm run lint`, `npm run format:check`, `npm run test` and `npm run build`. `npm run test:e2e` runs desktop/mobile Chromium against `APP_URL` (default localhost:5173). Chat browser tests require the labelled test-only server described in the root README. Normal application code never generates fixture answers. Never expose provider keys through VITE environment variables.

The authenticated workspace and charts load lazily. Historical rich-content rendering is memoized; provider events incrementally update the message cache. Markdown raw HTML is not enabled; images are restricted to owner-protected files. Chart blocks accept only bounded numeric JSON data. Theme choices support light/dark/system plus standard/high contrast, and initialize the browser canvas before React renders.
