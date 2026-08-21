
<?php

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

/*
|--------------------------------------------------------------------------
| Debug logging
|--------------------------------------------------------------------------
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
    json_encode($raw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
    FILE_APPEND
);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

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

try {
    $pdo = get_db();

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    function json_response($data, int $status = 200): void
    {
        http_response_code($status);

        echo json_encode(
            $data,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES
        );

        exit;
    }


    function get_json_body(): array
    {
        $raw = file_get_contents('php://input');

        if ($raw === false || trim($raw) === '') {
            return [];
        }

        $data = json_decode($raw, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            json_response([
                'error' => 'Invalid JSON body',
                'detail' => json_last_error_msg(),
            ], 400);
        }

        if (!is_array($data)) {
            json_response([
                'error' => 'JSON body must be an object',
            ], 400);
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
    |--------------------------------------------------------------------------
    | GET
    |--------------------------------------------------------------------------
    */

    if ($method === 'GET') {

        $select = $_GET['select'] ?? '*';

        /*
        |--------------------------------------------------------------------------
        | Special handling for portfolio_items -> portfolio_files
        |--------------------------------------------------------------------------
        */

        $isPortfolioNestedSelect =
            $table === 'portfolio_items' &&
            stripos($select, 'portfolio_files') !== false;

        if ($isPortfolioNestedSelect) {

            $selectWithoutFiles = preg_replace(
                '/,\s*portfolio_files\s*\((.*?)\)/is',
                '',
                $select
            );

            if ($selectWithoutFiles !== null) {
                $select = trim($selectWithoutFiles);
            }

            $select = rtrim(
                $select,
                " \t\n\r,"
            );

            if ($select === '') {
                $select = '*';
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Validate SELECT
        |--------------------------------------------------------------------------
        */

        if (
            !preg_match(
                '/^[a-zA-Z0-9_"\'\s,.\*]+$/',
                $select
            )
        ) {
            json_response([
                'error' => 'Invalid select parameter',
            ], 400);
        }


        /*
        |--------------------------------------------------------------------------
        | Build SELECT
        |--------------------------------------------------------------------------
        */

        $sql =
            'SELECT ' .
            $select .
            ' FROM "public"."' .
            $table .
            '"';


        /*
        |--------------------------------------------------------------------------
        | WHERE eq_* filters
        |--------------------------------------------------------------------------
        */

        $where = [];

        $params = [];

        foreach ($_GET as $key => $value) {

            if (strpos($key, 'eq_') === 0) {

                $column = substr($key, 3);

                if (!validate_column_name($column)) {
                    continue;
                }

                $placeholder =
                    ':eq_' .
                    $column;

                $where[] =
                    '"' .
                    $column .
                    '" = ' .
                    $placeholder;

                $params[$placeholder] = $value;
            }
        }


        if (!empty($where)) {

            $sql .=
                ' WHERE ' .
                implode(' AND ', $where);
        }


        /*
        |--------------------------------------------------------------------------
        | ORDER BY
        |--------------------------------------------------------------------------
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


        /*
        |--------------------------------------------------------------------------
        | Execute SELECT
        |--------------------------------------------------------------------------
        */

        $stmt = $pdo->prepare($sql);

        $stmt->execute($params);

        $rows = $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );


        /*
        |--------------------------------------------------------------------------
        | Portfolio nested files
        |--------------------------------------------------------------------------
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


            if (!empty($placeholders)) {

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

                $fileStmt->execute(
                    $fileParams
                );


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
        }


        /*
        |--------------------------------------------------------------------------
        | GET response
        |--------------------------------------------------------------------------
        */

        if (!empty($_GET['single'])) {

            json_response([
                'data' =>
                    $rows[0] ?? null,
            ]);

        } else {

            json_response([
                'data' => $rows,
            ]);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | POST
    |--------------------------------------------------------------------------
    |
    | Used by:
    |
    | .from('table')
    | .insert(...)
    |
    */

    if ($method === 'POST') {

        $body = get_json_body();

        if (empty($body)) {

            json_response([
                'error' => 'Empty request body',
            ], 400);
        }


        $columns = [];

        $placeholders = [];

        $params = [];

        foreach ($body as $column => $value) {

            if (!validate_column_name($column)) {
                continue;
            }


            /*
             * Do not manually insert the ID when the database
             * provides a default UUID.
             *
             * If an ID was explicitly supplied, however,
             * allow it.
             */

            $columns[] =
                '"' .
                $column .
                '"';


            $placeholder =
                ':insert_' .
                count($params);


            $placeholders[] =
                $placeholder;


            $params[$placeholder] =
                $value;
        }


        if (empty($columns)) {

            json_response([
                'error' =>
                    'No valid columns supplied',
            ], 400);
        }


        /*
        |--------------------------------------------------------------------------
        | IMPORTANT:
        |
        | PostgreSQL supports RETURNING directly on the INSERT.
        |
        | We MUST NOT execute the INSERT twice.
        |--------------------------------------------------------------------------
        */

        $sql =
            'INSERT INTO "public"."' .
            $table .
            '" (' .
            implode(',', $columns) .
            ') VALUES (' .
            implode(',', $placeholders) .
            ') RETURNING *';


        /*
        |--------------------------------------------------------------------------
        | Execute INSERT ONCE
        |--------------------------------------------------------------------------
        */

        $stmt =
            $pdo->prepare($sql);


        $stmt->execute(
            $params
        );


        /*
        |--------------------------------------------------------------------------
        | Get inserted row
        |--------------------------------------------------------------------------
        */

        $inserted =
            $stmt->fetch(
                PDO::FETCH_ASSOC
            );


        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

        json_response([
            'data' =>
                $inserted ?: null,
        ], 201);
    }


    /*
    |--------------------------------------------------------------------------
    | PUT
    |--------------------------------------------------------------------------
    |
    | Used by:
    |
    | .from('users_profile')
    | .update(...)
    | .eq('id', userId)
    |
    */

    if ($method === 'PUT') {

        $id = $_GET['id'] ?? null;

        if (!$id) {

            json_response([
                'error' =>
                    'Missing id for update',
            ], 400);
        }


        $body = get_json_body();

        if (empty($body)) {

            json_response([
                'error' =>
                    'Empty update body',
            ], 400);
        }


        $set = [];

        $params = [
            ':update_id' => $id,
        ];


        foreach ($body as $column => $value) {

            /*
             * Never allow ID updates.
             */

            if ($column === 'id') {
                continue;
            }


            if (!validate_column_name($column)) {
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

            json_response([
                'error' =>
                    'No valid fields supplied for update',
            ], 400);
        }


        $sql =
            'UPDATE "public"."' .
            $table .
            '" SET ' .
            implode(',', $set) .
            ' WHERE "id" = :update_id ' .
            ' RETURNING *';


        $stmt =
            $pdo->prepare($sql);


        $stmt->execute(
            $params
        );


        $updated =
            $stmt->fetch(
                PDO::FETCH_ASSOC
            );


        json_response([
            'data' =>
                $updated ?: null,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | DELETE
    |--------------------------------------------------------------------------
    |
    | Used by:
    |
    | .from('table')
    | .delete()
    | .eq('id', id)
    |
    */

    if ($method === 'DELETE') {

        $id = $_GET['id'] ?? null;

        if (!$id) {

            json_response([
                'error' =>
                    'Missing id for delete',
            ], 400);
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


        json_response([
            'data' => null,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | Unsupported method
    |--------------------------------------------------------------------------
    */

    json_response([
        'error' => 'Method not allowed',
        'method' => $method,
    ], 405);


} catch (PDOException $e) {

    /*
    |--------------------------------------------------------------------------
    | PostgreSQL / PDO error
    |--------------------------------------------------------------------------
    */

    $log =
        '[' .
        date('c') .
        '] PDO_ERROR' .
        PHP_EOL;

    $log .=
        'MESSAGE: ' .
        $e->getMessage() .
        PHP_EOL;

    $log .=
        'CODE: ' .
        $e->getCode() .
        PHP_EOL;

    $log .=
        'METHOD: ' .
        $method .
        PHP_EOL;

    $log .=
        'TABLE: ' .
        $table .
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
        'TRACE: ' .
        $e->getTraceAsString() .
        PHP_EOL;

    $log .=
        str_repeat('-', 80) .
        PHP_EOL;


    @file_put_contents(
        __DIR__ . '/error.log',
        $log,
        FILE_APPEND
    );


    http_response_code(500);

    echo json_encode([
        'error' => 'query_failed',

        /*
         * This is useful while debugging your local server.
         */
        'detail' =>
            $e->getMessage(),
    ]);

    exit;


} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | General error
    |--------------------------------------------------------------------------
    */

    $log =
        '[' .
        date('c') .
        '] GENERAL_ERROR' .
        PHP_EOL;

    $log .=
        'MESSAGE: ' .
        $e->getMessage() .
        PHP_EOL;

    $log .=
        'METHOD: ' .
        $method .
        PHP_EOL;

    $log .=
        'TABLE: ' .
        $table .
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
        PHP_EOL;

    $log .=
        str_repeat('-', 80) .
        PHP_EOL;


    @file_put_contents(
        __DIR__ . '/error.log',
        $log,
        FILE_APPEND
    );


    http_response_code(500);

    echo json_encode([
        'error' => 'query_failed',
        'detail' => $e->getMessage(),
    ]);

    exit;
}

