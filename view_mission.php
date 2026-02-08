<?php
require_once __DIR__ . '/includes/error_reporting.php';
require_once __DIR__ . '/includes/security_headers.php';
require_once __DIR__ . '/includes/utils.php';

$missionId = trim($_GET['mission_id'] ?? '');
$shareToken = trim($_GET['token'] ?? '');

if (empty($missionId) || !validateMissionId($missionId)) {
    header('Location: map.php');
    exit;
}

$authenticated = false;
$isTokenAccess = false;
if (!empty($shareToken)) {
    try {
        $db = getDB();
        
        if (verifyShareToken($db, $missionId, $shareToken)) {
            $authenticated = true;
            $isTokenAccess = true;
        } else {
            http_response_code(403);
            die('Ungültiger oder abgelaufener Share-Token. Bitte melden Sie sich an, um auf diese Mission zuzugreifen.');
        }
    } catch (Exception $e) {
        error_log('Error verifying share token: ' . $e->getMessage());
        http_response_code(500);
        die('Fehler bei der Token-Überprüfung.');
    }
} else {
    require 'auth.php';
    requireAuth();
    $authenticated = true;
    $isTokenAccess = false;
}

$config = getConfig();
if (isset($config['timezone'])) {
    date_default_timezone_set($config['timezone']);
}

require_once __DIR__ . '/version.php';

$map_lat = $config['map_default_lat'] ?? 51.1657;
$map_lng = $config['map_default_lng'] ?? 10.4515;
$map_zoom = $config['map_default_zoom'] ?? 6;

