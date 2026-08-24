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

try {
    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        json_response(['error' => 'Not signed in'], 401);
    }

    $traineeId = $_POST['trainee_id'] ?? null;
    $portfolioItemId = $_POST['portfolio_item_id'] ?? null;

    if (!$traineeId || !$portfolioItemId) {
        json_response(['error' => 'Trainee ID and Portfolio Item ID are required.'], 400);
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_response(['error' => 'File upload error or no file uploaded.'], 400);
    }

    $file = $_FILES['file'];
    $fileName = $file['name'];
    $fileType = $file['type'];
    $fileSize = $file['size'];

    $uploadDir = __DIR__ . '/uploads/portfolio/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    $storagePath = 'portfolio/' . uniqid() . '_' . time() . '.' . $ext;
    $destination = __DIR__ . '/uploads/' . $storagePath;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        json_response(['error' => 'Failed to save uploaded file to server.'], 500);
    }

    $stmt = $pdo->prepare("
        INSERT INTO public.portfolio_files (
            portfolio_item_id,
            file_name,
            file_type,
            file_size_bytes,
            storage_path,
            uploaded_at
        ) VALUES (
            :portfolio_item_id,
            :file_name,
            :file_type,
            :file_size_bytes,
            :storage_path,
            NOW()
        )
        RETURNING id, portfolio_item_id, file_name, file_type, file_size_bytes, storage_path, uploaded_at
    ");

    $stmt->execute([
        ':portfolio_item_id' => $portfolioItemId,
        ':file_name' => $fileName,
        ':file_type' => $fileType,
        ':file_size_bytes' => $fileSize,
        ':storage_path' => $storagePath,
    ]);

    $uploadedFile = $stmt->fetch(PDO::FETCH_ASSOC);

    json_response(['file' => $uploadedFile], 201);

} catch (Throwable $e) {
    error_log('[upload_portfolio_file] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}