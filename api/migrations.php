<?php
/**
 * Migrations API – run database migrations (admin only for run)
 */
ob_start();
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');

require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../includes/utils.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../includes/migration_runner.php';

ob_end_clean();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'run') {
    if (!isAuthenticated()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authentication required']);
        exit;
    }
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Admin privileges required']);
        exit;
    }
}

if (!isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$action = $_GET['action'] ?? '';

try {
    $dbPath = getDatabasePath();
    $dbDir = dirname($dbPath);
    if (!is_dir($dbDir)) {
        @mkdir($dbDir, 0755, true);
    }
    $db = new SQLite3($dbPath);
    $db->exec('PRAGMA foreign_keys = ON');
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    $files = getMigrationFiles();
    $executed = getExecutedMigrations($db);
    $migrations = [];
    foreach ($files as $file) {
        $isExecuted = in_array($file['name'], $executed);
        $migrations[] = [
            'number' => $file['number'],
            'name' => $file['name'],
            'filename' => $file['filename'],
            'executed' => $isExecuted
        ];
    }
    echo json_encode(['success' => true, 'data' => ['migrations' => $migrations]]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'run') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $token = $data['csrf_token'] ?? '';
    if (!validateCSRFToken($token)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'CSRF token validation failed']);
        exit;
    }
    $migrationName = $data['migration_name'] ?? '';
    if ($migrationName === '' || preg_match('/[^a-zA-Z0-9_]/', $migrationName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid migration name']);
        exit;
    }
    $files = getMigrationFiles();
    $migrationFile = null;
    foreach ($files as $f) {
        if ($f['name'] === $migrationName) {
            $migrationFile = $f;
            break;
        }
    }
    if (!$migrationFile) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Migration not found']);
        exit;
    }
    ob_start();
    try {
        $result = runMigration($db, $migrationFile['path'], $migrationName, 'user');
    } catch (Throwable $e) {
        $result = ['success' => false, 'error' => $e->getMessage()];
    }
    ob_end_clean();
    if ($result['success']) {
        echo json_encode([
            'success' => true,
            'message' => 'Migration erfolgreich ausgeführt',
            'execution_time_ms' => $result['execution_time_ms']
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $result['error']]);
    }
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Invalid action. Use ?action=list or POST ?action=run']);
