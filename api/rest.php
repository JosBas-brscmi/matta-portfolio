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

        /*
     * ============================================================
     * Special handling for portfolio_items -> portfolio_files
     * ============================================================
     *
     * Supabase/PostgREST allowed:
     *
     * portfolio_files (
     *     id,
     *     portfolio_item_id,
     *     ...
     * )
     *
     * PostgreSQL itself does not understand that syntax.
     *
     * We therefore remove the nested relationship from the SQL
     * SELECT and load portfolio_files separately.
     */

        $isPortfolioNestedSelect =
            $table === 'portfolio_items' &&
            stripos($select, 'portfolio_files') !== false;

        $nestedFiles = [];

        if ($isPortfolioNestedSelect) {

            /*
         * Remove:
         *
         * portfolio_files (
         *     ...
         * )
         *
         * from the SELECT string.
         */

            $selectWithoutFiles = preg_replace(
                '/,\s*portfolio_files\s*\((.*?)\)/is',
                '',
                $select
            );

            if ($selectWithoutFiles === null) {
                $selectWithoutFiles = $select;
            }

            $select = trim($selectWithoutFiles);

            /*
         * Remove any trailing commas.
         */
            $select = rtrim($select, " \t\n\r,");

            /*
         * If the resulting SELECT is empty, use *.
         */
            if ($select === '') {
                $select = '*';
            }
        }

        /*
     * Basic protection against arbitrary SQL injection through
     * the SELECT parameter.
     *
     * Allow normal column names, commas, whitespace and quotes.
     */
        if (
            !preg_match(
                '/^[a-zA-Z0-9_"\'\s,.*]+$/',
                $select
            )
        ) {
            http_response_code(400);
            echo json_encode([
                'error' => 'Invalid select parameter'
            ]);
            exit;
        }

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

        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        if (!empty($_GET['order'])) {

            $order = preg_replace(
                '/[^a-zA-Z0-9_, ]/',
                '',
                $_GET['order']
            );

            if ($order !== '') {
                $sql .= ' ORDER BY ' . $order;
            }
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);


        /*
     * ============================================================
     * Load portfolio_files for portfolio_items
     * ============================================================
     */

        if ($isPortfolioNestedSelect && !empty($rows)) {

            $portfolioItemIds = array_column($rows, 'id');

            /*
         * Create placeholders for the IN query.
         */
            $placeholders = [];

            $fileParams = [];

            foreach ($portfolioItemIds as $index => $itemId) {

                $placeholder = ':portfolio_id_' . $index;

                $placeholders[] = $placeholder;
                $fileParams[$placeholder] = $itemId;
            }

            $fileSql = '
            SELECT
                id,
                portfolio_item_id,
                file_name,
                file_type,
                file_size_bytes,
                storage_path,
                uploaded_at
            FROM "public"."portfolio_files"
            WHERE portfolio_item_id IN (' .
                implode(',', $placeholders) .
                ')
            ORDER BY uploaded_at
        ';

            $fileStmt = $pdo->prepare($fileSql);

            foreach ($fileParams as $placeholder => $value) {
                $fileStmt->bindValue($placeholder, $value);
            }

            $fileStmt->execute();

            $files = $fileStmt->fetchAll(PDO::FETCH_ASSOC);


            /*
         * Group files by portfolio_item_id.
         */
            $filesByPortfolioItem = [];

            foreach ($files as $file) {

                $itemId = $file['portfolio_item_id'];

                if (!isset($filesByPortfolioItem[$itemId])) {
                    $filesByPortfolioItem[$itemId] = [];
                }

                $filesByPortfolioItem[$itemId][] = $file;
            }


            /*
         * Attach nested portfolio_files to each portfolio item.
         */
            foreach ($rows as &$row) {

                $itemId = $row['id'];

                $row['portfolio_files'] =
                    $filesByPortfolioItem[$itemId] ?? [];
            }

            unset($row);
        }


        /*
     * ============================================================
     * Return response
     * ============================================================
     */

        if (!empty($_GET['single'])) {

            echo json_encode([
                'data' => $rows[0] ?? null
            ]);
        } else {

            echo json_encode([
                'data' => $rows
            ]);
        }

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
