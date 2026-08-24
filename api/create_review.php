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
        json_response(['error' => 'Not signed in', 'detail' => 'Session user_id missing'], 401);
    }

    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?? $_POST;

    $traineeId = $data['trainee_id'] ?? $data['traineeId'] ?? null;
    $reviewDate = $data['review_date'] ?? date('Y-m-d');
    $rating = isset($data['rating']) && $data['rating'] !== '' ? (float)$data['rating'] : null;
    $comments = trim($data['comments'] ?? $data['feedback'] ?? '');
    $reviewer = trim($data['reviewer'] ?? '');

    if (!$traineeId) {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'trainee_id is required.'
        ], 400);
    }

    $id = generate_uuid();

    $stmt = $pdo->prepare("
        INSERT INTO reviews (
            id,
            trainee_id,
            review_date,
            rating,
            comments,
            reviewer,
            created_at
        ) VALUES (
            :id,
            :trainee_id,
            :review_date,
            :rating,
            :comments,
            :reviewer,
            NOW()
        )
    ");

    $stmt->execute([
        ':id'          => $id,
        ':trainee_id'  => $traineeId,
        ':review_date' => $reviewDate,
        ':rating'      => $rating,
        ':comments'    => $comments,
        ':reviewer'    => $reviewer,
    ]);

    $fetchStmt = $pdo->prepare("
        SELECT id, trainee_id, review_date, rating, comments, reviewer, created_at
        FROM reviews
        WHERE id = :id
        LIMIT 1
    ");
    $fetchStmt->execute([':id' => $id]);
    $createdReview = $fetchStmt->fetch(PDO::FETCH_ASSOC);

    json_response(['data' => $createdReview], 201);

} catch (PDOException $e) {
    error_log('[create_review PDO Error] ' . $e->getMessage());
    json_response([
        'error' => 'database_error',
        'detail' => $e->getMessage()
    ], 500);
} catch (Throwable $e) {
    error_log('[create_review General Error] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}