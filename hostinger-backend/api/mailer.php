<?php

declare(strict_types=1);

/*
 * Self-contained SMTP delivery for standard shared hosting.
 *
 * The mailbox password is written to a protected PHP file inside /storage. The
 * storage directory is denied by Apache and the file also refuses direct web
 * execution. No secret is returned by the API or included in the browser build.
 */

const PLANNER_MAIL_CONFIG_FILE = __DIR__ . '/../storage/email-config.php';

function planner_mail_defaults(): array
{
    return [
        'enabled' => false,
        'smtpHost' => 'smtp.hostinger.com',
        'smtpPort' => 465,
        'encryption' => 'ssl',
        'smtpUsername' => '',
        'smtpPassword' => '',
        'fromAddress' => '',
        'fromName' => 'Project Workspace',
        'replyToAddress' => '',
        'appUrl' => '',
        'savedAt' => null,
        'lastTestAt' => null,
        'lastTestRecipient' => null,
    ];
}

function planner_mail_config(): array
{
    $config = [];
    if (is_file(PLANNER_MAIL_CONFIG_FILE)) {
        if (!defined('PLANNER_INTERNAL')) {
            define('PLANNER_INTERNAL', true);
        }
        $loaded = require PLANNER_MAIL_CONFIG_FILE;
        if (is_array($loaded)) {
            $config = $loaded;
        }
    }

    return array_merge(planner_mail_defaults(), $config);
}

function planner_mail_status(?array $config = null): array
{
    $config ??= planner_mail_config();
    $configured = filter_var($config['smtpUsername'] ?? '', FILTER_VALIDATE_EMAIL)
        && trim((string) ($config['smtpPassword'] ?? '')) !== ''
        && filter_var($config['fromAddress'] ?? '', FILTER_VALIDATE_EMAIL);

    return [
        'configured' => (bool) $configured,
        'enabled' => (bool) ($config['enabled'] ?? false),
        'smtpHost' => (string) ($config['smtpHost'] ?? 'smtp.hostinger.com'),
        'smtpPort' => (int) ($config['smtpPort'] ?? 465),
        'encryption' => (string) ($config['encryption'] ?? 'ssl'),
        'smtpUsername' => (string) ($config['smtpUsername'] ?? ''),
        'fromAddress' => (string) ($config['fromAddress'] ?? ''),
        'replyToAddress' => (string) ($config['replyToAddress'] ?? ''),
        'appUrl' => (string) ($config['appUrl'] ?? ''),
        'lastTestAt' => $config['lastTestAt'] ?? null,
        'lastTestRecipient' => $config['lastTestRecipient'] ?? null,
    ];
}

function planner_write_mail_config(array $config): void
{
    $directory = dirname(PLANNER_MAIL_CONFIG_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new RuntimeException('The email settings folder is not writable.');
    }

    $config = array_merge(planner_mail_defaults(), $config);
    $php = "<?php\n"
        . "defined('PLANNER_INTERNAL') || exit;\n\n"
        . 'return ' . var_export($config, true) . ";\n";
    $temporary = tempnam($directory, 'email-config-');
    if ($temporary === false || file_put_contents($temporary, $php, LOCK_EX) === false) {
        throw new RuntimeException('The email settings could not be saved.');
    }
    @chmod($temporary, 0600);
    if (!rename($temporary, PLANNER_MAIL_CONFIG_FILE)) {
        @unlink($temporary);
        throw new RuntimeException('The email settings could not be activated.');
    }
    @chmod(PLANNER_MAIL_CONFIG_FILE, 0600);
}

function planner_mail_uid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function planner_mail_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function planner_find_record(array $items, string $id): ?array
{
    foreach ($items as $item) {
        if (($item['id'] ?? '') === $id) {
            return $item;
        }
    }
    return null;
}

