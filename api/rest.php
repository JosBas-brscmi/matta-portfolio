<?php

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

/*
 * --------------------------------------------------------------------------
 * Debug logging
 * --------------------------------------------------------------------------
 */

$rawBody = file_get_contents('php://input');

$raw = [
    'time' => date('c'),
    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'get' => $_GET,
    'headers' => function_exists('getallheaders')
        ? getallheaders()
        : [],
    'body' => $rawBody,
];

@file_put_contents(
    __DIR__ . '/last_request.log',
    json_encode($raw) . PHP_EOL,
    FILE_APPEND
);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$table = $_GET['table'] ?? null;

if (
    !$table ||
    !preg_match('/^[a-zA-Z0-9_]+$/', $table)
) {
    http_response_code(400);

    echo json_encode([
        'error' => 'Missing or invalid table name',
    ]);

    exit;
}

$pdo = get_db();


/*
 * --------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------
 */

function get_json_body(): array
{
    $raw = file_get_contents('php://input');

    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);

        echo json_encode([
            'error' => 'Invalid JSON body',
        ]);

        exit;
    }

    return $data;
}


function validate_column_name(string $column): bool
{
    return (bool) preg_match(
        '/^[a-zA-Z0-9_]+$/',
        $column
    );
}


/*
 * --------------------------------------------------------------------------
 * Main request
 * --------------------------------------------------------------------------
 */

