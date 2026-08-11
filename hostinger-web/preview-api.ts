type PreviewStore = {
  userPassword: string;
  emailDelivery: Record<string, unknown>;
  actor: Record<string, unknown>;
  organisation: Record<string, unknown>;
  categories: Array<Record<string, unknown>>;
  team: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  requirements: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  campaigns: Array<Record<string, unknown>>;
  content: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  emailQueue: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  shotItems: Array<Record<string, unknown>>;
  equipmentItems: Array<Record<string, unknown>>;
  comments: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
};

const STORE_KEY = "project-workspace-preview-data-v1";
const SESSION_KEY = "project-workspace-preview-session";

function id() {
  return crypto.randomUUID();
}

function initialStore(): PreviewStore {
  const actor = {
    id: "preview-admin",
    username: "admin",
    email: "",
    emailNotifications: 0,
    mustChangeCredentials: 1,
    fullName: "Administrator",
    initials: "AD",
    role: "Administrator",
    department: "Administration",
    avatarColour: "#2563EB",
    active: 1,
  };
  const categoryNames = [
    ["Project kickoff", "#2563EB"],
    ["Meeting", "#0F766E"],
    ["Deadline", "#DC2626"],
    ["Review", "#7C3AED"],
    ["Presentation", "#0891B2"],
    ["Launch", "#EA580C"],
    ["Client session", "#B45309"],
    ["Workshop", "#4F46E5"],
    ["Training", "#047857"],
    ["Research", "#475569"],
    ["Operations", "#334155"],
    ["Marketing", "#BE185D"],
    ["Other", "#68736F"],
  ];
  return {
    userPassword: "Admin@123",
    emailDelivery: {
      configured: false,
      enabled: false,
      smtpHost: "smtp.hostinger.com",
      smtpPort: 465,
      encryption: "ssl",
      smtpUsername: "",
      fromAddress: "",
      replyToAddress: "",
      appUrl: location.origin,
      lastTestAt: null,
      lastTestRecipient: null,
    },
    actor,
    organisation: {
      id: "preview-workspace",
      name: "My Workspace",
      productName: "Project Workspace",
      timezone: "UTC",
      language: "en",
      primaryColour: "#2563EB",
      accentColour: "#14B8A6",
      logoVersion: "bundled-v1",
      settings: {
        weekStartsOn: "Monday",
        timeFormat: "24-hour",
        reminderTimes: [
          "3 days · 10:00",
          "2 days · 10:00",
          "1 day · 10:00",
          "Due day · 08:00",
        ],
      },
    },
    categories: categoryNames.map(([name, colour], index) => ({
      id: `preview-category-${index + 1}`,
      name,
      colour,
      sortOrder: index + 1,
    })),
    team: [actor],
    events: [],
    assignments: [],
    requirements: [],
    tasks: [],
    campaigns: [],
    content: [],
    notifications: [],
    emailQueue: [],
    reminders: [],
    shotItems: [],
    equipmentItems: [],
    comments: [],
    media: [],
    activity: [],
  };
}

function readStore(): PreviewStore {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (!saved) return initialStore();
    const store = JSON.parse(saved) as PreviewStore;
    store.emailQueue ??= [];
    store.reminders ??= [];
    return store;
  } catch {
    return initialStore();
  }
}