function planner_queue_email(
    array &$store,
    string $memberId,
    ?string $eventId,
    string $title,
    string $message,
    string $kind,
    ?string $sourceKey = null,
    ?string $taskId = null,
): void {
    $user = planner_find_record($store['users'] ?? [], $memberId);
    if (
        !$user
        || empty($user['active'])
        || (array_key_exists('emailNotifications', $user) && empty($user['emailNotifications']))
        || !filter_var($user['email'] ?? '', FILTER_VALIDATE_EMAIL)
    ) {
        return;
    }

    if ($sourceKey !== null) {
        foreach ($store['emailQueue'] ?? [] as $queued) {
            if (($queued['sourceKey'] ?? null) === $sourceKey) {
                return;
            }
        }
    }

    $store['emailQueue'] ??= [];
    $store['emailQueue'][] = [
        'id' => planner_mail_uid(),
        'memberId' => $memberId,
        'eventId' => $eventId,
        'taskId' => $taskId,
        'title' => $title,
        'message' => $message,
        'kind' => $kind,
        'sourceKey' => $sourceKey,
        'status' => 'Pending',
        'attempts' => 0,
        'nextAttemptAt' => planner_mail_now(),
        'lastError' => null,
        'createdAt' => planner_mail_now(),
        'sentAt' => null,
    ];
    $store['emailQueue'] = array_slice($store['emailQueue'], -1000);
}

function planner_add_notification(
    array &$store,
    string $memberId,
    ?string $eventId,
    string $title,
    string $message,
    string $kind = 'Information',
    ?string $sourceKey = null,
    ?string $taskId = null,
): bool {
    if ($sourceKey !== null) {
        foreach ($store['notifications'] ?? [] as $notification) {
            if (($notification['sourceKey'] ?? null) === $sourceKey) {
                return false;
            }
        }
    }

    $store['notifications'] ??= [];
    array_unshift($store['notifications'], [
        'id' => planner_mail_uid(),
        'memberId' => $memberId,
        'eventId' => $eventId,
        'taskId' => $taskId,
        'title' => $title,
        'message' => $message,
        'kind' => $kind,
        'sourceKey' => $sourceKey,
        'readAt' => null,
        'createdAt' => planner_mail_now(),
    ]);
    $store['notifications'] = array_slice($store['notifications'], 0, 500);
    planner_queue_email($store, $memberId, $eventId, $title, $message, $kind, $sourceKey, $taskId);
    return true;
}

function planner_materialise_task_due_notifications(array &$store, ?string $memberId = null): int
{
    $created = 0;
    $minimumAssignmentGap = 6 * 60 * 60;
    $utc = new DateTimeZone('UTC');
    $localTimezone = new DateTimeZone((string) ($store['organisation']['timezone'] ?? 'UTC'));
    $nowUtc = new DateTimeImmutable('now', $utc);
    $nowLocal = $nowUtc->setTimezone($localTimezone);
    $today = $nowLocal->setTime(0, 0);

    foreach ($store['tasks'] ?? [] as $task) {
        $assigneeId = (string) ($task['assigneeId'] ?? '');
        if (
            $assigneeId === ''
            || ($memberId !== null && $assigneeId !== $memberId)
            || ($task['status'] ?? '') === 'Completed'
            || empty($task['dueAt'])
        ) {
            continue;
        }

        try {
            $dueUtc = new DateTimeImmutable((string) $task['dueAt'], $utc);
            $assignedUtc = new DateTimeImmutable(
                (string) ($task['assignedAt'] ?? $task['createdAt'] ?? '@0'),
                $utc,
            );
        } catch (Throwable) {
            continue;
        }
        $dueLocal = $dueUtc->setTimezone($localTimezone);
        $daysRemaining = (int) $today->diff($dueLocal->setTime(0, 0))->format('%r%a');
        $stage = null;
        $title = '';
        $message = '';

        if ($dueUtc < $nowUtc && $nowUtc->getTimestamp() >= max(
            $dueUtc->getTimestamp(),
            $assignedUtc->getTimestamp() + $minimumAssignmentGap,
        )) {
            $stage = 'overdue';
            $title = 'Task overdue';
            $message = '“' . (string) ($task['title'] ?? 'Task') . '” has passed its deadline. Please update its status or agree a new due date.';
        } elseif (in_array($daysRemaining, [3, 2, 1, 0], true)) {
            $scheduledLocal = $dueLocal
                ->modify('-' . $daysRemaining . ' days')
                ->setTime(8, 0);
            $scheduledUtc = $scheduledLocal->setTimezone($utc);
            if (
                $nowUtc >= $scheduledUtc
                && $dueUtc > $nowUtc
                && $assignedUtc < $scheduledUtc
                && ($scheduledUtc->getTimestamp() - $assignedUtc->getTimestamp()) >= $minimumAssignmentGap
            ) {
                $stage = $daysRemaining === 0 ? 'day' : $daysRemaining . 'd';
                $title = $daysRemaining === 0
                    ? 'Task due today'
                    : 'Task due in ' . $daysRemaining . ' day' . ($daysRemaining === 1 ? '' : 's');
                $message = '“' . (string) ($task['title'] ?? 'Task') . '” is due '
                    . ($daysRemaining === 0 ? 'today' : 'in ' . $daysRemaining . ' day' . ($daysRemaining === 1 ? '' : 's'))
                    . '. Review the task and update its status when ready.';
            }
        }

        if ($stage === null) {
            continue;
        }

        $taskId = (string) ($task['id'] ?? '');
        $sourceKey = implode(':', [
            'task-reminder',
            $taskId,
            $assigneeId,
            rawurlencode((string) $task['dueAt']),
            $stage,
        ]);
        if (planner_add_notification(
            $store,
            $assigneeId,
            !empty($task['eventId']) ? (string) $task['eventId'] : null,
            $title,
            $message,
            $stage === 'overdue' ? 'Overdue' : 'Reminder',
            $sourceKey,
            $taskId,
        )) {
            $created++;
        }
    }

    return $created;
}

