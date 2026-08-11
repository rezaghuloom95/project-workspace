"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Id = string;

type Organisation = {
  id: Id;
  name: string;
  productName?: string;
  timezone: string;
  language: string;
  primaryColour: string;
  accentColour: string;
  logoVersion?: string;
  settings: {
    weekStartsOn?: string;
    timeFormat?: string;
    reminderTimes?: string[];
  };
};

type Member = {
  id: Id;
  organisationId?: Id;
  email?: string;
  emailNotifications?: number;
  fullName: string;
  initials: string;
  role: string;
  department: string;
  avatarColour: string;
  active?: number;
  mustChangeCredentials?: number;
};

type EmailDelivery = {
  configured: boolean;
  enabled: boolean;
  smtpHost: string;
  smtpPort?: number;
  encryption?: string;
  smtpUsername: string;
  fromAddress: string;
  replyToAddress: string;
  appUrl: string;
  lastTestAt?: string | null;
  lastTestRecipient?: string | null;
};

type Category = {
  id: Id;
  name: string;
  colour: string;
  sortOrder: number;
};

type PlannerEvent = {
  id: Id;
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  arrivalAt?: string | null;
  venue: string;
  opponent?: string | null;
  competition?: string | null;
  homeAway?: string | null;
  priority: string;
  status: string;
  readiness: string;
  readinessReason: string;
  ownerId?: Id | null;
  ownerName?: string;
  campaignId?: Id | null;
  version: number;
  categoryId: Id;
  category: string;
  categoryColour: string;
};

type Assignment = {
  id: Id;
  eventId: Id;
  memberId: Id;
  responsibility: string;
  confirmationStatus: string;
  requiredArrivalAt?: string | null;
  fullName: string;
  initials: string;
  avatarColour: string;
  role: string;
};

type Requirement = {
  eventId: Id;
  photography: number;
  video: number;
  social: number;
  graphicDesign: number;
  liveUpdates: number;
  interview: number;
  sponsorCoverage: number;
};

type Task = {
  id: Id;
  eventId?: Id | null;
  eventTitle?: string | null;
  campaignId?: Id | null;
  title: string;
  description: string;
  assigneeId?: Id | null;
  assigneeName?: string | null;
  assigneeInitials?: string | null;
  dueAt: string;
  priority: string;
  status: string;
  approvalRequired: number;
  version: number;
};

type Campaign = {
  id: Id;
  title: string;
  objective: string;
  startDate: string;
  endDate: string;
  ownerId?: Id | null;
  ownerName?: string | null;
  audience: string;
  channels: string;
  status: string;
  priority: string;
  progress: number;
};

type ContentItem = {
  id: Id;
  eventId?: Id | null;
  campaignId?: Id | null;
  assigneeId?: Id | null;
  title: string;
  platform: string;
  contentType: string;
  publishAt: string;
  assigneeName?: string;
  status: string;
  approvalStatus: string;
  assetUrl?: string | null;
};

type PlannerNotification = {
  id: Id;
  eventId?: Id | null;
  title: string;
  message: string;
  kind: string;
  readAt?: string | null;
  createdAt: string;
};

type ShotItem = {
  id: Id;
  eventId: Id;
  phase: string;
  title: string;
  mandatory: number;
  completed: number;
  assigneeId?: Id | null;
  notes: string;
  sortOrder: number;
  version: number;
};

type EquipmentItem = {
  id: Id;
  eventId: Id;
  title: string;
  confirmed: number;
  notes: string;
  sortOrder: number;
  version: number;
};

type Comment = {
  id: Id;
  eventId: Id;
  memberId: Id;
  body: string;
  important: number;
  createdAt: string;
  memberName: string;
  initials: string;
  avatarColour: string;
};

type MediaItem = {
  id: Id;
  eventId?: Id | null;
  campaignId?: Id | null;
  title: string;
  kind: string;
  url: string;
  tags: string;
  uploadedByName?: string;
  createdAt: string;
};

type Activity = {
  id: Id;
  eventId?: Id | null;
  memberId: Id;
  action: string;
  message: string;
  createdAt: string;
  memberName?: string;
};

type PlannerData = {
  csrfToken: string;
  actor: Member;
  organisation: Organisation;
  categories: Category[];
  team: Member[];
  events: PlannerEvent[];
  assignments: Assignment[];
  requirements: Requirement[];
  tasks: Task[];
  campaigns: Campaign[];
  content: ContentItem[];
  notifications: PlannerNotification[];
  shotItems: ShotItem[];
  equipmentItems: EquipmentItem[];
  comments: Comment[];
  media: MediaItem[];
  activity: Activity[];
  emailDelivery: EmailDelivery;
  serverTime: string;
};

type ViewName =
  | "Dashboard"
  | "Calendar"
  | "Milestones"
  | "Tasks"
  | "Projects"
  | "Links"
  | "Notifications"
  | "Reports"
  | "Team"
  | "Settings";

type PendingMutation = {
  key: string;
  url: string;
  method: "POST" | "PATCH" | "DELETE";
  body: unknown;
  createdAt: string;
};

type CreateKind = "event" | "task" | "campaign" | "content" | "media" | "member";
type LogoVariant = "colour" | "black" | "white";

const LOGO_VARIANTS: Array<{
  id: LogoVariant;
  label: string;
  use: string;
  preview: "light" | "dark";
}> = [
  {
    id: "colour",
    label: "Colour logo",
    use: "Primary brand mark for light surfaces",
    preview: "light",
  },
  {
    id: "black",
    label: "Black logo",
    use: "Single-colour mark for light surfaces",
    preview: "light",
  },
  {
    id: "white",
    label: "White logo",
    use: "Reversed mark for dark surfaces and email",
    preview: "dark",
  },
];

type Mutate = (
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  options?: { canQueue?: boolean; success?: string },
) => Promise<unknown>;

const COPY = {
  en: {
    appName: "Project Workspace",
    workspace: "Team workspace",
    quickAdd: "Quick add",
    search: "Search milestones, tasks, and projects…",
    today: "Today",
    upcoming: "Upcoming",
    myTasks: "My focus",
    attention: "Needs attention",
    weekly: "This week",
    live: "Live",
    offline: "Offline",
    syncWaiting: "changes waiting to sync",
    allCaughtUp: "All caught up",
  },
};

type IconName =
  | "home" | "calendar" | "events" | "check" | "campaign" | "link"
  | "bell" | "chart" | "users" | "settings" | "plus" | "more"
  | "logout" | "menu" | "search" | "close" | "alert" | "sun"
  | "clock" | "location" | "user" | "arrow-right" | "circle" | "edit" | "trash";

const NAV_ITEMS: Array<{ label: ViewName; icon: IconName }> = [
  { label: "Dashboard", icon: "home" },
  { label: "Calendar", icon: "calendar" },
  { label: "Milestones", icon: "events" },
  { label: "Tasks", icon: "check" },
  { label: "Projects", icon: "campaign" },
  { label: "Links", icon: "link" },
  { label: "Notifications", icon: "bell" },
  { label: "Reports", icon: "chart" },
  { label: "Team", icon: "users" },
  { label: "Settings", icon: "settings" },
];

const MOBILE_NAV: Array<{ label: ViewName; short: string; icon: IconName }> = [
  { label: "Dashboard", short: "Home", icon: "home" },
  { label: "Calendar", short: "Calendar", icon: "calendar" },
  { label: "Milestones", short: "Add", icon: "plus" },
  { label: "Tasks", short: "Tasks", icon: "check" },
  { label: "Settings", short: "More", icon: "more" },
];

const COVERAGE_LABELS: Array<[keyof Requirement, string]> = [
  ["photography", "Planning"],
  ["video", "Documentation"],
  ["social", "Communication"],
  ["graphicDesign", "Design"],
  ["liveUpdates", "Progress tracking"],
  ["interview", "Stakeholder review"],
  ["sponsorCoverage", "Final approval"],
];

let ACTIVE_TIME_ZONE = "UTC";

const SESSION_BOOT_MS = Date.now();

function dateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACTIVE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: ACTIVE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: ACTIVE_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatFullDate(value: string | Date) {
  return new Intl.DateTimeFormat("en", {
    timeZone: ACTIVE_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function relativeDay(value: string) {
  const nowKey = dateKey(new Date());
  const targetKey = dateKey(value);
  const start = new Date(`${nowKey}T00:00:00Z`).getTime();
  const target = new Date(`${targetKey}T00:00:00Z`).getTime();
  const days = Math.round((target - start) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === 2) return "In two days";
  if (days === 3) return "In three days";
  if (days < 7 && days > 0) return `In ${days} days`;
  return formatDate(value);
}

function countdown(value: string) {
  const difference = new Date(value).getTime() - Date.now();
  if (difference <= 0) return "Now";
  const hours = Math.floor(difference / 3_600_000);
  if (hours < 24) return `${hours}h ${Math.floor((difference % 3_600_000) / 60_000)}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function toneFor(status: string) {
  const value = status.toLowerCase();
  if (
    value.includes("complete") ||
    value.includes("ready") ||
    value.includes("approved") ||
    value.includes("confirmed") ||
    value.includes("published")
  )
    return "success";
  if (
    value.includes("attention") ||
    value.includes("warning") ||
    value.includes("waiting") ||
    value.includes("review") ||
    value.includes("assigned")
  )
    return "warning";
  if (
    value.includes("overdue") ||
    value.includes("cancel") ||
    value.includes("changes") ||
    value.includes("not prepared") ||
    value.includes("unable")
  )
    return "danger";
  if (value.includes("progress") || value.includes("active") || value.includes("arrived"))
    return "info";
  return "neutral";
}

function mutationId() {
  return crypto.randomUUID();
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The selected logo could not be read."));
    reader.onerror = () => reject(new Error("The selected logo could not be read."));
    reader.readAsDataURL(file);
  });
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ClubPlanner() {
  const t = COPY.en;
  const [data, setData] = useState<PlannerData | null>(null);
  const [activeView, setActiveView] = useState<ViewName>("Dashboard");
  const [selectedEventId, setSelectedEventId] = useState<Id | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [rescheduleEventId, setRescheduleEventId] = useState<Id | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const csrfRef = useRef("");

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/bootstrap", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        setData(null);
        setAuthRequired(true);
        setError(null);
        return;
      }
      if (!response.ok) throw new Error("The project workspace could not be loaded.");
      const payload = (await response.json()) as PlannerData;
      ACTIVE_TIME_ZONE = payload.organisation.timezone || "UTC";
      csrfRef.current = payload.csrfToken;
      setData(payload);
      setAuthRequired(false);
      setError(null);
    } catch {
      if (!quiet) setError("The project workspace could not be loaded. Check your connection and try again.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(readPendingMutations().length);
  }, []);

  const replayPending = useCallback(async () => {
    const pending = readPendingMutations();
    if (!pending.length || !navigator.onLine) {
      refreshPendingCount();
      return;
    }
    const remaining: PendingMutation[] = [];
    for (const [index, mutation] of pending.entries()) {
      try {
        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": mutation.key,
            "x-csrf-token": csrfRef.current,
          },
          body: JSON.stringify(mutation.body),
          credentials: "same-origin",
        });
        if (response.status === 401) {
          remaining.push(...pending.slice(index));
          setData(null);
          setAuthRequired(true);
          break;
        }
        if (!response.ok) remaining.push(mutation);
      } catch {
        remaining.push(mutation);
      }
    }
    writePendingMutations(remaining);
    refreshPendingCount();
    if (remaining.length < pending.length) {
      await loadData(true);
      channelRef.current?.postMessage("refresh");
      showToast("Offline changes are synced.");
    }
  }, [loadData, refreshPendingCount, showToast]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadData();
      refreshPendingCount();
    }, 0);
    if ("serviceWorker" in navigator) {
      const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (isLocalPreview) {
        void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames
                .filter((name) => name.startsWith("project-workspace-"))
                .map((name) => caches.delete(name)),
            );
          }
        });
      } else {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    }
    if ("BroadcastChannel" in window) {
      channelRef.current = new BroadcastChannel("project-workspace-live");
      channelRef.current.onmessage = () => loadData(true);
    }
    const online = () => {
      setIsOnline(true);
      replayPending();
    };
    const offline = () => setIsOnline(false);
    const visibility = () => {
      if (document.visibilityState === "visible") loadData(true);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(() => {
      if (navigator.onLine) loadData(true);
    }, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(interval);
      channelRef.current?.close();
    };
  }, [loadData, refreshPendingCount, replayPending]);

  const mutate = useCallback(
    async (
      url: string,
      method: "POST" | "PATCH" | "DELETE",
      body: unknown,
      options: { canQueue?: boolean; success?: string } = {},
    ) => {
      const key = mutationId();
      if (!navigator.onLine && options.canQueue) {
        const pending = readPendingMutations();
        pending.push({ key, url, method, body, createdAt: new Date().toISOString() });
        writePendingMutations(pending);
        refreshPendingCount();
        showToast("Saved offline. It will sync when you reconnect.");
        return { queued: true };
      }
      try {
        const response = await fetch(url, {
          method,
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": key,
            "x-csrf-token": csrfRef.current,
          },
          body: JSON.stringify(body),
          credentials: "same-origin",
        });
        const payload = (await response.json()) as { error?: string };
        if (response.status === 401) {
          setData(null);
          setAuthRequired(true);
          const authError = new Error("Your session expired. Sign in again.");
          authError.name = "AuthenticationError";
          throw authError;
        }
        if (!response.ok) throw new Error(payload.error || "The change could not be saved.");
        await loadData(true);
        channelRef.current?.postMessage("refresh");
        if (options.success) showToast(options.success);
        return payload;
      } catch (mutationError) {
        if (
          options.canQueue &&
          mutationError instanceof TypeError
        ) {
          const pending = readPendingMutations();
          pending.push({ key, url, method, body, createdAt: new Date().toISOString() });
          writePendingMutations(pending);
          refreshPendingCount();
          showToast("Connection dropped. Your change is waiting to sync.");
          return { queued: true };
        }
        showToast(
          mutationError instanceof Error
            ? mutationError.message
            : "The change could not be saved.",
        );
        throw mutationError;
      }
    },
    [loadData, refreshPendingCount, showToast],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setData(null);
      setAuthRequired(true);
      setActiveView("Dashboard");
      setSelectedEventId(null);
      setQuickAddOpen(false);
      setCreateKind(null);
      setSidebarOpen(false);
      setSearch("");
      setLoading(false);
    }
  }, []);

  const updateTask = useCallback(
    async (task: Task, status: string) => {
      setData((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((item) =>
                item.id === task.id ? { ...item, status } : item,
              ),
            }
          : current,
      );
      await mutate(`/api/tasks/${task.id}`, "PATCH", { status }, {
        canQueue: true,
        success: status === "Completed" ? "Task completed." : "Task updated.",
      });
    },
    [mutate],
  );

  const updateShot = useCallback(
    async (item: ShotItem, completed: boolean) => {
      setData((current) =>
        current
          ? {
              ...current,
              shotItems: current.shotItems.map((shot) =>
                shot.id === item.id ? { ...shot, completed: Number(completed) } : shot,
              ),
            }
          : current,
      );
      await mutate(
        `/api/shot-items/${item.id}`,
        "PATCH",
        { completed, notes: item.notes },
        { canQueue: true, success: completed ? "Shot marked complete." : "Shot reopened." },
      );
    },
    [mutate],
  );

  const selectView = (view: ViewName) => {
    if (view === "Milestones" && window.innerWidth < 760) {
      setQuickAddOpen(true);
      return;
    }
    setActiveView(view);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searchResults = useMemo(() => {
    if (!data || search.trim().length < 2) return [];
    const query = search.toLowerCase();
    const results: Array<{
      id: string;
      type: string;
      title: string;
      detail: string;
      eventId?: string;
      view: ViewName;
    }> = [];
    data.events
      .filter((item) =>
        [item.title, item.opponent, item.venue, item.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
      .slice(0, 5)
      .forEach((item) =>
        results.push({
          id: item.id,
          type: "Milestone",
          title: item.title,
          detail: `${formatDate(item.startsAt)} · ${item.status}`,
          eventId: item.id,
          view: "Milestones",
        }),
      );
    data.tasks
      .filter((item) => item.title.toLowerCase().includes(query))
      .slice(0, 4)
      .forEach((item) =>
        results.push({
          id: item.id,
          type: "Task",
          title: item.title,
          detail: `${item.eventTitle || "Independent task"} · ${item.status}`,
          eventId: item.eventId || undefined,
          view: "Tasks",
        }),
      );
    data.campaigns
      .filter((item) => item.title.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach((item) =>
        results.push({
          id: item.id,
          type: "Project",
          title: item.title,
          detail: `${item.status} · ${item.progress}% complete`,
          view: "Projects",
        }),
      );
    return results.slice(0, 10);
  }, [data, search]);

  if (loading) {
    return <PlannerLoading />;
  }

  if (authRequired) {
    return (
      <LoginView
        onSignedIn={() => {
          window.scrollTo({ top: 0 });
          return loadData();
        }}
      />
    );
  }

  if (error || !data) {
    return (
      <main className="error-state">
        <BrandMark />
        <h1>We could not open the project workspace</h1>
        <p>{error}</p>
        <button className="button primary" onClick={() => loadData()}>
          Try again
        </button>
      </main>
    );
  }

  if (data.actor.mustChangeCredentials) {
    return (
      <FirstTimeSetupView
        csrfToken={data.csrfToken}
        onComplete={() => loadData()}
      />
    );
  }

  const unread = data.notifications.filter((notification) => !notification.readAt).length;
  const canPlan = allowedCreateKinds(data.actor.role).length > 0;
  const canCreateEvents = EVENT_MANAGER_ROLES.includes(data.actor.role);
  const selectedEvent = data.events.find((event) => event.id === selectedEventId) ?? null;
  const primaryStyle = {
    "--club-primary": data.organisation.primaryColour,
    "--club-accent": data.organisation.accentColour,
  } as React.CSSProperties;

  return (
    <div className="planner-shell" style={primaryStyle}>
      <a className="skip-link" href="#planner-main">
        Skip to planner
      </a>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <BrandMark variant="white" version={data.organisation.logoVersion} />
          <div>
            <strong>{data.organisation.productName || t.appName}</strong>
            <span>{data.organisation.name}</span>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={activeView === item.label ? "active" : ""}
              onClick={() => selectView(item.label)}
              aria-current={activeView === item.label ? "page" : undefined}
            >
              <span className="nav-glyph" aria-hidden="true">
                <Icon name={item.icon} />
              </span>
              <span>{item.label}</span>
              {item.label === "Notifications" && unread > 0 ? (
                <small>{unread}</small>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="profile-chip">
            <Avatar member={data.actor} size="medium" />
            <div>
              <strong>{data.actor.fullName}</strong>
              <span>{data.actor.role}</span>
            </div>
            <button
              className="profile-logout"
              onClick={logout}
              title="Log out"
              aria-label="Log out"
            >
              <Icon name="logout" />
            </button>
          </div>
          <div className={`connection-pill ${isOnline ? "online" : "offline"}`}>
            <span />
            {isOnline ? t.live : t.offline}
            {pendingCount > 0 ? ` · ${pendingCount} ${t.syncWaiting}` : ""}
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <div className="planner-workspace">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>
          <div className="global-search">
            <span aria-hidden="true"><Icon name="search" /></span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.search}
              aria-label="Search the project workspace"
            />
            <kbd>⌘ K</kbd>
            {search ? (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                ×
              </button>
            ) : null}
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button notification-button"
              onClick={() => setActiveView("Notifications")}
              aria-label={`${unread} unread notifications`}
            >
              <Icon name="bell" />
              {unread > 0 ? <span>{unread}</span> : null}
            </button>
            {canPlan ? (
              <button className="button primary quick-add" onClick={() => setQuickAddOpen(true)}>
                <span aria-hidden="true"><Icon name="plus" /></span>
                {t.quickAdd}
              </button>
            ) : null}
          </div>

          {searchResults.length ? (
            <div className="search-results" role="dialog" aria-label="Search results">
              <div className="search-results-heading">
                <span>Quick results</span>
                <small>{searchResults.length} found</small>
              </div>
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    setActiveView(result.view);
                    if (result.eventId) setSelectedEventId(result.eventId);
                    setSearch("");
                  }}
                >
                  <span className="search-type">{result.type.slice(0, 1)}</span>
                  <span>
                    <strong>{result.title}</strong>
                    <small>{result.detail}</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {!isOnline || pendingCount > 0 ? (
          <div className="sync-banner">
            <span className={isOnline ? "syncing" : ""}>{isOnline ? "↻" : "!"}</span>
            <p>
              {isOnline
                ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync.`
                : "You are offline. Important project details remain available and your changes will sync later."}
            </p>
            {isOnline ? <button onClick={replayPending}>Sync now</button> : null}
          </div>
        ) : null}

        <main id="planner-main" className="planner-main">
          {activeView === "Dashboard" ? (
            <DashboardView
              data={data}
              onSelectEvent={setSelectedEventId}
              onUpdateTask={updateTask}
              onQuickAdd={() => setQuickAddOpen(true)}
              onNavigate={setActiveView}
              canCreate={canCreateEvents}
            />
          ) : null}
          {activeView === "Calendar" ? (
            <CalendarView data={data} onSelectEvent={setSelectedEventId} />
          ) : null}
          {activeView === "Milestones" ? (
            <EventsView
              data={data}
              onSelectEvent={setSelectedEventId}
              onCreate={() => setCreateKind("event")}
            />
          ) : null}
          {activeView === "Tasks" ? (
            <TasksView
              data={data}
              mutate={mutate}
              onUpdateTask={updateTask}
              onSelectEvent={setSelectedEventId}
              onCreate={() => setCreateKind("task")}
            />
          ) : null}
          {activeView === "Projects" ? (
            <CampaignsView
              data={data}
              mutate={mutate}
              onCreate={setCreateKind}
            />
          ) : null}
          {activeView === "Links" ? (
            <MediaView
              data={data}
              mutate={mutate}
              onCreate={() => setCreateKind("media")}
            />
          ) : null}
          {activeView === "Notifications" ? (
            <NotificationsView
              data={data}
              onSelectEvent={setSelectedEventId}
              onMarkRead={async () => {
                await mutate("/api/notifications/read", "POST", {}, {
                  success: "Notifications marked as read.",
                });
              }}
            />
          ) : null}
          {activeView === "Reports" ? <ReportsView data={data} /> : null}
          {activeView === "Team" ? (
            <TeamView
              data={data}
              mutate={mutate}
              onCreate={() => setCreateKind("member")}
            />
          ) : null}
          {activeView === "Settings" ? (
            <SettingsView data={data} mutate={mutate} />
          ) : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {MOBILE_NAV.map((item) => (
          <button
            key={item.short}
            className={`${activeView === item.label ? "active" : ""} ${
              item.short === "Add" ? "mobile-add" : ""
            }`}
            onClick={() =>
              item.short === "Add" && canPlan
                ? setQuickAddOpen(true)
                : selectView(item.short === "Add" ? "Milestones" : item.label)
            }
          >
            <span aria-hidden="true"><Icon name={item.icon} /></span>
            <small>{item.short}</small>
          </button>
        ))}
      </nav>

      {selectedEvent ? (
        <EventDetail
          data={data}
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onUpdateTask={updateTask}
          onUpdateShot={updateShot}
          onMutate={mutate}
          onReschedule={() => setRescheduleEventId(selectedEvent.id)}
        />
      ) : null}

      {quickAddOpen ? (
        <CreateMenuModal
          role={data.actor.role}
          onClose={() => setQuickAddOpen(false)}
          onChoose={(kind) => {
            setQuickAddOpen(false);
            setCreateKind(kind);
          }}
        />
      ) : null}

      {createKind === "event" ? (
        <QuickAddModal
          data={data}
          onClose={() => setCreateKind(null)}
          onSubmit={async (payload) => {
            await mutate("/api/events", "POST", payload, {
              success: "Milestone created with tasks and reminders.",
            });
            setCreateKind(null);
            setActiveView("Calendar");
          }}
        />
      ) : null}

      {createKind && createKind !== "event" ? (
        <EntityComposerModal
          kind={createKind}
          data={data}
          onClose={() => setCreateKind(null)}
          onSubmit={async (url, payload, success) => {
            await mutate(url, "POST", payload, { success });
            setCreateKind(null);
          }}
        />
      ) : null}

      {rescheduleEventId ? (
        <RescheduleModal
          event={data.events.find((item) => item.id === rescheduleEventId)!}
          onClose={() => setRescheduleEventId(null)}
          onSubmit={async (payload) => {
            await mutate(`/api/events/${rescheduleEventId}/reschedule`, "POST", payload, {
              success: "Milestone moved and reminders recalculated.",
            });
            setRescheduleEventId(null);
          }}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <span><Icon name="check" size={16} /></span>
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function DashboardView({
  data,
  onSelectEvent,
  onUpdateTask,
  onQuickAdd,
  onNavigate,
  canCreate,
}: {
  data: PlannerData;
  onSelectEvent: (id: Id) => void;
  onUpdateTask: (task: Task, status: string) => void;
  onQuickAdd: () => void;
  onNavigate: (view: ViewName) => void;
  canCreate: boolean;
}) {
  const today = dateKey(new Date());
  const nowMs = new Date(data.serverTime).getTime();
  const todayEvents = data.events.filter((event) => dateKey(event.startsAt) === today);
  const upcoming = data.events
    .filter((event) => new Date(event.startsAt).getTime() > nowMs)
    .slice(0, 6);
  const nextEvent = upcoming[0] || todayEvents[0];
  const openTasks = data.tasks.filter((task) => task.status !== "Completed");
  const focusTasks = openTasks
    .filter((task) => task.assigneeId === data.actor.id || task.priority === "High")
    .slice(0, 5);
  const weekEnd = nowMs + 7 * 86_400_000;
  const weekEvents = data.events.filter((event) => {
    const start = new Date(event.startsAt).getTime();
    return start >= nowMs - 86_400_000 && start <= weekEnd;
  });
  const completedTasks = data.tasks.filter((task) => task.status === "Completed").length;
  const approvals = data.content.filter((item) =>
    item.approvalStatus.toLowerCase().includes("review"),
  ).length;
  const scheduledPosts = data.content.filter((item) => item.status === "Scheduled").length;
  const uncovered = data.events.filter(
    (event) =>
      event.readiness === "Not prepared" || event.readiness === "Needs attention",
  ).length;
  const alerts = [
    ...data.events
      .filter((event) => toneFor(event.readiness) === "danger" || event.priority === "High")
      .map((event) => ({
        id: event.id,
        title: event.readinessReason,
        detail: `${relativeDay(event.startsAt)} · ${event.title}`,
        tone: toneFor(event.readiness),
      })),
    ...data.tasks
      .filter((task) => task.status === "Changes requested")
      .map((task) => ({
        id: task.id,
        title: task.title,
        detail: `Changes requested · ${task.assigneeName || "Unassigned"}`,
        tone: "danger",
      })),
  ].slice(0, 4);

  return (
    <div className="view-stack">
      <section className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">{formatFullDate(new Date())}</p>
          <h1>
            Good {dayPart()}, {data.actor.fullName.split(" ")[0]}
          </h1>
          <p>Here is what your team needs to know today.</p>
        </div>
        {canCreate ? (
          <button className="button secondary desktop-only" onClick={onQuickAdd}>
            <span>＋</span> Create milestone
          </button>
        ) : null}
      </section>

      <section className="dashboard-grid lead-grid">
        <div className="panel today-panel">
          <PanelHeading
            title="Today"
            meta={`${todayEvents.length} milestone${todayEvents.length === 1 ? "" : "s"}`}
          />
          <div className="today-list">
            {todayEvents.length ? (
              todayEvents.map((event) => (
                <button
                  className="today-event"
                  key={event.id}
                  onClick={() => onSelectEvent(event.id)}
                >
                  <div className="time-column">
                    <strong>{formatTime(event.startsAt)}</strong>
                    <span>{event.arrivalAt ? `Call ${formatTime(event.arrivalAt)}` : "All day"}</span>
                  </div>
                  <span
                    className="event-colour-line"
                    style={{ backgroundColor: event.categoryColour }}
                  />
                  <div className="today-event-main">
                    <div className="event-title-row">
                      <div>
                        <span className="mini-label">{event.category}</span>
                        <h3>{event.title}</h3>
                      </div>
                      <StatusBadge status={event.status} />
                    </div>
                    <div className="event-meta">
                      <span>⌖ {event.venue || "Venue pending"}</span>
                      <AvatarStack
                        assignments={data.assignments.filter(
                          (assignment) => assignment.eventId === event.id,
                        )}
                      />
                    </div>
                    <ReadinessLine event={event} />
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                glyph="☼"
                title="No milestones are planned today"
                body="Use the quieter day to prepare briefs and next week’s content."
              />
            )}
          </div>
        </div>

        <div className="next-event-card">
          <div className="next-card-top">
            <span className="eyebrow light">Next up</span>
            <span className="live-indicator">
              <i /> {nextEvent ? countdown(nextEvent.startsAt) : "Clear"}
            </span>
          </div>
          {nextEvent ? (
            <>
              <div className="next-card-category">
                <span style={{ background: nextEvent.categoryColour }} />
                {nextEvent.category} · {nextEvent.homeAway || "Team milestone"}
              </div>
              <h2>{nextEvent.title}</h2>
              <p>{formatDate(nextEvent.startsAt)} at {formatTime(nextEvent.startsAt)}</p>
              <div className="next-card-location">⌖ {nextEvent.venue || "Venue pending"}</div>
              <div className="next-card-team">
                <AvatarStack
                  assignments={data.assignments.filter(
                    (assignment) => assignment.eventId === nextEvent.id,
                  )}
                  dark
                />
                <span>
                  {data.assignments.filter((assignment) => assignment.eventId === nextEvent.id)
                    .length || "No"}{" "}
                  team members
                </span>
              </div>
              <button onClick={() => onSelectEvent(nextEvent.id)}>
                Open milestone <span>→</span>
              </button>
            </>
          ) : (
            <EmptyState
              glyph="✓"
              title="The schedule is clear"
              body="No upcoming milestones need attention."
              dark
            />
          )}
        </div>
      </section>

      <section className="metrics-grid" aria-label="Weekly overview">
        <MetricCard
          glyph="□"
          value={weekEvents.length}
          label="Upcoming milestones"
          detail="Next 7 days"
          tone="green"
        />
        <MetricCard
          glyph="✓"
          value={completedTasks}
          label="Tasks completed"
          detail={`${openTasks.length} still open`}
          tone="blue"
        />
        <MetricCard
          glyph="◎"
          value={approvals}
          label="Pending approvals"
          detail={`${scheduledPosts} post scheduled`}
          tone="gold"
        />
        <MetricCard
          glyph="!"
          value={uncovered}
          label="Readiness gaps"
          detail="Needs an owner"
          tone="red"
        />
      </section>

      <section className="dashboard-grid bottom-grid">
        <div className="panel task-panel">
          <PanelHeading
            title="My focus"
            meta={`${focusTasks.length} active`}
            link="View all"
            onLink={() => onNavigate("Tasks")}
          />
          <div className="compact-task-list">
            {focusTasks.length ? (
              focusTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onUpdate={onUpdateTask}
                  canUpdate={canUpdateTask(data.actor, task)}
                  compact
                />
              ))
            ) : (
              <EmptyState
                glyph="✓"
                title="No tasks assigned"
                body="Tasks created from your first milestone will appear here."
              />
            )}
          </div>
        </div>

        <div className="panel attention-panel">
          <PanelHeading title="Needs attention" meta={`${alerts.length} items`} />
          <div className="attention-list">
            {alerts.length ? (
              alerts.map((alert) => (
                <button key={alert.id} onClick={() => onSelectEvent(alert.id)}>
                  <span className={`attention-icon ${alert.tone}`}>!</span>
                  <span>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))
            ) : (
              <EmptyState
                glyph="✓"
                title="Everything is covered"
                body="There are no urgent gaps right now."
              />
            )}
          </div>
        </div>
      </section>

      <section className="panel upcoming-panel">
        <PanelHeading
          title="Coming up"
          meta="Next scheduled work"
          link="Open calendar"
          onLink={() => onNavigate("Calendar")}
        />
        <div className="upcoming-strip">
          {upcoming.length ? (
            upcoming.slice(0, 5).map((event) => (
              <button key={event.id} onClick={() => onSelectEvent(event.id)}>
                <span className="upcoming-date">
                  <strong>{new Date(event.startsAt).toLocaleDateString("en", { day: "2-digit", timeZone: ACTIVE_TIME_ZONE })}</strong>
                  <small>{new Date(event.startsAt).toLocaleDateString("en", { month: "short", timeZone: ACTIVE_TIME_ZONE })}</small>
                </span>
                <span className="upcoming-copy">
                  <small>{relativeDay(event.startsAt)} · {formatTime(event.startsAt)}</small>
                  <strong>{event.title}</strong>
                  <span>{event.venue || "Venue pending"}</span>
                </span>
                <StatusBadge status={event.readiness} />
              </button>
            ))
          ) : (
            <EmptyState
              glyph="□"
              title="Nothing scheduled yet"
              body="Create your first milestone to begin building the shared plan."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function CalendarView({
  data,
  onSelectEvent,
}: {
  data: PlannerData;
  onSelectEvent: (id: Id) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [calendarMode, setCalendarMode] = useState<"Month" | "Agenda">("Month");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const monthTitle = month.toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
  const days = buildCalendarDays(month);
  const events = data.events.filter(
    (event) => categoryFilter === "All" || event.category === categoryFilter,
  );

  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="Shared planning calendar"
        title="Calendar"
        description="Every milestone, assignment, deadline, and deliverable date in one place."
      />
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-move">
            <button
              className="icon-button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              className="button subtle"
              onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))}
            >
              Today
            </button>
            <button
              className="icon-button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              aria-label="Next month"
            >
              →
            </button>
            <h2>{monthTitle}</h2>
          </div>
          <div className="calendar-actions">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              <option>All</option>
              {data.categories.map((category) => (
                <option key={category.id}>{category.name}</option>
              ))}
            </select>
            <div className="segmented">
              {(["Month", "Agenda"] as const).map((mode) => (
                <button
                  key={mode}
                  className={calendarMode === mode ? "active" : ""}
                  onClick={() => setCalendarMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {calendarMode === "Month" ? (
          <div className="calendar-grid" role="grid" aria-label={monthTitle}>
            {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
              <div className="calendar-weekday" key={day} role="columnheader">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const key = dateKey(day.date);
              const dayEvents = events.filter((event) => dateKey(event.startsAt) === key);
              return (
                <div
                  className={`calendar-day ${day.inMonth ? "" : "outside"} ${
                    key === dateKey(new Date()) ? "today" : ""
                  }`}
                  key={key}
                  role="gridcell"
                >
                  <span className="day-number">{day.date.getDate()}</span>
                  <div className="calendar-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        style={{ "--event-colour": event.categoryColour } as React.CSSProperties}
                        onClick={() => onSelectEvent(event.id)}
                      >
                        <span>{formatTime(event.startsAt)}</span>
                        <strong>{event.title}</strong>
                        <AvatarStack
                          assignments={data.assignments.filter(
                            (assignment) => assignment.eventId === event.id,
                          )}
                          tiny
                        />
                      </button>
                    ))}
                    {dayEvents.length > 3 ? (
                      <small>+{dayEvents.length - 3} more</small>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="agenda-list">
            {events.map((event) => (
              <button key={event.id} onClick={() => onSelectEvent(event.id)}>
                <time>
                  <strong>{formatDate(event.startsAt)}</strong>
                  <span>{formatTime(event.startsAt)}</span>
                </time>
                <span
                  className="event-colour-line"
                  style={{ backgroundColor: event.categoryColour }}
                />
                <span className="agenda-main">
                  <small>{event.category}</small>
                  <strong>{event.title}</strong>
                  <span>{event.venue}</span>
                </span>
                <StatusBadge status={event.readiness} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventsView({
  data,
  onSelectEvent,
  onCreate,
}: {
  data: PlannerData;
  onSelectEvent: (id: Id) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState("All");
  const [hideCompleted, setHideCompleted] = useState(false);
  const filtered = data.events.filter(
    (event) =>
      (filter === "All" || event.category === filter) &&
      (!hideCompleted || event.status !== "Completed"),
  );
  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="Key dates and checkpoints"
        title="Milestones"
        description={`${filtered.length} current milestones across projects, meetings, deadlines, and launches.`}
        action={EVENT_MANAGER_ROLES.includes(data.actor.role) ? (
          <button className="button primary" onClick={onCreate}>
            ＋ Create milestone
          </button>
        ) : undefined}
      />
      <div className="filter-row">
        <div className="chip-scroll">
          {["All", ...data.categories.map((category) => category.name)].map((item) => (
            <button
              key={item}
              className={`filter-chip ${filter === item ? "active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => setHideCompleted(event.target.checked)}
          />
          Hide completed
        </label>
      </div>
      <section className="event-card-grid">
        {filtered.length ? (
          filtered.map((event) => {
            const assignments = data.assignments.filter(
              (assignment) => assignment.eventId === event.id,
            );
            const eventTasks = data.tasks.filter((task) => task.eventId === event.id);
            const complete = eventTasks.filter((task) => task.status === "Completed").length;
            return (
              <button
                className="event-card"
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
              >
              <div
                className="event-card-band"
                style={{ backgroundColor: event.categoryColour }}
              />
              <div className="event-card-top">
                <span className="mini-label">{event.category}</span>
                <StatusBadge status={event.status} />
              </div>
              <h2>{event.title}</h2>
              <div className="event-card-date">
                <span>
                  <strong>
                    {new Date(event.startsAt).toLocaleDateString("en", {
                      day: "2-digit",
                      timeZone: ACTIVE_TIME_ZONE,
                    })}
                  </strong>
                  <small>
                    {new Date(event.startsAt).toLocaleDateString("en", {
                      month: "short",
                      timeZone: ACTIVE_TIME_ZONE,
                    })}
                  </small>
                </span>
                <p>
                  <strong>{relativeDay(event.startsAt)} · {formatTime(event.startsAt)}</strong>
                  <small>⌖ {event.venue || "Venue pending"}</small>
                </p>
              </div>
              <ReadinessLine event={event} />
              <div className="event-card-footer">
                <AvatarStack assignments={assignments} />
                <span>{complete}/{eventTasks.length} tasks</span>
              </div>
              </button>
            );
          })
        ) : (
          <EmptyState
            glyph="◫"
            title="No milestones in the plan"
            body="Use Quick add to create a kickoff, meeting, deadline, review, or launch."
          />
        )}
      </section>
    </div>
  );
}

function TasksView({
  data,
  mutate,
  onUpdateTask,
  onSelectEvent,
  onCreate,
}: {
  data: PlannerData;
  mutate: Mutate;
  onUpdateTask: (task: Task, status: string) => void;
  onSelectEvent: (id: Id) => void;
  onCreate: () => void;
}) {
  const [tab, setTab] = useState("My tasks");
  const tabs = ["My tasks", "Team tasks", "Overdue", "For review", "Completed"];
  const now = new Date(data.serverTime).getTime();
  const tasks = data.tasks.filter((task) => {
    if (tab === "My tasks")
      return task.assigneeId === data.actor.id || task.priority === "High";
    if (tab === "Overdue")
      return new Date(task.dueAt).getTime() < now && task.status !== "Completed";
    if (tab === "For review") return task.status === "For review";
    if (tab === "Completed") return task.status === "Completed";
    return true;
  });
  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="Work connected to the plan"
        title="Tasks"
        description="Simple, accountable work without unnecessary project-management complexity."
        action={allowedCreateKinds(data.actor.role).includes("task") ? (
          <button className="button primary" onClick={onCreate}>
            ＋ Add task
          </button>
        ) : undefined}
      />
      <div className="tab-row">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
            <span>
              {item === "Completed"
                ? data.tasks.filter((task) => task.status === "Completed").length
                : item === "For review"
                  ? data.tasks.filter((task) => task.status === "For review").length
                  : ""}
            </span>
          </button>
        ))}
      </div>
      <section className="panel task-table-panel">
        <div className="task-table-head">
          <span>Task</span>
          <span>Owner</span>
          <span>Due</span>
          <span>Status</span>
          <span />
        </div>
        <div className="task-table">
          {tasks.length ? (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onUpdate={onUpdateTask}
                canUpdate={canUpdateTask(data.actor, task)}
                onDelete={EVENT_MANAGER_ROLES.includes(data.actor.role) ? () => {
                  if (window.confirm(`Delete task “${task.title}”? This cannot be undone.`)) {
                    void mutate(`/api/tasks/${task.id}`, "DELETE", {}, {
                      success: "Task deleted.",
                    });
                  }
                } : undefined}
                onOpenEvent={
                  task.eventId ? () => onSelectEvent(task.eventId as string) : undefined
                }
              />
            ))
          ) : (
            <EmptyState
              glyph="✓"
              title={`No ${tab.toLowerCase()}`}
              body="Nothing needs your attention in this view."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function CampaignsView({
  data,
  mutate,
  onCreate,
}: {
  data: PlannerData;
  mutate: Mutate;
  onCreate: (kind: CreateKind) => void;
}) {
  const [view, setView] = useState<"Cards" | "Timeline">("Cards");
  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="Multi-channel planning"
        title="Projects"
        description="Connect milestones, deliverables, approvals, and deadlines around one shared objective."
        action={allowedCreateKinds(data.actor.role).some((kind) =>
          kind === "campaign" || kind === "content"
        ) ? (
          <div className="heading-actions">
            {allowedCreateKinds(data.actor.role).includes("content") ? (
              <button className="button secondary" onClick={() => onCreate("content")}>
                ＋ Plan content
              </button>
            ) : null}
            {allowedCreateKinds(data.actor.role).includes("campaign") ? (
              <button className="button primary" onClick={() => onCreate("campaign")}>
                ＋ New project
              </button>
            ) : null}
          </div>
        ) : undefined}
      />
      <div className="segmented view-toggle" aria-label="Project display">
        {(["Cards", "Timeline"] as const).map((mode) => (
          <button
            key={mode}
            className={view === mode ? "active" : ""}
            onClick={() => setView(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
      {view === "Cards" ? (
        <section className="campaign-grid">
          {data.campaigns.length ? data.campaigns.map((campaign) => {
            const items = data.content.filter(
              (content) => content.campaignId === campaign.id,
            );
            const events = data.events.filter(
              (event) => event.campaignId === campaign.id,
            );
            return (
              <article className="campaign-card" key={campaign.id}>
                <div className="campaign-card-top">
                  <StatusBadge status={campaign.status} />
                  <span className={`priority-dot ${campaign.priority.toLowerCase()}`}>
                    {campaign.priority}
                  </span>
                </div>
                <h2>{campaign.title}</h2>
                <p>{campaign.objective}</p>
                <div className="campaign-dates">
                  <span>◷</span>
                  <div>
                    <strong>{campaign.startDate} — {campaign.endDate}</strong>
                    <small>{campaign.channels}</small>
                  </div>
                </div>
                <div className="campaign-progress">
                  <span>
                    <strong>{campaign.progress}%</strong>
                    <small>complete</small>
                  </span>
                  <ProgressBar value={campaign.progress} />
                </div>
                <div className="campaign-footer">
                  <Avatar
                    member={
                      data.team.find((member) => member.id === campaign.ownerId) ??
                      {
                        fullName: "Unassigned",
                        initials: "—",
                        avatarColour: "#9aa1b2",
                      }
                    }
                    size="small"
                  />
                  <span>{events.length} milestones</span>
                  <span>{items.length} content items</span>
                </div>
                {EVENT_MANAGER_ROLES.includes(data.actor.role) ? (
                <div className="card-actions">
                  <button
                    className="button subtle"
                    onClick={() =>
                      mutate(
                        `/api/campaigns/${campaign.id}`,
                        "PATCH",
                        {
                          status: campaign.status === "Active" ? "Completed" : "Active",
                          progress: campaign.status === "Active" ? 100 : Math.max(5, campaign.progress),
                        },
                        { success: campaign.status === "Active" ? "Project completed." : "Project activated." },
                      )
                    }
                  >
                    {campaign.status === "Active" ? "Complete" : "Start project"}
                  </button>
                  <button
                    className="button danger-quiet"
                    onClick={() => {
                      if (window.confirm(`Delete “${campaign.title}” and its connected tasks, deliverables, and links? This cannot be undone.`)) {
                        void mutate(`/api/campaigns/${campaign.id}`, "DELETE", {}, {
                          success: "Project deleted.",
                        });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
                ) : null}
              </article>
            );
          }) : (
            <EmptyState
              glyph="◎"
              title="No projects yet"
              body="Projects connect your milestones, tasks, deliverables, approvals, and dates."
            />
          )}
        </section>
      ) : (
        <section className="panel timeline-panel">
          <div className="timeline-ruler">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index}>Week {index + 1}</span>
            ))}
          </div>
          {data.campaigns.map((campaign, index) => (
            <div className="timeline-row" key={campaign.id}>
              <div>
                <strong>{campaign.title}</strong>
                <small>{campaign.ownerName}</small>
              </div>
              <div className="timeline-track">
                <span
                  style={{
                    left: `${index * 8}%`,
                    width: `${Math.max(28, campaign.progress * 0.62)}%`,
                  }}
                >
                  {campaign.progress}%
                </span>
              </div>
            </div>
          ))}
          {!data.campaigns.length ? (
            <EmptyState
              glyph="◎"
              title="No project timeline yet"
              body="Your project schedule will appear here once projects are created."
            />
          ) : null}
        </section>
      )}
      <section className="panel content-schedule-panel">
        <PanelHeading title="Content schedule" meta={`${data.content.length} items`} />
        <div className="content-list">
          {data.content.map((item) => (
            <div key={item.id}>
              <span className={`platform-mark ${item.platform.toLowerCase()}`}>
                {item.platform.slice(0, 1)}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.platform} · {item.contentType}</small>
              </span>
              <span className="content-access">
                <time>{formatDate(item.publishAt)} · {formatTime(item.publishAt)}</time>
                {item.assetUrl ? (
                  <a href={item.assetUrl} target="_blank" rel="noreferrer">
                    Link ↗
                  </a>
                ) : null}
              </span>
              <StatusBadge status={item.approvalStatus} />
            </div>
          ))}
          {!data.content.length ? (
            <EmptyState
              glyph="□"
              title="No content scheduled"
              body="Deliverables connected to projects and milestones will appear here."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MediaView({
  data,
  mutate,
  onCreate,
}: {
  data: PlannerData;
  mutate: Mutate;
  onCreate: () => void;
}) {
  const [kind, setKind] = useState("All");
  const kinds = ["All", ...new Set(data.media.map((item) => item.kind))];
  const media = data.media.filter((item) => kind === "All" || item.kind === kind);
  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="References and delivery links"
        title="Links"
        description="Briefs, brand assets, sponsor files, and external galleries—without forcing heavy originals into the planner."
      />
      <div className="filter-row">
        <div className="chip-scroll">
          {kinds.map((item) => (
            <button
              className={`filter-chip ${kind === item ? "active" : ""}`}
              key={item}
              onClick={() => setKind(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {allowedCreateKinds(data.actor.role).includes("media") ? (
          <button className="button primary" onClick={onCreate}>＋ Add external link</button>
        ) : null}
      </div>
      <section className="media-grid">
        {!media.length ? (
          <EmptyState
            glyph="◇"
            title="No external links yet"
            body="Add lightweight briefs, approval files, or links to your cloud galleries."
          />
        ) : null}
        {media.map((item) => (
          <article className="media-card" key={item.id}>
            <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}>
              <span className={`file-icon ${toneFor(item.kind)}`}>
                {item.kind === "Cloud folder" ? "↗" : item.kind.slice(0, 1)}
              </span>
              <div>
                <span className="mini-label">{item.kind}</span>
                <h2>{item.title}</h2>
                <p>{item.tags.split(",").filter(Boolean).map((tag) => `#${tag.trim()}`).join("  ") || "External reference"}</p>
              </div>
            </a>
            <div className="media-card-footer">
              <span>{item.uploadedByName || "Workspace team"}</span>
              <span>
                <a href={item.url} target="_blank" rel="noreferrer">Open ↗</a>
                {["Administrator", "Project Manager", "Team Lead"].includes(data.actor.role) ? (
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove the link “${item.title}”?`)) {
                        void mutate(`/api/media/${item.id}`, "DELETE", {}, {
                          success: "External link removed.",
                        });
                      }
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </div>
          </article>
        ))}
        <article className="media-guidance-card">
          <span>◎</span>
          <h2>Keep original files on the right platform</h2>
          <p>
            Keep originals on your preferred platform and add its secure link here.
            The workspace stores text and URLs only—never the original file itself.
          </p>
        </article>
      </section>
    </div>
  );
}

function NotificationsView({
  data,
  onSelectEvent,
  onMarkRead,
}: {
  data: PlannerData;
  onSelectEvent: (id: Id) => void;
  onMarkRead: () => void;
}) {
  const unread = data.notifications.filter((item) => !item.readAt).length;
  return (
    <div className="view-stack narrow-view">
      <PageHeading
        eyebrow="Reminders and action signals"
        title="Notifications"
        description={`${unread} unread update${unread === 1 ? "" : "s"} for your project work.`}
        action={
          unread ? (
            <button className="button secondary" onClick={onMarkRead}>
              Mark all read
            </button>
          ) : undefined
        }
      />
      <section className="panel notification-list">
        {data.notifications.map((notification) => (
          <button
            className={notification.readAt ? "read" : ""}
            key={notification.id}
            onClick={() => notification.eventId && onSelectEvent(notification.eventId)}
          >
            <span className={`notification-kind ${toneFor(notification.kind)}`}>
              {notification.kind === "Warning"
                ? "!"
                : notification.kind === "Approval"
                  ? "✓"
                  : "◌"}
            </span>
            <span>
              <strong>{notification.title}</strong>
              <p>{notification.message}</p>
              <small>{formatNotificationTime(notification.createdAt)}</small>
            </span>
            {!notification.readAt ? <i aria-label="Unread" /> : null}
          </button>
        ))}
        {!data.notifications.length ? (
          <EmptyState
            glyph="◌"
            title="No notifications"
            body="Assignments, reminders, approvals, and schedule changes will appear here."
          />
        ) : null}
      </section>
    </div>
  );
}

function ReportsView({ data }: { data: PlannerData }) {
  const totalEvents = data.events.length;
  const ready = data.events.filter(
    (event) => event.readiness === "Ready" || event.readiness === "Completed",
  ).length;
  const needs = data.events.filter((event) => event.readiness === "Needs attention").length;
  const uncovered = data.events.filter((event) => event.readiness === "Not prepared").length;
  const taskByMember = data.team
    .map((member) => ({
      ...member,
      tasks: data.tasks.filter((task) => task.assigneeId === member.id).length,
      completed: data.tasks.filter(
        (task) => task.assigneeId === member.id && task.status === "Completed",
      ).length,
    }))
    .sort((a, b) => b.tasks - a.tasks);
  const maxTasks = Math.max(...taskByMember.map((member) => member.tasks), 1);
  const published = data.content.filter((item) => item.status === "Published").length;
  const approved = data.content.filter((item) => item.approvalStatus === "Approved").length;
  const delayed = data.content.filter((item) => item.status === "Changes requested").length;
  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="Practical monthly picture"
        title="Reports"
        description="Readiness, workload, and delivery health without unnecessary dashboards."
        action={
          <button
            className="button secondary"
            onClick={() =>
              downloadCsv(`project-workspace-summary-${dateKey(new Date())}.csv`, [
                ["Metric", "Value"],
                ["Planned milestones", totalEvents],
                ["Ready milestones", ready],
                ["Needs attention", needs + uncovered],
                ["Content ready", approved + published],
                [],
                ["Team member", "Department", "Tasks", "Completed"],
                ...taskByMember.map((member) => [
                  member.fullName,
                  member.department,
                  member.tasks,
                  member.completed,
                ]),
              ])
            }
          >
            ↓ Export summary
          </button>
        }
      />
      <section className="metrics-grid report-metrics">
        <MetricCard glyph="◫" value={totalEvents} label="Planned milestones" detail="Current period" tone="green" />
        <MetricCard glyph="✓" value={ready} label="Ready milestones" detail={`${Math.round((ready / Math.max(totalEvents, 1)) * 100)}% of milestones`} tone="blue" />
        <MetricCard glyph="!" value={needs + uncovered} label="Need attention" detail={`${uncovered} uncovered`} tone="red" />
        <MetricCard glyph="◎" value={approved + published} label="Content ready" detail={`${delayed} delayed`} tone="gold" />
      </section>
      <section className="dashboard-grid reports-grid">
        <div className="panel coverage-report">
          <PanelHeading title="Milestone readiness" meta="Current plan" />
          <div className="coverage-donut-row">
            <div
              className="donut"
              style={{
                "--donut-ready": `${(ready / Math.max(totalEvents, 1)) * 100}%`,
                "--donut-needs": `${((ready + needs) / Math.max(totalEvents, 1)) * 100}%`,
              } as React.CSSProperties}
            >
              <span>
                <strong>{totalEvents}</strong>
                <small>milestones</small>
              </span>
            </div>
            <div className="report-legend">
              <ReportLegend colour="#2e755d" label="Ready / completed" value={ready} />
              <ReportLegend colour="#e2a941" label="Needs attention" value={needs} />
              <ReportLegend colour="#bf6154" label="Not prepared" value={uncovered} />
              <ReportLegend colour="#d7dcd9" label="Other statuses" value={Math.max(0, totalEvents - ready - needs - uncovered)} />
            </div>
          </div>
        </div>
        <div className="panel workload-report">
          <PanelHeading title="Team workload" meta="Open and completed tasks" />
          <div className="workload-list">
            {taskByMember.slice(0, 6).map((member) => (
              <div key={member.id}>
                <Avatar member={member} size="small" />
                <span>
                  <strong>{member.fullName}</strong>
                  <small>{member.department}</small>
                </span>
                <div className="workload-bar">
                  <i style={{ width: `${(member.tasks / maxTasks) * 100}%` }} />
                </div>
                <b>{member.tasks}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="panel report-note">
        <span>↗</span>
        <div>
          <strong>
            {totalEvents
              ? "Use this summary to improve readiness before deadlines."
              : "Reports will build from your live workspace activity."}
          </strong>
          <p>
            {totalEvents
              ? "Resolve unassigned work and delayed approvals first to improve overall readiness."
              : "Create milestones, assign tasks, and schedule deliverables to begin measuring readiness and workload."}
          </p>
        </div>
      </section>
    </div>
  );
}

function TeamView({
  data,
  mutate,
  onCreate,
}: {
  data: PlannerData;
  mutate: Mutate;
  onCreate: () => void;
}) {
  const [workloadMemberId, setWorkloadMemberId] = useState<string | null>(null);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const workloadMember = data.team.find((member) => member.id === workloadMemberId);
  const editMember = data.team.find((member) => member.id === editMemberId);
  const deleteMember = data.team.find((member) => member.id === deleteMemberId);
  const canManageMembers = data.actor.role === "Administrator";
  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="People and responsibilities"
        title="Team"
        description={`${data.team.length} active members across your organization.`}
        action={canManageMembers ? (
          <button className="button primary" onClick={onCreate}>
            <Icon name="plus" size={17} /> Add team member
          </button>
        ) : undefined}
      />
      {EVENT_MANAGER_ROLES.includes(data.actor.role) ? (
        <UnassignedWorkPanel data={data} mutate={mutate} />
      ) : null}
      <section className="team-grid">
        {data.team.map((member) => {
          const assignments = data.assignments.filter(
            (assignment) => assignment.memberId === member.id,
          );
          const tasks = data.tasks.filter(
            (task) => task.assigneeId === member.id && task.status !== "Completed",
          );
          return (
            <article className="team-card" key={member.id}>
              <Avatar member={member} size="large" />
              <h2>{member.fullName}</h2>
              <p>{member.role}</p>
              <span className="department-pill">{member.department}</span>
              {member.email ? (
                <a className="team-email" href={`mailto:${member.email}`}>
                  {member.email}
                </a>
              ) : null}
              <div className="team-stats">
                <span>
                  <strong>{assignments.length}</strong>
                  <small>assignments</small>
                </span>
                <span>
                  <strong>{tasks.length}</strong>
                  <small>open tasks</small>
                </span>
              </div>
              <div className="team-card-actions">
                <button className="team-workload-button" onClick={() => setWorkloadMemberId(member.id)}>
                  View workload <Icon name="arrow-right" size={16} />
                </button>
                {canManageMembers ? (
                  <>
                    <button className="team-edit-button" onClick={() => setEditMemberId(member.id)}>
                      <Icon name="edit" size={16} /> Edit
                    </button>
                    {member.id !== data.actor.id ? (
                      <button className="team-delete-button" onClick={() => setDeleteMemberId(member.id)}>
                        <Icon name="trash" size={16} /> Delete
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
      {workloadMember ? (
        <WorkloadModal
          member={workloadMember}
          data={data}
          onClose={() => setWorkloadMemberId(null)}
        />
      ) : null}
      {editMember ? (
        <MemberEditModal
          member={editMember}
          onClose={() => setEditMemberId(null)}
          onSubmit={async (payload) => {
            await mutate(`/api/members/${editMember.id}`, "PATCH", payload, {
              success: `${payload.fullName} updated.`,
            });
            setEditMemberId(null);
          }}
        />
      ) : null}
      {deleteMember ? (
        <MemberDeleteModal
          member={deleteMember}
          data={data}
          onClose={() => setDeleteMemberId(null)}
          onDelete={async () => {
            await mutate(`/api/members/${deleteMember.id}`, "DELETE", {}, {
              success: `${deleteMember.fullName} deleted. Their work is ready to reassign.`,
            });
            setDeleteMemberId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function UnassignedWorkPanel({ data, mutate }: { data: PlannerData; mutate: Mutate }) {
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const items: Array<{
    id: string;
    kind: string;
    title: string;
    endpoint: string;
    field: "ownerId" | "assigneeId";
  }> = [
    ...data.events
      .filter((event) => !event.ownerId)
      .map((event) => ({
        id: `event-${event.id}`,
        kind: "Milestone",
        title: event.title,
        endpoint: `/api/events/${event.id}`,
        field: "ownerId" as const,
      })),
    ...data.tasks
      .filter((task) => !task.assigneeId && task.status !== "Completed")
      .map((task) => ({
        id: `task-${task.id}`,
        kind: "Task",
        title: task.title,
        endpoint: `/api/tasks/${task.id}`,
        field: "assigneeId" as const,
      })),
    ...data.campaigns
      .filter((campaign) => !campaign.ownerId)
      .map((campaign) => ({
        id: `campaign-${campaign.id}`,
        kind: "Project",
        title: campaign.title,
        endpoint: `/api/campaigns/${campaign.id}`,
        field: "ownerId" as const,
      })),
    ...data.content
      .filter((content) => !content.assigneeId)
      .map((content) => ({
        id: `content-${content.id}`,
        kind: "Deliverable",
        title: content.title,
        endpoint: `/api/content/${content.id}`,
        field: "assigneeId" as const,
      })),
  ];

  return (
    <section className={`panel unassigned-work-panel ${items.length ? "has-work" : ""}`}>
      <div className="unassigned-work-heading">
        <span className="unassigned-work-icon"><Icon name={items.length ? "alert" : "check"} /></span>
        <div>
          <strong>Unassigned work</strong>
          <p>
            {items.length
              ? `${items.length} item${items.length === 1 ? "" : "s"} need a new owner.`
              : "Every active work item has an owner."}
          </p>
        </div>
        <StatusBadge status={items.length ? "Needs attention" : "Ready"} />
      </div>
      {items.length ? (
        <div className="unassigned-work-list">
          {items.map((item) => (
            <div key={item.id} className="unassigned-work-row">
              <span className="work-kind">{item.kind}</span>
              <strong>{item.title}</strong>
              <label>
                <span className="sr-only">Assign {item.title}</span>
                <select
                  aria-label={`Assign ${item.title}`}
                  defaultValue=""
                  disabled={assigningId === item.id}
                  onChange={async (event) => {
                    const memberId = event.target.value;
                    if (!memberId) return;
                    setAssigningId(item.id);
                    try {
                      await mutate(item.endpoint, "PATCH", { [item.field]: memberId }, {
                        success: `${item.title} reassigned.`,
                      });
                    } finally {
                      setAssigningId(null);
                    }
                  }}
                >
                  <option value="">Choose new owner…</option>
                  {data.team.map((member) => (
                    <option key={member.id} value={member.id}>{member.fullName} · {member.role}</option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MemberEditModal({
  member,
  onClose,
  onSubmit,
}: {
  member: Member;
  onClose: () => void;
  onSubmit: (payload: {
    fullName: string;
    email: string;
    role: string;
    department: string;
    password?: string;
    emailNotifications: number;
  }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(member.fullName);
  const [email, setEmail] = useState(member.email || "");
  const [role, setRole] = useState(member.role);
  const [department, setDepartment] = useState(member.department);
  const [password, setPassword] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(Boolean(member.emailNotifications));
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="edit-member-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close member editor" />
      <form
        className="planner-modal member-editor-modal"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          try {
            await onSubmit({
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              role,
              department: department.trim(),
              password: password || undefined,
              emailNotifications: Number(emailNotifications),
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Administrator controls</span>
            <h2 id="edit-member-title">Edit team member</h2>
            <p>Update account details, access role, and email notifications.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body form-stack">
          <div className="member-edit-summary">
            <Avatar member={member} size="large" />
            <span><strong>{member.fullName}</strong><small>{member.role}</small></span>
          </div>
          <label className="full-field">
            <span>Full name *</span>
            <input autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <div className="form-grid two">
            <label>
              <span>Email and sign-in name *</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              <small>Changing this also changes the user’s login email.</small>
            </label>
            <label>
              <span>New temporary password</span>
              <input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              <small>Leave blank to keep the current password.</small>
            </label>
          </div>
          <div className="form-grid two">
            <label>
              <span>Role</span>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option>Administrator</option>
                <option>Project Manager</option>
                <option>Team Lead</option>
                <option>Contributor</option>
                <option>Reviewer</option>
                <option>Viewer</option>
              </select>
            </label>
            <label>
              <span>Department</span>
              <input value={department} onChange={(event) => setDepartment(event.target.value)} />
            </label>
          </div>
          <label className="member-notification-toggle">
            <span>
              <strong>Email notifications</strong>
              <small>Send assignments and reminders to this user.</small>
            </span>
            <input type="checkbox" checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} />
          </label>
        </div>
        <div className="modal-footer">
          <button className="button subtle" type="button" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={submitting || !fullName.trim() || !email.trim()}>
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MemberDeleteModal({
  member,
  data,
  onClose,
  onDelete,
}: {
  member: Member;
  data: PlannerData;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const breakdown = [
    ["milestone ownerships", data.events.filter((event) => event.ownerId === member.id).length],
    ["milestone assignments", data.assignments.filter((item) => item.memberId === member.id).length],
    ["tasks", data.tasks.filter((task) => task.assigneeId === member.id).length],
    ["projects", data.campaigns.filter((campaign) => campaign.ownerId === member.id).length],
    ["content items", data.content.filter((content) => content.assigneeId === member.id).length],
    ["shot-list items", data.shotItems.filter((item) => item.assigneeId === member.id).length],
  ].filter(([, count]) => Number(count) > 0) as Array<[string, number]>;
  const total = breakdown.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="modal-layer" role="alertdialog" aria-modal="true" aria-labelledby="delete-member-title" aria-describedby="delete-member-description">
      <button className="modal-scrim" onClick={onClose} aria-label="Cancel user deletion" />
      <section className="planner-modal small delete-member-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow danger-text">Permanent account removal</span>
            <h2 id="delete-member-title">Delete {member.fullName}?</h2>
            <p id="delete-member-description">Their account will be removed, but their project work will not be deleted.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body form-stack">
          <div className="delete-member-warning">
            <span><Icon name="alert" /></span>
            <div>
              <strong>{total ? `${total} linked item${total === 1 ? "" : "s"} will become unassigned.` : "This user has no assigned work."}</strong>
              <p>Managers can reassign preserved work from the Unassigned work section.</p>
            </div>
          </div>
          {breakdown.length ? (
            <ul className="delete-impact-list">
              {breakdown.map(([label, count]) => <li key={label}><span>{label}</span><strong>{count}</strong></li>)}
            </ul>
          ) : null}
        </div>
        <div className="modal-footer destructive-footer">
          <button className="button subtle" type="button" onClick={onClose} autoFocus>Keep user</button>
          <button
            className="button danger-solid"
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onDelete();
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Icon name="trash" size={16} /> {submitting ? "Deleting…" : "Delete user"}
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  data,
  mutate,
}: {
  data: PlannerData;
  mutate: Mutate;
}) {
  const [name, setName] = useState(data.organisation.name);
  const [productName, setProductName] = useState(data.organisation.productName || "Project Workspace");
  const [primaryColour, setPrimaryColour] = useState(data.organisation.primaryColour);
  const [accentColour, setAccentColour] = useState(data.organisation.accentColour);
  const [timezone, setTimezone] = useState(data.organisation.timezone);
  const [weekStartsOn, setWeekStartsOn] = useState(data.organisation.settings.weekStartsOn || "Monday");
  const [timeFormat, setTimeFormat] = useState(data.organisation.settings.timeFormat || "24-hour");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState(data.emailDelivery.smtpHost || "smtp.hostinger.com");
  const [smtpPort, setSmtpPort] = useState(String(data.emailDelivery.smtpPort || 465));
  const [smtpUsername, setSmtpUsername] = useState(data.emailDelivery.smtpUsername || "");
  const [fromAddress, setFromAddress] = useState(data.emailDelivery.fromAddress || "");
  const [replyToAddress, setReplyToAddress] = useState(data.emailDelivery.replyToAddress || "");
  const [uploadingLogo, setUploadingLogo] = useState<LogoVariant | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, { name: string; colour: string }>>(
    Object.fromEntries(
      data.categories.map((category) => [
        category.id,
        { name: category.name, colour: category.colour },
      ]),
    ),
  );
  const canEdit = data.actor.role === "Administrator";

  const replaceLogo = async (variant: LogoVariant, file: File) => {
    setLogoError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setLogoError("Choose a PNG, JPG, or WebP logo.");
      return;
    }
    if (file.size === 0 || file.size > 1_000_000) {
      setLogoError("Keep each logo under 1 MB.");
      return;
    }
    setUploadingLogo(variant);
    try {
      const image = await readFileAsDataUrl(file);
      await mutate(
        "/api/branding/logo",
        "POST",
        { variant, image },
        { success: `${LOGO_VARIANTS.find((item) => item.id === variant)?.label || "Workspace logo"} updated.` },
      );
    } catch (uploadError) {
      setLogoError(
        uploadError instanceof Error
          ? uploadError.message
          : "The logo could not be updated.",
      );
    } finally {
      setUploadingLogo(null);
    }
  };

  return (
    <div className="view-stack settings-view">
      <PageHeading
        eyebrow="One configuration everywhere"
        title="Workspace settings"
        description="Manage the product name, organization identity, colors, logos, timezone, and working preferences in one place."
      />
      {!canEdit ? (
        <div className="permission-note">
          <span>◉</span>
          You can review these settings, but only an administrator can change them.
        </div>
      ) : null}
      <form
        className="settings-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          await mutate(
            "/api/settings",
            "PATCH",
            { name, productName, primaryColour, accentColour, timezone, settings: { weekStartsOn, timeFormat } },
            { success: "Workspace settings saved." },
          );
        }}
      >
        <section className="panel settings-section">
          <PanelHeading title="Workspace identity" meta="Shared across every screen" />
          <label>
            <span>Product name</span>
            <input value={productName} onChange={(event) => setProductName(event.target.value)} disabled={!canEdit} />
          </label>
          <label>
            <span>Organization or workspace name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} />
          </label>
          <div className="colour-field-row">
            <label>
              <span>Primary colour</span>
              <span className="colour-input">
                <input type="color" value={primaryColour} onChange={(event) => setPrimaryColour(event.target.value)} disabled={!canEdit} />
                <input value={primaryColour} onChange={(event) => setPrimaryColour(event.target.value)} disabled={!canEdit} />
              </span>
            </label>
            <label>
              <span>Accent colour</span>
              <span className="colour-input">
                <input type="color" value={accentColour} onChange={(event) => setAccentColour(event.target.value)} disabled={!canEdit} />
                <input value={accentColour} onChange={(event) => setAccentColour(event.target.value)} disabled={!canEdit} />
              </span>
            </label>
          </div>
          <div
            className="brand-preview"
            style={{
              background: primaryColour,
              "--preview-accent": accentColour,
            } as React.CSSProperties}
          >
            <BrandMark variant="white" version={data.organisation.logoVersion} />
            <span>
              <strong>{name}</strong>
              <small>{productName}</small>
            </span>
            <i />
          </div>
        </section>
        <section className="panel settings-section">
          <PanelHeading title="Regional settings" meta="Dates and reminders" />
          <label>
            <span>Timezone</span>
            <select value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={!canEdit}>
              <option value="UTC">UTC</option>
              <option value="Asia/Bahrain">Asia/Bahrain</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="Asia/Riyadh">Asia/Riyadh</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="America/New_York">America/New York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Los_Angeles">America/Los Angeles</option>
              <option value="Australia/Sydney">Australia/Sydney</option>
            </select>
          </label>
          <div className="setting-summary">
            <label><strong>Week starts</strong><select value={weekStartsOn} onChange={(event) => setWeekStartsOn(event.target.value)} disabled={!canEdit}><option>Monday</option><option>Sunday</option><option>Saturday</option></select></label>
            <label><strong>Time format</strong><select value={timeFormat} onChange={(event) => setTimeFormat(event.target.value)} disabled={!canEdit}><option value="24-hour">24-hour</option><option value="12-hour">12-hour</option></select></label>
            <span>
              <strong>Language</strong>
              <small>English · Arabic ready</small>
            </span>
          </div>
        </section>
        {canEdit ? (
          <section className="panel settings-section full branding-settings">
            <PanelHeading
              title="Workspace logos"
              meta="Administrator only · saved securely on this hosting account"
            />
            <div className="logo-settings-intro">
              <p>
                These three versions are selected automatically for light and dark
                surfaces. Replace a slot whenever the brand identity changes.
              </p>
              <span>PNG with transparency recommended · JPG or WebP accepted · maximum 1 MB</span>
            </div>
            <div className="logo-variant-grid">
              {LOGO_VARIANTS.map((variant) => (
                <article className="logo-variant-card" key={variant.id}>
                  <div className={`logo-variant-preview ${variant.preview}`}>
                    <BrandMark
                      variant={variant.id}
                      version={data.organisation.logoVersion}
                    />
                  </div>
                  <div className="logo-variant-copy">
                    <strong>{variant.label}</strong>
                    <small>{variant.use}</small>
                  </div>
                  <label
                    className={`button secondary logo-upload-button ${
                      uploadingLogo === variant.id ? "busy" : ""
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={uploadingLogo !== null}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void replaceLogo(variant.id, file);
                      }}
                    />
                    <span>
                      {uploadingLogo === variant.id ? "Uploading…" : "Replace logo"}
                    </span>
                  </label>
                </article>
              ))}
            </div>
            {logoError ? (
              <p className="logo-upload-error" role="alert">
                <span>!</span>
                {logoError}
              </p>
            ) : null}
          </section>
        ) : null}
        <section className="panel settings-section full">
          <PanelHeading title="Default reminders" meta="One email per milestone" />
          <div className="reminder-settings">
            {(data.organisation.settings.reminderTimes || [
              "3 days · 10:00",
              "2 days · 10:00",
              "1 day · 10:00",
              "Due day · 08:00",
            ]).map((item) => (
              <span key={item}>
                <i>◷</i>
                <strong>{item.split(" · ")[0]}</strong>
                <small>{item.split(" · ")[1]}</small>
                <b>On</b>
              </span>
            ))}
          </div>
          <div className="reminder-policy">
            <span><Icon name="bell" size={18} /></span>
            <div>
              <strong>Task reminder schedule</strong>
              <small>Once when assigned, then at the next eligible 3, 2, 1, or 0-day milestone. Passed reminder times are skipped, and an open overdue task receives one later reminder.</small>
            </div>
          </div>
        </section>
        {canEdit ? (
          <section className="panel settings-section full email-delivery-settings">
            <PanelHeading
              title="Email notifications"
              meta={data.emailDelivery.configured && data.emailDelivery.enabled ? "Active" : "One-time setup required"}
            />
            <div className="email-delivery-summary">
              <div className={`email-status-card ${data.emailDelivery.configured && data.emailDelivery.enabled ? "ready" : "setup"}`}>
                <span>{data.emailDelivery.configured && data.emailDelivery.enabled ? "✓" : "!"}</span>
                <div>
                  <strong>
                    {data.emailDelivery.configured && data.emailDelivery.enabled
                      ? "Automatic email delivery is active"
                      : "Connect an email mailbox"}
                  </strong>
                  <small>
                    {data.emailDelivery.configured && data.emailDelivery.enabled
                      ? "Assignments, changes, and scheduled reminders can be delivered while the website is closed."
                      : "Enter the mailbox password once. It stays protected on the server and is never sent to the browser again."}
                  </small>
                </div>
              </div>
              <dl className="email-route-list">
                <div><dt>SMTP account</dt><dd>{data.emailDelivery.smtpUsername}</dd></div>
                <div><dt>Sender</dt><dd>{data.emailDelivery.fromAddress}</dd></div>
                <div><dt>Replies</dt><dd>{data.emailDelivery.replyToAddress}</dd></div>
              </dl>
            </div>
            <div className="email-config-actions">
              <div className="form-grid two full-field">
                <label><span>SMTP host</span><input value={smtpHost} onChange={(input) => setSmtpHost(input.target.value)} placeholder="smtp.hostinger.com" /></label>
                <label><span>SMTP port</span><input type="number" min="1" max="65535" value={smtpPort} onChange={(input) => setSmtpPort(input.target.value)} /></label>
                <label><span>Mailbox username</span><input type="email" value={smtpUsername} onChange={(input) => setSmtpUsername(input.target.value)} placeholder="notifications@company.com" /></label>
                <label><span>Sender address</span><input type="email" value={fromAddress} onChange={(input) => setFromAddress(input.target.value)} placeholder="noreply@company.com" /></label>
                <label><span>Reply-to address</span><input type="email" value={replyToAddress} onChange={(input) => setReplyToAddress(input.target.value)} placeholder="support@company.com" /></label>
              </div>
              <label>
                <span>Mailbox password</span>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(input) => setSmtpPassword(input.target.value)}
                  autoComplete="new-password"
                  placeholder={data.emailDelivery.configured ? "Saved securely · enter only to replace" : "Mailbox password"}
                />
                <small>This is the mailbox password, not your planner login password.</small>
              </label>
              <button
                className="button secondary"
                type="button"
                disabled={!data.emailDelivery.configured && !smtpPassword}
                onClick={async () => {
                  try {
                    await mutate(
                      "/api/email/config",
                      "PATCH",
                      { smtpHost, smtpPort: Number(smtpPort), smtpUsername, smtpPassword, fromAddress, replyToAddress, enabled: true },
                      { success: "Email delivery settings saved." },
                    );
                    setSmtpPassword("");
                  } catch {
                    // The shared mutation handler displays the server error.
                  }
                }}
              >
                {data.emailDelivery.configured ? "Save settings" : "Connect mailbox"}
              </button>
              <button
                className="button subtle"
                type="button"
                disabled={!data.emailDelivery.configured || !data.emailDelivery.enabled}
                onClick={async () => {
                  try {
                    await mutate(
                      "/api/email/test",
                      "POST",
                      {},
                      { success: `Test email sent to ${data.actor.email}.` },
                    );
                  } catch {
                    // The shared mutation handler displays the server error.
                  }
                }}
              >
                Send test email
              </button>
            </div>
            {data.emailDelivery.lastTestAt ? (
              <p className="email-test-note">
                Last successful test: {formatDate(data.emailDelivery.lastTestAt)} at {formatTime(data.emailDelivery.lastTestAt)}
                {data.emailDelivery.lastTestRecipient ? ` · ${data.emailDelivery.lastTestRecipient}` : ""}
              </p>
            ) : null}
          </section>
        ) : null}
        {canEdit ? (
          <section className="panel settings-section full">
            <PanelHeading title="Milestone categories" meta="Names and colors used across the workspace" />
            <div className="category-settings">
              {data.categories.map((category) => {
                const draft = categoryDrafts[category.id] || {
                  name: category.name,
                  colour: category.colour,
                };
                return (
                  <div key={category.id}>
                    <input
                      type="color"
                      value={draft.colour}
                      aria-label={`${draft.name} colour`}
                      onChange={(input) =>
                        setCategoryDrafts((current) => ({
                          ...current,
                          [category.id]: { ...draft, colour: input.target.value },
                        }))
                      }
                    />
                    <input
                      value={draft.name}
                      aria-label="Category name"
                      onChange={(input) =>
                        setCategoryDrafts((current) => ({
                          ...current,
                          [category.id]: { ...draft, name: input.target.value },
                        }))
                      }
                    />
                    <button
                      className="button subtle"
                      type="button"
                      onClick={() =>
                        mutate(`/api/categories/${category.id}`, "PATCH", draft, {
                          success: `${draft.name} category saved.`,
                        })
                      }
                    >
                      Save
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
        <section className="panel settings-section full account-security">
          <PanelHeading title="Account security" meta="Change your own sign-in password" />
          <label className="account-email-preference">
            <span>
              <strong>Email notifications</strong>
              <small>Receive assignments, schedule changes, task notices, and milestone reminders at {data.actor.email}.</small>
            </span>
            <input
              type="checkbox"
              checked={Boolean(data.actor.emailNotifications)}
              onChange={async (input) => {
                try {
                  await mutate(
                    "/api/account/notifications",
                    "PATCH",
                    { emailNotifications: input.target.checked },
                    { success: input.target.checked ? "Email notifications enabled." : "Email notifications paused." },
                  );
                } catch {
                  // The shared mutation handler displays the server error.
                }
              }}
            />
          </label>
          <div className="account-password-grid">
            <label>
              <span>Current password</span>
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(input) => setCurrentPassword(input.target.value)} />
            </label>
            <label>
              <span>New password</span>
              <input type="password" minLength={12} autoComplete="new-password" value={newPassword} onChange={(input) => setNewPassword(input.target.value)} />
            </label>
            <label>
              <span>Confirm new password</span>
              <input type="password" minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(input) => setConfirmPassword(input.target.value)} />
            </label>
            <button
              className="button secondary"
              type="button"
              disabled={!currentPassword || newPassword.length < 12 || newPassword !== confirmPassword}
              onClick={async () => {
                await mutate(
                  "/api/account/password",
                  "POST",
                  { currentPassword, newPassword },
                  { success: "Password changed securely." },
                );
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Change password
            </button>
          </div>
          <p className="security-hint">
            Before going live, replace the test password with a unique password of at least 12 characters.
          </p>
        </section>
        {canEdit ? (
          <div className="settings-actions">
            <button className="button primary" type="submit">
              Save settings
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function EventDetail({
  data,
  event,
  onClose,
  onUpdateTask,
  onUpdateShot,
  onMutate,
  onReschedule,
}: {
  data: PlannerData;
  event: PlannerEvent;
  onClose: () => void;
  onUpdateTask: (task: Task, status: string) => void;
  onUpdateShot: (item: ShotItem, completed: boolean) => void;
  onMutate: Mutate;
  onReschedule: () => void;
}) {
  const [tab, setTab] = useState("Overview");
  const [comment, setComment] = useState("");
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [eventActionsOpen, setEventActionsOpen] = useState(false);
  const assignments = data.assignments.filter(
    (assignment) => assignment.eventId === event.id,
  );
  const requirements = data.requirements.find(
    (requirement) => requirement.eventId === event.id,
  );
  const tasks = data.tasks.filter((task) => task.eventId === event.id);
  const shots = data.shotItems.filter((item) => item.eventId === event.id);
  const equipment = data.equipmentItems.filter((item) => item.eventId === event.id);
  const comments = data.comments.filter((item) => item.eventId === event.id);
  const content = data.content.filter((item) => item.eventId === event.id);
  const activity = data.activity.filter((item) => item.eventId === event.id);
  const completedTasks = tasks.filter((task) => task.status === "Completed").length;
  const completedShots = shots.filter((item) => item.completed).length;
  const confirmedEquipment = equipment.filter((item) => item.confirmed).length;
  const tabs = ["Overview", "Requirements", "Tasks", "Deliverables", "Team", "Activity"];
  const canManageEvent = [
    "Administrator",
    "Project Manager",
    "Team Lead",
  ].includes(data.actor.role);
  const canDeleteEvent = EVENT_MANAGER_ROLES.includes(data.actor.role);
  const canContribute = data.actor.role !== "Viewer";

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={event.title}>
      <button className="drawer-scrim" onClick={onClose} aria-label="Close event details" />
      <aside className="event-drawer">
        <div className="drawer-header">
          <div className="drawer-heading">
            <span
              className="category-square"
              style={{ backgroundColor: event.categoryColour }}
            />
            <div>
              <span className="mini-label">{event.category}</span>
              <h2>{event.title}</h2>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="drawer-summary">
          <span>□ {formatDate(event.startsAt)}</span>
          <span>◷ {formatTime(event.startsAt)}</span>
          <span>⌖ {event.venue || "Venue pending"}</span>
          <StatusBadge status={event.status} />
        </div>
        <div className="drawer-tabs">
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {item}
              {item === "Tasks" && tasks.length ? <small>{tasks.length}</small> : null}
            </button>
          ))}
        </div>
        <div className="drawer-content">
          {tab === "Overview" ? (
            <div className="drawer-section-stack">
              <section className={`readiness-card ${toneFor(event.readiness)}`}>
                <div>
                  <span>{event.readiness === "Ready" ? "✓" : "!"}</span>
                  <div>
                    <small>Milestone readiness</small>
                    <h3>{event.readiness}</h3>
                  </div>
                </div>
                <p>{event.readinessReason}</p>
                <div className="readiness-checks">
                  <span className={assignments.length >= 2 ? "done" : ""}>
                    {assignments.length >= 2 ? "✓" : "○"} Team assigned
                  </span>
                  <span className={completedShots >= Math.min(2, shots.length) ? "done" : ""}>
                    {completedShots >= Math.min(2, shots.length) ? "✓" : "○"} Checklist started
                  </span>
                  <span className={confirmedEquipment >= Math.ceil(equipment.length / 2) ? "done" : ""}>
                    {confirmedEquipment >= Math.ceil(equipment.length / 2) ? "✓" : "○"} Resources checked
                  </span>
                </div>
              </section>
              <section>
                <SectionTitle title="Quick actions" />
                <div className="quick-action-grid">
                  {[
                    ["✓", "Confirm assignment", "Confirmed"],
                    ["●", "Start work", "In progress"],
                    ["↗", "Submit for review", "Reviewing"],
                    ["✓", "Mark completed", "Completed"],
                  ].map(([glyph, label, status]) => (
                    <button
                      key={label}
                      disabled={!canContribute}
                      onClick={() =>
                        onMutate(
                          `/api/events/${event.id}/attendance`,
                          "POST",
                          { status },
                          { canQueue: true, success: `Status set to ${status.toLowerCase()}.` },
                        )
                      }
                    >
                      <span><Icon name={iconFromGlyph(glyph)} size={18} /></span>
                      {label}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <SectionTitle title="Milestone overview" />
                <div className="detail-list">
                  <DetailItem label="Date and time" value={`${formatDate(event.startsAt)} · ${formatTime(event.startsAt)}`} glyph="□" />
                  <DetailItem label="Arrival / call time" value={event.arrivalAt ? formatTime(event.arrivalAt) : "Not set"} glyph="◷" />
                  <DetailItem label="Venue" value={event.venue || "Not set"} glyph="⌖" />
                  <DetailItem label="Milestone owner" value={event.ownerName || "Unassigned"} glyph="♙" />
                  <DetailItem label="Priority" value={event.priority} glyph="!" />
                  <DetailItem label="Countdown" value={countdown(event.startsAt)} glyph="↗" />
                </div>
              </section>
              <section>
                <SectionTitle title="Work requirements" />
                <div className="requirement-chips">
                  {requirements
                    ? COVERAGE_LABELS.filter(([key]) => Boolean(requirements[key])).map(
                        ([, label]) => (
                          <span key={label}>✓ {label}</span>
                        ),
                      )
                    : null}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "Requirements" ? (
            <div className="drawer-section-stack">
              <section className="coverage-brief">
                <div className="coverage-brief-head">
                  <span>◎</span>
                  <div>
                    <small>Milestone objective</small>
                    <h3>Deliver the required outcome clearly</h3>
                  </div>
                  {canManageEvent ? (
                    <button onClick={() => setCoverageOpen(true)}>Edit requirements</button>
                  ) : null}
                </div>
                <p>
                  Keep the scope clear, confirm dependencies early, share progress with
                  stakeholders, and make the final output easy to review and approve.
                </p>
                <div>
                  <span><strong>Delivery</strong><small>Before the agreed deadline</small></span>
                  <span><strong>Files</strong><small>Use the connected external link</small></span>
                  <span><strong>Contact</strong><small>{event.ownerName}</small></span>
                </div>
              </section>
              <section>
                <SectionTitle
                  title="Delivery checklist"
                  meta={`${completedShots}/${shots.length} complete`}
                />
                {shots.length ? (
                  <div className="shot-list">
                    {["Before", "During", "After"].map((phase) => {
                      const phaseShots = shots.filter((shot) => shot.phase === phase);
                      if (!phaseShots.length) return null;
                      return (
                        <div className="shot-phase" key={phase}>
                          <h4>{phase}</h4>
                          {phaseShots.map((shot) => (
                            <label key={shot.id} className={shot.completed ? "checked" : ""}>
                              <input
                                type="checkbox"
                                checked={Boolean(shot.completed)}
                                disabled={!canContribute}
                                onChange={(input) => onUpdateShot(shot, input.target.checked)}
                              />
                              <span className="custom-check">✓</span>
                              <span>
                                <strong>{shot.title}</strong>
                                {shot.mandatory ? <small>Mandatory</small> : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    glyph="◇"
                    title="No shot list yet"
                    body="Apply a requirement template to create one."
                  />
                )}
              </section>
              <section>
                <SectionTitle
                  title="Equipment"
                  meta={`${confirmedEquipment}/${equipment.length} confirmed`}
                />
                <div className="equipment-grid">
                  {equipment.map((item) => (
                    <button
                      className={item.confirmed ? "confirmed" : ""}
                      key={item.id}
                      disabled={!canContribute}
                      onClick={() =>
                        onMutate(
                          `/api/equipment-items/${item.id}`,
                          "PATCH",
                          { confirmed: !item.confirmed },
                          {
                            canQueue: true,
                            success: item.confirmed
                              ? "Equipment item reopened."
                              : "Equipment confirmed.",
                          },
                        )
                      }
                    >
                      <i>{item.confirmed ? "✓" : "○"}</i>
                      {item.title}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "Tasks" ? (
            <div className="drawer-section-stack">
              <div className="drawer-progress-card">
                <span>
                  <strong>{completedTasks}/{tasks.length}</strong>
                  <small>tasks completed</small>
                </span>
                <ProgressBar value={(completedTasks / Math.max(tasks.length, 1)) * 100} />
              </div>
              <div className="compact-task-list drawer-tasks">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onUpdate={onUpdateTask}
                    canUpdate={canUpdateTask(data.actor, task)}
                    compact
                  />
                ))}
              </div>
            </div>
          ) : null}

          {tab === "Content" ? (
            <div className="drawer-section-stack">
              <SectionTitle title="Connected content" meta={`${content.length} items`} />
              {content.length ? (
                <div className="drawer-content-items">
                  {content.map((item) => (
                    <div key={item.id}>
                      <span className={`platform-mark ${item.platform.toLowerCase()}`}>
                        {item.platform.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.contentType} · {formatDate(item.publishAt)} {formatTime(item.publishAt)}</small>
                      </span>
                      <span className="content-access">
                        {item.assetUrl ? (
                          <a href={item.assetUrl} target="_blank" rel="noreferrer">
                            Link ↗
                          </a>
                        ) : null}
                      </span>
                      <StatusBadge status={item.approvalStatus} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  glyph="◎"
                  title="No content connected"
                  body="Add a deliverable or apply a milestone template."
                />
              )}
            </div>
          ) : null}

          {tab === "Team" ? (
            <div className="drawer-section-stack">
              <SectionTitle title="Assignments" meta={`${assignments.length} people`} />
              <div className="assignment-list">
                {assignments.map((assignment) => (
                  <div key={assignment.id}>
                    <Avatar member={assignment} size="medium" />
                    <span>
                      <strong>{assignment.fullName}</strong>
                      <small>{assignment.responsibility}</small>
                    </span>
                    <StatusBadge status={assignment.confirmationStatus} />
                  </div>
                ))}
                {canManageEvent ? (
                  <button
                    className="add-assignment"
                    onClick={() => setAssignmentOpen(true)}
                  >
                    ＋ Assign team member
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "Activity" ? (
            <div className="drawer-section-stack">
              <section>
                <SectionTitle title="Milestone updates" />
                {canContribute ? (
                <form
                  className="comment-form"
                  onSubmit={async (formEvent) => {
                    formEvent.preventDefault();
                    if (!comment.trim()) return;
                    await onMutate(
                      "/api/comments",
                      "POST",
                      { eventId: event.id, body: comment },
                      { canQueue: true, success: "Update added." },
                    );
                    setComment("");
                  }}
                >
                  <Avatar member={data.actor} size="small" />
                  <input
                    value={comment}
                    onChange={(input) => setComment(input.target.value)}
                    placeholder="Add a milestone update…"
                    aria-label="Milestone update"
                  />
                  <button type="submit">Send</button>
                </form>
                ) : null}
                <div className="comment-list">
                  {comments.map((item) => (
                    <article key={item.id}>
                      <Avatar
                        member={{
                          fullName: item.memberName,
                          initials: item.initials,
                          avatarColour: item.avatarColour,
                        }}
                        size="small"
                      />
                      <div>
                        <span>
                          <strong>{item.memberName}</strong>
                          <small>{formatNotificationTime(item.createdAt)}</small>
                        </span>
                        <p>{item.body}</p>
                        {item.important ? <i>Important update</i> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <section>
                <SectionTitle title="Activity log" />
                <div className="activity-list">
                  {activity.map((item) => (
                    <div key={item.id}>
                      <span>↗</span>
                      <p>{item.message}</p>
                      <small>{formatNotificationTime(item.createdAt)}</small>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </div>
        <div className="drawer-footer">
          <button className="button subtle" onClick={onReschedule}>
            ◷ Reschedule
          </button>
          {canManageEvent ? (
            <button className="button secondary" onClick={() => setEventActionsOpen(true)}>
              ••• Edit milestone
            </button>
          ) : null}
        </div>
      </aside>
      {coverageOpen ? (
        <CoverageModal
          event={event}
          requirement={requirements}
          onClose={() => setCoverageOpen(false)}
          onSubmit={async (payload) => {
            await onMutate(`/api/events/${event.id}/coverage`, "PATCH", payload, {
              success: "Milestone requirements updated.",
            });
            setCoverageOpen(false);
          }}
        />
      ) : null}
      {assignmentOpen ? (
        <AssignmentModal
          event={event}
          data={data}
          assignedMemberIds={assignments.map((item) => item.memberId)}
          onClose={() => setAssignmentOpen(false)}
          onSubmit={async (payload) => {
            await onMutate(`/api/events/${event.id}/assignments`, "POST", payload, {
              success: "Team member assigned.",
            });
            setAssignmentOpen(false);
          }}
        />
      ) : null}
      {eventActionsOpen ? (
        <EventActionsModal
          event={event}
          data={data}
          canDelete={canDeleteEvent}
          onClose={() => setEventActionsOpen(false)}
          onSave={async (payload) => {
            await onMutate(`/api/events/${event.id}`, "PATCH", payload, {
              success: "Milestone details saved.",
            });
            setEventActionsOpen(false);
          }}
          onDelete={async () => {
            await onMutate(`/api/events/${event.id}`, "DELETE", {}, {
              success: "Milestone deleted.",
            });
            setEventActionsOpen(false);
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}

const CREATE_OPTIONS: Array<{
  kind: CreateKind;
  glyph: string;
  title: string;
  detail: string;
}> = [
  { kind: "event", glyph: "◫", title: "Milestone", detail: "Plan a deadline, meeting, launch, or key date" },
  { kind: "task", glyph: "✓", title: "Task", detail: "Add one clear action and owner" },
  { kind: "campaign", glyph: "◎", title: "Project", detail: "Connect an objective, dates, owners, and work" },
  { kind: "content", glyph: "□", title: "Deliverable", detail: "Schedule an output and optional external link" },
  { kind: "media", glyph: "↗", title: "External link", detail: "Reference Drive, Dropbox, YouTube, or another platform" },
  { kind: "member", glyph: "♙", title: "Team member", detail: "Create secure access for a colleague" },
];

const EVENT_MANAGER_ROLES = [
  "Administrator",
  "Project Manager",
  "Team Lead",
];

function allowedCreateKinds(role: string): CreateKind[] {
  if (role === "Administrator") {
    return ["event", "task", "campaign", "content", "media", "member"];
  }
  if (role === "Project Manager" || role === "Team Lead") {
    return ["event", "task", "campaign", "content", "media"];
  }
  if (role === "Reviewer") return ["task", "content", "media"];
  if (role === "Contributor") return ["task", "media"];
  return [];
}

function canUpdateTask(actor: Member, task: Task) {
  return task.assigneeId === actor.id || EVENT_MANAGER_ROLES.includes(actor.role);
}

function CreateMenuModal({
  role,
  onClose,
  onChoose,
}: {
  role: string;
  onClose: () => void;
  onChoose: (kind: CreateKind) => void;
}) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="create-menu-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close create menu" />
      <section className="planner-modal create-menu-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">Quick create</span>
            <h2 id="create-menu-title">What do you want to add?</h2>
            <p>Choose one item. The planner will ask only for the information it needs.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body create-option-grid">
          {CREATE_OPTIONS.filter((option) => allowedCreateKinds(role).includes(option.kind)).map((option) => (
            <button key={option.kind} onClick={() => onChoose(option.kind)}>
              <span><Icon name={iconFromGlyph(option.glyph)} /></span>
              <div>
                <strong>{option.title}</strong>
                <small>{option.detail}</small>
              </div>
              <i>→</i>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function EntityComposerModal({
  kind,
  data,
  onClose,
  onSubmit,
}: {
  kind: Exclude<CreateKind, "event">;
  data: PlannerData;
  onClose: () => void;
  onSubmit: (url: string, payload: Record<string, unknown>, success: string) => Promise<void>;
}) {
  const tomorrow = dateKey(new Date(SESSION_BOOT_MS + 86_400_000));
  const nextWeek = dateKey(new Date(SESSION_BOOT_MS + 7 * 86_400_000));
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    title: "",
    description: "",
    dueAt: `${tomorrow}T10:00`,
    assigneeId: data.actor.id,
    eventId: "",
    campaignId: "",
    priority: "Normal",
    startDate: tomorrow,
    endDate: nextWeek,
    objective: "",
    audience: "Internal team",
    channels: "Workspace, email",
    ownerId: data.actor.id,
    publishAt: `${tomorrow}T12:00`,
    platform: "External platform",
    contentType: "Document",
    assetUrl: "",
    url: "",
    kind: "Cloud folder",
    tags: "",
    fullName: "",
    password: "",
    email: "",
    role: "Team Lead",
    department: "General",
  });
  const set = (field: string, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const config = {
    task: {
      eyebrow: "One accountable action",
      title: "Add a task",
      description: "Give it an owner and due time. You can connect it to a milestone.",
      endpoint: "/api/tasks",
      success: "Task created.",
    },
    campaign: {
      eyebrow: "Shared project objective",
      title: "Create a project",
      description: "Start with purpose, dates, and ownership; deliverables can be added later.",
      endpoint: "/api/campaigns",
      success: "Project created.",
    },
    content: {
      eyebrow: "A clear project output",
      title: "Add a deliverable",
      description: "Schedule the output and add an external file link when it is available.",
      endpoint: "/api/content",
      success: "Deliverable created.",
    },
    media: {
      eyebrow: "Links only · no uploads",
      title: "Add an external link",
      description: "Paste a secure link from the platform where the file or reference is stored.",
      endpoint: "/api/media",
      success: "External link added.",
    },
    member: {
      eyebrow: "Secure team access",
      title: "Add a team member",
      description: "Their email is their sign-in name and receives operational notifications.",
      endpoint: "/api/members",
      success: "Team member added.",
    },
  }[kind];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      let payload: Record<string, unknown>;
      if (kind === "task") {
        payload = {
          title: values.title,
          description: values.description,
          dueAt: values.dueAt,
          assigneeId: values.assigneeId,
          eventId: values.eventId || null,
          priority: values.priority,
        };
      } else if (kind === "campaign") {
        payload = {
          title: values.title,
          objective: values.objective,
          startDate: values.startDate,
          endDate: values.endDate,
          ownerId: values.ownerId,
          audience: values.audience,
          channels: values.channels,
          priority: values.priority,
        };
      } else if (kind === "content") {
        payload = {
          title: values.title,
          publishAt: values.publishAt,
          platform: values.platform,
          contentType: values.contentType,
          assigneeId: values.assigneeId,
          eventId: values.eventId || null,
          campaignId: values.campaignId || null,
          assetUrl: values.assetUrl,
        };
      } else if (kind === "media") {
        payload = {
          title: values.title,
          url: values.url,
          kind: values.kind,
          tags: values.tags,
          eventId: values.eventId || null,
          campaignId: values.campaignId || null,
        };
      } else {
        payload = {
          fullName: values.fullName,
          password: values.password,
          email: values.email,
          role: values.role,
          department: values.department,
        };
      }
      await onSubmit(config.endpoint, payload, config.success);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="entity-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close form" />
      <form className="planner-modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">{config.eyebrow}</span>
            <h2 id="entity-title">{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body form-stack">
          {kind === "member" ? (
            <>
              <label className="full-field">
                <span>Full name *</span>
                <input autoFocus value={values.fullName} onChange={(event) => set("fullName", event.target.value)} required />
              </label>
              <div className="form-grid two">
                <label>
                  <span>Email and sign-in name *</span>
                  <input type="email" value={values.email} onChange={(event) => set("email", event.target.value.toLowerCase().trim())} autoComplete="email" required />
                  <small>Notifications are sent to this address</small>
                </label>
                <label>
                  <span>Temporary password *</span>
                  <input type="password" minLength={12} value={values.password} onChange={(event) => set("password", event.target.value)} autoComplete="new-password" required />
                  <small>At least 12 characters</small>
                </label>
              </div>
              <div className="form-grid two">
                <label>
                  <span>Role</span>
                  <select value={values.role} onChange={(event) => set("role", event.target.value)}>
                    <option>Project Manager</option>
                    <option>Team Lead</option>
                    <option>Contributor</option>
                    <option>Contributor</option>
                    <option>Reviewer</option>
                    <option>Viewer</option>
                  </select>
                </label>
                <label>
                  <span>Department</span>
                  <input value={values.department} onChange={(event) => set("department", event.target.value)} />
                </label>
              </div>
            </>
          ) : (
            <label className="full-field">
              <span>{kind === "media" ? "Link title" : `${kind === "content" ? "Deliverable" : kind === "campaign" ? "Project" : kind[0].toUpperCase() + kind.slice(1)} title`} *</span>
              <input autoFocus value={values.title} onChange={(event) => set("title", event.target.value)} required />
            </label>
          )}

          {kind === "task" ? (
            <>
              <label className="full-field">
                <span>What needs to be done?</span>
                <textarea value={values.description} onChange={(event) => set("description", event.target.value)} rows={3} />
              </label>
              <div className="form-grid two">
                <label>
                  <span>Owner *</span>
                  <select value={values.assigneeId} onChange={(event) => set("assigneeId", event.target.value)}>
                    {data.team.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
                  </select>
                </label>
                <label>
                  <span>Due *</span>
                  <input type="datetime-local" value={values.dueAt} onChange={(event) => set("dueAt", event.target.value)} required />
                </label>
              </div>
              <div className="form-grid two">
                <label>
                  <span>Connect to milestone</span>
                  <select value={values.eventId} onChange={(event) => set("eventId", event.target.value)}>
                    <option value="">Independent task (no milestone)</option>
                    {data.events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <PrioritySelect value={values.priority} onChange={(value) => set("priority", value)} />
              </div>
            </>
          ) : null}

          {kind === "campaign" ? (
            <>
              <label className="full-field">
                <span>Objective</span>
                <textarea value={values.objective} onChange={(event) => set("objective", event.target.value)} rows={3} placeholder="What should this project achieve?" />
              </label>
              <div className="form-grid two">
                <label><span>Start date *</span><input type="date" value={values.startDate} onChange={(event) => set("startDate", event.target.value)} required /></label>
                <label><span>End date *</span><input type="date" min={values.startDate} value={values.endDate} onChange={(event) => set("endDate", event.target.value)} required /></label>
              </div>
              <div className="form-grid two">
                <label><span>Audience</span><input value={values.audience} onChange={(event) => set("audience", event.target.value)} /></label>
                <label><span>Channels</span><input value={values.channels} onChange={(event) => set("channels", event.target.value)} /></label>
              </div>
              <div className="form-grid two">
                <label>
                  <span>Owner</span>
                  <select value={values.ownerId} onChange={(event) => set("ownerId", event.target.value)}>
                    {data.team.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
                  </select>
                </label>
                <PrioritySelect value={values.priority} onChange={(value) => set("priority", value)} />
              </div>
            </>
          ) : null}

          {kind === "content" ? (
            <>
              <div className="form-grid two">
                <label><span>Destination</span><select value={values.platform} onChange={(event) => set("platform", event.target.value)}><option>External platform</option><option>Website</option><option>Email</option><option>Client portal</option><option>Cloud storage</option><option>Internal system</option></select></label>
                <label><span>Format</span><select value={values.contentType} onChange={(event) => set("contentType", event.target.value)}><option>Document</option><option>Presentation</option><option>Design</option><option>Spreadsheet</option><option>Video</option><option>Other</option></select></label>
              </div>
              <div className="form-grid two">
                <label><span>Publish date and time *</span><input type="datetime-local" value={values.publishAt} onChange={(event) => set("publishAt", event.target.value)} required /></label>
                <label><span>Owner</span><select value={values.assigneeId} onChange={(event) => set("assigneeId", event.target.value)}>{data.team.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}</select></label>
              </div>
              <ConnectionFields data={data} values={values} set={set} />
              <label className="full-field">
                <span>External file link</span>
                <input type="url" placeholder="https://…" value={values.assetUrl} onChange={(event) => set("assetUrl", event.target.value)} />
                <small>Optional. The original file stays on its existing platform.</small>
              </label>
            </>
          ) : null}

          {kind === "media" ? (
            <>
              <label className="full-field">
                <span>External link *</span>
                <input type="url" placeholder="https://drive.google.com/…" value={values.url} onChange={(event) => set("url", event.target.value)} required />
                <small>Only the URL and description are saved in this planner.</small>
              </label>
              <div className="form-grid two">
                <label><span>Link type</span><select value={values.kind} onChange={(event) => set("kind", event.target.value)}><option>Cloud folder</option><option>Gallery</option><option>Video</option><option>Brief</option><option>Approval</option><option>Brand asset</option></select></label>
                <label><span>Tags</span><input placeholder="client, approved, final" value={values.tags} onChange={(event) => set("tags", event.target.value)} /></label>
              </div>
              <ConnectionFields data={data} values={values} set={set} />
            </>
          ) : null}
        </div>
        <div className="modal-footer">
          <button className="button subtle" type="button" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={submitting}>{submitting ? "Saving…" : config.title}</button>
        </div>
      </form>
    </div>
  );
}

function PrioritySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>Priority</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option>Low</option>
        <option>Normal</option>
        <option>High</option>
        <option>Urgent</option>
      </select>
    </label>
  );
}

function ConnectionFields({
  data,
  values,
  set,
}: {
  data: PlannerData;
  values: Record<string, string>;
  set: (field: string, value: string) => void;
}) {
  return (
    <div className="form-grid two">
      <label>
        <span>Connect to milestone</span>
        <select value={values.eventId} onChange={(event) => set("eventId", event.target.value)}>
          <option value="">No milestone</option>
          {data.events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label>
        <span>Connect to project</span>
        <select value={values.campaignId} onChange={(event) => set("campaignId", event.target.value)}>
          <option value="">No project</option>
          {data.campaigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
    </div>
  );
}

function WorkloadModal({
  member,
  data,
  onClose,
}: {
  member: Member;
  data: PlannerData;
  onClose: () => void;
}) {
  const tasks = data.tasks.filter((task) => task.assigneeId === member.id);
  const assignments = data.assignments.filter((item) => item.memberId === member.id);
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="workload-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close workload" />
      <section className="planner-modal small">
        <div className="modal-header">
          <div>
            <span className="eyebrow">Team workload</span>
            <h2 id="workload-title">{member.fullName}</h2>
            <p>{tasks.filter((task) => task.status !== "Completed").length} open tasks · {assignments.length} milestone assignments</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body workload-modal-list">
          {tasks.length ? tasks.map((task) => (
            <div key={task.id}>
              <span className={`task-dot ${toneFor(task.status)}`} />
              <div><strong>{task.title}</strong><small>{formatDate(task.dueAt)} · {task.status}</small></div>
            </div>
          )) : <EmptyState glyph="✓" title="No assigned tasks" body="This team member has a clear task list." />}
        </div>
        <div className="modal-footer"><span /><button className="button primary" onClick={onClose}>Done</button></div>
      </section>
    </div>
  );
}

function CoverageModal({
  event,
  requirement,
  onClose,
  onSubmit,
}: {
  event: PlannerEvent;
  requirement?: Requirement;
  onClose: () => void;
  onSubmit: (payload: Record<string, boolean>) => Promise<void>;
}) {
  const initial = Object.fromEntries(
    COVERAGE_LABELS.map(([key]) => [key, Boolean(requirement?.[key])]),
  ) as Record<string, boolean>;
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="modal-layer nested-modal" role="dialog" aria-modal="true" aria-labelledby="coverage-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close requirements editor" />
      <form className="planner-modal small" onSubmit={async (formEvent) => {
        formEvent.preventDefault();
        setSubmitting(true);
        try { await onSubmit(values); } finally { setSubmitting(false); }
      }}>
        <div className="modal-header">
          <div><span className="eyebrow">Work requirements</span><h2 id="coverage-title">{event.title}</h2><p>Turn on only the work this milestone actually needs.</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body switch-grid compact-switch-grid">
          {COVERAGE_LABELS.map(([key, label]) => (
            <label key={key} className={values[key] ? "selected" : ""}>
              <span><strong>{label}</strong><small>{values[key] ? "Included" : "Not required"}</small></span>
              <input type="checkbox" checked={values[key]} onChange={(input) => setValues((current) => ({ ...current, [key]: input.target.checked }))} />
              <i />
            </label>
          ))}
        </div>
        <div className="modal-footer"><button className="button subtle" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={submitting}>{submitting ? "Saving…" : "Save requirements"}</button></div>
      </form>
    </div>
  );
}

function AssignmentModal({
  event,
  data,
  assignedMemberIds,
  onClose,
  onSubmit,
}: {
  event: PlannerEvent;
  data: PlannerData;
  assignedMemberIds: string[];
  onClose: () => void;
  onSubmit: (payload: { memberId: string; responsibility: string }) => Promise<void>;
}) {
  const available = data.team.filter((member) => !assignedMemberIds.includes(member.id));
  const [memberId, setMemberId] = useState(available[0]?.id || "");
  const [responsibility, setResponsibility] = useState("Project team");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="modal-layer nested-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close assignment" />
      <form className="planner-modal small" onSubmit={async (formEvent) => {
        formEvent.preventDefault();
        if (!memberId) return;
        setSubmitting(true);
        try { await onSubmit({ memberId, responsibility }); } finally { setSubmitting(false); }
      }}>
        <div className="modal-header">
          <div><span className="eyebrow">Milestone team</span><h2 id="assignment-title">Assign someone</h2><p>{event.title}</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body form-stack">
          {available.length ? (
            <>
              <label className="full-field"><span>Team member *</span><select value={memberId} onChange={(input) => setMemberId(input.target.value)}>{available.map((member) => <option key={member.id} value={member.id}>{member.fullName} · {member.role}</option>)}</select></label>
              <label className="full-field"><span>Responsibility</span><input value={responsibility} onChange={(input) => setResponsibility(input.target.value)} /></label>
            </>
          ) : <EmptyState glyph="✓" title="Everyone is assigned" body="All active team members already have a role on this milestone." />}
        </div>
        <div className="modal-footer"><button className="button subtle" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={!memberId || submitting}>{submitting ? "Assigning…" : "Assign member"}</button></div>
      </form>
    </div>
  );
}

function EventActionsModal({
  event,
  data,
  onClose,
  onSave,
  onDelete,
  canDelete,
}: {
  event: PlannerEvent;
  data: PlannerData;
  onClose: () => void;
  onSave: (payload: Record<string, string>) => Promise<void>;
  onDelete: () => Promise<void>;
  canDelete: boolean;
}) {
  const [title, setTitle] = useState(event.title);
  const [venue, setVenue] = useState(event.venue || "");
  const [categoryId, setCategoryId] = useState(event.categoryId);
  const [priority, setPriority] = useState(event.priority);
  const [status, setStatus] = useState(event.status);
  const [description, setDescription] = useState(event.description || "");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="modal-layer nested-modal" role="dialog" aria-modal="true" aria-labelledby="event-actions-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close milestone editor" />
      <form className="planner-modal" onSubmit={async (formEvent) => {
        formEvent.preventDefault();
        setSubmitting(true);
        try { await onSave({ title, venue, categoryId, priority, status, description }); } finally { setSubmitting(false); }
      }}>
        <div className="modal-header">
          <div><span className="eyebrow">Milestone details</span><h2 id="event-actions-title">Edit milestone</h2><p>Update the essentials or remove this milestone and its connected text records.</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body form-stack">
          <label className="full-field"><span>Milestone title *</span><input value={title} onChange={(input) => setTitle(input.target.value)} required /></label>
          <div className="form-grid two">
            <label><span>Category</span><select value={categoryId} onChange={(input) => setCategoryId(input.target.value)}>{data.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label><span>Venue</span><input value={venue} onChange={(input) => setVenue(input.target.value)} /></label>
          </div>
          <div className="form-grid two">
            <PrioritySelect value={priority} onChange={setPriority} />
            <label><span>Status</span><select value={status} onChange={(input) => setStatus(input.target.value)}><option>Planned</option><option>Confirmed</option><option>In progress</option><option>Completed</option><option>Cancelled</option></select></label>
          </div>
          <label className="full-field"><span>Brief / notes</span><textarea rows={4} value={description} onChange={(input) => setDescription(input.target.value)} /></label>
          {canDelete ? (
            <div className="danger-zone">
              <div><strong>Delete milestone</strong><small>Also removes its tasks, assignments, comments, and linked records.</small></div>
              <button className="button danger-quiet" type="button" onClick={() => { if (window.confirm(`Permanently delete “${event.title}”?`)) void onDelete(); }}>Delete</button>
            </div>
          ) : null}
        </div>
        <div className="modal-footer"><button className="button subtle" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={submitting}>{submitting ? "Saving…" : "Save milestone"}</button></div>
      </form>
    </div>
  );
}

type QuickAddPayload = {
  title: string;
  categoryId: string;
  date: string;
  time: string;
  venue: string;
  opponent: string;
  priority: string;
  requirements: Record<string, boolean>;
  assigneeIds: string[];
  clientRequestId: string;
};

function QuickAddModal({
  data,
  onClose,
  onSubmit,
}: {
  data: PlannerData;
  onClose: () => void;
  onSubmit: (payload: QuickAddPayload) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id || "");
  const [date, setDate] = useState(() =>
    dateKey(new Date(SESSION_BOOT_MS + 86_400_000)),
  );
  const [time, setTime] = useState("19:00");
  const [venue, setVenue] = useState("");
  const [opponent, setOpponent] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [requirements, setRequirements] = useState<Record<string, boolean>>({
    photography: true,
    video: false,
    social: true,
    graphicDesign: false,
    liveUpdates: false,
    interview: false,
    sponsorCoverage: false,
  });
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        categoryId,
        date,
        time,
        venue,
        opponent,
        priority,
        requirements,
        assigneeIds,
        clientRequestId: mutationId(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close quick add" />
      <form className="planner-modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Step {step} of 2</span>
            <h2 id="quick-add-title">{step === 1 ? "Create a milestone" : "Requirements and team"}</h2>
            <p>{step === 1 ? "Only the essentials are required." : "Tasks and reminders will be generated automatically."}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="step-indicator">
          <span className="active" />
          <span className={step === 2 ? "active" : ""} />
        </div>
        {step === 1 ? (
          <div className="modal-body form-stack">
            <label className="full-field">
              <span>Milestone title *</span>
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Client review or product launch"
                required
              />
            </label>
            <div className="form-grid two">
              <label>
                <span>Category *</span>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                  <option>Low</option>
                </select>
              </label>
            </div>
            <div className="form-grid two">
              <label>
                <span>Date *</span>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              </label>
              <label>
                <span>Start time *</span>
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
              </label>
            </div>
            <div className="form-grid two">
              <label>
                <span>Location</span>
                <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Office, online, or location" />
              </label>
              <label>
                <span>Client / stakeholder</span>
                <input value={opponent} onChange={(event) => setOpponent(event.target.value)} placeholder="Optional" />
              </label>
            </div>
            <div className="reminder-callout">
              <span>◷</span>
              <div>
                <strong>Default reminders are on</strong>
                <p>3 days, 2 days, 1 day, and due day · {ACTIVE_TIME_ZONE}</p>
              </div>
              <b>On</b>
            </div>
          </div>
        ) : (
          <div className="modal-body form-stack">
            <fieldset className="switch-grid">
              <legend>What work is required?</legend>
              {[
                ["photography", "Planning", "Brief, scope, and owners"],
                ["video", "Documentation", "Notes, files, and handover"],
                ["social", "Communication", "Team and stakeholder updates"],
                ["graphicDesign", "Design", "Design output and review"],
                ["liveUpdates", "Progress tracking", "Status updates during the work"],
                ["interview", "Stakeholder review", "Feedback and decisions"],
                ["sponsorCoverage", "Final approval", "Formal sign-off before completion"],
              ].map(([key, label, detail]) => (
                <label key={key} className={requirements[key] ? "selected" : ""}>
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(requirements[key])}
                    onChange={(event) =>
                      setRequirements((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  <i />
                </label>
              ))}
            </fieldset>
            <fieldset className="team-picker">
              <legend>Assign project team</legend>
              <p>Select anyone who should receive the milestone and reminders.</p>
              <div>
                {data.team
                  .filter((member) => member.id !== data.actor.id)
                  .map((member) => {
                    const selected = assigneeIds.includes(member.id);
                    return (
                      <button
                        type="button"
                        className={selected ? "selected" : ""}
                        key={member.id}
                        onClick={() =>
                          setAssigneeIds((current) =>
                            selected
                              ? current.filter((id) => id !== member.id)
                              : [...current, member.id],
                          )
                        }
                      >
                        <Avatar member={member} size="small" />
                        <span>
                          <strong>{member.fullName}</strong>
                          <small>{member.role}</small>
                        </span>
                        <i>{selected ? "✓" : "+"}</i>
                      </button>
                    );
                  })}
              </div>
            </fieldset>
          </div>
        )}
        <div className="modal-footer">
          {step === 2 ? (
            <button className="button subtle" type="button" onClick={() => setStep(1)}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button className="button primary" type="submit" disabled={submitting}>
            {step === 1 ? "Continue →" : submitting ? "Creating…" : "Create milestone"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RescheduleModal({
  event,
  onClose,
  onSubmit,
}: {
  event: PlannerEvent;
  onClose: () => void;
  onSubmit: (value: { date: string; time: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(dateKey(event.startsAt));
  const [time, setTime] = useState(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ACTIVE_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(event.startsAt)),
  );
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close reschedule" />
      <form
        className="planner-modal small"
        onSubmit={async (formEvent) => {
          formEvent.preventDefault();
          setSubmitting(true);
          try {
            await onSubmit({ date, time });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Reschedule event</span>
            <h2 id="reschedule-title">{event.title}</h2>
            <p>Old reminders will be cancelled and replacement reminders created.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body form-stack">
          <div className="change-preview">
            <span>
              <small>Current</small>
              <strong>{formatDate(event.startsAt)} · {formatTime(event.startsAt)}</strong>
            </span>
            <i>→</i>
            <span>
              <small>New</small>
              <strong>{date} · {time}</strong>
            </span>
          </div>
          <div className="form-grid two">
            <label>
              <span>New date</span>
              <input type="date" value={date} onChange={(input) => setDate(input.target.value)} required />
            </label>
            <label>
              <span>New time</span>
              <input type="time" value={time} onChange={(input) => setTime(input.target.value)} required />
            </label>
          </div>
          <div className="reminder-callout warning">
            <span>!</span>
            <div>
              <strong>Assigned team members will be notified</strong>
              <p>The previous and new time will appear in the activity log.</p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="button subtle" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={submitting}>
            {submitting ? "Updating…" : "Confirm new time"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TaskRow({
  task,
  onUpdate,
  compact = false,
  onOpenEvent,
  canUpdate = true,
  onDelete,
}: {
  task: Task;
  onUpdate: (task: Task, status: string) => void;
  compact?: boolean;
  onOpenEvent?: () => void;
  canUpdate?: boolean;
  onDelete?: () => void;
}) {
  const due = new Date(task.dueAt).getTime();
  const overdue = due < SESSION_BOOT_MS && task.status !== "Completed";
  const nextStatus =
    task.status === "To do"
      ? "In progress"
      : task.status === "In progress" || task.status === "Changes requested"
        ? "For review"
        : task.status === "For review"
          ? "Completed"
          : "Completed";
  return (
    <div className={`task-row ${compact ? "compact" : ""}`}>
      <button
        className={`task-check ${task.status === "Completed" ? "checked" : ""}`}
        onClick={() =>
          onUpdate(task, task.status === "Completed" ? "To do" : "Completed")
        }
        disabled={!canUpdate}
        aria-label={
          task.status === "Completed" ? `Reopen ${task.title}` : `Complete ${task.title}`
        }
      >
        <Icon name="check" size={16} />
      </button>
      <div className="task-main">
        <button onClick={onOpenEvent} disabled={!onOpenEvent}>
          <strong>{task.title}</strong>
          <span>{task.eventTitle || "Independent task"}</span>
        </button>
        {compact ? (
          <div className="task-mobile-meta">
            <small className={overdue ? "overdue" : ""}>
              {overdue ? "Overdue · " : ""}{formatDate(task.dueAt)}
            </small>
            <StatusBadge status={task.status} />
          </div>
        ) : null}
      </div>
      {!compact ? (
        <>
          <div className="task-owner">
            <span>{task.assigneeInitials || "—"}</span>
            <small>{task.assigneeName || "Unassigned"}</small>
          </div>
          <time className={overdue ? "overdue" : ""}>
            <strong>{relativeDay(task.dueAt)}</strong>
            <small>{formatTime(task.dueAt)}</small>
          </time>
          <StatusBadge status={task.status} />
        </>
      ) : null}
      <div className="task-row-actions">
        {onDelete ? (
          <button
            className="task-delete"
            onClick={onDelete}
            aria-label={`Delete ${task.title}`}
            title="Delete task"
          >
            <Icon name="trash" size={16} />
          </button>
        ) : null}
        <button
          className="task-next"
          onClick={() => onUpdate(task, nextStatus)}
          disabled={!canUpdate || task.status === "Completed"}
          aria-label={`Move ${task.title} to ${nextStatus}`}
        >
          {task.status === "Completed" ? "Done" : "→"}
        </button>
      </div>
    </div>
  );
}

function iconFromGlyph(glyph: string): IconName {
  if (["✓", "Done"].includes(glyph)) return "check";
  if (["!"].includes(glyph)) return "alert";
  if (["☀", "☼"].includes(glyph)) return "sun";
  if (["□"].includes(glyph)) return "calendar";
  if (["◫"].includes(glyph)) return "events";
  if (["◎"].includes(glyph)) return "campaign";
  if (["◇"].includes(glyph)) return "link";
  if (["◌"].includes(glyph)) return "bell";
  if (["↗"].includes(glyph)) return "chart";
  if (["◷"].includes(glyph)) return "clock";
  if (["⌖"].includes(glyph)) return "location";
  if (["♙"].includes(glyph)) return "user";
  if (["→"].includes(glyph)) return "arrow-right";
  if (["○"].includes(glyph)) return "circle";
  return "events";
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const path = (() => {
    switch (name) {
      case "home": return <><path d="M3 10.8 12 3l9 7.8" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></>;
      case "calendar": return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>;
      case "events": return <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>;
      case "check": return <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 2.6 2.6L16.5 9" /></>;
      case "campaign": return <><path d="m4 13 2-2h4l7-5v12l-7-5H6Z" /><path d="M7 13v6h4l-1-6M20 9v6" /></>;
      case "link": return <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></>;
      case "bell": return <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>;
      case "chart": return <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>;
      case "users": return <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>;
      case "settings": return <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.02A1.7 1.7 0 0 0 10 3.07V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.02A1.7 1.7 0 0 0 20.93 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>;
      case "plus": return <path d="M12 5v14M5 12h14" />;
      case "more": return <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>;
      case "logout": return <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>;
      case "menu": return <path d="M4 7h16M4 12h16M4 17h16" />;
      case "search": return <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>;
      case "close": return <path d="m6 6 12 12M18 6 6 18" />;
      case "alert": return <><path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>;
      case "sun": return <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>;
      case "clock": return <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>;
      case "location": return <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>;
      case "user": return <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>;
      case "arrow-right": return <path d="M5 12h14m-5-5 5 5-5 5" />;
      case "circle": return <circle cx="12" cy="12" r="7" />;
      case "edit": return <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>;
      case "trash": return <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>;
    }
  })();
  return <svg className="app-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>;
}

function BrandMark({
  variant = "colour",
  version,
}: {
  variant?: LogoVariant;
  version?: string;
}) {
  const apiSource = `/api/brand/logo?variant=${variant}${
    version ? `&v=${encodeURIComponent(version)}` : ""
  }`;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const useFallback = failedSource === apiSource;

  return (
    <span className={`brand-mark ${variant}`} aria-hidden="true">
      <img
        src={useFallback ? `/branding/logo-${variant}.png` : apiSource}
        alt=""
        onError={() => {
          if (!useFallback) setFailedSource(apiSource);
        }}
      />
    </span>
  );
}

function Avatar({
  member,
  size = "medium",
}: {
  member: Pick<Member, "fullName" | "initials" | "avatarColour">;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span
      className={`avatar ${size}`}
      style={{ backgroundColor: member.avatarColour }}
      title={member.fullName}
      aria-label={member.fullName}
    >
      {member.initials}
    </span>
  );
}

function AvatarStack({
  assignments,
  dark = false,
  tiny = false,
}: {
  assignments: Assignment[];
  dark?: boolean;
  tiny?: boolean;
}) {
  if (!assignments.length) return <span className="unassigned-avatar"><Icon name="plus" size={15} /></span>;
  return (
    <span className={`avatar-stack ${dark ? "dark" : ""} ${tiny ? "tiny" : ""}`}>
      {assignments.slice(0, 3).map((assignment) => (
        <span
          key={assignment.id}
          style={{ backgroundColor: assignment.avatarColour }}
          title={`${assignment.fullName} · ${assignment.responsibility}`}
        >
          {assignment.initials}
        </span>
      ))}
      {assignments.length > 3 ? <b>+{assignments.length - 3}</b> : null}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${toneFor(status)}`}>{status}</span>;
}

function ReadinessLine({ event }: { event: PlannerEvent }) {
  return (
    <div className={`readiness-line ${toneFor(event.readiness)}`}>
      <span><Icon name={event.readiness === "Ready" ? "check" : event.readiness === "In progress" ? "chart" : "alert"} size={16} /></span>
      <div>
        <strong>{event.readiness}</strong>
        <small>{event.readinessReason}</small>
      </div>
    </div>
  );
}

function MetricCard({
  glyph,
  value,
  label,
  detail,
  tone,
}: {
  glyph: string;
  value: number;
  label: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${tone}`}><Icon name={iconFromGlyph(glyph)} size={22} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function PanelHeading({
  title,
  meta,
  link,
  onLink,
}: {
  title: string;
  meta?: string;
  link?: string;
  onLink?: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </div>
      {link ? <button onClick={onLink}>{link} →</button> : null}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </section>
  );
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="section-title">
      <h3>{title}</h3>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

function DetailItem({
  label,
  value,
  glyph,
}: {
  label: string;
  value: string;
  glyph: string;
}) {
  return (
    <div>
      <span><Icon name={iconFromGlyph(glyph)} size={18} /></span>
      <p>
        <small>{label}</small>
        <strong>{value}</strong>
      </p>
    </div>
  );
}

function EmptyState({
  glyph,
  title,
  body,
  dark = false,
}: {
  glyph: string;
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <div className={`empty-state ${dark ? "dark" : ""}`}>
      <span><Icon name={iconFromGlyph(glyph)} size={24} /></span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <span className="progress-bar" aria-label={`${Math.round(value)}% complete`}>
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  );
}

function ReportLegend({
  colour,
  label,
  value,
}: {
  colour: string;
  label: string;
  value: number;
}) {
  return (
    <span>
      <i style={{ backgroundColor: colour }} />
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function FirstTimeSetupView({
  csrfToken,
  onComplete,
}: {
  csrfToken: string;
  onComplete: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSetupError(null);
    if (newPassword !== confirmPassword) {
      setSetupError("The new passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/account/complete-setup", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ fullName, workspaceName, email, newPassword }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSetupError(payload.error || "The account setup could not be completed.");
        return;
      }
      await onComplete();
    } catch {
      setSetupError("The workspace could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page setup-page">
      <section className="login-story" aria-label="Project Workspace introduction">
        <div className="login-story-brand">
          <BrandMark variant="white" />
          <span>
            <strong>Project Workspace</strong>
            <small>Flexible work management</small>
          </span>
        </div>
        <div className="login-story-copy">
          <p className="eyebrow light">One secure setup</p>
          <h1>Make this workspace yours.</h1>
          <p>
            Replace the temporary administrator login, name your workspace, and
            connect your email before anyone starts working.
          </p>
        </div>
        <div className="login-proof">
          <span><i><Icon name="check" size={14} /></i> Your temporary login is retired</span>
          <span><i><Icon name="check" size={14} /></i> Email reminders are enabled</span>
          <span><i><Icon name="check" size={14} /></i> Branding stays editable later</span>
        </div>
        <p className="login-story-foot">Administrator setup · required once</p>
      </section>
      <section className="login-form-side">
        <div className="login-card setup-card">
          <p className="eyebrow">First-time setup</p>
          <h2>Create your administrator account</h2>
          <p className="login-intro">These details replace the public temporary credentials immediately.</p>
          <form className="login-form setup-form" onSubmit={submit}>
            <label><span>Your full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required disabled={submitting} /></label>
            <label><span>Workspace or organization name</span><input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Acme Projects" required disabled={submitting} /></label>
            <label><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.com" required disabled={submitting} /></label>
            <label><span>New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={submitting} /><small>At least 12 characters; do not reuse Admin@123.</small></label>
            <label><span>Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={submitting} /></label>
            {setupError ? <div className="login-error" role="alert"><span>!</span>{setupError}</div> : null}
            <button className="button primary login-submit" disabled={submitting}>{submitting ? "Securing workspace…" : "Finish secure setup"}<span>→</span></button>
          </form>
        </div>
      </section>
    </main>
  );
}

function LoginView({
  onSignedIn,
}: {
  onSignedIn: () => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [initialSetupAvailable, setInitialSetupAvailable] = useState(false);
  const [loginBranding, setLoginBranding] = useState({
    productName: "Project Workspace",
    workspaceName: "My Workspace",
    primaryColour: "#2563EB",
    accentColour: "#14B8A6",
    logoVersion: "",
  });

  useEffect(() => {
    fetch("/api/auth/setup", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: {
        initialSetupAvailable?: boolean;
        branding?: Partial<typeof loginBranding>;
      }) => {
        setInitialSetupAvailable(Boolean(payload.initialSetupAvailable));
        if (payload.branding) {
          setLoginBranding((current) => ({ ...current, ...payload.branding }));
        }
      })
      .catch(() => setInitialSetupAvailable(false));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setLoginError(payload.error || "Sign in failed. Please try again.");
        return;
      }
      await onSignedIn();
    } catch {
      setLoginError("The workspace could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fillInitialAccount = () => {
    setUsername("admin");
    setPassword("Admin@123");
    setLoginError(null);
  };

  return (
    <main
      className="login-page"
      style={{
        "--club-primary": loginBranding.primaryColour,
        "--club-accent": loginBranding.accentColour,
      } as React.CSSProperties}
    >
      <section className="login-story" aria-label="Project Workspace introduction">
        <div className="login-story-brand">
          <BrandMark variant="white" version={loginBranding.logoVersion} />
          <span>
            <strong>{loginBranding.productName}</strong>
            <small>{loginBranding.workspaceName}</small>
          </span>
        </div>
        <div className="login-story-copy">
          <p className="eyebrow light">One plan. One accountable team.</p>
          <h1>Turn complex work into clear progress.</h1>
          <p>
            Coordinate projects, milestones, tasks, approvals, and shared links from
            one focused workspace.
          </p>
        </div>
        <div className="login-proof">
          <span><i><Icon name="check" size={14} /></i> Role-based access</span>
          <span><i><Icon name="check" size={14} /></i> Secure server sessions</span>
          <span><i><Icon name="check" size={14} /></i> Live operational records</span>
        </div>
        <p className="login-story-foot">Flexible for teams in every timezone</p>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          <div className="login-mobile-brand">
            <BrandMark version={loginBranding.logoVersion} />
            <strong>{loginBranding.productName}</strong>
          </div>
          <p className="eyebrow">Protected workspace</p>
          <h2>Welcome back</h2>
          <p className="login-intro">
            Sign in to open your team’s projects and priorities.
          </p>

          <form className="login-form" onSubmit={submit}>
            <label>
              <span>Username or email</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="admin or name@company.com"
                required
                disabled={submitting}
              />
            </label>
            <label>
              <span>Password</span>
              <span className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            {loginError ? (
              <div className="login-error" role="alert">
                <span>!</span>
                {loginError}
              </div>
            ) : null}
            <button className="button primary login-submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in securely"}
              {!submitting ? <span>→</span> : null}
            </button>
          </form>

          {initialSetupAvailable ? (
            <div className="test-account-card">
              <div>
                <span className="test-badge">FIRST LOGIN</span>
                <strong>Temporary administrator access</strong>
                <p>Sign in once, then you must replace these public credentials.</p>
              </div>
              <dl>
                <div>
                  <dt>Username</dt>
                  <dd>admin</dd>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd>Admin@123</dd>
                </div>
              </dl>
              <button type="button" onClick={fillInitialAccount}>
                Use temporary credentials
              </button>
            </div>
          ) : null}

          <p className="login-security-note">
            Your session is protected with an HTTP-only cookie and expires automatically.
          </p>
        </div>
      </section>
    </main>
  );
}

function PlannerLoading() {
  return (
    <main className="planner-loading" role="status">
      <div className="loading-brand">
        <BrandMark />
        <div>
          <strong>Project Workspace</strong>
          <span>Loading your project workspace…</span>
        </div>
      </div>
      <div className="loading-layout">
        <span className="loading-sidebar" />
        <div>
          <span className="loading-line wide" />
          <span className="loading-line" />
          <div className="loading-cards">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </main>
  );
}

function buildCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const saturdayBasedDay = (first.getDay() + 1) % 7;
  const start = new Date(year, monthIndex, 1 - saturdayBasedDay);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inMonth: date.getMonth() === monthIndex };
  });
}

function dayPart() {
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: ACTIVE_TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatNotificationTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return formatDate(value);
}

function readPendingMutations(): PendingMutation[] {
  try {
    return JSON.parse(localStorage.getItem("project-workspace-pending") || "[]") as PendingMutation[];
  } catch {
    return [];
  }
}

function writePendingMutations(items: PendingMutation[]) {
  localStorage.setItem("project-workspace-pending", JSON.stringify(items));
}
