<?php
/**
 * Fake API endpoint for drone data
 * Returns mock data for 3 drones with dynamic locations within 5km radius
 * Stores data in database if mission is active
 */

require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';
require_once __DIR__ . '/../includes/utils.php';
require_once __DIR__ . '/../includes/cache.php';

$authenticated = false;
$shareToken = $_GET['token'] ?? '';
$missionId = $_GET['mission_id'] ?? '';

if (!empty($shareToken) && !empty($missionId)) {
    try {
        $db = getDB();
        
        if (verifyShareToken($db, $missionId, $shareToken)) {
            $authenticated = true;
        }
    } catch (Exception $e) {
        error_log('Error verifying share token in drones API: ' . $e->getMessage());
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

$defaultLat = $config['map_default_lat'] ?? 51.1657;
$defaultLng = $config['map_default_lng'] ?? 10.4515;

$missionId = $_GET['mission_id'] ?? '';
$activeMission = null;
$mission = null;

if (!empty($missionId)) {
    try {
        if (!isset($db)) {
            $db = getDB();
        }
        
        $stmt = $db->prepare('SELECT * FROM missions WHERE mission_id = :mission_id');
        $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        
        if ($mission && $mission['status'] === 'active') {
            $activeMission = $mission;
        }
        
        if ($mission && $mission['status'] !== 'active') {
            $posStmt = $db->prepare('
                SELECT dp.* 
                FROM drone_positions dp
                INNER JOIN (
                    SELECT drone_id, MAX(recorded_at) as max_time
                    FROM drone_positions
                    WHERE mission_id = :mission_id
                    GROUP BY drone_id
                ) latest ON dp.drone_id = latest.drone_id AND dp.recorded_at = latest.max_time
                WHERE dp.mission_id = :mission_id
                ORDER BY dp.drone_id
            ');
            $posStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $posResult = $posStmt->execute();
            
            $storedPositions = [];
            while ($pos = $posResult->fetchArray(SQLITE3_ASSOC)) {
                $storedPositions[$pos['drone_id']] = $pos;
            }
            
            if (!empty($storedPositions)) {
                $drones = [];
                foreach ($storedPositions as $pos) {
                    $drones[] = [
                        'id' => $pos['drone_id'],
                        'name' => $pos['drone_name'],
                        'lat' => $pos['latitude'],
                        'long' => $pos['longitude'],
                        'height' => $pos['height'],
                        'battery' => $pos['battery']
                    ];
                }
                
                header('Content-Type: application/json');
                header('Cache-Control: no-cache, must-revalidate');
                
                echo json_encode([
                    'success' => true,
                    'timestamp' => date('Y-m-d H:i:s'),
                    'mission_id' => $missionId,
                    'mission_active' => false,
                    'drones' => $drones
                ], JSON_PRETTY_PRINT);
                exit;
            }
        }
    } catch (Exception $e) {
        error_log("Error checking mission: " . $e->getMessage());
    }
}

/**
 * Generate a random point within a radius (in kilometers) of a center point
 * 
 * @param float $centerLat Center latitude
 * @param float $centerLng Center longitude
 * @param float $radiusKm Radius in kilometers
 * @return array ['lat' => float, 'lng' => float]
 */
function generateRandomLocation($centerLat, $centerLng, $radiusKm) {
    $angle = mt_rand(0, 360000) / 1000;
    $angleRad = deg2rad($angle);
    
    $distance = mt_rand(0, $radiusKm * 1000) / 1000;
    
    $earthRadius = 6371.0;
    
    $latOffset = $distance / 111.0;
    $lngOffset = $distance / (111.0 * cos(deg2rad($centerLat)));
    
    $newLat = $centerLat + ($latOffset * cos($angleRad));
    $newLng = $centerLng + ($lngOffset * sin($angleRad));
    
    $newLat = max(-90, min(90, $newLat));
    $newLng = max(-180, min(180, $newLng));
    
    return [
        'lat' => round($newLat, 6),
        'lng' => round($newLng, 6)
    ];
}

/**
 * Generate random battery percentage (20-100%)
 */
function generateBattery() {
    return mt_rand(20, 100);
}

/**
 * Generate random height in meters (10-500m)
 */
function generateHeight() {
    return mt_rand(10, 500);
}

$drones = [];
$droneNames = ['DJI Phantom 4 Pro', 'DJI Mavic 3', 'DJI Inspire 2'];

$centerLat = $activeMission ? $activeMission['center_lat'] : $defaultLat;
$centerLng = $activeMission ? $activeMission['center_lng'] : $defaultLng;

for ($i = 1; $i <= 3; $i++) {
    $location = generateRandomLocation($centerLat, $centerLng, 5);
    $height = generateHeight();
    $battery = generateBattery();
    
    $drone = [
        'id' => $i,
        'name' => $droneNames[$i - 1],
        'lat' => $location['lat'],
        'long' => $location['lng'],
        'height' => $height,
        'battery' => $battery
    ];
    
    $drones[] = $drone;
    
    if ($activeMission) {
        try {
            $db = getDB();
            $stmt = $db->prepare('INSERT INTO drone_positions (mission_id, drone_id, drone_name, latitude, longitude, height, battery) VALUES (:mission_id, :drone_id, :drone_name, :latitude, :longitude, :height, :battery)');
            $stmt->bindValue(':mission_id', $activeMission['mission_id'], SQLITE3_TEXT);
            $stmt->bindValue(':drone_id', $i, SQLITE3_INTEGER);
            $stmt->bindValue(':drone_name', $droneNames[$i - 1], SQLITE3_TEXT);
            $stmt->bindValue(':latitude', $location['lat'], SQLITE3_FLOAT);
            $stmt->bindValue(':longitude', $location['lng'], SQLITE3_FLOAT);
            $stmt->bindValue(':height', $height, SQLITE3_FLOAT);
            $stmt->bindValue(':battery', $battery, SQLITE3_INTEGER);
            $stmt->execute();
        } catch (Exception $e) {
            error_log("Error storing drone position: " . $e->getMessage());
        }
    }
}

$cacheKey = 'drones_' . ($activeMission ? $activeMission['mission_id'] : 'default');
$cached = ApiCache::get('drones', ['mission_id' => $activeMission ? $activeMission['mission_id'] : null]);

if ($cached !== false && $cached !== null && !$activeMission) {
    header('Content-Type: application/json');
    header('Cache-Control: public, max-age=3');
    echo json_encode($cached, JSON_PRETTY_PRINT);
    exit;
}

$response = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'mission_id' => $activeMission ? $activeMission['mission_id'] : null,
    'mission_active' => $activeMission !== null,
    'drones' => $drones
];

if (!$activeMission) {
    ApiCache::set('drones', ['mission_id' => null], $response, 3);
}

header('Content-Type: application/json');
header('Cache-Control: ' . ($activeMission ? 'no-cache, must-revalidate' : 'public, max-age=3'));

echo json_encode($response, JSON_PRETTY_PRINT);

