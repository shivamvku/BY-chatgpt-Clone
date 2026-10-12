# Authentication and Security — Interview Q&A

## 1. Authentication versus authorization?

**Answer:** Authentication establishes the identity/session. Authorization decides whether that identity can perform an action. Ownership checks decide whether a user can access a particular conversation or generation. Each is required; knowing a resource ID is not permission.

## 2. Why use an HttpOnly session cookie?

**Answer:** HttpOnly prevents ordinary JavaScript from reading the session cookie, reducing token theft through some XSS scenarios. Secure and SameSite settings should be appropriate for the deployment. HttpOnly does not prevent all XSS or CSRF and must be paired with other controls.

## 3. Why is CSRF protection required?

**Answer:** Browsers attach cookies automatically. A malicious site may try to induce authenticated requests. The documented application checks the allowed Origin and a session-bound `X-CSRF-Token` on mutations. CORS alone is not a general CSRF defense.

## 4. Why hash session tokens at rest?

**Answer:** If the session table is exposed, a hash prevents straightforward reuse of the raw bearer token. The server validates a presented token against stored hash material. Expiry, revocation and secure randomness remain important.

## 5. How should password recovery work securely?

**Answer:** Use cryptographically random, short-lived, single-use tokens stored in a non-reversible form where feasible; rate-limit requests; avoid account enumeration; invalidate tokens after use; and revoke sessions according to policy. Email delivery and complete end-to-end configuration must be independently verified.

## 6. How do you prevent privilege escalation?

**Answer:** Derive identity from the validated server session, never from a user ID/role supplied by the browser. Enforce admin permissions in the API/service layer, validate target accounts and audit sensitive changes. Add tests that ordinary users cannot change their own role or manage another account.

## 7. How do you protect provider secrets?

**Answer:** Keep provider keys on the server, inject them through environment/secret references, use managed identity/Key Vault in the deployed design where configured, restrict access and rotate credentials. Never put keys in frontend environment variables, browser requests, logs or container images.

## 8. What is the threat model for chat content?

**Answer:** User prompts and model output may contain sensitive or malicious content. Protect tenant/user ownership, avoid prompt logging by default, render output safely, validate uploads, limit request size, guard against prompt injection in any future tool integration and prevent secrets from entering provider prompts unintentionally.

## 9. What security tests are important?

**Answer:** Unauthenticated access, expired/revoked sessions, missing/invalid CSRF, disallowed Origin, cross-user conversation/message/generation access, role escalation, oversized uploads, rate-limit enforcement and secret leakage in errors/logs. Test service and API layers, not only button visibility.

## 10. How do you respond to a compromised session?

**Answer:** Revoke the session server-side, invalidate related refresh/session material as appropriate, rotate credentials if compromise extends beyond a session, inspect audit/security logs, and communicate incident scope. Session revocation must be checked by the API rather than relying solely on clearing browser storage.
