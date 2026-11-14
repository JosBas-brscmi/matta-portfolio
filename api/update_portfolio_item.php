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
        json_response(['error' => 'Not signed in'], 401);
    }

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?? [];

    $id = $input['id'] ?? null;
    $title = trim($input['title'] ?? '');
    $description = isset($input['description']) && trim($input['description']) !== '' ? trim($input['description']) : null;
    $category = $input['category'] ?? 'other';
    $resubmit = !empty($input['resubmit']);

    if (!$id) {
        json_response(['error' => 'Portfolio item ID is required.'], 400);
    }

    if (empty($title)) {
        json_response(['error' => 'Title is required.'], 400);
    }

    $statusClause = $resubmit ? ", status = 'pending', submitted_at = NOW()" : "";

    $stmt = $pdo->prepare("
        UPDATE public.portfolio_items
        SET title = :title,
            description = :description,
            category = :category,
            updated_at = NOW()
            {$statusClause}
        WHERE id = :id
    ");

    $stmt->execute([
        ':id' => $id,
        ':title' => $title,
        ':description' => $description,
        ':category' => $category,
    ]);

    $fetchStmt = $pdo->prepare("
        SELECT id, trainee_id, title, description, category, status, review_note, reviewed_at, submitted_at, created_at, updated_at
        FROM public.portfolio_items
        WHERE id = :id
        LIMIT 1
    ");
    $fetchStmt->execute([':id' => $id]);
    $item = $fetchStmt->fetch(PDO::FETCH_ASSOC);

    if ($item) {
        $fileStmt = $pdo->prepare("SELECT * FROM public.portfolio_files WHERE portfolio_item_id = :item_id");
        $fileStmt->execute([':item_id' => $id]);
        $item['portfolio_files'] = $fileStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    json_response(['item' => $item]);

} catch (Throwable $e) {
    error_log('[update_portfolio_item] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}