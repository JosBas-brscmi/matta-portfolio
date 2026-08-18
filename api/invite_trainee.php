<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config.php';
session_start();
$pdo = get_db();

function uuid4()
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method']);
    exit;
}
$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_body']);
    exit;
}

$callerId = $_SESSION['user_id'] ?? null;
if (!$callerId) {
    http_response_code(401);
    echo json_encode(['error' => 'unauth']);
    exit;
}

$stmt = $pdo->prepare('SELECT role FROM public.users_profile WHERE id = :id');
$stmt->execute([':id' => $callerId]);
$caller = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$caller || !in_array($caller['role'], ['owner', 'ma_center'])) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

$email = strtolower(trim($body['email'] ?? ''));
$full_name = trim($body['full_name'] ?? '');
$employee_id = trim($body['employee_id'] ?? '');
$batch_code = trim($body['batch_code'] ?? '');
$onboard_date = trim($body['onboard_date'] ?? '');
$department = trim($body['department'] ?? '') ?: null;

if (!$email || !$full_name || !$employee_id || !$batch_code || !$onboard_date) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_fields']);
    exit;
}
if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_email']);
    exit;
}

// create profile
$id = uuid4();
$now = (new DateTime('now'))->format('Y-m-d H:i:s.uP');
$ins = $pdo->prepare('INSERT INTO public.users_profile (id,email,full_name,role,department,status,created_at,updated_at) VALUES (:id,:email,:full_name,:role,:department,:status,:created_at,:updated_at)');
$ins->execute([':id' => $id, ':email' => $email, ':full_name' => $full_name, ':role' => 'mt', ':department' => $department, ':status' => 'active', ':created_at' => $now, ':updated_at' => $now]);

// create trainee row
$tins = $pdo->prepare('INSERT INTO public.trainees (id,user_id,employee_id,batch_code,onboard_date,department,created_at,updated_at) VALUES (:id,:user_id,:employee_id,:batch_code,:onboard_date,:department,:created_at,:updated_at) RETURNING id');
$tins->execute([':id' => uuid4(), ':user_id' => $id, ':employee_id' => $employee_id, ':batch_code' => $batch_code, ':onboard_date' => $onboard_date, ':department' => $department, ':created_at' => $now, ':updated_at' => $now]);
$trow = $tins->fetch(PDO::FETCH_ASSOC);

// temp password
$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
$pwd = '';
for ($i = 0; $i < 12; $i++) $pwd .= $chars[random_int(0, strlen($chars) - 1)];
$pwdHash = password_hash($pwd, PASSWORD_DEFAULT);
$up = $pdo->prepare('INSERT INTO local_auth (user_id,password_hash) VALUES (:user_id,:pwd)');
$up->execute([':user_id' => $id, ':pwd' => $pwdHash]);

echo json_encode(['ok' => true, 'email' => $email, 'temp_password' => $pwd, 'trainee_id' => $trow['id'] ?? null, 'user_id' => $id, 'message' => 'Trainee account created locally']);
