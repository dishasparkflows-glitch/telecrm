# Meta lead mapping ownership migration

Meta lead webhook payloads identify a Page and Form but do not contain a SparkCRM tenant ID. A Page/Form can therefore have only one active SparkCRM mapping across all tenants.

The lead service enforces this with the partial unique index `unique_active_meta_page_form`.

## Deployment order

Run the audit and index migration before deploying the updated lead service. Otherwise automatic index creation may fail when legacy duplicate mappings exist.

Provide `MONGO_URI_LEADS` only through the invoking process or deployment secret manager.

### 1. Audit only

```sh
npm run migrate:meta-mapping-index
```

The default command is read-only. If duplicate active ownership exists, it prints only the affected mapping, tenant, and connection IDs and exits with an error.

### 2. Resolve conflicts

For every reported group, determine the legitimate tenant owner from Meta Business Manager and application records. Deactivate or correct all other mappings through an approved administrative process.

Do not automatically select the newest or oldest mapping. Doing so could route lead personal data to the wrong tenant.

Repeat the audit until no conflicts remain.

### 3. Create the constraint

Set `ALLOW_OPS_MUTATIONS=true` for the migration process and run:

```sh
npm run migrate:meta-mapping-index -- --apply --confirm=CREATE_META_MAPPING_UNIQUE_INDEX
```

The command checks for conflicts again immediately before creating the index. Concurrent mapping writes should be paused during the final migration window.

## Runtime behavior

- New conflicting active mappings return HTTP `409`.
- Database races are rejected by the unique index.
- Unassigned webhook events resolve only when exactly one active mapping exists.
- Events already assigned to a tenant and mapping remain pinned to that scope during retries.
- Ambiguous or partially scoped legacy events are marked failed rather than routed to an arbitrary tenant.