try {

    /*
     * ======================================================================
     * GET
     * ======================================================================
     */

    if ($method === 'GET') {

        $select = $_GET['select'] ?? '*';


        /*
         * --------------------------------------------------------------
         * Special handling for portfolio_items -> portfolio_files
         * --------------------------------------------------------------
         */

        $isPortfolioNestedSelect =
            $table === 'portfolio_items' &&
            stripos($select, 'portfolio_files') !== false;

        $nestedFiles = [];


        if ($isPortfolioNestedSelect) {

            /*
             * Remove the nested portfolio_files(...) portion.
             *
             * Example:
             *
             * id,
             * title,
             * portfolio_files(id,file_name,storage_path)
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

            $select = rtrim(
                $select,
                " \t\n\r,"
            );

            if ($select === '') {
                $select = '*';
            }
        }


        /*
         * Basic protection for SELECT.
         */

        if (
            !preg_match(
                '/^[a-zA-Z0-9_"\'\s,.\*]+$/',
                $select
            )
        ) {
            http_response_code(400);

            echo json_encode([
                'error' => 'Invalid select parameter',
            ]);

            exit;
        }


        $sql =
            'SELECT ' .
            $select .
            ' FROM "public"."' .
            $table .
            '"';


        /*
         * WHERE eq_* filters
         */

        $where = [];

        $params = [];

        foreach ($_GET as $key => $value) {

            if (strpos($key, 'eq_') === 0) {

                $column = substr($key, 3);

                if (
                    validate_column_name($column)
                ) {

                    $placeholder =
                        ':eq_' . $column;

                    $where[] =
                        '"' .
                        $column .
                        '" = ' .
                        $placeholder;

                    $params[$placeholder] = $value;
                }
            }
        }


        if (!empty($where)) {

            $sql .=
                ' WHERE ' .
                implode(' AND ', $where);
        }


        /*
         * ORDER BY
         */

        if (!empty($_GET['order'])) {

            $order = preg_replace(
                '/[^a-zA-Z0-9_, ]/',
                '',
                $_GET['order']
            );

            if ($order !== '') {

                $sql .=
                    ' ORDER BY ' .
                    $order;
            }
        }


        $stmt = $pdo->prepare($sql);

        $stmt->execute($params);

        $rows = $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );


        /*
         * --------------------------------------------------------------
         * Load portfolio_files
         * --------------------------------------------------------------
         */

        if (
            $isPortfolioNestedSelect &&
            !empty($rows)
        ) {

            $portfolioItemIds =
                array_column(
                    $rows,
                    'id'
                );


            $placeholders = [];

            $fileParams = [];


            foreach (
                $portfolioItemIds
                as $index => $itemId
            ) {

                $placeholder =
                    ':portfolio_id_' .
                    $index;

                $placeholders[] =
                    $placeholder;

                $fileParams[$placeholder] =
                    $itemId;
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
                implode(
                    ',',
                    $placeholders
                ) .
                ')
                ORDER BY uploaded_at
            ';


            $fileStmt =
                $pdo->prepare($fileSql);


            foreach (
                $fileParams
                as $placeholder => $value
            ) {

                $fileStmt->bindValue(
                    $placeholder,
                    $value
                );
            }


            $fileStmt->execute();


            $files =
                $fileStmt->fetchAll(
                    PDO::FETCH_ASSOC
                );


            $filesByPortfolioItem = [];


            foreach ($files as $file) {

                $itemId =
                    $file['portfolio_item_id'];

                if (
                    !isset(
                        $filesByPortfolioItem[
                            $itemId
                        ]
                    )
                ) {

                    $filesByPortfolioItem[
                        $itemId
                    ] = [];
                }


                $filesByPortfolioItem[
                    $itemId
                ][] = $file;
            }


            foreach ($rows as &$row) {

                $itemId =
                    $row['id'];

                $row['portfolio_files'] =
                    $filesByPortfolioItem[
                        $itemId
                    ] ?? [];
            }

            unset($row);
        }


        /*
         * Return GET result.
         */

        if (!empty($_GET['single'])) {

            echo json_encode([
                'data' =>
                    $rows[0] ?? null,
            ]);

        } else {

            echo json_encode([
                'data' => $rows,
            ]);
        }

        exit;
    }


    /*
     * ======================================================================
     * POST
     * ======================================================================
     *
     * Used by:
     *
     * .from('table')
     * .insert(...)
     *
     */

    if ($method === 'POST') {

        $body = get_json_body();

        if (empty($body)) {

            http_response_code(400);

            echo json_encode([
                'error' => 'Empty request body',
            ]);

            exit;
        }


        $columns = [];

        $placeholders = [];

        $params = [];


        foreach ($body as $column => $value) {

            if (
                !validate_column_name($column)
            ) {
                continue;
            }


            $columns[] =
                '"' . $column . '"';

            $placeholder =
                ':insert_' .
                count($params);

            $placeholders[] =
                $placeholder;

            $params[$placeholder] =
                $value;
        }


        if (empty($columns)) {

            http_response_code(400);

            echo json_encode([
                'error' =>
                    'No valid columns supplied',
            ]);

            exit;
        }


        $sql =
            'INSERT INTO "public"."' .
            $table .
            '" (' .
            implode(',', $columns) .
            ') VALUES (' .
            implode(',', $placeholders) .
            ')';


        $stmt =
            $pdo->prepare($sql);

        $stmt->execute($params);


        /*
         * Try to return inserted row.
         *
         * PostgreSQL supports RETURNING.
         */

        $returningSql =
            $sql .
            ' RETURNING *';


        try {

            $returningStmt =
                $pdo->prepare(
                    $returningSql
                );

            $returningStmt->execute(
                $params
            );

            $inserted =
                $returningStmt->fetch(
                    PDO::FETCH_ASSOC
                );

        } catch (Exception $returnError) {

            $inserted = null;
        }


        echo json_encode([
            'data' =>
                $inserted,
        ]);

        exit;
    }


    /*
     * ======================================================================
     * PUT
     * ======================================================================
     *
     * Used by:
     *
     * .from('users_profile')
     * .update(...)
     * .eq('id', userId)
     *
     */

    if ($method === 'PUT') {

        $id = $_GET['id'] ?? null;

        if (!$id) {

            http_response_code(400);

            echo json_encode([
                'error' =>
                    'Missing id for update',
            ]);

            exit;
        }


        $body = get_json_body();


        if (empty($body)) {

            http_response_code(400);

            echo json_encode([
                'error' =>
                    'Empty update body',
            ]);

            exit;
        }


        $set = [];

        $params = [
            ':update_id' => $id,
        ];


        foreach ($body as $column => $value) {

            /*
             * Never allow an ID update.
             */

            if (
                $column === 'id'
            ) {
                continue;
            }


            if (
                !validate_column_name($column)
            ) {
                continue;
            }


            $placeholder =
                ':update_' .
                count($params);


            $set[] =
                '"' .
                $column .
                '" = ' .
                $placeholder;


            $params[$placeholder] =
                $value;
        }


        if (empty($set)) {

            http_response_code(400);

            echo json_encode([
                'error' =>
                    'No valid fields supplied for update',
            ]);

            exit;
        }


        $sql =
            'UPDATE "public"."' .
            $table .
            '" SET ' .
            implode(',', $set) .
            ' WHERE "id" = :update_id';


        $stmt =
            $pdo->prepare($sql);

        $stmt->execute($params);


        /*
         * Return updated row.
         */

        $selectSql =
            'SELECT * FROM "public"."' .
            $table .
            '" WHERE "id" = :select_id';


        $selectStmt =
            $pdo->prepare($selectSql);


        $selectStmt->execute([
            ':select_id' => $id,
        ]);


        $updated =
            $selectStmt->fetch(
                PDO::FETCH_ASSOC
            );


        echo json_encode([
            'data' =>
                $updated ?: null,
        ]);

        exit;
    }


    /*
     * ======================================================================
     * DELETE
     * ======================================================================
     *
     * Used by:
     *
     * .from('table')
     * .delete()
     * .eq('id', id)
     *
     */

    if ($method === 'DELETE') {

        $id = $_GET['id'] ?? null;

        if (!$id) {

            http_response_code(400);

            echo json_encode([
                'error' =>
                    'Missing id for delete',
            ]);

            exit;
        }


        $sql =
            'DELETE FROM "public"."' .
            $table .
            '" WHERE "id" = :delete_id';


        $stmt =
            $pdo->prepare($sql);


        $stmt->execute([
            ':delete_id' => $id,
        ]);


        echo json_encode([
            'data' => null,
        ]);

        exit;
    }


    /*
     * ======================================================================
     * Unsupported method
     * ======================================================================
     */

    http_response_code(405);

    echo json_encode([
        'error' => 'Method not allowed',
        'method' => $method,
    ]);

} catch (Throwable $e) {

    http_response_code(500);


    $log =
        '[' .
        date('c') .
        '] QUERY_ERROR: ' .
        $e->getMessage() .
        PHP_EOL;


    $log .=
        'METHOD: ' .
        $method .
        PHP_EOL;


    $log .=
        'GET: ' .
        json_encode($_GET) .
        PHP_EOL;


    $log .=
        'BODY: ' .
        $rawBody .
        PHP_EOL;


    $log .=
        $e->getTraceAsString() .
        PHP_EOL .
        str_repeat(
            '-',
            80
        ) .
        PHP_EOL;


    @file_put_contents(
        __DIR__ . '/error.log',
        $log,
        FILE_APPEND
    );


    echo json_encode([
        'error' =>
            'query_failed',

        'detail' =>
            $e->getMessage(),
    ]);
}