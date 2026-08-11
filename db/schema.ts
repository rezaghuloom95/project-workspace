import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const organisations = sqliteTable("organisations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("Asia/Bahrain"),
  language: text("language").notNull().default("en"),
  primaryColour: text("primary_colour").notNull().default("#163D33"),
  accentColour: text("accent_colour").notNull().default("#F2B84B"),
  settingsJson: text("settings_json").notNull().default("{}"),
  ...timestamps,
});

export const organisationMembers = sqliteTable(
  "organisation_members",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    initials: text("initials").notNull(),
    role: text("role").notNull(),
    department: text("department").notNull().default("Media"),
    phone: text("phone"),
    avatarColour: text("avatar_colour").notNull().default("#315C50"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("members_org_email_uq").on(
      table.organisationId,
      table.email,
    ),
    index("members_org_role_idx").on(table.organisationId, table.role),
  ],
);

export const eventCategories = sqliteTable(
  "event_categories",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colour: text("colour").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("categories_org_name_uq").on(
      table.organisationId,
      table.name,
    ),
  ],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => eventCategories.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    arrivalAt: text("arrival_at"),
    venue: text("venue").notNull().default(""),
    mapsUrl: text("maps_url"),
    opponent: text("opponent"),
    competition: text("competition"),
    homeAway: text("home_away"),
    priority: text("priority").notNull().default("Normal"),
    status: text("status").notNull().default("Planned"),
    readiness: text("readiness").notNull().default("Needs attention"),
    readinessReason: text("readiness_reason").notNull().default("Assignments need confirmation"),
    ownerId: text("owner_id").references(() => organisationMembers.id),
    campaignId: text("campaign_id"),
    clientRequestId: text("client_request_id"),
    version: integer("version").notNull().default(1),
    archivedAt: text("archived_at"),
    createdBy: text("created_by").references(() => organisationMembers.id),
    updatedBy: text("updated_by").references(() => organisationMembers.id),
    ...timestamps,
  },
  (table) => [
    index("events_org_start_idx").on(table.organisationId, table.startsAt),
    index("events_org_status_idx").on(table.organisationId, table.status),
    uniqueIndex("events_client_request_uq").on(
      table.organisationId,
      table.clientRequestId,
    ),
  ],
);

export const eventAssignments = sqliteTable(
  "event_assignments",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => organisationMembers.id),
    responsibility: text("responsibility").notNull(),
    confirmationStatus: text("confirmation_status")
      .notNull()
      .default("Assigned"),
    requiredArrivalAt: text("required_arrival_at"),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assignment_event_member_role_uq").on(
      table.eventId,
      table.memberId,
      table.responsibility,
    ),
    index("assignment_member_idx").on(table.memberId),
  ],
);

export const eventRequirements = sqliteTable("event_requirements", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id").notNull(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  photography: integer("photography", { mode: "boolean" })
    .notNull()
    .default(false),
  video: integer("video", { mode: "boolean" }).notNull().default(false),
  social: integer("social", { mode: "boolean" }).notNull().default(false),
  graphicDesign: integer("graphic_design", { mode: "boolean" })
    .notNull()
    .default(false),
  liveUpdates: integer("live_updates", { mode: "boolean" })
    .notNull()
    .default(false),
  interview: integer("interview", { mode: "boolean" })
    .notNull()
    .default(false),
  sponsorCoverage: integer("sponsor_coverage", { mode: "boolean" })
    .notNull()
    .default(false),
  ...timestamps,
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id").references(() => events.id, {
      onDelete: "cascade",
    }),
    campaignId: text("campaign_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    assigneeId: text("assignee_id").references(() => organisationMembers.id),
    dueAt: text("due_at").notNull(),
    priority: text("priority").notNull().default("Normal"),
    status: text("status").notNull().default("To do"),
    approvalRequired: integer("approval_required", { mode: "boolean" })
      .notNull()
      .default(false),
    version: integer("version").notNull().default(1),
    completedAt: text("completed_at"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    ...timestamps,
  },
  (table) => [
    index("tasks_org_due_idx").on(table.organisationId, table.dueAt),
    index("tasks_assignee_status_idx").on(table.assigneeId, table.status),
  ],
);

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull().default(""),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    ownerId: text("owner_id").references(() => organisationMembers.id),
    audience: text("audience").notNull().default("Supporters"),
    channels: text("channels").notNull().default("Instagram, X"),
    status: text("status").notNull().default("Planned"),
    priority: text("priority").notNull().default("Normal"),
    progress: integer("progress").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("campaigns_org_dates_idx").on(table.organisationId, table.startDate)],
);

