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

function uuid4(): string
{
    $data = random_bytes(16);

    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf(
        '%s%s-%s-%s-%s-%s%s%s',
        str_split(bin2hex($data), 4)
    );
}

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['error' => 'Method not allowed'], 405);
    }

    $pdo = get_db();

    if (!isset($_SESSION['user_id'])) {
        json_response(['error' => 'Not signed in'], 401);
    }

    $body = json_decode(file_get_contents('php://input'), true);

    if (!is_array($body)) {
        json_response(['error' => 'Invalid JSON body'], 400);
    }

    $courseName = trim($body['course_name'] ?? '');
    $phase = trim($body['phase'] ?? '');
    $instructor = trim($body['instructor'] ?? '') ?: null;
    $category = trim($body['category'] ?? '') ?: null;

    if ($courseName === '') {
        json_response([
            'error' => 'Course name is required'
        ], 400);
    }

    if (!in_array($phase, [
        'phase1_general',
        'phase2_department'
    ], true)) {
        json_response([
            'error' => 'Invalid course phase'
        ], 400);
    }

    /*
     * Search for an existing course.
     *
     * Your database currently has no unique constraint on
     * course_name + phase, so this prevents normal duplicate
     * creation at the application level.
     */
    $stmt = $pdo->prepare("
        SELECT id
        FROM public.courses
        WHERE LOWER(course_name) = LOWER(:course_name)
          AND phase = :phase
        ORDER BY created_at ASC
        LIMIT 1
    ");

    $stmt->execute([
        ':course_name' => $courseName,
        ':phase' => $phase
    ]);

    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        json_response([
            'course_id' => $existing['id'],
            'created' => false
        ]);
    }

    $id = uuid4();

    $now = (new DateTime('now'))->format('Y-m-d H:i:sP');

    /*
     * applicable_departments is an array column and is NOT NULL.
     * Use an empty PostgreSQL text array by default.
     */
    $stmt = $pdo->prepare("
        INSERT INTO public.courses (
            id,
            course_code,
            course_name,
            category,
            phase,
            hours,
            instructor,
            description,
            is_active,
            created_at,
            updated_at,
            applicable_departments
        )
        VALUES (
            :id,
            NULL,
            :course_name,
            :category,
            :phase,
            NULL,
            :instructor,
            NULL,
            TRUE,
            :created_at,
            :updated_at,
            ARRAY[]::text[]
        )
        RETURNING id
    ");

    $stmt->execute([
        ':id' => $id,
        ':course_name' => $courseName,
        ':category' => $category,
        ':phase' => $phase,
        ':instructor' => $instructor,
        ':created_at' => $now,
        ':updated_at' => $now
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    json_response([
        'course_id' => $row['id'],
        'created' => true
    ]);
} catch (Throwable $e) {

    error_log('[find_or_create_course] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
