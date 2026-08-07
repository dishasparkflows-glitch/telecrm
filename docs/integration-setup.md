# SparkCRM Integration and Deployment Setup

This guide configures the lead capture, WhatsApp, calling, mobile, notification, payment, storage, and Chrome extension features implemented in SparkCRM.

Never commit real credentials. Use separate credentials for development, staging, and production.

## 1. Core infrastructure

Required services:

- Node.js 20 or newer
- MongoDB 7
- Redis 7
- Public HTTPS API domain
- Public HTTPS dashboard domain

Install dependencies and run local infrastructure:

```sh
npm install
docker compose up -d mongo redis
```

Required core environment values:

```env
NODE_ENV=production
FRONTEND_URL=https://crm.example.com
API_PUBLIC_URL=https://api.example.com
REDIS_URL=redis://redis:6379

JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
INTERNAL_SERVICE_SECRET=replace-with-at-least-32-random-characters
CREDENTIAL_ENCRYPTION_KEY=replace-with-at-least-32-random-characters
```

Use the existing project MongoDB variables for each service database. All containers must resolve the internal service URLs configured by `@sparkcrm/shared-config`.

Generate secrets with a cryptographically secure password generator. Changing `CREDENTIAL_ENCRYPTION_KEY` after credentials have been saved requires a credential migration or reconnecting integrations.

## 2. Meta Facebook and Instagram Lead Ads

### Create the Meta app

1. Open Meta for Developers.
2. Create a Business app.
3. Add Facebook Login for Business and Webhooks.
4. Add the Lead Ads integration/product if shown in the current Meta console.
5. Configure the OAuth redirect URI exactly as:

```text
https://api.example.com/api/leads/oauth/meta/callback
```

6. Configure the webhook callback URL exactly as:

```text
https://api.example.com/api/leads/webhooks/meta
```

7. Subscribe the app webhook to the Page object and `leadgen` field.
8. Request/approve these permissions for production use:
   - `leads_retrieval`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_metadata`
9. Add the production privacy-policy URL, terms URL, data-deletion URL, app icon, and business verification required by Meta.

Environment configuration:

```env
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_LEAD_ADS_VERIFY_TOKEN=generate-a-long-random-webhook-token
META_GRAPH_VERSION=v21.0
API_PUBLIC_URL=https://api.example.com
FRONTEND_URL=https://crm.example.com
```

### Connect a tenant

1. Sign in as the tenant administrator.
2. Open `Settings → Lead Sources`.
3. Confirm App ID, App Secret, and Verify Token show as configured.
4. Select `Connect with Meta`.
5. Complete Meta authorization.
6. Test the saved connection.
7. Select a discovered Page.
8. Select a discovered Lead Form.
9. Select Facebook or Instagram as the source.
10. Choose a fixed assignee or `Use assignment policy`.
11. Select `Subscribe Page`.
12. Save the mapping.
13. Submit a test lead through Meta's Lead Ads Testing Tool.
14. Verify the event moves from `received` to `processed` and the lead appears in SparkCRM.

If an event arrives before its mapping exists, saving the matching Page/Form mapping automatically requeues it.

## 3. WhatsApp Cloud API

In Meta Business Manager:

1. Create or select a WhatsApp Business Account.
2. Add and verify the sending phone number.
3. Create a permanent/system-user access token with WhatsApp permissions.
4. Configure the WhatsApp webhook callback through the API gateway:

   ```text
   https://api.example.com/webhooks/whatsapp
   ```

5. Set the Meta challenge verify token.
6. Configure the Meta app secret either globally as `WABA_APP_SECRET` or in each tenant's WhatsApp configuration. The app secret is required to verify `X-Hub-Signature-256` over the exact POST body.
7. Create message templates and wait for Meta approval.

Configure the tenant under `Settings → WhatsApp Setup` with:

- WhatsApp mode (`meta_shared`, `meta_per_agent`, or `qr`)
- Access token
- WhatsApp Business Account ID
- Phone Number ID or per-agent phone pool
- Webhook verify token where requested by the current UI
- Meta app secret when a global `WABA_APP_SECRET` is not configured

For automatic Meta-lead welcome messages:

1. Create and approve a WhatsApp template.
2. Sync templates in SparkCRM.
3. Open `Settings → Lead Sources`.
4. Edit/create the Meta Page/Form mapping.
5. Enable `Send approved WhatsApp welcome template`.
6. Select the approved template.
7. Keep explicit consent enabled unless legal counsel confirms another lawful basis.
8. Set the Meta form consent field, normally `whatsapp_opt_in`.
9. Ensure the Meta Instant Form includes that consent question and sends an affirmative value.

Welcome messages are idempotent and are sent only for newly created leads.

## 4. Website, Google Ads middleware, and custom lead API

1. Open `Settings → Lead Sources`.
2. Create a Website API, Google Ads Middleware, or Custom API connection.
3. Save the one-time API key immediately.
4. Store it in the sending service's secret manager.
5. Send leads to the displayed endpoint.

Example request:

```http
POST /api/leads/webhooks/inbound/CONNECTION_OBJECT_ID
Authorization: Bearer sparkcrm_KEY
Content-Type: application/json
```

```json
{
  "externalId": "source-lead-123",
  "lead": {
    "firstName": "Asha",
    "lastName": "Patel",
    "email": "asha@example.com",
    "phone": "+919876543210",
    "company": "Example Company",
    "designation": "Director",
    "expectedValue": 50000,
    "priority": "high",
    "tags": ["website", "demo-request"],
    "customFields": {
      "preferred_product": "Enterprise"
    }
  }
}
```

Always send a stable `externalId` so retries remain idempotent. Rotate a key immediately if it is exposed.

Marketplace connectors such as IndiaMart, JustDial, Sulekha, 99acres, MagicBricks, and Housing can transform their webhook/email/API payload into this contract while assigning the corresponding supported SparkCRM source.

## 5. Redis and durable processing

Redis is required for inter-service events such as lead assignment notifications, WhatsApp welcome requests, call activity, and follow-up scheduling.

The Meta inbound webhook itself is persisted in MongoDB before returning HTTP 200 and is processed by a database-backed worker. WhatsApp outbound messages, reminders, and event retries also persist queue state in MongoDB.

Monitor:

- Redis connectivity
- `InboundLeadEvent` failed/unmapped status
- WhatsApp messages in queued/failed status
- Reminder failed status
- Meta connection health

## 6. Firebase Cloud Messaging

Create a Firebase project and enable Cloud Messaging. Create a service account with permission to send FCM messages.

Environment configuration:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Mobile clients register a token with:

```http
POST /api/notifications/devices
Authorization: Bearer USER_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "deviceId": "stable-installation-uuid",
  "token": "fcm-registration-token",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

