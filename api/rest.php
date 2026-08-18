<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

// Debug: log incoming request headers and raw body for troubleshooting
$raw = [];
$raw['time'] = date('c');
$raw['get'] = $_GET;
$raw['headers'] = function_exists('getallheaders') ? getallheaders() : [];
$raw['body'] = file_get_contents('php://input');
@file_put_contents(__DIR__ . '/last_request.log', json_encode($raw) . PHP_EOL, FILE_APPEND);
$method = $_SERVER['REQUEST_METHOD'];
$table = $_GET['table'] ?? null;
if (!$table || !preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid table name']);
    exit;
}

$pdo = get_db();

try {
    if ($method === 'GET') {
        $select = $_GET['select'] ?? '*';
        $sql = "SELECT $select FROM \"public\".\"$table\"";
        $where = [];
        $params = [];
        foreach ($_GET as $k => $v) {
            if (strpos($k, 'eq_') === 0) {
                $col = substr($k, 3);
                if (preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
                    $where[] = "\"$col\" = :$col";
                    $params[":$col"] = $v;
                }
            }
        }
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        if (!empty($_GET['order'])) {
            $sql .= ' ORDER BY ' . preg_replace('/[^a-zA-Z0-9_, ]/', '', $_GET['order']);
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($_GET['single'])) {
            echo json_encode(['data' => $rows[0] ?? null]);
        } else {
            echo json_encode(['data' => $rows]);
        }
        exit;
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing JSON body']);
            exit;
        }

        // Ensure required uuid id exists for trainees inserts
        if ($table === 'trainees' && empty($body['id'])) {
            // generate 32-char hex id (Postgres accepts 32 hex digits for uuid)
            $body['id'] = bin2hex(random_bytes(16));
        }
        if ($table === 'trainees' && empty($body['onboard_date'])) {
            $body['onboard_date'] = (new DateTime('now'))->format('Y-m-d');
        }
        $cols = array_keys($body);
        $colsFiltered = array_filter($cols, fn($c) => preg_match('/^[a-zA-Z0-9_]+$/', $c));
        if (!$colsFiltered) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid columns']);
            exit;
        }
        $placeholders = array_map(fn($c) => ':' . $c, $colsFiltered);
        $sql = 'INSERT INTO "public"."' . $table . '" ("' . implode('","', $colsFiltered) . '") VALUES (' . implode(',', $placeholders) . ') RETURNING *';
        $stmt = $pdo->prepare($sql);
        foreach ($colsFiltered as $c) $stmt->bindValue(':' . $c, $body[$c]);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['data' => $row]);
        exit;
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id']);
            exit;
        }
        $body = json_decode(file_get_contents('php://input'), true);
        $cols = array_keys($body);
        $colsFiltered = array_filter($cols, fn($c) => preg_match('/^[a-zA-Z0-9_]+$/', $c));
        if (!$colsFiltered) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid columns']);
            exit;
        }
        $sets = array_map(fn($c) => "\"$c\" = :$c", $colsFiltered);
        $sql = 'UPDATE "public"."' . $table . '" SET ' . implode(',', $sets) . ' WHERE id = :__id RETURNING *';
        $stmt = $pdo->prepare($sql);
        foreach ($colsFiltered as $c) $stmt->bindValue(':' . $c, $body[$c]);
        $stmt->bindValue(':__id', $id);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['data' => $row]);
        exit;
    }

    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id']);
            exit;
        }
        $sql = 'DELETE FROM "public"."' . $table . '" WHERE id = :__id';
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':__id', $id);
        $stmt->execute();
        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
} catch (Exception $e) {
    http_response_code(500);
    // Log the error for debugging
    $log = "[" . date('c') . "] QUERY_ERROR: " . $e->getMessage() . PHP_EOL;
    $log .= "GET: " . json_encode($_GET) . PHP_EOL;
    $body = file_get_contents('php://input');
    $log .= "BODY: " . $body . PHP_EOL;
    $log .= $e->getTraceAsString() . PHP_EOL . str_repeat('-', 80) . PHP_EOL;
    @file_put_contents(__DIR__ . '/error.log', $log, FILE_APPEND);
    echo json_encode(['error' => 'query_failed', 'detail' => $e->getMessage()]);
}