function planner_materialise_due_reminders(array &$store, ?string $memberId = null): int
{
    $created = 0;
    $now = time();
    $store['reminders'] ??= [];
    foreach ($store['reminders'] as &$reminder) {
        if (
            ($memberId !== null && ($reminder['memberId'] ?? '') !== $memberId)
            || ($reminder['status'] ?? '') !== 'Pending'
            || strtotime((string) ($reminder['scheduledAt'] ?? '')) > $now
        ) {
            continue;
        }

        $event = planner_find_record($store['events'] ?? [], (string) ($reminder['eventId'] ?? ''));
        if ($event && empty($event['archivedAt']) && strtotime((string) ($event['startsAt'] ?? '')) >= $now) {
            planner_add_notification(
                $store,
                (string) $reminder['memberId'],
                (string) $event['id'],
                'Upcoming milestone reminder',
                (string) $event['title'] . ' is approaching. Review your assignment and outstanding tasks.',
                'Reminder',
                'reminder:' . (string) $reminder['id'],
            );
            $created++;
            $reminder['status'] = 'Sent';
            $reminder['sentAt'] = planner_mail_now();
        } else {
            $reminder['status'] = 'Expired';
        }
    }
    unset($reminder);

    return $created + planner_materialise_task_due_notifications($store, $memberId);
}

function planner_suppress_duplicate_assignment_emails(array &$store): int
{
    $sent = [];
    foreach ($store['emailQueue'] ?? [] as $queued) {
        if (
            ($queued['status'] ?? '') === 'Sent'
            && in_array(($queued['kind'] ?? ''), ['Task', 'Assignment'], true)
            && preg_match('/assign(?:ed|ment)|reassigned/i', (string) ($queued['title'] ?? ''))
        ) {
            $fingerprint = hash('sha256', implode('|', [
                (string) ($queued['memberId'] ?? ''),
                (string) ($queued['eventId'] ?? ''),
                (string) ($queued['title'] ?? ''),
                (string) ($queued['message'] ?? ''),
                (string) ($queued['kind'] ?? ''),
            ]));
            $sent[$fingerprint] = true;
        }
    }

    $kept = [];
    $suppressed = 0;
    $store['emailQueue'] ??= [];
    foreach ($store['emailQueue'] as &$queued) {
        if (
            !in_array(($queued['status'] ?? ''), ['Pending', 'Retry'], true)
            || !in_array(($queued['kind'] ?? ''), ['Task', 'Assignment'], true)
            || !preg_match('/assign(?:ed|ment)|reassigned/i', (string) ($queued['title'] ?? ''))
        ) {
            continue;
        }
        $fingerprint = hash('sha256', implode('|', [
            (string) ($queued['memberId'] ?? ''),
            (string) ($queued['eventId'] ?? ''),
            (string) ($queued['title'] ?? ''),
            (string) ($queued['message'] ?? ''),
            (string) ($queued['kind'] ?? ''),
        ]));
        if (isset($sent[$fingerprint]) || isset($kept[$fingerprint])) {
            $queued['status'] = 'Skipped';
            $queued['lastError'] = 'Duplicate assignment notification suppressed.';
            $suppressed++;
            continue;
        }
        $kept[$fingerprint] = true;
    }
    unset($queued);

    return $suppressed;
}

