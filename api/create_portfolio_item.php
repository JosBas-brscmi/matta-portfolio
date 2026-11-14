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

function generate_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

try {
    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        json_response(['error' => 'Not signed in', 'detail' => 'SESSION user_id missing'], 401);
    }

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?? [];

    $traineeId = $input['trainee_id'] ?? null;
    $title = trim($input['title'] ?? '');
    $description = isset($input['description']) && trim($input['description']) !== '' ? trim($input['description']) : null;
    $category = $input['category'] ?? 'other';

    if (!$traineeId) {
        json_response(['error' => 'Missing trainee_id', 'detail' => 'trainee_id is null or missing in request payload'], 400);
    }

    if (empty($title)) {
        json_response(['error' => 'Missing title', 'detail' => 'title is required'], 400);
    }

    $newItemId = generate_uuid();
    $now = date('Y-m-d H:i:s');

    // Schema query without hardcoded 'public.' prefix to maintain MySQL & PostgreSQL compatibility
    $stmt = $pdo->prepare("
        INSERT INTO portfolio_items (
            id,
            trainee_id,
            title,
            description,
            category,
            status,
            submitted_at,
            created_at,
            updated_at
        ) VALUES (
            :id,
            :trainee_id,
            :title,
            :description,
            :category,
            'pending',
            :submitted_at,
            :created_at,
            :updated_at
        )
    ");

    $stmt->execute([
        ':id' => $newItemId,
        ':trainee_id' => $traineeId,
        ':title' => $title,
        ':description' => $description,
        ':category' => $category,
        ':submitted_at' => $now,
        ':created_at' => $now,
        ':updated_at' => $now,
    ]);

    $fetchStmt = $pdo->prepare("
        SELECT id, trainee_id, title, description, category, status, review_note, reviewed_at, submitted_at, created_at, updated_at
        FROM portfolio_items
        WHERE id = :id
        LIMIT 1
    ");
    $fetchStmt->execute([':id' => $newItemId]);
    $item = $fetchStmt->fetch(PDO::FETCH_ASSOC);

    if ($item) {
        $item['portfolio_files'] = [];
    }

    json_response(['item' => $item], 201);

} catch (PDOException $e) {
    error_log('[create_portfolio_item PDO Error] ' . $e->getMessage());
    json_response([
        'error' => 'database_error',
        'detail' => $e->getMessage(),
        'code' => $e->getCode()
    ], 500);
} catch (Throwable $e) {
    error_log('[create_portfolio_item General Error] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}