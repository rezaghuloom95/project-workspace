import {
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  readSessionToken,
  sessionCookie,
  sessionExpiry,
  verifyPassword,
} from "./auth";
import { ensureDatabase } from "./database";

export interface PlannerEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type Member = {
  id: string;
  organisationId: string;
  email: string;
  fullName: string;
  initials: string;
  role: string;
  department: string;
  avatarColour: string;
};

const writeRoles = new Set([
  "Administrator",
  "Project Manager",
  "Team Lead",
  "Contributor",
  "Contributor",
  "Designer",
  "Social Media Manager",
]);

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(jsonHeaders);
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function apiError(message: string, status = 400) {
  return json({ error: message }, status);
}

function selectRows<T>(result: D1Result<T>) {
  return result.results ?? [];
}

async function authenticatedMember(request: Request, db: D1Database) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  const member = await db
    .prepare(
      `SELECT m.id, m.organisation_id AS organisationId, m.email,
              m.full_name AS fullName, m.initials, m.role, m.department,
              m.avatar_colour AS avatarColour
       FROM auth_sessions s
       JOIN organisation_members m ON m.id = s.member_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND m.active = 1
       LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<Member>();
  if (!member) return null;
  await db
    .prepare(
      "UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
    )
    .bind(tokenHash)
    .run();
  return member;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function login(request: Request, db: D1Database) {
  let input: { username?: string; password?: string };
  try {
    input = (await request.json()) as { username?: string; password?: string };
  } catch {
    return apiError("Enter your username and password.");
  }
  const username = input.username?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";
  if (!username || !password || username.length > 120 || password.length > 200) {
    return apiError("Enter your username and password.");
  }

  const account = await db
    .prepare(
      `SELECT a.id AS accountId, a.password_hash AS passwordHash,
              a.failed_attempts AS failedAttempts, a.locked_until AS lockedUntil,
              m.id, m.organisation_id AS organisationId, m.email,
              m.full_name AS fullName, m.initials, m.role, m.department,
              m.avatar_colour AS avatarColour
       FROM login_accounts a
       JOIN organisation_members m ON m.id = a.member_id
       WHERE a.username = ? COLLATE NOCASE AND m.active = 1
       LIMIT 1`,
    )
    .bind(username)
    .first<
      Member & {
        accountId: string;
        passwordHash: string;
        failedAttempts: number;
        lockedUntil: string | null;
      }
    >();

  if (account?.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now()) {
    return apiError("Too many sign-in attempts. Try again in 15 minutes.", 429);
  }

  const passwordMatches = account
    ? await verifyPassword(password, account.passwordHash)
    : false;
  if (!account || !passwordMatches) {
    if (account) {
      const attempts = Number(account.failedAttempts) + 1;
      const lockedUntil =
        attempts >= 8 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await db
        .prepare(
          `UPDATE login_accounts
           SET failed_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(attempts >= 8 ? 0 : attempts, lockedUntil, account.accountId)
        .run();
    }
    return apiError("The username or password is incorrect.", 401);
  }

  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  await db.batch([
    db
      .prepare(
        `UPDATE login_accounts
         SET failed_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(account.accountId),
    db
      .prepare(
        `INSERT INTO auth_sessions
         (token_hash, member_id, expires_at, user_agent) VALUES (?, ?, ?, ?)`,
      )
      .bind(
        tokenHash,
        account.id,
        sessionExpiry(),
        request.headers.get("user-agent")?.slice(0, 300) ?? null,
      ),
  ]);
  return json(
    {
      ok: true,
      actor: {
        id: account.id,
        fullName: account.fullName,
        initials: account.initials,
        role: account.role,
      },
    },
    200,
    { "set-cookie": sessionCookie(token, request) },
  );
}

async function logout(request: Request, db: D1Database) {
  const token = readSessionToken(request);
  if (token) {
    await db
      .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
      .bind(await hashSessionToken(token))
      .run();
  }
  return json(
    { ok: true },
    200,
    { "set-cookie": clearSessionCookie(request) },
  );
}

function requireWriter(member: Member) {
  return writeRoles.has(member.role);
}

export async function handleApiRequest(
  request: Request,
  env: PlannerEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (!env.DB) return apiError("The planner database is not available.", 503);

  try {
    await ensureDatabase(env.DB);
    if (request.method !== "GET" && !sameOrigin(request)) {
      return apiError("This request was blocked for your security.", 403);
    }
    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      return login(request, env.DB);
    }
    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      return logout(request, env.DB);
    }

    const member = await authenticatedMember(request, env.DB);
    if (!member) return apiError("Please sign in to continue.", 401);
    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      return json({ actor: member });
    }

    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      return bootstrap(env.DB, member);
    }
    if (request.method === "POST" && url.pathname === "/api/events") {
      if (!["Administrator", "Project Manager", "Team Lead"].includes(member.role)) {
        return apiError("Your role cannot create events.", 403);
      }
      return createEvent(request, env.DB, member);
    }

    const rescheduleMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/reschedule$/);
    if (request.method === "POST" && rescheduleMatch) {
      if (!["Administrator", "Project Manager", "Team Lead"].includes(member.role)) {
        return apiError("Your role cannot reschedule events.", 403);
      }
      return rescheduleEvent(request, env.DB, member, rescheduleMatch[1]);
    }

    const attendanceMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/attendance$/);
    if (request.method === "POST" && attendanceMatch) {
      if (!requireWriter(member)) return apiError("Your role cannot update attendance.", 403);
      return updateAttendance(request, env.DB, member, attendanceMatch[1]);
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (request.method === "PATCH" && taskMatch) {
      if (!requireWriter(member)) return apiError("Your role cannot update tasks.", 403);
      return updateTask(request, env.DB, member, taskMatch[1]);
    }

    const shotMatch = url.pathname.match(/^\/api\/shot-items\/([^/]+)$/);
    if (request.method === "PATCH" && shotMatch) {
      if (!requireWriter(member)) return apiError("Your role cannot update shot lists.", 403);
      return updateShotItem(request, env.DB, member, shotMatch[1]);
    }

    if (request.method === "POST" && url.pathname === "/api/comments") {
      if (!requireWriter(member)) return apiError("Your role cannot add comments.", 403);
      return addComment(request, env.DB, member);
    }

    if (request.method === "POST" && url.pathname === "/api/notifications/read") {
      await env.DB
        .prepare(
          `UPDATE notifications SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE organisation_id = ? AND member_id = ? AND read_at IS NULL`,
        )
        .bind(member.organisationId, member.id)
        .run();
      return json({ ok: true });
    }

    if (request.method === "PATCH" && url.pathname === "/api/settings") {
      if (member.role !== "Administrator") {
        return apiError("Only a club administrator can update settings.", 403);
      }
      return updateSettings(request, env.DB, member);
    }

    return apiError("This planner action was not found.", 404);
  } catch (error) {
    console.error("Planner API error", error);
    return apiError("Something went wrong. Please try again.", 500);
  }
}

async function bootstrap(db: D1Database, member: Member) {
  const orgId = member.organisationId;
  const [
    organisation,
    categoriesResult,
    teamResult,
    eventsResult,
    assignmentsResult,
    requirementsResult,
    tasksResult,
    campaignsResult,
    contentResult,
    notificationsResult,
    shotsResult,
    equipmentResult,
    commentsResult,
    mediaResult,
    activityResult,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT id, name, timezone, language, primary_colour AS primaryColour,
                accent_colour AS accentColour, settings_json AS settingsJson
         FROM organisations WHERE id = ?`,
      )
      .bind(orgId)
      .first(),
    db
      .prepare(
        `SELECT id, name, colour, sort_order AS sortOrder
         FROM event_categories WHERE organisation_id = ? AND enabled = 1 ORDER BY sort_order`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT id, full_name AS fullName, initials, role, department,
                avatar_colour AS avatarColour, active
         FROM organisation_members WHERE organisation_id = ? AND active = 1
         ORDER BY CASE role WHEN 'Administrator' THEN 1 WHEN 'Project Manager' THEN 2
                  WHEN 'Team Lead' THEN 3 ELSE 4 END, full_name`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT e.id, e.title, e.description, e.starts_at AS startsAt, e.ends_at AS endsAt,
                e.arrival_at AS arrivalAt, e.venue, e.opponent, e.competition,
                e.home_away AS homeAway, e.priority, e.status, e.readiness,
                e.readiness_reason AS readinessReason, e.owner_id AS ownerId,
                e.campaign_id AS campaignId, e.version, c.id AS categoryId,
                c.name AS category, c.colour AS categoryColour,
                m.full_name AS ownerName
         FROM events e
         LEFT JOIN event_categories c ON c.id = e.category_id
         LEFT JOIN organisation_members m ON m.id = e.owner_id
         WHERE e.organisation_id = ? AND e.archived_at IS NULL
           AND e.starts_at >= datetime('now', '-7 days')
         ORDER BY e.starts_at LIMIT 160`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT a.id, a.event_id AS eventId, a.member_id AS memberId,
                a.responsibility, a.confirmation_status AS confirmationStatus,
                a.required_arrival_at AS requiredArrivalAt, m.full_name AS fullName,
                m.initials, m.avatar_colour AS avatarColour, m.role
         FROM event_assignments a
         JOIN organisation_members m ON m.id = a.member_id
         WHERE a.organisation_id = ? ORDER BY a.created_at`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT event_id AS eventId, photography, video, social,
                graphic_design AS graphicDesign, live_updates AS liveUpdates,
                interview, sponsor_coverage AS sponsorCoverage
         FROM event_requirements WHERE organisation_id = ?`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT t.id, t.event_id AS eventId, t.campaign_id AS campaignId, t.title,
                t.description, t.assignee_id AS assigneeId, t.due_at AS dueAt,
                t.priority, t.status, t.approval_required AS approvalRequired,
                t.version, t.completed_at AS completedAt, m.full_name AS assigneeName,
                m.initials AS assigneeInitials, e.title AS eventTitle
         FROM tasks t
         LEFT JOIN organisation_members m ON m.id = t.assignee_id
         LEFT JOIN events e ON e.id = t.event_id
         WHERE t.organisation_id = ?
         ORDER BY CASE t.status WHEN 'Completed' THEN 2 ELSE 1 END, t.due_at LIMIT 200`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT c.id, c.title, c.objective, c.start_date AS startDate,
                c.end_date AS endDate, c.owner_id AS ownerId, c.audience,
                c.channels, c.status, c.priority, c.progress, m.full_name AS ownerName
         FROM campaigns c LEFT JOIN organisation_members m ON m.id = c.owner_id
         WHERE c.organisation_id = ? ORDER BY c.start_date LIMIT 60`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT c.id, c.event_id AS eventId, c.campaign_id AS campaignId, c.title,
                c.platform, c.content_type AS contentType, c.publish_at AS publishAt,
                c.assignee_id AS assigneeId, c.status,
                c.approval_status AS approvalStatus, c.asset_url AS assetUrl,
                m.full_name AS assigneeName
         FROM content_items c LEFT JOIN organisation_members m ON m.id = c.assignee_id
         WHERE c.organisation_id = ? ORDER BY c.publish_at LIMIT 100`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT id, event_id AS eventId, title, message, kind, read_at AS readAt,
                created_at AS createdAt
         FROM notifications WHERE organisation_id = ? AND member_id = ?
         ORDER BY created_at DESC LIMIT 40`,
      )
      .bind(orgId, member.id)
      .all(),
    db
      .prepare(
        `SELECT id, event_id AS eventId, phase, title, mandatory, completed,
                assignee_id AS assigneeId, notes, sort_order AS sortOrder, version
         FROM shot_list_items WHERE organisation_id = ? ORDER BY event_id, sort_order`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT id, event_id AS eventId, title, confirmed, notes,
                sort_order AS sortOrder, version
         FROM equipment_items WHERE organisation_id = ? ORDER BY event_id, sort_order`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT c.id, c.event_id AS eventId, c.member_id AS memberId, c.body,
                c.important, c.created_at AS createdAt, m.full_name AS memberName,
                m.initials, m.avatar_colour AS avatarColour
         FROM event_comments c JOIN organisation_members m ON m.id = c.member_id
         WHERE c.organisation_id = ? ORDER BY c.created_at DESC LIMIT 80`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT f.id, f.event_id AS eventId, f.campaign_id AS campaignId,
                f.title, f.kind, f.url, f.tags, f.uploaded_by AS uploadedBy,
                f.created_at AS createdAt, m.full_name AS uploadedByName
         FROM media_items f LEFT JOIN organisation_members m ON m.id = f.uploaded_by
         WHERE f.organisation_id = ? ORDER BY f.created_at DESC LIMIT 100`,
      )
      .bind(orgId)
      .all(),
    db
      .prepare(
        `SELECT a.id, a.event_id AS eventId, a.member_id AS memberId, a.action,
                a.message, a.metadata_json AS metadataJson, a.created_at AS createdAt,
                m.full_name AS memberName
         FROM activity_logs a LEFT JOIN organisation_members m ON m.id = a.member_id
         WHERE a.organisation_id = ? ORDER BY a.created_at DESC LIMIT 100`,
      )
      .bind(orgId)
      .all(),
  ]);

  return json({
    actor: member,
    organisation: organisation
      ? {
          ...organisation,
          settings: JSON.parse(String(organisation.settingsJson || "{}")),
        }
      : null,
    categories: selectRows(categoriesResult),
    team: selectRows(teamResult),
    events: selectRows(eventsResult),
    assignments: selectRows(assignmentsResult),
    requirements: selectRows(requirementsResult),
    tasks: selectRows(tasksResult),
    campaigns: selectRows(campaignsResult),
    content: selectRows(contentResult),
    notifications: selectRows(notificationsResult),
    shotItems: selectRows(shotsResult),
    equipmentItems: selectRows(equipmentResult),
    comments: selectRows(commentsResult),
    media: selectRows(mediaResult),
    activity: selectRows(activityResult),
    serverTime: new Date().toISOString(),
  });
}

type EventInput = {
  title?: string;
  categoryId?: string;
  date?: string;
  time?: string;
  venue?: string;
  opponent?: string;
  priority?: string;
  requirements?: Record<string, boolean>;
  assigneeIds?: string[];
  clientRequestId?: string;
};

async function createEvent(request: Request, db: D1Database, member: Member) {
  const input = (await request.json()) as EventInput;
  if (!input.title?.trim() || !input.categoryId || !input.date || !input.time) {
    return apiError("Add a title, category, date, and start time.");
  }
  const startsAt = fromBahrainLocal(input.date, input.time);
  if (!startsAt) return apiError("Enter a valid event date and time.");

  const clientRequestId = input.clientRequestId || crypto.randomUUID();
  const existing = await db
    .prepare(
      `SELECT id FROM events WHERE organisation_id = ? AND client_request_id = ?`,
    )
    .bind(member.organisationId, clientRequestId)
    .first<{ id: string }>();
  if (existing) return json({ ok: true, id: existing.id, duplicate: true });

  const eventId = crypto.randomUUID();
  const requirementId = crypto.randomUUID();
  const requirements = input.requirements ?? {};
  const readinessReason =
    requirements.photography && !(input.assigneeIds ?? []).length
      ? "Contributor assignment is still open"
      : "New assignments need confirmation";
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO events
         (id, organisation_id, category_id, title, starts_at, venue, opponent, priority,
          status, readiness, readiness_reason, owner_id, client_request_id,
          created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Planned', 'Needs attention', ?, ?, ?, ?, ?)`,
      )
      .bind(
        eventId,
        member.organisationId,
        input.categoryId,
        input.title.trim(),
        startsAt,
        input.venue?.trim() ?? "",
        input.opponent?.trim() || null,
        input.priority ?? "Normal",
        readinessReason,
        member.id,
        clientRequestId,
        member.id,
        member.id,
      ),
    db
      .prepare(
        `INSERT INTO event_requirements
         (id, organisation_id, event_id, photography, video, social, graphic_design,
          live_updates, interview, sponsor_coverage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        requirementId,
        member.organisationId,
        eventId,
        Number(Boolean(requirements.photography)),
        Number(Boolean(requirements.video)),
        Number(Boolean(requirements.social)),
        Number(Boolean(requirements.graphicDesign)),
        Number(Boolean(requirements.liveUpdates)),
        Number(Boolean(requirements.interview)),
        Number(Boolean(requirements.sponsorCoverage)),
      ),
    db
      .prepare(
        `INSERT INTO event_assignments
         (id, organisation_id, event_id, member_id, responsibility, confirmation_status)
         VALUES (?, ?, ?, ?, 'Event owner', 'Confirmed')`,
      )
      .bind(crypto.randomUUID(), member.organisationId, eventId, member.id),
    db
      .prepare(
        `INSERT INTO activity_logs
         (id, organisation_id, event_id, member_id, action, message)
         VALUES (?, ?, ?, ?, 'event.created', ?)`,
      )
      .bind(
        crypto.randomUUID(),
        member.organisationId,
        eventId,
        member.id,
        `${member.fullName} created “${input.title.trim()}”.`,
      ),
  ];

  const assigneeIds = [...new Set(input.assigneeIds ?? [])].filter(
    (id) => id !== member.id,
  );
  for (const assigneeId of assigneeIds) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO event_assignments
           (id, organisation_id, event_id, member_id, responsibility, confirmation_status)
           VALUES (?, ?, ?, ?, 'Coverage team', 'Assigned')`,
        )
        .bind(crypto.randomUUID(), member.organisationId, eventId, assigneeId),
      db
        .prepare(
          `INSERT INTO notifications
           (id, organisation_id, member_id, event_id, title, message, kind)
           VALUES (?, ?, ?, ?, 'New event assignment', ?, 'Assignment')`,
        )
        .bind(
          crypto.randomUUID(),
          member.organisationId,
          assigneeId,
          eventId,
          `You were assigned to ${input.title.trim()}.`,
        ),
    );
  }

  for (const suggestion of suggestedTasks(requirements)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tasks
           (id, organisation_id, event_id, title, assignee_id, due_at,
            priority, status, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'To do', ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          member.organisationId,
          eventId,
          suggestion,
          assigneeIds[0] ?? member.id,
          startsAt,
          input.priority ?? "Normal",
          member.id,
          member.id,
        ),
    );
  }

  const recipients = [member.id, ...assigneeIds];
  statements.push(
    ...buildReminderStatements(
      db,
      member.organisationId,
      eventId,
      recipients,
      startsAt,
    ),
  );

  await db.batch(statements);
  return json({ ok: true, id: eventId }, 201);
}

