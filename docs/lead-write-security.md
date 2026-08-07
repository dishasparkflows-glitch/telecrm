# Lead write and access security

Authenticated lead requests use only gateway-verified identity, tenant, branch, and permission headers. Client payloads cannot select a tenant, branch, creator, assignee, or system-managed lead state.

## Writable fields

`POST /api/leads` and rows submitted to `POST /api/leads/import` accept:

- Contact fields: `firstName`, `lastName`, `email`, `phone`, `alternatePhone`, `company`, `designation`
- Pipeline fields: `stage`, `priority`, `expectedValue`, `currency`
- Create-time provenance: `source`, `sourceDetails`
- Activity planning: `lastContactedAt`, `followUpAt`
- User data: `tags`, `customFields`, `address`

`PUT /api/leads/:id` accepts the same user-editable fields except `source` and `sourceDetails`, which are immutable after creation.

Unknown top-level fields are rejected with HTTP `400`. `address` accepts only `city`, `state`, `country`, and `pincode`. Assignment must use `PUT /api/leads/:id/assign`; notes must use `POST /api/leads/:id/notes`; archival must use `DELETE /api/leads/:id`.

Protected fields include tenant and branch IDs, assignment metadata, creator identity, scoring data, source identities and attribution, notes, activity timestamps, archive/conversion state, and database timestamps.

## Record authorization

List, detail, update, note, assignment, timeline, and archive operations enforce the verified `leads` visibility permission:

- Global visibility can access records within the verified branch scope.
- Own-only visibility can access only records assigned to the authenticated user.
- Superadmins remain tenant-scoped and may use the gateway-verified selected branch.
- A list query cannot replace an own-only assignment filter with another user ID.

Manual creation and CSV import derive branch scope from verified headers and initially assign records to the authenticated user. Body-provided `branchId` and `assignedTo` values are rejected.

Import errors identify the one-based row number and error message without returning the source row or its personally identifiable information.
