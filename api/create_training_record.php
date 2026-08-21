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

function generate_uuid(): string
{
    $data = random_bytes(16);

    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf(
        '%s%s-%s-%s-%s-%s%s%s',
        str_split(bin2hex($data), 4)
    );
}

$courseId = generate_uuid();


function json_response($data, int $status = 200): void
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

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
| Read request
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents('php://input');

$input = json_decode($rawInput, true);

if (!is_array($input)) {
    $input = $_POST;
}

if (!is_array($input)) {
    $input = [];
}

/*
|--------------------------------------------------------------------------
| Course/activity name
|--------------------------------------------------------------------------
*/

$courseName = trim($input['course_name'] ?? '');

if ($courseName === '') {
    json_response([
        'error' => 'course_name is required'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Course phase
|--------------------------------------------------------------------------
*/

$coursePhase = trim(
    $input['course_phase'] ?? 'phase1_general'
);

$allowedPhases = [
    'phase1_general',
    'phase2_department'
];

if (!in_array($coursePhase, $allowedPhases, true)) {
    json_response([
        'error' => 'Invalid course phase'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Attendance date
|--------------------------------------------------------------------------
*/

$attendanceDate = trim(
    $input['attendance_date'] ?? ''
);

if ($attendanceDate === '') {
    json_response([
        'error' => 'attendance_date is required'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Validate date
|--------------------------------------------------------------------------
*/

$date = DateTime::createFromFormat(
    'Y-m-d',
    $attendanceDate
);

if (
    !$date ||
    $date->format('Y-m-d') !== $attendanceDate
) {
    json_response([
        'error' => 'Invalid attendance_date'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Attended
|--------------------------------------------------------------------------
*/

$attended = true;

if (array_key_exists('attended', $input)) {

    if (is_bool($input['attended'])) {

        $attended = $input['attended'];
    } else {

        $parsedAttended = filter_var(
            $input['attended'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($parsedAttended !== null) {
            $attended = $parsedAttended;
        }
    }
}

/*
|--------------------------------------------------------------------------
| Hours
|--------------------------------------------------------------------------
*/

$hours = 0;

if (
    isset($input['hours']) &&
    $input['hours'] !== ''
) {

    if (!is_numeric($input['hours'])) {
        json_response([
            'error' => 'hours must be numeric'
        ], 400);
    }

    $hours = (float) $input['hours'];

    if ($hours < 0 || $hours > 24) {
        json_response([
            'error' => 'hours must be between 0 and 24'
        ], 400);
    }
}

/*
|--------------------------------------------------------------------------
| Test score
|--------------------------------------------------------------------------
*/

$testScore = null;

if (
    isset($input['test_score']) &&
    $input['test_score'] !== '' &&
    $input['test_score'] !== null
) {

    if (!is_numeric($input['test_score'])) {
        json_response([
            'error' => 'test_score must be numeric'
        ], 400);
    }

    $testScore = (int) $input['test_score'];

    if ($testScore < 0 || $testScore > 100) {
        json_response([
            'error' => 'test_score must be between 0 and 100'
        ], 400);
    }
}

/*
|--------------------------------------------------------------------------
| Reflection
|--------------------------------------------------------------------------
*/

$reflection = trim(
    $input['reflection'] ?? ''
);

if ($reflection === '') {
    $reflection = null;
}

/*
|--------------------------------------------------------------------------
| Course information
|--------------------------------------------------------------------------
*/

$courseInstructor = trim(
    $input['course_instructor'] ?? ''
);

if ($courseInstructor === '') {
    $courseInstructor = null;
}

$courseCategory = trim(
    $input['course_category'] ?? ''
);

if ($courseCategory === '') {
    $courseCategory = null;
}

/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {

    $db = get_db();

    /*
    |--------------------------------------------------------------------------
    | Find trainee belonging to logged-in user
    |--------------------------------------------------------------------------
    */

    $traineeStmt = $db->prepare("
        SELECT id
        FROM public.trainees
        WHERE user_id = :user_id
        LIMIT 1
    ");

    $traineeStmt->execute([
        ':user_id' => $userId
    ]);

    $trainee = $traineeStmt->fetch(PDO::FETCH_ASSOC);

    if (!$trainee) {
        json_response([
            'error' => 'No trainee profile found',
            'message' => 'The logged-in user is not linked to a trainee record.'
        ], 404);
    }

    $traineeId = $trainee['id'];

    /*
    |--------------------------------------------------------------------------
    | Find existing course
    |--------------------------------------------------------------------------
    */

    $courseStmt = $db->prepare("
        SELECT
            id,
            course_code,
            course_name,
            category,
            phase,
            hours,
            instructor,
            applicable_departments,
            is_active,
            created_at,
            updated_at
        FROM public.courses
        WHERE LOWER(course_name) = LOWER(:course_name)
          AND phase = :phase
        LIMIT 1
    ");

    $courseStmt->execute([
        ':course_name' => $courseName,
        ':phase' => $coursePhase
    ]);

    $course = $courseStmt->fetch(PDO::FETCH_ASSOC);

    /*
    |--------------------------------------------------------------------------
    | Create course if it doesn't exist
    |--------------------------------------------------------------------------
    */

    if (!$course) {

        $courseId = generate_uuid();

        $courseCode =
            'MATTA-' .
            strtoupper(bin2hex(random_bytes(5)));

        $courseInsert = $db->prepare("
        INSERT INTO public.courses (
            id,
            course_code,
            course_name,
            category,
            phase,
            hours,
            instructor,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            :id,
            :course_code,
            :course_name,
            :category,
            :phase,
            :hours,
            :instructor,
            :is_active,
            NOW(),
            NOW()
        )
        RETURNING
            id,
            course_code,
            course_name,
            category,
            phase,
            hours,
            instructor,
            applicable_departments,
            is_active,
            created_at,
            updated_at
    ");

        $courseInsert->execute([
            ':id' => $courseId,
            ':course_code' => $courseCode,
            ':course_name' => $courseName,
            ':category' => $courseCategory,
            ':phase' => $coursePhase,
            ':hours' => $hours,
            ':instructor' => $courseInstructor,
            ':is_active' => true
        ]);

        $course = $courseInsert->fetch(PDO::FETCH_ASSOC);

        if (!$course) {
            json_response([
                'error' => 'Failed to create course'
            ], 500);
        }
    }

    $courseId = $course['id'];

    /*
    |--------------------------------------------------------------------------
    | Create training record
    |--------------------------------------------------------------------------
    */

    $recordId = generate_uuid();

    $recordStmt = $db->prepare("
    INSERT INTO public.training_records (
        id,
        trainee_id,
        course_id,
        attendance_date,
        attended,
        test_score,
        reflection,
        hours,
        created_at,
        updated_at
    )
    VALUES (
        :id,
        :trainee_id,
        :course_id,
        :attendance_date,
        :attended,
        :test_score,
        :reflection,
        :hours,
        NOW(),
        NOW()
    )
    RETURNING *
");

$recordStmt->execute([
    ':id' => $recordId,
    ':trainee_id' => $traineeId,
    ':course_id' => $courseId,
    ':attendance_date' => $attendanceDate,
    ':attended' => $attended,
    ':test_score' => $testScore,
    ':reflection' => $reflection,
    ':hours' => $hours
]);

    $record = $recordStmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        json_response([
            'error' => 'Training record was not created'
        ], 500);
    }

    /*
    |--------------------------------------------------------------------------
    | Return response expected by traineeService.ts
    |--------------------------------------------------------------------------
    */

    json_response([
        'record' => array_merge(
            $record,
            [
                'course' => $course
            ]
        )
    ], 201);
} catch (Throwable $e) {

    error_log(
        'create_training_record.php: ' .
            $e->getMessage()
    );

    json_response([
        'error' => 'Failed to create training record',
        'detail' => $e->getMessage()
    ], 500);
}
