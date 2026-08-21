
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
    |--------------------------------------------------------------------------
    | Get logged-in user's role
    |--------------------------------------------------------------------------
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
    |--------------------------------------------------------------------------
    | Privileged users
    |--------------------------------------------------------------------------
    |
    | These users can view training records belonging to any trainee.
    |
    */

    $privilegedRoles = [
        'owner',
        'ma_center',
        'admin',
        'administrator',
        'staff',
        'trainer',
        'manager',
        'supervisor'
    ];

    $authorized = in_array($role, $privilegedRoles, true);

    /*
    |--------------------------------------------------------------------------
    | Normal trainee authorization
    |--------------------------------------------------------------------------
    |
    | If the logged-in user is not privileged, they can only
    | view their own trainee record.
    |
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
    | Fetch training records
    |--------------------------------------------------------------------------
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

            c.id AS c_id,
            c.course_code,
            c.course_name,
            c.category,
            c.phase,
            c.hours AS course_hours,
            c.instructor,
            c.description,
            c.is_active,
            c.created_at AS course_created_at,
            c.updated_at AS course_updated_at

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
    | Build response
    |--------------------------------------------------------------------------
    |
    | The frontend expects each training record to contain:
    |
    | record.course.course_name
    | record.course.phase
    | record.course.category
    | record.course.instructor
    |
    */

    $records = [];

    foreach ($rows as $row) {

        $course = null;

        if (!empty($row['c_id'])) {

            $course = [
                'id' => $row['c_id'],
                'course_code' => $row['course_code'],
                'course_name' => $row['course_name'],
                'category' => $row['category'],
                'phase' => $row['phase'],
                'hours' => $row['course_hours'],
                'instructor' => $row['instructor'],
                'description' => $row['description'],
                'is_active' => $row['is_active'],
                'created_at' => $row['course_created_at'],
                'updated_at' => $row['course_updated_at']
            ];
        }

        $records[] = [
            'id' => $row['id'],
            'trainee_id' => $row['trainee_id'],
            'course_id' => $row['course_id'],
            'attendance_date' => $row['attendance_date'],
            'attended' => (bool) $row['attended'],
            'test_score' => $row['test_score'],
            'reflection' => $row['reflection'],
            'completion_status' => $row['completion_status'],
            'hours' => $row['hours'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'course' => $course
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Return response
    |--------------------------------------------------------------------------
    */

    json_response([
        'data' => $records
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
