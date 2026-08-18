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

    $role = $caller['role'];

    /*
     * MTs shouldn't use the administrative trainee list.
     */
    if ($role === 'mt') {
        json_response([
            'error' => 'Forbidden'
        ], 403);
    }

    $sql = "
        SELECT
            t.id,
            t.employee_id,
            t.batch_code,
            t.onboard_date,
            t.department,
            t.training_status,
            t.profile_completeness,

            p.full_name,
            p.email

        FROM public.trainees t

        LEFT JOIN public.users_profile p
            ON p.id = t.user_id
    ";

    $params = [];

    /*
     * Managers only see their department.
     */
    if ($role === 'manager') {
        $sql .= "
            WHERE t.department = :department
        ";

        $params[':department'] = $caller['department'];
    }

    /*
     * Mentors only see trainees assigned to them.
     */
    if ($role === 'mentor') {
        $sql .= "
            WHERE t.mentor_id = :mentor_id
        ";

        $params[':mentor_id'] = $userId;
    }

    $sql .= "
        ORDER BY p.full_name ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $trainees = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

        $trainees[] = [
            'id' => $row['id'],
            'employee_id' => $row['employee_id'],
            'batch_code' => $row['batch_code'],
            'onboard_date' => $row['onboard_date'],
            'department' => $row['department'],
            'training_status' => $row['training_status'] ?? '',
            'profile_completeness' => $row['profile_completeness'] !== null
                ? (int)$row['profile_completeness']
                : 0,
            'users_profile' => $row['full_name'] !== null ? [
                'full_name' => $row['full_name'],
                'email' => $row['email']
            ] : null
        ];
    }

    json_response([
        'trainees' => $trainees
    ]);
} catch (Throwable $e) {

    error_log('[list_trainees] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
