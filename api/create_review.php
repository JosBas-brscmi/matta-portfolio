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

    $callerStmt = $pdo->prepare(
        'SELECT role, department FROM public.users_profile WHERE id = :id LIMIT 1'
    );
    $callerStmt->execute([':id' => $userId]);
    $caller = $callerStmt->fetch(PDO::FETCH_ASSOC);
    if (!$caller || !in_array($caller['role'], [
        'owner',
        'ma_center',
        'ma_board',
        'manager',
        'mentor',
    ], true)) {
        json_response(['error' => 'Forbidden'], 403);
    }

    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);
    $data = is_array($decoded) ? $decoded : $_POST;
    if (!is_array($data)) {
        json_response(['error' => 'Invalid request body'], 400);
    }

    $traineeId = $data['trainee_id'] ?? $data['traineeId'] ?? null;
    $reviewerId = $userId;
    $reviewType = $data['review_type'] ?? 'performance';
    
    // Convert YYYY-MM inputs (e.g. "2026-08") to a valid DATE format ("2026-08-01")
    $rawPeriod = $data['review_period'] ?? date('Y-m-01');
    if ($rawPeriod !== null && !is_string($rawPeriod)) {
        json_response(['error' => 'Invalid review period'], 400);
    }
    if ($rawPeriod === '') {
        $reviewPeriod = null;
    } elseif (preg_match('/^\d{4}-\d{2}$/', $rawPeriod)) {
        $reviewPeriod = $rawPeriod . '-01';
    } else {
        $reviewPeriod = $rawPeriod;
    }
    if (
        is_string($reviewPeriod) &&
        (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $reviewPeriod) ||
            !checkdate((int) substr($reviewPeriod, 5, 2), (int) substr($reviewPeriod, 8, 2), (int) substr($reviewPeriod, 0, 4)))
    ) {
        json_response(['error' => 'Invalid review period'], 400);
    }

    $rawRating = $data['rating'] ?? null;
    if ($rawRating !== null && $rawRating !== '' &&
        (!is_numeric($rawRating) || (float) $rawRating < 1 || (float) $rawRating > 5)) {
        json_response(['error' => 'Invalid rating'], 400);
    }
    $rating = $rawRating !== null && $rawRating !== '' ? (float) $rawRating : null;
    $strengths = $data['strengths'] ?? $data['comments'] ?? $data['feedback'] ?? '';
    $areasForImprovement = $data['areas_for_improvement'] ?? $data['areasForImprovement'] ?? '';
    $recommendation = $data['recommendation'] ?? '';
    if (
        !is_string($reviewType) ||
        !in_array($reviewType, ['performance', 'weekly_note', 'monthly_review', 'encouragement', 'manager_observation', 'other'], true) ||
        !is_string($strengths) ||
        !is_string($areasForImprovement) ||
        !is_string($recommendation) ||
        strlen($strengths) > 10000 ||
        strlen($areasForImprovement) > 10000 ||
        strlen($recommendation) > 10000
    ) {
        json_response(['error' => 'Invalid review fields'], 400);
    }
    $strengths = trim($strengths);
    $areasForImprovement = trim($areasForImprovement);
    $recommendation = trim($recommendation);
    $reviewedAt = date('Y-m-d H:i:s');

    if (!is_string($traineeId) || $traineeId === '') {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'trainee_id is required.'
        ], 400);
    }

    $traineeStmt = $pdo->prepare("
        SELECT t.mentor_id, t.department
        FROM public.trainees t
        WHERE t.id = :id
        LIMIT 1
    ");
    $traineeStmt->execute([':id' => $traineeId]);
    $trainee = $traineeStmt->fetch(PDO::FETCH_ASSOC);
    if (!$trainee) {
        json_response(['error' => 'Trainee not found'], 404);
    }
    if (
        ($caller['role'] === 'mentor' && $trainee['mentor_id'] !== $userId) ||
        ($caller['role'] === 'manager' && $trainee['department'] !== $caller['department'])
    ) {
        json_response(['error' => 'Forbidden'], 403);
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
    json_response(['error' => 'database_error'], 500);
} catch (Throwable $e) {
    error_log('[create_review General Error] ' . $e->getMessage());
    json_response(['error' => 'server_error'], 500);
}