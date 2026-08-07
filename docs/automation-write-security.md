# Automation write and log security

Automation rules use gateway-verified tenant, branch, user, and permission context. Client payloads cannot select identity, scope, ownership, execution counters, active state, or timestamps.

## Rule writes

`POST /api/automations` and `PUT /api/automations/:id` accept only:

- `name`
- `description`
- `trigger`
- `actions`

Triggers accept `event` and `conditions`. Each condition accepts `field`, `operator`, and `value`. Each action accepts `type`, `config`, and `delay`. Unknown top-level and nested fields are rejected with HTTP `400`.

Rule activation is changed only through the dedicated toggle endpoint. Execution counters and timestamps remain worker-managed. Formatted rule IDs are validated before database access.

The dashboard serializes writable condition and action properties rather than replaying MongoDB subdocument IDs. Editing a rule preserves its existing conditions and actions.

## Visibility

Rule list and mutation access use `createdBy` as the ownership field:

- Global visibility remains tenant- and branch-scoped.
- Own-only visibility is additionally restricted to rules created by the authenticated user.
- Non-superadmin selected-branch headers cannot replace the assigned branch.

Execution logs do not contain an ownership field. For own-only requests, the service first resolves rule IDs within the caller's authorized rule scope and restricts logs to those IDs. A requested `ruleId` must also exist within that authorized scope.

List and log pagination is bounded to 100 records per page.