function suggestedTasks(requirements: Record<string, boolean>) {
  const suggestions: string[] = [];
  if (requirements.photography) {
    suggestions.push("Confirm photographer", "Prepare shot list", "Check camera equipment");
  }
  if (requirements.video) suggestions.push("Confirm video brief and audio kit");
  if (requirements.graphicDesign) suggestions.push("Prepare artwork and submit for approval");
  if (requirements.social || requirements.liveUpdates) {
    suggestions.push("Prepare social coverage plan");
  }
  if (requirements.sponsorCoverage) suggestions.push("Confirm mandatory sponsor frames");
  return suggestions.length ? suggestions : ["Confirm event details"];
}

function fromBahrainLocal(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildReminderStatements(
  db: D1Database,
  organisationId: string,
  eventId: string,
  memberIds: string[],
  eventStartsAt: string,
) {
  const schedule = [
    ["3d", 3, 10],
    ["2d", 2, 10],
    ["1d", 1, 10],
    ["day", 0, 8],
  ] as const;
  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  for (const memberId of [...new Set(memberIds)]) {
    for (const [code, days, hour] of schedule) {
      const scheduledAt = reminderTime(eventStartsAt, days, hour);
      if (new Date(scheduledAt).getTime() <= now) continue;
      for (const channel of ["in_app", "push"]) {
        const uniquenessKey = `${eventId}:${memberId}:${code}:${channel}`;
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO reminders
               (id, organisation_id, event_id, member_id, scheduled_at,
                offset_code, channel, status, uniqueness_key)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
            )
            .bind(
              crypto.randomUUID(),
              organisationId,
              eventId,
              memberId,
              scheduledAt,
              code,
              channel,
              uniquenessKey,
            ),
        );
      }
    }
  }
  return statements;
}

