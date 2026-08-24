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
    $reviewerId = $data['reviewer_id'] ?? $data['reviewerId'] ?? $userId;
    $reviewType = $data['review_type'] ?? 'performance';
    
    // Convert YYYY-MM inputs (e.g. "2026-08") to a valid DATE format ("2026-08-01")
    $rawPeriod = $data['review_period'] ?? date('Y-m-01');
    if (preg_match('/^\d{4}-\d{2}$/', $rawPeriod)) {
        $reviewPeriod = $rawPeriod . '-01';
    } else {
        $reviewPeriod = $rawPeriod;
    }

    $rating = isset($data['rating']) && $data['rating'] !== '' ? (float)$data['rating'] : null;
    $strengths = trim($data['strengths'] ?? $data['comments'] ?? $data['feedback'] ?? '');
    $areasForImprovement = trim($data['areas_for_improvement'] ?? $data['areasForImprovement'] ?? '');
    $recommendation = trim($data['recommendation'] ?? '');
    $reviewedAt = $data['reviewed_at'] ?? $data['review_date'] ?? date('Y-m-d H:i:s');

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
            reviewer_id,
            review_type,
            review_period,
            rating,
            strengths,
            areas_for_improvement,
            recommendation,
            reviewed_at,
            created_at,
            updated_at
        ) VALUES (
            :id,
            :trainee_id,
            :reviewer_id,
            :review_type,
            :review_period,
            :rating,
            :strengths,
            :areas_for_improvement,
            :recommendation,
            :reviewed_at,
            NOW(),
            NOW()
        )
    ");

    $stmt->execute([
        ':id'                    => $id,
        ':trainee_id'            => $traineeId,
        ':reviewer_id'           => $reviewerId,
        ':review_type'           => $reviewType,
        ':review_period'         => $reviewPeriod,
        ':rating'                => $rating,
        ':strengths'             => $strengths,
        ':areas_for_improvement' => $areasForImprovement,
        ':recommendation'        => $recommendation,
        ':reviewed_at'           => $reviewedAt,
    ]);

    $fetchStmt = $pdo->prepare("
        SELECT id, trainee_id, reviewer_id, review_type, review_period, rating, strengths, areas_for_improvement, recommendation, reviewed_at, created_at, updated_at
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