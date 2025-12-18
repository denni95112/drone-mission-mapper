<?php
/**
 * Error reporting configuration
 */
$configFile = __DIR__ . '/../config/config.php';
$config = [];
if (file_exists($configFile)) {
    $config = @include $configFile;
    if (!is_array($config)) {
        $config = [];
    }
}

$debugMode = $config['debugMode'] ?? false;

if ($debugMode) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    ini_set('log_errors', 1);
    
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    ini_set('error_log', $logDir . '/php_errors.log');
}

