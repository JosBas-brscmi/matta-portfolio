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

try {
    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        json_response(['error' => 'Not signed in'], 401);
    }

    $announcementId = $_GET['announcement_id'] ?? null;
    if (!$announcementId) {
        json_response(['files' => []]);
    }

    $stmt = $pdo->prepare(
        'SELECT id, announcement_id, file_name, file_type, file_size_bytes, storage_path, uploaded_at
         FROM public.announcement_files
         WHERE announcement_id = :announcement_id
         ORDER BY uploaded_at ASC'
    );

    $stmt->execute([':announcement_id' => $announcementId]);
    $files = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response(['files' => $files]);

} catch (Throwable $e) {
    error_log('[list_announcement_files] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage(),
    ], 500);
}
