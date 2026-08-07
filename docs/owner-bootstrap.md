# Initial owner bootstrap

The auth service does not create an owner account during normal startup. Provision the first owner explicitly after configuring the authentication database.

## Required runtime values

Provide these values only to the bootstrap process; do not commit them or store them in shared environment examples:

- `OWNER_BOOTSTRAP_EMAIL`
- `OWNER_BOOTSTRAP_PASSWORD` — at least 12 characters
- `OWNER_BOOTSTRAP_NAME`
- `MONGO_URI_AUTH`

Run:

```sh
npm run owner:bootstrap -- --apply --confirm=CREATE_INITIAL_OWNER
```

The command refuses to create an account when any owner already exists. Remove the bootstrap values from the process environment after completion.

## Credential exposure response

Removing credentials from the current working tree does not invalidate values exposed through repository history. Before considering the incident closed:

1. Rotate the exposed database, payment-provider, and owner credentials.
2. Review provider and application access logs for unauthorized use.
3. Preserve any evidence required by the incident-response process.
4. Purge exposed values from Git history after rotation.
5. Invalidate old clones, deployment artifacts, and CI caches where feasible.
6. Run secret scanning in CI and against the rewritten history.
