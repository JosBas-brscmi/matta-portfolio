
<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

/*
|--------------------------------------------------------------------------
| Request information
|--------------------------------------------------------------------------
*/

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$table  = $_GET['table'] ?? null;

$rawBody = file_get_contents('php://input');

if ($rawBody === false) {
    $rawBody = '';
}

/*
|--------------------------------------------------------------------------
| Debug request logging
|--------------------------------------------------------------------------
*/

$raw = [
    'time'    => date('c'),
    'method'  => $method,
    'get'     => $_GET,
    'headers' => function_exists('getallheaders')
        ? getallheaders()
        : [],
    'body'    => $rawBody,
];

@file_put_contents(
    __DIR__ . '/last_request.log',
    json_encode(
        $raw,
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    ) . PHP_EOL,
    FILE_APPEND
);

/*
|--------------------------------------------------------------------------
| Validate table name
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function json_response(
    mixed $data,
    int $status = 200
): never {

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
            'error'  => 'Invalid JSON body',
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
| Validate a table against PostgreSQL
|--------------------------------------------------------------------------
|
| This prevents arbitrary table access and also gives a clearer error
| if the requested table does not exist.
|
*/

function table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare("
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = :table
        )
    ");

    $stmt->execute([
        ':table' => $table,
    ]);

    return (bool) $stmt->fetchColumn();
}


/*
|--------------------------------------------------------------------------
| Quote a PostgreSQL identifier
|--------------------------------------------------------------------------
*/

function quote_identifier(string $identifier): string
{
    if (!validate_column_name($identifier)) {
        throw new RuntimeException(
            "Invalid column name: {$identifier}"
        );
    }

    return '"' . $identifier . '"';
}


/*
|--------------------------------------------------------------------------
| Parse Supabase-style order parameter
|--------------------------------------------------------------------------
|
| Frontend sends:
|
| order=assessment_date.desc
|
| Supabase-style syntax:
|
| column.asc
| column.desc
|
| We convert that to:
|
| ORDER BY "column" ASC
| ORDER BY "column" DESC
|
*/

function build_order_by(string $order): string
{
    $parts = array_filter(
        array_map(
            'trim',
            explode(',', $order)
        )
    );

    $orders = [];

    foreach ($parts as $part) {

        if ($part === '') {
            continue;
        }

        $pieces = array_map(
            'trim',
            explode('.', $part)
        );

        $column = $pieces[0] ?? '';

        if (!validate_column_name($column)) {
            throw new RuntimeException(
                "Invalid order column: {$column}"
            );
        }

        $direction = 'ASC';

        if (isset($pieces[1])) {

            $requestedDirection =
                strtolower($pieces[1]);

            if (
                $requestedDirection === 'desc'
            ) {
                $direction = 'DESC';

            } elseif (
                $requestedDirection === 'asc'
            ) {
                $direction = 'ASC';

            } else {
                throw new RuntimeException(
                    "Invalid order direction: {$requestedDirection}"
                );
            }
        }

        $orders[] =
            quote_identifier($column) .
            ' ' .
            $direction;
    }

    if (empty($orders)) {
        return '';
    }

    return ' ORDER BY ' .
        implode(', ', $orders);
}


/*
|--------------------------------------------------------------------------
| Remove nested portfolio_files(...) from SELECT
|--------------------------------------------------------------------------
*/

function remove_portfolio_files_select(
    string $select
): string {

    /*
     * Handles:
     *
     * portfolio_files (
     *     id,
     *     portfolio_item_id,
     *     file_name,
     *     ...
     * )
     */

    $pattern =
        '/,\s*portfolio_files\s*\((?:[^()]|\([^()]*\))*\)/is';

    $result = preg_replace(
        $pattern,
        '',
        $select
    );

    if ($result === null) {
        return $select;
    }

    $result = trim($result);

    $result = rtrim(
        $result,
        " \t\n\r,"
    );

    return $result !== ''
        ? $result
        : '*';
}


/*
|--------------------------------------------------------------------------
| Validate SELECT
|--------------------------------------------------------------------------
|
| Supports ordinary column lists such as:
|
| id, trainee_id, title, created_at
|
| and aliases containing ':' used by Supabase-style selects.
|
*/

