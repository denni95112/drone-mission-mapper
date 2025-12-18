<?php
require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';
require_once __DIR__ . '/../includes/utils.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../auth.php';
if (!isAuthenticated()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');

define('ADDRESS_CACHE_TOLERANCE', 0.0001);

/**
 * Get cached address for GPS coordinates with tolerance
 * @param SQLite3 $db Database connection
 * @param float $latitude Latitude
 * @param float $longitude Longitude
 * @return string|false Cached address or false if not found
 */
function getCachedAddress($db, $latitude, $longitude) {
    $tolerance = ADDRESS_CACHE_TOLERANCE;
    
    $stmt = $db->prepare('
        SELECT address 
        FROM address_cache 
        WHERE ABS(latitude - :lat) <= :tolerance 
          AND ABS(longitude - :lng) <= :tolerance
        ORDER BY (ABS(latitude - :lat2) + ABS(longitude - :lng2)) ASC
        LIMIT 1
    ');
    
    $stmt->bindValue(':lat', $latitude, SQLITE3_FLOAT);
    $stmt->bindValue(':lng', $longitude, SQLITE3_FLOAT);
    $stmt->bindValue(':lat2', $latitude, SQLITE3_FLOAT);
    $stmt->bindValue(':lng2', $longitude, SQLITE3_FLOAT);
    $stmt->bindValue(':tolerance', $tolerance, SQLITE3_FLOAT);
    
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);
    
    if ($row && !empty($row['address'])) {
        return $row['address'];
    }
    
    return false;
}

/**
 * Cache address for GPS coordinates
 * @param SQLite3 $db Database connection
 * @param float $latitude Latitude
 * @param float $longitude Longitude
 * @param string $address Address to cache
 */
function cacheAddress($db, $latitude, $longitude, $address) {
    if (empty($address)) {
        return;
    }
    
    try {
        $tolerance = ADDRESS_CACHE_TOLERANCE;
        $checkStmt = $db->prepare('
            SELECT id FROM address_cache 
            WHERE ABS(latitude - :lat) <= :tolerance 
              AND ABS(longitude - :lng) <= :tolerance
            LIMIT 1
        ');
        $checkStmt->bindValue(':lat', $latitude, SQLITE3_FLOAT);
        $checkStmt->bindValue(':lng', $longitude, SQLITE3_FLOAT);
        $checkStmt->bindValue(':tolerance', $tolerance, SQLITE3_FLOAT);
        $checkResult = $checkStmt->execute();
        $existing = $checkResult->fetchArray(SQLITE3_ASSOC);
        
        if ($existing) {
            $updateStmt = $db->prepare('
                UPDATE address_cache 
                SET address = :address, cached_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ');
            $updateStmt->bindValue(':address', $address, SQLITE3_TEXT);
            $updateStmt->bindValue(':id', $existing['id'], SQLITE3_INTEGER);
            $updateStmt->execute();
        } else {
            $stmt = $db->prepare('
                INSERT INTO address_cache (latitude, longitude, address)
                VALUES (:lat, :lng, :address)
            ');
            
            $stmt->bindValue(':lat', $latitude, SQLITE3_FLOAT);
            $stmt->bindValue(':lng', $longitude, SQLITE3_FLOAT);
            $stmt->bindValue(':address', $address, SQLITE3_TEXT);
            
            $stmt->execute();
        }
    } catch (Exception $e) {
        throw $e;
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'start_export') {
        $missionId = trim($_POST['mission_id'] ?? '');
        
        if (empty($missionId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Mission ID is required']);
            exit;
        }
        
        try {
            $db = getDB();
            
            $result = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='address_cache'");
            $tableExists = false;
            if ($result) {
                $row = $result->fetchArray();
                $tableExists = ($row !== false);
            }
            
            if (!$tableExists) {
                $createTableSql = 'CREATE TABLE IF NOT EXISTS address_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    address TEXT NOT NULL,
                    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )';
                
                if ($db->exec($createTableSql)) {
                    $db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_lat_lng ON address_cache(latitude, longitude)');
                    $db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_cached_at ON address_cache(cached_at)');
                }
            }
            
            $sql = 'SELECT mip.*, mi.icon_type, mi.label_text 
                    FROM map_icon_positions mip
                    JOIN map_icons mi ON mip.icon_id = mi.id
                    WHERE mip.mission_id = :mission_id
                    ORDER BY mip.recorded_at ASC';
            
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $result = $stmt->execute();
            
            $positions = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $positions[] = [
                    'timestamp' => $row['recorded_at'],
                    'label' => $row['label_text'] ?? '',
                    'icon_type' => $row['icon_type'] ?? '',
                    'latitude' => floatval($row['latitude']),
                    'longitude' => floatval($row['longitude'])
                ];
            }
            
            $exportId = uniqid('export_', true);
            $exportDir = __DIR__ . '/../tmp/exports';
            if (!is_dir($exportDir)) {
                mkdir($exportDir, 0755, true);
            }
            
            $exportFile = $exportDir . '/' . $exportId . '.json';
            $exportData = [
                'mission_id' => $missionId,
                'positions' => $positions,
                'total' => count($positions),
                'processed' => 0,
                'results' => [],
                'created' => time()
            ];
            
            file_put_contents($exportFile, json_encode($exportData), LOCK_EX);
            
            $_SESSION['export_' . $exportId] = [
                'file' => $exportFile,
                'created' => time()
            ];
            
            echo json_encode([
                'success' => true,
                'export_id' => $exportId,
                'total' => count($positions)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Error starting export: ' . $e->getMessage()
            ]);
        }
    } elseif ($action === 'get_progress') {
        $exportId = trim($_POST['export_id'] ?? '');
        
        if (empty($exportId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Export ID is required']);
            exit;
        }
        
        if (!isset($_SESSION['export_' . $exportId])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Export not found']);
            exit;
        }
        
        $exportRef = $_SESSION['export_' . $exportId];
        if (!isset($exportRef['file']) || !file_exists($exportRef['file'])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Export file not found']);
            exit;
        }
        
        $exportData = json_decode(file_get_contents($exportRef['file']), true);
        if (!$exportData) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to read export data']);
            exit;
        }
        
        echo json_encode([
            'success' => true,
            'processed' => $exportData['processed'],
            'total' => $exportData['total'],
            'completed' => $exportData['processed'] >= $exportData['total']
        ]);
    } elseif ($action === 'process_batch') {
        $exportId = trim($_POST['export_id'] ?? '');
        $batchSize = isset($_POST['batch_size']) ? intval($_POST['batch_size']) : 10;
        
        if (empty($exportId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Export ID is required']);
            exit;
        }
        
        if (!isset($_SESSION['export_' . $exportId])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Export not found']);
            exit;
        }
        
        $db = null;
        try {
            $db = getDB();
            
            $result = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='address_cache'");
            $tableExists = false;
            if ($result) {
                $row = $result->fetchArray();
                $tableExists = ($row !== false);
            }
            
            if (!$tableExists) {
                $createTableSql = 'CREATE TABLE IF NOT EXISTS address_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    address TEXT NOT NULL,
                    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )';
                
                if ($db->exec($createTableSql)) {
                    $db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_lat_lng ON address_cache(latitude, longitude)');
                    $db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_cached_at ON address_cache(cached_at)');
                }
            }
        } catch (Exception $e) {
            $logsDir = __DIR__ . '/../logs';
            if (!is_dir($logsDir)) {
                mkdir($logsDir, 0755, true);
            }
            $logFilename = 'export-cache-' . date('Y-m-d') . '.log';
            $logPath = $logsDir . '/' . $logFilename;
            $logEntry = sprintf(
                "[%s] Database connection ERROR: %s\n",
                date('Y-m-d H:i:s'),
                $e->getMessage()
            );
            @file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
        }
        
        $exportRef = $_SESSION['export_' . $exportId];
        if (!isset($exportRef['file']) || !file_exists($exportRef['file'])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Export file not found']);
            exit;
        }
        
        $exportData = json_decode(file_get_contents($exportRef['file']), true);
        if (!$exportData) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to read export data']);
            exit;
        }
        
        $positions = $exportData['positions'];
        $processed = $exportData['processed'];
        $total = $exportData['total'];
        
        $batch = array_slice($positions, $processed, $batchSize);
        $results = [];
        
        if (!isset($exportData['cache_stats'])) {
            $exportData['cache_stats'] = [
                'hits' => 0,
                'misses' => 0
            ];
        }
        $cacheStats = &$exportData['cache_stats'];
        
        if (!isset($exportData['results'])) {
            $exportData['results'] = [];
        }
        
        foreach ($batch as $pos) {
            $address = '';
            
            $cachedAddress = false;
            if ($db) {
                try {
                    $cachedAddress = getCachedAddress($db, $pos['latitude'], $pos['longitude']);
                } catch (Exception $e) {
                    $logsDir = __DIR__ . '/../logs';
                    if (!is_dir($logsDir)) {
                        mkdir($logsDir, 0755, true);
                    }
                    $logFilename = 'export-cache-' . date('Y-m-d') . '.log';
                    $logPath = $logsDir . '/' . $logFilename;
                    $logEntry = sprintf(
                        "[%s] Cache lookup ERROR [%s]: %s | Position: %.6f, %.6f\n",
                        date('Y-m-d H:i:s'),
                        $exportId,
                        $e->getMessage(),
                        $pos['latitude'],
                        $pos['longitude']
                    );
                    @file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
                }
            }
            
            if ($cachedAddress !== false && !empty($cachedAddress)) {
                $address = $cachedAddress;
                $cacheStats['hits']++;
            } else {
                $cacheStats['misses']++;
                try {
                    $url = sprintf(
                        'https://nominatim.openstreetmap.org/reverse?format=json&lat=%.6f&lon=%.6f&zoom=18&addressdetails=1',
                        $pos['latitude'],
                        $pos['longitude']
                    );
                    
                    if ($processed > 0) {
                        usleep(1100000);
                    }
                    
                    $context = stream_context_create([
                        'http' => [
                            'method' => 'GET',
                            'header' => [
                                'User-Agent: DroneMissionMapper/1.0'
                            ],
                            'timeout' => 5
                        ]
                    ]);
                    
                    $response = @file_get_contents($url, false, $context);
                    if ($response) {
                        $data = json_decode($response, true);
                        if (isset($data['display_name'])) {
                            $address = $data['display_name'];
                            if ($db) {
                                try {
                                    cacheAddress($db, $pos['latitude'], $pos['longitude'], $address);
                                } catch (Exception $e) {
                                    $logsDir = __DIR__ . '/../logs';
                                    if (!is_dir($logsDir)) {
                                        mkdir($logsDir, 0755, true);
                                    }
                                    $logFilename = 'export-cache-' . date('Y-m-d') . '.log';
                                    $logPath = $logsDir . '/' . $logFilename;
                                    $logEntry = sprintf(
                                        "[%s] Cache store ERROR [%s]: %s | Position: %.6f, %.6f\n",
                                        date('Y-m-d H:i:s'),
                                        $exportId,
                                        $e->getMessage(),
                                        $pos['latitude'],
                                        $pos['longitude']
                                    );
                                    @file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
                                }
                            }
                        }
                    }
                } catch (Exception $e) {
                    error_log('Reverse geocoding failed: ' . $e->getMessage());
                }
            }
            
            $results[] = [
                'timestamp' => $pos['timestamp'],
                'label' => $pos['label'],
                'icon_type' => $pos['icon_type'],
                'latitude' => $pos['latitude'],
                'longitude' => $pos['longitude'],
                'address' => $address
            ];
        }
        
        $exportData['processed'] = min($processed + count($batch), $total);
        if (!isset($exportData['results'])) {
            $exportData['results'] = [];
        }
        $exportData['results'] = array_merge($exportData['results'], $results);
        
        file_put_contents($exportRef['file'], json_encode($exportData), LOCK_EX);
        
        $totalCacheRequests = $cacheStats['hits'] + $cacheStats['misses'];
        $cacheHitRate = $totalCacheRequests > 0 ? round(($cacheStats['hits'] / $totalCacheRequests) * 100, 1) : 0;
        
        $logsDir = __DIR__ . '/../logs';
        if (!is_dir($logsDir)) {
            mkdir($logsDir, 0755, true);
        }
        $logFilename = 'export-cache-' . date('Y-m-d') . '.log';
        $logPath = $logsDir . '/' . $logFilename;
        $logEntry = sprintf(
            "[%s] Export ID: %s | Hits: %d | Misses: %d | Hit Rate: %.1f%% | Processed: %d/%d\n",
            date('Y-m-d H:i:s'),
            $exportId,
            $cacheStats['hits'],
            $cacheStats['misses'],
            $cacheHitRate,
            $exportData['processed'],
            $total
        );
        @file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
        
        echo json_encode([
            'success' => true,
            'results' => $results,
            'processed' => $exportData['processed'],
            'total' => $total,
            'completed' => $exportData['processed'] >= $total,
            'cache_stats' => [
                'hits' => $cacheStats['hits'],
                'misses' => $cacheStats['misses'],
                'hit_rate' => $cacheHitRate
            ]
        ]);
    } elseif ($action === 'get_csv') {
        $exportId = trim($_POST['export_id'] ?? '');
        
        if (empty($exportId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Export ID is required']);
            exit;
        }
        
        if (!isset($_SESSION['export_' . $exportId])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Export not found']);
            exit;
        }
        
        $exportRef = $_SESSION['export_' . $exportId];
        if (!isset($exportRef['file']) || !file_exists($exportRef['file'])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Export file not found']);
            exit;
        }
        
        $exportData = json_decode(file_get_contents($exportRef['file']), true);
        if (!$exportData) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to read export data']);
            exit;
        }
        
        $allResults = $exportData['results'] ?? [];
        
        $csv = [];
        $csv[] = 'Zeitstempel,Bezeichnung,Icon-Typ,GPS,Adresse';
        
        foreach ($allResults as $row) {
            $csv[] = sprintf(
                '"%s","%s","%s","%.6f,%.6f","%s"',
                str_replace('"', '""', $row['timestamp']),
                str_replace('"', '""', $row['label']),
                str_replace('"', '""', $row['icon_type']),
                $row['latitude'],
                $row['longitude'],
                str_replace('"', '""', $row['address'])
            );
        }
        
        $csvContent = implode("\n", $csv);
        
        unset($_SESSION['export_' . $exportId]);
        @unlink($exportRef['file']);
        
        echo json_encode([
            'success' => true,
            'csv' => $csvContent
        ]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

