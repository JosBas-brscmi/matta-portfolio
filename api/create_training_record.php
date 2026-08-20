<?php

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

/*
|--------------------------------------------------------------------------
| JSON response helper
|--------------------------------------------------------------------------
*/

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
| Read request body
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
| Required fields
|--------------------------------------------------------------------------
|
| The React TrainingRecordModal sends course_name rather than course_id.
| The trainee_id is also determined from the logged-in session.
|
*/

$courseName = trim($input['course_name'] ?? '');

if ($courseName === '') {
    json_response([
        'error' => 'course_name is required'
    ], 400);
}

$attendanceDate = trim($input['attendance_date'] ?? '');

if ($attendanceDate === '') {
    json_response([
        'error' => 'attendance_date is required'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Validate attendance date
|--------------------------------------------------------------------------
*/

$dateObject = DateTime::createFromFormat('Y-m-d', $attendanceDate);

if (
    !$dateObject ||
    $dateObject->format('Y-m-d') !== $attendanceDate
) {
    json_response([
        'error' => 'Invalid attendance_date'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Optional / form fields
|--------------------------------------------------------------------------
*/

$coursePhase = trim(
    $input['course_phase'] ??
    'phase1_general'
);

$courseInstructor = trim(
    $input['course_instructor'] ??
    ''
);

$courseCategory = trim(
    $input['course_category'] ??
    ''
);

$reflection = trim(
    $input['reflection'] ??
    ''
);

if ($reflection === '') {
    $reflection = null;
}

/*
|--------------------------------------------------------------------------
| Attended
|--------------------------------------------------------------------------
*/

if (isset($input['attended'])) {

    if (is_bool($input['attended'])) {

        $attended = $input['attended'];

    } else {

        $attended = filter_var(
            $input['attended'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($attended === null) {
            $attended = false;
        }
    }

} else {

    $attended = true;
}

/*
|--------------------------------------------------------------------------
| Hours
|--------------------------------------------------------------------------
*/

$hoursRaw = $input['hours'] ?? null;

if (
    $hoursRaw === null ||
    $hoursRaw === ''
) {
    $hours = null;
} else {

    if (!is_numeric($hoursRaw)) {
        json_response([
            'error' => 'hours must be a number'
        ], 400);
    }

    $hours = (float) $hoursRaw;

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

$testScoreRaw = $input['test_score'] ?? null;

if (
    $testScoreRaw === null ||
    $testScoreRaw === ''
) {

    $testScore = null;

} else {

    if (
        !is_numeric($testScoreRaw) ||
        floor((float) $testScoreRaw) != (float) $testScoreRaw
    ) {
        json_response([
            'error' => 'test_score must be a whole number'
        ], 400);
    }

    $testScore = (int) $testScoreRaw;

    if ($testScore < 0 || $testScore > 100) {
        json_response([
            'error' => 'test_score must be between 0 and 100'
        ], 400);
    }
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
    | Find the trainee belonging to the logged-in user
    |--------------------------------------------------------------------------
    |
    | This is the important fix.
    |
    | The browser does NOT need to send trainee_id.
    |
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
            'message' => 'The logged-in user is not associated with a trainee profile.'
        ], 404);
    }

    $traineeId = $trainee['id'];

    /*
    |--------------------------------------------------------------------------
    | Validate course phase
    |--------------------------------------------------------------------------
    */

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
    | Find existing course
    |--------------------------------------------------------------------------
    |
    | First try to find an existing course with the same name and phase.
    |
    */

    $courseStmt = $db->prepare("
        SELECT *
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

        /*
         * Generate a course code.
         *
         * Example:
         * MATTA-TRAINING-A1B2C3D4
         */

        $courseCode =
            'MATTA-TRAINING-' .
            strtoupper(bin2hex(random_bytes(4)));

        $createCourseStmt = $db->prepare("
            INSERT INTO public.courses (
                course_code,
                course_name,
                category,
                phase,
                hours,
                instructor,
                description,
                is_active,
                created_at,
                updated_at
            )
            VALUES (
                :course_code,
                :course_name,
                :category,
                :phase,
                :hours,
                :instructor,
                NULL,
                TRUE,
                NOW(),
                NOW()
            )
            RETURNING *
        ");

        $createCourseStmt->execute([
            ':course_code' => $courseCode,
            ':course_name' => $courseName,
            ':category' => $courseCategory !== ''
                ? $courseCategory
                : null,
            ':phase' => $coursePhase,
            ':hours' => $hours,
            ':instructor' => $courseInstructor !== ''
                ? $courseInstructor
                : null
        ]);

        $course = $createCourseStmt->fetch(PDO::FETCH_ASSOC);

        if (!$course) {
            json_response([
                'error' => 'Failed to create course'
            ], 500);
        }

    } else {

        /*
         * Use the existing course.
         */

        /*
         * Keep the catalog information up to date if the
         * user supplied instructor/category information.
         */

        $updates = [];
        $params = [
            ':course_id' => $course['id']
        ];

        if (
            $courseInstructor !== '' &&
            empty($course['instructor'])
        ) {
            $updates[] = 'instructor = :instructor';
            $params[':instructor'] = $courseInstructor;
        }

        if (
            $courseCategory !== '' &&
            empty($course['category'])
        ) {
            $updates[] = 'category = :category';
            $params[':category'] = $courseCategory;
        }

        if (!empty($updates)) {

            $updates[] = 'updated_at = NOW()';

            $updateCourseStmt = $db->prepare("
                UPDATE public.courses
                SET " . implode(', ', $updates) . "
                WHERE id = :course_id
            ");

            $updateCourseStmt->execute($params);

            /*
             * Reload the course after updating.
             */

            $reloadCourseStmt = $db->prepare("
                SELECT *
                FROM public.courses
                WHERE id = :course_id
                LIMIT 1
            ");

            $reloadCourseStmt->execute([
                ':course_id' => $course['id']
            ]);

            $course = $reloadCourseStmt->fetch(PDO::FETCH_ASSOC);
        }
    }

    $courseId = $course['id'];

    /*
    |--------------------------------------------------------------------------
    | Completion status
    |--------------------------------------------------------------------------
    */

    $completionStatus =
        $input['completion_status'] ??
        null;

    if (
        $completionStatus === ''
    ) {
        $completionStatus = null;
    }

    /*
    |--------------------------------------------------------------------------
    | Insert training record
    |--------------------------------------------------------------------------
    */

    $recordStmt = $db->prepare("
        INSERT INTO public.training_records (
            trainee_id,
            course_id,
            attendance_date,
            attended,
            test_score,
            reflection,
            completion_status,
            hours,
            created_at,
            updated_at
        )
        VALUES (
            :trainee_id,
            :course_id,
            :attendance_date,
            :attended,
            :test_score,
            :reflection,
            :completion_status,
            :hours,
            NOW(),
            NOW()
        )
        RETURNING *
    ");

    $recordStmt->execute([
        ':trainee_id' => $traineeId,
        ':course_id' => $courseId,
        ':attendance_date' => $attendanceDate,
        ':attended' => $attended,
        ':test_score' => $testScore,
        ':reflection' => $reflection,
        ':completion_status' => $completionStatus,
        ':hours' => $hours
    ]);

    $record = $recordStmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        json_response([
            'error' => 'Failed to create training record'
        ], 500);
    }

    /*
    |--------------------------------------------------------------------------
    | Return result
    |--------------------------------------------------------------------------
    */

    json_response([
        'data' => [
            'record' => $record,
            'course' => $course,
            'trainee_id' => $traineeId
        ]
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