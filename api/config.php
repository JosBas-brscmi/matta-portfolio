<?php
$allowedOrigins = [
    'http://10.8.1.50',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost',
    'http://127.0.0.1',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Non-secret connection defaults; credentials must come from the server environment.
$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_PORT = getenv('DB_PORT') ?: '5432';
$DB_NAME = getenv('DB_NAME') ?: 'matta';
$DB_USER = getenv('DB_USER') ?: '';
$DB_PASS = getenv('DB_PASS') ?: '';
$DSN = "pgsql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME}";

function get_db(): PDO
{
    static $pdo = null;
    global $DSN, $DB_USER, $DB_PASS;
    if ($pdo) return $pdo;
    if ($DB_USER === '' || $DB_PASS === '') {
        error_log('[api] Database credentials are not configured.');
        http_response_code(500);
        echo json_encode(['error' => 'database_unavailable']);
        exit;
    }
    try {
        $pdo = new PDO($DSN, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdo->exec('CREATE SCHEMA IF NOT EXISTS public');
    } catch (PDOException $e) {
        error_log('[api] Database connection failed: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'database_unavailable']);
        exit;
    }
    return $pdo;
}
