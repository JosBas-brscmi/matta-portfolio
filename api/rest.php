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

/*
|--------------------------------------------------------------------------
| Validate table name
|--------------------------------------------------------------------------
*/

if (
    !is_string($table) ||
    $table === '' ||
    !preg_match('/^[a-zA-Z0-9_]+$/', $table)
) {
    http_response_code(400);

    echo json_encode([
        'error' => 'Missing or invalid table name',
    ]);

    exit;
}

if (!in_array($table, ['users_profile', 'trainees'], true)) {
    http_response_code(404);
    echo json_encode(['error' => 'Table not available']);
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

    session_start();
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        json_response(['error' => 'unauthorized'], 401);
    }

    $pdo = get_db();
    $callerStmt = $pdo->prepare(
        'SELECT role FROM public.users_profile WHERE id = :id LIMIT 1'
    );
    $callerStmt->execute([':id' => $userId]);
    $caller = $callerStmt->fetch(PDO::FETCH_ASSOC);
    if (!$caller) {
        json_response(['error' => 'unauthorized'], 401);
    }

    $isAdmin = in_array($caller['role'], ['owner', 'ma_center'], true);
    $isRead = $method === 'GET';
    $isOwnTraineeCreate = $table === 'trainees' && $method === 'POST';
    $isUpdate = $method === 'PUT';

    if (
        !$isRead &&
        !$isOwnTraineeCreate &&
        !$isUpdate
    ) {
        json_response(['error' => 'method_not_allowed'], 405);
    }

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
        if (!is_string($select)) {
            json_response(['error' => 'Invalid select parameter'], 400);
        }

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


        if ($table === 'users_profile' && !$isAdmin) {
            $where[] = '"id" = :auth_user_id';
            $params[':auth_user_id'] = $userId;
        } elseif ($table === 'trainees' && !$isAdmin) {
            $where[] = '"user_id" = :auth_user_id';
            $params[':auth_user_id'] = $userId;
        }

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
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

        $allowedInsertFields = [
            'employee_id',
            'batch_code',
            'education',
            'onboard_date',
        ];
        if (
            isset($body['user_id']) &&
            $body['user_id'] !== $userId
        ) {
            json_response(['error' => 'forbidden'], 403);
        }
        unset($body['user_id']);
        if (
            $table !== 'trainees' ||
            array_diff(array_keys($body), $allowedInsertFields) !== []
        ) {
            json_response(['error' => 'invalid_fields'], 400);
        }
        if ($caller['role'] !== 'mt') {
            json_response(['error' => 'forbidden'], 403);
        }
        foreach (['employee_id', 'batch_code', 'onboard_date'] as $requiredField) {
            if (!isset($body[$requiredField]) || !is_string($body[$requiredField]) || trim($body[$requiredField]) === '') {
                json_response(['error' => 'invalid_fields'], 400);
            }
        }
        if (
            strlen($body['employee_id']) > 100 ||
            strlen($body['batch_code']) > 100 ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $body['onboard_date']) ||
            !checkdate(
                (int) substr($body['onboard_date'], 5, 2),
                (int) substr($body['onboard_date'], 8, 2),
                (int) substr($body['onboard_date'], 0, 4)
            ) ||
            (isset($body['education']) &&
                $body['education'] !== null &&
                (!is_string($body['education']) || strlen($body['education']) > 10000))
        ) {
            json_response(['error' => 'invalid_fields'], 400);
        }
        $existingTrainee = $pdo->prepare(
            'SELECT 1 FROM public.trainees WHERE user_id = :user_id LIMIT 1'
        );
        $existingTrainee->execute([':user_id' => $userId]);
        if ($existingTrainee->fetchColumn()) {
            json_response(['error' => 'trainee_already_exists'], 409);
        }
        $body['user_id'] = $userId;

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

        if (!is_string($id) || $id === '') {

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

        $isOwnUserProfile = $table === 'users_profile' && !$isAdmin;
        $allowedUpdateFields = $table === 'users_profile'
            ? ($isAdmin
                ? ['role', 'department', 'status']
                : ['full_name', 'phone', 'bio', 'avatar_path'])
            : ($isAdmin
                ? ['mentor_id', 'department']
                : ['education', 'profile_completeness']);
        if (array_diff(array_keys($body), $allowedUpdateFields) !== []) {
            json_response(['error' => 'invalid_fields'], 400);
        }
        if (
            $table === 'users_profile' &&
            array_key_exists('role', $body) &&
            $caller['role'] === 'ma_center' &&
            in_array($body['role'], ['owner', 'ma_center'], true)
        ) {
            json_response(['error' => 'forbidden'], 403);
        }
        if ($table === 'users_profile') {
            if (
                array_key_exists('role', $body) &&
                (!is_string($body['role']) ||
                    !in_array($body['role'], ['mt', 'mentor', 'manager', 'ma_center', 'ma_board', 'owner'], true))
            ) {
                json_response(['error' => 'invalid_role'], 400);
            }
            if (
                array_key_exists('status', $body) &&
                (!is_string($body['status']) || !in_array($body['status'], ['active', 'inactive'], true))
            ) {
                json_response(['error' => 'invalid_status'], 400);
            }
            if (
                array_key_exists('department', $body) &&
                $body['department'] !== null &&
                (!is_string($body['department']) || strlen($body['department']) > 200)
            ) {
                json_response(['error' => 'invalid_department'], 400);
            }
            if (
                array_key_exists('full_name', $body) &&
                (!is_string($body['full_name']) || trim($body['full_name']) === '' || strlen($body['full_name']) > 200)
            ) {
                json_response(['error' => 'invalid_full_name'], 400);
            }
            if (
                array_key_exists('role', $body) &&
                $caller['role'] === 'ma_center'
            ) {
                $targetRoleStmt = $pdo->prepare(
                    'SELECT role FROM public.users_profile WHERE id = :id LIMIT 1'
                );
                $targetRoleStmt->execute([':id' => $id]);
                $targetRole = $targetRoleStmt->fetchColumn();
                if (
                    !$targetRole ||
                    in_array($targetRole, ['owner', 'ma_center'], true) ||
                    in_array($body['role'], ['owner', 'ma_center'], true)
                ) {
                    json_response(['error' => 'forbidden'], 403);
                }
            }
            foreach (['phone' => 100, 'bio' => 10000, 'avatar_path' => 1000] as $field => $maxLength) {
                if (
                    array_key_exists($field, $body) &&
                    $body[$field] !== null &&
                    (!is_string($body[$field]) || strlen($body[$field]) > $maxLength)
                ) {
                    json_response(['error' => 'invalid_profile_field'], 400);
                }
            }
        } elseif ($isAdmin) {
            if (
                array_key_exists('department', $body) &&
                $body['department'] !== null &&
                (!is_string($body['department']) || strlen($body['department']) > 200)
            ) {
                json_response(['error' => 'invalid_department'], 400);
            }
            if (
                array_key_exists('mentor_id', $body) &&
                $body['mentor_id'] !== null &&
                (!is_string($body['mentor_id']) ||
                    !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $body['mentor_id']))
            ) {
                json_response(['error' => 'invalid_mentor_id'], 400);
            }
        } else {
            if (
                array_key_exists('education', $body) &&
                $body['education'] !== null &&
                (!is_string($body['education']) || strlen($body['education']) > 10000)
            ) {
                json_response(['error' => 'invalid_education'], 400);
            }
            if (
                array_key_exists('profile_completeness', $body) &&
                (!is_numeric($body['profile_completeness']) ||
                    (float) $body['profile_completeness'] < 0 ||
                    (float) $body['profile_completeness'] > 100)
            ) {
                json_response(['error' => 'invalid_profile_completeness'], 400);
            }
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
            ' WHERE "id" = :update_id';

        if ($isOwnUserProfile) {
            $sql .= ' AND "id" = :auth_user_id';
            $params[':auth_user_id'] = $userId;
        } elseif ($table === 'trainees' && !$isAdmin) {
            $sql .= ' AND "user_id" = :auth_user_id';
            $params[':auth_user_id'] = $userId;
        }
        $sql .= ' RETURNING *';

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

    error_log('[rest] Database request failed: ' . $e->getMessage());

    http_response_code(500);

    echo json_encode([
        'error' => 'query_failed',
    ]);

    exit;


} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | General error
    |--------------------------------------------------------------------------
    */

    error_log('[rest] Request failed: ' . $e->getMessage());

    http_response_code(500);

    echo json_encode([
        'error' => 'request_failed',
    ]);

    exit;
}