function planner_close_legacy_stuck_email_queue(array &$store): int
{
    if ((int) ($store['emailQueuePersistenceVersion'] ?? 0) >= 1) {
        return 0;
    }

    $store['emailQueue'] ??= [];
    $cutoff = time() - (6 * 60);
    $closed = 0;
    foreach ($store['emailQueue'] as &$queued) {
        $createdAt = strtotime((string) ($queued['createdAt'] ?? ''));
        if (
            ($queued['status'] ?? '') === 'Pending'
            && (int) ($queued['attempts'] ?? 0) === 0
            && $createdAt !== false
            && $createdAt <= $cutoff
        ) {
            $queued['status'] = 'Skipped';
            $queued['lastError'] = 'Closed during the one-time email queue persistence repair.';
            $closed++;
        }
    }
    unset($queued);
    $store['emailQueuePersistenceVersion'] = 1;

    return $closed;
}

function planner_escape_html(mixed $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function planner_email_datetime(string $value, string $timezone): string
{
    try {
        $date = new DateTimeImmutable($value, new DateTimeZone('UTC'));
        return $date
            ->setTimezone(new DateTimeZone($timezone))
            ->format('l, j F Y · g:i A');
    } catch (Throwable) {
        return $value;
    }
}

function planner_email_payload(array $store, array $queued, array $recipient, array $config): array
{
    $organisation = $store['organisation'] ?? [];
    $event = !empty($queued['eventId'])
        ? planner_find_record($store['events'] ?? [], (string) $queued['eventId'])
        : null;
    $task = !empty($queued['taskId'])
        ? planner_find_record($store['tasks'] ?? [], (string) $queued['taskId'])
        : null;
    $timezone = (string) ($organisation['timezone'] ?? 'UTC');
    $clubName = trim((string) ($organisation['name'] ?? 'Project Workspace')) ?: 'Project Workspace';
    $primary = (string) ($organisation['primaryColour'] ?? '#2563EB');
    $accent = (string) ($organisation['accentColour'] ?? '#14B8A6');
    if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $primary)) {
        $primary = '#2563EB';
    }
    if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $accent)) {
        $accent = '#14B8A6';
    }

    $details = [];
    $tasks = [];
    if ($task) {
        $details[] = ['Task', (string) ($task['title'] ?? '')];
        if (!empty($task['dueAt'])) {
            $details[] = ['Deadline', planner_email_datetime((string) $task['dueAt'], $timezone)];
        }
        if (!empty($task['priority'])) {
            $details[] = ['Priority', (string) $task['priority']];
        }
        if (!empty($task['status'])) {
            $details[] = ['Status', (string) $task['status']];
        }
    }
    if ($event) {
        $details[] = ['Milestone', (string) ($event['title'] ?? '')];
        if (!empty($event['startsAt'])) {
            $details[] = ['Date and time', planner_email_datetime((string) $event['startsAt'], $timezone)];
        }
        if (!empty($event['venue'])) {
            $details[] = ['Venue', (string) $event['venue']];
        }
        if (!empty($event['priority'])) {
            $details[] = ['Priority', (string) $event['priority']];
        }
        foreach ($store['assignments'] ?? [] as $assignment) {
            if (
                ($assignment['eventId'] ?? '') === ($event['id'] ?? '')
                && ($assignment['memberId'] ?? '') === ($recipient['id'] ?? '')
            ) {
                $details[] = ['Your responsibility', (string) ($assignment['responsibility'] ?? 'Project team')];
                break;
            }
        }
        foreach ($store['tasks'] ?? [] as $task) {
            if (
                ($task['eventId'] ?? '') === ($event['id'] ?? '')
                && ($task['assigneeId'] ?? '') === ($recipient['id'] ?? '')
                && ($task['status'] ?? '') !== 'Completed'
            ) {
                $tasks[] = [
                    'title' => (string) ($task['title'] ?? 'Task'),
                    'dueAt' => !empty($task['dueAt'])
                        ? planner_email_datetime((string) $task['dueAt'], $timezone)
                        : '',
                ];
            }
            if (count($tasks) >= 5) {
                break;
            }
        }
    }

    $appUrl = filter_var($config['appUrl'] ?? '', FILTER_VALIDATE_URL)
        ? rtrim((string) $config['appUrl'], '/') . '/'
        : '';
    $logoVersion = trim((string) ($organisation['logoVersion'] ?? ''));
    $brandLogoUrl = $appUrl === ''
        ? ''
        : $appUrl . 'api/brand/logo?variant=white'
            . ($logoVersion === '' ? '' : '&v=' . rawurlencode($logoVersion));
    $kind = trim((string) ($queued['kind'] ?? 'Update')) ?: 'Update';
    $title = trim((string) ($queued['title'] ?? 'Planner update')) ?: 'Planner update';
    $subject = '[' . $clubName . '] ' . $title;

    return [
        'toAddress' => (string) $recipient['email'],
        'toName' => (string) ($recipient['fullName'] ?? ''),
        'subject' => $subject,
        'clubName' => $clubName,
        'recipientName' => (string) ($recipient['fullName'] ?? 'Team member'),
        'title' => $title,
        'message' => (string) ($queued['message'] ?? ''),
        'kind' => $kind,
        'details' => $details,
        'tasks' => $tasks,
        'appUrl' => $appUrl,
        'brandLogoUrl' => $brandLogoUrl,
        'primaryColour' => $primary,
        'accentColour' => $accent,
        'replyToAddress' => (string) ($config['replyToAddress'] ?? $config['fromAddress'] ?? ''),
    ];
}

