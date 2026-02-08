<?php
require_once __DIR__ . '/includes/error_reporting.php';
require_once __DIR__ . '/includes/security_headers.php';
require_once __DIR__ . '/includes/utils.php';
require 'auth.php';
requireAuth();

$config = getConfig();
if (isset($config['timezone'])) {
    date_default_timezone_set($config['timezone']);
}

require_once __DIR__ . '/version.php';

$map_lat = $config['map_default_lat'] ?? 51.1657;
$map_lng = $config['map_default_lng'] ?? 10.4515;
$map_zoom = $config['map_default_zoom'] ?? 6;
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php if (session_status() === PHP_SESSION_NONE) { session_start(); } ?>
    <meta name="csrf-token" content="<?php echo htmlspecialchars(generateCSRFToken(), ENT_QUOTES, 'UTF-8'); ?>">
    <title>Karte - <?php echo $config['navigation_title'] ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/map.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js"></script>
</head>
<body class="map-page">
    <?php include 'includes/header.php'; ?>
    
    <main>
        <!-- Sidebar Toggle Button (visible when sidebar is closed) -->
        <button type="button" id="sidebar-open-btn" class="sidebar-open-btn" title="Sidebar öffnen" style="display: none;">
            <span>☰</span>
        </button>
        
        <!-- Timeline History Mode Info Banner -->
        <div id="timeline-history-info" class="timeline-history-info" style="display: none;">
            <span>📅 Historischer Modus: Icons und Drohnen werden entsprechend dem gewählten Zeitpunkt angezeigt</span>
        </div>
        
        <div id="map"></div>
        
        <!-- Reload Page Button (top right corner of map) -->
        <button type="button" id="reload-page-btn" class="reload-page-btn" title="Seite neu laden">
            🔄
        </button>
        
        <!-- Map Legend (right side) -->
        <div id="map-legend" class="map-legend" style="display: none;">
            <div class="map-legend-header">
                <h3>Legende</h3>
            </div>
            <div id="map-legend-items" class="map-legend-items"></div>
            
            <!-- Share Mission Section -->
            <div id="map-legend-share" class="map-legend-share" style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #e2e8f0; display: none;">
                <button type="button" id="share-current-mission-btn" class="btn-secondary" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;">
                    🔗 Mission teilen
                </button>
            </div>
        </div>
        
        <!-- Unified Sidebar -->
        <div id="sidebar" class="sidebar">
            <div class="sidebar-header">
                <button type="button" id="sidebar-toggle" class="sidebar-toggle-btn" title="Sidebar ein/ausblenden">
                    <span id="sidebar-toggle-icon">◀</span>
                </button>
            </div>
            
            <div class="sidebar-tabs">
                <button type="button" class="sidebar-tab active" data-tab="mission" title="Mission Verwaltung">
                    <span class="tab-icon">📋</span>
                    <span class="tab-label">Mission</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="mission-tools" title="Mission Tools" style="display: none;">
                    <span class="tab-icon">🛠️</span>
                    <span class="tab-label">Tools</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="selection" title="Missions Auswahl">
                    <span class="tab-icon">📂</span>
                    <span class="tab-label">Auswahl</span>
                </button>
                <button type="button" class="sidebar-tab" data-tab="legend" title="Legende">
                    <span class="tab-icon">🎨</span>
                    <span class="tab-label">Legende</span>
                </button>
            </div>
            
            <div class="sidebar-content">
                <!-- Mission Verwaltung Tab -->
                <div id="tab-mission" class="sidebar-tab-content active">
                    <div class="tab-content-header">
                        <h3>Mission Verwaltung</h3>
                    </div>
                    <div class="tab-content-body">
                        <!-- Map Type Selector -->
                        <div class="form-group" style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0;">
                            <label for="map-type-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #1e293b;">Kartentyp:</label>
                            <select id="map-type-select" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; background: white; cursor: pointer;">
                                <option value="osm">Standard</option>
                                <option value="terrain">Gelände</option>
                                <option value="satellite">Satellit</option>
                            </select>
                        </div>
                        
                        <form id="mission-form">
                            <div class="form-group">
                                <label for="mission_id">Mission ID:</label>
                                <input type="text" id="mission_id" name="mission_id" required placeholder="z.B. MISSION-001">
                                <span id="mission_id_display" style="display: none; padding: 0.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.375rem; color: #1e293b; font-weight: 500;"></span>
                            </div>
                            
                            <div class="form-group" id="shape-selection-group">
                                <label>Form auswählen:</label>
                                <div class="shape-buttons">
                                    <button type="button" id="draw-rectangle-btn" class="btn-shape active" data-shape="rectangle">
                                        <span>▭</span> Rechteck
                                    </button>
                                    <button type="button" id="draw-circle-btn" class="btn-shape" data-shape="circle">
                                        <span>○</span> Kreis
                                    </button>
                                    <button type="button" id="draw-ellipse-btn" class="btn-shape" data-shape="ellipse">
                                        <span>⬭</span> Oval
                                    </button>
                                </div>
                                <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; display: block;">
                                    💡 Zeichen-Toolbar erscheint oben links auf der Karte
                                </small>
                            </div>
                            
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.75rem; padding: 0.5rem; border: 2px solid #e2e8f0; border-radius: 0.375rem;">
                                    <input type="checkbox" id="no-raster-mode" style="width: 18px; height: 18px; cursor: pointer;">
                                    <span style="font-weight: 600;">Mission ohne Raster starten</span>
                                </label>
                                <small style="color: #64748b; font-size: 0.8rem; margin-bottom: 0.75rem; display: block;">
                                    💡 Wenn aktiviert, können Sie Icons frei auf der Karte platzieren ohne Raster zu erstellen
                                </small>
                                
                                <div id="raster-mode-container">
                                    <label>Raster-Modus:</label>
                                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem; border: 2px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                                            <input type="radio" name="grid-mode" value="num-areas" id="grid-mode-num-areas" checked style="cursor: pointer;">
                                            <span>Anzahl Bereiche</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem; border: 2px solid #e2e8f0; border-radius: 0.375rem; flex: 1;">
                                            <input type="radio" name="grid-mode" value="field-size" id="grid-mode-field-size" style="cursor: pointer;">
                                            <span>Feldgröße</span>
                                        </label>
                                    </div>
                                    <div id="num-areas-container">
                                        <label for="num_areas">Anzahl Bereiche:</label>
                                        <input type="number" id="num_areas" name="num_areas" min="1" required placeholder="z.B. 10" value="10">
                                        <span id="num_areas_display" style="display: none; padding: 0.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.375rem; color: #1e293b; font-weight: 500;"></span>
                                    </div>
                                    <div id="field-size-container" style="display: none;">
                                        <label for="field_size">Feldgröße (m², quadratisch):</label>
                                        <input type="number" id="field_size" name="field_size" min="1" step="0.1" placeholder="z.B. 100">
                                        <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                                            💡 Quadratische Feldgröße in Quadratmetern (z.B. 100 m² = 10m × 10m)
                                        </small>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <button type="button" id="reset-form-btn" class="btn-clear" style="margin-bottom: 0.5rem;">🔄 Neue Mission</button>
                                <button type="button" id="clear-drawing-btn" class="btn-clear" style="display: none;">Zeichnung löschen</button>
                                <button type="button" id="generate-grid-btn" class="btn-secondary" disabled>Raster erstellen</button>
                                <button type="button" id="create-mission-no-raster-btn" class="btn-secondary" style="display: none;">Mission ohne Raster erstellen</button>
                                <button type="button" id="start-mission-btn" class="btn-primary" disabled>Starte Mission</button>
                                <button type="button" id="stop-mission-btn" class="btn-danger" style="display: none;">Mission beenden</button>
                                <button type="button" id="print-btn" class="btn-secondary" style="margin-top: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; width: 100%;">🖨️ Drucken</button>
                            </div>
                            
                            <div id="mission-status" class="mission-status"></div>
                            <div id="drawing-info" class="drawing-info"></div>
                        </form>
                        
                        <div class="form-group" style="margin-top: 1.5rem; border-top: 2px solid #e2e8f0; padding-top: 1.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="hide-icons-print" style="width: 18px; height: 18px; cursor: pointer;">
                                <span>Icons beim Drucken ausblenden</span>
                            </label>
                            <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; display: block;">
                                💡 Wenn aktiviert, werden alle Icons beim Drucken ausgeblendet
                            </small>
                        </div>
                    </div>
                </div>
                
                <!-- Mission Tools Tab (only visible when mission is active) -->
                <div id="tab-mission-tools" class="sidebar-tab-content" style="display: none;">
                    <div class="tab-content-header">
                        <h3>Mission Tools</h3>
                    </div>
                    <div class="tab-content-body">
                        <div class="form-group">
                            <label>Karten-Icons hinzufügen:</label>
                            <div class="icon-type-buttons">
                                <button type="button" class="icon-type-btn" data-icon-type="vehicle" title="Fahrzeug">
                                    <span>🚗</span>
                                    <small>Fahrzeug</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="person" title="Person">
                                    <span>👤</span>
                                    <small>Person</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="drone" title="Drohne">
                                    <span>🚁</span>
                                    <small>Drohne</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="poi" title="POI">
                                    <span>📍</span>
                                    <small>POI</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="fire" title="Feuer">
                                    <span>🔥</span>
                                    <small>Feuer</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="fire_truck" title="Feuerwehr">
                                    <span>🚒</span>
                                    <small>Feuerwehr</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="ambulance" title="Rettungswagen">
                                    <span>🚑</span>
                                    <small>Rettungswagen</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="police" title="Polizei">
                                    <span>🚔</span>
                                    <small>Polizei</small>
                                </button>
                                <button type="button" class="icon-type-btn" data-icon-type="thw" title="THW">
                                    <span>🚛</span>
                                    <small>THW</small>
                                </button>
                            </div>
                            <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; display: block;">
                                💡 Klicken Sie auf einen Icon-Typ und dann auf die Karte, um ein Icon zu platzieren
                            </small>
                        </div>
                        
                        <div class="form-group" style="margin-top: 1.5rem; border-top: 2px solid #e2e8f0; padding-top: 1.5rem;">
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
                        
                        <!-- KML Export/Import Section -->
                        <div class="form-group" style="margin-top: 1.5rem; border-top: 2px solid #e2e8f0; padding-top: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.75rem; font-weight: 600; color: #1e293b;">DJI KML Export/Import:</label>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <button type="button" id="export-kml-btn" class="btn-secondary" style="width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;">
                                    📤 KML Exportieren
                                </button>
                                <label for="import-kml-file" class="btn-secondary" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; text-align: center; display: block; margin: 0;">
                                    📥 KML Importieren
                                </label>
                                <input type="file" id="import-kml-file" accept=".kml,.xml" style="display: none;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 0.5rem;">
                                    <input type="checkbox" id="include-flight-path" style="width: 18px; height: 18px; cursor: pointer;">
                                    <span style="font-size: 0.875rem;">Flugpfad im Export einschließen</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 0.5rem;">
                                    <input type="checkbox" id="only-fire-icons" style="width: 18px; height: 18px; cursor: pointer;">
                                    <span style="font-size: 0.875rem;">Nur Feuer-Icons exportieren</span>
                                </label>
                            </div>
                            <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; display: block;">
                                💡 Exportieren Sie Wegpunkte als KML für DJI Drohnen oder importieren Sie KML-Dateien
                            </small>
                            <div id="kml-status" style="margin-top: 0.75rem; padding: 0.5rem; border-radius: 0.375rem; display: none; font-size: 0.875rem;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Missions Auswahl Tab -->
                <div id="tab-selection" class="sidebar-tab-content">
                    <div class="tab-content-header">
                        <h3>Missions Auswahl</h3>
                    </div>
                    <div class="tab-content-body">
                        <div id="mission-selection-items" class="mission-selection-items"></div>
                        <div id="mission-selection-loading" class="mission-selection-loading" style="display: none;">Lade Missionen...</div>
                    </div>
                </div>
                
                <!-- Legende Tab -->
                <div id="tab-legend" class="sidebar-tab-content">
                    <div class="tab-content-header">
                        <h3>Legende</h3>
                    </div>
                    <div class="tab-content-body">
                        <button type="button" id="edit-legend-btn" class="btn-secondary" style="margin-bottom: 1rem;">Legende bearbeiten</button>
                        
                        <!-- Progress Section -->
                        <div id="legend-progress-section" class="legend-progress-section" style="margin-bottom: 1rem; padding: 0.75rem; background: #f9fafb; border-radius: 0.375rem; border: 1px solid #e2e8f0; display: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="font-weight: 600; color: #1e293b; font-size: 0.875rem;">Fortschritt</span>
                                <span id="legend-progress-text" style="font-weight: 600; color: #475569; font-size: 0.875rem;">0 / 0</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div id="legend-progress-bar" style="height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); width: 0%; transition: width 0.3s ease; border-radius: 4px;"></div>
                            </div>
                            <div id="legend-progress-label" style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b; text-align: center;">Felder erledigt</div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <input type="text" id="legend-search-input" placeholder="🔍 Feld-ID oder Text suchen..." 
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.875rem;">
                        </div>
                        <div id="legend-items" class="legend-items"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Zeitstrahl Open Button (visible when timeline is closed) -->
        <button type="button" id="zeitstrahl-open-btn" class="zeitstrahl-open-btn" title="Zeitstrahl öffnen" style="display: none;">
            <span>⏱️</span>
        </button>
        
        <div id="zeitstrahl" class="zeitstrahl" style="display: none;">
            <div class="zeitstrahl-header">
                <span id="zeitstrahl-mission-name"></span>
                <button type="button" id="close-zeitstrahl-btn" class="close-zeitstrahl-btn" title="Zeitstrahl schließen">×</button>
            </div>
            <div class="zeitstrahl-controls">
                <button type="button" id="zeitstrahl-live" class="zeitstrahl-btn zeitstrahl-live-btn" title="Live Modus">🔴 Live</button>
                <button type="button" id="zeitstrahl-play-pause" class="zeitstrahl-btn" title="Play/Pause">▶</button>
                <div class="zeitstrahl-slider-container">
                    <input type="range" id="zeitstrahl-slider" class="zeitstrahl-slider" min="0" max="100" value="0" step="1">
                    <div class="zeitstrahl-time-display">
                        <span id="zeitstrahl-start-time"></span> / <span id="zeitstrahl-current-time"></span>
                    </div>
                </div>
                <button type="button" id="zeitstrahl-speed" class="zeitstrahl-btn" title="Geschwindigkeit">1x</button>
            </div>
        </div>
    </main>
    
    <?php include 'includes/footer.php'; ?>
    
    <script>
        window.APP_CONFIG = {
            logLevel: <?= json_encode($config['log_level'] ?? 'info') ?>
        };
        
        const map = L.map('map').setView([<?= $map_lat ?>, <?= $map_lng ?>], <?= $map_zoom ?>);
        window.map = map;
    </script>
    <script src="js/cache.js"></script>
    <script src="js/utils/logger.js"></script>
    <script>
        if (window.fileLogger && window.APP_CONFIG && window.APP_CONFIG.logLevel) {
            window.fileLogger.setLogLevel(window.APP_CONFIG.logLevel);
        }
    </script>
    <script src="js/map-init.js"></script>
    
    <script src="js/map-utils.js"></script>
    <script src="js/modules/map-type-manager.js"></script>
    <script src="js/modules/sidebar-manager.js"></script>
    <script src="js/modules/mission-manager.js"></script>
    <script src="js/modules/share-manager.js"></script>
    <script src="js/modules/mission-selection-manager.js"></script>
    <script src="js/modules/zeitstrahl-manager.js"></script>
    <script src="js/modules/kml-manager.js"></script>
</body>
</html>


