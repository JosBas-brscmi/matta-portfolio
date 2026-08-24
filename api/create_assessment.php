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

function generate_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

try {
    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        json_response(['error' => 'Not signed in', 'detail' => 'Session user_id missing'], 401);
    }

    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?? $_POST;

    $traineeId = $data['trainee_id'] ?? $data['traineeId'] ?? null;
    $assessmentType = $data['assessment_type'] ?? 'course_quiz';
    $title = trim($data['title'] ?? '');
    $assessmentDate = $data['assessment_date'] ?? date('Y-m-d');
    $score = isset($data['score']) && $data['score'] !== '' ? (float)$data['score'] : null;
    $maxScore = isset($data['max_score']) ? (float)$data['max_score'] : 100.0;
    $comments = trim($data['comments'] ?? '');

    if (!$traineeId || empty($title)) {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'trainee_id and title are required.'
        ], 400);
    }

    $id = generate_uuid();

    $stmt = $pdo->prepare("
        INSERT INTO assessments (
            id,
            trainee_id,
            assessment_type,
            title,
            assessment_date,
            score,
            max_score,
            comments,
            created_at
        ) VALUES (
            :id,
            :trainee_id,
            :assessment_type,
            :title,
            :assessment_date,
            :score,
            :max_score,
            :comments,
            NOW()
        )
    ");

    $stmt->execute([
        ':id'              => $id,
        ':trainee_id'      => $traineeId,
        ':assessment_type' => $assessmentType,
        ':title'           => $title,
        ':assessment_date' => $assessmentDate,
        ':score'           => $score,
        ':max_score'       => $maxScore,
        ':comments'        => $comments,
    ]);

    $fetchStmt = $pdo->prepare("
        SELECT id, trainee_id, assessment_type, title, assessment_date, score, max_score, comments, created_at
        FROM assessments
        WHERE id = :id
        LIMIT 1
    ");
    $fetchStmt->execute([':id' => $id]);
    $createdAssessment = $fetchStmt->fetch(PDO::FETCH_ASSOC);

    json_response(['data' => $createdAssessment], 201);

} catch (PDOException $e) {
    error_log('[create_assessment PDO Error] ' . $e->getMessage());
    json_response([
        'error' => 'database_error',
        'detail' => $e->getMessage()
    ], 500);
} catch (Throwable $e) {
    error_log('[create_assessment General Error] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}