---
inclusion: fileMatch
fileMatchPattern: "frontend/**/*"
---
# UI standards

Use React function components with typed props and focused responsibilities. Build with Material UI and centralized theme tokens for spacing, typography, color and component variants. Keep feature components and hooks together; extract shared components when multiple real consumers need them. Avoid `any`, duplicated API types and unnecessary global state.

## Icons, logos and visual references

- Strictly prohibit AI-generated icons and logos, including image-generator output and ad hoc AI-drawn SVG, canvas or CSS icon artwork. Do not use emoji as substitutes for interface icons.
- Use `@mui/icons-material` for interface icons and Material UI components for controls, styling and layout. Keep icon size, stroke/weight, color and spacing consistent with the theme. Give icon-only controls accessible labels.
- Refer to LibreChat's UI components and visual patterns for chat layout, navigation, message actions and spacing. Adapt those ideas to our React and Material UI architecture; do not introduce its component stack or backend dependencies merely to reproduce its appearance.
- Use an existing approved brand asset for the app logo. If none is available, use a styled text wordmark with theme typography until the user supplies or approves a logo. Do not copy LibreChat's logo or imply affiliation.
- Before reusing actual LibreChat source code or assets, check the applicable license and preserve required notices and attribution. Clearly distinguish visual inspiration from code reuse.

Use TanStack Query for fetched data, caching and mutation invalidation. Use local state for local interactions and Zustand only for shared UI state. Centralize API access and error handling; derive URLs from configuration or the same-origin `/api` path. Never embed provider credentials or rely on frontend checks for authorization.

Create a professional responsive chat layout: history/sidebar, conversation content, composer and clear account controls. Support narrow screens, keyboard navigation, visible focus, accessible labels and readable contrast. Show deliberate loading, empty, error, retry and disabled states. Do not present nonfunctional controls as working features.

Streaming should update incrementally, support stop/cancel, preserve scroll position when the user reads older messages and avoid duplicate messages on retries. Distinguish sending, streaming, complete and failed states. Prevent accidental duplicate submissions while allowing multiline input through an explicit keyboard convention.

Render rich text with safe libraries and sanitization; never insert untrusted HTML directly. Handle code blocks, tables, lists and images without breaking mobile layouts. Label action menus and provide feedback for copy/export actions. Do not log or persist tokens and private conversations casually in browser storage.

Verify the production build and inspect the UI at desktop and mobile widths for material visual changes. Test important user interactions when adding authentication, streaming or history behavior. Keep screenshots and demo instructions aligned with actual implemented features.