Test delivery:

```http
POST /api/notifications/devices/test
Authorization: Bearer USER_ACCESS_TOKEN
```

Unregister on logout:

```http
DELETE /api/notifications/devices/stable-installation-uuid
Authorization: Bearer USER_ACCESS_TOKEN
```

## 7. Mobile app, call-log, and recording integration

The native client is in [`clients/mobile-app`](../clients/mobile-app). It is intentionally outside the root npm workspace and has its own lockfile. Configure and validate it from the repository root with:

```sh
cp clients/mobile-app/.env.example clients/mobile-app/.env
npm install --prefix clients/mobile-app
npm run typecheck --prefix clients/mobile-app
npm run lint --prefix clients/mobile-app
npm run android --prefix clients/mobile-app
```

Set `EXPO_PUBLIC_API_URL` in the mobile `.env` to an API gateway URL reachable from the device. Expo Go is not supported because Android call-log access uses the local `spark-call-log` Expo module. Install JDK 17 and set `JAVA_HOME` before local Android builds. Configure the EAS project ID and Firebase/FCM credentials before release builds.

Android call-log access requires explicit `READ_CALL_LOG` permission and may require a Google Play Permissions Declaration. iOS does not expose system call history to third-party apps. The client does not discover or upload recordings because portable call-log APIs do not provide audio; enable recording only after legal review and implementation against a supported provider or native source.

The backend accepts up to 100 native call records per request:

```http
POST /api/calls/mobile/sync
Authorization: Bearer USER_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "deviceId": "stable-installation-uuid",
  "calls": [
    {
      "deviceCallId": "native-call-id",
      "phone": "+919876543210",
      "type": "outgoing",
      "startedAt": "2026-07-31T10:00:00.000Z",
      "duration": 95,
      "simSlot": 0,
      "simLabel": "Sales SIM",
      "simPhoneNumber": "+919999999999",
      "hasRecording": true
    }
  ]
}
```

Supported call types: `incoming`, `outgoing`, `missed`, `rejected`, and `blocked`.

Upload a recording after obtaining the SparkCRM call ID:

```http
POST /api/calls/CALL_ID/recording
Authorization: Bearer USER_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "contentType": "audio/mpeg",
  "contentBase64": "BASE64_AUDIO_DATA",
  "duration": 95
}
```

The JSON upload limit is 7 MB. Larger recordings should be compressed client-side. Recordings are stored under private object keys and played through five-minute signed URLs.

## 8. Cloudflare R2 private storage

Create a private R2 bucket and API token with object read/write permission for that bucket.

