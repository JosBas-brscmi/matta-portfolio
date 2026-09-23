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

    $stmt = $pdo->prepare(
        'SELECT
            a.id,
            a.author_id,
            a.title,
            a.body,
            a.is_global,
            a.created_at,
            up.full_name AS author_name,
            (
                SELECT COUNT(*)
                FROM public.announcement_recipients ar
                WHERE ar.announcement_id = a.id
            ) AS recipient_count
        FROM public.announcements a
        LEFT JOIN public.users_profile up ON up.id = a.author_id
        WHERE a.is_global = true
           OR a.id IN (
                SELECT ar.announcement_id
                FROM public.announcement_recipients ar
                WHERE ar.user_id = :user_id
           )
        ORDER BY a.created_at DESC'
    );

    $stmt->execute([':user_id' => $userId]);
    $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response(['announcements' => $announcements]);

} catch (Throwable $e) {
    error_log('[list_my_announcements] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage(),
    ], 500);
}
