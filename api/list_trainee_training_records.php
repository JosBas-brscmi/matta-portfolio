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

function map_record(array $row): array
{
    return [
        'id' => $row['id'],
        'trainee_id' => $row['trainee_id'],
        'course_id' => $row['course_id'],
        'attendance_date' => $row['attendance_date'],
        'attended' => (bool)$row['attended'],
        'hours' => $row['hours'] !== null ? (float)$row['hours'] : 0,
        'test_score' => $row['test_score'] !== null
            ? (float)$row['test_score']
            : null,
        'reflection' => $row['reflection'],
        'completion_status' => $row['completion_status'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'course' => $row['course_id'] ? [
            'id' => $row['course_id'],
            'course_code' => $row['course_code'],
            'course_name' => $row['course_name'],
            'category' => $row['category'],
            'phase' => $row['phase'],
            'instructor' => $row['instructor'],
        ] : null,
    ];
}

try {

    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;

    if (!$userId) {
        json_response(['error' => 'Not signed in'], 401);
    }

    $traineeId = $_GET['trainee_id'] ?? '';

    if (!preg_match(
        '/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/',
        $traineeId
    )) {
        json_response([
            'error' => 'Invalid trainee ID'
        ], 400);
    }

    /*
     * Verify the current user's role.
     */
    $stmt = $pdo->prepare("
        SELECT role
        FROM public.users_profile
        WHERE id = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $caller = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$caller) {
        json_response(['error' => 'User not found'], 404);
    }

    $allowedRoles = [
        'owner',
        'ma_center',
        'ma_board',
        'mentor',
        'manager'
    ];

    /*
     * MT users should only use list_my_training_records.php.
     */
    if (!in_array($caller['role'], $allowedRoles, true)) {
        json_response([
            'error' => 'Forbidden'
        ], 403);
    }

    /*
     * For mentors, only allow trainees assigned to them.
     */
    if ($caller['role'] === 'mentor') {

        $stmt = $pdo->prepare("
            SELECT id
            FROM public.trainees
            WHERE id = :trainee_id
              AND mentor_id = :mentor_id
            LIMIT 1
        ");

        $stmt->execute([
            ':trainee_id' => $traineeId,
            ':mentor_id' => $userId
        ]);

        if (!$stmt->fetch()) {
            json_response([
                'error' => 'Forbidden'
            ], 403);
        }
    }

    /*
     * For managers, limit access to their department.
     */
    if ($caller['role'] === 'manager') {

        $stmt = $pdo->prepare("
            SELECT t.id
            FROM public.trainees t
            WHERE t.id = :trainee_id
              AND t.department = (
                  SELECT department
                  FROM public.users_profile
                  WHERE id = :manager_id
              )
            LIMIT 1
        ");

        $stmt->execute([
            ':trainee_id' => $traineeId,
            ':manager_id' => $userId
        ]);

        if (!$stmt->fetch()) {
            json_response([
                'error' => 'Forbidden'
            ], 403);
        }
    }

    $stmt = $pdo->prepare("
        SELECT
            tr.id,
            tr.trainee_id,
            tr.course_id,
            tr.attendance_date,
            tr.attended,
            tr.hours,
            tr.test_score,
            tr.reflection,
            tr.completion_status,
            tr.created_at,
            tr.updated_at,

            c.course_code,
            c.course_name,
            c.category,
            c.phase,
            c.instructor

        FROM public.training_records tr

        LEFT JOIN public.courses c
            ON c.id = tr.course_id

        WHERE tr.trainee_id = :trainee_id

        ORDER BY tr.attendance_date DESC, tr.created_at DESC
    ");

    $stmt->execute([
        ':trainee_id' => $traineeId
    ]);

    $records = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $records[] = map_record($row);
    }

    json_response([
        'records' => $records
    ]);
} catch (Throwable $e) {

    error_log('[list_trainee_training_records] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
