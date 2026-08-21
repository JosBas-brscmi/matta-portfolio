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
|
| The application uses PHP sessions.
| The logged-in user's ID must be stored in $_SESSION['user_id'].
|
*/

if (empty($_SESSION['user_id'])) {
    json_response([
        'error' => 'Not signed in',
        'message' => 'No authenticated PHP session was found.'
    ], 401);
}

$userId = (string) $_SESSION['user_id'];

/*
|--------------------------------------------------------------------------
| Validate trainee ID
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
| Validate UUID format
|--------------------------------------------------------------------------
|
| Prevent malformed IDs from reaching PostgreSQL.
|
*/

if (!preg_match(
    '/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/',
    $traineeId
)) {
    json_response([
        'error' => 'Invalid trainee_id'
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
    |--------------------------------------------------------------------------
    | Get logged-in user's profile
    |--------------------------------------------------------------------------
    */

    $profileStmt = $db->prepare("
        SELECT
            id,
            email,
            full_name,
            role
        FROM public.users_profile
        WHERE id = :user_id
        LIMIT 1
    ");

    $profileStmt->execute([
        ':user_id' => $userId
    ]);

    $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        json_response([
            'error' => 'User profile not found',
            'message' => 'The logged-in session does not correspond to a users_profile record.'
        ], 403);
    }

    /*
    |--------------------------------------------------------------------------
    | Normalize role
    |--------------------------------------------------------------------------
    */

    $role = strtolower(trim((string) ($profile['role'] ?? '')));

    /*
    |--------------------------------------------------------------------------
    | Roles allowed to view ANY trainee
    |--------------------------------------------------------------------------
    |
    | These are the roles used by the MATTA application.
    |
    | owner     -> full administrative access
    | ma_center -> MA center administrative access
    |
    | The additional roles are retained for compatibility with
    | installations that may already use them.
    |
    */

    $privilegedRoles = [
        'owner',
        'ma_center',

        // Compatibility with other possible staff roles
        'admin',
        'administrator',
        'staff',
        'trainer',
        'manager',
        'supervisor',
        'mentor'
    ];

    $authorized = in_array($role, $privilegedRoles, true);

    /*
    |--------------------------------------------------------------------------
    | Non-privileged users
    |--------------------------------------------------------------------------
    |
    | A normal trainee can only access their own training records.
    |
    */

    if (!$authorized) {

        $ownershipStmt = $db->prepare("
            SELECT id
            FROM public.trainees
            WHERE id = :trainee_id
              AND user_id = :user_id
            LIMIT 1
        ");

        $ownershipStmt->execute([
            ':trainee_id' => $traineeId,
            ':user_id' => $userId
        ]);

        if ($ownershipStmt->fetch(PDO::FETCH_ASSOC)) {
            $authorized = true;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Authorization failed
    |--------------------------------------------------------------------------
    */

    if (!$authorized) {
        json_response([
            'error' => 'Forbidden',
            'message' => 'You are not authorized to view this trainee.'
        ], 403);
    }

    /*
    |--------------------------------------------------------------------------
    | Verify trainee exists
    |--------------------------------------------------------------------------
    */

    $traineeCheckStmt = $db->prepare("
        SELECT id
        FROM public.trainees
        WHERE id = :trainee_id
        LIMIT 1
    ");

    $traineeCheckStmt->execute([
        ':trainee_id' => $traineeId
    ]);

    if (!$traineeCheckStmt->fetch(PDO::FETCH_ASSOC)) {
        json_response([
            'error' => 'Trainee not found',
            'message' => 'No trainee exists with the requested ID.'
        ], 404);
    }

    /*
    |--------------------------------------------------------------------------
    | Fetch training records
    |--------------------------------------------------------------------------
    |
    | course_phase, course_instructor and course_category are NOT database
    | columns. They are frontend/API names.
    |
    | The actual database columns are:
    |
    | courses.phase
    | courses.instructor
    | courses.category
    |
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

            c.id AS course_id,
            c.course_code,
            c.course_name,
            c.category,
            c.phase,
            c.hours AS course_hours,
            c.instructor,
            c.description,
            c.is_active

        FROM public.training_records tr

        LEFT JOIN public.courses c
            ON c.id = tr.course_id

        WHERE tr.trainee_id = :trainee_id

        ORDER BY
            tr.attendance_date DESC,
            tr.created_at DESC
    ");

    $stmt->execute([
        ':trainee_id' => $traineeId
    ]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /*
    |--------------------------------------------------------------------------
    | Format records for traineeService.ts
    |--------------------------------------------------------------------------
    |
    | The frontend expects:
    |
    | record.course.course_name
    | record.course.phase
    | record.course.category
    | record.course.instructor
    |
    */

    $records = [];

    foreach ($rows as $row) {

        $records[] = [
            'id' => $row['id'],
            'trainee_id' => $row['trainee_id'],
            'course_id' => $row['course_id'],
            'attendance_date' => $row['attendance_date'],
            'attended' => (bool) $row['attended'],
            'test_score' => $row['test_score'] !== null
                ? (float) $row['test_score']
                : null,
            'reflection' => $row['reflection'],
            'completion_status' => $row['completion_status'],
            'hours' => $row['hours'] !== null
                ? (float) $row['hours']
                : null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],

            'course' => $row['course_id'] !== null
                ? [
                    'id' => $row['course_id'],
                    'course_code' => $row['course_code'],
                    'course_name' => $row['course_name'],
                    'category' => $row['category'],
                    'phase' => $row['phase'],
                    'hours' => $row['course_hours'] !== null
                        ? (float) $row['course_hours']
                        : null,
                    'instructor' => $row['instructor'],
                    'description' => $row['description'],
                    'is_active' => (bool) $row['is_active']
                ]
                : null
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Return response
    |--------------------------------------------------------------------------
    |
    | traineeService.ts may expect either `data` or `records`.
    | Returning both keeps this endpoint compatible with either version.
    |
    */

    json_response([
        'data' => $records,
        'records' => $records
    ], 200);

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