function planner_email_html(array $mail): string
{
    $details = '';
    foreach ($mail['details'] as [$label, $value]) {
        $details .= '<tr>'
            . '<td style="padding:10px 12px;color:#68736f;font-size:13px;border-bottom:1px solid #e6ebe8;width:38%;">'
            . planner_escape_html($label) . '</td>'
            . '<td style="padding:10px 12px;color:#18342c;font-size:13px;font-weight:600;border-bottom:1px solid #e6ebe8;">'
            . planner_escape_html($value) . '</td>'
            . '</tr>';
    }
    $detailsBlock = $details === '' ? '' : '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        . 'style="margin:22px 0;border:1px solid #e6ebe8;border-radius:12px;border-collapse:separate;overflow:hidden;">'
        . $details . '</table>';

    $taskItems = '';
    foreach ($mail['tasks'] as $task) {
        $due = $task['dueAt'] !== ''
            ? '<span style="display:block;margin-top:3px;color:#68736f;font-size:12px;">Due ' . planner_escape_html($task['dueAt']) . '</span>'
            : '';
        $taskItems .= '<li style="margin:0 0 10px;padding:0 0 0 3px;color:#18342c;font-size:14px;line-height:1.5;">'
            . '<strong>' . planner_escape_html($task['title']) . '</strong>' . $due . '</li>';
    }
    $tasksBlock = $taskItems === '' ? '' : '<div style="margin:24px 0;padding:18px 20px;background:#f5f8f6;border-radius:12px;">'
        . '<p style="margin:0 0 12px;color:#173f35;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;">Your open tasks</p>'
        . '<ul style="margin:0;padding-left:19px;">' . $taskItems . '</ul></div>';

    $button = $mail['appUrl'] === '' ? '' : '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 8px;"><tr><td '
        . 'style="border-radius:9px;background:' . planner_escape_html($mail['primaryColour']) . ';">'
        . '<a href="' . planner_escape_html($mail['appUrl']) . '" style="display:inline-block;padding:13px 22px;color:#ffffff;'
        . 'font-size:14px;font-weight:700;text-decoration:none;border-radius:9px;">Open Project Workspace&nbsp;&nbsp;→</a>'
        . '</td></tr></table>';

    $preheader = planner_escape_html($mail['title'] . ' — ' . $mail['message']);
    $brandMark = $mail['brandLogoUrl'] === ''
        ? '<td style="width:42px;height:42px;border-radius:12px;background:'
            . planner_escape_html($mail['accentColour'])
            . ';color:#173f35;text-align:center;font-size:13px;font-weight:800;letter-spacing:.4px;">CMP</td>'
        : '<td style="width:48px;height:48px;text-align:center;vertical-align:middle;">'
            . '<img src="' . planner_escape_html($mail['brandLogoUrl'])
            . '" alt="" width="44" height="48" style="display:block;width:44px;height:48px;border:0;margin:0 auto;">'
            . '</td>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . planner_escape_html($mail['subject']) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#eef2f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;">'
        . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">' . $preheader . '</div>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f0;"><tr><td align="center" style="padding:28px 12px;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;'
        . 'overflow:hidden;box-shadow:0 8px 30px rgba(23,63,53,.08);">'
        . '<tr><td style="height:7px;background:' . planner_escape_html($mail['accentColour']) . ';font-size:0;">&nbsp;</td></tr>'
        . '<tr><td style="padding:25px 30px;background:' . planner_escape_html($mail['primaryColour']) . ';">'
        . '<table role="presentation" cellspacing="0" cellpadding="0"><tr>'
        . $brandMark
        . '<td style="padding-left:13px;color:#ffffff;"><strong style="display:block;font-size:16px;">'
        . planner_escape_html($mail['clubName']) . '</strong><span style="display:block;margin-top:3px;color:#d8e5e0;font-size:12px;">'
        . 'Projects, milestones, and team work</span></td></tr></table></td></tr>'
        . '<tr><td style="padding:32px 30px 28px;">'
        . '<span style="display:inline-block;padding:6px 10px;background:#edf5f1;color:#1e6a55;border-radius:999px;'
        . 'font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;">'
        . planner_escape_html($mail['kind']) . '</span>'
        . '<p style="margin:22px 0 7px;color:#68736f;font-size:14px;">Hello ' . planner_escape_html($mail['recipientName']) . ',</p>'
        . '<h1 style="margin:0 0 13px;color:#18342c;font-size:26px;line-height:1.25;letter-spacing:-.4px;">'
        . planner_escape_html($mail['title']) . '</h1>'
        . '<p style="margin:0;color:#42544e;font-size:15px;line-height:1.7;">' . nl2br(planner_escape_html($mail['message'])) . '</p>'
        . $detailsBlock . $tasksBlock . $button
        . '<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e6ebe8;color:#7a8782;font-size:12px;line-height:1.6;">'
        . 'This operational notification was sent to you because your account has email notifications enabled. '
        . 'To update your preference, open Settings in Project Workspace.</p>'
        . '</td></tr>'
        . '<tr><td style="padding:20px 30px;background:#f6f8f7;color:#718079;font-size:12px;line-height:1.6;">'
        . 'Sent by Project Workspace · Questions? Email <a href="mailto:' . planner_escape_html($mail['replyToAddress'])
        . '" style="color:#1e6a55;text-decoration:none;">' . planner_escape_html($mail['replyToAddress']) . '</a><br>'
        . 'Please do not reply to the automated sender address.</td></tr>'
        . '</table></td></tr></table></body></html>';
}

