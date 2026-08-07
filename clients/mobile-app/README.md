# SparkCRM Mobile

Production-oriented Expo **development-build** client for SparkCRM. This directory is intentionally outside the repository's root npm workspaces (`apps/*`, `libs/*`) and has its own dependencies and lockfile.

> Expo Go is not supported. Native Android call-log access requires the included custom Expo module and a development or release build.

## Capabilities

- Secure access/refresh-token storage in Keychain/Android Keystore via `expo-secure-store`
- Login, serialized refresh, Bearer authentication, and one retry after a 401
- Dashboard, paginated/searchable leads, lead details, stages, notes, follow-ups, and assignment
- `tel:` click-to-call, optionally provider-backed through `/api/calls/initiate`; provider failures fall back to the dialer
- WhatsApp deep links, notifications/read state, native FCM/APNs device-token registration, and call history
- Android call-log sync in batches of 100 with stable `<deviceId>:<nativeCallId>` IDs and a persisted timestamp cursor
- Manual, foreground, and best-effort OS background sync

## Prerequisites

- Node.js 20+
- Android Studio/JDK 17 for Android development builds
- macOS/Xcode for iOS builds, or EAS Build
- A running SparkCRM API gateway reachable from the device
- A physical device for push-token registration and meaningful call-log testing

## Setup

```sh
cd clients/mobile-app
cp .env.example .env
npm install
```

Set `EXPO_PUBLIC_API_URL` to the gateway URL. Android Emulator uses `http://10.0.2.2:8000` for a host service; a physical device needs a LAN or HTTPS URL. `EXPO_PUBLIC_*` values are bundled into the app and must never contain secrets.

Replace `YOUR_EAS_PROJECT_ID` in `app.json` before EAS builds. For native push delivery, configure the normal Expo/FCM/APNs credentials (including `google-services.json` for Android when required by your build setup); do not commit service-account secrets.

## Development build

Local Android build:

```sh
npm run android
npm start
```

EAS development build:

```sh
npx eas-cli build --profile development --platform android
npm start
```

For iOS use `npm run ios` on macOS or EAS. The iOS app supports CRM/provider call history and push registration, but **does not request or read system call history** because Apple provides no public API for it.

After changing native dependencies, permissions, or `modules/spark-call-log`, rebuild the development client. Generated `android/` and `ios/` directories are ignored; use `npx expo prebuild --clean` only when you intentionally want to regenerate them.

## Android call-log behavior

The local Expo module reads Android's `CallLog.Calls` only after an explicit user permission prompt. It maps incoming, outgoing, missed, rejected, and blocked calls, including the phone account label when Android exposes one. SIM slot/phone number are sent only when a device/API can provide them; the client does not invent metadata.

The sync endpoint is `/api/calls/mobile/sync`. A cursor advances after each fully accepted batch, so failed records are retried rather than silently skipped. Backend idempotency and stable device call IDs make retries safe. Android background fetch is best effort: OEM power controls and OS scheduling may delay or prevent it, so foreground and manual sync remain available.

Google Play heavily restricts `READ_CALL_LOG`. A production Play release must qualify for an allowed core-functionality use case, complete the Permissions Declaration, show an appropriate disclosure, and satisfy local privacy/telecom laws. Otherwise distribute through a compliant enterprise channel or remove call-log permission/sync from that flavor.

## Recording policy

This app does **not** discover, record, or upload call audio. Android call-log APIs do not provide recordings, iOS does not expose call history, OEM paths are not portable, and recording legality varies by jurisdiction. The backend recording API is intentionally not called. Add recording support only with legal review, explicit consent, a documented native/provider source, and supported API metadata.

## Assignment compatibility

The current gateway exposes users at `GET /api/users`; the app uses that route. If the deployment returns 403, 404, or otherwise does not expose assignable users, assignment controls show an unavailable state while all other lead actions continue to work.

## Validation

```sh
npm run typecheck
npx expo config --type public
npm run lint
```

Run installs and commands from this directory. Do not run a root install for this client; that would unnecessarily involve the monorepo lockfile.

## Release notes

- Keep API traffic on HTTPS outside local development.
- Configure push credentials separately for each environment.
- Review Android call-log permission eligibility before store submission.
- Background fetch is opportunistic, not guaranteed real-time sync.
- Rotate/revoke refresh tokens server-side when strengthening logout semantics; the client always deletes local credentials on logout.