```env
CLOUDFLARE_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
CLOUDFLARE_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_ACCESS_KEY=your-r2-secret-access-key
CLOUDFLARE_BUCKET_NAME=sparkcrm-private
CLOUDFLARE_URL=https://optional-public-assets-domain.example.com
```

Do not make the call-recording or private-invoice prefixes publicly readable. Signed URLs are generated server-side.

## 9. Calling providers

For Exotel or Twilio, configure the variables consumed by `callingApi.service.js`. Provider callbacks must use the public API gateway rather than a direct call-service port.

Exotel callback URL:

```text
https://api.example.com/webhooks/exotel
```

Exotel callback verification requires:

- `EXOTEL_WEBHOOK_SECRET` configured only in the call-service runtime environment
- `Content-Type: application/x-www-form-urlencoded`
- `X-Exotel-Signature` containing a hexadecimal HMAC-SHA256 over the exact request-body bytes

The callback fails closed when verification is not configured. Unsigned callbacks, signatures for modified bodies, empty raw bodies, and malformed signatures are rejected before database access.

Additional requirements:

- Tenant virtual/caller ID number
- Agent mobile number on each user profile
- Provider API credentials
- HTTPS callback URL

Use separate test credentials before production calls.

## 10. Payments

Configure payment providers from Owner payment settings rather than hardcoding tenant credentials.

For Razorpay:

1. Generate a new test key pair.
2. Configure webhook signing secret.
3. Register the SparkCRM Razorpay webhook URL.
4. Test domestic cards and UPI/Google Pay QR in test mode.
5. Enable international cards in Razorpay only after account approval.
6. Replace test credentials with live credentials during launch.

For Stripe:

1. Configure publishable/secret keys.
2. Configure the webhook signing secret.
3. Register the SparkCRM Stripe webhook URL.
4. Enable required currencies/payment methods in Stripe.

Previously exposed credentials must be revoked and rotated.

## 11. WhatsApp Web Chrome extension

The unpacked extension is located at:

```text
apps/whatsapp-web-extension
```

Local installation:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select `Load unpacked`.
4. Choose `apps/whatsapp-web-extension`.
5. Open the extension settings.
6. Set API URL, for example `https://api.example.com/api`.
7. Set Dashboard URL, for example `https://crm.example.com`.
8. Approve the requested host permission.
9. Sign in with a tenant user account.
10. Open a WhatsApp Web chat and use Detect/Find Lead.

For Chrome Web Store publication, add production icons, screenshots, privacy disclosures, a support URL, and complete Google's review process. The extension reads only the active chat header for contact detection; it does not scrape conversation messages.

## 12. Follow-up reminders

Open a lead, edit it, and set `Follow-up Reminder`. At the due time SparkCRM creates an in-app alert and sends push notifications to registered devices. Reassigning the lead moves a pending reminder to the new handler. Clearing the date cancels it.

The notification service must remain running, and Redis must be available when the reminder is scheduled.

## 13. Validation and launch checklist

Run:

```sh
node --test apps/*/test/*.test.js
npx nx build web-dashboard
```

Expected baseline:

- 57 service and shared-middleware tests pass
- Dashboard production build succeeds

Configure browser origins explicitly in production. Native clients, webhooks, and server-to-server requests without an `Origin` header remain allowed:

```env
CORS_ALLOWED_ORIGINS=https://crm.example.com,chrome-extension://YOUR_PUBLISHED_EXTENSION_ID
FRONTEND_URL=https://crm.example.com
DASHBOARD_URL=https://crm.example.com
```

Loopback origins are allowed only outside production. Chrome extension origins must be listed explicitly.

Before launch verify:

- All public endpoints use HTTPS
- MongoDB and Redis are not publicly exposed
- CORS is restricted to trusted production domains
- Secrets are in a secret manager
- Database backups and restore drills are configured
- R2 lifecycle/retention policy matches legal requirements
- Meta app is in Live mode with approved permissions
- WhatsApp templates are approved
- Firebase test push succeeds
- Calling webhook authentication succeeds
- Payment webhooks pass signature verification
- Meta test lead reaches the correct tenant
- Duplicate Meta and API events do not create duplicate leads
- Welcome messages require the configured consent
- Owner and tenant role/branch access are verified
- Logging and alerts cover failed workers, webhooks, and integrations

## 14. Known operational notes

- Meta long-lived user tokens generally require reconnecting the account before expiry; SparkCRM marks them `expiring` seven days in advance.
- The dashboard bundle currently emits a large-chunk warning. Production builds pass, but route-level code splitting is recommended as a later performance optimization.
- `npm audit` currently reports transitive dependency vulnerabilities. Review and upgrade them in a dedicated compatibility-tested dependency update rather than using `npm audit fix --force` in production.
