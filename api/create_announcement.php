<?php

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function generate_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function normalize_recipient_ids($recipientIds): array
{
    if (!is_array($recipientIds)) {
        return [];
    }

    $normalized = [];
    foreach ($recipientIds as $value) {
        $id = trim((string) $value);
        if ($id !== '') {
            $normalized[] = $id;
        }
    }

    return array_values(array_unique($normalized));
}

try {
    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        json_response(['error' => 'Not signed in', 'detail' => 'Session user_id missing'], 401);
    }

    $title = trim((string) ($_POST['title'] ?? ''));
    $body = trim((string) ($_POST['body'] ?? ''));
    $isGlobal = filter_var($_POST['is_global'] ?? $_POST['isGlobal'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $recipientIdsRaw = $_POST['recipient_ids'] ?? $_POST['recipientIds'] ?? '[]';

    $recipientIds = json_decode(is_string($recipientIdsRaw) ? $recipientIdsRaw : json_encode($recipientIdsRaw), true);
    if (!is_array($recipientIds)) {
        $recipientIds = [];
    }
    $recipientIds = normalize_recipient_ids($recipientIds);

    if ($title === '' || $body === '') {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'Title and body are required.'
        ], 400);
    }

    if (!$isGlobal && count($recipientIds) === 0) {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'Please select at least one recipient or choose All users.'
        ], 400);
    }

    $announcementId = generate_uuid();

    $stmt = $pdo->prepare(
        'INSERT INTO public.announcements (id, author_id, title, body, is_global, created_at)
         VALUES (:id, :author_id, :title, :body, :is_global, NOW())'
    );

    $stmt->execute([
        ':id' => $announcementId,
        ':author_id' => $userId,
        ':title' => $title,
        ':body' => $body,
        ':is_global' => $isGlobal ? 'true' : 'false',
    ]);

    if (!$isGlobal) {
        $recipientInsert = $pdo->prepare(
            'INSERT INTO public.announcement_recipients (announcement_id, user_id) VALUES (:announcement_id, :user_id)'
        );

        foreach ($recipientIds as $recipientId) {
            if ($recipientId === '') {
                continue;
            }

            $recipientInsert->execute([
                ':announcement_id' => $announcementId,
                ':user_id' => $recipientId,
            ]);
        }
    }

    $uploadsDir = __DIR__ . '/uploads/announcements';
    if (!is_dir($uploadsDir)) {
        if (!mkdir($uploadsDir, 0775, true) && !is_dir($uploadsDir)) {
            throw new RuntimeException('Could not create announcement upload directory.');
        }
    }

    $fileStmt = $pdo->prepare(
        'INSERT INTO public.announcement_files (id, announcement_id, file_name, file_type, file_size_bytes, storage_path, uploaded_at)
         VALUES (:id, :announcement_id, :file_name, :file_type, :file_size_bytes, :storage_path, NOW())'
    );

    $uploadedFiles = [];

    if (isset($_FILES['files']) && is_array($_FILES['files']['name'])) {
        $fileGroups = $_FILES['files'];
        $fileCount = count($fileGroups['name']);

        for ($index = 0; $index < $fileCount; $index++) {
            $file = [
                'name' => $fileGroups['name'][$index] ?? '',
                'type' => $fileGroups['type'][$index] ?? '',
                'tmp_name' => $fileGroups['tmp_name'][$index] ?? '',
                'error' => $fileGroups['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $fileGroups['size'][$index] ?? 0,
            ];

            if ($file['error'] !== UPLOAD_ERR_OK || $file['tmp_name'] === '' || !is_uploaded_file($file['tmp_name'])) {
                continue;
            }

            $originalName = basename((string) $file['name']);
            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            $safeName = uniqid('ann_', true) . ($ext !== '' ? '.' . $ext : '');
            $storagePath = 'announcements/' . $safeName;
            $dest = __DIR__ . '/uploads/' . $storagePath;

            if (!move_uploaded_file($file['tmp_name'], $dest)) {
                continue;
            }

            $fileId = generate_uuid();
            $fileStmt->execute([
                ':id' => $fileId,
                ':announcement_id' => $announcementId,
                ':file_name' => $originalName,
                ':file_type' => $file['type'] ?: null,
                ':file_size_bytes' => (int) $file['size'],
                ':storage_path' => $storagePath,
            ]);

            $uploadedFiles[] = [
                'id' => $fileId,
                'file_name' => $originalName,
                'storage_path' => $storagePath,
            ];
        }
    }

    json_response([
        'data' => [
            'id' => $announcementId,
            'title' => $title,
            'body' => $body,
            'is_global' => $isGlobal,
            'recipient_count' => $isGlobal ? 0 : count($recipientIds),
            'files' => $uploadedFiles,
        ],
    ], 201);

} catch (PDOException $e) {
    error_log('[create_announcement PDO Error] ' . $e->getMessage());
    json_response([
        'error' => 'database_error',
        'detail' => $e->getMessage(),
    ], 500);
} catch (Throwable $e) {
    error_log('[create_announcement General Error] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage(),
    ], 500);
}
