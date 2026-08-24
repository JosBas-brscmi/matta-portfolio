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

    $traineeId = $_GET['trainee_id'] ?? null;

    if (!$traineeId) {
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            json_response(['error' => 'Not signed in'], 401);
        }

        $stmt = $pdo->prepare("
            SELECT id FROM public.trainees WHERE user_id = :user_id LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);
        $trainee = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$trainee) {
            json_response(['items' => []]);
        }
        $traineeId = $trainee['id'];
    }

    // Fetch portfolio items
    $stmt = $pdo->prepare("
        SELECT 
            id,
            trainee_id,
            title,
            description,
            category,
            status,
            review_note,
            reviewed_at,
            submitted_at,
            created_at,
            updated_at
        FROM public.portfolio_items
        WHERE trainee_id = :trainee_id
        ORDER BY created_at DESC
    ");

    $stmt->execute([':trainee_id' => $traineeId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Attach portfolio files for each item
    foreach ($items as &$item) {
        $fileStmt = $pdo->prepare("
            SELECT 
                id,
                portfolio_item_id,
                file_name,
                file_type,
                file_size_bytes,
                storage_path,
                uploaded_at
            FROM public.portfolio_files
            WHERE portfolio_item_id = :item_id
        ");
        $fileStmt->execute([':item_id' => $item['id']]);
        $item['portfolio_files'] = $fileStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    json_response(['items' => $items]);

} catch (Throwable $e) {
    error_log('[list_portfolio_items] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}