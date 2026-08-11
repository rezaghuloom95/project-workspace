<?php

declare(strict_types=1);

require_once __DIR__ . '/mailer.php';

const STORE_FILE = __DIR__ . '/../storage/data.json';
const BRAND_STORAGE_DIR = __DIR__ . '/../storage/branding';
const BRAND_DEFAULT_DIR = __DIR__ . '/../brand-defaults';
const INITIAL_ADMIN_USERNAME = 'admin';
const INITIAL_ADMIN_PASSWORD = 'Admin@123';
const SESSION_SECONDS = 604800;

ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('session.gc_maxlifetime', (string) SESSION_SECONDS);

$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_set_cookie_params([
    'lifetime' => SESSION_SECONDS,
    'path' => '/',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_name('project_workspace_session');
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

final class ApiResponse extends RuntimeException
{
    public function __construct(
        public readonly mixed $payload,
        public readonly int $status = 200,
    ) {
        parent::__construct('api-response');
    }
}

function emit_response(mixed $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function respond(mixed $payload, int $status = 200): never
{
    if (!empty($GLOBALS['planner_store_active'])) {
        throw new ApiResponse($payload, $status);
    }
    emit_response($payload, $status);
}

function fail(string $message, int $status = 400): never
{
    respond(['error' => $message], $status);
}

function uid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function clean_text(mixed $value, int $max = 500): string
{
    $text = trim((string) ($value ?? ''));
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    return function_exists('mb_substr')
        ? mb_substr($text, 0, $max)
        : substr($text, 0, $max);
}

function valid_url(mixed $value): string
{
    $url = clean_text($value, 1200);
    if ($url === '') {
        return '';
    }
    if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $url)) {
        fail('Enter a complete link beginning with http:// or https://.');
    }
    return $url;
}

function valid_colour(mixed $value, string $fallback = '#68736F'): string
{
    $colour = strtoupper(clean_text($value, 20));
    return preg_match('/^#[0-9A-F]{6}$/', $colour) ? $colour : $fallback;
}

function application_url_from_request(): string
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if (!preg_match('/^[a-z0-9.-]+(?::\d+)?$/', $host)) {
        return '';
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
    $base = preg_replace('#/api(?:/.*)?$#', '', $path) ?? '';
    return ($secure ? 'https://' : 'http://') . $host . rtrim($base, '/') . '/';
}

function brand_variant(mixed $value): string
{
    $variant = strtolower(clean_text($value, 20));
    return in_array($variant, ['colour', 'black', 'white'], true) ? $variant : 'colour';
}

function brand_logo_file(string $variant): ?string
{
    foreach (['png', 'jpg', 'webp'] as $extension) {
        $custom = BRAND_STORAGE_DIR . '/logo-' . $variant . '.' . $extension;
        if (is_file($custom) && is_readable($custom)) {
            return $custom;
        }
    }
    $default = BRAND_DEFAULT_DIR . '/logo-' . $variant . '.png';
    return is_file($default) && is_readable($default) ? $default : null;
}

function emit_brand_logo(string $variant): never
{
    $file = brand_logo_file($variant);
    if ($file === null) {
        fail('The requested logo is not available.', 404);
    }
    $image = @getimagesize($file);
    $mime = is_array($image) ? (string) ($image['mime'] ?? '') : '';
    if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) {
        fail('The stored logo is not a supported image.', 500);
    }
    $etag = '"' . (sha1_file($file) ?: (string) filemtime($file)) . '"';
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }
    session_write_close();
    header_remove('Content-Type');
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string) filesize($file));
    header('Content-Disposition: inline; filename="workspace-logo-' . $variant . '"');
    header('Cache-Control: public, max-age=300');
    header('ETag: ' . $etag);
    readfile($file);
    exit;
}

function store_brand_logo(string $variant, string $binary, string $mime): void
{
    $extensions = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
    ];
    $extension = $extensions[$mime] ?? null;
    if ($extension === null) {
        fail('Choose a PNG, JPG, or WebP logo.');
    }
    if (!is_dir(BRAND_STORAGE_DIR) && !mkdir(BRAND_STORAGE_DIR, 0750, true) && !is_dir(BRAND_STORAGE_DIR)) {
        fail('The logo folder could not be created. Check the storage folder permissions.', 500);
    }
    $temporary = tempnam(BRAND_STORAGE_DIR, 'logo-');
    if ($temporary === false || file_put_contents($temporary, $binary, LOCK_EX) === false) {
        if (is_string($temporary) && is_file($temporary)) {
            unlink($temporary);
        }
        fail('The logo could not be saved. Check the storage folder permissions.', 500);
    }
    chmod($temporary, 0640);
    $target = BRAND_STORAGE_DIR . '/logo-' . $variant . '.' . $extension;
    if (!rename($temporary, $target)) {
        unlink($temporary);
        fail('The logo could not be activated.', 500);
    }
    foreach (array_values(array_diff(['png', 'jpg', 'webp'], [$extension])) as $oldExtension) {
        $oldFile = BRAND_STORAGE_DIR . '/logo-' . $variant . '.' . $oldExtension;
        if (is_file($oldFile)) {
            unlink($oldFile);
        }
    }
}

function body(): array
{
    $limit = ($GLOBALS['planner_route'] ?? '') === 'branding/logo'
        ? 1_600_000
        : 1_048_576;
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) {
        fail(
            ($GLOBALS['planner_route'] ?? '') === 'branding/logo'
                ? 'Keep each logo under 1 MB.'
                : 'This request is too large. Store files on another platform and add their links instead.',
            413,
        );
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail('The submitted information could not be read.');
    }
    return $data;
}

function default_categories(): array
{
    $items = [
        ['Project kickoff', '#2563EB'],
        ['Meeting', '#0F766E'],
        ['Deadline', '#DC2626'],
        ['Review', '#7C3AED'],
        ['Presentation', '#0891B2'],
        ['Launch', '#EA580C'],
        ['Client session', '#B45309'],
        ['Workshop', '#4F46E5'],
        ['Training', '#047857'],
        ['Research', '#475569'],
        ['Operations', '#334155'],
        ['Marketing', '#BE185D'],
        ['Other', '#68736F'],
    ];
    return array_map(
        fn(array $item, int $index): array => [
            'id' => uid(),
            'name' => $item[0],
            'colour' => $item[1],
            'sortOrder' => $index + 1,
            'enabled' => 1,
        ],
        $items,
        array_keys($items),
    );
}

function initial_store(): array
{
    $adminId = uid();
    return [
        'schemaVersion' => 4,
        'organisation' => [
            'id' => uid(),
            'name' => 'My Workspace',
            'productName' => 'Project Workspace',
            'timezone' => 'UTC',
            'language' => 'en',
            'primaryColour' => '#2563EB',
            'accentColour' => '#14B8A6',
            'logoVersion' => 'bundled-v1',
            'settings' => [
                'weekStartsOn' => 'Monday',
                'timeFormat' => '24-hour',
                'reminderTimes' => [
                    '3 days · 10:00',
                    '2 days · 10:00',
                    '1 day · 10:00',
                    'Due day · 08:00',
                ],
            ],
        ],
        'users' => [[
            'id' => $adminId,
            'username' => INITIAL_ADMIN_USERNAME,
            'passwordHash' => password_hash(INITIAL_ADMIN_PASSWORD, PASSWORD_DEFAULT),
            'email' => '',
            'emailNotifications' => 0,
            'mustChangeCredentials' => 1,
            'fullName' => 'Administrator',
            'initials' => 'AD',
            'role' => 'Administrator',
            'department' => 'Administration',
            'avatarColour' => '#2563EB',
            'active' => 1,
            'failedAttempts' => 0,
            'lockedUntil' => null,
            'createdAt' => now_iso(),
        ]],
        'categories' => default_categories(),
        'events' => [],
        'assignments' => [],
        'requirements' => [],
        'tasks' => [],
        'campaigns' => [],
        'content' => [],
        'notifications' => [],
        'emailQueue' => [],
        'reminders' => [],
        'shotItems' => [],
        'equipmentItems' => [],
        'comments' => [],
        'media' => [],
        'activity' => [],
        'idempotency' => [],
    ];
}

function normalise_store(array $store): array
{
    if (!isset($store['organisation'], $store['users'], $store['categories'])) {
        return initial_store();
    }
    $store['schemaVersion'] = 4;
    foreach ([
        'events',
        'assignments',
        'requirements',
        'tasks',
        'campaigns',
        'content',
        'notifications',
        'emailQueue',
        'reminders',
        'shotItems',
        'equipmentItems',
        'comments',
        'media',
        'activity',
        'idempotency',
    ] as $key) {
        if (!isset($store[$key]) || !is_array($store[$key])) {
            $store[$key] = [];
        }
    }
    $store['organisation']['productName'] = clean_text(
        $store['organisation']['productName'] ?? 'Project Workspace',
        120,
    ) ?: 'Project Workspace';
    $store['organisation']['timezone'] = in_array(
        (string) ($store['organisation']['timezone'] ?? ''),
        timezone_identifiers_list(),
        true,
    ) ? $store['organisation']['timezone'] : 'UTC';
    foreach ($store['users'] as &$user) {
        $email = strtolower(trim((string) ($user['email'] ?? '')));
        if (
            strtolower((string) ($user['username'] ?? '')) === 'testadmin'
            && ($email === '' || str_ends_with($email, '.test'))
        ) {
            $email = '';
        }
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $user['email'] = $email;
            $user['username'] = $email;
        }
        if (!array_key_exists('emailNotifications', $user)) {
            $user['emailNotifications'] = 1;
        }
        if (!array_key_exists('mustChangeCredentials', $user)) {
            $user['mustChangeCredentials'] = 0;
        }
    }
    unset($user);
    return $store;
}

