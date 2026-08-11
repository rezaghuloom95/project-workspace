# Reminders, Notifications, and Offline Synchronisation

## Reminder creation

On event creation, the server reads the club timezone and default offsets, then creates reminders for three days, two days, one day, and the event day. Past reminder times are skipped. Each reminder has a deterministic uniqueness key built from event, recipient, offset, and channel.

When an event is rescheduled:

1. Pending reminders are marked cancelled.
2. New UTC reminder times are calculated using `UTC`.
3. Replacement reminder records are inserted.
4. Assigned members receive a material-change notification.
5. The old and new start times are written to the activity log.

Cancellation keeps history, invalidates pending reminders, and creates one cancellation notice. The delivery layer can safely retry because reminder uniqueness and status transitions are idempotent.

## Channels

- **In-app:** ready immediately and stored in the notifications table.
- **Browser/PWA:** permission is requested only after a user action.
- **Android:** the native project contains notification/deep-link hooks. Firebase values are injected as release configuration and are never committed.
- **Email (Hostinger edition):** delivered through the existing authenticated
  `info@thehive.bz` SMTP mailbox with `noreply@thehive.bz` as the visible sender.
  Each account can pause email notifications. The protected cron worker materialises
  due reminders, sends a responsive HTML and plain-text version, records delivery,
  and retries temporary failures up to three times.

## Offline queue

The service worker caches the application shell and the most recent bootstrap response. The React client records discrete pending mutations for:

- task status;
- shot-list item completion;
- attendance state;
- short notes/comments.

Each queued mutation includes an idempotency key, entity ID, operation, payload, client timestamp, and retry count. On reconnect the queue is replayed in order. Successful receipts are removed; failed operations remain visible as “changes waiting to sync”.

Checklist items are updated individually. The app never replaces an entire checklist from an offline device. Records carry version numbers and server timestamps so a future same-field conflict resolver can show both values instead of silently overwriting important event information.
