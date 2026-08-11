# Project Workspace — Technical Architecture

## Product shape

Project Workspace is a focused operations system for one sports club, with organisation IDs on every operational record so additional clubs can be added later. The deployed product is a responsive web app and installable Progressive Web App. The `android/` directory contains a native Android shell that uses the same hosted application and data.

## Runtime architecture

```text
Web browser / installed PWA / Android shell
                    |
              HTTPS JSON API
                    |
        Cloudflare Worker + Vinext
             /               \
     D1 relational data      R2 media objects
```

- **Interface:** React 19, TypeScript, Vinext/Next App Router, responsive CSS design system.
- **API:** Cloudflare Worker endpoints under `/api/*`.
- **Database:** Cloudflare D1/SQLite, accessed only from the server worker with prepared statements.
- **Files:** R2 binding reserved for direct small-file storage; the UI encourages external links for large original media.
- **Identity:** owner-only Sites access for the deployed version. The worker reads the authenticated-user headers when present and resolves every request to an organisation member.
- **Offline:** service-worker shell caching plus a browser-side mutation queue. Individual checklist and task changes are replayed when connectivity returns.
- **Live updates:** focused background refresh, visibility refresh, and BroadcastChannel updates between open clients. Mutations are optimistic and idempotent.
- **Notifications:** persistent reminder/notification records, in-app notification centre, browser notification support, and Android notification-deep-link hooks.

## Folder structure

```text
app/                 React application and design system
db/                  Drizzle schema
drizzle/             Generated D1 migrations
worker/              API, database bootstrap, reminder engine
public/              PWA manifest, service worker, images
android/             Native Android wrapper project
docs/                Architecture and operating documentation
tests/               Rendered app and business-rule tests
.openai/              Hosting and storage bindings
```

## Core records

- Organisation and settings
- Members, roles, and teams
- Event categories, events, requirements, and assignments
- Tasks and checklist items
- Coverage briefs, shot items, and equipment items
- Campaigns and social content
- Reminders and notifications
- Comments, media references, and activity logs
- Idempotency/sync mutation receipts

All important records carry an organisation ID, timestamps, and creator/updater attribution. IDs are UUID strings. Deletion is soft where historical reporting matters.

## API surface

- `GET /api/bootstrap` — current club, dashboard, calendar, work, team, and notification data.
- `POST /api/events` — create an event and generate requirements, assignments, tasks, and reminders.
- `POST /api/events/:id/reschedule` — invalidate old reminders, move the event, replace reminders, notify assignees, and log the change.
- `POST /api/events/:id/attendance` — update the current member’s confirmation state.
- `PATCH /api/tasks/:id` — update a task without replacing unrelated fields.
- `PATCH /api/shot-items/:id` — update one offline-safe checklist item.
- `POST /api/comments` — add an event-linked update.
- `PATCH /api/settings` — change shared club branding and operating settings.

## Design principles

- The first screen answers what is happening, what is urgent, and who owns it.
- Event status and coverage readiness remain separate.
- Status is always communicated with text and shape, not colour alone.
- Mobile uses a five-action bottom bar with a central Add action.
- The user can create a useful event with title, category, date, and time only.
- Large media is referenced by link; small previews and briefs can use managed storage.

## Technical risks and solutions

| Risk | Response |
|---|---|
| Duplicate reminders | Unique reminder keys and idempotent mutation receipts |
| Event rescheduling | Pending reminders are invalidated before replacements are inserted |
| Offline conflicts | Field-level mutations, record versions, and server timestamps |
| Weak connectivity | Small bootstrap payload, optimistic UI, service-worker cache, retry queue |
| Cross-club leakage | Organisation resolved server-side and required in every operational query |
| Missing push credentials | In-app/browser notifications work immediately; Firebase hooks remain configuration-driven |
| Heavy media uploads | External cloud links are first-class and originals are not forced through the app |
| Growing event volume | Indexed start dates/statuses, bounded queries, archived records, filtered subscriptions |

## Delivery phases represented in this repository

1. Foundation: data model, settings, roles, shell, navigation.
2. Core planning: dashboard, calendar, event creation/details, reminders.
3. Team operations: tasks, attendance, comments, activity, offline queue.
4. Media coverage: brief, shot list, equipment, links.
5. Marketing: campaigns, social content, approval states.
6. Reporting and polish: summaries, filters, localisation structure, responsive/PWA release.
