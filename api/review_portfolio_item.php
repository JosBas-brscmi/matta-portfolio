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

    // Handle CORS preflight request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['error' => 'Method not allowed. Use POST.'], 405);
    }

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?? $_POST;

    $itemId     = $input['id'] ?? $input['portfolio_item_id'] ?? null;
    $status     = $input['status'] ?? $input['decision'] ?? null;
    $reviewNote = trim($input['review_note'] ?? $input['note'] ?? '');

    if (!$itemId) {
        json_response(['error' => 'Missing portfolio item ID.'], 400);
    }

    if (!in_array($status, ['approved', 'returned'], true)) {
        json_response(['error' => 'Invalid status decision. Must be "approved" or "returned".'], 400);
    }

    if ($status === 'returned' && $reviewNote === '') {
        json_response(['error' => 'Please tell the trainee what to improve — feedback is required when returning an item.'], 400);
    }

    $reviewerId = $_SESSION['user_id'] ?? $_SESSION['user']['id'] ?? null;

    $stmt = $pdo->prepare("
        UPDATE public.portfolio_items
        SET 
            status = :status,
            review_note = :review_note,
            reviewed_at = NOW(),
            reviewed_by = :reviewed_by
        WHERE id = :id
    ");

    $stmt->execute([
        ':status'      => $status,
        ':review_note' => $reviewNote !== '' ? $reviewNote : null,
        ':reviewed_by' => $reviewerId,
        ':id'          => $itemId,
    ]);

    if ($stmt->rowCount() === 0) {
        json_response(['error' => 'Portfolio item not found.'], 404);
    }

    json_response([
        'ok'      => true,
        'message' => 'Portfolio decision saved successfully.',
        'data'    => [
            'id'          => $itemId,
            'status'      => $status,
            'review_note' => $reviewNote,
        ]
    ]);

} catch (Throwable $e) {
    error_log('[review_portfolio_item] ' . $e->getMessage());
    json_response([
        'error'  => 'server_error',
        'detail' => $e->getMessage()
    ], 500);
}