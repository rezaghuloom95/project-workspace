import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../hostinger-backend/api/index.php", import.meta.url), "utf8");
const mailer = await readFile(new URL("../hostinger-backend/api/mailer.php", import.meta.url), "utf8");
const emailCron = await readFile(new URL("../hostinger-backend/api/cron-email.php", import.meta.url), "utf8");
const planner = await readFile(new URL("../app/ClubPlanner.tsx", import.meta.url), "utf8");
const friendlyStyles = await readFile(new URL("../app/friendly.css", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const rootRules = await readFile(new URL("../hostinger-backend/.htaccess", import.meta.url), "utf8");
const storageRules = await readFile(new URL("../hostinger-backend/storage/.htaccess", import.meta.url), "utf8");
const colourLogo = await readFile(new URL("../public/branding/logo-colour.png", import.meta.url));
const blackLogo = await readFile(new URL("../public/branding/logo-black.png", import.meta.url));
const whiteLogo = await readFile(new URL("../public/branding/logo-white.png", import.meta.url));
const jakartaSans = await readFile(new URL("../public/fonts/PlusJakartaSans-Variable.ttf", import.meta.url));

test("Hostinger API is same-host, file-backed, and concurrency safe", () => {
  assert.match(api, /const STORE_FILE = __DIR__ \. '\/\.\.\/storage\/data\.json'/);
  assert.match(api, /flock\(\$handle, LOCK_EX\)/);
  assert.match(api, /ftruncate\(\$handle, 0\)/);
  assert.match(api, /JSON_PRETTY_PRINT/);
  assert.doesNotMatch(api, /mysql|postgres|mongodb|firebase/i);
});

test("Hostinger authentication and mutations are protected", () => {
  assert.match(api, /password_hash\(INITIAL_ADMIN_PASSWORD, PASSWORD_DEFAULT\)/);
  assert.match(api, /password_verify\(/);
  assert.match(api, /session_regenerate_id\(true\)/);
  assert.match(api, /require_csrf\(\)/);
  assert.match(api, /HTTP_X_IDEMPOTENCY_KEY/);
  assert.match(api, /failedAttempts/);
});

test("temporary administrator setup forces a private email and password", () => {
  assert.match(api, /const INITIAL_ADMIN_USERNAME = 'admin'/);
  assert.match(api, /const INITIAL_ADMIN_PASSWORD = 'Admin@123'/);
  assert.match(api, /'username' => \$email/);
  assert.match(api, /'emailNotifications' => 1/);
  assert.match(api, /'mustChangeCredentials' => 1/);
  assert.match(api, /account\/complete-setup/);
  assert.match(api, /FILTER_VALIDATE_EMAIL/);
  assert.match(planner, /body: JSON\.stringify\(\{ username, password \}\)/);
  assert.match(planner, /Email and sign-in name/);
  assert.doesNotMatch(planner, /<span>Username \*<\/span>/);
});

test("SMTP delivery is server-only, configurable, branded, retried, and cron-driven", () => {
  assert.match(api, /require_once __DIR__ \. '\/mailer\.php'/);
  assert.match(mailer, /'smtpHost' => 'smtp\.hostinger\.com'/);
  assert.match(api, /\$smtpUsername = strtolower/);
  assert.match(api, /\$fromAddress = strtolower/);
  assert.match(mailer, /'smtpPassword' => ''/);
  assert.match(mailer, /function planner_smtp_send/);
  assert.match(mailer, /Content-Type: multipart\/alternative/);
  assert.match(mailer, /function planner_email_html/);
  assert.match(mailer, /Open Project Workspace/);
  assert.match(mailer, /if \(\$attempts >= 3\)/);
  assert.match(emailCron, /PHP_SAPI !== 'cli'/);
  assert.match(emailCron, /flock\(\$handle, LOCK_EX\)/);
  assert.match(emailCron, /planner_materialise_due_reminders/);
  assert.match(emailCron, /planner_process_email_queue/);
  assert.doesNotMatch(planner, /smtpPassword[^]*console\./);
});

test("task emails are milestone-based and permanently deduplicated", () => {
  assert.match(mailer, /function planner_materialise_task_due_notifications/);
  assert.match(mailer, /in_array\(\$daysRemaining, \[3, 2, 1, 0\], true\)/);
  assert.match(mailer, /\$stage = 'overdue'/);
  assert.match(mailer, /'task-reminder'/);
  assert.match(mailer, /\$minimumAssignmentGap = 6 \* 60 \* 60/);
  assert.match(mailer, /\$assignedUtc < \$scheduledUtc/);
  assert.match(mailer, /\$scheduledUtc->getTimestamp\(\) - \$assignedUtc->getTimestamp\(\)/);
  assert.match(mailer, /function planner_suppress_duplicate_assignment_emails/);
  assert.match(mailer, /function planner_close_legacy_stuck_email_queue/);
  assert.match(mailer, /emailQueuePersistenceVersion/);
  assert.match(mailer, /foreach \(\$store\['emailQueue'\] as &\$queued\)/);
  assert.match(mailer, /foreach \(\$store\['reminders'\] as &\$reminder\)/);
  assert.doesNotMatch(mailer, /foreach \(\$store\[(?:'emailQueue'|'reminders')\] \?\? \[\] as &/);
  assert.match(emailCron, /planner_suppress_duplicate_assignment_emails/);
  assert.match(emailCron, /planner_close_legacy_stuck_email_queue/);
  assert.match(api, /'task-assigned:' \. \$task\['id'\]/);
  assert.match(api, /'assignedAt' => now_iso\(\)/);
  assert.match(api, /cancel_pending_task_emails/);
  assert.match(planner, /Passed reminder times are skipped/);
});

test("production starts with no operational demo records", () => {
  for (const key of [
    "events",
    "assignments",
    "tasks",
    "campaigns",
    "content",
    "notifications",
    "media",
  ]) {
    assert.match(api, new RegExp(`'${key}' => \\[\\]`));
  }
});

test("media workflow stores external links and exposes no upload control", () => {
  assert.match(api, /valid_url\(\$input\['url'\]/);
  assert.match(planner, /Only the URL and description are saved/);
  assert.doesNotMatch(planner, /media[^]{0,500}type=["']file["']/i);
});

test("workspace logos are bundled and replacements are administrator-only", () => {
  assert.ok(colourLogo.length > 5_000);
  assert.ok(blackLogo.length > 5_000);
  assert.ok(whiteLogo.length > 5_000);
  assert.match(api, /const BRAND_STORAGE_DIR = __DIR__ \. '\/\.\.\/storage\/branding'/);
  assert.match(api, /\$route === 'brand\/logo'/);
  assert.match(api, /\$route === 'branding\/logo'/);
  assert.match(api, /require_roles\(\$actor, \['Administrator'\]\)/);
  assert.match(api, /getimagesizefromstring\(\$binary\)/);
  assert.match(api, /strlen\(\$binary\) > 1_000_000/);
  assert.match(planner, /\/api\/branding\/logo/);
  assert.match(planner, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(planner, /data\.actor\.role === "Administrator"/);
  assert.match(mailer, /api\/brand\/logo\?variant=white/);
});

test("Apache rules protect storage, route the API, and enforce HTTPS", () => {
  assert.match(rootRules, /RewriteRule \^api/);
  assert.match(rootRules, /RewriteCond %\{HTTPS\} !=on/);
  assert.match(rootRules, /Content-Security-Policy/);
  assert.match(rootRules, /Require all denied/);
  assert.match(storageRules, /Require all denied/);
});

test("all primary production creation flows are wired", () => {
  for (const endpoint of [
    '"/api/events"',
    '"/api/tasks"',
    '"/api/campaigns"',
    '"/api/content"',
    '"/api/media"',
    '"/api/members"',
  ]) {
    assert.match(planner, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(planner, /CreateMenuModal/);
  assert.match(planner, /EntityComposerModal/);
  assert.match(planner, /EventActionsModal/);
});

test("friendly work-management interface is accessible and responsive", () => {
  assert.match(planner, /type IconName =/);
  assert.match(planner, /<Icon name=\{item\.icon\}/);
  assert.match(friendlyStyles, /--friendly-blue: #579bfc/);
  assert.match(friendlyStyles, /:focus-visible/);
  assert.match(friendlyStyles, /@media \(max-width: 760px\)/);
  assert.match(friendlyStyles, /prefers-reduced-motion: reduce/);
  assert.match(friendlyStyles, /min-height: 44px/);
});

test("Plus Jakarta Sans typography is self-hosted with accessible font loading", () => {
  assert.ok(jakartaSans.length > 100_000);
  assert.match(friendlyStyles, /font-family: "Plus Jakarta Sans"/);
  assert.match(friendlyStyles, /PlusJakartaSans-Variable\.ttf/);
  assert.match(friendlyStyles, /font-display: swap/);
});

test("administrators can edit and safely delete users without deleting assigned work", () => {
  assert.match(api, /function unassign_member_work/);
  assert.match(api, /\$method === 'DELETE'.*members\/\(\[\^\/\]\+\)/s);
  assert.match(api, /You cannot delete the account you are currently using/);
  assert.match(api, /\$item\[\$field\] = null/);
  assert.match(api, /'member\.deleted'/);
  assert.match(planner, /MemberEditModal/);
  assert.match(planner, /MemberDeleteModal/);
  assert.match(planner, /UnassignedWorkPanel/);
  assert.match(planner, /Delete user/);
});

test("administrators, project managers, and team leads can delete operational records", () => {
  const managerRoles = /\['Administrator', 'Project Manager', 'Team Lead'\]/;
  assert.match(api, /function cascade_task_delete/);
  assert.match(api, /function cascade_campaign_delete/);
  assert.match(api, new RegExp(`events\\/\\(\\[\\^\\/\\]\\+\\).*?DELETE.*?require_roles\\(\\$actor, ${managerRoles.source}\\)`, "s"));
  assert.match(api, new RegExp(`tasks\\/\\(\\[\\^\\/\\]\\+\\).*?DELETE.*?require_roles\\(\\$actor, ${managerRoles.source}\\)`, "s"));
  assert.match(api, /campaign\.deleted/);
  assert.match(planner, /EVENT_MANAGER_ROLES\.includes\(data\.actor\.role\)/);
  assert.match(planner, /Delete task/);
  assert.match(planner, /connected tasks, deliverables, and links/);
});

test("service worker refreshes the UI safely at root or subfolder scope", () => {
  assert.match(serviceWorker, /project-workspace-v1/);
  assert.match(serviceWorker, /new URL\(self\.registration\.scope\)/);
  assert.match(serviceWorker, /APP_PATH.*api/);
  assert.match(serviceWorker, /caches\.delete/);
});
