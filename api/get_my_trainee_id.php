<?php

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

session_start();

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
        json_response([
            'error' => 'Not signed in'
        ], 401);
    }

    $stmt = $pdo->prepare("
        SELECT id
        FROM public.trainees
        WHERE user_id = :user_id
        LIMIT 1
    ");

    $stmt->execute([
        ':user_id' => $userId
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        json_response([
            'error' => 'No trainee record for current user'
        ], 404);
    }

    json_response([
        'trainee_id' => $row['id']
    ]);
} catch (Throwable $e) {

    error_log('[get_my_trainee_id] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
