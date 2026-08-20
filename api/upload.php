
<?php

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

/*
|--------------------------------------------------------------------------
| JSON response helper
|--------------------------------------------------------------------------
*/

function json_response($data, int $status = 200): void
{
    http_response_code($status);

    echo json_encode($data);

    exit;
}

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

if (!isset($_SESSION['user_id'])) {

    json_response([
        'error' => 'Not signed in',
    ], 401);
}

/*
|--------------------------------------------------------------------------
| Validate uploaded file
|--------------------------------------------------------------------------
*/

if (!isset($_FILES['file'])) {

    json_response([
        'error' => 'no_file',
        'request_method' =>
            $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    ], 400);
}

$file = $_FILES['file'];

/*
|--------------------------------------------------------------------------
| PHP upload error
|--------------------------------------------------------------------------
*/

if (
    !isset($file['error']) ||
    $file['error'] !== UPLOAD_ERR_OK
) {

    json_response([
        'error' => 'upload_error',
        'detail' => $file['error'] ?? null,
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Validate temporary upload
|--------------------------------------------------------------------------
*/

if (
    empty($file['tmp_name']) ||
    !is_uploaded_file($file['tmp_name'])
) {

    json_response([
        'error' => 'invalid_uploaded_file',
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Validate filename
|--------------------------------------------------------------------------
*/

$originalName =
    basename($file['name'] ?? '');

if ($originalName === '') {

    json_response([
        'error' => 'invalid_filename',
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Requested storage path
|--------------------------------------------------------------------------
*/

$requestedPath =
    trim($_POST['storage_path'] ?? '');

/*
|--------------------------------------------------------------------------
| Base storage directory
|--------------------------------------------------------------------------
*/

$projectRoot =
    dirname(__DIR__);

$uploadsDir =
    $projectRoot . '/storage/uploads';

/*
|--------------------------------------------------------------------------
| Create base upload directory
|--------------------------------------------------------------------------
*/

if (!is_dir($uploadsDir)) {

    if (!mkdir(
        $uploadsDir,
        0775,
        true
    )) {

        json_response([
            'error' =>
                'could_not_create_upload_directory',
        ], 500);
    }
}

/*
|--------------------------------------------------------------------------
| Build relative storage path
|--------------------------------------------------------------------------
*/

if ($requestedPath !== '') {

    /*
     * Normalize Windows separators.
     */
    $requestedPath =
        str_replace(
            '\\',
            '/',
            $requestedPath
        );

    /*
     * Remove leading slashes.
     */
    $requestedPath =
        ltrim(
            $requestedPath,
            '/'
        );

    /*
     * Prevent directory traversal.
     */
    if (
        str_contains(
            $requestedPath,
            '..'
        ) ||
        str_contains(
            $requestedPath,
            "\0"
        )
    ) {

        json_response([
            'error' =>
                'invalid_storage_path',
        ], 400);
    }

    /*
     * Only allow safe path characters.
     */
    if (
        !preg_match(
            '/^[a-zA-Z0-9._\/-]+$/',
            $requestedPath
        )
    ) {

        json_response([
            'error' =>
                'invalid_storage_path',
        ], 400);
    }

    $relativePath =
        'storage/uploads/' .
        $requestedPath;

} else {

    /*
     * Fallback when no storage_path was provided.
     */

    $safeName =
        preg_replace(
            '/[^a-zA-Z0-9._-]/',
            '_',
            $originalName
        );

    /*
     * Generate a unique filename.
     */
    $relativePath =
        'storage/uploads/' .
        time() .
        '_' .
        bin2hex(
            random_bytes(6)
        ) .
        '_' .
        $safeName;
}

/*
|--------------------------------------------------------------------------
| Build absolute path
|--------------------------------------------------------------------------
*/

$absolutePath =
    $projectRoot .
    '/' .
    $relativePath;

/*
|--------------------------------------------------------------------------
| Verify final path stays inside uploads directory
|--------------------------------------------------------------------------
*/

$realUploadsDir =
    realpath($uploadsDir);

$parentDir =
    dirname($absolutePath);

/*
 * Create requested directory if necessary.
 */

if (!is_dir($parentDir)) {

    if (!mkdir(
        $parentDir,
        0775,
        true
    )) {

        json_response([
            'error' =>
                'could_not_create_storage_path',
        ], 500);
    }
}

$realParentDir =
    realpath($parentDir);

if (
    $realUploadsDir === false ||
    $realParentDir === false ||
    (
        $realParentDir !== $realUploadsDir &&
        !str_starts_with(
            $realParentDir .
            DIRECTORY_SEPARATOR,
            $realUploadsDir .
            DIRECTORY_SEPARATOR
        )
    )
) {

    json_response([
        'error' =>
            'invalid_storage_location',
    ], 400);
}

/*
|--------------------------------------------------------------------------
| Do not overwrite existing files
|--------------------------------------------------------------------------
*/

if (file_exists($absolutePath)) {

    json_response([
        'error' =>
            'file_already_exists',
    ], 409);
}

/*
|--------------------------------------------------------------------------
| Determine MIME type
|--------------------------------------------------------------------------
*/

$fileType = '';

if (class_exists('finfo')) {

    $finfo =
        new finfo(
            FILEINFO_MIME_TYPE
        );

    $fileType =
        $finfo->file(
            $file['tmp_name']
        ) ?: '';
}

if ($fileType === '') {

    $fileType =
        $file['type'] ??
        'application/octet-stream';
}

/*
|--------------------------------------------------------------------------
| File-size protection
|--------------------------------------------------------------------------
|
| Application maximum: 20 MB.
|
| PHP itself must also allow at least 20 MB through
| upload_max_filesize and post_max_size.
|
|--------------------------------------------------------------------------
*/

$maxFileSize =
    20 * 1024 * 1024;

if (
    isset($file['size']) &&
    $file['size'] > $maxFileSize
) {

    json_response([
        'error' =>
            'file_too_large',

        'max_size_bytes' =>
            $maxFileSize,
    ], 413);
}

/*
|--------------------------------------------------------------------------
| Move uploaded file
|--------------------------------------------------------------------------
*/

if (
    !move_uploaded_file(
        $file['tmp_name'],
        $absolutePath
    )
) {

    json_response([
        'error' =>
            'move_failed',
    ], 500);
}

/*
|--------------------------------------------------------------------------
| Verify file exists
|--------------------------------------------------------------------------
*/

if (!file_exists($absolutePath)) {

    json_response([
        'error' =>
            'file_not_found_after_upload',
    ], 500);
}

/*
|--------------------------------------------------------------------------
| File size
|--------------------------------------------------------------------------
*/

$fileSize =
    filesize($absolutePath);

if ($fileSize === false) {
    $fileSize = 0;
}

/*
|--------------------------------------------------------------------------
| Public URL
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| The current production site is served at:
|
|     http://10.8.1.50
|
| It is NOT currently under /matta.
|
| Therefore:
|
|     storage/uploads/example.jpg
|
| becomes:
|
|     /storage/uploads/example.jpg
|
|--------------------------------------------------------------------------
*/

$publicUrl =
    '/' .
    $relativePath;

/*
|--------------------------------------------------------------------------
| Return upload information
|--------------------------------------------------------------------------
*/

json_response([
    'data' => [
        'publicUrl' =>
            $publicUrl,

        'storage_path' =>
            $relativePath,

        'file_name' =>
            $originalName,

        'file_type' =>
            $fileType,

        'file_size_bytes' =>
            $fileSize,
    ],
]);