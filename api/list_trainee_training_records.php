<?php

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (empty($_SESSION['user_id'])) {
    json_response([
        'error' => 'Not signed in',
        'message' => 'No authenticated PHP session was found.'
    ], 401);
}

$userId = (string) $_SESSION['user_id'];
$traineeId = trim($_GET['trainee_id'] ?? '');

if ($traineeId === '') {
    json_response(['error' => 'trainee_id is required'], 400);
}

if (!preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $traineeId)) {
    json_response([
        'error' => 'Invalid trainee_id',
        'message' => 'The supplied trainee ID is not in a valid UUID format.'
    ], 400);
}

try {
    $db = get_db();

    $profileStmt = $db->prepare("
        SELECT id, email, full_name, role
        FROM public.users_profile
        WHERE id = :user_id
        LIMIT 1
    ");
    $profileStmt->execute([':user_id' => $userId]);
    $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        json_response([
            'error' => 'User profile not found',
            'message' => 'The logged-in session does not correspond to a users_profile record.'
        ], 403);
    }

    $role = strtolower(trim((string) ($profile['role'] ?? '')));
    $privilegedRoles = ['owner', 'ma_center', 'admin', 'administrator', 'staff', 'trainer', 'manager', 'supervisor', 'mentor'];
    $authorized = in_array($role, $privilegedRoles, true);

    if (!$authorized) {
        $ownershipStmt = $db->prepare("
            SELECT id FROM public.trainees
            WHERE id = :trainee_id AND user_id = :user_id
            LIMIT 1
        ");
        $ownershipStmt->execute([':trainee_id' => $traineeId, ':user_id' => $userId]);
        if ($ownershipStmt->fetch(PDO::FETCH_ASSOC)) {
            $authorized = true;
        }
    }

    if (!$authorized) {
        json_response(['error' => 'Forbidden', 'message' => 'You are not authorized to view this trainee.'], 403);
    }

    $traineeCheckStmt = $db->prepare("SELECT id FROM public.trainees WHERE id = :trainee_id LIMIT 1");
    $traineeCheckStmt->execute([':trainee_id' => $traineeId]);

    if (!$traineeCheckStmt->fetch(PDO::FETCH_ASSOC)) {
        json_response(['error' => 'Trainee not found', 'message' => 'No trainee exists with the requested ID.'], 404);
    }

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
            c.phase,
            c.hours AS course_hours,
            c.instructor,
            c.description,
            c.is_active
        FROM public.training_records tr
        LEFT JOIN public.courses c ON c.id = tr.course_id
        WHERE tr.trainee_id = :trainee_id
        ORDER BY tr.attendance_date DESC, tr.created_at DESC
    ");
    $stmt->execute([':trainee_id' => $traineeId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $records = [];
    foreach ($rows as $row) {
        // Fall back to course_hours if tr.hours is null
        $hoursVal = $row['hours'] !== null 
            ? (float) $row['hours'] 
            : ($row['course_hours'] !== null ? (float) $row['course_hours'] : 0.0);

        $records[] = [
            'id' => $row['id'],
            'trainee_id' => $row['trainee_id'],
            'course_id' => $row['course_id'],
            'attendance_date' => $row['attendance_date'],
            // Default null attendance to true so existing entries count
            'attended' => $row['attended'] !== null ? (bool) $row['attended'] : true,
            'test_score' => $row['test_score'] !== null ? (float) $row['test_score'] : null,
            'reflection' => $row['reflection'],
            'completion_status' => $row['completion_status'],
            'hours' => $hoursVal,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'course' => $row['course_id'] !== null ? [
                'id' => $row['course_id'],
                'course_code' => $row['course_code'],
                'course_name' => $row['course_name'],
                'category' => $row['category'],
                'phase' => $row['phase'],
                'hours' => $row['course_hours'] !== null ? (float) $row['course_hours'] : null,
                'instructor' => $row['instructor'],
                'description' => $row['description'],
                'is_active' => (bool) $row['is_active']
            ] : null
        ];
    }

    json_response(['records' => $records, 'data' => $records], 200);

} catch (Throwable $e) {
    error_log('list_trainee_training_records.php: ' . $e->getMessage());
    json_response(['error' => 'Failed to retrieve training records', 'detail' => $e->getMessage()], 500);
}