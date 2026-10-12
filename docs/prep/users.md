# Users and Administration — Interview Q&A

## 1. What user roles exist?

**Answer:** The repository documents a controlled admin role and ordinary user access. Use the exact role names and permission matrix in current models/schemas and frontend conditionals; do not assume UI labels are identical to stored role values. The server remains the source of authorization truth.

## 2. How should user administration be protected?

**Answer:** Require a validated admin session, enforce authorization in the API/service layer, validate the target account and requested changes, and record security-sensitive operations. Add tests for ordinary users attempting admin routes and admins acting on invalid or protected accounts.

## 3. How should invitations work?

**Answer:** Model invitation lifecycle explicitly—created, pending, accepted, expired or revoked—and bind tokens to a specific intended action/account with expiry and single-use semantics. Validate inviter permissions, avoid leaking invitation tokens in logs and ensure acceptance cannot grant a role beyond the invitation's authorized scope.

## 4. How are plans different from payments?

**Answer:** Plans/entitlements are application policy used to gate models, limits or usage. The documented app supports internal plan assignment/administration, but payment collection, payment-provider webhooks and invoice generation are not implemented. Never claim the app processes subscriptions or charges users unless that scope is added and verified.

## 5. What should audit records contain?

**Answer:** Actor, action, target, timestamp, outcome and safe contextual metadata sufficient for investigations. Avoid storing passwords, raw session tokens, provider keys or full sensitive prompts. Define retention/access policy and make audit events hard for ordinary users to alter.

## 6. How should account deletion work?

**Answer:** Clarify whether deletion is soft or hard, what happens to conversations and audit records, and any retention obligations. Execute the operation transactionally where possible, prevent orphaned data, revoke sessions and ensure exports/backups follow the documented retention policy. Confirm the actual current product behavior before promising deletion semantics.

## 7. How do you prevent users from accessing each other's chats?

**Answer:** Scope every query and mutation to the authenticated user, and verify ownership for conversation, message, generation and export endpoints. Test cross-user reads and writes with two separate identities. Unpredictable IDs are defense-in-depth, not authorization.

## 8. How should usage be displayed?

**Answer:** Present the server-calculated plan/usage state with clear reset period and units. Avoid treating a client-side counter as authoritative. Explain that actual provider token metadata may be delayed or unavailable, and ensure the API exposes the intended quota semantics consistently.

## 9. How do you handle sessions across multiple devices?

**Answer:** Store session records server-side with expiry and revocation state. Let users inspect/revoke sessions if supported; logout should revoke the current session, while password/security changes may revoke more sessions according to policy. Test that revoked sessions stop working immediately.

## 10. What is the difference between an admin and a system operator?

**Answer:** An application admin manages allowed product resources and users; a cloud/operator identity deploys and maintains infrastructure. These privileges should be separate. Application admin access should not imply access to Azure, database credentials or provider secrets.