function planner_email_text(array $mail): string
{
    $lines = [
        $mail['clubName'],
        strtoupper((string) $mail['kind']),
        '',
        'Hello ' . $mail['recipientName'] . ',',
        '',
        $mail['title'],
        $mail['message'],
    ];
    foreach ($mail['details'] as [$label, $value]) {
        $lines[] = $label . ': ' . $value;
    }
    if ($mail['tasks']) {
        $lines[] = '';
        $lines[] = 'Your open tasks:';
        foreach ($mail['tasks'] as $task) {
            $lines[] = '- ' . $task['title'] . ($task['dueAt'] !== '' ? ' (Due ' . $task['dueAt'] . ')' : '');
        }
    }
    if ($mail['appUrl'] !== '') {
        $lines[] = '';
        $lines[] = 'Open Project Workspace: ' . $mail['appUrl'];
    }
    $lines[] = '';
    $lines[] = 'Questions: ' . $mail['replyToAddress'];

    return implode("\n", $lines);
}

function planner_smtp_read($socket): array
{
    $lines = [];
    while (($line = fgets($socket, 4096)) !== false) {
        $lines[] = rtrim($line, "\r\n");
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }
    if (!$lines) {
        $meta = stream_get_meta_data($socket);
        throw new RuntimeException(!empty($meta['timed_out'])
            ? 'The SMTP server timed out.'
            : 'The SMTP server closed the connection.');
    }
    $code = (int) substr($lines[count($lines) - 1], 0, 3);
    return [$code, implode(' ', $lines)];
}

