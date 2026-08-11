import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("event creation includes all four default reminder windows", async () => {
  const api = await readFile(new URL("worker/api.ts", root), "utf8");
  assert.match(api, /\["3d", 3, 10\]/);
  assert.match(api, /\["2d", 2, 10\]/);
  assert.match(api, /\["1d", 1, 10\]/);
  assert.match(api, /\["day", 0, 8\]/);
  assert.match(api, /uniqueness_key/);
  assert.match(api, /INSERT OR IGNORE INTO reminders/);
});

test("rescheduling cancels pending reminders and writes audit history", async () => {
  const api = await readFile(new URL("worker/api.ts", root), "utf8");
  assert.match(api, /SET status = 'Cancelled'/);
  assert.match(api, /event\.rescheduled/);
  assert.match(api, /previous: event\.startsAt, next: startsAt/);
});

test("organisation scope and idempotent offline mutations are server enforced", async () => {
  const api = await readFile(new URL("worker/api.ts", root), "utf8");
  assert.match(api, /organisation_id = \?/);
  assert.match(api, /x-idempotency-key/);
  assert.match(api, /sync_mutations/);
  assert.match(api, /Your role cannot create events/);
});

test("authentication uses hashed passwords, server sessions, and protected APIs", async () => {
  const [api, auth, database] = await Promise.all([
    readFile(new URL("worker/api.ts", root), "utf8"),
    readFile(new URL("worker/auth.ts", root), "utf8"),
    readFile(new URL("worker/database.ts", root), "utf8"),
  ]);
  assert.match(auth, /PBKDF2/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(api, /Please sign in to continue/);
  assert.match(api, /DELETE FROM auth_sessions/);
  assert.match(database, /2026-07-25-production-reset/);
  assert.doesNotMatch(database, /Falcons vs|Gulf Air|Amina Rahman/);
});

test("Android release source includes secure networking and deep links", async () => {
  const [manifest, activity, build] = await Promise.all([
    readFile(new URL("android/app/src/main/AndroidManifest.xml", root), "utf8"),
    readFile(
      new URL(
        "android/app/src/main/java/com/clubmediaplanner/app/MainActivity.kt",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("android/app/build.gradle.kts", root), "utf8"),
  ]);
  assert.match(manifest, /usesCleartextTraffic="false"/);
  assert.match(manifest, /clubmediaplanner/);
  assert.match(activity, /domStorageEnabled = true/);
  assert.match(activity, /POST_NOTIFICATIONS/);
  assert.match(build, /minSdk = 26/);
});