function with_store(callable $callback): mixed
{
    $directory = dirname(STORE_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        fail('The application storage folder is not writable.', 500);
    }

    $handle = fopen(STORE_FILE, 'c+');
    if ($handle === false) {
        fail('The application cannot open its storage file.', 500);
    }
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        fail('The application storage is temporarily busy.', 503);
    }

    rewind($handle);
    $raw = stream_get_contents($handle);
    $decoded = $raw ? json_decode($raw, true) : null;
    if (
        trim((string) $raw) !== ''
        && trim((string) $raw) !== '{}'
        && !is_array($decoded)
    ) {
        flock($handle, LOCK_UN);
        fclose($handle);
        fail('The application data file needs to be restored from a backup.', 500);
    }
    $store = is_array($decoded) && !empty($decoded)
        ? normalise_store($decoded)
        : initial_store();

    $GLOBALS['planner_store_active'] = true;
    $GLOBALS['planner_idempotency_pending'] = null;
    $response = null;
    $unexpectedError = null;
    $result = null;
    try {
        $result = call_user_func_array($callback, [&$store]);
    } catch (ApiResponse $apiResponse) {
        $response = $apiResponse;
    } catch (Throwable $error) {
        $unexpectedError = $error;
        error_log('Project Workspace API: ' . $error->getMessage());
    }

    if (
        $unexpectedError === null
        && (!($response instanceof ApiResponse) || $response->status < 400)
        && is_array($GLOBALS['planner_idempotency_pending'] ?? null)
    ) {
        array_unshift($store['idempotency'], $GLOBALS['planner_idempotency_pending']);
        $store['idempotency'] = array_slice($store['idempotency'], 0, 300);
    }

    if ($unexpectedError === null) {
        $encoded = json_encode(
            $store,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
        );
        if ($encoded === false) {
            $unexpectedError = new RuntimeException('The application data could not be encoded.');
        } else {
            if (trim((string) $raw) !== '') {
                $backupWritten = @file_put_contents(
                    dirname(STORE_FILE) . '/data.backup.json',
                    (string) $raw,
                    LOCK_EX,
                );
                if ($backupWritten === false) {
                    error_log('Project Workspace API: the automatic data backup could not be written.');
                }
            }
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, $encoded . PHP_EOL);
            fflush($handle);
        }
    }

    flock($handle, LOCK_UN);
    fclose($handle);
    $GLOBALS['planner_store_active'] = false;
    $GLOBALS['planner_idempotency_pending'] = null;

    if ($unexpectedError !== null) {
        error_log('Project Workspace API: ' . $unexpectedError->getMessage());
        if ($unexpectedError instanceof InvalidArgumentException) {
            emit_response(['error' => $unexpectedError->getMessage()], 400);
        }
        emit_response(['error' => 'The requested action could not be completed. Please try again.'], 500);
    }
    if ($response instanceof ApiResponse) {
        emit_response($response->payload, $response->status);
    }
    return $result;
}

function find_index(array $items, string $id): int
{
    foreach ($items as $index => $item) {
        if (($item['id'] ?? '') === $id) {
            return $index;
        }
    }
    return -1;
}

function find_user(array $store, string $id): ?array
{
    $index = find_index($store['users'], $id);
    return $index >= 0 ? $store['users'][$index] : null;
}

function public_user(array $user): array
{
    return [
        'id' => $user['id'],
        'email' => $user['email'] ?? '',
        'emailNotifications' => (int) ($user['emailNotifications'] ?? 1),
        'fullName' => $user['fullName'],
        'initials' => $user['initials'],
        'role' => $user['role'],
        'department' => $user['department'],
        'avatarColour' => $user['avatarColour'],
        'active' => (int) ($user['active'] ?? 1),
        'mustChangeCredentials' => (int) ($user['mustChangeCredentials'] ?? 0),
    ];
}

function actor(array $store): array
{
    $userId = (string) ($_SESSION['userId'] ?? '');
    $user = find_user($store, $userId);
    if (!$user || empty($user['active'])) {
        unset($_SESSION['userId'], $_SESSION['csrf']);
        fail('Please sign in to continue.', 401);
    }
    return public_user($user);
}

function require_roles(array $actor, array $roles): void
{
    if (!in_array($actor['role'], $roles, true)) {
        fail('Your role does not allow this action.', 403);
    }
}

function require_csrf(): void
{
    $token = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string) ($_SESSION['csrf'] ?? '');
    if ($expected === '' || $token === '' || !hash_equals($expected, $token)) {
        fail('Your session needs to be refreshed. Please try again.', 419);
    }

    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== preg_replace('/:\d+$/', '', $host)) {
        fail('This request was blocked for your security.', 403);
    }
}

function event_datetime(string $date, string $time, string $timezoneName = 'UTC'): string
{
    $timezone = new DateTimeZone($timezoneName);
    $value = DateTimeImmutable::createFromFormat('!Y-m-d H:i', "$date $time", $timezone);
    $errors = DateTimeImmutable::getLastErrors();
    if (!$value || (is_array($errors) && ($errors['warning_count'] || $errors['error_count']))) {
        throw new InvalidArgumentException('Choose a valid milestone date and time.');
    }
    return $value->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
}

function reminder_records(string $eventId, array $memberIds, string $startsAt, string $timezoneName = 'UTC'): array
{
    $event = new DateTimeImmutable($startsAt, new DateTimeZone('UTC'));
    $localEvent = $event->setTimezone(new DateTimeZone($timezoneName));
    $schedule = [
        ['3d', '-3 days', '10:00'],
        ['2d', '-2 days', '10:00'],
        ['1d', '-1 day', '10:00'],
        ['day', 'today', '08:00'],
    ];
    $records = [];
    foreach (array_unique($memberIds) as $memberId) {
        foreach ($schedule as [$code, $modifier, $time]) {
            $day = $modifier === 'today' ? $localEvent : $localEvent->modify($modifier);
            $scheduled = new DateTimeImmutable(
                $day->format('Y-m-d') . ' ' . $time,
                new DateTimeZone($timezoneName),
            );
            if ($scheduled <= new DateTimeImmutable('now', new DateTimeZone('UTC'))) {
                continue;
            }
            $records[] = [
                'id' => uid(),
                'eventId' => $eventId,
                'memberId' => $memberId,
                'offsetCode' => $code,
                'scheduledAt' => $scheduled
                    ->setTimezone(new DateTimeZone('UTC'))
                    ->format('Y-m-d\TH:i:s\Z'),
                'status' => 'Pending',
                'sentAt' => null,
            ];
        }
    }
    return $records;
}

function add_activity(array &$store, array $actor, ?string $eventId, string $action, string $message): void
{
    array_unshift($store['activity'], [
        'id' => uid(),
        'eventId' => $eventId,
        'memberId' => $actor['id'],
        'action' => $action,
        'message' => $message,
        'createdAt' => now_iso(),
    ]);
    $store['activity'] = array_slice($store['activity'], 0, 500);
}

function add_notification(
    array &$store,
    string $memberId,
    ?string $eventId,
    string $title,
    string $message,
    string $kind = 'Information',
    ?string $sourceKey = null,
    ?string $taskId = null,
): void {
    planner_add_notification($store, $memberId, $eventId, $title, $message, $kind, $sourceKey, $taskId);
}

function suggested_tasks(array $requirements): array
{
    $items = [];
    if (!empty($requirements['photography'])) {
        $items = array_merge($items, ['Confirm project brief', 'Prepare delivery checklist', 'Confirm required resources']);
    }
    if (!empty($requirements['video'])) {
        $items[] = 'Prepare documentation and handover plan';
    }
    if (!empty($requirements['graphicDesign'])) {
        $items[] = 'Prepare deliverable and submit for review';
    }
    if (!empty($requirements['social']) || !empty($requirements['liveUpdates'])) {
        $items[] = 'Prepare communication and progress plan';
    }
    if (!empty($requirements['sponsorCoverage'])) {
        $items[] = 'Confirm stakeholder approval requirements';
    }
    return $items ?: ['Confirm milestone details'];
}

function materialise_reminders(array &$store, string $memberId): void
{
    planner_materialise_due_reminders($store, $memberId);
}

