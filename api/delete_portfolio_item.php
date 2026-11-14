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
        json_response(['error' => 'Portfolio item ID is required.'], 400);
    }

    // 1. Find and delete physical files from server storage
    $fileStmt = $pdo->prepare("SELECT storage_path FROM portfolio_files WHERE portfolio_item_id = :item_id");
    $fileStmt->execute([':item_id' => $id]);
    $files = $fileStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($files as $file) {
        if (!empty($file['storage_path'])) {
            $filePath = __DIR__ . '/uploads/' . $file['storage_path'];
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }
    }

    // 2. Delete database records
    $delFilesStmt = $pdo->prepare("DELETE FROM portfolio_files WHERE portfolio_item_id = :item_id");
    $delFilesStmt->execute([':item_id' => $id]);

    $delItemStmt = $pdo->prepare("DELETE FROM portfolio_items WHERE id = :id");
    $delItemStmt->execute([':id' => $id]);

    json_response(['ok' => true]);

} catch (Throwable $e) {
    error_log('[delete_portfolio_item] ' . $e->getMessage());
    json_response([
        'error' => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}