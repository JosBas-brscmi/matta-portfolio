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

    // Read JSON input body if content-type was application/json
    $rawInput = file_get_contents('php://input');
    $jsonData = !empty($rawInput) ? json_decode($rawInput, true) : [];

    // Extract portfolio_item_id from POST, GET, REQUEST, or JSON payload
    $portfolioItemId = $_REQUEST['portfolio_item_id'] 
        ?? $_REQUEST['portfolioItemId'] 
        ?? $_REQUEST['portfolio_id'] 
        ?? $_REQUEST['item_id'] 
        ?? ($jsonData['portfolio_item_id'] ?? null)
        ?? ($jsonData['portfolioItemId'] ?? null)
        ?? ($jsonData['portfolio_id'] ?? null)
        ?? ($jsonData['item_id'] ?? null);

    if (!$portfolioItemId) {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'portfolio_item_id is required.',
            'debug' => [
                'post' => $_POST,
                'get' => $_GET,
                'json_keys' => is_array($jsonData) ? array_keys($jsonData) : null,
                'content_type' => $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? 'not_set'
            ]
        ], 400);
    }

    // Process file from $_FILES or base64 JSON payload
    $fileName = '';
    $fileType = '';
    $fileSize = 0;
    $tmpFilePath = '';
    $isBase64 = false;

    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['file'];
        $fileName = basename($file['name']);
        $fileType = $file['type'];
        $fileSize = $file['size'];
        $tmpFilePath = $file['tmp_name'];
    } elseif (!empty($jsonData['file_data']) || !empty($jsonData['file'])) {
        // Handle Base64 file upload if sent via JSON
        $base64String = $jsonData['file_data'] ?? $jsonData['file'];
        $fileName = basename($jsonData['file_name'] ?? $jsonData['name'] ?? 'uploaded_file');
        $fileType = $jsonData['file_type'] ?? 'application/octet-stream';
        
        if (preg_match('/^data:(.*);base64,/', $base64String, $matches)) {
            $fileType = $matches[1];
            $base64String = substr($base64String, strpos($base64String, ',') + 1);
        }
        
        $decodedData = base64_decode($base64String);
        if ($decodedData === false) {
            json_response(['error' => 'Invalid Base64 file data.'], 400);
        }
        
        $fileSize = strlen($decodedData);
        $isBase64 = true;
    } else {
        $uploadErrCode = $_FILES['file']['error'] ?? 'No file object received';
        json_response([
            'error' => 'File upload error',
            'detail' => 'PHP upload error code: ' . $uploadErrCode
        ], 400);
    }

    // Ensure uploads directory exists
    $uploadDir = __DIR__ . '/uploads/portfolio/';
    if (!is_dir($uploadDir)) {
        if (!@mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
            json_response(['error' => 'Directory creation failed', 'detail' => 'Cannot create path: ' . $uploadDir], 500);
        }
    }

    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    $relativeStoragePath = 'portfolio/' . uniqid() . '_' . time() . ($ext ? '.' . $ext : '');
    $destination = __DIR__ . '/uploads/' . $relativeStoragePath;

    if ($isBase64) {
        if (file_put_contents($destination, $decodedData) === false) {
            json_response(['error' => 'Failed to save base64 file to server.'], 500);
        }
    } else {
        if (!@move_uploaded_file($tmpFilePath, $destination)) {
            $lastErr = error_get_last();
            json_response([
                'error' => 'Failed to save uploaded file',
                'detail' => $lastErr['message'] ?? 'Check write permissions on /api/uploads/ folder'
            ], 500);
        }
    }

    $fileId = generate_uuid();

    $stmt = $pdo->prepare("
        INSERT INTO portfolio_files (
            id,
            portfolio_item_id,
            file_name,
            file_type,
            file_size_bytes,
            storage_path,
            uploaded_at
        ) VALUES (
            :id,
            :portfolio_item_id,
            :file_name,
            :file_type,
            :file_size_bytes,
            :storage_path,
            NOW()
        )
    ");

    $stmt->execute([
        ':id' => $fileId,
        ':portfolio_item_id' => $portfolioItemId,
        ':file_name' => $fileName,
        ':file_type' => $fileType,
        ':file_size_bytes' => $fileSize,
        ':storage_path' => $relativeStoragePath,
    ]);

    $fetchStmt = $pdo->prepare("
        SELECT id, portfolio_item_id, file_name, file_type, file_size_bytes, storage_path, uploaded_at
        FROM portfolio_files
        WHERE id = :id
        LIMIT 1
    ");
    $fetchStmt->execute([':id' => $fileId]);
    $uploadedFile = $fetchStmt->fetch(PDO::FETCH_ASSOC);

    json_response(['file' => $uploadedFile], 201);

} catch (PDOException $e) {
    error_log('[upload_portfolio_file PDO Error] ' . $e->getMessage());
    json_response([
        'error' => 'database_error',
        'detail' => $e->getMessage()
    ], 500);
} catch (Throwable $e) {
    error_log('[upload_portfolio_file General Error] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}