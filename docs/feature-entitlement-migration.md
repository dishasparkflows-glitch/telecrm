# Feature entitlement lifecycle migration

Feature purchases now require a durable invoice before provider checkout, a tenant-scoped idempotency key, a complete feature identity, one open checkout per tenant/feature, one entitlement per paid invoice, and at most one active entitlement per tenant/feature.

## API behavior

`POST /api/features/purchase` requires an `Idempotency-Key` header containing 16-128 characters. Retrying a ready checkout with the same tenant, feature, and key returns the original invoice and Razorpay order. A key cannot be reused for another feature.

The invoice is persisted with `checkoutStatus=creating` before Razorpay is called. Successful order creation changes it to `ready`; provider failure changes it to `failed` and closes the checkout. An uncertain failed checkout is not automatically retried with the same key, preventing duplicate provider orders.

Entitlement creation occurs only from a paid feature invoice containing matching `tenantId`, `featureId`, and `featureSlug`. Payment replay returns the transaction linked to that invoice. A different paid invoice cannot replace an existing active entitlement.

## Pre-deployment audit

Provide `MONGO_URI_BILLING` through the deployment secret manager and run:

```sh
npm run migrate:feature-entitlements
```

This command is read-only by default. It reports:

- multiple active transactions for the same tenant and feature
- one invoice linked to multiple feature transactions
- feature-purchase invoices missing `featureId` or `featureSlug`

Resolve every reported record explicitly. Do not automatically select an entitlement winner; payment history and provider records must determine the correct state.

## Constraint creation

After the audit is clean, pause feature checkout and activation writes. Set `ALLOW_OPS_MUTATIONS=true` for the migration process and run:

```sh
npm run migrate:feature-entitlements -- --apply --confirm=CREATE_FEATURE_ENTITLEMENT_INDEXES
```

The migration rechecks all blockers and creates:

- `unique_active_tenant_feature`
- `unique_feature_entitlement_invoice`
- `unique_tenant_checkout_idempotency`
- `unique_open_feature_checkout`

Run the migration before deploying or restarting the updated billing service. Existing conflicts can prevent automatic Mongoose index creation.

## Recovery

The billing background job retries paid feature invoices whose `entitlementGrantedAt` is still null. Failed retries remain observable in billing logs and are not marked granted until the entitlement write succeeds.

Pending provider checkouts are reconciled after an initial two-minute delay. Unpaid and failed lookups receive exponential polling backoff from one minute up to six hours, persisted in private invoice metadata. This prevents abandoned orders from being queried every 30 seconds while payment webhooks remain able to finalize a later payment. Successful unpaid checks clear the stored reconciliation error; provider failures retain a sanitized message, code, and status for diagnostics without storing credentials or complete provider responses.
