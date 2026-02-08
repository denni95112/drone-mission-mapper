<?php
/**
 * Updater API – check and perform updates (admin only)
 */

ob_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$configFile = __DIR__ . '/../config/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Configuration not found']);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../includes/utils.php';
require_once __DIR__ . '/../includes/auth.php';

$config = include $configFile;
if (isset($config['timezone'])) {
    date_default_timezone_set($config['timezone']);
}

ob_clean();
header('Content-Type: application/json');

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

$token = $_POST['csrf_token'] ?? '';
if (!validateCSRFToken($token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'CSRF token validation failed']);
    exit;
}

$action = $_POST['action'] ?? '';
require_once __DIR__ . '/updater.php';

try {
    $projectRoot = dirname(__DIR__);
    $updater = new Updater($projectRoot);

    switch ($action) {
        case 'check':
            $result = $updater->checkForUpdates();
            if (!empty($result['error'])) {
                echo json_encode(['success' => false, 'error' => $result['error'], 'data' => $result]);
            } else {
                echo json_encode(['success' => true, 'data' => $result]);
            }
            break;

        case 'update':
            $version = $_POST['version'] ?? '';
            $version = ltrim($version, 'v');
            if ($version === '' || !preg_match('/^\d+\.\d+\.\d+$/', $version)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Ungültiges Versionsformat']);
                exit;
            }
            $requirements = $updater->checkRequirements();
            if (!$requirements['available']) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Fehlende PHP-Erweiterungen: ' . implode(', ', $requirements['missing']),
                    'missing_extensions' => $requirements['missing']
                ]);
                exit;
            }
            $result = $updater->performUpdate($version);
            if ($result['success']) {
                require_once __DIR__ . '/../version.php';
                if (function_exists('sendInstallTrackingWebhook')) {
                    sendInstallTrackingWebhook(GITHUB_REPO_NAME, $version);
                }
                echo json_encode([
                    'success' => true,
                    'message' => $result['message'],
                    'files_updated' => $result['files_updated'],
                    'files_removed' => $result['files_removed'],
                    'backup_path' => $result['backup_path']
                ]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Update fehlgeschlagen', 'rollback' => true]);
            }
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Ungültige Aktion']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Fehler: ' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8')]);
}
