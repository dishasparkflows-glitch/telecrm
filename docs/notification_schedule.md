# Notification Schedule and Triggers

This document outlines all the scenarios in SparkCRM when notifications (In-App, Push, Email, and Web Sockets) are triggered and the exact timing of when they are sent.

## 1. Scheduled Reminders (e.g., Lead Follow-ups)
- **Trigger**: A lead follow-up or scheduled task is approaching.
- **Timing**: Sent at the exact time configured by the user. 
  - For **Lead Follow-ups**, the notification is scheduled `X` minutes prior to the follow-up time, based on the `reminderMinutesBefore` setting chosen by the user when creating the follow-up.
  - The background notification worker runs **every 60 seconds** to pick up any due reminders and dispatch them instantly.
- **Channels**: In-App Notification, Push Notification.
- **Retry Mechanism**: If sending fails, the system will automatically retry up to 5 times with an exponential backoff (delaying up to 15-30 minutes between attempts).

## 2. Immediate Event-Based Notifications
These notifications are fired instantaneously when the corresponding action occurs in the CRM.

### Lead Assigned
- **Trigger**: A lead is assigned or re-assigned to a specific user.
- **Timing**: **Immediately** upon assignment.
- **Channels**: In-App Notification, Push Notification (delivered to the newly assigned user).

### Meeting Booked
- **Trigger**: A meeting is successfully scheduled (either via a public booking link or manual creation).
- **Timing**: **Immediately** upon successful booking.
- **Channels**: 
  - **Email**: An invite and calendar link are sent to all external guest invitees.
  - **In-App & Push**: Sent to the meeting Host and any internal team Attendees.

### Call Missed
- **Trigger**: An incoming call goes unanswered or is missed by the user.
- **Timing**: **Immediately** upon the call dropping.
- **Channels**: In-App Notification, Push Notification, and a Real-time UI Socket Event (sent to the intended recipient).

### Payment Success
- **Trigger**: A subscription or service payment is successfully processed.
- **Timing**: **Immediately** after the payment is confirmed.
- **Channels**: In-App Notification (sent to the account admins).

### Tenant Registered (New Account)
- **Trigger**: A new company/tenant registers an account on SparkCRM.
- **Timing**: **Immediately** upon successful account creation.
- **Channels**: 
  - **Email**: A Welcome Email and a Trial Invoice are sent to the registered owner's email address.

## 3. Real-Time UI Updates (Web Sockets)
The system uses real-time socket events to update the web or mobile UI instantly without requiring a page reload.

- **Call Completed**: Sent **immediately** when a call finishes, ensuring call logs in the UI are updated right away.
- **Call Recording Ready**: Sent **immediately** when a call recording URL is processed and becomes available from the telephony provider.

## 4. Weekly Cleanups
- **Trigger**: System maintenance to keep the database fast.
- **Timing**: Runs **every Sunday at Midnight**.
- **Action**: Deletes all "read" notifications that are older than 90 days.
