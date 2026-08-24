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

    $traineeId = $input['trainee_id'] ?? null;
    $title = trim($input['title'] ?? '');
    $description = isset($input['description']) && trim($input['description']) !== '' ? trim($input['description']) : null;
    $category = $input['category'] ?? 'other';

    if (!$traineeId) {
        json_response(['error' => 'Trainee ID is required.'], 400);
    }

    if (empty($title)) {
        json_response(['error' => 'Title is required.'], 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO public.portfolio_items (
            trainee_id,
            title,
            description,
            category,
            status,
            submitted_at,
            created_at,
            updated_at
        ) VALUES (
            :trainee_id,
            :title,
            :description,
            :category,
            'pending',
            NOW(),
            NOW(),
            NOW()
        )
        RETURNING id, trainee_id, title, description, category, status, review_note, reviewed_at, submitted_at, created_at, updated_at
    ");

    $stmt->execute([
        ':trainee_id' => $traineeId,
        ':title' => $title,
        ':description' => $description,
        ':category' => $category,
    ]);

    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($item) {
        $item['portfolio_files'] = [];
    }

    json_response(['item' => $item], 201);

} catch (Throwable $e) {
    error_log('[create_portfolio_item] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}