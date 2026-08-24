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

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?? [];
    $id = $input['id'] ?? null;

    if (!$id) {
        json_response(['error' => 'File ID is required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT storage_path FROM public.portfolio_files WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $file = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($file && !empty($file['storage_path'])) {
        $filePath = __DIR__ . '/uploads/' . $file['storage_path'];
        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    $delStmt = $pdo->prepare("DELETE FROM public.portfolio_files WHERE id = :id");
    $delStmt->execute([':id' => $id]);

    json_response(['ok' => true]);

} catch (Throwable $e) {
    error_log('[delete_portfolio_file] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}