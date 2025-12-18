<?php
/**
 * Icon Placement Logging API
 * Logs icon placement actions to files
 */

require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';
require_once __DIR__ . '/../includes/utils.php';

require_once __DIR__ . '/../auth.php';
if (!isAuthenticated()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'log_drone_placement') {
        $missionId = trim($_POST['mission_id'] ?? '');
        $functionName = trim($_POST['function_name'] ?? '');
        $droneId = isset($_POST['drone_id']) ? trim($_POST['drone_id']) : null;
        $droneName = trim($_POST['drone_name'] ?? '');
        $latitude = isset($_POST['latitude']) ? floatval($_POST['latitude']) : null;
        $longitude = isset($_POST['longitude']) ? floatval($_POST['longitude']) : null;
        $height = isset($_POST['height']) ? floatval($_POST['height']) : null;
        $battery = isset($_POST['battery']) ? intval($_POST['battery']) : null;
        
        if (empty($missionId) || empty($functionName)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Mission ID and function name are required']);
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
            $logEntry = sprintf(
                "[%s] Function: %s | Drone ID: %s | Name: %s | Position: %.6f, %.6f | Height: %sm | Battery: %s%%\n",
                $timestamp,
                $functionName,
                $droneId !== null ? $droneId : 'N/A',
                $droneName ?: 'N/A',
                $latitude !== null ? $latitude : 0,
                $longitude !== null ? $longitude : 0,
                $height !== null ? $height : 0,
                $battery !== null ? $battery : 0
            );
            
            $result = file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
            
            if ($result !== false) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Drone placement logged successfully'
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
                'error' => 'Error logging drone placement: ' . $e->getMessage()
            ]);
        }
    } elseif ($action === 'log_icon_placement') {
        $missionId = trim($_POST['mission_id'] ?? '');
        $functionName = trim($_POST['function_name'] ?? '');
        $iconId = isset($_POST['icon_id']) ? intval($_POST['icon_id']) : null;
        $iconType = trim($_POST['icon_type'] ?? '');
        $latitude = isset($_POST['latitude']) ? floatval($_POST['latitude']) : null;
        $longitude = isset($_POST['longitude']) ? floatval($_POST['longitude']) : null;
        $labelText = trim($_POST['label_text'] ?? '');
        
        if (empty($missionId) || empty($functionName)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Mission ID and function name are required']);
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
            $logEntry = sprintf(
                "[%s] Function: %s | Icon ID: %s | Type: %s | Position: %.6f, %.6f | Label: %s\n",
                $timestamp,
                $functionName,
                $iconId !== null ? $iconId : 'N/A',
                $iconType ?: 'N/A',
                $latitude !== null ? $latitude : 0,
                $longitude !== null ? $longitude : 0,
                $labelText ?: 'N/A'
            );
            
            $result = file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
            
            if ($result !== false) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Icon placement logged successfully'
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
                'error' => 'Error logging icon placement: ' . $e->getMessage()
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