function reminderTime(eventStartsAt: string, daysBefore: number, hour: number) {
  const event = new Date(eventStartsAt);
  const bahrain = new Date(event.getTime() + 3 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(
      bahrain.getUTCFullYear(),
      bahrain.getUTCMonth(),
      bahrain.getUTCDate() - daysBefore,
      hour - 3,
      0,
    ),
  ).toISOString();
}

async function rescheduleEvent(
  request: Request,
  db: D1Database,
  member: Member,
  eventId: string,
) {
  const input = (await request.json()) as { date?: string; time?: string };
  if (!input.date || !input.time) return apiError("Choose a new date and time.");
  const startsAt = fromBahrainLocal(input.date, input.time);
  if (!startsAt) return apiError("Enter a valid date and time.");
  const event = await db
    .prepare(
      `SELECT title, starts_at AS startsAt FROM events
       WHERE id = ? AND organisation_id = ? AND archived_at IS NULL`,
    )
    .bind(eventId, member.organisationId)
    .first<{ title: string; startsAt: string }>();
  if (!event) return apiError("This event is no longer available.", 404);

  const assignmentResult = await db
    .prepare(
      `SELECT member_id AS memberId FROM event_assignments
       WHERE event_id = ? AND organisation_id = ?`,
    )
    .bind(eventId, member.organisationId)
    .all<{ memberId: string }>();
  const recipients = [
    member.id,
    ...selectRows(assignmentResult).map((row) => row.memberId),
  ];

  const oldLabel = formatBahrain(event.startsAt);
  const newLabel = formatBahrain(startsAt);
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE events SET starts_at = ?, version = version + 1, updated_by = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organisation_id = ?`,
      )
      .bind(startsAt, member.id, eventId, member.organisationId),
    db
      .prepare(
        `UPDATE reminders SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE event_id = ? AND organisation_id = ? AND status = 'Pending'`,
      )
      .bind(eventId, member.organisationId),
    db
      .prepare(
        `INSERT INTO activity_logs
         (id, organisation_id, event_id, member_id, action, message, metadata_json)
         VALUES (?, ?, ?, ?, 'event.rescheduled', ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        member.organisationId,
        eventId,
        member.id,
        `${member.fullName} moved ${event.title} from ${oldLabel} to ${newLabel}.`,
        JSON.stringify({ previous: event.startsAt, next: startsAt }),
      ),
  ];
  for (const recipient of [...new Set(recipients)]) {
    statements.push(
      db
        .prepare(
          `INSERT INTO notifications
           (id, organisation_id, member_id, event_id, title, message, kind)
           VALUES (?, ?, ?, ?, 'Event rescheduled', ?, 'Reschedule')`,
        )
        .bind(
          crypto.randomUUID(),
          member.organisationId,
          recipient,
          eventId,
          `${event.title} moved from ${oldLabel} to ${newLabel}.`,
        ),
    );
  }
  statements.push(
    ...buildReminderStatements(
      db,
      member.organisationId,
      eventId,
      recipients,
      startsAt,
    ),
  );
  await db.batch(statements);
  return json({ ok: true });
}

