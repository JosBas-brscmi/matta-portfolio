<?php

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

session_start();

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    $pdo = get_db();

    $userId = $_SESSION['user_id'] ?? null;

    if (!$userId) {
        json_response([
            'error' => 'Not signed in'
        ], 401);
    }

    /*
     * Determine the logged-in user's role and department.
     */
    $stmt = $pdo->prepare("
        SELECT role, department
        FROM public.users_profile
        WHERE id = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $caller = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$caller) {
        json_response([
            'error' => 'User not found'
        ], 404);
    }

    $role = $caller['role'];
    $department = $caller['department'];

    /*
     * Only these roles may access the review queue.
     *
     * owner      -> all
     * ma_center  -> all
     * ma_board   -> all
     * mentor     -> assigned trainees
     * manager    -> trainees in their department
     */
    $allowedRoles = [
        'owner',
        'ma_center',
        'ma_board',
        'mentor',
        'manager'
    ];

    if (!in_array($role, $allowedRoles, true)) {
        json_response([
            'error' => 'Forbidden'
        ], 403);
    }

    /*
     * Build the visibility condition.
     */
    $conditions = [];
    $params = [];

    if (in_array($role, ['owner', 'ma_center', 'ma_board'], true)) {

        /*
         * These roles can see every portfolio item.
         */
        $conditions[] = '1 = 1';

    } elseif ($role === 'mentor') {

        /*
         * Mentors can only see items belonging to trainees
         * assigned to that mentor.
         */
        $conditions[] = 't.mentor_id = :mentor_id';
        $params[':mentor_id'] = $userId;

    } elseif ($role === 'manager') {

        /*
         * Managers can only see items from their department.
         */
        $conditions[] = 't.department = :department';
        $params[':department'] = $department;
    }

    $visibilityWhere = implode(' AND ', $conditions);

    /*
     * PostgreSQL builds the nested structure expected by:
     *
     * interface ReviewQueueItem extends PortfolioItem {
     *   trainee: {
     *     ...
     *     users_profile: {
     *       full_name: string
     *       email: string
     *     }
     *   }
     * }
     *
     * and:
     *
     * portfolio_files: PortfolioFile[]
     */
    $sql = "
        SELECT
            pi.id,
            pi.trainee_id,
            pi.course_id,
            pi.assessment_id,
            pi.title,
            pi.description,
            pi.category,
            pi.status,
            pi.review_note,
            pi.reviewed_at,
            pi.reviewed_by,
            pi.submitted_at,
            pi.created_at,
            pi.updated_at,

            CASE
                WHEN t.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                    'id', t.id,
                    'employee_id', t.employee_id,
                    'batch_code', t.batch_code,
                    'department', t.department,
                    'users_profile',
                        CASE
                            WHEN up.id IS NULL THEN NULL
                            ELSE jsonb_build_object(
                                'full_name', up.full_name,
                                'email', up.email
                            )
                        END
                )
            END AS trainee,

            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', pf.id,
                            'portfolio_item_id', pf.portfolio_item_id,
                            'file_name', pf.file_name,
                            'file_type', pf.file_type,
                            'file_size_bytes', pf.file_size_bytes,
                            'storage_path', pf.storage_path,
                            'uploaded_at', pf.uploaded_at
                        )
                        ORDER BY pf.uploaded_at ASC
                    )
                    FROM public.portfolio_files pf
                    WHERE pf.portfolio_item_id = pi.id
                ),
                '[]'::jsonb
            ) AS portfolio_files

        FROM public.portfolio_items pi

        LEFT JOIN public.trainees t
            ON t.id = pi.trainee_id

        LEFT JOIN public.users_profile up
            ON up.id = t.user_id

        WHERE {$visibilityWhere}

        ORDER BY
            CASE
                WHEN pi.status = 'pending' THEN 0
                WHEN pi.status = 'returned' THEN 1
                WHEN pi.status = 'approved' THEN 2
                ELSE 3
            END,
            pi.submitted_at ASC NULLS LAST
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $items = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

        $portfolioFiles = $row['portfolio_files'];

        if (is_string($portfolioFiles)) {
            $portfolioFiles = json_decode($portfolioFiles, true);
        }

        if (!is_array($portfolioFiles)) {
            $portfolioFiles = [];
        }

        $trainee = $row['trainee'];

        if (is_string($trainee)) {
            $trainee = json_decode($trainee, true);
        }

        if (!is_array($trainee)) {
            $trainee = null;
        }

        $items[] = [
            'id' => $row['id'],
            'trainee_id' => $row['trainee_id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'category' => $row['category'],
            'status' => $row['status'],
            'review_note' => $row['review_note'],
            'reviewed_at' => $row['reviewed_at'],
            'submitted_at' => $row['submitted_at'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'portfolio_files' => $portfolioFiles,
            'trainee' => $trainee,
        ];
    }

    json_response([
        'items' => $items
    ]);

} catch (Throwable $e) {

    error_log(
        '[list_review_queue] ' .
        $e->getMessage()
    );

    json_response([
        'error' => 'query_failed',
        'detail' => $e->getMessage()
    ], 500);
}