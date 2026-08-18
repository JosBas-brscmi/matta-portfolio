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

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response([
            'error' => 'Method not allowed'
        ], 405);
    }

    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;

    if (!$userId) {
        json_response([
            'error' => 'Not signed in'
        ], 401);
    }

    /*
     * Determine caller role.
     */
    $stmt = $pdo->prepare("
        SELECT role, department
        FROM public.users_profile
        WHERE id = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $caller = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$caller) {
        json_response([
            'error' => 'User not found'
        ], 404);
    }

    $allowedRoles = [
        'owner',
        'ma_center',
        'ma_board',
        'manager',
        'mentor'
    ];

    if (!in_array($caller['role'], $allowedRoles, true)) {
        json_response([
            'error' => 'Forbidden'
        ], 403);
    }

    $body = json_decode(file_get_contents('php://input'), true);

    if (!is_array($body)) {
        json_response([
            'error' => 'Invalid JSON body'
        ], 400);
    }

    $traineeId = trim($body['id'] ?? '');
    $status = trim($body['status'] ?? '');

    if (!$traineeId || !$status) {
        json_response([
            'error' => 'Missing trainee ID or status'
        ], 400);
    }

    $validStatuses = [
        'onboarding',
        'phase1_general',
        'phase2_department',
        'final_assessment',
        'graduated',
        'transferred',
        'withdrawn'
    ];

    if (!in_array($status, $validStatuses, true)) {
        json_response([
            'error' => 'Invalid training status'
        ], 400);
    }

    /*
     * Retrieve trainee for authorization.
     */
    $stmt = $pdo->prepare("
        SELECT id, department, mentor_id
        FROM public.trainees
        WHERE id = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $traineeId
    ]);

    $trainee = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$trainee) {
        json_response([
            'error' => 'Trainee not found'
        ], 404);
    }

    /*
     * Mentor can only update their own trainee.
     */
    if (
        $caller['role'] === 'mentor' &&
        $trainee['mentor_id'] !== $userId
    ) {
        json_response([
            'error' => 'Forbidden'
        ], 403);
    }

    /*
     * Manager can only update their department.
     */
    if (
        $caller['role'] === 'manager' &&
        $trainee['department'] !== $caller['department']
    ) {
        json_response([
            'error' => 'Forbidden'
        ], 403);
    }

    $stmt = $pdo->prepare("
        UPDATE public.trainees
        SET
            training_status = :status,
            updated_at = NOW()
        WHERE id = :id
    ");

    $stmt->execute([
        ':status' => $status,
        ':id' => $traineeId
    ]);

    json_response([
        'ok' => true,
        'status' => $status
    ]);
} catch (Throwable $e) {

    error_log('[update_trainee_status] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
