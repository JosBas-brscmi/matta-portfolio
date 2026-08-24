<?php
// update_review.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle CORS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Ensure the request method is POST or PUT
if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT'])) {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed. Use POST or PUT.'
    ]);
    exit();
}

// Database Credentials for PostgreSQL
$db_host = 'localhost';
$db_port = '5432'; // Default PostgreSQL port
$db_name = 'matta_db';
$db_user = 'db_username';
$db_pass = 'db_password';

try {
    $dsn = "pgsql:host={$db_host};port={$db_port};dbname={$db_name}";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
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

// Input Validation
$review_id = $data['id'] ?? null;

if (!$review_id) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Missing required parameter: id'
    ]);
    exit();
}

// Extract updated fields with default nulls if omitted
$review_type = isset($data['review_type']) ? trim($data['review_type']) : null;
$review_period = isset($data['review_period']) ? trim($data['review_period']) : null;
$rating = isset($data['rating']) ? filter_var($data['rating'], FILTER_VALIDATE_INT) : null;
$strengths = isset($data['strengths']) ? trim($data['strengths']) : null;
$areas_for_improvement = isset($data['areas_for_improvement']) ? trim($data['areas_for_improvement']) : null;
$recommendation = isset($data['recommendation']) ? trim($data['recommendation']) : null;
$mt_reply = isset($data['mt_reply']) ? trim($data['mt_reply']) : null;

try {
    // Check if the record exists first
    $checkSql = "SELECT id FROM reviews WHERE id = :id";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([':id' => $review_id]);

    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Review entry not found.'
        ]);
        exit();
    }

    // Execute dynamic update statement
    $sql = "UPDATE reviews 
            SET 
                review_type = COALESCE(:review_type, review_type),
                review_period = COALESCE(:review_period, review_period),
                rating = COALESCE(:rating, rating),
                strengths = COALESCE(:strengths, strengths),
                areas_for_improvement = COALESCE(:areas_for_improvement, areas_for_improvement),
                recommendation = COALESCE(:recommendation, recommendation),
                mt_reply = COALESCE(:mt_reply, mt_reply),
                updated_at = NOW()
            WHERE id = :id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':review_type' => $review_type,
        ':review_period' => $review_period,
        ':rating' => $rating !== false ? $rating : null,
        ':strengths' => $strengths,
        ':areas_for_improvement' => $areas_for_improvement,
        ':recommendation' => $recommendation,
        ':mt_reply' => $mt_reply,
        ':id' => $review_id,
    ]);

    // Fetch updated record to return in response
    $fetchSql = "SELECT * FROM reviews WHERE id = :id";
    $fetchStmt = $pdo->prepare($fetchSql);
    $fetchStmt->execute([':id' => $review_id]);
    $updatedReview = $fetchStmt->fetch();

    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => 'Review updated successfully.',
        'review' => $updatedReview
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Query failed: ' . $e->getMessage()
    ]);
}