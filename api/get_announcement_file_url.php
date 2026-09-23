<?php

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        json_response(['error' => 'Not signed in'], 401);
    }

    $storagePath = $_GET['path'] ?? '';
    if ($storagePath === '') {
        json_response(['url' => null]);
    }

    $storagePath = str_replace('\\', '/', $storagePath);
    $storagePath = ltrim($storagePath, '/');

    if ($storagePath === '' || str_contains($storagePath, '..')) {
        json_response(['url' => null]);
    }

    $url = '/api/get_announcement_file.php?path=' . rawurlencode($storagePath);
    json_response(['url' => $url]);

} catch (Throwable $e) {
    error_log('[get_announcement_file_url] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage(),
    ], 500);
}
