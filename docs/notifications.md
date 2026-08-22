# SparkCRM Backend Notifications Architecture

This document describes the notification system within the SparkCRM backend, detailing when notifications and real-time socket events are triggered across various modules.

## Architecture Overview

SparkCRM uses an event-driven architecture powered by `@sparkcrm/shared-events`. 
1. **Services (Lead, Meeting, Task, etc.)** publish events (e.g., `EVENTS.MEETING_BOOKED`, `EVENTS.TASK_ASSIGNED`) to the event bus (RabbitMQ/Redis).
2. **`notification-service`** subscribes to these events via `src/events/eventListeners.js`.
3. The notification service processes these events and distributes them to the appropriate channels:
   - **In-App Notifications** (`sendInApp` which also emits via Socket.IO)
   - **Push Notifications** (`sendPushToUser`)
   - **Email** (`sendTemplateEmail`)
   - **Real-time Sockets** (`realtimeService.emitToTenant` or `emitToUser`)

---

## Trigger Points by Module

### 1. Leads Module (`lead-service`)

| Trigger Event | Event Name | Notification Behavior |
| :--- | :--- | :--- |
| Lead Follow-up Scheduled | `LEAD_FOLLOWUP_SCHEDULED` | Updates the Reminder collection; schedules a future notification for the assigned user. |
| Lead Assigned | `LEAD_ASSIGNED` | Sends **In-App** and **Push** notification to the assigned user (`"New Lead Assigned"`). |
| Lead Stage Changed | `LEAD_STAGE_CHANGED` | Emits a **Real-time Socket** event (`lead_stage_changed`) to the tenant to update the UI board/lists. |
| WhatsApp Welcome | `WHATSAPP_WELCOME_REQUESTED` | Handled by `whatsapp-service` directly to dispatch the welcome message via the WhatsApp API. |

### 2. Meetings Module (`meeting-service`)

| Trigger Event | Event Name | Notification Behavior |
| :--- | :--- | :--- |
| Meeting Booked | `MEETING_BOOKED` | Sends **Email** to invitees. Sends **In-App** and **Push** notifications to the meeting host and attendees inside the CRM. |
| Meeting Cancelled | `MEETING_CANCELLED` | Emits a **Real-time Socket** event (`meeting_cancelled`) to the tenant to refresh calendars and UI. |
| Meeting Rescheduled | `MEETING_RESCHEDULED` | Emits a **Real-time Socket** event (`meeting_rescheduled`) to the tenant to refresh UI. |
| Meeting Completed | `MEETING_COMPLETED` | Emits a **Real-time Socket** event (`meeting_completed`) to the tenant to refresh UI. |

### 3. Tasks Module (`lead-service`)

| Trigger Event | Event Name | Notification Behavior |
| :--- | :--- | :--- |
| Task Created | `TASK_CREATED` | Creates a scheduled `Reminder` for the `dueDate` (if provided). Emits a **Real-time Socket** event (`task_created`) to refresh UI. |
| Task Assigned | `TASK_ASSIGNED` | Re-assigns any existing scheduled `Reminder`. Sends **In-App** and **Push** notifications to the assignee. |
| Task Updated | `task.updated` | Updates the scheduled `Reminder` if `dueDate` changed, or cancels it if status became `COMPLETED` or `CANCELLED`. Emits a **Real-time Socket** event (`task_updated`). |
| Task Completed | `TASK_COMPLETED` | Cancels any pending scheduled `Reminder`. Sends **In-App** to the assignee. Emits a **Real-time Socket** event (`task_completed`). |

### 4. Calls & Dialer (`call-service` & `whatsapp-service`)

| Trigger Event | Event Name | Notification Behavior |
| :--- | :--- | :--- |
| Call Missed | `CALL_MISSED` | Sends **In-App** and **Push** notification to the user (`"Missed Call"`). Also emits `call_completed` socket. |
| Call Completed | `CALL_COMPLETED` | Emits a **Real-time Socket** event (`call_completed`) directly to the user who made/received the call. |
| Recording Ready | `CALL_RECORDING_READY` | Emits a **Real-time Socket** event (`call_recording_ready`) to the user. |

### 5. Billing & Tenants

| Trigger Event | Event Name | Notification Behavior |
| :--- | :--- | :--- |
| Tenant Registered | `TENANT_REGISTERED` | Sends **Welcome Email** and **Trial Invoice Email** to the admin. |
| Payment Success | `PAYMENT_SUCCESS` | Sends an **In-App** notification to all admins in the tenant (`"Payment Successful"`). |
| Generic Send | `SEND_NOTIFICATION` | Dispatcher for generic **In-App** notifications requested explicitly by other services. |
| Generic Email | `SEND_EMAIL` | Dispatcher for generic **Emails** requested explicitly by other services. |
| Generic Push | `SEND_PUSH` | Dispatcher for generic **Push Notifications** (FCM). |

---

## Adding New Notifications

If you need to add a new notification flow:
1. Ensure the source service (e.g. `billing-service`) imports and calls `publishEvent()` from `@sparkcrm/shared-events`.
2. Add the event constant in `@sparkcrm/shared-events/src/events.js` (if it doesn't exist).
3. Open `notification-service/src/events/eventListeners.js`.
4. Register a new `subscribeToEvents(EVENTS.YOUR_NEW_EVENT, async (_channel, data) => { ... })` listener.
5. Within the listener, route the data to `sendInApp`, `sendPushToUser`, `sendTemplateEmail`, or `realtimeService.emitToTenant/emitToUser` as appropriate.
