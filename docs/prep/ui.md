# UI and Frontend — Interview Q&A

## 1. Why React with TypeScript and Material UI?

**Answer:** React supports reusable component boundaries and state-driven rendering; TypeScript helps catch incompatible props and API shapes during development; Material UI provides a consistent component system and theme primitives. These tools improve consistency but do not replace accessibility testing, runtime validation or careful state management.

## 2. How should chat state be modeled?

**Answer:** Keep conversations/messages separate from transient UI state such as selected model, pending submission, stream status and open menus. Use stable IDs and explicit lifecycle states rather than inferring state from whether text is present. Avoid duplicating server-owned facts like quota balance as authoritative local state.

## 3. How do you render streaming text smoothly?

**Answer:** Read the stream incrementally, parse complete SSE frames rather than assuming each network chunk is a full event, append deltas to the active message, and handle terminal events and aborts. Batch state updates when necessary to avoid excessive renders. Ensure a late chunk from an old generation cannot update the currently selected conversation.

## 4. How do you avoid XSS in Markdown and code rendering?

**Answer:** Treat model output as untrusted. Use maintained Markdown/rendering components with raw HTML disabled unless there is a carefully sanitized need, escape code content, sanitize any permitted HTML, validate link protocols and avoid injecting untrusted strings through unsafe HTML APIs. Test malicious markup explicitly.

## 5. How should loading and error states work?

**Answer:** Represent loading, streaming, completed, stopped and failed states explicitly. Give the user actionable feedback, preserve partial output when appropriate, make retry behavior clear and disable only controls that cannot safely run concurrently. Avoid silently treating a disconnected stream as success.

## 6. What is the role of frontend route guards?

**Answer:** They improve navigation and user experience, but they are not security. API routes must independently authenticate and authorize all operations, because a user can call the API without the UI.

## 7. How would you improve accessibility?

**Answer:** Keyboard-accessible controls, visible focus, semantic headings and labels, contrast-compliant themes, accessible status announcements for streaming, reduced-motion support and correct dialog focus management. Test with keyboard navigation and automated accessibility checks rather than assuming component defaults are sufficient.

## 8. How do you manage frontend API errors?

**Answer:** Normalize errors in the API client, distinguish validation/auth/permission/rate-limit/network/provider failures, and show safe messages. Refresh session state only through the documented auth flow; avoid retrying non-idempotent submissions blindly.

## 9. How do you test the UI?

**Answer:** Unit-test pure helpers and component behavior, test async states and accessibility-sensitive interactions, and use Playwright for high-value end-to-end journeys such as sign-in, chat, stream handling and history. Use deterministic provider fixtures for repeatability, and label them clearly as fixtures.

## 10. How would you improve performance?

**Answer:** Profile first. Consider list virtualization for large history, memoization for expensive pure rendering, debounced search, stable keys, bounded message rendering and incremental Markdown processing. Avoid premature memoization and verify that optimization does not break streaming correctness.
