# Notification Service Overview

This document outlines the technologies used and the events that trigger notifications within the SparkCRM Notification Service.

## 🛠️ Technologies & Channels Used

The notification service leverages several channels to deliver messages to users:

1. **Email Notifications**: Sent using `nodemailer`. The service supports template-based emails.
2. **Push Notifications**: Delivered via FCM (Firebase Cloud Messaging).
3. **In-App Notifications**: Stored in the database using the `Notification` Mongoose model.
4. **Reminders**: Managed using the `Reminder` Mongoose model, used specifically for scheduled follow-ups.

## 🚀 Notification Triggers & Events

The service listens to various system events (via `@sparkcrm/shared-events`) to dispatch notifications:

| Event Name | Action Taken | Channel(s) |
| :--- | :--- | :--- |
| `SEND_NOTIFICATION` | Generic event to send a direct notification. | In-App (Default) |
| `SEND_EMAIL` | Sends an email using a specified template. | Email |
| `TENANT_REGISTERED` | Sends a **Welcome Email** and a **Trial Invoice Email** to the new tenant. | Email |
| `SEND_PUSH` | Generic event to send a push notification. | Push (FCM) |
| `LEAD_FOLLOWUP_SCHEDULED` | Creates, updates, or cancels a scheduled reminder for lead follow-ups. | Reminder |
| `LEAD_ASSIGNED` | Notifies the newly assigned user about the lead. Also updates any pending follow-up reminders to the new assignee. | In-App, Push |
| `MEETING_BOOKED` | Notifies the host that a new meeting has been scheduled with them. | In-App, Push |
| `PAYMENT_SUCCESS` | Sends a success notification upon successful payment. | In-App |
| `CALL_MISSED` | Notifies the user/caller about a missed call, with specific context if it was from a lead. | In-App, Push |

## 📅 Timings & Scheduling

- **Instant Notifications**: Events like `LEAD_ASSIGNED`, `MEETING_BOOKED`, `PAYMENT_SUCCESS`, and `CALL_MISSED` trigger notifications **immediately** as the event occurs.
- **Scheduled Reminders**: `LEAD_FOLLOWUP_SCHEDULED` creates a reminder due at a specific `followUpAt` timestamp. Background jobs (likely in `src/jobs/`) process these pending reminders when they are due.