$missionData = null;
try {
    if (!isset($db)) {
        $db = getDB();
    }
    
    $stmt = $db->prepare('SELECT * FROM missions WHERE mission_id = :mission_id');
    $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
    $result = $stmt->execute();
    $missionData = $result->fetchArray(SQLITE3_ASSOC);
    
    if ($missionData) {
        foreach ($missionData as $key => $value) {
            if ($value === null) {
                $missionData[$key] = '';
            }
        }
        
        $debugMode = $config['debugMode'] ?? false;
        if ($debugMode) {
            error_log('Mission data loaded for: ' . $missionId);
        }
        
        if ($missionData['center_lat'] && $missionData['center_lng']) {
            $map_lat = floatval($missionData['center_lat']);
            $map_lng = floatval($missionData['center_lng']);
            $map_zoom = 15;
        }
        
        if (isset($missionData['bounds_ne_lat'])) {
            $missionData['bounds_ne_lat'] = $missionData['bounds_ne_lat'] !== '' ? floatval($missionData['bounds_ne_lat']) : '';
        }
        if (isset($missionData['bounds_ne_lng'])) {
            $missionData['bounds_ne_lng'] = $missionData['bounds_ne_lng'] !== '' ? floatval($missionData['bounds_ne_lng']) : '';
        }
        if (isset($missionData['bounds_sw_lat'])) {
            $missionData['bounds_sw_lat'] = $missionData['bounds_sw_lat'] !== '' ? floatval($missionData['bounds_sw_lat']) : '';
        }
        if (isset($missionData['bounds_sw_lng'])) {
            $missionData['bounds_sw_lng'] = $missionData['bounds_sw_lng'] !== '' ? floatval($missionData['bounds_sw_lng']) : '';
        }
        if (isset($missionData['num_areas'])) {
            $missionData['num_areas'] = $missionData['num_areas'] !== '' ? intval($missionData['num_areas']) : 0;
        }
        
        if (!empty($missionData['done_fields'])) {
            $decoded = json_decode($missionData['done_fields'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $missionData['done_fields_parsed'] = $decoded;
            } else {
                $missionData['done_fields_parsed'] = [];
            }
        } else {
            $missionData['done_fields_parsed'] = [];
        }
    } else {
        header('Location: map.php');
        exit;
    }
} catch (Exception $e) {
    error_log('Error loading mission: ' . $e->getMessage());
    header('Location: map.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <?php if (session_status() === PHP_SESSION_NONE) { session_start(); } ?>
    <meta name="csrf-token" content="<?php echo htmlspecialchars(generateCSRFToken(), ENT_QUOTES, 'UTF-8'); ?>">
    <title>Mission anzeigen: <?php echo htmlspecialchars($missionId) ?> - <?php echo $config['navigation_title'] ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/map.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/view_mission.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <!-- Load cache utility first -->
    <script src="js/cache.js"></script>
    <script src="js/utils/logger.js"></script>
    <script>
        if (window.fileLogger && window.APP_CONFIG && window.APP_CONFIG.logLevel) {
            window.fileLogger.setLogLevel(window.APP_CONFIG.logLevel);
        }
    </script>
    <script src="js/map-utils.js"></script>
    <script src="js/modules/map-type-manager.js"></script>
    <script src="js/modules/sidebar-manager.js"></script>
    <script src="js/modules/view-only-mission-manager.js"></script>
    <script src="js/view-mission-init.js"></script>
</head>
<body<?php echo $isTokenAccess ? ' class="token-access view-mission-page"' : ' class="view-mission-page"'; ?>>
    <?php if (!$isTokenAccess): ?>
        <?php include 'includes/header.php'; ?>
    <?php endif; ?>
    
    <div class="view-only-notice">
        📋 Ansichtsmodus - Nur Anzeige
    </div>
    
    <?php 
    $hasBounds = !empty($missionData['bounds_ne_lat']) && !empty($missionData['bounds_sw_lat']) && 
                 $missionData['bounds_ne_lat'] !== null && $missionData['bounds_sw_lat'] !== null;
    $hasNumAreas = !empty($missionData['num_areas']) && $missionData['num_areas'] > 0;
    ?>
    
    <?php if (!$hasBounds || !$hasNumAreas): ?>
        <div style="position: fixed; top: <?php echo $isTokenAccess ? '60px' : '120px'; ?>; right: 20px; background: #fee2e2; border: 2px solid #fecaca; border-radius: 8px; padding: 1rem; z-index: 1000; max-width: 350px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); pointer-events: auto;">
            <strong style="color: #991b1b;">⚠️ Warnung</strong>
            <p style="color: #991b1b; margin: 0.5rem 0 0 0; font-size: 0.875rem;">
                <?php if (!$hasBounds): ?>
                    Diese Mission hat keine Bounds-Daten gespeichert.<br>
                <?php endif; ?>
                <?php if (!$hasNumAreas): ?>
                    Diese Mission hat keine Raster-Daten (num_areas).<br>
                <?php endif; ?>
                Die Visualisierung kann nicht angezeigt werden. Bitte erstellen Sie die Mission neu mit einem Raster.
            </p>
            <p style="color: #991b1b; margin: 0.5rem 0 0 0; font-size: 0.75rem;">
                <strong>Debug Info:</strong><br>
                Bounds NE: <?php echo htmlspecialchars($missionData['bounds_ne_lat'] ?? 'NULL') ?><br>
                Bounds SW: <?php echo htmlspecialchars($missionData['bounds_sw_lat'] ?? 'NULL') ?><br>
                Num Areas: <?php echo htmlspecialchars($missionData['num_areas'] ?? 'NULL') ?>
            </p>
        </div>
    <?php endif; ?>
    
    <main>
        <!-- Sidebar Toggle Button (visible when sidebar is closed) -->
        <button type="button" id="sidebar-open-btn" class="sidebar-open-btn" title="Sidebar öffnen" style="display: none;">
            <span>☰</span>
        </button>
        
        <div id="map"></div>
        
        <!-- Map Legend (right side) -->
        <div id="map-legend" class="map-legend" style="display: none;">
            <div class="map-legend-header">
                <h3>Legende</h3>
                <button type="button" id="map-legend-close-btn" class="map-legend-close-btn" title="Legende schließen" aria-label="Legende schließen">
                    <span>×</span>
                </button>
            </div>
            <div id="map-legend-items" class="map-legend-items"></div>
        </div>
        
        <!-- Map Legend Toggle Button (mobile only, shown when legend is closed) -->
        <button type="button" id="map-legend-toggle-btn" class="map-legend-toggle-btn" title="Legende anzeigen" aria-label="Legende anzeigen" style="display: none;">
            <span>📋 Legende</span>
        </button>
        
        <!-- Sidebar Backdrop (mobile only) -->
        <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
        
        <!-- Unified Sidebar -->
        <div id="sidebar" class="sidebar">
            <div class="sidebar-header">
                <button type="button" id="sidebar-toggle" class="sidebar-toggle-btn" title="Sidebar ein/ausblenden">
                    <span id="sidebar-toggle-icon">◀</span>
                </button>
            </div>
            
            <div class="mission-info-header">
                <h2><?php echo htmlspecialchars($missionId) ?></h2>
                <div class="mission-meta">
                    <?php
                    $statusText = [
                        'pending' => 'Ausstehend',
                        'active' => 'Aktiv',
                        'completed' => 'Abgeschlossen'
                    ];
                    echo htmlspecialchars($statusText[$missionData['status']] ?? $missionData['status']);
                    if ($missionData['num_areas']) {
                        echo ' • ' . htmlspecialchars($missionData['num_areas']) . ' Bereiche';
                    }
                    ?>
                </div>
            </div>
            
            <!-- Map Type Selector -->
            <div class="form-group" style="margin-top: 1rem; padding: 0 1.5rem;">
                <label for="map-type-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #1e293b; font-size: 0.9rem;">Kartentyp:</label>
                <select id="map-type-select" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; background: white; cursor: pointer;">
                    <option value="osm">Standard</option>
                    <option value="terrain">Gelände</option>
                    <option value="satellite">Satellit</option>
                </select>
            </div>
            
            <!-- Movement Toggle -->
            <div class="form-group" style="margin-top: 1.5rem; border-top: 2px solid #e2e8f0; padding: 1rem 1.5rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="show-movement-toggle" style="width: 18px; height: 18px; cursor: pointer;">
                    <span>Zeige Bewegung</span>
                </label>
                <div id="icon-movement-select-container" style="margin-top: 0.75rem; display: none;">
                    <label for="icon-movement-select" style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #475569;">Icon auswählen:</label>
                    <select id="icon-movement-select" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; background: white;">
                        <option value="all">Alle Icons</option>
                    </select>
                </div>
                <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; display: block;">
                    💡 Zeigt die Bewegungswege aller oder ausgewählter Icons mit Verbindungslinien (deaktiviert Zeitstrahl)
                </small>
            </div>
            
            <!-- GPS Sharing -->
            <div class="form-group" style="margin-top: 1.5rem; border-top: 2px solid #e2e8f0; padding: 1rem 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600;">📍 GPS Position teilen</h4>
                <div style="margin-bottom: 0.75rem;">
                    <label for="gps-name" style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500;">Name:</label>
                    <input type="text" id="gps-name" placeholder="Ihr Name" 
                           style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; font-size: 0.875rem;">
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500;">Icon-Typ:</label>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                            <input type="radio" name="gps-icon-type" value="vehicle" checked style="cursor: pointer;">
                            <span>🚗 Fahrzeug</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                            <input type="radio" name="gps-icon-type" value="person" style="cursor: pointer;">
                            <span>👤 Person</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                            <input type="radio" name="gps-icon-type" value="fire_truck" style="cursor: pointer;">
                            <span>🚒 Feuerwehr</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                            <input type="radio" name="gps-icon-type" value="ambulance" style="cursor: pointer;">
                            <span>🚑 RTW</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                            <input type="radio" name="gps-icon-type" value="police" style="cursor: pointer;">
                            <span>🚔 Polizei</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                            <input type="radio" name="gps-icon-type" value="thw" style="cursor: pointer;">
                            <span>🚛 THW</span>
                        </label>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-direction: column;">
                    <button type="button" id="send-gps-once-btn" 
                            style="padding: 0.5rem 1rem; background-color: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; font-size: 0.875rem;">
                        📍 GPS einmal senden
                    </button>
                    <button type="button" id="send-gps-continuous-btn" 
                            style="padding: 0.5rem 1rem; background-color: #10b981; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; font-size: 0.875rem;">
                        <span id="gps-continuous-text">🔄 GPS alle 30 Sek. senden</span>
                    </button>
                </div>
                <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.5rem; display: block;">
                    💡 Ihre Position wird auf der Karte für alle sichtbar angezeigt
                </small>
            </div>
        </div>
    </main>
    
    <?php include 'includes/footer.php'; ?>
    
    <script>
        window.APP_CONFIG = {
            logLevel: <?= json_encode($config['log_level'] ?? 'info') ?>
        };
        
        window.viewMissionConfig = {
            mapLat: <?= $map_lat ?>,
            mapLng: <?= $map_lng ?>,
            mapZoom: <?= $map_zoom ?>,
            missionData: <?= json_encode($missionData, JSON_NUMERIC_CHECK) ?>,
            missionId: <?= json_encode($missionId) ?>
        };
    </script>
    <script src="js/view-mission-init.js"></script>
    <script>
        if (typeof initViewMissionMap === 'function') {
            initViewMissionMap(
                window.viewMissionConfig.mapLat,
                window.viewMissionConfig.mapLng,
                window.viewMissionConfig.mapZoom,
                window.viewMissionConfig.missionData,
                window.viewMissionConfig.missionId
            );
        } else {
            console.error('initViewMissionMap function not found. Make sure view-mission-init.js is loaded.');
        }
    </script>
</body>
</html>
