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
        json_response(['error' => 'Not signed in', 'detail' => 'Session user_id missing'], 401);
    }
    $profileStmt = $pdo->prepare(
        'SELECT role FROM public.users_profile WHERE id = :id LIMIT 1'
    );
    $profileStmt->execute([':id' => $userId]);
    $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);
    if (!$profile || $profile['role'] !== 'mt') {
        json_response(['error' => 'Forbidden'], 403);
    }

    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);
    $data = is_array($decoded) ? $decoded : $_POST;
    if (!is_array($data)) {
        json_response(['error' => 'Invalid request body'], 400);
    }

    $reviewId = $data['review_id'] ?? $data['reviewId'] ?? $data['id'] ?? null;
    $reply = $data['reply'] ?? $data['mt_reply'] ?? $data['comment'] ?? '';

    if (!is_string($reviewId) || !is_string($reply) || $reviewId === '' || $reply === '' || strlen($reply) > 10000) {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'review_id and reply content are required.'
        ], 400);
    }

    $traineeStmt = $pdo->prepare("
        SELECT id FROM public.trainees WHERE user_id = :user_id LIMIT 1
    ");
    $traineeStmt->execute([':user_id' => $userId]);
    $trainee = $traineeStmt->fetch(PDO::FETCH_ASSOC);
    if (!$trainee) {
        json_response(['error' => 'Forbidden'], 403);
    }

    $reviewExists = $pdo->prepare("
        SELECT id FROM public.reviews
        WHERE id = :review_id AND trainee_id = :trainee_id
        LIMIT 1
    ");
    $reviewExists->execute([
        ':review_id' => $reviewId,
        ':trainee_id' => $trainee['id'],
    ]);
    if (!$reviewExists->fetch(PDO::FETCH_ASSOC)) {
        json_response(['error' => 'Forbidden'], 403);
    }

    $stmt = $pdo->prepare("
        UPDATE public.reviews
        SET 
            mt_reply = :reply,
            mt_reply_at = NOW(),
            updated_at = NOW()
        WHERE id = :review_id AND trainee_id = :trainee_id
    ");

    $stmt->execute([
        ':reply' => trim($reply),
        ':review_id' => $reviewId,
        ':trainee_id' => $trainee['id'],
    ]);

    if ($stmt->rowCount() === 0) {
        json_response([
            'error' => 'Not found',
            'detail' => 'Review record not found or no changes made.'
        ], 404);
    }

    // Fetch and return the updated review record
    $fetchStmt = $pdo->prepare("
        SELECT id, trainee_id, reviewer_id, review_type, review_period, rating, 
               strengths, areas_for_improvement, recommendation, reviewed_at, 
               mt_reply, mt_reply_at, created_at, updated_at
        FROM reviews
        WHERE id = :id
        LIMIT 1
    ");
    $fetchStmt->execute([':id' => $reviewId]);
    $updatedReview = $fetchStmt->fetch(PDO::FETCH_ASSOC);

    json_response([
        'data' => $updatedReview,
        'message' => 'Reply saved successfully.'
    ], 200);

} catch (PDOException $e) {
    error_log('[reply_review PDO Error] ' . $e->getMessage());
    json_response([
        'error' => 'database_error',
    ], 500);
} catch (Throwable $e) {
    error_log('[reply_review General Error] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
    ], 500);
}