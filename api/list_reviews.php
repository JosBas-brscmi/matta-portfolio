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

    $callerStmt = $pdo->prepare("
        SELECT role, department
        FROM public.users_profile
        WHERE id = :id
        LIMIT 1
    ");
    $callerStmt->execute([':id' => $userId]);
    $caller = $callerStmt->fetch(PDO::FETCH_ASSOC);
    if (!$caller) {
        json_response(['error' => 'Forbidden'], 403);
    }

    $traineeId = $_GET['trainee_id'] ?? null;
    if ($traineeId !== null && !is_string($traineeId)) {
        json_response(['error' => 'Invalid trainee ID'], 400);
    }

    if ($caller['role'] === 'mt') {
        $stmt = $pdo->prepare("
            SELECT id FROM public.trainees WHERE user_id = :user_id LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);
        $trainee = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$trainee) {
            json_response(['reviews' => []]);
        }
        if ($traineeId && $traineeId !== $trainee['id']) {
            json_response(['error' => 'Forbidden'], 403);
        }
        $traineeId = $trainee['id'];
    } elseif (in_array($caller['role'], ['owner', 'ma_center', 'ma_board', 'mentor', 'manager'], true)) {
        if (!is_string($traineeId) || $traineeId === '') {
            json_response(['error' => 'Trainee ID is required'], 400);
        }
        if (in_array($caller['role'], ['mentor', 'manager'], true)) {
            $scopeStmt = $pdo->prepare("
                SELECT mentor_id, department
                FROM public.trainees
                WHERE id = :id
                LIMIT 1
            ");
            $scopeStmt->execute([':id' => $traineeId]);
            $traineeScope = $scopeStmt->fetch(PDO::FETCH_ASSOC);
            if (!$traineeScope) {
                json_response(['error' => 'Trainee not found'], 404);
            }
            if (
                ($caller['role'] === 'mentor' && $traineeScope['mentor_id'] !== $userId) ||
                ($caller['role'] === 'manager' && $traineeScope['department'] !== $caller['department'])
            ) {
                json_response(['error' => 'Forbidden'], 403);
            }
        }
    } else {
        json_response(['error' => 'Forbidden'], 403);
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
    json_response(['error' => 'server_error'], 500);
}