function enrich_store(array &$store, array $actor): array
{
    materialise_reminders($store, $actor['id']);
    $usersById = [];
    foreach ($store['users'] as $user) {
        $usersById[$user['id']] = public_user($user);
    }
    $categoriesById = [];
    foreach ($store['categories'] as $category) {
        $categoriesById[$category['id']] = $category;
    }
    $eventsById = [];
    $events = [];
    foreach ($store['events'] as $event) {
        if (!empty($event['archivedAt'])) {
            continue;
        }
        $category = $categoriesById[$event['categoryId'] ?? ''] ?? null;
        $owner = $usersById[$event['ownerId'] ?? ''] ?? null;
        $enriched = array_merge($event, [
            'category' => $category['name'] ?? 'Other',
            'categoryColour' => $category['colour'] ?? '#68736F',
            'ownerName' => $owner['fullName'] ?? 'Unassigned',
        ]);
        $events[] = $enriched;
        $eventsById[$event['id']] = $enriched;
    }
    usort($events, fn(array $a, array $b): int => strcmp($a['startsAt'], $b['startsAt']));

    $assignments = array_map(function (array $assignment) use ($usersById): array {
        $user = $usersById[$assignment['memberId']] ?? null;
        return array_merge($assignment, [
            'fullName' => $user['fullName'] ?? 'Former member',
            'initials' => $user['initials'] ?? 'FM',
            'avatarColour' => $user['avatarColour'] ?? '#68736F',
            'role' => $user['role'] ?? 'Member',
        ]);
    }, $store['assignments']);

    $tasks = array_map(function (array $task) use ($usersById, $eventsById): array {
        $user = $usersById[$task['assigneeId'] ?? ''] ?? null;
        $event = $eventsById[$task['eventId'] ?? ''] ?? null;
        return array_merge($task, [
            'assigneeName' => $user['fullName'] ?? null,
            'assigneeInitials' => $user['initials'] ?? null,
            'eventTitle' => $event['title'] ?? null,
        ]);
    }, $store['tasks']);

    $campaigns = array_map(function (array $campaign) use ($usersById): array {
        $user = $usersById[$campaign['ownerId'] ?? ''] ?? null;
        return array_merge($campaign, ['ownerName' => $user['fullName'] ?? null]);
    }, $store['campaigns']);

    $content = array_map(function (array $item) use ($usersById): array {
        $user = $usersById[$item['assigneeId'] ?? ''] ?? null;
        return array_merge($item, ['assigneeName' => $user['fullName'] ?? null]);
    }, $store['content']);

    $comments = array_map(function (array $comment) use ($usersById): array {
        $user = $usersById[$comment['memberId'] ?? ''] ?? null;
        return array_merge($comment, [
            'memberName' => $user['fullName'] ?? 'Former member',
            'initials' => $user['initials'] ?? 'FM',
            'avatarColour' => $user['avatarColour'] ?? '#68736F',
        ]);
    }, $store['comments']);

    $media = array_map(function (array $item) use ($usersById): array {
        $user = $usersById[$item['uploadedBy'] ?? ''] ?? null;
        return array_merge($item, ['uploadedByName' => $user['fullName'] ?? null]);
    }, $store['media']);

    $activity = array_map(function (array $item) use ($usersById): array {
        $user = $usersById[$item['memberId'] ?? ''] ?? null;
        return array_merge($item, ['memberName' => $user['fullName'] ?? null]);
    }, $store['activity']);

    return [
        'actor' => $actor,
        'organisation' => $store['organisation'],
        'categories' => array_values(array_filter(
            $store['categories'],
            fn(array $category): bool => !isset($category['enabled']) || !empty($category['enabled']),
        )),
        'team' => array_values(array_filter(
            array_map('public_user', $store['users']),
            fn(array $user): bool => !empty($user['active']),
        )),
        'events' => $events,
        'assignments' => $assignments,
        'requirements' => $store['requirements'],
        'tasks' => $tasks,
        'campaigns' => $campaigns,
        'content' => $content,
        'notifications' => array_values(array_filter(
            $store['notifications'],
            fn(array $item): bool => ($item['memberId'] ?? '') === $actor['id'],
        )),
        'shotItems' => $store['shotItems'],
        'equipmentItems' => $store['equipmentItems'],
        'comments' => $comments,
        'media' => $media,
        'activity' => $activity,
        'emailDelivery' => planner_mail_status(),
        'serverTime' => now_iso(),
        'csrfToken' => (string) ($_SESSION['csrf'] ?? ''),
    ];
}

function cascade_event_delete(array &$store, string $eventId): void
{
    foreach (['assignments', 'requirements', 'tasks', 'content', 'notifications', 'emailQueue', 'reminders', 'shotItems', 'equipmentItems', 'comments', 'media'] as $key) {
        $store[$key] = array_values(array_filter(
            $store[$key],
            fn(array $item): bool => ($item['eventId'] ?? '') !== $eventId,
        ));
    }
}

function cascade_task_delete(array &$store, string $taskId): void
{
    $store['tasks'] = array_values(array_filter(
        $store['tasks'],
        fn(array $item): bool => ($item['id'] ?? '') !== $taskId,
    ));
    foreach (['notifications', 'emailQueue', 'reminders'] as $key) {
        $store[$key] = array_values(array_filter(
            $store[$key],
            fn(array $item): bool => ($item['taskId'] ?? '') !== $taskId,
        ));
    }
}

function cancel_pending_task_emails(array &$store, string $taskId, bool $includeAssignments = false): void
{
    foreach ($store['emailQueue'] as &$queued) {
        if (
            ($queued['taskId'] ?? '') !== $taskId
            || !in_array(($queued['status'] ?? ''), ['Pending', 'Retry'], true)
        ) {
            continue;
        }
        $isReminder = str_starts_with((string) ($queued['sourceKey'] ?? ''), 'task-reminder:');
        if ($includeAssignments || $isReminder) {
            $queued['status'] = 'Skipped';
            $queued['lastError'] = 'Task assignment or deadline changed before delivery.';
        }
    }
    unset($queued);
}

function cascade_campaign_delete(array &$store, string $campaignId): void
{
    $taskIds = array_map(
        fn(array $task): string => (string) ($task['id'] ?? ''),
        array_values(array_filter(
            $store['tasks'],
            fn(array $task): bool => ($task['campaignId'] ?? '') === $campaignId,
        )),
    );
    foreach ($taskIds as $taskId) {
        if ($taskId !== '') {
            cascade_task_delete($store, $taskId);
        }
    }
    foreach (['content', 'media'] as $key) {
        $store[$key] = array_values(array_filter(
            $store[$key],
            fn(array $item): bool => ($item['campaignId'] ?? '') !== $campaignId,
        ));
    }
    foreach ($store['events'] as &$event) {
        if (($event['campaignId'] ?? '') === $campaignId) {
            $event['campaignId'] = null;
            $event['updatedAt'] = now_iso();
        }
    }
    unset($event);
}

function unassign_member_work(array &$store, string $memberId): array
{
    $counts = [
        'events' => 0,
        'assignments' => 0,
        'tasks' => 0,
        'campaigns' => 0,
        'content' => 0,
        'shotItems' => 0,
    ];
    $affectedEventIds = [];

    foreach ($store['assignments'] as $assignment) {
        if (($assignment['memberId'] ?? '') === $memberId) {
            $counts['assignments']++;
            if (!empty($assignment['eventId'])) {
                $affectedEventIds[(string) $assignment['eventId']] = true;
            }
        }
    }
    $store['assignments'] = array_values(array_filter(
        $store['assignments'],
        fn(array $assignment): bool => ($assignment['memberId'] ?? '') !== $memberId,
    ));

    foreach ($store['events'] as &$event) {
        $wasOwner = ($event['ownerId'] ?? '') === $memberId;
        if ($wasOwner) {
            $event['ownerId'] = null;
            $counts['events']++;
        }
        if ($wasOwner || isset($affectedEventIds[(string) ($event['id'] ?? '')])) {
            $event['readiness'] = 'Needs attention';
            $event['readinessReason'] = 'A team member was removed. Review ownership and requirements.';
            $event['version'] = (int) ($event['version'] ?? 1) + 1;
            $event['updatedAt'] = now_iso();
        }
    }
    unset($event);

    foreach ([
        'tasks' => 'assigneeId',
        'campaigns' => 'ownerId',
        'content' => 'assigneeId',
        'shotItems' => 'assigneeId',
    ] as $collection => $field) {
        foreach ($store[$collection] as &$item) {
            if (($item[$field] ?? '') === $memberId) {
                $item[$field] = null;
                $item['updatedAt'] = now_iso();
                $counts[$collection]++;
            }
        }
        unset($item);
    }

    foreach (['notifications', 'emailQueue', 'reminders'] as $collection) {
        $store[$collection] = array_values(array_filter(
            $store[$collection],
            fn(array $item): bool => ($item['memberId'] ?? '') !== $memberId,
        ));
    }

    return $counts;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$route = trim((string) ($_GET['route'] ?? preg_replace('#^/api/?#', '', $requestPath)), '/');
$GLOBALS['planner_route'] = $route;

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method === 'GET' && $route === 'health') {
    $email = planner_mail_status();
    respond([
        'ok' => true,
        'storage' => is_writable(dirname(STORE_FILE)),
        'email' => $email['configured'] && $email['enabled'] ? 'ready' : 'setup-required',
    ]);
}

if ($method === 'GET' && $route === 'brand/logo') {
    emit_brand_logo(brand_variant($_GET['variant'] ?? 'colour'));
}

if ($method === 'GET' && $route === 'auth/setup') {
    with_store(function (array &$store): void {
        $active = false;
        foreach ($store['users'] as $user) {
            if (
                strtolower((string) ($user['username'] ?? '')) === INITIAL_ADMIN_USERNAME
                && !empty($user['mustChangeCredentials'])
                && password_verify(INITIAL_ADMIN_PASSWORD, (string) ($user['passwordHash'] ?? ''))
            ) {
                $active = true;
                break;
            }
        }
        respond([
            'initialSetupAvailable' => $active,
            'branding' => [
                'productName' => clean_text($store['organisation']['productName'] ?? 'Project Workspace', 120),
                'workspaceName' => clean_text($store['organisation']['name'] ?? 'My Workspace', 160),
                'primaryColour' => valid_colour($store['organisation']['primaryColour'] ?? '#2563EB', '#2563EB'),
                'accentColour' => valid_colour($store['organisation']['accentColour'] ?? '#14B8A6', '#14B8A6'),
                'logoVersion' => clean_text($store['organisation']['logoVersion'] ?? '', 100),
            ],
        ]);
    });
}

if ($method === 'POST' && $route === 'auth/login') {
    $input = body();
    $loginEmail = strtolower(clean_text($input['email'] ?? $input['username'] ?? '', 180));
    $password = (string) ($input['password'] ?? '');
    if ($loginEmail === '' || $password === '') {
        fail('Enter your username or email and password.');
    }

    with_store(function (array &$store) use ($loginEmail, $password): void {
        $userIndex = -1;
        foreach ($store['users'] as $index => $user) {
            if (
                strtolower((string) ($user['email'] ?? '')) === $loginEmail
                || strtolower((string) ($user['username'] ?? '')) === $loginEmail
            ) {
                $userIndex = $index;
                break;
            }
        }
        if ($userIndex < 0) {
            usleep(150000);
            fail('The username, email, or password is incorrect.', 401);
        }
        $user = $store['users'][$userIndex];
        if (
            !empty($user['lockedUntil'])
            && strtotime((string) $user['lockedUntil']) > time()
        ) {
            fail('Too many sign-in attempts. Try again in 15 minutes.', 429);
        }
        if (empty($user['active']) || !password_verify($password, (string) $user['passwordHash'])) {
            $attempts = (int) ($user['failedAttempts'] ?? 0) + 1;
            $store['users'][$userIndex]['failedAttempts'] = $attempts >= 8 ? 0 : $attempts;
            $store['users'][$userIndex]['lockedUntil'] = $attempts >= 8
                ? gmdate('Y-m-d\TH:i:s\Z', time() + 900)
                : null;
            fail('The username, email, or password is incorrect.', 401);
        }
        if (password_needs_rehash((string) $user['passwordHash'], PASSWORD_DEFAULT)) {
            $store['users'][$userIndex]['passwordHash'] = password_hash($password, PASSWORD_DEFAULT);
        }
        $store['users'][$userIndex]['failedAttempts'] = 0;
        $store['users'][$userIndex]['lockedUntil'] = null;
        $store['users'][$userIndex]['lastLoginAt'] = now_iso();
        session_regenerate_id(true);
        $_SESSION['userId'] = $user['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        respond([
            'ok' => true,
            'actor' => public_user($user),
            'csrfToken' => $_SESSION['csrf'],
        ]);
    });
}

