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
            json_response(['reviews' => []]);
        }
        $traineeId = $trainee['id'];
    }

    $stmt = $pdo->prepare("
        SELECT 
            r.id,
            r.trainee_id,
            r.reviewer_id,
            r.review_type,
            r.review_period,
            r.rating,
            r.strengths,
            r.areas_for_improvement,
            r.recommendation,
            r.reviewed_at,
            r.created_at,
            r.mt_reply,
            r.mt_reply_at,
            u.full_name AS reviewer_name,
            u.role AS reviewer_role
        FROM public.reviews r
        LEFT JOIN public.users_profile u ON r.reviewer_id = u.id
        WHERE r.trainee_id = :trainee_id
        ORDER BY r.reviewed_at DESC
    ");

    $stmt->execute([':trainee_id' => $traineeId]);
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response(['reviews' => $reviews]);

} catch (Throwable $e) {
    error_log('[list_reviews] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}