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

function get_record(PDO $pdo, string $id): ?array
{
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

            c.id AS c_id,
            c.course_code,
            c.course_name,
            c.category,
            c.phase,
            c.instructor

        FROM public.training_records tr

        LEFT JOIN public.courses c
            ON c.id = tr.course_id

        WHERE tr.id = :id
        LIMIT 1
    ");

    $stmt->execute([':id' => $id]);

    $r = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$r) {
        return null;
    }

    return [
        'id' => $r['id'],
        'trainee_id' => $r['trainee_id'],
        'course_id' => $r['course_id'],
        'attendance_date' => $r['attendance_date'],
        'attended' => (bool)$r['attended'],
        'hours' => (float)$r['hours'],
        'test_score' => $r['test_score'] !== null ? (float)$r['test_score'] : null,
        'reflection' => $r['reflection'],
        'completion_status' => $r['completion_status'],
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'],
        'course' => $r['c_id'] ? [
            'id' => $r['c_id'],
            'course_code' => $r['course_code'],
            'course_name' => $r['course_name'],
            'category' => $r['category'],
            'phase' => $r['phase'],
            'instructor' => $r['instructor'],
        ] : null
    ];
}

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['error' => 'Method not allowed'], 405);
    }

    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;

    if (!$userId) {
        json_response(['error' => 'Not signed in'], 401);
    }

    $body = json_decode(file_get_contents('php://input'), true);

    if (!is_array($body)) {
        json_response(['error' => 'Invalid JSON body'], 400);
    }

    $recordId = trim($body['id'] ?? '');

    if (!$recordId) {
        json_response(['error' => 'Missing record ID'], 400);
    }

    /*
     * Verify ownership.
     */
    $stmt = $pdo->prepare("
        SELECT tr.id
        FROM public.training_records tr
        INNER JOIN public.trainees t
            ON t.id = tr.trainee_id
        WHERE tr.id = :record_id
          AND t.user_id = :user_id
        LIMIT 1
    ");

    $stmt->execute([
        ':record_id' => $recordId,
        ':user_id' => $userId
    ]);

    if (!$stmt->fetch()) {
        json_response([
            'error' => 'Training record not found or access denied'
        ], 404);
    }

    $attendanceDate = trim($body['attendance_date'] ?? '');
    $attended = $body['attended'] ?? null;
    $hours = $body['hours'] ?? null;
    $testScore = $body['test_score'] ?? null;
    $reflection = trim($body['reflection'] ?? '') ?: null;

    $courseName = trim($body['course_name'] ?? '');
    $coursePhase = trim($body['course_phase'] ?? '');
    $courseInstructor = trim($body['course_instructor'] ?? '') ?: null;
    $courseCategory = trim($body['course_category'] ?? '') ?: null;

    if (
        $attendanceDate === '' ||
        $attended === null ||
        $hours === null ||
        $courseName === '' ||
        $coursePhase === ''
    ) {
        json_response([
            'error' => 'Missing required fields'
        ], 400);
    }

    if (!in_array($coursePhase, [
        'phase1_general',
        'phase2_department'
    ], true)) {
        json_response([
            'error' => 'Invalid course phase'
        ], 400);
    }

    if (!is_numeric($hours) || (float)$hours < 0) {
        json_response([
            'error' => 'Invalid hours'
        ], 400);
    }

    if ($testScore !== null && $testScore !== '' && !is_numeric($testScore)) {
        json_response([
            'error' => 'Invalid test score'
        ], 400);
    }

    /*
     * Find/create course.
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
        ':phase' => $coursePhase
    ]);

    $course = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($course) {

        $courseId = $course['id'];
    } else {

        $courseId = uuid4();

        $now = (new DateTime('now'))->format('Y-m-d H:i:sP');

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
        ");

        $stmt->execute([
            ':id' => $courseId,
            ':course_name' => $courseName,
            ':category' => $courseCategory,
            ':phase' => $coursePhase,
            ':instructor' => $courseInstructor,
            ':created_at' => $now,
            ':updated_at' => $now
        ]);
    }

    $completionStatus = ((bool)$attended)
        ? 'in_progress'
        : 'not_started';

    $now = (new DateTime('now'))->format('Y-m-d H:i:sP');

    $stmt = $pdo->prepare("
        UPDATE public.training_records
        SET
            course_id = :course_id,
            attendance_date = :attendance_date,
            attended = :attended,
            hours = :hours,
            test_score = :test_score,
            reflection = :reflection,
            completion_status = :completion_status,
            updated_at = :updated_at
        WHERE id = :id
    ");

    $stmt->execute([
        ':course_id' => $courseId,
        ':attendance_date' => $attendanceDate,
        ':attended' => (bool)$attended,
        ':hours' => $hours,
        ':test_score' => ($testScore === '' ? null : $testScore),
        ':reflection' => $reflection,
        ':completion_status' => $completionStatus,
        ':updated_at' => $now,
        ':id' => $recordId
    ]);

    $record = get_record($pdo, $recordId);

    json_response([
        'record' => $record
    ]);
} catch (Throwable $e) {

    error_log('[update_training_record] ' . $e->getMessage());

    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}
