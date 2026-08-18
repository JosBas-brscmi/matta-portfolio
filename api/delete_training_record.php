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

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['error' => 'Method not allowed'], 405);
    }

    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;

    if (!$userId) {
        json_response([
            'error' => 'Not signed in'
        ], 401);
    }

    $body = json_decode(file_get_contents('php://input'), true);

    if (!is_array($body)) {
        json_response([
            'error' => 'Invalid JSON body'
        ], 400);
    }

    $recordId = trim($body['id'] ?? '');

    if (!$recordId) {
        json_response([
            'error' => 'Missing record ID'
        ], 400);
    }

    /*
     * Only allow the trainee who owns the record to delete it.
     */
    $stmt = $pdo->prepare("
        DELETE FROM public.training_records tr
        USING public.trainees t
        WHERE tr.trainee_id = t.id
          AND tr.id = :record_id
          AND t.user_id = :user_id
    ");

    $stmt->execute([
        ':record_id' => $recordId,
        ':user_id' => $userId
    ]);

    if ($stmt->rowCount() === 0) {
        json_response([
            'error' => 'Training record not found or access denied'
        ], 404);
    }

    json_response([
        'ok' => true
    ]);
} catch (Throwable $e) {

    error_log('[delete_training_record] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
