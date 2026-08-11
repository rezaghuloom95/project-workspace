<?php

declare(strict_types=1);

/*
 * Run this file from a Hostinger PHP cron job every five minutes.
 * It intentionally refuses browser requests.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/mailer.php';

const PLANNER_CRON_STORE_FILE = __DIR__ . '/../storage/data.json';

$handle = fopen(PLANNER_CRON_STORE_FILE, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    fwrite(STDERR, "Project Workspace: storage is unavailable.\n");
    exit(1);
}

$exitCode = 0;
try {
    rewind($handle);
    $raw = stream_get_contents($handle);
    $store = $raw ? json_decode($raw, true) : null;
    if (!is_array($store) || empty($store)) {
        throw new RuntimeException('The planner data file is empty or invalid.');
    }
    $store['emailQueue'] ??= [];
    $store['users'] ??= [];
    foreach ($store['users'] as &$user) {
        $email = strtolower(trim((string) ($user['email'] ?? '')));
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $user['email'] = $email;
            $user['username'] = $email;
        }
        $user['emailNotifications'] ??= filter_var($email, FILTER_VALIDATE_EMAIL) ? 1 : 0;
    }
    unset($user);

    $legacyQueueClosed = planner_close_legacy_stuck_email_queue($store);
    $remindersCreated = planner_materialise_due_reminders($store);
    $duplicatesSuppressed = planner_suppress_duplicate_assignment_emails($store);
    $result = planner_process_email_queue($store, 25);
    $encoded = json_encode(
        $store,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
    );
    if ($encoded === false) {
        throw new RuntimeException('The updated planner data could not be encoded.');
    }

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, $encoded . PHP_EOL);
    fflush($handle);

    fwrite(
        STDOUT,
        sprintf(
            "Project Workspace: repaired=%d reminders=%d duplicates=%d processed=%d sent=%d failed=%d skipped=%d\n",
            $legacyQueueClosed,
            $remindersCreated,
            $duplicatesSuppressed,
            $result['processed'],
            $result['sent'],
            $result['failed'],
            $result['skipped'],
        ),
    );
} catch (Throwable $error) {
    fwrite(STDERR, 'Project Workspace: ' . $error->getMessage() . "\n");
    $exitCode = 1;
} finally {
    flock($handle, LOCK_UN);
    fclose($handle);
}

exit($exitCode);