function validate_select_string(
    string $select
): bool {

    return (bool) preg_match(
        '/^[a-zA-Z0-9_"\'\s,.*:]+$/',
        $select
    );
}


/*
|--------------------------------------------------------------------------
| Database connection
|--------------------------------------------------------------------------
*/

try {

    $pdo = get_db();

    if (!table_exists($pdo, $table)) {

        json_response([
            'error'  => 'Table does not exist',
            'table'  => $table,
        ], 404);
    }


    /*
    |--------------------------------------------------------------------------
    | GET
    |--------------------------------------------------------------------------
    */

    if ($method === 'GET') {

        $select =
            $_GET['select'] ?? '*';

        /*
         * portfolio_items can request:
         *
         * portfolio_files (...)
         *
         * This is not native SQL in our REST endpoint, so remove it
         * from the main SELECT and load the files separately.
         */

        $isPortfolioNestedSelect =
            $table === 'portfolio_items' &&
            stripos(
                $select,
                'portfolio_files'
            ) !== false;

        if ($isPortfolioNestedSelect) {

            $select =
                remove_portfolio_files_select(
                    $select
                );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate SELECT
        |--------------------------------------------------------------------------
        */

        if (
            !validate_select_string(
                $select
            )
        ) {

            json_response([
                'error' =>
                    'Invalid select parameter',
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
            ' FROM "public".' .
            quote_identifier($table);


        /*
        |--------------------------------------------------------------------------
        | WHERE filters
        |--------------------------------------------------------------------------
        */

        $where = [];

        $params = [];

        foreach (
            $_GET as $key => $value
        ) {

            /*
             * Equality:
             *
             * eq_trainee_id=UUID
             */

            if (
                str_starts_with(
                    $key,
                    'eq_'
                )
            ) {

                $column =
                    substr($key, 3);

                if (
                    !validate_column_name(
                        $column
                    )
                ) {
                    continue;
                }

                $placeholder =
                    ':eq_' .
                    count($params);

                $where[] =
                    quote_identifier(
                        $column
                    ) .
                    ' = ' .
                    $placeholder;

                $params[$placeholder] =
                    $value;
            }


            /*
             * IN:
             *
             * in_trainee_id=["uuid1","uuid2"]
             */

            if (
                str_starts_with(
                    $key,
                    'in_'
                )
            ) {

                $column =
                    substr($key, 3);

                if (
                    !validate_column_name(
                        $column
                    )
                ) {
                    continue;
                }

                $values =
                    json_decode(
                        (string) $value,
                        true
                    );

                if (
                    !is_array($values) ||
                    empty($values)
                ) {
                    continue;
                }

                $inPlaceholders = [];

                foreach (
                    $values as $index => $inValue
                ) {

                    $placeholder =
                        ':in_' .
                        count($params);

                    $inPlaceholders[] =
                        $placeholder;

                    $params[$placeholder] =
                        $inValue;
                }

                $where[] =
                    quote_identifier(
                        $column
                    ) .
                    ' IN (' .
                    implode(
                        ', ',
                        $inPlaceholders
                    ) .
                    ')';
            }
        }


        if (!empty($where)) {

            $sql .=
                ' WHERE ' .
                implode(
                    ' AND ',
                    $where
                );
        }


        /*
        |--------------------------------------------------------------------------
        | ORDER BY
        |--------------------------------------------------------------------------
        */

        if (
            !empty($_GET['order'])
        ) {

            $sql .= build_order_by(
                (string) $_GET['order']
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Execute SELECT
        |--------------------------------------------------------------------------
        */

        $stmt =
            $pdo->prepare($sql);

        $stmt->execute(
            $params
        );

        $rows =
            $stmt->fetchAll(
                PDO::FETCH_ASSOC
            );


        /*
        |--------------------------------------------------------------------------
        | portfolio_files nested data
        |--------------------------------------------------------------------------
        */

        if (
            $isPortfolioNestedSelect &&
            !empty($rows)
        ) {

            $portfolioItemIds =
                array_values(
                    array_filter(
                        array_column(
                            $rows,
                            'id'
                        )
                    )
                );


            if (
                !empty(
                    $portfolioItemIds
                )
            ) {

                $filePlaceholders = [];

                $fileParams = [];

                foreach (
                    $portfolioItemIds
                    as $index => $itemId
                ) {

                    $placeholder =
                        ':portfolio_file_' .
                        $index;

                    $filePlaceholders[] =
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
                    WHERE portfolio_item_id IN (
                        ' .
                        implode(
                            ', ',
                            $filePlaceholders
                        ) .
                        '
                    )
                    ORDER BY uploaded_at ASC
                ';


                $fileStmt =
                    $pdo->prepare(
                        $fileSql
                    );

                $fileStmt->execute(
                    $fileParams
                );


                $files =
                    $fileStmt->fetchAll(
                        PDO::FETCH_ASSOC
                    );


                $filesByItem = [];


                foreach (
                    $files as $file
                ) {

                    $itemId =
                        $file[
                            'portfolio_item_id'
                        ];

                    if (
                        !isset(
                            $filesByItem[
                                $itemId
                            ]
                        )
                    ) {

                        $filesByItem[
                            $itemId
                        ] = [];
                    }

                    $filesByItem[
                        $itemId
                    ][] = $file;
                }


                foreach (
                    $rows as &$row
                ) {

                    $itemId =
                        $row['id'] ?? null;

                    $row[
                        'portfolio_files'
                    ] =
                        $filesByItem[
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

        json_response([
            'data' => $rows,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | POST
    |--------------------------------------------------------------------------
    |
    | INSERT
    |--------------------------------------------------------------------------
    */

    if ($method === 'POST') {

        $body =
            get_json_body();

        if (empty($body)) {

            json_response([
                'error' =>
                    'Empty request body',
            ], 400);
        }


        $columns = [];

        $placeholders = [];

        $params = [];

        foreach (
            $body as $column => $value
        ) {

            if (
                !validate_column_name(
                    (string) $column
                )
            ) {
                continue;
            }

            $columns[] =
                quote_identifier(
                    (string) $column
                );

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


        $sql =
            'INSERT INTO "public".' .
            quote_identifier($table) .
            ' (' .
            implode(
                ', ',
                $columns
            ) .
            ') VALUES (' .
            implode(
                ', ',
                $placeholders
            ) .
            ') RETURNING *';


        $stmt =
            $pdo->prepare($sql);

        $stmt->execute(
            $params
        );


        $inserted =
            $stmt->fetch(
                PDO::FETCH_ASSOC
            );


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
    | UPDATE
    |--------------------------------------------------------------------------
    */

    if ($method === 'PUT') {

        $id =
            $_GET['id'] ?? null;

        if (!$id) {

            json_response([
                'error' =>
                    'Missing id for update',
            ], 400);
        }


        $body =
            get_json_body();

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


        foreach (
            $body as $column => $value
        ) {

            /*
             * Never allow primary-key modification.
             */

            if (
                $column === 'id'
            ) {
                continue;
            }

            if (
                !validate_column_name(
                    (string) $column
                )
            ) {
                continue;
            }


            $placeholder =
                ':update_' .
                count($params);


            $set[] =
                quote_identifier(
                    (string) $column
                ) .
                ' = ' .
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
            'UPDATE "public".' .
            quote_identifier($table) .
            ' SET ' .
            implode(
                ', ',
                $set
            ) .
            ' WHERE "id" = :update_id
              RETURNING *';


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
    */

    if ($method === 'DELETE') {

        $id =
            $_GET['id'] ?? null;

        if (!$id) {

            json_response([
                'error' =>
                    'Missing id for delete',
            ], 400);
        }


        $sql =
            'DELETE FROM "public".' .
            quote_identifier($table) .
            ' WHERE "id" = :delete_id';


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
    | Unsupported HTTP method
    |--------------------------------------------------------------------------
    */

    json_response([
        'error' =>
            'Method not allowed',
        'method' =>
            $method,
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


    http_response_code(500);

    echo json_encode([
        'error' =>
            'query_failed',

        'detail' =>
            $e->getMessage(),

        'table' =>
            $table,
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
        'TRACE: ' .
        $e->getTraceAsString() .
        PHP_EOL;

    $log .=
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


    http_response_code(500);

    echo json_encode([
        'error' =>
            'query_failed',

        'detail' =>
            $e->getMessage(),

        'table' =>
            $table,
    ]);

    exit;
}

