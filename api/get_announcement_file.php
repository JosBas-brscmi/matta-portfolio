<?php

header('Content-Type: application/octet-stream');
require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function fail_response(string $message, int $status): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => $message]);
    exit;
}

try {
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        fail_response('Not signed in', 401);
    }

    $storagePath = $_GET['path'] ?? '';
    if ($storagePath === '') {
        fail_response('Missing path', 400);
    }

    $storagePath = str_replace('\\', '/', $storagePath);
    $storagePath = ltrim($storagePath, '/');

    if ($storagePath === '' || str_contains($storagePath, '..')) {
        fail_response('Invalid storage path', 400);
    }

    $filePath = __DIR__ . '/uploads/' . $storagePath;
    $realFilePath = realpath($filePath);
    $uploadsRoot = realpath(__DIR__ . '/uploads');

    if ($uploadsRoot === false || $realFilePath === false || !str_starts_with($realFilePath, $uploadsRoot . DIRECTORY_SEPARATOR)) {
        fail_response('File not found', 404);
    }

    if (!is_file($realFilePath)) {
        fail_response('File not found', 404);
    }

    $mimeType = mime_content_type($realFilePath) ?: 'application/octet-stream';
    $fileName = basename($realFilePath);

    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($realFilePath));
    header('Content-Disposition: inline; filename="' . addslashes($fileName) . '"');
    header('X-Content-Type-Options: nosniff');

    readfile($realFilePath);
    exit;

} catch (Throwable $e) {
    error_log('[get_announcement_file] ' . $e->getMessage());
    fail_response('File unavailable', 500);
}
