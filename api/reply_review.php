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

    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?? $_POST;

    $reviewId = $data['review_id'] ?? $data['reviewId'] ?? $data['id'] ?? null;
    $reply = trim($data['reply'] ?? $data['mt_reply'] ?? $data['comment'] ?? '');

    if (!$reviewId || $reply === '') {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'review_id and reply content are required.'
        ], 400);
    }

    // Update the trainee reply (mt_reply) and reply timestamp (mt_reply_at)
    $stmt = $pdo->prepare("
        UPDATE reviews
        SET 
            mt_reply = :reply,
            mt_reply_at = NOW(),
            updated_at = NOW()
        WHERE id = :review_id
    ");

    $stmt->execute([
        ':reply'     => $reply,
        ':review_id' => $reviewId,
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
        'detail' => $e->getMessage()
    ], 500);
} catch (Throwable $e) {
    error_log('[reply_review General Error] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}