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

/*
|--------------------------------------------------------------------------
| Read request
|--------------------------------------------------------------------------
*/

$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    $input = $_POST;
}

/*
|--------------------------------------------------------------------------
| Required fields
|--------------------------------------------------------------------------
*/

$traineeId = trim($input['trainee_id'] ?? '');
$courseId = trim($input['course_id'] ?? '');

if ($traineeId === '') {
    json_response([
        'error' => 'trainee_id is required'
    ], 400);
}

if ($courseId === '') {
    json_response([
        'error' => 'course_id is required'
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Optional fields
|--------------------------------------------------------------------------
*/

$attendanceDate =
    !empty($input['attendance_date'])
        ? $input['attendance_date']
        : null;

$attended =
    isset($input['attended'])
        ? filter_var(
            $input['attended'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        )
        : false;

$testScore =
    ($input['test_score'] ?? '') !== ''
        ? $input['test_score']
        : null;

$reflection =
    ($input['reflection'] ?? '') !== ''
        ? $input['reflection']
        : null;

$completionStatus =
    ($input['completion_status'] ?? '') !== ''
        ? $input['completion_status']
        : null;

$hours =
    ($input['hours'] ?? '') !== ''
        ? $input['hours']
        : null;

/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {

    $db = get_db();

    $userId = $_SESSION['user_id'];

    /*
     * Determine the logged-in user's role.
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
     * Administrative/staff users can create records
     * for any trainee.
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
     * Normal trainee users can only create records
     * belonging to themselves.
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
            'message' => 'You are not authorized to create a training record for this trainee.'
        ], 403);
    }

    /*
     * Verify trainee exists.
     */
    $stmt = $db->prepare("
        SELECT id
        FROM public.trainees
        WHERE id = :trainee_id
        LIMIT 1
    ");

    $stmt->execute([
        ':trainee_id' => $traineeId
    ]);

    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        json_response([
            'error' => 'Trainee not found'
        ], 404);
    }

    /*
     * Verify course exists.
     */
    $stmt = $db->prepare("
        SELECT id
        FROM public.courses
        WHERE id = :course_id
        LIMIT 1
    ");

    $stmt->execute([
        ':course_id' => $courseId
    ]);

    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        json_response([
            'error' => 'Course not found'
        ], 404);
    }

    /*
     * Create training record.
     */
    $stmt = $db->prepare("
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

    $stmt->execute([
        ':trainee_id' => $traineeId,
        ':course_id' => $courseId,
        ':attendance_date' => $attendanceDate,
        ':attended' => $attended,
        ':test_score' => $testScore,
        ':reflection' => $reflection,
        ':completion_status' => $completionStatus,
        ':hours' => $hours
    ]);

    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    json_response([
        'data' => $record
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