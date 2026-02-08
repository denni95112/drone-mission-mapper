<?php
/**
 * Mission API endpoint
 * Handles mission creation, grid generation, and mission start
 */

require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';
require_once __DIR__ . '/../includes/utils.php';
require_once __DIR__ . '/../includes/cache.php';

$authenticated = false;
$shareToken = $_GET['token'] ?? '';
$missionId = $_GET['mission_id'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && !empty($shareToken) && !empty($missionId)) {
    try {
        $db = getDB();
        
        if (verifyShareToken($db, $missionId, $shareToken)) {
            $authenticated = true;
        }
    } catch (Exception $e) {
        error_log('Error verifying share token in mission API: ' . $e->getMessage());
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

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();
    
    if ($method === 'POST') {
        $action = $_POST['action'] ?? '';
        
        if ($action === 'create_grid') {
            $missionId = trim($_POST['mission_id'] ?? '');
            $gridLength = intval($_POST['grid_length'] ?? 0);
            $gridHeight = intval($_POST['grid_height'] ?? 0);
            $fieldSize = floatval($_POST['field_size'] ?? 0);
            $centerLat = floatval($_POST['center_lat'] ?? $config['map_default_lat']);
            $centerLng = floatval($_POST['center_lng'] ?? $config['map_default_lng']);
            $shapeType = trim($_POST['shape_type'] ?? '');
            $boundsNeLat = isset($_POST['bounds_ne_lat']) ? floatval($_POST['bounds_ne_lat']) : null;
            $boundsNeLng = isset($_POST['bounds_ne_lng']) ? floatval($_POST['bounds_ne_lng']) : null;
            $boundsSwLat = isset($_POST['bounds_sw_lat']) ? floatval($_POST['bounds_sw_lat']) : null;
            $boundsSwLng = isset($_POST['bounds_sw_lng']) ? floatval($_POST['bounds_sw_lng']) : null;
            $numAreas = isset($_POST['num_areas']) ? intval($_POST['num_areas']) : null;
            
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
            
            if ($gridLength <= 0 || $gridHeight <= 0 || $fieldSize <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Grid dimensions and field size must be greater than 0']);
                exit;
            }
            if ($numAreas === null || $numAreas <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Anzahl Bereiche muss größer als 0 sein.']);
                exit;
            }
            
            if (!validateLatitude($centerLat) || !validateLongitude($centerLng)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid center coordinates']);
                exit;
            }
            
            if ($boundsNeLat !== null && (!validateLatitude($boundsNeLat) || !validateLongitude($boundsNeLng))) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid northeast bounds coordinates']);
                exit;
            }
            
            if ($boundsSwLat !== null && (!validateLatitude($boundsSwLat) || !validateLongitude($boundsSwLng))) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid southwest bounds coordinates']);
                exit;
            }
            
            // Check if mission ID already exists
            $stmt = $db->prepare('SELECT id FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $existing = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if ($existing) {
                http_response_code(400);
                echo json_encode(['error' => 'Mission ID already exists']);
                exit;
            }
            
            $stmt = $db->prepare('INSERT INTO missions (mission_id, grid_length, grid_height, field_size, center_lat, center_lng, shape_type, bounds_ne_lat, bounds_ne_lng, bounds_sw_lat, bounds_sw_lng, num_areas, status) VALUES (:mission_id, :grid_length, :grid_height, :field_size, :center_lat, :center_lng, :shape_type, :bounds_ne_lat, :bounds_ne_lng, :bounds_sw_lat, :bounds_sw_lng, :num_areas, :status)');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->bindValue(':grid_length', $gridLength, SQLITE3_INTEGER);
            $stmt->bindValue(':grid_height', $gridHeight, SQLITE3_INTEGER);
            $stmt->bindValue(':field_size', $fieldSize, SQLITE3_FLOAT);
            $stmt->bindValue(':center_lat', $centerLat, SQLITE3_FLOAT);
            $stmt->bindValue(':center_lng', $centerLng, SQLITE3_FLOAT);
            $stmt->bindValue(':shape_type', $shapeType ?: null, SQLITE3_TEXT);
            $stmt->bindValue(':bounds_ne_lat', $boundsNeLat, SQLITE3_FLOAT);
            $stmt->bindValue(':bounds_ne_lng', $boundsNeLng, SQLITE3_FLOAT);
            $stmt->bindValue(':bounds_sw_lat', $boundsSwLat, SQLITE3_FLOAT);
            $stmt->bindValue(':bounds_sw_lng', $boundsSwLng, SQLITE3_FLOAT);
            $stmt->bindValue(':num_areas', $numAreas, SQLITE3_INTEGER);
            $stmt->bindValue(':status', 'pending', SQLITE3_TEXT);
            $stmt->execute();
            
            ApiCache::invalidate('mission_list');
            
            echo json_encode([
                'success' => true,
                'message' => 'Grid created successfully',
                'mission_id' => $missionId
            ]);
            
        } elseif ($action === 'create_mission') {
            $missionId = trim($_POST['mission_id'] ?? '');
            $centerLat = isset($_POST['center_lat']) ? floatval($_POST['center_lat']) : $config['map_default_lat'];
            $centerLng = isset($_POST['center_lng']) ? floatval($_POST['center_lng']) : $config['map_default_lng'];
            
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
            
            if (isset($_POST['center_lat']) && (!validateLatitude($centerLat) || !validateLongitude($centerLng))) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid center coordinates']);
                exit;
            }
            
            $stmt = $db->prepare('SELECT id FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $existing = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if ($existing) {
                http_response_code(400);
                echo json_encode(['error' => 'Mission ID already exists']);
                exit;
            }
            
            $stmt = $db->prepare('INSERT INTO missions (mission_id, grid_length, grid_height, field_size, center_lat, center_lng, status) VALUES (:mission_id, :grid_length, :grid_height, :field_size, :center_lat, :center_lng, :status)');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->bindValue(':grid_length', null, SQLITE3_NULL);
            $stmt->bindValue(':grid_height', null, SQLITE3_NULL);
            $stmt->bindValue(':field_size', null, SQLITE3_NULL);
            $stmt->bindValue(':center_lat', $centerLat, SQLITE3_FLOAT);
            $stmt->bindValue(':center_lng', $centerLng, SQLITE3_FLOAT);
            $stmt->bindValue(':status', 'pending', SQLITE3_TEXT);
            $stmt->execute();
            
            ApiCache::invalidate('mission_list');
            
            echo json_encode([
                'success' => true,
                'message' => 'Mission created successfully (without raster)',
                'mission_id' => $missionId
            ]);
            
        } elseif ($action === 'generate_share_token') {
            $missionId = trim($_POST['mission_id'] ?? '');
            
            if (empty($missionId) || !validateMissionId($missionId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid mission ID']);
                exit;
            }
            
            $stmt = $db->prepare('SELECT id FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if (!$mission) {
                http_response_code(404);
                echo json_encode(['error' => 'Mission not found']);
                exit;
            }
            
            $shareToken = bin2hex(random_bytes(32));
            
            $expiresAt = date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60));
            
            $stmt = $db->prepare('UPDATE missions SET share_token = :share_token, share_token_expires_at = :expires_at, updated_at = CURRENT_TIMESTAMP WHERE mission_id = :mission_id');
            $stmt->bindValue(':share_token', $shareToken, SQLITE3_TEXT);
            $stmt->bindValue(':expires_at', $expiresAt, SQLITE3_TEXT);
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->execute();
            
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $path = dirname(dirname($_SERVER['SCRIPT_NAME']));
            $baseUrl = $protocol . '://' . $host . $path;
            $shareUrl = $baseUrl . '/view_mission.php?mission_id=' . urlencode($missionId) . '&token=' . urlencode($shareToken);
            
            echo json_encode([
                'success' => true,
                'share_token' => $shareToken,
                'share_url' => $shareUrl,
                'message' => 'Share token generated successfully'
            ]);
        } elseif ($action === 'start_mission') {
            $missionId = trim($_POST['mission_id'] ?? '');
            
            if (empty($missionId) || !validateMissionId($missionId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid mission ID']);
                exit;
            }
            
            $stmt = $db->prepare('SELECT id, status FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if (!$mission) {
                http_response_code(404);
                echo json_encode(['error' => 'Mission not found']);
                exit;
            }
            
            if ($mission['status'] === 'active') {
                http_response_code(400);
                echo json_encode(['error' => 'Mission is already active']);
                exit;
            }
            
            $stmt = $db->prepare('UPDATE missions SET status = :status, started_at = datetime("now") WHERE mission_id = :mission_id');
            $stmt->bindValue(':status', 'active', SQLITE3_TEXT);
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->execute();
            
            MissionCache::invalidate($missionId);
            ApiCache::invalidate('mission_list');
            
            echo json_encode([
                'success' => true,
                'message' => 'Mission started successfully',
                'mission_id' => $missionId
            ]);
            
        } elseif ($action === 'stop_mission') {
            $missionId = trim($_POST['mission_id'] ?? '');
            
            if (empty($missionId) || !validateMissionId($missionId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid mission ID']);
                exit;
            }
            
            $stmt = $db->prepare('UPDATE missions SET status = :status WHERE mission_id = :mission_id');
            $stmt->bindValue(':status', 'completed', SQLITE3_TEXT);
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->execute();
            
            MissionCache::invalidate($missionId);
            ApiCache::invalidate('mission_list');
            
            echo json_encode([
                'success' => true,
                'message' => 'Mission stopped successfully',
                'mission_id' => $missionId
            ]);
        } elseif ($action === 'save_legend') {
            $missionId = trim($_POST['mission_id'] ?? '');
            $legendData = $_POST['legend_data'] ?? '{}';
            
            if (empty($missionId) || !validateMissionId($missionId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid mission ID']);
                exit;
            }
            
            $decoded = json_decode($legendData, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid legend data JSON']);
                exit;
            }
            
            $stmt = $db->prepare('SELECT id FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if (!$mission) {
                http_response_code(404);
                echo json_encode(['error' => 'Mission not found']);
                exit;
            }
            
            $stmt = $db->prepare('UPDATE missions SET legend_data = :legend_data, updated_at = CURRENT_TIMESTAMP WHERE mission_id = :mission_id');
            $stmt->bindValue(':legend_data', $legendData, SQLITE3_TEXT);
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->execute();
            
            MissionCache::invalidate($missionId);
            
            echo json_encode([
                'success' => true,
                'message' => 'Legend data saved successfully',
                'mission_id' => $missionId
            ]);
        } elseif ($action === 'save_done_fields') {
            $missionId = trim($_POST['mission_id'] ?? '');
            $doneFields = $_POST['done_fields'] ?? '{}';
            
            if (empty($missionId) || !validateMissionId($missionId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid mission ID']);
                exit;
            }
            
            $decoded = json_decode($doneFields, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid done fields JSON']);
                exit;
            }
            
            $stmt = $db->prepare('SELECT id FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if (!$mission) {
                http_response_code(404);
                echo json_encode(['error' => 'Mission not found']);
                exit;
            }
            
            try {
                $db->exec('ALTER TABLE missions ADD COLUMN done_fields TEXT');
            } catch (Exception $e) {
            }
            
            $stmt = $db->prepare('UPDATE missions SET done_fields = :done_fields, updated_at = CURRENT_TIMESTAMP WHERE mission_id = :mission_id');
            $stmt->bindValue(':done_fields', $doneFields, SQLITE3_TEXT);
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'Done fields saved successfully',
                'mission_id' => $missionId
            ]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
        }
        
    } elseif ($method === 'GET') {
        $missionId = $_GET['mission_id'] ?? '';
        $getPositions = isset($_GET['get_positions']) && $_GET['get_positions'] == '1';
        
        if (empty($missionId)) {
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
            $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
            
            $cacheKey = "mission_list_{$limit}_{$offset}";
            $cached = ApiCache::get('mission_list', ['limit' => $limit, 'offset' => $offset]);
            
            if ($cached !== null) {
                echo json_encode($cached);
                exit;
            }
            
            $stmt = $db->prepare('
                SELECT 
                    m.*,
                    (SELECT COUNT(*) FROM drone_positions WHERE mission_id = m.mission_id) +
                    (SELECT COUNT(*) FROM map_icon_positions WHERE mission_id = m.mission_id) as position_count
                FROM missions m
                ORDER BY m.created_at DESC
                LIMIT :limit OFFSET :offset
            ');
            $stmt->bindValue(':limit', $limit, SQLITE3_INTEGER);
            $stmt->bindValue(':offset', $offset, SQLITE3_INTEGER);
            $result = $stmt->execute();
            
            $missions = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $row['position_count'] = intval($row['position_count'] ?? 0);
                $missions[] = $row;
            }
            
            $countStmt = $db->query('SELECT COUNT(*) as total FROM missions');
            $total = $countStmt->fetchArray(SQLITE3_ASSOC)['total'] ?? 0;
            
            $response = [
                'success' => true,
                'missions' => $missions,
                'total' => $total
            ];
            
            ApiCache::set('mission_list', ['limit' => $limit, 'offset' => $offset], $response, 5);
            
            echo json_encode($response);
        } else {
            if (!validateMissionId($missionId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid mission ID format']);
                exit;
            }
            
            $cached = MissionCache::get($missionId);
            if ($cached !== null && !$getPositions) {
                echo json_encode($cached);
                exit;
            }
            
            $stmt = $db->prepare('SELECT * FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if (!$mission) {
                http_response_code(404);
                echo json_encode(['error' => 'Mission not found']);
                exit;
            }
            
            $posCountStmt = $db->prepare('SELECT COUNT(*) as count FROM drone_positions WHERE mission_id = :mission_id');
            $posCountStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $posCountResult = $posCountStmt->execute()->fetchArray(SQLITE3_ASSOC);
            $mission['position_count'] = $posCountResult['count'] ?? 0;
            
            if (!empty($mission['legend_data'])) {
                $decoded = json_decode($mission['legend_data'], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $mission['legend_data_parsed'] = $decoded;
                }
            }
            
            if (!empty($mission['done_fields'])) {
                $decoded = json_decode($mission['done_fields'], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $mission['done_fields_parsed'] = $decoded;
                }
            } else {
                $mission['done_fields_parsed'] = [];
            }
            
            $response = [
                'success' => true,
                'mission' => $mission
            ];
            
            if (!$getPositions) {
                MissionCache::set($missionId, $response);
            }
            
            if ($getPositions) {
                $positions = [];
                
                $posStmt = $db->prepare('SELECT * FROM drone_positions WHERE mission_id = :mission_id ORDER BY recorded_at ASC');
                $posStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $posResult = $posStmt->execute();
                
                while ($pos = $posResult->fetchArray(SQLITE3_ASSOC)) {
                    $positions[] = array_merge($pos, ['type' => 'drone']);
                }
                
                $iconPosStmt = $db->prepare('
                    SELECT mip.*, mi.icon_type, mi.label_text 
                    FROM map_icon_positions mip
                    JOIN map_icons mi ON mip.icon_id = mi.id
                    WHERE mip.mission_id = :mission_id
                    ORDER BY mip.recorded_at ASC
                ');
                $iconPosStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $iconPosResult = $iconPosStmt->execute();
                
                while ($iconPos = $iconPosResult->fetchArray(SQLITE3_ASSOC)) {
                    $positions[] = [
                        'type' => 'icon',
                        'icon_id' => $iconPos['icon_id'],
                        'icon_type' => $iconPos['icon_type'],
                        'label_text' => $iconPos['label_text'],
                        'latitude' => floatval($iconPos['latitude']),
                        'longitude' => floatval($iconPos['longitude']),
                        'recorded_at' => $iconPos['recorded_at']
                    ];
                }
                
                usort($positions, function($a, $b) {
                    return strcmp($a['recorded_at'], $b['recorded_at']);
                });
                
                $response['positions'] = $positions;
            }
            
            echo json_encode($response);
        }
    } elseif ($method === 'DELETE') {
        $missionId = trim($_GET['mission_id'] ?? '');
        
        if (empty($missionId) || !validateMissionId($missionId)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid mission ID']);
            exit;
        }
        
        $stmt = $db->prepare('SELECT id, status FROM missions WHERE mission_id = :mission_id');
        $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        
        if (!$mission) {
            http_response_code(404);
            echo json_encode(['error' => 'Mission not found']);
            exit;
        }
        
        $stmt = $db->prepare('DELETE FROM map_icon_positions WHERE mission_id = :mission_id');
        $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $stmt->execute();
        
        $stmt = $db->prepare('DELETE FROM map_icons WHERE mission_id = :mission_id');
        $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $stmt->execute();
        
        $stmt = $db->prepare('DELETE FROM drone_positions WHERE mission_id = :mission_id');
        $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $stmt->execute();
        
        $stmt = $db->prepare('DELETE FROM missions WHERE mission_id = :mission_id');
        $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $stmt->execute();
        
        MissionCache::invalidate($missionId);
        ApiCache::invalidate('mission_list');
            
            echo json_encode([
                'success' => true,
                'message' => 'Mission deleted successfully',
                'mission_id' => $missionId
            ]);
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}

