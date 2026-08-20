<?php

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

/*
|--------------------------------------------------------------------------
| JSON response
|--------------------------------------------------------------------------
*/

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

if (empty($_SESSION['user_id'])) {
    json_response([
        'error' => 'Not signed in'
    ], 401);
}

$userId = $_SESSION['user_id'];

/*
|--------------------------------------------------------------------------
| Trainee ID
|--------------------------------------------------------------------------
*/

$traineeId = trim($_GET['trainee_id'] ?? '');

if ($traineeId === '') {
    json_response([
        'error' => 'trainee_id is required'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {

    $db = get_db();

    /*
     * Get the logged-in user's role.
     */
    $roleStmt = $db->prepare("
        SELECT role
        FROM public.users_profile
        WHERE id = :user_id
        LIMIT 1
    ");

    $roleStmt->execute([
        ':user_id' => $userId
    ]);

    $profile = $roleStmt->fetch(PDO::FETCH_ASSOC);

    $role = strtolower(trim($profile['role'] ?? ''));

    /*
     * Administrative/staff users may view any trainee.
     */
    $privilegedRoles = [
        'admin',
        'administrator',
        'staff',
        'trainer',
        'manager',
        'supervisor'
    ];

    $authorized = in_array($role, $privilegedRoles, true);

    /*
     * A normal trainee may only view their own records.
     */
    if (!$authorized) {

        $traineeStmt = $db->prepare("
            SELECT id
            FROM public.trainees
            WHERE id = :trainee_id
              AND user_id = :user_id
            LIMIT 1
        ");

        $traineeStmt->execute([
            ':trainee_id' => $traineeId,
            ':user_id' => $userId
        ]);

        $authorized = (bool) $traineeStmt->fetch(PDO::FETCH_ASSOC);
    }

    if (!$authorized) {
        json_response([
            'error' => 'Forbidden',
            'message' => 'You are not authorized to view this trainee.'
        ], 403);
    }

    /*
     * Fetch training records.
     */
    $stmt = $db->prepare("
        SELECT
            tr.id,
            tr.trainee_id,
            tr.course_id,
            tr.attendance_date,
            tr.attended,
            tr.test_score,
            tr.reflection,
            tr.completion_status,
            tr.hours,
            tr.created_at,
            tr.updated_at,

            c.course_code,
            c.course_name,
            c.category,
            c.phase

        FROM public.training_records tr

        LEFT JOIN public.courses c
            ON c.id = tr.course_id

        WHERE tr.trainee_id = :trainee_id

        ORDER BY
            tr.attendance_date DESC NULLS LAST,
            tr.created_at DESC
    ");

    $stmt->execute([
        ':trainee_id' => $traineeId
    ]);

    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response([
        'data' => $records
    ]);

} catch (Throwable $e) {

    error_log(
        'list_trainee_training_records.php: ' .
        $e->getMessage()
    );

    json_response([
        'error' => 'Failed to retrieve training records',
        'detail' => $e->getMessage()
    ], 500);
}