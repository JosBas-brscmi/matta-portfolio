<?php

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
session_start();

function respond(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(['error' => 'method_not_allowed'], 405);
}

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    respond(['error' => 'unauthorized'], 401);
}

$data = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($data)) {
    respond(['error' => 'invalid_json'], 400);
}

$reviewId = $data['id'] ?? null;
$reviewType = $data['review_type'] ?? null;
$period = $data['review_period'] ?? null;
$rating = $data['rating'] ?? null;
$strengths = $data['strengths'] ?? null;
$improvements = $data['areas_for_improvement'] ?? null;
$recommendation = $data['recommendation'] ?? null;

if (
    !is_string($reviewId) ||
    $reviewId === '' ||
    !is_string($reviewType) ||
    !in_array($reviewType, [
        'weekly_note',
        'monthly_review',
        'encouragement',
        'manager_observation',
        'other',
    ], true)
) {
    respond(['error' => 'invalid_review'], 400);
}

if ($period !== null && !is_string($period)) {
    respond(['error' => 'invalid_review_period'], 400);
}
if ($period === '') {
    $period = null;
}
if (is_string($period) && preg_match('/^\d{4}-\d{2}$/', $period)) {
    $period .= '-01';
}
if (
    is_string($period) &&
    (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $period) ||
        !checkdate((int) substr($period, 5, 2), (int) substr($period, 8, 2), (int) substr($period, 0, 4)))
) {
    respond(['error' => 'invalid_review_period'], 400);
}

if (
    $rating !== null &&
    (!is_numeric($rating) || (float) $rating < 1 || (float) $rating > 5)
) {
    respond(['error' => 'invalid_rating'], 400);
}

foreach ([$strengths, $improvements, $recommendation] as $text) {
    if ($text !== null && (!is_string($text) || strlen($text) > 10000)) {
        respond(['error' => 'invalid_review_text'], 400);
    }
}

try {
    $pdo = get_db();
    $callerStmt = $pdo->prepare(
        'SELECT role FROM public.users_profile WHERE id = :id LIMIT 1'
    );
    $callerStmt->execute([':id' => $userId]);
    $caller = $callerStmt->fetch(PDO::FETCH_ASSOC);
    $allowedRoles = ['owner', 'ma_center', 'ma_board', 'manager', 'mentor'];
    if (!$caller || !in_array($caller['role'], $allowedRoles, true)) {
        respond(['error' => 'forbidden'], 403);
    }

    $reviewStmt = $pdo->prepare(
        'SELECT reviewer_id FROM public.reviews WHERE id = :id LIMIT 1'
    );
    $reviewStmt->execute([':id' => $reviewId]);
    $review = $reviewStmt->fetch(PDO::FETCH_ASSOC);
    if (!$review) {
        respond(['error' => 'review_not_found'], 404);
    }
    if (
        $review['reviewer_id'] !== $userId &&
        !in_array($caller['role'], ['owner', 'ma_center'], true)
    ) {
        respond(['error' => 'forbidden'], 403);
    }

    $update = $pdo->prepare("
        UPDATE public.reviews
        SET review_type = :review_type,
            review_period = :review_period,
            rating = :rating,
            strengths = :strengths,
            areas_for_improvement = :areas_for_improvement,
            recommendation = :recommendation,
            updated_at = NOW()
        WHERE id = :id
        RETURNING *
    ");
    $update->execute([
        ':review_type' => $reviewType,
        ':review_period' => $period,
        ':rating' => $rating,
        ':strengths' => $strengths,
        ':areas_for_improvement' => $improvements,
        ':recommendation' => $recommendation,
        ':id' => $reviewId,
    ]);

    respond([
        'status' => 'success',
        'message' => 'Review entry updated.',
        'review' => $update->fetch(PDO::FETCH_ASSOC),
    ]);
} catch (Throwable $e) {
    error_log('[update_review] ' . $e->getMessage());
    respond(['error' => 'server_error'], 500);
}
