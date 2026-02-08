<?php
/**
 * Map Icons API endpoint
 * Handles creating, updating, and deleting map icons
 */

require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';
require_once __DIR__ . '/../includes/utils.php';

$authenticated = false;
$shareToken = $_GET['token'] ?? $_POST['token'] ?? '';
$missionId = $_GET['mission_id'] ?? $_POST['mission_id'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if (!empty($shareToken) && !empty($missionId)) {
    try {
        $db = getDB();
        
        if (verifyShareToken($db, $missionId, $shareToken)) {
            $authenticated = true;
        }
    } catch (Exception $e) {
        error_log('Error verifying share token in map_icons API: ' . $e->getMessage());
    }
}

if (!$authenticated) {
    require_once __DIR__ . '/../auth.php';
    if (isAuthenticated()) {
        $authenticated = true;
    }
}

if (!$authenticated) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$config = getConfig();
if (!is_array($config)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Configuration error']);
    exit;
}

require_once __DIR__ . '/../includes/utils.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();
    
    $tableCheck = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='map_icons'");
    $tableExists = false;
    if ($tableCheck) {
        $row = $tableCheck->fetchArray();
        $tableExists = ($row !== false);
    }
    
    $positionsTableCheck = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='map_icon_positions'");
    $positionsTableExists = false;
    if ($positionsTableCheck) {
        $row = $positionsTableCheck->fetchArray();
        $positionsTableExists = ($row !== false);
    }
    
    if (!$positionsTableExists) {
        $createTableSql = 'CREATE TABLE IF NOT EXISTS map_icon_positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icon_id INTEGER NOT NULL,
            mission_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )';
        
        if ($db->exec($createTableSql)) {
            $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_icon_id ON map_icon_positions(icon_id)');
            $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_mission_id ON map_icon_positions(mission_id)');
            $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_recorded_at ON map_icon_positions(recorded_at)');
        } else {
            error_log("Failed to create map_icon_positions table in API: " . $db->lastErrorMsg());
        }
    }
    
    if (!$tableExists) {
        $createTableSql = 'CREATE TABLE IF NOT EXISTS map_icons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id TEXT NOT NULL,
            icon_type TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            label_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )';
        
        if ($db->exec($createTableSql)) {
            $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_mission_id ON map_icons(mission_id)');
            $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_created_at ON map_icons(created_at)');
        } else {
            error_log("Failed to create map_icons table in API: " . $db->lastErrorMsg());
        }
    }
    
    if ($method === 'POST') {
        $action = $_POST['action'] ?? '';
        
        if ($action === 'create_icon') {
            $missionId = trim($_POST['mission_id'] ?? '');
            $iconType = trim($_POST['icon_type'] ?? '');
            $latitude = floatval($_POST['latitude'] ?? 0);
            $longitude = floatval($_POST['longitude'] ?? 0);
            $labelText = trim($_POST['label_text'] ?? '');
            
            if (empty($missionId) || empty($iconType)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Mission ID and icon type are required']);
                exit;
            }
            
            if (!validateMissionId($missionId)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid mission ID format']);
                exit;
            }
            
            if (!in_array($iconType, ['vehicle', 'person', 'drone', 'poi', 'fire', 'fire_truck', 'ambulance', 'police', 'thw'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid icon type']);
                exit;
            }
            
            if (!validateLatitude($latitude) || !validateLongitude($longitude)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid coordinates']);
                exit;
            }
            
            // Verify mission exists
            $checkStmt = $db->prepare('SELECT mission_id FROM missions WHERE mission_id = :mission_id');
            $checkStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $checkResult = $checkStmt->execute();
            if (!$checkResult || !$checkResult->fetchArray()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Mission not found']);
                exit;
            }
            
            // Insert icon
            $stmt = $db->prepare('INSERT INTO map_icons (mission_id, icon_type, latitude, longitude, label_text) VALUES (:mission_id, :icon_type, :latitude, :longitude, :label_text)');
            if (!$stmt) {
                $errorMsg = $db->lastErrorMsg();
                error_log("Failed to prepare INSERT statement: " . $errorMsg);
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error: Unable to prepare statement: ' . $errorMsg]);
                exit;
            }
            
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->bindValue(':icon_type', $iconType, SQLITE3_TEXT);
            $stmt->bindValue(':latitude', $latitude, SQLITE3_FLOAT);
            $stmt->bindValue(':longitude', $longitude, SQLITE3_FLOAT);
            $stmt->bindValue(':label_text', $labelText, SQLITE3_TEXT);
            
            $result = $stmt->execute();
            if (!$result) {
                $errorMsg = $db->lastErrorMsg();
                error_log("Failed to execute INSERT statement: " . $errorMsg);
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error: Unable to execute statement: ' . $errorMsg]);
                exit;
            }
            
            $iconId = $db->lastInsertRowID();
            
            $historyStmt = $db->prepare('INSERT INTO map_icon_positions (icon_id, mission_id, latitude, longitude) VALUES (:icon_id, :mission_id, :latitude, :longitude)');
            if ($historyStmt) {
                $historyStmt->bindValue(':icon_id', $iconId, SQLITE3_INTEGER);
                $historyStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $historyStmt->bindValue(':latitude', $latitude, SQLITE3_FLOAT);
                $historyStmt->bindValue(':longitude', $longitude, SQLITE3_FLOAT);
                $historyStmt->execute();
            }
            
            echo json_encode([
                'success' => true,
                'icon_id' => $iconId,
                'message' => 'Icon created successfully'
            ]);
            
        } elseif ($action === 'update_icon') {
            $iconId = intval($_POST['icon_id'] ?? 0);
            
            if ($iconId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Icon ID is required']);
                exit;
            }
            
            if (!empty($shareToken) && !empty($missionId)) {
                $checkStmt = $db->prepare('SELECT id FROM map_icons WHERE id = :icon_id AND mission_id = :mission_id');
                $checkStmt->bindValue(':icon_id', $iconId, SQLITE3_INTEGER);
                $checkStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $checkResult = $checkStmt->execute()->fetchArray();
                if (!$checkResult) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Icon not found or access denied']);
                    exit;
                }
            }
            
            $updates = [];
            $params = [];
            
            if (isset($_POST['latitude']) && isset($_POST['longitude'])) {
                $lat = floatval($_POST['latitude']);
                $lng = floatval($_POST['longitude']);
                
                if (!validateLatitude($lat) || !validateLongitude($lng)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Invalid coordinates']);
                    exit;
                }
                
                $updates[] = 'latitude = :latitude';
                $updates[] = 'longitude = :longitude';
                $params[':latitude'] = $lat;
                $params[':longitude'] = $lng;
            }
            
            if (isset($_POST['label_text'])) {
                $updates[] = 'label_text = :label_text';
                $params[':label_text'] = trim($_POST['label_text']);
            }
            
            if (empty($updates)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'No fields to update']);
                exit;
            }
            
            $updates[] = 'updated_at = datetime("now")';
            $sql = 'UPDATE map_icons SET ' . implode(', ', $updates) . ' WHERE id = :icon_id';
            
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':icon_id', $iconId, SQLITE3_INTEGER);
            
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            
            $stmt->execute();
            
            if (isset($params[':latitude']) && isset($params[':longitude'])) {
                $missionStmt = $db->prepare('SELECT mission_id FROM map_icons WHERE id = :icon_id');
                $missionStmt->bindValue(':icon_id', $iconId, SQLITE3_INTEGER);
                $missionResult = $missionStmt->execute();
                if ($missionResult) {
                    $missionRow = $missionResult->fetchArray(SQLITE3_ASSOC);
                    if ($missionRow) {
                        $historyStmt = $db->prepare('INSERT INTO map_icon_positions (icon_id, mission_id, latitude, longitude) VALUES (:icon_id, :mission_id, :latitude, :longitude)');
                        $historyStmt->bindValue(':icon_id', $iconId, SQLITE3_INTEGER);
                        $historyStmt->bindValue(':mission_id', $missionRow['mission_id'], SQLITE3_TEXT);
                        $historyStmt->bindValue(':latitude', $params[':latitude'], SQLITE3_FLOAT);
                        $historyStmt->bindValue(':longitude', $params[':longitude'], SQLITE3_FLOAT);
                        $historyStmt->execute();
                    }
                }
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Icon updated successfully'
            ]);
            
        } elseif ($action === 'delete_icon') {
            $iconId = intval($_POST['icon_id'] ?? 0);
            
            if ($iconId <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Icon ID is required']);
                exit;
            }
            
            $stmt = $db->prepare('DELETE FROM map_icons WHERE id = :icon_id');
            $stmt->bindValue(':icon_id', $iconId, SQLITE3_INTEGER);
            $stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'Icon deleted successfully'
            ]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
        }
        
    } elseif ($method === 'GET') {
        $missionId = $_GET['mission_id'] ?? '';
        $beforeTime = $_GET['before_time'] ?? null;
        $getPositions = isset($_GET['get_positions']) && $_GET['get_positions'] == '1';
        $iconId = isset($_GET['icon_id']) ? intval($_GET['icon_id']) : null;
        
        // If requesting position history
        if ($getPositions) {
            if (empty($missionId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Mission ID is required']);
                exit;
            }
            
            $sql = 'SELECT mip.*, mi.icon_type, mi.label_text 
                    FROM map_icon_positions mip
                    JOIN map_icons mi ON mip.icon_id = mi.id
                    WHERE mip.mission_id = :mission_id';
            $params = [':mission_id' => $missionId];
            
            if ($iconId !== null && $iconId > 0) {
                $sql .= ' AND mip.icon_id = :icon_id';
                $params[':icon_id'] = $iconId;
            }
            
            $sql .= ' ORDER BY mip.icon_id ASC, mip.recorded_at ASC';
            
            $stmt = $db->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            
            $result = $stmt->execute();
            
            $positions = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $positions[] = [
                    'icon_id' => $row['icon_id'],
                    'icon_type' => $row['icon_type'],
                    'label_text' => $row['label_text'],
                    'latitude' => floatval($row['latitude']),
                    'longitude' => floatval($row['longitude']),
                    'recorded_at' => $row['recorded_at']
                ];
            }
            
            echo json_encode([
                'success' => true,
                'positions' => $positions
            ]);
            exit;
        }
        
        if (empty($missionId)) {
            http_response_code(400);
            echo json_encode(['error' => 'Mission ID is required']);
            exit;
        }
        
        if (!validateMissionId($missionId)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid mission ID format']);
            exit;
        }
        
        $missionCheck = $db->prepare('SELECT id FROM missions WHERE mission_id = :mission_id');
        $missionCheck->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $missionExists = $missionCheck->execute()->fetchArray(SQLITE3_ASSOC);
        
        if (!$missionExists) {
            echo json_encode([
                'success' => true,
                'icons' => []
            ]);
            exit;
        }
        
        $sql = 'SELECT * FROM map_icons WHERE mission_id = :mission_id';
        $params = [':mission_id' => $missionId];
        
        if ($beforeTime) {
            $sql .= ' AND created_at <= :before_time';
            $params[':before_time'] = $beforeTime;
        }
        
        $sql .= ' ORDER BY created_at ASC';
        
        $stmt = $db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        
        $result = $stmt->execute();
        
        $icons = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $icons[] = $row;
        }
        
        echo json_encode([
            'success' => true,
            'icons' => $icons
        ]);
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}

