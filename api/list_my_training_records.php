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

    $stmt = $pdo->prepare("
        SELECT id
        FROM public.trainees
        WHERE user_id = :user_id
        LIMIT 1
    ");

    $stmt->execute([
        ':user_id' => $userId
    ]);

    $trainee = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$trainee) {
        json_response([
            'records' => []
        ]);
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
        ':trainee_id' => $trainee['id']
    ]);

    $records = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $records[] = map_record($row);
    }

    json_response([
        'records' => $records
    ]);
} catch (Throwable $e) {

    error_log('[list_my_training_records] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
