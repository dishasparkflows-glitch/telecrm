# Smart Form write and access security

Protected Smart Form operations derive tenant and branch scope from gateway-verified identity and permission headers. Client payloads cannot select tenant or branch scope.

## Form definition writes

`POST /api/forms` and `PUT /api/forms/:id` accept only:

- `name`
- `description`
- `fields`
- `settings`
- `styling`
- `isActive`

Unknown fields are rejected with HTTP `400`. System-managed fields such as `tenantId`, `branchId`, `embedCode`, `submissionCount`, `_id`, and timestamps cannot be written by clients.

Nested form fields accept `label`, `name`, `type`, `placeholder`, `required`, `options`, and `order`. Settings and styling objects are also checked against their schema-supported field lists. A configured `settings.assignTo` value must be a valid ObjectId; authoritative tenant and branch membership validation is handled as a separate assignment-integrity concern.

The dashboard uses the schema field `isActive`. Before sending an edited form definition, it serializes only writable nested field properties and does not replay MongoDB subdocument IDs.

## Record scope

List, detail, update, submission-list, and delete operations use the shared fail-closed `forms` scope:

- Non-superadmins are restricted to their verified assigned branch.
- A selected branch header cannot replace a non-superadmin's assigned branch.
- Superadmins remain tenant-scoped and may use their verified selected branch.
- Invalid form IDs return HTTP `400` instead of reaching MongoDB as cast errors.

## Public submissions

`POST /api/forms/:id/submit` remains public for active forms. Before persistence or event publication, the service:

1. Validates the form ID.
2. Rejects non-object request bodies.
3. Rejects keys not declared by the form schema.
4. Enforces required fields and field-type validation.
5. Persists and publishes only the validated submission object.

Invalid public submissions return HTTP `400` and are not stored.
