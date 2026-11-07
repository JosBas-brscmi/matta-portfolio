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

    $reviewerId = $_SESSION['user_id'] ?? null;
    if (!$reviewerId) {
        json_response(['error' => 'unauthorized'], 401);
    }

    $callerStmt = $pdo->prepare("
        SELECT role, department
        FROM public.users_profile
        WHERE id = :id
        LIMIT 1
    ");
    $callerStmt->execute([':id' => $reviewerId]);
    $caller = $callerStmt->fetch(PDO::FETCH_ASSOC);
    $allowedRoles = ['owner', 'ma_center', 'ma_board', 'mentor', 'manager'];
    if (!$caller || !in_array($caller['role'], $allowedRoles, true)) {
        json_response(['error' => 'forbidden'], 403);
    }

    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);
    $input = is_array($decoded) ? $decoded : $_POST;
    if (!is_array($input)) {
        json_response(['error' => 'Invalid request body.'], 400);
    }

    $itemId     = $input['id'] ?? $input['portfolio_item_id'] ?? null;
    $status     = $input['status'] ?? $input['decision'] ?? null;
    $reviewNote = $input['review_note'] ?? $input['note'] ?? '';
    if (!is_string($reviewNote)) {
        json_response(['error' => 'Invalid review note.'], 400);
    }
    $reviewNote = trim($reviewNote);

    if (!$itemId) {
        json_response(['error' => 'Missing portfolio item ID.'], 400);
    }
    if (!is_string($itemId) || strlen($reviewNote) > 10000) {
        json_response(['error' => 'Invalid request fields.'], 400);
    }

    if (!is_string($status) || !in_array($status, ['approved', 'returned'], true)) {
        json_response(['error' => 'Invalid status decision. Must be "approved" or "returned".'], 400);
    }

    if ($status === 'returned' && $reviewNote === '') {
        json_response(['error' => 'Please tell the trainee what to improve — feedback is required when returning an item.'], 400);
    }

    $scopeStmt = $pdo->prepare("
        SELECT t.mentor_id, t.department
        FROM public.portfolio_items pi
        JOIN public.trainees t ON t.id = pi.trainee_id
        WHERE pi.id = :id
        LIMIT 1
    ");
    $scopeStmt->execute([':id' => $itemId]);
    $scope = $scopeStmt->fetch(PDO::FETCH_ASSOC);
    if (!$scope) {
        json_response(['error' => 'Portfolio item not found.'], 404);
    }
    if (
        ($caller['role'] === 'mentor' && $scope['mentor_id'] !== $reviewerId) ||
        ($caller['role'] === 'manager' && $scope['department'] !== $caller['department'])
    ) {
        json_response(['error' => 'forbidden'], 403);
    }

    $stmt = $pdo->prepare("
        UPDATE public.portfolio_items
        SET 
            status = :status,
            review_note = :review_note,
            reviewed_at = NOW(),
            reviewed_by = :reviewed_by
        WHERE id = :id
          AND status = 'pending'
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
    json_response(['error' => 'server_error'], 500);
}