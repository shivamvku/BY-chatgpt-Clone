# Frontend boundaries

`app` owns composition/providers, `features` owns auth/chat/settings modules, `components` owns shared UI, `hooks` owns reusable hooks, `lib` owns API helpers, and `theme` owns Material UI customization. TanStack Query manages server state. Keep transient state local or in small Zustand stores.

The foundation screen verifies React/Material UI builds and API routing. Chat features are not implemented yet. Never expose provider keys through VITE environment variables.
