# Setup, Backup, and Release Guide

The hosted version does not require software on a user’s Mac. Open the production link in a modern browser. On Android, open the same link in Chrome and choose **Install app** for the fastest install path.

## Local development

Requirements:

- Node.js 22.13 or newer
- npm

Copy `.env.example` to `.env`, install packages, and run the development script. The local Cloudflare emulator provides D1 and R2 bindings from `.openai/hosting.json`.

## Database migrations

The Drizzle schema is in `db/schema.ts`. After changing it, run the database generation script and inspect the generated SQL in `drizzle/`. Migrations must remain additive or include an explicit data-copy plan.

## Production data

The Sites deployment owns the production D1 database and R2 bucket. Application secrets and provider credentials belong in hosted runtime variables, never in source files.

Recommended backup policy:

- D1 export every night; retain 30 daily and 12 monthly copies.
- R2 object versioning or a nightly inventory to independent storage.
- Quarterly restore rehearsal into a non-production project.
- Keep activity logs and notification delivery history for audit purposes.

## Firebase push setup

1. Create an Android application in Firebase using package `com.clubmediaplanner.app`.
2. Download `google-services.json` into `android/app/` (it is ignored by source control).
3. Add a restricted server credential to hosted runtime configuration.
4. Build a signed Android App Bundle and test notification deep links before Play Store submission.

The repository never contains Firebase secrets.

## Android APK and App Bundle

The `android/` project is ready for Android Studio/Gradle once the deployed planner URL and Firebase configuration are supplied.

- Development APK: use the Gradle `assembleDebug` task.
- Release App Bundle: provide a signing keystore through environment-backed Gradle properties, then use `bundleRelease`.
- Never commit the keystore, passwords, or `google-services.json`.

## Notification troubleshooting

- Check the member’s notification preferences and operating-system permission.
- Confirm the device token is active and belongs to the correct organisation/member.
- Confirm the scheduled UTC timestamp is still in the future.
- Look for an existing uniqueness key before treating a missing duplicate as a failure.
- Expire invalid provider tokens and ask the app to register a new token.

## Recovery

For accidental record changes, prefer the activity log and archived records over destructive rollback. For database loss, restore the latest verified D1 export, compare activity logs after the snapshot time, then reattach R2 media metadata by object key.