function planner_smtp_expect($socket, array $expected): void
{
    [$code, $response] = planner_smtp_read($socket);
    if (!in_array($code, $expected, true)) {
        $safe = preg_replace('/\s+/', ' ', $response) ?? 'SMTP request rejected';
        throw new RuntimeException('Email server response: ' . substr($safe, 0, 240));
    }
}

function planner_smtp_command($socket, string $command, array $expected): void
{
    if (fwrite($socket, $command . "\r\n") === false) {
        throw new RuntimeException('The SMTP command could not be sent.');
    }
    planner_smtp_expect($socket, $expected);
}

function planner_clean_header(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function planner_smtp_send(array $config, array $mail): void
{
    $status = planner_mail_status($config);
    if (!$status['configured'] || !$status['enabled']) {
        throw new RuntimeException('Email delivery is not configured and enabled.');
    }
    if (!filter_var($mail['toAddress'] ?? '', FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('The recipient email address is invalid.');
    }

    $host = trim((string) $config['smtpHost']);
    $port = (int) $config['smtpPort'];
    $encryption = strtolower((string) $config['encryption']);
    $transport = $encryption === 'ssl' ? 'ssl://' : 'tcp://';
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
            'peer_name' => $host,
        ],
    ]);
    $socket = @stream_socket_client(
        $transport . $host . ':' . $port,
        $errorNumber,
        $errorMessage,
        20,
        STREAM_CLIENT_CONNECT,
        $context,
    );
    if (!is_resource($socket)) {
        throw new RuntimeException('Could not connect to the Hostinger email server.');
    }
    stream_set_timeout($socket, 20);

    try {
        planner_smtp_expect($socket, [220]);
        planner_smtp_command($socket, 'EHLO project-workspace', [250]);
        if ($encryption === 'tls') {
            planner_smtp_command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('The secure SMTP connection could not be started.');
            }
            planner_smtp_command($socket, 'EHLO project-workspace', [250]);
        }
        planner_smtp_command($socket, 'AUTH LOGIN', [334]);
        planner_smtp_command($socket, base64_encode((string) $config['smtpUsername']), [334]);
        planner_smtp_command($socket, base64_encode((string) $config['smtpPassword']), [235]);

        $envelopeFrom = planner_clean_header((string) $config['smtpUsername']);
        $recipient = planner_clean_header((string) $mail['toAddress']);
        planner_smtp_command($socket, 'MAIL FROM:<' . $envelopeFrom . '>', [250]);
        planner_smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
        planner_smtp_command($socket, 'DATA', [354]);

        $boundary = '=_ProjectWorkspace_' . bin2hex(random_bytes(12));
        $fromName = planner_clean_header((string) ($config['fromName'] ?? 'Project Workspace'));
        $toName = planner_clean_header((string) ($mail['toName'] ?? ''));
        $subject = '=?UTF-8?B?' . base64_encode((string) $mail['subject']) . '?=';
        $headers = [
            'Date: ' . gmdate('D, d M Y H:i:s O'),
            'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . (parse_url((string) ($config['appUrl'] ?? ''), PHP_URL_HOST) ?: 'localhost') . '>',
            'From: ' . $fromName . ' <' . planner_clean_header((string) $config['fromAddress']) . '>',
            'Reply-To: ' . planner_clean_header((string) $config['replyToAddress']),
            'To: ' . ($toName !== '' ? $toName . ' ' : '') . '<' . $recipient . '>',
            'Subject: ' . $subject,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'X-Mailer: Project Workspace',
            'Auto-Submitted: auto-generated',
        ];
        $body = implode("\r\n", $headers)
            . "\r\n\r\n--" . $boundary
            . "\r\nContent-Type: text/plain; charset=UTF-8"
            . "\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
            . quoted_printable_encode(planner_email_text($mail))
            . "\r\n--" . $boundary
            . "\r\nContent-Type: text/html; charset=UTF-8"
            . "\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
            . quoted_printable_encode(planner_email_html($mail))
            . "\r\n--" . $boundary . "--\r\n";
        $body = preg_replace('/(?m)^\./', '..', $body) ?? $body;
        if (fwrite($socket, $body . "\r\n.\r\n") === false) {
            throw new RuntimeException('The email content could not be sent.');
        }
        planner_smtp_expect($socket, [250]);
        @fwrite($socket, "QUIT\r\n");
    } finally {
        fclose($socket);
    }
}