function saveStore(store: PreviewStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type PreviewRequestBody = Record<string, unknown> & {
  currentPassword?: string;
  dueAt?: string;
  newPassword?: string;
  publishAt?: string;
  requirements?: Record<string, number | undefined> & {
    photography?: number;
    video?: number;
  };
  smtpPassword?: string;
};

function bodyOf(init?: RequestInit): PreviewRequestBody {
  try {
    return init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function memberById(store: PreviewStore, memberId?: unknown) {
  return store.team.find((item) => item.id === memberId);
}

function eventById(store: PreviewStore, eventId?: unknown) {
  return store.events.find((item) => item.id === eventId);
}

function bootstrap(store: PreviewStore) {
  return {
    csrfToken: "preview-csrf",
    actor: store.actor,
    organisation: store.organisation,
    categories: store.categories,
    team: store.team,
    events: store.events
      .map((event) => {
        const category = store.categories.find((item) => item.id === event.categoryId);
        return {
          ...event,
          category: category?.name || "Other",
          categoryColour: category?.colour || "#68736F",
          ownerName: memberById(store, event.ownerId)?.fullName || "Unassigned",
        };
      })
      .sort((a, b) =>
        String((a as Record<string, unknown>).startsAt).localeCompare(
          String((b as Record<string, unknown>).startsAt),
        ),
      ),
    assignments: store.assignments.map((assignment) => ({
      ...assignment,
      ...(memberById(store, assignment.memberId) || {
        fullName: "Former member",
        initials: "FM",
        avatarColour: "#68736F",
        role: "Member",
      }),
    })),
    requirements: store.requirements,
    tasks: store.tasks.map((task) => ({
      ...task,
      eventTitle: eventById(store, task.eventId)?.title || null,
      assigneeName: memberById(store, task.assigneeId)?.fullName || null,
      assigneeInitials: memberById(store, task.assigneeId)?.initials || null,
    })),
    campaigns: store.campaigns.map((campaign) => ({
      ...campaign,
      ownerName: memberById(store, campaign.ownerId)?.fullName || null,
    })),
    content: store.content.map((item) => ({
      ...item,
      assigneeName: memberById(store, item.assigneeId)?.fullName || null,
    })),
    notifications: store.notifications,
    shotItems: store.shotItems,
    equipmentItems: store.equipmentItems,
    comments: store.comments,
    media: store.media.map((item) => ({
      ...item,
      uploadedByName: memberById(store, item.uploadedBy)?.fullName || null,
    })),
    activity: store.activity,
    emailDelivery: store.emailDelivery,
    serverTime: new Date().toISOString(),
  };
}

function addActivity(store: PreviewStore, eventId: unknown, message: string) {
  store.activity.unshift({
    id: id(),
    eventId: eventId || null,
    memberId: store.actor.id,
    action: "preview.updated",
    message,
    createdAt: new Date().toISOString(),
    memberName: store.actor.fullName,
  });
}

export function installPreviewApi() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (!url.pathname.startsWith("/api/")) return nativeFetch(input, init);

    const route = url.pathname.replace(/^\/api\/?/, "");
    const method = String(init?.method || "GET").toUpperCase();
    const payload = bodyOf(init);
    const store = readStore();

    if (route === "health") return json({ ok: true, storage: true });
    if (route === "auth/setup" && method === "GET") {
      return json({
        initialSetupAvailable: Boolean(store.actor.mustChangeCredentials) && store.userPassword === "Admin@123",
        branding: {
          productName: store.organisation.productName,
          workspaceName: store.organisation.name,
          primaryColour: store.organisation.primaryColour,
          accentColour: store.organisation.accentColour,
          logoVersion: store.organisation.logoVersion,
        },
      });
    }
    if (route === "auth/login" && method === "POST") {
      if (
        [store.actor.username, store.actor.email]
          .map((value) => String(value || "").toLowerCase())
          .includes(String(payload.username || payload.email || "").toLowerCase())
        && payload.password === store.userPassword
      ) {
        sessionStorage.setItem(SESSION_KEY, "1");
        return json({ ok: true, actor: store.actor, csrfToken: "preview-csrf" });
      }
      return json({ error: "The username, email, or password is incorrect." }, 401);
    }
    if (route === "auth/logout" && method === "POST") {
      sessionStorage.removeItem(SESSION_KEY);
      return json({ ok: true });
    }
    if (!sessionStorage.getItem(SESSION_KEY)) {
      return json({ error: "Please sign in to continue." }, 401);
    }
    if (route === "bootstrap" && method === "GET") return json(bootstrap(store));
    if (route === "account/complete-setup" && method === "POST") {
      if (!store.actor.mustChangeCredentials) return json({ error: "Your account setup is already complete." }, 409);
      const fullName = String(payload.fullName || "").trim();
      const email = String(payload.email || "").trim().toLowerCase();
      const newPassword = String(payload.newPassword || "");
      if (!fullName || !email.includes("@") || newPassword.length < 12 || newPassword === "Admin@123") {
        return json({ error: "Enter your name, a valid email, and a new password of at least 12 characters." }, 400);
      }
      const initials = fullName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
      store.actor = { ...store.actor, username: email, email, emailNotifications: 1, mustChangeCredentials: 0, fullName, initials: initials || "AD" };
      store.team[0] = store.actor;
      store.userPassword = newPassword;
      if (String(payload.workspaceName || "").trim()) store.organisation.name = String(payload.workspaceName).trim();
      saveStore(store);
      return json({ ok: true, actor: store.actor, csrfToken: "preview-csrf-next" });
    }
    if (store.actor.mustChangeCredentials) return json({ error: "Complete the administrator setup before continuing." }, 428);

    if (route === "events" && method === "POST") {
      const eventId = id();
      const startsAt = new Date(`${payload.date}T${payload.time}:00Z`).toISOString();
      store.events.push({
        id: eventId,
        title: payload.title,
        description: payload.description || "",
        categoryId: payload.categoryId,
        startsAt,
        endsAt: null,
        arrivalAt: null,
        venue: payload.venue || "",
        opponent: payload.opponent || null,
        competition: null,
        homeAway: null,
        priority: payload.priority || "Normal",
        status: "Planned",
        readiness: "Needs attention",
        readinessReason: "New assignments need confirmation",
        ownerId: store.actor.id,
        campaignId: null,
        version: 1,
      });
      store.requirements.push({ eventId, ...(payload.requirements || {}) });
      store.assignments.push({
        id: id(),
        eventId,
        memberId: store.actor.id,
        responsibility: "Milestone owner",
        confirmationStatus: "Confirmed",
      });
      store.tasks.push({
        id: id(),
        eventId,
        campaignId: null,
        title: "Confirm milestone details",
        description: "",
        assigneeId: store.actor.id,
        assignedAt: new Date().toISOString(),
        dueAt: startsAt,
        priority: payload.priority || "Normal",
        status: "To do",
        approvalRequired: 0,
        version: 1,
      });
      if (payload.requirements?.photography || payload.requirements?.video) {
        ["Brief and scope confirmed", "Key work completed", "Final delivery link confirmed"].forEach((title, index) =>
          store.shotItems.push({
            id: id(), eventId, phase: index === 0 ? "Before" : index === 1 ? "During" : "After",
            title, mandatory: 1, completed: 0, notes: "", sortOrder: index + 1, version: 1,
          }),
        );
        ["Required files", "Access and permissions", "Tools and resources", "Stakeholder availability"].forEach((title, index) =>
          store.equipmentItems.push({ id: id(), eventId, title, confirmed: 0, notes: "", sortOrder: index + 1, version: 1 }),
        );
      }
      addActivity(store, eventId, `${store.actor.fullName} created “${payload.title}”.`);
      saveStore(store);
      return json({ ok: true, id: eventId }, 201);
    }

    if (route === "tasks" && method === "POST") {
      store.tasks.push({
        id: id(), eventId: payload.eventId || null, campaignId: null, title: payload.title,
        description: payload.description || "", assigneeId: payload.assigneeId || store.actor.id,
        assignedAt: new Date().toISOString(),
        dueAt: new Date(payload.dueAt || new Date().toISOString()).toISOString(), priority: payload.priority || "Normal",
        status: "To do", approvalRequired: 0, version: 1,
      });
      saveStore(store);
      return json({ ok: true }, 201);
    }
    if (route === "campaigns" && method === "POST") {
      store.campaigns.push({
        id: id(), title: payload.title, objective: payload.objective || "", startDate: payload.startDate,
        endDate: payload.endDate, ownerId: payload.ownerId || store.actor.id, audience: payload.audience,
        channels: payload.channels, status: "Planned", priority: payload.priority || "Normal", progress: 0,
      });
      saveStore(store);
      return json({ ok: true }, 201);
    }
    if (route === "content" && method === "POST") {
      store.content.push({
        id: id(), eventId: payload.eventId || null, campaignId: payload.campaignId || null,
        title: payload.title, platform: payload.platform, contentType: payload.contentType,
        publishAt: new Date(payload.publishAt || new Date().toISOString()).toISOString(), assigneeId: payload.assigneeId || store.actor.id,
        status: "Idea", approvalStatus: "Draft", assetUrl: payload.assetUrl || null,
      });
      saveStore(store);
      return json({ ok: true }, 201);
    }
    if (route === "media" && method === "POST") {
      store.media.push({
        id: id(), eventId: payload.eventId || null, campaignId: payload.campaignId || null,
        title: payload.title, kind: payload.kind, url: payload.url, tags: payload.tags || "",
        uploadedBy: store.actor.id, createdAt: new Date().toISOString(),
      });
      saveStore(store);
      return json({ ok: true }, 201);
    }
    if (route === "members" && method === "POST") {
      const initials = String(payload.fullName).split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
      store.team.push({
        id: id(), email: payload.email || "", emailNotifications: 1, fullName: payload.fullName, initials,
        role: payload.role, department: payload.department, avatarColour: "#49747B", active: 1,
      });
      saveStore(store);
      return json({ ok: true }, 201);
    }
    if (route === "comments" && method === "POST") {
      store.comments.unshift({
        id: id(), eventId: payload.eventId, memberId: store.actor.id, body: payload.body,
        important: 0, createdAt: new Date().toISOString(), memberName: store.actor.fullName,
        initials: store.actor.initials, avatarColour: store.actor.avatarColour,
      });
      saveStore(store);
      return json({ ok: true }, 201);
    }
    if (route === "notifications/read" && method === "POST") {
      store.notifications = store.notifications.map((item) => ({ ...item, readAt: new Date().toISOString() }));
      saveStore(store);
      return json({ ok: true });
    }
    if (route === "settings" && method === "PATCH") {
      store.organisation = { ...store.organisation, ...payload };
      saveStore(store);
      return json({ ok: true });
    }
    if (route === "branding/logo" && method === "POST") {
      if (store.actor.role !== "Administrator") {
        return json({ error: "Your role does not allow this action." }, 403);
      }
      if (!["colour", "black", "white"].includes(String(payload.variant))) {
        return json({ error: "Choose the colour, black, or white logo slot." }, 400);
      }
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(String(payload.image || ""))) {
        return json({ error: "Choose a PNG, JPG, or WebP logo." }, 400);
      }
      store.organisation.logoVersion = new Date().toISOString();
      saveStore(store);
      return json({ ok: true, variant: payload.variant });
    }
    if (route === "account/notifications" && method === "PATCH") {
      store.actor.emailNotifications = payload.emailNotifications ? 1 : 0;
      const actorIndex = store.team.findIndex((member) => member.id === store.actor.id);
      if (actorIndex >= 0) {
        store.team[actorIndex] = { ...store.team[actorIndex], emailNotifications: store.actor.emailNotifications };
      }
      saveStore(store);
      return json({ ok: true });
    }
    if (route === "email/config" && method === "PATCH") {
      if (!payload.smtpPassword && !store.emailDelivery.configured) {
        return json({ error: "Enter the mailbox password." }, 400);
      }
      store.emailDelivery = {
        ...store.emailDelivery,
        ...payload,
        smtpPassword: undefined,
        configured: true,
        enabled: true,
      };
      saveStore(store);
      return json({ ok: true, emailDelivery: store.emailDelivery });
    }
    if (route === "email/test" && method === "POST") {
      if (!store.emailDelivery.configured) {
        return json({ error: "Save and enable the mailbox before sending a test." }, 400);
      }
      store.emailDelivery = {
        ...store.emailDelivery,
        lastTestAt: new Date().toISOString(),
        lastTestRecipient: store.actor.email,
      };
      saveStore(store);
      return json({ ok: true, sentTo: store.actor.email });
    }
    if (route === "account/password" && method === "POST") {
      if (payload.currentPassword !== store.userPassword) return json({ error: "The current password is incorrect." }, 403);
      store.userPassword = payload.newPassword || store.userPassword;
      saveStore(store);
      return json({ ok: true, csrfToken: "preview-csrf-next" });
    }

    const parts = route.split("/");
    const entity = parts[0];
    const entityId = parts[1];
    const action = parts[2];

    if (entity === "members" && entityId) {
      if (store.actor.role !== "Administrator") {
        return json({ error: "Your role does not allow this action." }, 403);
      }
      const index = store.team.findIndex((member) => member.id === entityId);
      if (index < 0) return json({ error: "This team member is no longer available." }, 404);
      if (method === "PATCH") {
        const email = String(payload.email || store.team[index].email || "").toLowerCase().trim();
        if (!email.includes("@")) return json({ error: "Enter a valid email address." }, 400);
        if (store.team.some((member, memberIndex) => memberIndex !== index && String(member.email).toLowerCase() === email)) {
          return json({ error: "That email address is already linked to another account." }, 400);
        }
        const fullName = String(payload.fullName || store.team[index].fullName || "").trim();
        const initials = fullName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
        store.team[index] = {
          ...store.team[index],
          ...payload,
          email,
          fullName,
          initials: initials || "TM",
        };
        if (entityId === store.actor.id) store.actor = { ...store.actor, ...store.team[index] };
        addActivity(store, null, `${store.actor.fullName} updated ${fullName}’s account.`);
        saveStore(store);
        return json({ ok: true });
      }
      if (method === "DELETE") {
        if (entityId === store.actor.id) {
          return json({ error: "You cannot delete the account you are currently using." }, 400);
        }
        const memberName = String(store.team[index].fullName || "Team member");
        const counts = {
          events: 0,
          assignments: store.assignments.filter((item) => item.memberId === entityId).length,
          tasks: 0,
          campaigns: 0,
          content: 0,
          shotItems: 0,
        };
        const affectedEvents = new Set(
          store.assignments.filter((item) => item.memberId === entityId).map((item) => item.eventId),
        );
        store.assignments = store.assignments.filter((item) => item.memberId !== entityId);
        store.events = store.events.map((event) => {
          const wasOwner = event.ownerId === entityId;
          if (wasOwner) counts.events += 1;
          if (!wasOwner && !affectedEvents.has(event.id)) return event;
          return {
            ...event,
            ownerId: wasOwner ? null : event.ownerId,
            readiness: "Needs attention",
            readinessReason: "A team member was removed. Review ownership and requirements.",
          };
        });
        for (const [collection, field] of [
          ["tasks", "assigneeId"],
          ["campaigns", "ownerId"],
          ["content", "assigneeId"],
          ["shotItems", "assigneeId"],
        ] as const) {
          store[collection] = store[collection].map((item) => {
            if (item[field] !== entityId) return item;
            counts[collection] += 1;
            return { ...item, [field]: null };
          });
        }
        store.notifications = store.notifications.filter((item) => item.memberId !== entityId);
        store.team.splice(index, 1);
        addActivity(store, null, `${store.actor.fullName} removed ${memberName}. Their active work is now unassigned.`);
        saveStore(store);
        return json({ ok: true, unassigned: counts });
      }
    }

    if (entity === "tasks" && entityId) {
      const index = store.tasks.findIndex((item) => item.id === entityId);
      if (method === "DELETE") {
        store.tasks.splice(index, 1);
        store.notifications = store.notifications.filter((item) => item.taskId !== entityId);
        store.emailQueue = store.emailQueue.filter((item) => item.taskId !== entityId);
        store.reminders = store.reminders.filter((item) => item.taskId !== entityId);
      }
      else {
        const assigneeChanged = payload.assigneeId !== undefined && payload.assigneeId !== store.tasks[index].assigneeId;
        store.tasks[index] = {
          ...store.tasks[index],
          ...payload,
          ...(assigneeChanged ? { assignedAt: new Date().toISOString() } : {}),
          version: Number(store.tasks[index].version || 1) + 1,
        };
      }
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "campaigns" && entityId) {
      const index = store.campaigns.findIndex((item) => item.id === entityId);
      if (method === "DELETE") {
        store.campaigns.splice(index, 1);
        const taskIds = new Set(store.tasks.filter((item) => item.campaignId === entityId).map((item) => item.id));
        store.tasks = store.tasks.filter((item) => item.campaignId !== entityId);
        store.content = store.content.filter((item) => item.campaignId !== entityId);
        store.media = store.media.filter((item) => item.campaignId !== entityId);
        store.notifications = store.notifications.filter((item) => !taskIds.has(item.taskId));
        store.emailQueue = store.emailQueue.filter((item) => !taskIds.has(item.taskId));
        store.reminders = store.reminders.filter((item) => !taskIds.has(item.taskId));
        store.events = store.events.map((item) => item.campaignId === entityId ? { ...item, campaignId: null } : item);
      } else store.campaigns[index] = { ...store.campaigns[index], ...payload };
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "media" && entityId && method === "DELETE") {
      store.media = store.media.filter((item) => item.id !== entityId);
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "categories" && entityId && method === "PATCH") {
      const index = store.categories.findIndex((item) => item.id === entityId);
      store.categories[index] = { ...store.categories[index], ...payload };
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "shot-items" && entityId && method === "PATCH") {
      const index = store.shotItems.findIndex((item) => item.id === entityId);
      store.shotItems[index] = { ...store.shotItems[index], ...payload };
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "equipment-items" && entityId && method === "PATCH") {
      const index = store.equipmentItems.findIndex((item) => item.id === entityId);
      store.equipmentItems[index] = { ...store.equipmentItems[index], ...payload };
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "events" && entityId && action === "coverage" && method === "PATCH") {
      const index = store.requirements.findIndex((item) => item.eventId === entityId);
      const record = { eventId: entityId, ...payload };
      if (index >= 0) store.requirements[index] = record;
      else store.requirements.push(record);
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "events" && entityId && action === "assignments" && method === "POST") {
      store.assignments.push({
        id: id(), eventId: entityId, memberId: payload.memberId,
        responsibility: payload.responsibility, confirmationStatus: "Assigned",
      });
      saveStore(store);
      return json({ ok: true }, 201);
    }
    if (entity === "events" && entityId && action === "attendance" && method === "POST") {
      const index = store.assignments.findIndex((item) => item.eventId === entityId && item.memberId === store.actor.id);
      if (index >= 0) store.assignments[index] = { ...store.assignments[index], confirmationStatus: payload.status };
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "events" && entityId && action === "reschedule" && method === "POST") {
      const index = store.events.findIndex((item) => item.id === entityId);
      store.events[index] = { ...store.events[index], startsAt: new Date(`${payload.date}T${payload.time}:00+03:00`).toISOString() };
      saveStore(store);
      return json({ ok: true });
    }
    if (entity === "events" && entityId) {
      const index = store.events.findIndex((item) => item.id === entityId);
      if (method === "DELETE") {
        store.events.splice(index, 1);
        for (const key of ["assignments", "requirements", "tasks", "content", "notifications", "emailQueue", "reminders", "shotItems", "equipmentItems", "comments", "media"] as const) {
          store[key] = store[key].filter((item) => item.eventId !== entityId) as never;
        }
      } else store.events[index] = { ...store.events[index], ...payload };
      saveStore(store);
      return json({ ok: true });
    }

    return json({ error: `Preview route not implemented: ${method} ${route}` }, 404);
  };
}
