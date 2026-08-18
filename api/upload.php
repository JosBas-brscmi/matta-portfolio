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

/*
 * Authentication
 */
if (!isset($_SESSION['user_id'])) {
    json_response([
        'error' => 'Not signed in'
    ], 401);
}

/*
 * An actual upload request must contain a file.
 *
 * We intentionally do not depend on $_SERVER['REQUEST_METHOD'] here.
 * This avoids the current "Method not allowed" problem while still
 * ensuring that an upload cannot happen without an uploaded file.
 */
if (!isset($_FILES['file'])) {
    json_response([
        'error' => 'no_file',
        'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown'
    ], 400);
}

$file = $_FILES['file'];

/*
 * PHP upload error
 */
if ($file['error'] !== UPLOAD_ERR_OK) {
    json_response([
        'error' => 'upload_error',
        'detail' => $file['error']
    ], 400);
}

/*
 * Validate filename
 */
$originalName = basename($file['name'] ?? '');

if ($originalName === '') {
    json_response([
        'error' => 'invalid_filename'
    ], 400);
}

/*
 * Get requested storage path.
 *
 * Avatar:
 *   <user-id>/avatar_timestamp.jpg
 *
 * Portfolio:
 *   <trainee-id>/<portfolio-id>/timestamp_file.pdf
 */
$requestedPath = trim($_POST['storage_path'] ?? '');

$uploadsDir = dirname(__DIR__) . '/storage/uploads';

if (!is_dir($uploadsDir)) {
    if (!mkdir($uploadsDir, 0755, true)) {
        json_response([
            'error' => 'could_not_create_upload_directory'
        ], 500);
    }
}

if ($requestedPath !== '') {

    $requestedPath = str_replace('\\', '/', $requestedPath);
    $requestedPath = ltrim($requestedPath, '/');

    /*
     * Prevent directory traversal.
     */
    if (
        str_contains($requestedPath, '..') ||
        str_contains($requestedPath, "\0") ||
        preg_match('/[^a-zA-Z0-9._\/-]/', $requestedPath)
    ) {
        json_response([
            'error' => 'invalid_storage_path'
        ], 400);
    }

    $relativePath = 'storage/uploads/' . $requestedPath;

} else {

    /*
     * Fallback for uploads that do not specify a path.
     */
    $safeName = preg_replace(
        '/[^a-zA-Z0-9._-]/',
        '_',
        $originalName
    );

    $relativePath =
        'storage/uploads/' .
        time() .
        '_' .
        $safeName;
}

$absolutePath = dirname(__DIR__) . '/' . $relativePath;

$parentDir = dirname($absolutePath);

if (!is_dir($parentDir)) {
    if (!mkdir($parentDir, 0755, true)) {
        json_response([
            'error' => 'could_not_create_storage_path'
        ], 500);
    }
}

/*
 * Do not overwrite an existing file.
 */
if (file_exists($absolutePath)) {
    json_response([
        'error' => 'file_already_exists'
    ], 409);
}

/*
 * Move uploaded temporary file into storage.
 */
if (!move_uploaded_file(
    $file['tmp_name'],
    $absolutePath
)) {
    json_response([
        'error' => 'move_failed'
    ], 500);
}

/*
 * Determine MIME type.
 */
$fileType = $file['type'] ?? '';

if (!$fileType) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $fileType = $finfo->file($absolutePath) ?: 'application/octet-stream';
}

/*
 * Application is served from /matta, so generate a URL that includes it.
 */
$publicUrl = '/matta/' . $relativePath;

json_response([
    'data' => [
        'publicUrl' => $publicUrl,
        'storage_path' => $relativePath,
        'file_name' => $originalName,
        'file_type' => $fileType,
        'file_size_bytes' => filesize($absolutePath)
    ]
]);