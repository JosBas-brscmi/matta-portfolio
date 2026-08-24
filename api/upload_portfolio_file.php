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

    // Extract portfolio_item_id from GET query, POST body, or REQUEST
    $portfolioItemId = $_GET['portfolio_item_id'] 
        ?? $_POST['portfolio_item_id'] 
        ?? $_REQUEST['portfolio_item_id'] 
        ?? $_REQUEST['portfolioItemId'] 
        ?? null;

    if (!$portfolioItemId) {
        json_response([
            'error' => 'Missing parameters',
            'detail' => 'portfolio_item_id is required.'
        ], 400);
    }

    // Comprehensive file upload & PHP limit checking
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $errorCode = $_FILES['file']['error'] ?? null;

        $errorMap = [
            UPLOAD_ERR_INI_SIZE   => 'The file exceeds upload_max_filesize in php.ini.',
            UPLOAD_ERR_FORM_SIZE  => 'The file exceeds MAX_FILE_SIZE in the form.',
            UPLOAD_ERR_PARTIAL    => 'The file was only partially uploaded.',
            UPLOAD_ERR_NO_FILE    => 'No file was selected for upload.',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary upload directory on the server.',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk (check folder permissions).',
            UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the file upload.',
        ];

        $detail = $errorMap[$errorCode] ?? 'No file received in $_FILES.';

        // Detect if payload exceeded post_max_size (PHP silently empties $_POST and $_FILES)
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if (empty($_FILES) && empty($_POST) && $contentLength > 0) {
            $detail = 'Upload exceeds post_max_size in php.ini, causing PHP to discard the request.';
        }

        json_response([
            'error' => 'File upload error',
            'detail' => $detail,
            'debug' => [
                'php_error_code' => $errorCode,
                'files_received_keys' => array_keys($_FILES),
                'content_length_bytes' => $contentLength,
            ]
        ], 400);
    }

    $file = $_FILES['file'];
    $fileName = basename($file['name']);
    $fileType = $file['type'];
    $fileSize = $file['size'];

    $uploadDir = __DIR__ . '/uploads/portfolio/';
    if (!is_dir($uploadDir)) {
        if (!@mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
            json_response(['error' => 'Directory creation failed', 'detail' => 'Cannot create path: ' . $uploadDir], 500);
        }
    }

    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    $relativeStoragePath = 'portfolio/' . uniqid() . '_' . time() . ($ext ? '.' . $ext : '');
    $destination = __DIR__ . '/uploads/' . $relativeStoragePath;

    if (!@move_uploaded_file($file['tmp_name'], $destination)) {
        $lastErr = error_get_last();
        json_response([
            'error' => 'Failed to save uploaded file',
            'detail' => $lastErr['message'] ?? 'Check write permissions on /api/uploads/ folder'
        ], 500);
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