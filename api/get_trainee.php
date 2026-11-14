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
        json_response([
            'error' => 'Not signed in'
        ], 401);
    }

    $traineeId = $_GET['id'] ?? '';

    if (!$traineeId) {
        json_response([
            'error' => 'Missing trainee ID'
        ], 400);
    }

    /*
     * Determine caller.
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

    /*
     * Retrieve trainee.
     */
    $stmt = $pdo->prepare("
        SELECT
            t.id,
            t.user_id,
            t.employee_id,
            t.batch_code,
            t.onboard_date,
            t.education,
            t.department,
            t.training_status,
            t.profile_completeness,
            t.mentor_id,
            t.created_at,

            p.full_name,
            p.english_name,
            p.email,
            p.role,
            p.status,
            p.avatar_path,
            p.phone,
            p.bio,

            m.full_name AS mentor_full_name,
            m.email AS mentor_email

        FROM public.trainees t

        LEFT JOIN public.users_profile p
            ON p.id = t.user_id

        LEFT JOIN public.users_profile m
            ON m.id = t.mentor_id

        WHERE t.id = :trainee_id

        LIMIT 1
    ");

    $stmt->execute([
        ':trainee_id' => $traineeId
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        json_response([
            'error' => 'Trainee not found'
        ], 404);
    }

    /*
     * Authorization.
     */
    $role = $caller['role'];

    if ($role === 'mt') {

        if ($row['user_id'] !== $userId) {
            json_response([
                'error' => 'Forbidden'
            ], 403);
        }
    } elseif ($role === 'mentor') {

        if ($row['mentor_id'] !== $userId) {
            json_response([
                'error' => 'Forbidden'
            ], 403);
        }
    } elseif ($role === 'manager') {

        if ($row['department'] !== $caller['department']) {
            json_response([
                'error' => 'Forbidden'
            ], 403);
        }
    } elseif (!in_array($role, [
        'owner',
        'ma_center',
        'ma_board'
    ], true)) {

        json_response([
            'error' => 'Forbidden'
        ], 403);
    }

    $trainee = [
        'id' => $row['id'],
        'user_id' => $row['user_id'],
        'employee_id' => $row['employee_id'],
        'batch_code' => $row['batch_code'],
        'onboard_date' => $row['onboard_date'],
        'education' => $row['education'],
        'department' => $row['department'],
        'training_status' => $row['training_status'] ?? '',
        'profile_completeness' => $row['profile_completeness'] !== null
            ? (int)$row['profile_completeness']
            : 0,
        'mentor_id' => $row['mentor_id'],
        'created_at' => $row['created_at'],

        'users_profile' => $row['user_id'] ? [
            'full_name' => $row['full_name'],
            'english_name' => $row['english_name'],
            'email' => $row['email'],
            'role' => $row['role'],
            'status' => $row['status'],
            'avatar_path' => $row['avatar_path'],
            'phone' => $row['phone'],
            'bio' => $row['bio']
        ] : null,

        'mentor' => $row['mentor_id'] ? [
            'full_name' => $row['mentor_full_name'],
            'email' => $row['mentor_email']
        ] : null
    ];

    json_response([
        'trainee' => $trainee
    ]);
} catch (Throwable $e) {

    error_log('[get_trainee] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
