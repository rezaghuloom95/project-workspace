import { hashPassword } from "./auth";

export const SYSTEM = {
  organisation: "10000000-0000-4000-8000-000000000001",
  admin: "20000000-0000-4000-8000-000000000001",
  matchCategory: "30000000-0000-4000-8000-000000000001",
  trainingCategory: "30000000-0000-4000-8000-000000000002",
  interviewCategory: "30000000-0000-4000-8000-000000000003",
  sponsorCategory: "30000000-0000-4000-8000-000000000004",
  announcementCategory: "30000000-0000-4000-8000-000000000005",
  mediaDayCategory: "30000000-0000-4000-8000-000000000006",
  communityCategory: "30000000-0000-4000-8000-000000000007",
  deadlineCategory: "30000000-0000-4000-8000-000000000008",
} as const;

export const TEST_ACCOUNT = {
  username: "testadmin",
  password: "ClubPlanner#2026",
} as const;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS organisations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    timezone TEXT NOT NULL DEFAULT 'UTC', language TEXT NOT NULL DEFAULT 'en',
    primary_colour TEXT NOT NULL DEFAULT '#163D33', accent_colour TEXT NOT NULL DEFAULT '#F2B84B',
    settings_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS organisation_members (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, email TEXT NOT NULL, full_name TEXT NOT NULL,
    initials TEXT NOT NULL, role TEXT NOT NULL, department TEXT NOT NULL DEFAULT 'Media',
    phone TEXT, avatar_colour TEXT NOT NULL DEFAULT '#315C50', active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
    UNIQUE (organisation_id, email)
  )`,
  `CREATE TABLE IF NOT EXISTS event_categories (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, name TEXT NOT NULL, colour TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
    UNIQUE (organisation_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, category_id TEXT, title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', starts_at TEXT NOT NULL, ends_at TEXT, arrival_at TEXT,
    venue TEXT NOT NULL DEFAULT '', maps_url TEXT, opponent TEXT, competition TEXT, home_away TEXT,
    priority TEXT NOT NULL DEFAULT 'Normal', status TEXT NOT NULL DEFAULT 'Planned',
    readiness TEXT NOT NULL DEFAULT 'Needs attention',
    readiness_reason TEXT NOT NULL DEFAULT 'Assignments need confirmation',
    owner_id TEXT, campaign_id TEXT, client_request_id TEXT, version INTEGER NOT NULL DEFAULT 1,
    archived_at TEXT, created_by TEXT, updated_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES event_categories(id),
    UNIQUE (organisation_id, client_request_id)
  )`,
  `CREATE INDEX IF NOT EXISTS events_org_start_idx ON events (organisation_id, starts_at)`,
  `CREATE TABLE IF NOT EXISTS event_assignments (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT NOT NULL, member_id TEXT NOT NULL,
    responsibility TEXT NOT NULL, confirmation_status TEXT NOT NULL DEFAULT 'Assigned',
    required_arrival_at TEXT, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES organisation_members(id),
    UNIQUE (event_id, member_id, responsibility)
  )`,
  `CREATE TABLE IF NOT EXISTS event_requirements (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE,
    photography INTEGER NOT NULL DEFAULT 0, video INTEGER NOT NULL DEFAULT 0,
    social INTEGER NOT NULL DEFAULT 0, graphic_design INTEGER NOT NULL DEFAULT 0,
    live_updates INTEGER NOT NULL DEFAULT 0, interview INTEGER NOT NULL DEFAULT 0,
    sponsor_coverage INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT, campaign_id TEXT,
    title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', assignee_id TEXT,
    due_at TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Normal', status TEXT NOT NULL DEFAULT 'To do',
    approval_required INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
    completed_at TEXT, created_by TEXT, updated_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS tasks_org_due_idx ON tasks (organisation_id, due_at)`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL, end_date TEXT NOT NULL, owner_id TEXT, audience TEXT NOT NULL DEFAULT 'Supporters',
    channels TEXT NOT NULL DEFAULT 'Instagram, X', status TEXT NOT NULL DEFAULT 'Planned',
    priority TEXT NOT NULL DEFAULT 'Normal', progress INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT, campaign_id TEXT,
    title TEXT NOT NULL, platform TEXT NOT NULL, content_type TEXT NOT NULL, publish_at TEXT NOT NULL,
    assignee_id TEXT, status TEXT NOT NULL DEFAULT 'Idea', approval_status TEXT NOT NULL DEFAULT 'Draft',
    asset_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT NOT NULL, member_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL, offset_code TEXT NOT NULL, channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', uniqueness_key TEXT NOT NULL UNIQUE,
    retry_count INTEGER NOT NULL DEFAULT 0, sent_at TEXT, read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS reminder_due_idx ON reminders (status, scheduled_at)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, member_id TEXT NOT NULL, event_id TEXT,
    title TEXT NOT NULL, message TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Information',
    read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS shot_list_items (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT NOT NULL, phase TEXT NOT NULL,
    title TEXT NOT NULL, mandatory INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0,
    assignee_id TEXT, notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS equipment_items (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT NOT NULL, title TEXT NOT NULL,
    confirmed INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS event_comments (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT NOT NULL, member_id TEXT NOT NULL,
    body TEXT NOT NULL, important INTEGER NOT NULL DEFAULT 0, parent_id TEXT, edited_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT, campaign_id TEXT,
    title TEXT NOT NULL, kind TEXT NOT NULL, url TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
    uploaded_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, event_id TEXT, member_id TEXT NOT NULL,
    action TEXT NOT NULL, message TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sync_mutations (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, member_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS login_accounts (
    id TEXT PRIMARY KEY, member_id TEXT NOT NULL UNIQUE, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT, last_login_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES organisation_members(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL, expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES organisation_members(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS auth_sessions_member_idx ON auth_sessions (member_id, expires_at)`,
  `CREATE TABLE IF NOT EXISTS system_migrations (
    id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

const CLEAN_DATA_MIGRATION = "2026-07-25-production-reset";

export async function ensureDatabase(db: D1Database) {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await clearLegacySeedData(db);
  await seedProductionFoundation(db);
  await db
    .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
    .bind(new Date().toISOString())
    .run();
}

async function clearLegacySeedData(db: D1Database) {
  const applied = await db
    .prepare("SELECT id FROM system_migrations WHERE id = ?")
    .bind(CLEAN_DATA_MIGRATION)
    .first();
  if (applied) return;

  const orgId = SYSTEM.organisation;
  await db.batch([
    db.prepare("DELETE FROM auth_sessions"),
    db.prepare("DELETE FROM login_accounts"),
    db.prepare("DELETE FROM activity_logs WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM sync_mutations WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM event_comments WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM equipment_items WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM shot_list_items WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM notifications WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM reminders WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM content_items WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM tasks WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM event_assignments WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM event_requirements WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM media_items WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM events WHERE organisation_id = ?").bind(orgId),
    db.prepare("DELETE FROM campaigns WHERE organisation_id = ?").bind(orgId),
    db
      .prepare("DELETE FROM organisation_members WHERE organisation_id = ? AND id <> ?")
      .bind(orgId, SYSTEM.admin),
    db
      .prepare("INSERT OR IGNORE INTO system_migrations (id) VALUES (?)")
      .bind(CLEAN_DATA_MIGRATION),
  ]);
}

async function seedProductionFoundation(db: D1Database) {
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO organisations
         (id, name, slug, timezone, language, primary_colour, accent_colour, settings_json)
         VALUES (?, 'My Workspace', 'club-media-workspace', 'UTC', 'en',
                 '#163D33', '#F2B84B', ?)`,
      )
      .bind(
        SYSTEM.organisation,
        JSON.stringify({
          weekStartsOn: "Saturday",
          timeFormat: "12-hour",
          reminderTimes: [
            "3 days · 10:00",
            "2 days · 10:00",
            "1 day · 10:00",
            "Event day · 08:00",
          ],
        }),
      ),
    db
      .prepare(
        `UPDATE organisations
         SET name = 'My Workspace', slug = 'club-media-workspace',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(SYSTEM.organisation),
    db
      .prepare(
        `INSERT OR IGNORE INTO organisation_members
         (id, organisation_id, email, full_name, initials, role, department, avatar_colour)
         VALUES (?, ?, 'admin@clubplanner.test', 'Test Administrator', 'TA',
                 'Administrator', 'Club Operations', '#173F35')`,
      )
      .bind(SYSTEM.admin, SYSTEM.organisation),
    db
      .prepare(
        `UPDATE organisation_members
         SET email = 'admin@clubplanner.test', full_name = 'Test Administrator',
             initials = 'TA', role = 'Administrator', department = 'Club Operations',
             avatar_colour = '#173F35', active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(SYSTEM.admin),
  ]);

  const categories = [
    [SYSTEM.matchCategory, "Match", "#1E6A55", 1],
    [SYSTEM.trainingCategory, "Training", "#4E6E95", 2],
    [SYSTEM.interviewCategory, "Interview", "#8C5A86", 3],
    [SYSTEM.sponsorCategory, "Sponsor activation", "#B36A3E", 4],
    [SYSTEM.announcementCategory, "Announcement", "#8D7440", 5],
    [SYSTEM.mediaDayCategory, "Media day", "#547A80", 6],
    [SYSTEM.communityCategory, "Community event", "#657B4A", 7],
    [SYSTEM.deadlineCategory, "Internal deadline", "#9D4D4D", 8],
  ] as const;
  await db.batch(
    categories.map((category) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO event_categories
           (id, organisation_id, name, colour, sort_order) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          category[0],
          SYSTEM.organisation,
          category[1],
          category[2],
          category[3],
        ),
    ),
  );

  const account = await db
    .prepare("SELECT id FROM login_accounts WHERE username = ? COLLATE NOCASE")
    .bind(TEST_ACCOUNT.username)
    .first();
  if (!account) {
    const passwordHash = await hashPassword(TEST_ACCOUNT.password);
    await db
      .prepare(
        `INSERT INTO login_accounts
         (id, member_id, username, password_hash) VALUES (?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        SYSTEM.admin,
        TEST_ACCOUNT.username,
        passwordHash,
      )
      .run();
  }
}
