<?php
// update_assessment.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle CORS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Ensure request method is POST or PUT
if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT'])) {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed. Use POST or PUT.'
    ]);
    exit();
}

// Database Credentials
$db_host = 'localhost';
$db_name = 'matta_db';
$db_user = 'db_username';
$db_pass = 'db_password';

try {
    $pdo = new PDO("mysql:host={$db_host};dbname={$db_name};charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit();
}

// Retrieve and parse JSON payload
$inputRaw = file_get_contents('php://input');
$data = json_decode($inputRaw, true);

// Fallback to standard $_POST if JSON parsing returns null
if (!$data) {
    $data = $_POST;
}

// Primary Key Validation
$assessment_id = $data['id'] ?? null;

if (!$assessment_id) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Missing required parameter: id'
    ]);
    exit();
}

// Extract updated fields matching TraineeDetailPage schema
$title = isset($data['title']) ? trim($data['title']) : null;
$assessment_type = isset($data['assessment_type']) ? trim($data['assessment_type']) : null;
$assessment_date = isset($data['assessment_date']) ? trim($data['assessment_date']) : null;
$score = isset($data['score']) && $data['score'] !== '' ? filter_var($data['score'], FILTER_VALIDATE_FLOAT) : null;
$max_score = isset($data['max_score']) && $data['max_score'] !== '' ? filter_var($data['max_score'], FILTER_VALIDATE_FLOAT) : null;
$remarks = isset($data['remarks']) ? trim($data['remarks']) : null;

try {
    // Check if assessment record exists
    $checkSql = "SELECT id FROM assessments WHERE id = :id";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([':id' => $assessment_id]);

    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Assessment entry not found.'
        ]);
        exit();
    }

    // Dynamic update statement using COALESCE for partial updates
    $sql = "UPDATE assessments 
            SET 
                title = COALESCE(:title, title),
                assessment_type = COALESCE(:assessment_type, assessment_type),
                assessment_date = COALESCE(:assessment_date, assessment_date),
                score = COALESCE(:score, score),
                max_score = COALESCE(:max_score, max_score),
                remarks = COALESCE(:remarks, remarks),
                updated_at = NOW()
            WHERE id = :id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':title' => $title,
        ':assessment_type' => $assessment_type,
        ':assessment_date' => $assessment_date,
        ':score' => $score !== false ? $score : null,
        ':max_score' => $max_score !== false ? $max_score : null,
        ':remarks' => $remarks,
        ':id' => $assessment_id,
    ]);

    // Fetch updated record to return in response
    $fetchSql = "SELECT * FROM assessments WHERE id = :id";
    $fetchStmt = $pdo->prepare($fetchSql);
    $fetchStmt->execute([':id' => $assessment_id]);
    $updatedAssessment = $fetchStmt->fetch();

    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => 'Assessment updated successfully.',
        'assessment' => $updatedAssessment
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Query failed: ' . $e->getMessage()
    ]);
}