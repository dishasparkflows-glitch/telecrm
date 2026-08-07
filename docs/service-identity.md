# Internal service identity

SparkCRM backend services accept protected HTTP requests only when they carry a short-lived, request-bound service identity signed with `INTERNAL_SERVICE_SECRET`.

## Required configuration

- Configure the same high-entropy `INTERNAL_SERVICE_SECRET` for the API gateway and every backend service.
- The value must contain at least 32 characters in production.
- Store it in the deployment secret manager; do not commit it to an environment example or source file.
- Deploy signers and receivers together. A missing or mismatched value causes protected and internal requests to return `401`.

The signature binds the context to:

- issuer
- destination audience
- HTTP method
- exact path and query string
- issue and expiry timestamps
- one-time nonce
- verified user/tenant identity, when applicable

Protected `/api` routes accept only identities issued as `api-gateway`. Internal routes accept signed service identities without trusting caller-supplied `X-User-*` headers.

## Public routes

Public authentication, public forms, public meeting booking, payment-provider callbacks, Meta lead callbacks, WhatsApp callbacks, and Exotel callbacks do not require internal service identity. They retain their own validation or provider-signature requirements.

Provider callbacks should target the API gateway, including:

- `/webhooks/whatsapp`
- `/webhooks/exotel`
- `/webhooks/razorpay`
- `/api/billing/webhooks/stripe`
- `/api/billing/webhooks/razorpay`

Authenticated WhatsApp realtime traffic uses `/socket.io` through the gateway. When the dashboard is hosted on a different origin, configure `VITE_WS_URL` with the externally reachable gateway origin.

## Network boundary

The production Compose topology publishes only API gateway port `8000`. MongoDB, Redis, and domain-service ports are available only on the Compose network. Container-to-container requests use Compose service DNS names.

Service identity is defense in depth and does not replace private networking, provider webhook verification, user authorization, or record-level tenant scoping.
