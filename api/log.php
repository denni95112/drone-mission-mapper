<?php
/**
 * General logging API endpoint
 * Accepts log messages from JavaScript and writes them to log files
 */

require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
    exit;
}

$level = $input['level'] ?? 'info'; // debug, info, warning, error
$message = $input['message'] ?? '';
$context = $input['context'] ?? [];
$missionId = $input['mission_id'] ?? 'general';

if (empty($message)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Message is required']);
    exit;
}

$configFile = __DIR__ . '/../config/config.php';
$config = [];
if (file_exists($configFile)) {
    $config = @include $configFile;
    if (!is_array($config)) {
        $config = [];
    }
}

$logLevel = $config['log_level'] ?? 'info';
$logLevels = ['debug', 'info', 'warning', 'error'];

$levelIndex = array_search($level, $logLevels);
$currentLevelIndex = array_search($logLevel, $logLevels);

if ($levelIndex === false || $currentLevelIndex === false || $levelIndex < $currentLevelIndex) {
    echo json_encode([
        'success' => true,
        'message' => 'Log entry filtered by log level'
    ]);
    exit;
}

try {
    $logsDir = __DIR__ . '/../logs';
    if (!is_dir($logsDir)) {
        mkdir($logsDir, 0755, true);
    }
    
    $date = date('Y-m-d');
    $logFilename = $missionId . '-' . $date . '.log';
    $logPath = $logsDir . '/' . $logFilename;
    
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = '';
    if (!empty($context)) {
        $contextStr = ' | Context: ' . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    
    $logEntry = sprintf(
        "[%s] [%s] %s%s\n",
        $timestamp,
        strtoupper($level),
        $message,
        $contextStr
    );
    
    $result = file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
    
    if ($result !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Log entry written successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to write to log file'
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error writing log: ' . $e->getMessage()
    ]);
}

