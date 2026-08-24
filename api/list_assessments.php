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
            json_response(['assessments' => []]);
        }
        $traineeId = $trainee['id'];
    }

    $stmt = $pdo->prepare("
        SELECT 
            a.id,
            a.trainee_id,
            a.assessment_type,
            a.title,
            a.assessment_date,
            a.score,
            a.max_score,
            a.assessor_id,
            a.comments,
            a.created_at,
            u.full_name AS assessor_name
        FROM public.assessments a
        LEFT JOIN public.users_profile u ON a.assessor_id = u.id
        WHERE a.trainee_id = :trainee_id
        ORDER BY a.assessment_date DESC
    ");

    $stmt->execute([':trainee_id' => $traineeId]);
    $assessments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response(['assessments' => $assessments]);

} catch (Throwable $e) {
    error_log('[list_assessments] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}