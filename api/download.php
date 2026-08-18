<?php

require_once __DIR__ . '/config.php';

session_start();

function fail_response(string $message, int $status): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => $message
    ]);
    exit;
}

try {

    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;

    if (!$userId) {
        fail_response('Not signed in', 401);
    }

    $fileId = $_GET['id'] ?? '';

    if (!$fileId) {
        fail_response('Missing file ID', 400);
    }

    /*
     * Retrieve the file and its portfolio/trainee information.
     */
    $stmt = $pdo->prepare("
        SELECT
            pf.id,
            pf.file_name,
            pf.file_type,
            pf.storage_path,
            pf.portfolio_item_id,

            pi.trainee_id,

            t.user_id AS trainee_user_id,
            t.mentor_id,
            t.department AS trainee_department

        FROM public.portfolio_files pf

        INNER JOIN public.portfolio_items pi
            ON pi.id = pf.portfolio_item_id

        INNER JOIN public.trainees t
            ON t.id = pi.trainee_id

        WHERE pf.id = :file_id

        LIMIT 1
    ");

    $stmt->execute([
        ':file_id' => $fileId
    ]);

    $file = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$file) {
        fail_response('File not found', 404);
    }

    /*
     * Determine the caller's role/department.
     */
    $stmt = $pdo->prepare("
        SELECT role, department
        FROM public.users_profile
        WHERE id = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $caller = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$caller) {
        fail_response('User not found', 404);
    }

    $role = $caller['role'];

    $allowed = false;

    /*
     * Portfolio owner can access their own file.
     */
    if ($file['trainee_user_id'] === $userId) {
        $allowed = true;
    }

    /*
     * Administrative roles can access all files.
     */
    if (in_array($role, [
        'owner',
        'ma_center',
        'ma_board'
    ], true)) {
        $allowed = true;
    }

    /*
     * Mentor can access their assigned trainees' files.
     */
    if (
        $role === 'mentor' &&
        $file['mentor_id'] === $userId
    ) {
        $allowed = true;
    }

    /*
     * Manager can access files belonging to their department.
     */
    if (
        $role === 'manager' &&
        $file['trainee_department'] === $caller['department']
    ) {
        $allowed = true;
    }

    if (!$allowed) {
        fail_response('Forbidden', 403);
    }

    /*
     * The database stores the storage_path.
     *
     * Example:
     *
     *   /storage/uploads/file.pdf
     *
     * or:
     *
     *   storage/uploads/file.pdf
     *
     * Convert it to a safe filesystem-relative path.
     */
    $storagePath = str_replace('\\', '/', $file['storage_path']);
    $storagePath = ltrim($storagePath, '/');

    /*
     * Only allow paths inside storage/uploads.
     * This prevents ../ path traversal.
     */
    if (
        !str_starts_with(
            $storagePath,
            'storage/uploads/'
        )
    ) {
        /*
         * Current upload.php may store older paths that are
         * not directly rooted at storage/uploads.
         *
         * Try the basename as a backwards-compatible fallback.
         */
        $basename = basename($storagePath);

        if (
            $basename === '' ||
            $basename === '.' ||
            $basename === '..'
        ) {
            fail_response('Invalid storage path', 400);
        }

        $storagePath = 'storage/uploads/' . $basename;
    }

    $filePath = dirname(__DIR__) . '/' . $storagePath;

    /*
     * Make absolutely sure the resolved path is still inside
     * the project's storage/uploads directory.
     */
    $uploadsRoot = realpath(
        dirname(__DIR__) . '/storage/uploads'
    );

    $realFilePath = realpath($filePath);

    if (
        $uploadsRoot === false ||
        $realFilePath === false ||
        !str_starts_with(
            $realFilePath,
            $uploadsRoot . DIRECTORY_SEPARATOR
        )
    ) {
        fail_response('Physical file not found', 404);
    }

    if (!is_file($realFilePath)) {
        fail_response('Physical file not found', 404);
    }

    /*
     * Send the file.
     */
    $mime = $file['file_type'] ?: 'application/octet-stream';

    $downloadName = basename(
        $file['file_name'] ?: $realFilePath
    );

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($realFilePath));
    header(
        'Content-Disposition: inline; filename="' .
        addslashes($downloadName) .
        '"'
    );
    header('X-Content-Type-Options: nosniff');

    readfile($realFilePath);
    exit;

} catch (Throwable $e) {

    error_log(
        '[download] ' .
        $e->getMessage()
    );

    fail_response('Download failed', 500);
}