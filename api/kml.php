<?php
/**
 * KML Export/Import API endpoint
 * Handles KML file export and import for DJI Drones
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

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();
    
    if ($method === 'GET') {
        $missionId = $_GET['mission_id'] ?? '';
        $includeFlightPath = isset($_GET['include_flight_path']) && $_GET['include_flight_path'] == '1';
        $onlyFireIcons = isset($_GET['only_fire_icons']) && $_GET['only_fire_icons'] == '1';
        
        if (empty($missionId)) {
            http_response_code(400);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Mission ID is required']);
            exit;
        }
        
        $stmt = $db->prepare('SELECT * FROM missions WHERE mission_id = :mission_id');
        $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        
        if (!$mission) {
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Mission not found']);
            exit;
        }
        
        if ($onlyFireIcons) {
            $iconsStmt = $db->prepare('SELECT * FROM map_icons WHERE mission_id = :mission_id AND icon_type = :icon_type ORDER BY created_at ASC');
            $iconsStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $iconsStmt->bindValue(':icon_type', 'fire', SQLITE3_TEXT);
        } else {
            $iconsStmt = $db->prepare('SELECT * FROM map_icons WHERE mission_id = :mission_id ORDER BY created_at ASC');
            $iconsStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
        }
        $iconsResult = $iconsStmt->execute();
        
        $waypoints = [];
        while ($icon = $iconsResult->fetchArray(SQLITE3_ASSOC)) {
            $waypoints[] = [
                'id' => $icon['id'],
                'name' => $icon['label_text'] ?: ('Waypoint ' . $icon['id']),
                'type' => $icon['icon_type'],
                'latitude' => floatval($icon['latitude']),
                'longitude' => floatval($icon['longitude'])
            ];
        }
        
        $flightPath = [];
        if ($includeFlightPath) {
            $pathStmt = $db->prepare('
                SELECT latitude, longitude, height, recorded_at, drone_name
                FROM drone_positions 
                WHERE mission_id = :mission_id 
                ORDER BY recorded_at ASC
            ');
            $pathStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $pathResult = $pathStmt->execute();
            
            while ($pos = $pathResult->fetchArray(SQLITE3_ASSOC)) {
                $flightPath[] = [
                    'latitude' => floatval($pos['latitude']),
                    'longitude' => floatval($pos['longitude']),
                    'height' => floatval($pos['height']),
                    'timestamp' => $pos['recorded_at'],
                    'drone_name' => $pos['drone_name']
                ];
            }
        }
        
        $kml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $kml .= '<kml xmlns="http://www.opengis.net/kml/2.2">' . "\n";
        $kml .= '  <Document>' . "\n";
        $kml .= '    <name>' . htmlspecialchars($missionId, ENT_XML1, 'UTF-8') . '</name>' . "\n";
        $kml .= '    <description>DJI Drone Mission - ' . htmlspecialchars($missionId, ENT_XML1, 'UTF-8') . '</description>' . "\n";
        
        if (!empty($waypoints)) {
            $kml .= '    <Folder>' . "\n";
            $kml .= '      <name>Waypoints</name>' . "\n";
            $kml .= '      <description>Mission waypoints for DJI Drone</description>' . "\n";
            
            foreach ($waypoints as $index => $wp) {
                $kml .= '      <Placemark>' . "\n";
                $kml .= '        <name>' . htmlspecialchars($wp['name'], ENT_XML1, 'UTF-8') . '</name>' . "\n";
                $kml .= '        <description>Waypoint ' . ($index + 1) . ' - Type: ' . htmlspecialchars($wp['type'], ENT_XML1, 'UTF-8') . '</description>' . "\n";
                $kml .= '        <Point>' . "\n";
                $kml .= '          <coordinates>' . $wp['longitude'] . ',' . $wp['latitude'] . ',0</coordinates>' . "\n";
                $kml .= '        </Point>' . "\n";
                $kml .= '        <styleUrl>#waypoint-style</styleUrl>' . "\n";
                $kml .= '      </Placemark>' . "\n";
            }
            
            $kml .= '    </Folder>' . "\n";
        }
        
        // Add flight path if available
        if (!empty($flightPath)) {
            $kml .= '    <Folder>' . "\n";
            $kml .= '      <name>Flight Path</name>' . "\n";
            $kml .= '      <description>Drone flight path</description>' . "\n";
            
            $pathsByDrone = [];
            foreach ($flightPath as $point) {
                $droneName = $point['drone_name'] ?: 'Drone 1';
                if (!isset($pathsByDrone[$droneName])) {
                    $pathsByDrone[$droneName] = [];
                }
                $pathsByDrone[$droneName][] = $point;
            }
            
            foreach ($pathsByDrone as $droneName => $points) {
                $kml .= '      <Placemark>' . "\n";
                $kml .= '        <name>' . htmlspecialchars($droneName, ENT_XML1, 'UTF-8') . ' Path</name>' . "\n";
                $kml .= '        <description>Flight path for ' . htmlspecialchars($droneName, ENT_XML1, 'UTF-8') . '</description>' . "\n";
                $kml .= '        <LineString>' . "\n";
                $kml .= '          <tessellate>1</tessellate>' . "\n";
                $kml .= '          <coordinates>' . "\n";
                
                foreach ($points as $point) {
                    $kml .= '            ' . $point['longitude'] . ',' . $point['latitude'] . ',' . $point['height'] . "\n";
                }
                
                $kml .= '          </coordinates>' . "\n";
                $kml .= '        </LineString>' . "\n";
                $kml .= '        <Style>' . "\n";
                $kml .= '          <LineStyle>' . "\n";
                $kml .= '            <color>ff0000ff</color>' . "\n";
                $kml .= '            <width>2</width>' . "\n";
                $kml .= '          </LineStyle>' . "\n";
                $kml .= '        </Style>' . "\n";
                $kml .= '      </Placemark>' . "\n";
            }
            
            $kml .= '    </Folder>' . "\n";
        }
        
        $kml .= '    <Style id="waypoint-style">' . "\n";
        $kml .= '      <IconStyle>' . "\n";
        $kml .= '        <Icon>' . "\n";
        $kml .= '          <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>' . "\n";
        $kml .= '        </Icon>' . "\n";
        $kml .= '        <scale>1.0</scale>' . "\n";
        $kml .= '      </IconStyle>' . "\n";
        $kml .= '    </Style>' . "\n";
        
        $kml .= '  </Document>' . "\n";
        $kml .= '</kml>';
        
        header('Content-Type: application/vnd.google-earth.kml+xml; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $missionId . '-mission.kml"');
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');
        
        echo $kml;
        exit;
        
    } elseif ($method === 'POST') {
        $action = $_POST['action'] ?? '';
        
        if ($action === 'import') {
            $missionId = trim($_POST['mission_id'] ?? '');
            
            if (empty($missionId)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Mission ID is required']);
                exit;
            }
            
            $stmt = $db->prepare('SELECT id FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if (!$mission) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Mission not found']);
                exit;
            }
            
            if (!isset($_FILES['kml_file']) || $_FILES['kml_file']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'No KML file uploaded or upload error']);
                exit;
            }
            
            $uploadedFile = $_FILES['kml_file']['tmp_name'];
            $fileContent = file_get_contents($uploadedFile);
            
            if ($fileContent === false) {
                http_response_code(500);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Failed to read uploaded file']);
                exit;
            }
            
            libxml_use_internal_errors(true);
            $xml = simplexml_load_string($fileContent);
            
            if ($xml === false) {
                $errors = libxml_get_errors();
                libxml_clear_errors();
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Invalid KML file: ' . ($errors[0]->message ?? 'Unknown error')]);
                exit;
            }
            
            $xml->registerXPathNamespace('kml', 'http://www.opengis.net/kml/2.2');
            
            $placemarks = $xml->xpath('//kml:Placemark');
            
            if (empty($placemarks)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'No waypoints found in KML file']);
                exit;
            }
            
            $imported = 0;
            $errors = [];
            
            foreach ($placemarks as $placemark) {
                $point = $placemark->xpath('.//kml:Point/kml:coordinates');
                
                if (empty($point)) {
                    continue;
                }
                
                $coords = trim((string)$point[0]);
                $coordsArray = explode(',', $coords);
                
                if (count($coordsArray) < 2) {
                    $errors[] = 'Invalid coordinates in waypoint';
                    continue;
                }
                
                $longitude = floatval(trim($coordsArray[0]));
                $latitude = floatval(trim($coordsArray[1]));
                
                if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
                    $errors[] = 'Invalid coordinates: ' . $latitude . ', ' . $longitude;
                    continue;
                }
                
                $name = trim((string)$placemark->name);
                $description = trim((string)$placemark->description);
                
                $iconType = 'poi';
                if ($description) {
                    $descLower = strtolower($description);
                    if (strpos($descLower, 'vehicle') !== false) {
                        $iconType = 'vehicle';
                    } elseif (strpos($descLower, 'person') !== false) {
                        $iconType = 'person';
                    } elseif (strpos($descLower, 'drone') !== false) {
                        $iconType = 'drone';
                    } elseif (strpos($descLower, 'fire') !== false) {
                        $iconType = 'fire';
                    }
                }
                
                try {
                    $iconStmt = $db->prepare('INSERT INTO map_icons (mission_id, icon_type, latitude, longitude, label_text) VALUES (:mission_id, :icon_type, :latitude, :longitude, :label_text)');
                    $iconStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                    $iconStmt->bindValue(':icon_type', $iconType, SQLITE3_TEXT);
                    $iconStmt->bindValue(':latitude', $latitude, SQLITE3_FLOAT);
                    $iconStmt->bindValue(':longitude', $longitude, SQLITE3_FLOAT);
                    $iconStmt->bindValue(':label_text', $name ?: 'Imported Waypoint', SQLITE3_TEXT);
                    $iconStmt->execute();
                    
                    $iconId = $db->lastInsertRowID();
                    
                    $historyStmt = $db->prepare('INSERT INTO map_icon_positions (icon_id, mission_id, latitude, longitude) VALUES (:icon_id, :mission_id, :latitude, :longitude)');
                    $historyStmt->bindValue(':icon_id', $iconId, SQLITE3_INTEGER);
                    $historyStmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                    $historyStmt->bindValue(':latitude', $latitude, SQLITE3_FLOAT);
                    $historyStmt->bindValue(':longitude', $longitude, SQLITE3_FLOAT);
                    $historyStmt->execute();
                    
                    $imported++;
                } catch (Exception $e) {
                    $errors[] = 'Failed to import waypoint: ' . $e->getMessage();
                }
            }
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'imported' => $imported,
                'total' => count($placemarks),
                'errors' => $errors
            ]);
            
        } else {
            http_response_code(400);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Invalid action']);
        }
        
    } else {
        http_response_code(405);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