function formatBahrain(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function updateAttendance(
  request: Request,
  db: D1Database,
  member: Member,
  eventId: string,
) {
  const input = (await request.json()) as { status?: string };
  const allowed = ["Confirmed", "On the way", "Arrived", "Coverage started", "Uploading", "Completed", "Unable to attend"];
  if (!input.status || !allowed.includes(input.status)) {
    return apiError("Choose a valid attendance status.");
  }
  const event = await db
    .prepare(`SELECT title FROM events WHERE id = ? AND organisation_id = ?`)
    .bind(eventId, member.organisationId)
    .first<{ title: string }>();
  if (!event) return apiError("This event is no longer available.", 404);

  await db.batch([
    db
      .prepare(
        `INSERT INTO event_assignments
         (id, organisation_id, event_id, member_id, responsibility, confirmation_status)
         VALUES (?, ?, ?, ?, 'Team member', ?)
         ON CONFLICT(event_id, member_id, responsibility)
         DO UPDATE SET confirmation_status = excluded.confirmation_status,
                       updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        crypto.randomUUID(),
        member.organisationId,
        eventId,
        member.id,
        input.status,
      ),
    db
      .prepare(
        `INSERT INTO activity_logs
         (id, organisation_id, event_id, member_id, action, message)
         VALUES (?, ?, ?, ?, 'attendance.updated', ?)`,
      )
      .bind(
        crypto.randomUUID(),
        member.organisationId,
        eventId,
        member.id,
        `${member.fullName} marked ${input.status.toLowerCase()} for ${event.title}.`,
      ),
  ]);
  return json({ ok: true });
}

async function mutationSeen(
  request: Request,
  db: D1Database,
  member: Member,
) {
  const key = request.headers.get("x-idempotency-key");
  if (!key) return { key: null, seen: false };
  const seen = await db
    .prepare(`SELECT id FROM sync_mutations WHERE id = ? AND organisation_id = ?`)
    .bind(key, member.organisationId)
    .first();
  return { key, seen: Boolean(seen) };
}

async function updateTask(
  request: Request,
  db: D1Database,
  member: Member,
  taskId: string,
) {
  const mutation = await mutationSeen(request, db, member);
  if (mutation.seen) return json({ ok: true, duplicate: true });
  const input = (await request.json()) as { status?: string };
  const allowed = ["To do", "In progress", "Waiting", "For review", "Changes requested", "Completed", "Cancelled"];
  if (!input.status || !allowed.includes(input.status)) return apiError("Choose a valid task status.");
  const task = await db
    .prepare(
      `SELECT title, event_id AS eventId FROM tasks WHERE id = ? AND organisation_id = ?`,
    )
    .bind(taskId, member.organisationId)
    .first<{ title: string; eventId: string | null }>();
  if (!task) return apiError("This task is no longer available.", 404);
  const statements = [
    db
      .prepare(
        `UPDATE tasks SET status = ?, completed_at = ?, version = version + 1,
         updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organisation_id = ?`,
      )
      .bind(
        input.status,
        input.status === "Completed" ? new Date().toISOString() : null,
        member.id,
        taskId,
        member.organisationId,
      ),
    db
      .prepare(
        `INSERT INTO activity_logs
         (id, organisation_id, event_id, member_id, action, message)
         VALUES (?, ?, ?, ?, 'task.updated', ?)`,
      )
      .bind(
        crypto.randomUUID(),
        member.organisationId,
        task.eventId,
        member.id,
        `${member.fullName} marked “${task.title}” ${input.status.toLowerCase()}.`,
      ),
  ];
  if (mutation.key) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO sync_mutations
           (id, organisation_id, member_id, entity_type, entity_id)
           VALUES (?, ?, ?, 'task', ?)`,
        )
        .bind(mutation.key, member.organisationId, member.id, taskId),
    );
  }
  await db.batch(statements);
  return json({ ok: true });
}

async function updateShotItem(
  request: Request,
  db: D1Database,
  member: Member,
  itemId: string,
) {
  const mutation = await mutationSeen(request, db, member);
  if (mutation.seen) return json({ ok: true, duplicate: true });
  const input = (await request.json()) as { completed?: boolean; notes?: string };
  if (typeof input.completed !== "boolean") return apiError("Choose a checklist state.");
  const item = await db
    .prepare(
      `SELECT title, event_id AS eventId FROM shot_list_items
       WHERE id = ? AND organisation_id = ?`,
    )
    .bind(itemId, member.organisationId)
    .first<{ title: string; eventId: string }>();
  if (!item) return apiError("This shot-list item is no longer available.", 404);
  const statements = [
    db
      .prepare(
        `UPDATE shot_list_items SET completed = ?, notes = COALESCE(?, notes),
         version = version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organisation_id = ?`,
      )
      .bind(Number(input.completed), input.notes ?? null, itemId, member.organisationId),
    db
      .prepare(
        `INSERT INTO activity_logs
         (id, organisation_id, event_id, member_id, action, message)
         VALUES (?, ?, ?, ?, 'shot.updated', ?)`,
      )
      .bind(
        crypto.randomUUID(),
        member.organisationId,
        item.eventId,
        member.id,
        `${member.fullName} ${input.completed ? "completed" : "reopened"} “${item.title}”.`,
      ),
  ];
  if (mutation.key) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO sync_mutations
           (id, organisation_id, member_id, entity_type, entity_id)
           VALUES (?, ?, ?, 'shot', ?)`,
        )
        .bind(mutation.key, member.organisationId, member.id, itemId),
    );
  }
  await db.batch(statements);
  return json({ ok: true });
}

async function addComment(request: Request, db: D1Database, member: Member) {
  const input = (await request.json()) as {
    eventId?: string;
    body?: string;
    important?: boolean;
  };
  if (!input.eventId || !input.body?.trim()) return apiError("Write a comment first.");
  const event = await db
    .prepare(`SELECT id FROM events WHERE id = ? AND organisation_id = ?`)
    .bind(input.eventId, member.organisationId)
    .first();
  if (!event) return apiError("This event is no longer available.", 404);
  await db
    .prepare(
      `INSERT INTO event_comments
       (id, organisation_id, event_id, member_id, body, important)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      member.organisationId,
      input.eventId,
      member.id,
      input.body.trim(),
      Number(Boolean(input.important)),
    )
    .run();
  return json({ ok: true }, 201);
}

async function updateSettings(
  request: Request,
  db: D1Database,
  member: Member,
) {
  const input = (await request.json()) as {
    name?: string;
    primaryColour?: string;
    accentColour?: string;
    timezone?: string;
  };
  const name = input.name?.trim();
  if (!name) return apiError("Enter a club name.");
  const colourPattern = /^#[0-9a-fA-F]{6}$/;
  if (
    !input.primaryColour ||
    !input.accentColour ||
    !colourPattern.test(input.primaryColour) ||
    !colourPattern.test(input.accentColour)
  ) {
    return apiError("Choose valid six-digit brand colours.");
  }
  await db
    .prepare(
      `UPDATE organisations SET name = ?, primary_colour = ?, accent_colour = ?,
       timezone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(
      name,
      input.primaryColour,
      input.accentColour,
      input.timezone || "UTC",
      member.organisationId,
    )
    .run();
  return json({ ok: true });
}
