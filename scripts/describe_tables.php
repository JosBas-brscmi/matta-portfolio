<?php
require __DIR__ . '/../api/config.php';
$pdo = get_db();
$tables = ['users_profile','trainees'];
foreach ($tables as $table) {
    echo "TABLE: $table\n";
    $stmt = $pdo->prepare("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name = :t ORDER BY ordinal_position");
    $stmt->execute([':t'=>$table]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo sprintf("%s | %s | %s | %s\n", $row['column_name'], $row['data_type'], $row['is_nullable'], $row['column_default'] ?? 'NULL');
    }
    echo "\n";
}