export const contentItems = sqliteTable(
  "content_items",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id").references(() => events.id),
    campaignId: text("campaign_id").references(() => campaigns.id),
    title: text("title").notNull(),
    platform: text("platform").notNull(),
    contentType: text("content_type").notNull(),
    publishAt: text("publish_at").notNull(),
    assigneeId: text("assignee_id").references(() => organisationMembers.id),
    status: text("status").notNull().default("Idea"),
    approvalStatus: text("approval_status").notNull().default("Draft"),
    assetUrl: text("asset_url"),
    ...timestamps,
  },
  (table) => [index("content_org_publish_idx").on(table.organisationId, table.publishAt)],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    offsetCode: text("offset_code").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("Pending"),
    uniquenessKey: text("uniqueness_key").notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    sentAt: text("sent_at"),
    readAt: text("read_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reminder_uniqueness_uq").on(table.uniquenessKey),
    index("reminder_due_idx").on(table.status, table.scheduledAt),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    memberId: text("member_id").notNull(),
    eventId: text("event_id").references(() => events.id),
    title: text("title").notNull(),
    message: text("message").notNull(),
    kind: text("kind").notNull().default("Information"),
    readAt: text("read_at"),
    ...timestamps,
  },
  (table) => [index("notifications_member_idx").on(table.memberId, table.createdAt)],
);

export const shotListItems = sqliteTable(
  "shot_list_items",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    phase: text("phase").notNull(),
    title: text("title").notNull(),
    mandatory: integer("mandatory", { mode: "boolean" }).notNull().default(false),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    assigneeId: text("assignee_id"),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [index("shot_items_event_idx").on(table.eventId, table.sortOrder)],
);

export const equipmentItems = sqliteTable(
  "equipment_items",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [index("equipment_event_idx").on(table.eventId, table.sortOrder)],
);

export const eventComments = sqliteTable(
  "event_comments",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull(),
    body: text("body").notNull(),
    important: integer("important", { mode: "boolean" })
      .notNull()
      .default(false),
    parentId: text("parent_id"),
    editedAt: text("edited_at"),
    ...timestamps,
  },
  (table) => [index("comments_event_idx").on(table.eventId, table.createdAt)],
);

export const mediaItems = sqliteTable(
  "media_items",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id").references(() => events.id),
    campaignId: text("campaign_id").references(() => campaigns.id),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    tags: text("tags").notNull().default(""),
    uploadedBy: text("uploaded_by").notNull(),
    ...timestamps,
  },
  (table) => [index("media_org_kind_idx").on(table.organisationId, table.kind)],
);

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    eventId: text("event_id").references(() => events.id),
    memberId: text("member_id").notNull(),
    action: text("action").notNull(),
    message: text("message").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("activity_event_idx").on(table.eventId, table.createdAt)],
);

export const syncMutations = sqliteTable(
  "sync_mutations",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    memberId: text("member_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("sync_mutation_id_uq").on(table.id)],
);

export const loginAccounts = sqliteTable("login_accounts", {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .unique()
      .references(() => organisationMembers.id, { onDelete: "cascade" }),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: text("locked_until"),
    lastLoginAt: text("last_login_at"),
  ...timestamps,
});

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => organisationMembers.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("auth_sessions_member_idx").on(table.memberId, table.expiresAt),
  ],
);

export const systemMigrations = sqliteTable("system_migrations", {
  id: text("id").primaryKey(),
  appliedAt: text("applied_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