if ($method === 'POST' && $route === 'auth/logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], true);
    }
    session_destroy();
    respond(['ok' => true]);
}

if (empty($_SESSION['userId'])) {
    fail('Please sign in to continue.', 401);
}

if ($method !== 'GET') {
    require_csrf();
}

with_store(function (array &$store) use ($method, $route): void {
    $actor = actor($store);

    if ($method === 'GET' && $route === 'auth/session') {
        respond(['actor' => $actor, 'csrfToken' => $_SESSION['csrf']]);
    }
    if ($method === 'GET' && $route === 'bootstrap') {
        respond(enrich_store($store, $actor));
    }

    if ($method === 'POST' && $route === 'account/complete-setup') {
        if (empty($actor['mustChangeCredentials'])) {
            fail('Your account setup is already complete.', 409);
        }
        $input = body();
        $fullName = clean_text($input['fullName'] ?? '', 160);
        $email = strtolower(clean_text($input['email'] ?? '', 180));
        $newPassword = (string) ($input['newPassword'] ?? '');
        $workspaceName = clean_text($input['workspaceName'] ?? '', 160);
        if ($fullName === '') {
            fail('Enter your full name.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail('Enter a valid work email address.');
        }
        if (strlen($newPassword) < 12) {
            fail('Choose a new password of at least 12 characters.');
        }
        if (hash_equals(INITIAL_ADMIN_PASSWORD, $newPassword)) {
            fail('Choose a password different from the temporary password.');
        }
        foreach ($store['users'] as $user) {
            if (
                ($user['id'] ?? '') !== $actor['id']
                && strtolower((string) ($user['email'] ?? '')) === $email
            ) {
                fail('That email address is already linked to another account.');
            }
        }
        $index = find_index($store['users'], $actor['id']);
        if ($index < 0) {
            fail('Your account is no longer available.', 404);
        }
        $parts = preg_split('/\s+/', $fullName) ?: [];
        $letters = implode('', array_map(
            fn(string $part): string => function_exists('mb_substr')
                ? mb_substr($part, 0, 1)
                : substr($part, 0, 1),
            $parts,
        ));
        $store['users'][$index]['fullName'] = $fullName;
        $store['users'][$index]['initials'] = strtoupper(
            function_exists('mb_substr') ? mb_substr($letters, 0, 2) : substr($letters, 0, 2),
        ) ?: 'AD';
        $store['users'][$index]['email'] = $email;
        $store['users'][$index]['username'] = $email;
        $store['users'][$index]['passwordHash'] = password_hash($newPassword, PASSWORD_DEFAULT);
        $store['users'][$index]['passwordChangedAt'] = now_iso();
        $store['users'][$index]['emailNotifications'] = 1;
        $store['users'][$index]['mustChangeCredentials'] = 0;
        if ($workspaceName !== '') {
            $store['organisation']['name'] = $workspaceName;
        }
        add_activity($store, public_user($store['users'][$index]), null, 'account.setup', $fullName . ' completed the administrator setup.');
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        respond([
            'ok' => true,
            'actor' => public_user($store['users'][$index]),
            'csrfToken' => $_SESSION['csrf'],
        ]);
    }

    if (!empty($actor['mustChangeCredentials'])) {
        fail('Complete the administrator setup before continuing.', 428);
    }

    $idempotencyKey = clean_text($_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? '', 100);
    if ($method !== 'GET' && $idempotencyKey !== '') {
        foreach ($store['idempotency'] as $record) {
            if (
                ($record['key'] ?? '') === $idempotencyKey
                && ($record['method'] ?? '') === $method
                && ($record['route'] ?? '') === $route
            ) {
                respond(['ok' => true, 'duplicate' => true]);
            }
        }
        $GLOBALS['planner_idempotency_pending'] = [
            'key' => $idempotencyKey,
            'method' => $method,
            'route' => $route,
            'createdAt' => now_iso(),
        ];
    }

    if ($method === 'POST' && $route === 'events') {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
        $input = body();
        $title = clean_text($input['title'] ?? '', 180);
        $categoryId = clean_text($input['categoryId'] ?? '', 80);
        $date = clean_text($input['date'] ?? '', 10);
        $time = clean_text($input['time'] ?? '', 5);
        if ($title === '' || $categoryId === '' || $date === '' || $time === '') {
            fail('Add a title, category, date, and start time.');
        }
        $timezoneName = (string) ($store['organisation']['timezone'] ?? 'UTC');
        $startsAt = event_datetime($date, $time, $timezoneName);
        $eventId = uid();
        $requirements = is_array($input['requirements'] ?? null) ? $input['requirements'] : [];
        $assigneeIds = array_values(array_unique(array_filter(
            is_array($input['assigneeIds'] ?? null) ? $input['assigneeIds'] : [],
            fn(mixed $id): bool => find_user($store, (string) $id) !== null,
        )));
        $recipientIds = array_values(array_unique(array_merge([$actor['id']], $assigneeIds)));
        $readinessReason = !empty($requirements['photography']) && count($assigneeIds) === 0
            ? 'Contributor assignment is still open'
            : 'New assignments need confirmation';

        $store['events'][] = [
            'id' => $eventId,
            'title' => $title,
            'description' => clean_text($input['description'] ?? '', 4000),
            'categoryId' => $categoryId,
            'startsAt' => $startsAt,
            'endsAt' => null,
            'arrivalAt' => null,
            'venue' => clean_text($input['venue'] ?? '', 220),
            'mapsUrl' => valid_url($input['mapsUrl'] ?? ''),
            'opponent' => clean_text($input['opponent'] ?? '', 180) ?: null,
            'competition' => clean_text($input['competition'] ?? '', 180) ?: null,
            'homeAway' => clean_text($input['homeAway'] ?? '', 40) ?: null,
            'priority' => clean_text($input['priority'] ?? 'Normal', 30),
            'status' => 'Planned',
            'readiness' => 'Needs attention',
            'readinessReason' => $readinessReason,
            'ownerId' => $actor['id'],
            'campaignId' => clean_text($input['campaignId'] ?? '', 80) ?: null,
            'version' => 1,
            'createdAt' => now_iso(),
            'updatedAt' => now_iso(),
        ];
        $store['requirements'][] = array_merge([
            'eventId' => $eventId,
            'photography' => 0,
            'video' => 0,
            'social' => 0,
            'graphicDesign' => 0,
            'liveUpdates' => 0,
            'interview' => 0,
            'sponsorCoverage' => 0,
        ], array_map(fn(mixed $value): int => $value ? 1 : 0, $requirements));
        $store['assignments'][] = [
            'id' => uid(),
            'eventId' => $eventId,
            'memberId' => $actor['id'],
            'responsibility' => 'Milestone owner',
            'confirmationStatus' => 'Confirmed',
            'requiredArrivalAt' => null,
            'notes' => '',
        ];
        foreach ($assigneeIds as $assigneeId) {
            $store['assignments'][] = [
                'id' => uid(),
                'eventId' => $eventId,
                'memberId' => $assigneeId,
                'responsibility' => 'Project team',
                'confirmationStatus' => 'Assigned',
                'requiredArrivalAt' => null,
                'notes' => '',
            ];
            add_notification(
                $store,
                $assigneeId,
                $eventId,
                'New milestone assignment',
                'You were assigned to ' . $title . '.',
                'Assignment',
            );
        }
        foreach (suggested_tasks($requirements) as $taskTitle) {
            $store['tasks'][] = [
                'id' => uid(),
                'eventId' => $eventId,
                'campaignId' => null,
                'title' => $taskTitle,
                'description' => '',
                'assigneeId' => $assigneeIds[0] ?? $actor['id'],
                'assignedAt' => now_iso(),
                'dueAt' => $startsAt,
                'priority' => clean_text($input['priority'] ?? 'Normal', 30),
                'status' => 'To do',
                'approvalRequired' => 0,
                'version' => 1,
                'completedAt' => null,
                'createdAt' => now_iso(),
                'updatedAt' => now_iso(),
            ];
        }
        $defaultShots = [];
        if (!empty($requirements['photography']) || !empty($requirements['video'])) {
            $defaultShots = [
                ['Before', 'Brief and scope confirmed', 1],
                ['Before', 'Owners and dependencies confirmed', 0],
                ['During', 'Key work completed', 1],
                ['During', 'Progress update shared', 0],
                ['After', 'Review and approval completed', 1],
                ['After', 'Final delivery link confirmed', 0],
            ];
        }
        foreach ($defaultShots as $index => [$phase, $shotTitle, $mandatory]) {
            $store['shotItems'][] = [
                'id' => uid(),
                'eventId' => $eventId,
                'phase' => $phase,
                'title' => $shotTitle,
                'mandatory' => $mandatory,
                'completed' => 0,
                'assigneeId' => null,
                'notes' => '',
                'sortOrder' => $index + 1,
                'version' => 1,
            ];
        }
        foreach (['Required files', 'Access and permissions', 'Tools and resources', 'Stakeholder availability'] as $index => $equipmentTitle) {
            if (empty($requirements['photography']) && empty($requirements['video'])) {
                break;
            }
            $store['equipmentItems'][] = [
                'id' => uid(),
                'eventId' => $eventId,
                'title' => $equipmentTitle,
                'confirmed' => 0,
                'notes' => '',
                'sortOrder' => $index + 1,
                'version' => 1,
            ];
        }
        $store['reminders'] = array_merge(
            $store['reminders'],
            reminder_records($eventId, $recipientIds, $startsAt, $timezoneName),
        );
        add_activity($store, $actor, $eventId, 'event.created', $actor['fullName'] . ' created “' . $title . '”.');
        respond(['ok' => true, 'id' => $eventId], 201);
    }

    if (preg_match('#^events/([^/]+)$#', $route, $matches)) {
        $eventId = $matches[1];
        $eventIndex = find_index($store['events'], $eventId);
        if ($eventIndex < 0) {
            fail('This milestone is no longer available.', 404);
        }
        if ($method === 'PATCH') {
            require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
            $input = body();
            foreach (['title', 'description', 'venue', 'priority', 'status', 'categoryId', 'opponent', 'competition', 'homeAway'] as $field) {
                if (array_key_exists($field, $input)) {
                    $store['events'][$eventIndex][$field] = clean_text($input[$field], $field === 'description' ? 4000 : 220);
                }
            }
            if (array_key_exists('ownerId', $input)) {
                $ownerId = clean_text($input['ownerId'], 80);
                $owner = $ownerId !== '' ? find_user($store, $ownerId) : null;
                if ($ownerId !== '' && (!$owner || empty($owner['active']))) {
                    fail('Choose an active team member as the milestone owner.');
                }
                $store['events'][$eventIndex]['ownerId'] = $ownerId ?: null;
                if ($ownerId !== '') {
                    $store['events'][$eventIndex]['readinessReason'] = 'Ownership updated. Review remaining requirements.';
                }
            }
            if (array_key_exists('mapsUrl', $input)) {
                $store['events'][$eventIndex]['mapsUrl'] = valid_url($input['mapsUrl']);
            }
            if (!empty($input['date']) && !empty($input['time'])) {
                $store['events'][$eventIndex]['startsAt'] = event_datetime(
                    clean_text($input['date'], 10),
                    clean_text($input['time'], 5),
                    (string) ($store['organisation']['timezone'] ?? 'UTC'),
                );
            }
            $store['events'][$eventIndex]['version'] = (int) ($store['events'][$eventIndex]['version'] ?? 1) + 1;
            $store['events'][$eventIndex]['updatedAt'] = now_iso();
            add_activity($store, $actor, $eventId, 'event.updated', $actor['fullName'] . ' updated “' . $store['events'][$eventIndex]['title'] . '”.');
            respond(['ok' => true]);
        }
        if ($method === 'DELETE') {
            require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
            $title = $store['events'][$eventIndex]['title'];
            array_splice($store['events'], $eventIndex, 1);
            cascade_event_delete($store, $eventId);
            add_activity($store, $actor, null, 'event.deleted', $actor['fullName'] . ' deleted “' . $title . '”.');
            respond(['ok' => true]);
        }
    }

    if ($method === 'POST' && preg_match('#^events/([^/]+)/reschedule$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
        $eventId = $matches[1];
        $eventIndex = find_index($store['events'], $eventId);
        if ($eventIndex < 0) {
            fail('This milestone is no longer available.', 404);
        }
        $input = body();
        $timezoneName = (string) ($store['organisation']['timezone'] ?? 'UTC');
        $next = event_datetime(clean_text($input['date'] ?? '', 10), clean_text($input['time'] ?? '', 5), $timezoneName);
        $previous = $store['events'][$eventIndex]['startsAt'];
        $store['events'][$eventIndex]['startsAt'] = $next;
        $store['events'][$eventIndex]['updatedAt'] = now_iso();
        foreach ($store['reminders'] as &$reminder) {
            if (($reminder['eventId'] ?? '') === $eventId && ($reminder['status'] ?? '') === 'Pending') {
                $reminder['status'] = 'Cancelled';
            }
        }
        unset($reminder);
        $recipients = [$actor['id']];
        foreach ($store['assignments'] as $assignment) {
            if (($assignment['eventId'] ?? '') === $eventId) {
                $recipients[] = $assignment['memberId'];
            }
        }
        foreach (array_unique($recipients) as $recipient) {
            add_notification(
                $store,
                $recipient,
                $eventId,
                'Milestone rescheduled',
                $store['events'][$eventIndex]['title'] . ' has a new date or time.',
                'Reschedule',
            );
        }
        $store['reminders'] = array_merge($store['reminders'], reminder_records($eventId, $recipients, $next, $timezoneName));
        add_activity($store, $actor, $eventId, 'event.rescheduled', $actor['fullName'] . ' rescheduled the milestone from ' . $previous . ' to ' . $next . '.');
        respond(['ok' => true]);
    }

    if ($method === 'POST' && preg_match('#^events/([^/]+)/attendance$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Contributor', 'Reviewer']);
        $eventId = $matches[1];
        $input = body();
        $status = clean_text($input['status'] ?? '', 40);
        $allowed = ['Assigned', 'Confirmed', 'In progress', 'Reviewing', 'Completed', 'Unable to participate'];
        if (!in_array($status, $allowed, true)) {
            fail('Choose a valid attendance status.');
        }
        $assignmentIndex = -1;
        foreach ($store['assignments'] as $index => $assignment) {
            if (($assignment['eventId'] ?? '') === $eventId && ($assignment['memberId'] ?? '') === $actor['id']) {
                $assignmentIndex = $index;
                break;
            }
        }
        if ($assignmentIndex < 0) {
            $store['assignments'][] = [
                'id' => uid(),
                'eventId' => $eventId,
                'memberId' => $actor['id'],
                'responsibility' => 'Team member',
                'confirmationStatus' => $status,
                'requiredArrivalAt' => null,
                'notes' => '',
            ];
        } else {
            $store['assignments'][$assignmentIndex]['confirmationStatus'] = $status;
        }
        add_activity($store, $actor, $eventId, 'attendance.updated', $actor['fullName'] . ' marked ' . strtolower($status) . '.');
        respond(['ok' => true]);
    }

    if ($method === 'PATCH' && preg_match('#^events/([^/]+)/coverage$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
        $eventId = $matches[1];
        $input = body();
        $index = -1;
        foreach ($store['requirements'] as $itemIndex => $item) {
            if (($item['eventId'] ?? '') === $eventId) {
                $index = $itemIndex;
                break;
            }
        }
        $record = ['eventId' => $eventId];
        foreach (['photography', 'video', 'social', 'graphicDesign', 'liveUpdates', 'interview', 'sponsorCoverage'] as $field) {
            $record[$field] = !empty($input[$field]) ? 1 : 0;
        }
        if ($index >= 0) {
            $store['requirements'][$index] = $record;
        } else {
            $store['requirements'][] = $record;
        }
        add_activity($store, $actor, $eventId, 'coverage.updated', $actor['fullName'] . ' updated the milestone requirements.');
        respond(['ok' => true]);
    }

    if ($method === 'POST' && preg_match('#^events/([^/]+)/assignments$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
        $input = body();
        $memberId = clean_text($input['memberId'] ?? '', 80);
        if (!find_user($store, $memberId)) {
            fail('Choose an active team member.');
        }
        $assignment = [
            'id' => uid(),
            'eventId' => $matches[1],
            'memberId' => $memberId,
            'responsibility' => clean_text($input['responsibility'] ?? 'Project team', 120),
            'confirmationStatus' => 'Assigned',
            'requiredArrivalAt' => null,
            'notes' => clean_text($input['notes'] ?? '', 500),
        ];
        $store['assignments'][] = $assignment;
        add_notification(
            $store,
            $memberId,
            $matches[1],
            'New milestone assignment',
            'You have a new milestone assignment.',
            'Assignment',
            'event-assignment:' . $assignment['id'] . ':' . $memberId,
        );
        add_activity($store, $actor, $matches[1], 'assignment.created', $actor['fullName'] . ' assigned a team member.');
        respond(['ok' => true, 'id' => $assignment['id']], 201);
    }

    if ($method === 'POST' && $route === 'tasks') {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Contributor', 'Reviewer']);
        $input = body();
        $title = clean_text($input['title'] ?? '', 180);
        $dueAt = clean_text($input['dueAt'] ?? '', 40);
        if ($title === '' || $dueAt === '' || strtotime($dueAt) === false) {
            fail('Add a task title and valid due date.');
        }
        $task = [
            'id' => uid(),
            'eventId' => clean_text($input['eventId'] ?? '', 80) ?: null,
            'campaignId' => clean_text($input['campaignId'] ?? '', 80) ?: null,
            'title' => $title,
            'description' => clean_text($input['description'] ?? '', 2000),
            'assigneeId' => clean_text($input['assigneeId'] ?? $actor['id'], 80) ?: $actor['id'],
            'assignedAt' => now_iso(),
            'dueAt' => gmdate('Y-m-d\TH:i:s\Z', strtotime($dueAt)),
            'priority' => clean_text($input['priority'] ?? 'Normal', 30),
            'status' => 'To do',
            'approvalRequired' => !empty($input['approvalRequired']) ? 1 : 0,
            'version' => 1,
            'completedAt' => null,
            'createdAt' => now_iso(),
            'updatedAt' => now_iso(),
        ];
        $store['tasks'][] = $task;
        add_notification(
            $store,
            (string) $task['assigneeId'],
            $task['eventId'],
            'New task assigned',
            'You were assigned the task “' . $title . '”.',
            'Task',
            'task-assigned:' . $task['id'] . ':' . $task['assigneeId'] . ':v1',
            $task['id'],
        );
        add_activity($store, $actor, $task['eventId'], 'task.created', $actor['fullName'] . ' created task “' . $title . '”.');
        respond(['ok' => true, 'id' => $task['id']], 201);
    }

    if (preg_match('#^tasks/([^/]+)$#', $route, $matches)) {
        $index = find_index($store['tasks'], $matches[1]);
        if ($index < 0) {
            fail('This task is no longer available.', 404);
        }
        if ($method === 'PATCH') {
            if (
                ($store['tasks'][$index]['assigneeId'] ?? '') !== $actor['id']
                && !in_array($actor['role'], ['Administrator', 'Project Manager', 'Team Lead'], true)
            ) {
                fail('Only the task owner or a planner can update this task.', 403);
            }
            $input = body();
            $previousAssignee = (string) ($store['tasks'][$index]['assigneeId'] ?? '');
            $previousDueAt = (string) ($store['tasks'][$index]['dueAt'] ?? '');
            $previousStatus = (string) ($store['tasks'][$index]['status'] ?? '');
            foreach (['title', 'description', 'dueAt', 'priority', 'status'] as $field) {
                if (array_key_exists($field, $input)) {
                    $store['tasks'][$index][$field] = clean_text($input[$field], $field === 'description' ? 2000 : 180);
                }
            }
            if (array_key_exists('assigneeId', $input)) {
                $assigneeId = clean_text($input['assigneeId'], 80);
                $assignee = $assigneeId !== '' ? find_user($store, $assigneeId) : null;
                if ($assigneeId !== '' && (!$assignee || empty($assignee['active']))) {
                    fail('Choose an active team member for this task.');
                }
                $store['tasks'][$index]['assigneeId'] = $assigneeId ?: null;
                if ($assigneeId !== $previousAssignee) {
                    $store['tasks'][$index]['assignedAt'] = now_iso();
                }
            }
            $store['tasks'][$index]['completedAt'] = ($store['tasks'][$index]['status'] ?? '') === 'Completed' ? now_iso() : null;
            $store['tasks'][$index]['version'] = (int) ($store['tasks'][$index]['version'] ?? 1) + 1;
            $store['tasks'][$index]['updatedAt'] = now_iso();
            $nextAssignee = (string) ($store['tasks'][$index]['assigneeId'] ?? '');
            $nextDueAt = (string) ($store['tasks'][$index]['dueAt'] ?? '');
            $nextStatus = (string) ($store['tasks'][$index]['status'] ?? '');
            if (
                $nextAssignee !== $previousAssignee
                || $nextDueAt !== $previousDueAt
                || ($nextStatus === 'Completed' && $previousStatus !== 'Completed')
            ) {
                cancel_pending_task_emails(
                    $store,
                    (string) $store['tasks'][$index]['id'],
                    $nextAssignee !== $previousAssignee,
                );
            }
            if ($nextAssignee !== '' && $nextAssignee !== $previousAssignee && $nextAssignee !== $actor['id']) {
                add_notification(
                    $store,
                    $nextAssignee,
                    $store['tasks'][$index]['eventId'] ?? null,
                    'Task reassigned to you',
                    'You are now responsible for “' . $store['tasks'][$index]['title'] . '”.',
                    'Task',
                    'task-assigned:' . $store['tasks'][$index]['id'] . ':' . $nextAssignee . ':v' . $store['tasks'][$index]['version'],
                    $store['tasks'][$index]['id'],
                );
            }
            add_activity($store, $actor, $store['tasks'][$index]['eventId'] ?? null, 'task.updated', $actor['fullName'] . ' updated “' . $store['tasks'][$index]['title'] . '”.');
            respond(['ok' => true]);
        }
        if ($method === 'DELETE') {
            require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
            $taskId = $matches[1];
            $taskTitle = (string) ($store['tasks'][$index]['title'] ?? 'Task');
            $eventId = !empty($store['tasks'][$index]['eventId']) ? (string) $store['tasks'][$index]['eventId'] : null;
            cascade_task_delete($store, $taskId);
            add_activity($store, $actor, $eventId, 'task.deleted', $actor['fullName'] . ' deleted task “' . $taskTitle . '”.');
            respond(['ok' => true]);
        }
    }

    if ($method === 'POST' && $route === 'campaigns') {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
        $input = body();
        $title = clean_text($input['title'] ?? '', 180);
        if ($title === '' || empty($input['startDate']) || empty($input['endDate'])) {
            fail('Add a project title, start date, and end date.');
        }
        $campaign = [
            'id' => uid(),
            'title' => $title,
            'objective' => clean_text($input['objective'] ?? '', 2000),
            'startDate' => clean_text($input['startDate'], 10),
            'endDate' => clean_text($input['endDate'], 10),
            'ownerId' => clean_text($input['ownerId'] ?? $actor['id'], 80),
            'audience' => clean_text($input['audience'] ?? 'Internal team', 240),
            'channels' => clean_text($input['channels'] ?? 'Instagram, X', 240),
            'status' => clean_text($input['status'] ?? 'Planned', 40),
            'priority' => clean_text($input['priority'] ?? 'Normal', 30),
            'progress' => 0,
            'createdAt' => now_iso(),
            'updatedAt' => now_iso(),
        ];
        $store['campaigns'][] = $campaign;
        add_activity($store, $actor, null, 'campaign.created', $actor['fullName'] . ' created project “' . $title . '”.');
        respond(['ok' => true, 'id' => $campaign['id']], 201);
    }

    if (preg_match('#^campaigns/([^/]+)$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
        $index = find_index($store['campaigns'], $matches[1]);
        if ($index < 0) {
            fail('This project is no longer available.', 404);
        }
        if ($method === 'PATCH') {
            $input = body();
            foreach (['title', 'objective', 'startDate', 'endDate', 'audience', 'channels', 'status', 'priority', 'progress'] as $field) {
                if (array_key_exists($field, $input)) {
                    $store['campaigns'][$index][$field] = $field === 'progress'
                        ? max(0, min(100, (int) $input[$field]))
                        : clean_text($input[$field], $field === 'objective' ? 2000 : 240);
                }
            }
            if (array_key_exists('ownerId', $input)) {
                $ownerId = clean_text($input['ownerId'], 80);
                $owner = $ownerId !== '' ? find_user($store, $ownerId) : null;
                if ($ownerId !== '' && (!$owner || empty($owner['active']))) {
                    fail('Choose an active team member as the project owner.');
                }
                $store['campaigns'][$index]['ownerId'] = $ownerId ?: null;
            }
            $store['campaigns'][$index]['updatedAt'] = now_iso();
            respond(['ok' => true]);
        }
        if ($method === 'DELETE') {
            $campaignId = $matches[1];
            $campaignTitle = (string) ($store['campaigns'][$index]['title'] ?? 'Project');
            array_splice($store['campaigns'], $index, 1);
            cascade_campaign_delete($store, $campaignId);
            add_activity($store, $actor, null, 'campaign.deleted', $actor['fullName'] . ' deleted project “' . $campaignTitle . '”.');
            respond(['ok' => true]);
        }
    }

    if ($method === 'POST' && $route === 'content') {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Reviewer']);
        $input = body();
        $title = clean_text($input['title'] ?? '', 180);
        $publishAt = clean_text($input['publishAt'] ?? '', 40);
        if ($title === '' || $publishAt === '' || strtotime($publishAt) === false) {
            fail('Add a content title and valid publication date.');
        }
        $item = [
            'id' => uid(),
            'eventId' => clean_text($input['eventId'] ?? '', 80) ?: null,
            'campaignId' => clean_text($input['campaignId'] ?? '', 80) ?: null,
            'title' => $title,
            'platform' => clean_text($input['platform'] ?? 'Instagram', 60),
            'contentType' => clean_text($input['contentType'] ?? 'Feed post', 80),
            'publishAt' => gmdate('Y-m-d\TH:i:s\Z', strtotime($publishAt)),
            'assigneeId' => clean_text($input['assigneeId'] ?? $actor['id'], 80),
            'status' => clean_text($input['status'] ?? 'Idea', 50),
            'approvalStatus' => clean_text($input['approvalStatus'] ?? 'Draft', 50),
            'assetUrl' => valid_url($input['assetUrl'] ?? '') ?: null,
            'caption' => clean_text($input['caption'] ?? '', 5000),
            'notes' => clean_text($input['notes'] ?? '', 2000),
            'createdAt' => now_iso(),
            'updatedAt' => now_iso(),
        ];
        $store['content'][] = $item;
        if (($item['assigneeId'] ?? '') !== $actor['id']) {
            add_notification(
                $store,
                (string) $item['assigneeId'],
                $item['eventId'],
                'New content plan assigned',
                'You were assigned the content item “' . $title . '” for ' . $item['platform'] . '.',
                'Content',
            );
        }
        add_activity($store, $actor, $item['eventId'], 'content.created', $actor['fullName'] . ' planned “' . $title . '”.');
        respond(['ok' => true, 'id' => $item['id']], 201);
    }

    if (preg_match('#^content/([^/]+)$#', $route, $matches)) {
        $index = find_index($store['content'], $matches[1]);
        if ($index < 0) {
            fail('This content item is no longer available.', 404);
        }
        if ($method === 'PATCH') {
            require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Reviewer']);
            $input = body();
            foreach (['title', 'platform', 'contentType', 'publishAt', 'status', 'approvalStatus', 'caption', 'notes'] as $field) {
                if (array_key_exists($field, $input)) {
                    $store['content'][$index][$field] = clean_text($input[$field], in_array($field, ['caption', 'notes'], true) ? 5000 : 180);
                }
            }
            if (array_key_exists('assigneeId', $input)) {
                $assigneeId = clean_text($input['assigneeId'], 80);
                $assignee = $assigneeId !== '' ? find_user($store, $assigneeId) : null;
                if ($assigneeId !== '' && (!$assignee || empty($assignee['active']))) {
                    fail('Choose an active team member for this content item.');
                }
                $store['content'][$index]['assigneeId'] = $assigneeId ?: null;
            }
            if (array_key_exists('assetUrl', $input)) {
                $store['content'][$index]['assetUrl'] = valid_url($input['assetUrl']) ?: null;
            }
            $store['content'][$index]['updatedAt'] = now_iso();
            respond(['ok' => true]);
        }
        if ($method === 'DELETE') {
            require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
            array_splice($store['content'], $index, 1);
            respond(['ok' => true]);
        }
    }

    if ($method === 'POST' && $route === 'media') {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Contributor', 'Reviewer']);
        $input = body();
        $title = clean_text($input['title'] ?? '', 180);
        $url = valid_url($input['url'] ?? '');
        if ($title === '' || $url === '') {
            fail('Add a title and external link.');
        }
        $item = [
            'id' => uid(),
            'eventId' => clean_text($input['eventId'] ?? '', 80) ?: null,
            'campaignId' => clean_text($input['campaignId'] ?? '', 80) ?: null,
            'title' => $title,
            'kind' => clean_text($input['kind'] ?? 'Cloud folder', 80),
            'url' => $url,
            'tags' => clean_text($input['tags'] ?? '', 500),
            'uploadedBy' => $actor['id'],
            'createdAt' => now_iso(),
        ];
        $store['media'][] = $item;
        add_activity($store, $actor, $item['eventId'], 'link.created', $actor['fullName'] . ' added external link “' . $title . '”.');
        respond(['ok' => true, 'id' => $item['id']], 201);
    }

    if ($method === 'DELETE' && preg_match('#^media/([^/]+)$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead']);
        $index = find_index($store['media'], $matches[1]);
        if ($index < 0) {
            fail('This external link is no longer available.', 404);
        }
        array_splice($store['media'], $index, 1);
        respond(['ok' => true]);
    }

    if ($method === 'POST' && $route === 'members') {
        require_roles($actor, ['Administrator']);
        $input = body();
        $fullName = clean_text($input['fullName'] ?? '', 160);
        $password = (string) ($input['password'] ?? '');
        $email = strtolower(clean_text($input['email'] ?? '', 180));
        if (
            $fullName === ''
            || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || strlen($password) < 12
        ) {
            fail('Add a name, valid email, and temporary password of at least 12 characters.');
        }
        foreach ($store['users'] as $user) {
            if (strtolower((string) ($user['email'] ?? '')) === $email) {
                fail('That email address is already linked to an account.');
            }
        }
        $parts = preg_split('/\s+/', $fullName) ?: [];
        $letters = implode('', array_map(
            fn(string $part): string => function_exists('mb_substr')
                ? mb_substr($part, 0, 1)
                : substr($part, 0, 1),
            $parts,
        ));
        $initials = strtoupper(function_exists('mb_substr') ? mb_substr($letters, 0, 2) : substr($letters, 0, 2));
        $user = [
            'id' => uid(),
            'username' => $email,
            'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
            'email' => $email,
            'emailNotifications' => 1,
            'fullName' => $fullName,
            'initials' => $initials ?: 'TM',
            'role' => clean_text($input['role'] ?? 'Viewer', 80),
            'department' => clean_text($input['department'] ?? 'General', 100),
            'mustChangeCredentials' => 0,
            'avatarColour' => clean_text($input['avatarColour'] ?? '#49747B', 20),
            'active' => 1,
            'failedAttempts' => 0,
            'lockedUntil' => null,
            'createdAt' => now_iso(),
        ];
        $store['users'][] = $user;
        add_activity($store, $actor, null, 'member.created', $actor['fullName'] . ' added ' . $fullName . ' to the team.');
        respond(['ok' => true, 'id' => $user['id']], 201);
    }

    if ($method === 'POST' && $route === 'account/password') {
        $input = body();
        $currentPassword = (string) ($input['currentPassword'] ?? '');
        $newPassword = (string) ($input['newPassword'] ?? '');
        $index = find_index($store['users'], $actor['id']);
        if ($index < 0 || !password_verify($currentPassword, (string) $store['users'][$index]['passwordHash'])) {
            fail('The current password is incorrect.', 403);
        }
        if (strlen($newPassword) < 12) {
            fail('Use a new password of at least 12 characters.');
        }
        if (hash_equals($currentPassword, $newPassword)) {
            fail('Choose a new password that is different from the current one.');
        }
        $store['users'][$index]['passwordHash'] = password_hash($newPassword, PASSWORD_DEFAULT);
        $store['users'][$index]['passwordChangedAt'] = now_iso();
        add_activity($store, $actor, null, 'account.password', $actor['fullName'] . ' changed their password.');
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        respond(['ok' => true, 'csrfToken' => $_SESSION['csrf']]);
    }

    if ($method === 'PATCH' && $route === 'account/notifications') {
        $input = body();
        $index = find_index($store['users'], $actor['id']);
        if ($index < 0) {
            fail('Your account is no longer available.', 404);
        }
        $enabled = !empty($input['emailNotifications']);
        $store['users'][$index]['emailNotifications'] = $enabled ? 1 : 0;
        add_activity(
            $store,
            $actor,
            null,
            'account.notifications',
            $actor['fullName'] . ($enabled
                ? ' enabled email notifications.'
                : ' paused email notifications.'),
        );
        respond(['ok' => true]);
    }

    if ($method === 'PATCH' && preg_match('#^members/([^/]+)$#', $route, $matches)) {
        require_roles($actor, ['Administrator']);
        $index = find_index($store['users'], $matches[1]);
        if ($index < 0) {
            fail('This team member is no longer available.', 404);
        }
        $input = body();
        if (array_key_exists('email', $input)) {
            $email = strtolower(clean_text($input['email'], 180));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fail('Enter a valid email address.');
            }
            foreach ($store['users'] as $otherIndex => $user) {
                if ($otherIndex !== $index && strtolower((string) ($user['email'] ?? '')) === $email) {
                    fail('That email address is already linked to another account.');
                }
            }
            $store['users'][$index]['email'] = $email;
            $store['users'][$index]['username'] = $email;
        }
        if (array_key_exists('fullName', $input)) {
            $fullName = clean_text($input['fullName'], 160);
            if ($fullName === '') {
                fail('Enter the team member’s full name.');
            }
            $parts = preg_split('/\s+/', $fullName) ?: [];
            $letters = implode('', array_map(
                fn(string $part): string => function_exists('mb_substr')
                    ? mb_substr($part, 0, 1)
                    : substr($part, 0, 1),
                $parts,
            ));
            $store['users'][$index]['fullName'] = $fullName;
            $store['users'][$index]['initials'] = strtoupper(
                function_exists('mb_substr') ? mb_substr($letters, 0, 2) : substr($letters, 0, 2),
            ) ?: 'TM';
        }
        if (array_key_exists('role', $input)) {
            $role = clean_text($input['role'], 80);
            $roles = ['Administrator', 'Project Manager', 'Team Lead', 'Contributor', 'Reviewer', 'Viewer'];
            if (!in_array($role, $roles, true)) {
                fail('Choose a valid team role.');
            }
            if (($store['users'][$index]['role'] ?? '') === 'Administrator' && $role !== 'Administrator') {
                $administratorCount = count(array_filter(
                    $store['users'],
                    fn(array $user): bool => !empty($user['active']) && ($user['role'] ?? '') === 'Administrator',
                ));
                if ($administratorCount <= 1) {
                    fail('Add another administrator before changing this role.');
                }
            }
            $store['users'][$index]['role'] = $role;
        }
        foreach (['department', 'avatarColour'] as $field) {
            if (array_key_exists($field, $input)) {
                $store['users'][$index][$field] = clean_text($input[$field], 180);
            }
        }
        if (!empty($input['password'])) {
            if (strlen((string) $input['password']) < 12) {
                fail('Use a temporary password of at least 12 characters.');
            }
            $store['users'][$index]['passwordHash'] = password_hash((string) $input['password'], PASSWORD_DEFAULT);
        }
        if (array_key_exists('active', $input)) {
            if ($matches[1] === $actor['id'] && empty($input['active'])) {
                fail('You cannot disable your own administrator account.');
            }
            $store['users'][$index]['active'] = !empty($input['active']) ? 1 : 0;
        }
        if (array_key_exists('emailNotifications', $input)) {
            $store['users'][$index]['emailNotifications'] = !empty($input['emailNotifications']) ? 1 : 0;
        }
        add_activity($store, $actor, null, 'member.updated', $actor['fullName'] . ' updated ' . $store['users'][$index]['fullName'] . '’s account.');
        respond(['ok' => true]);
    }

    if ($method === 'DELETE' && preg_match('#^members/([^/]+)$#', $route, $matches)) {
        require_roles($actor, ['Administrator']);
        $memberId = $matches[1];
        if ($memberId === $actor['id']) {
            fail('You cannot delete the account you are currently using.');
        }
        $index = find_index($store['users'], $memberId);
        if ($index < 0) {
            fail('This team member is no longer available.', 404);
        }
        $member = $store['users'][$index];
        if (($member['role'] ?? '') === 'Administrator') {
            $administratorCount = count(array_filter(
                $store['users'],
                fn(array $user): bool => !empty($user['active']) && ($user['role'] ?? '') === 'Administrator',
            ));
            if ($administratorCount <= 1) {
                fail('Add another administrator before deleting this account.');
            }
        }
        $unassigned = unassign_member_work($store, $memberId);
        array_splice($store['users'], $index, 1);
        add_activity(
            $store,
            $actor,
            null,
            'member.deleted',
            $actor['fullName'] . ' removed ' . ($member['fullName'] ?? 'a team member') . '. Their active work is now unassigned.',
        );
        respond(['ok' => true, 'unassigned' => $unassigned]);
    }

    if ($method === 'POST' && $route === 'comments') {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Contributor', 'Reviewer']);
        $input = body();
        $eventId = clean_text($input['eventId'] ?? '', 80);
        $message = clean_text($input['body'] ?? '', 2000);
        if ($eventId === '' || $message === '') {
            fail('Write an update before sending.');
        }
        $store['comments'][] = [
            'id' => uid(),
            'eventId' => $eventId,
            'memberId' => $actor['id'],
            'body' => $message,
            'important' => !empty($input['important']) ? 1 : 0,
            'createdAt' => now_iso(),
        ];
        add_activity($store, $actor, $eventId, 'comment.created', $actor['fullName'] . ' added a milestone update.');
        respond(['ok' => true], 201);
    }

    if ($method === 'POST' && $route === 'notifications/read') {
        foreach ($store['notifications'] as &$notification) {
            if (($notification['memberId'] ?? '') === $actor['id'] && empty($notification['readAt'])) {
                $notification['readAt'] = now_iso();
            }
        }
        unset($notification);
        respond(['ok' => true]);
    }

    if ($method === 'PATCH' && $route === 'email/config') {
        require_roles($actor, ['Administrator']);
        $input = body();
        $current = planner_mail_config();
        $password = (string) ($input['smtpPassword'] ?? '');
        if ($password === '') {
            $password = (string) ($current['smtpPassword'] ?? '');
        }
        if ($password === '') {
            fail('Enter the mailbox password.');
        }
        $smtpHost = clean_text($input['smtpHost'] ?? $current['smtpHost'] ?? '', 255);
        $smtpPort = (int) ($input['smtpPort'] ?? $current['smtpPort'] ?? 465);
        $smtpUsername = strtolower(clean_text($input['smtpUsername'] ?? $current['smtpUsername'] ?? '', 180));
        $fromAddress = strtolower(clean_text($input['fromAddress'] ?? $current['fromAddress'] ?? '', 180));
        $replyToAddress = strtolower(clean_text($input['replyToAddress'] ?? $current['replyToAddress'] ?? $fromAddress, 180));
        if ($smtpHost === '' || $smtpPort < 1 || $smtpPort > 65535) {
            fail('Enter a valid SMTP host and port.');
        }
        if (!filter_var($smtpUsername, FILTER_VALIDATE_EMAIL) || !filter_var($fromAddress, FILTER_VALIDATE_EMAIL)) {
            fail('Enter a valid mailbox username and sender email address.');
        }
        if ($replyToAddress !== '' && !filter_var($replyToAddress, FILTER_VALIDATE_EMAIL)) {
            fail('Enter a valid reply-to email address.');
        }
        $appUrl = clean_text($input['appUrl'] ?? application_url_from_request(), 500);
        if (!filter_var($appUrl, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $appUrl)) {
            fail('The website address for email links is invalid.');
        }
        $config = array_merge($current, [
            'enabled' => !array_key_exists('enabled', $input) || !empty($input['enabled']),
            'smtpHost' => $smtpHost,
            'smtpPort' => $smtpPort,
            'encryption' => 'ssl',
            'smtpUsername' => $smtpUsername,
            'smtpPassword' => $password,
            'fromAddress' => $fromAddress,
            'fromName' => clean_text($store['organisation']['productName'] ?? 'Project Workspace', 120),
            'replyToAddress' => $replyToAddress ?: $fromAddress,
            'appUrl' => rtrim($appUrl, '/') . '/',
            'savedAt' => now_iso(),
        ]);
        planner_write_mail_config($config);
        add_activity($store, $actor, null, 'email.configured', $actor['fullName'] . ' updated email delivery settings.');
        respond(['ok' => true, 'emailDelivery' => planner_mail_status($config)]);
    }

    if ($method === 'POST' && $route === 'email/test') {
        require_roles($actor, ['Administrator']);
        if (!filter_var($actor['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
            fail('Your account needs a valid email address before a test can be sent.');
        }
        $config = planner_mail_config();
        $status = planner_mail_status($config);
        if (!$status['configured'] || !$status['enabled']) {
            fail('Save and enable the Hostinger mailbox before sending a test.');
        }
        try {
            planner_send_test_email($store, $actor, $config);
        } catch (Throwable $error) {
            error_log('Project Workspace email test: ' . $error->getMessage());
            fail($error->getMessage(), 502);
        }
        $config['lastTestAt'] = now_iso();
        $config['lastTestRecipient'] = $actor['email'];
        planner_write_mail_config($config);
        add_activity($store, $actor, null, 'email.test', $actor['fullName'] . ' sent a test email.');
        respond(['ok' => true, 'sentTo' => $actor['email']]);
    }

    if ($method === 'POST' && $route === 'branding/logo') {
        require_roles($actor, ['Administrator']);
        $input = body();
        $variant = brand_variant($input['variant'] ?? '');
        if (($input['variant'] ?? '') !== $variant) {
            fail('Choose the colour, black, or white logo slot.');
        }
        $imageData = (string) ($input['image'] ?? '');
        if (!preg_match('#^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$#', $imageData, $matches)) {
            fail('Choose a PNG, JPG, or WebP logo.');
        }
        $binary = base64_decode($matches[2], true);
        if ($binary === false || strlen($binary) === 0) {
            fail('The selected logo could not be read.');
        }
        if (strlen($binary) > 1_000_000) {
            fail('Keep each logo under 1 MB.', 413);
        }
        $image = @getimagesizefromstring($binary);
        $mime = is_array($image) ? (string) ($image['mime'] ?? '') : '';
        if (
            !in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)
            || $mime !== $matches[1]
        ) {
            fail('The selected file is not a valid PNG, JPG, or WebP image.');
        }
        $width = (int) ($image[0] ?? 0);
        $height = (int) ($image[1] ?? 0);
        if ($width < 128 || $height < 128 || $width > 2400 || $height > 2400) {
            fail('Use a logo between 128 and 2400 pixels in both dimensions.');
        }
        store_brand_logo($variant, $binary, $mime);
        $store['organisation']['logoVersion'] = now_iso();
        add_activity(
            $store,
            $actor,
            null,
            'branding.logo',
            $actor['fullName'] . ' updated the ' . $variant . ' workspace logo.',
        );
        respond(['ok' => true, 'variant' => $variant]);
    }

    if ($method === 'PATCH' && $route === 'settings') {
        require_roles($actor, ['Administrator']);
        $input = body();
        if (
            array_key_exists('timezone', $input)
            && !in_array((string) $input['timezone'], timezone_identifiers_list(), true)
        ) {
            fail('Choose a valid timezone.');
        }
        foreach (['name', 'productName', 'timezone', 'language'] as $field) {
            if (array_key_exists($field, $input)) {
                $store['organisation'][$field] = clean_text($input[$field], 180);
            }
        }
        if (array_key_exists('primaryColour', $input)) {
            $store['organisation']['primaryColour'] = valid_colour($input['primaryColour'], '#2563EB');
        }
        if (array_key_exists('accentColour', $input)) {
            $store['organisation']['accentColour'] = valid_colour($input['accentColour'], '#14B8A6');
        }
        if (isset($input['settings']) && is_array($input['settings'])) {
            $store['organisation']['settings'] = array_merge(
                $store['organisation']['settings'] ?? [],
                $input['settings'],
            );
        }
        add_activity($store, $actor, null, 'settings.updated', $actor['fullName'] . ' updated workspace settings.');
        respond(['ok' => true]);
    }

    if ($method === 'POST' && $route === 'categories') {
        require_roles($actor, ['Administrator']);
        $input = body();
        $name = clean_text($input['name'] ?? '', 100);
        if ($name === '') {
            fail('Add a category name.');
        }
        $category = [
            'id' => uid(),
            'name' => $name,
            'colour' => valid_colour($input['colour'] ?? '#68736F'),
            'sortOrder' => count($store['categories']) + 1,
            'enabled' => 1,
        ];
        $store['categories'][] = $category;
        respond(['ok' => true, 'id' => $category['id']], 201);
    }

    if ($method === 'PATCH' && preg_match('#^categories/([^/]+)$#', $route, $matches)) {
        require_roles($actor, ['Administrator']);
        $index = find_index($store['categories'], $matches[1]);
        if ($index < 0) {
            fail('This category is no longer available.', 404);
        }
        $input = body();
        foreach (['name', 'colour', 'sortOrder'] as $field) {
            if (array_key_exists($field, $input)) {
                $store['categories'][$index][$field] = $field === 'sortOrder'
                    ? (int) $input[$field]
                    : ($field === 'colour'
                        ? valid_colour($input[$field])
                        : clean_text($input[$field], 100));
            }
        }
        if (array_key_exists('enabled', $input)) {
            $store['categories'][$index]['enabled'] = !empty($input['enabled']) ? 1 : 0;
        }
        respond(['ok' => true]);
    }

    if ($method === 'POST' && $route === 'reminders') {
        $input = body();
        $title = clean_text($input['title'] ?? '', 180);
        $scheduledAt = clean_text($input['scheduledAt'] ?? '', 40);
        if ($title === '' || strtotime($scheduledAt) === false) {
            fail('Add a reminder title and valid date.');
        }
        $store['reminders'][] = [
            'id' => uid(),
            'eventId' => clean_text($input['eventId'] ?? '', 80) ?: null,
            'memberId' => clean_text($input['memberId'] ?? $actor['id'], 80),
            'offsetCode' => 'custom',
            'scheduledAt' => gmdate('Y-m-d\TH:i:s\Z', strtotime($scheduledAt)),
            'status' => 'Pending',
            'sentAt' => null,
            'customTitle' => $title,
        ];
        respond(['ok' => true], 201);
    }

    if ($method === 'PATCH' && preg_match('#^shot-items/([^/]+)$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Contributor']);
        $index = find_index($store['shotItems'], $matches[1]);
        if ($index < 0) {
            fail('This shot-list item is no longer available.', 404);
        }
        $input = body();
        if (array_key_exists('completed', $input)) {
            $store['shotItems'][$index]['completed'] = !empty($input['completed']) ? 1 : 0;
        }
        if (array_key_exists('notes', $input)) {
            $store['shotItems'][$index]['notes'] = clean_text($input['notes'], 1000);
        }
        $store['shotItems'][$index]['version'] = (int) ($store['shotItems'][$index]['version'] ?? 1) + 1;
        respond(['ok' => true]);
    }

    if ($method === 'PATCH' && preg_match('#^equipment-items/([^/]+)$#', $route, $matches)) {
        require_roles($actor, ['Administrator', 'Project Manager', 'Team Lead', 'Contributor']);
        $index = find_index($store['equipmentItems'], $matches[1]);
        if ($index < 0) {
            fail('This equipment item is no longer available.', 404);
        }
        $input = body();
        $store['equipmentItems'][$index]['confirmed'] = !empty($input['confirmed']) ? 1 : 0;
        $store['equipmentItems'][$index]['version'] = (int) ($store['equipmentItems'][$index]['version'] ?? 1) + 1;
        respond(['ok' => true]);
    }

    fail('This planner action was not found.', 404);
});