function planner_send_test_email(array $store, array $recipient, array $config): void
{
    $queued = [
        'eventId' => null,
        'title' => 'Email notifications are ready',
        'message' => 'Your Project Workspace can now send assignments, schedule changes, and milestone reminders while the website is closed.',
        'kind' => 'Test message',
    ];
    planner_smtp_send($config, planner_email_payload($store, $queued, $recipient, $config));
}

function planner_process_email_queue(array &$store, int $limit = 25): array
{
    $config = planner_mail_config();
    $status = planner_mail_status($config);
    $result = [
        'configured' => $status['configured'],
        'enabled' => $status['enabled'],
        'processed' => 0,
        'sent' => 0,
        'failed' => 0,
        'skipped' => 0,
    ];
    if (!$status['configured'] || !$status['enabled']) {
        return $result;
    }

    $now = time();
    $store['emailQueue'] ??= [];
    foreach ($store['emailQueue'] as &$queued) {
        if (
            $result['processed'] >= $limit
            || !in_array(($queued['status'] ?? ''), ['Pending', 'Retry'], true)
            || strtotime((string) ($queued['nextAttemptAt'] ?? '')) > $now
        ) {
            continue;
        }

        $result['processed']++;
        $recipient = planner_find_record($store['users'] ?? [], (string) ($queued['memberId'] ?? ''));
        $createdAt = strtotime((string) ($queued['createdAt'] ?? ''));
        if (
            !$recipient
            || empty($recipient['active'])
            || (array_key_exists('emailNotifications', $recipient) && empty($recipient['emailNotifications']))
            || !filter_var($recipient['email'] ?? '', FILTER_VALIDATE_EMAIL)
            || ($createdAt !== false && $createdAt < $now - 604800)
        ) {
            $queued['status'] = 'Skipped';
            $queued['lastError'] = 'Recipient unavailable, opted out, or notification expired.';
            $result['skipped']++;
            continue;
        }

        try {
            $mail = planner_email_payload($store, $queued, $recipient, $config);
            planner_smtp_send($config, $mail);
            $queued['status'] = 'Sent';
            $queued['sentAt'] = planner_mail_now();
            $queued['lastError'] = null;
            $result['sent']++;
        } catch (Throwable $error) {
            $attempts = (int) ($queued['attempts'] ?? 0) + 1;
            $queued['attempts'] = $attempts;
            $queued['lastError'] = substr($error->getMessage(), 0, 300);
            if ($attempts >= 3) {
                $queued['status'] = 'Failed';
                $result['failed']++;
            } else {
                $queued['status'] = 'Retry';
                $minutes = min(60, 5 * (2 ** ($attempts - 1)));
                $queued['nextAttemptAt'] = gmdate('Y-m-d\TH:i:s\Z', $now + ($minutes * 60));
            }
        }
    }
    unset($queued);

    $store['emailQueue'] = array_slice($store['emailQueue'] ?? [], -1000);
    return $result;
}
