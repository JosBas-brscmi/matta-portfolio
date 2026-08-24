<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config.php';
session_start();

$pdo = get_db();

// Ensure local_auth table exists (simple password storage for local dev)
$pdo->exec("CREATE TABLE IF NOT EXISTS public.local_auth (
  user_id uuid PRIMARY KEY,
  password_hash text NOT NULL
)");

$inputBody = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? ($_POST['action'] ?? ($inputBody['action'] ?? null));

function json($v)
{
    echo json_encode($v);
    exit;
}

try {
    if ($action === 'signup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = $inputBody;
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $full_name = trim($body['full_name'] ?? '');
        if (!$email || !$password || !$full_name) {
            http_response_code(400);
            json(['error' => 'missing_fields']);
        }

        // check existing
        $stmt = $pdo->prepare('SELECT id FROM public.users_profile WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            http_response_code(409);
            json(['error' => 'email_exists']);
        }

        // create user profile row
        $id = bin2hex(random_bytes(16));
        $now = (new DateTime('now'))->format('Y-m-d H:i:s.uP');
        $ins = $pdo->prepare('INSERT INTO public.users_profile (id,email,full_name,role,department,status,created_at,updated_at) VALUES (:id,:email,:full_name,:role,:department,:status,:created_at,:updated_at)');
        $ins->execute([':id' => $id, ':email' => $email, ':full_name' => $full_name, ':role' => 'mt', ':department' => null, ':status' => 'active', ':created_at' => $now, ':updated_at' => $now]);

        $pwdHash = password_hash($password, PASSWORD_DEFAULT);
        $up = $pdo->prepare('INSERT INTO public.local_auth (user_id,password_hash) VALUES (:user_id,:pwd)');
        $up->execute([':user_id' => $id, ':pwd' => $pwdHash]);

        // set session
        $_SESSION['user_id'] = $id;
        $userObj = ['id' => $id, 'email' => $email, 'full_name' => $full_name];
        // Return a Supabase-like shape: { data: { user, session } }
        json(['data' => ['user' => $userObj, 'session' => ['user' => $userObj, 'access_token' => 'local']]]);
    }

    if ($action === 'signin' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = $inputBody;
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        if (!$email || !$password) {
            http_response_code(400);
            json(['error' => 'missing_fields']);
        }

        $stmt = $pdo->prepare('SELECT p.id, p.email, p.full_name, a.password_hash FROM public.users_profile p JOIN public.local_auth a ON a.user_id = p.id WHERE p.email = :email');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || !password_verify($password, $row['password_hash'])) {
            http_response_code(401);
            json(['error' => 'invalid_credentials']);
        }

        $_SESSION['user_id'] = $row['id'];
        unset($row['password_hash']);
        $userObj = ['id' => $row['id'], 'email' => $row['email'], 'full_name' => $row['full_name']];
        json(['data' => ['user' => $userObj, 'session' => ['user' => $userObj, 'access_token' => 'local']]]);
    }

    if ($action === 'signout') {
        session_destroy();
        json(['ok' => true]);
    }

    if ($action === 'getSession' || $action === 'getUser') {
        $uid = $_SESSION['user_id'] ?? null;
        if (!$uid) json(['data' => ['session' => null]]);
        $stmt = $pdo->prepare('SELECT id,email,full_name,role,department,status,avatar_path,phone,bio FROM public.users_profile WHERE id = :id');
        $stmt->execute([':id' => $uid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $userObj = $row ?? null;
        json(['data' => ['session' => ['user' => $userObj], 'user' => $userObj]]);
    }

    // Update password handler
    if (($action === 'update-password' || $action === 'update_password' || $action === 'change-password') && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $uid = $_SESSION['user_id'] ?? null;
        if (!$uid) {
            http_response_code(401);
            json(['error' => 'unauthorized', 'message' => 'Session expired. Please sign in again.']);
        }

        $body = $inputBody;
        $password = $body['password'] ?? ($body['new_password'] ?? '');

        if (!$password || strlen($password) < 8) {
            http_response_code(400);
            json(['error' => 'password_too_short', 'message' => 'Password must be at least 8 characters.']);
        }

        $pwdHash = password_hash($password, PASSWORD_DEFAULT);

        // Update local_auth table
        $up = $pdo->prepare('UPDATE public.local_auth SET password_hash = :pwd WHERE user_id = :user_id');
        $up->execute([':pwd' => $pwdHash, ':user_id' => $uid]);

        // Update updated_at timestamp in users_profile
        $now = (new DateTime('now'))->format('Y-m-d H:i:s.uP');
        $upProfile = $pdo->prepare('UPDATE public.users_profile SET updated_at = :updated_at WHERE id = :id');
        $upProfile->execute([':updated_at' => $now, ':id' => $uid]);

        json(['ok' => true, 'message' => 'Password changed successfully.']);
    }

    // default
    http_response_code(400);
    json(['error' => 'unknown_action']);
} catch (Exception $e) {
    http_response_code(500);
    json(['error' => 'server_error', 'detail' => $e->getMessage()]);
}