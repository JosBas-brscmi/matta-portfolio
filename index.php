<?php
$buildPath = __DIR__ . '/dist/index.html';
if (file_exists($buildPath)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($buildPath);
    exit;
}
http_response_code(500);
echo 'Build output not found. Run `npm run build` in the project root.';
