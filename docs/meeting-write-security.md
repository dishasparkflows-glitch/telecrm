# Meeting write, access, and booking security

Meeting operations use gateway-verified tenant, branch, user, and permission context. Clients cannot choose tenant, branch, host identity, comments, attachments, reminder state, or timestamps through generic meeting writes.

## Meeting writes

Authenticated scheduling and updates accept contact and meeting details such as title, description, lead, guest contact information, scheduled time, duration, attendees, meeting links, location, notes, and custom fields. Status is update-only; newly scheduled meetings start as `scheduled`.

Attendee subdocuments are allowlisted and MongoDB subdocument IDs are rejected. Meeting IDs, lead IDs, attendee user IDs, dates, durations, custom fields, pagination, and date-range filters are validated before database access.

Generic updates cannot write comments, attachments, host identity, or reminder state. Comments and attachments use dedicated endpoints.

## Record access

- Global meeting visibility remains tenant- and branch-scoped.
- Own-only lists include meetings hosted by the user and meetings where the user is an attendee.
- Only the host or a user with global visibility may update or delete a meeting.
- Hosts, authorized global users, and listed attendees may add comments and attachments.
- Record access fails closed when verified branch or permission context is missing.

## Booking links

Booking-link list, creation, and deletion use `userId` as the ownership field. Own-only users see and delete only their links; global users remain branch-scoped. Client payloads cannot select link tenant, branch, or owner.

The dashboard sends `durationOptions`, matching the database schema. `DELETE /api/meetings/booking-links/:id` is explicitly registered.

## Public bookings

Public booking payloads accept only title, guest contact fields, scheduled time, and duration. Before creating a meeting, the service verifies:

1. The link is active.
2. The requested duration is offered by the link.
3. The full meeting fits the configured days, hours, and IANA timezone.
4. The host has no overlapping scheduled or confirmed meeting.

A per-host database booking lock serializes concurrent conflict checks. Conflicting or concurrent bookings return HTTP `409`; invalid booking input or unavailable durations return HTTP `400`.
