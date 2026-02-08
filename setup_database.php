<?php
require_once __DIR__ . '/includes/error_reporting.php';
require_once __DIR__ . '/includes/utils.php';

$dbPath = getDatabasePath();

$dbDir = dirname($dbPath);
if (!is_dir($dbDir)) {
    if (!@mkdir($dbDir, 0755, true)) {
        $error = "FEHLER: Das Verzeichnis für die Datenbank konnte nicht erstellt werden.\n\n";
        $error .= "Pfad: " . htmlspecialchars($dbDir) . "\n\n";
        $error .= "LÖSUNG:\n";
        $error .= "1. Erstellen Sie das Verzeichnis manuell:\n";
        $error .= "   sudo mkdir -p " . htmlspecialchars($dbDir) . "\n\n";
        $error .= "2. Setzen Sie die Berechtigungen:\n";
        $error .= "   sudo chown -R www-data:www-data " . htmlspecialchars($dbDir) . "\n";
        $error .= "   sudo chmod -R 755 " . htmlspecialchars($dbDir) . "\n\n";
        $error .= "Hinweis: Ersetzen Sie 'www-data' durch den Benutzer Ihres Webservers\n";
        $error .= "(z.B. 'apache', 'nginx', 'httpd' oder 'www-data').\n";
        die("<pre>" . $error . "</pre>");
    }
}

if (!is_writable($dbDir)) {
    $error = "FEHLER: Das Verzeichnis für die Datenbank ist nicht beschreibbar.\n\n";
    $error .= "Pfad: " . htmlspecialchars($dbDir) . "\n\n";
    $error .= "LÖSUNG:\n";
    $error .= "Setzen Sie Schreibrechte für das Verzeichnis:\n";
    $error .= "   sudo chown -R www-data:www-data " . htmlspecialchars($dbDir) . "\n";
    $error .= "   sudo chmod -R 755 " . htmlspecialchars($dbDir) . "\n\n";
    $error .= "Hinweis: Ersetzen Sie 'www-data' durch den Benutzer Ihres Webservers.\n";
    die("<pre>" . $error . "</pre>");
}

try {
    $db = new SQLite3($dbPath);
} catch (Exception $e) {
    $error = "FEHLER: Die Datenbankdatei konnte nicht erstellt/geöffnet werden.\n\n";
    $error .= "Pfad: " . htmlspecialchars($dbPath) . "\n\n";
    $error .= "Mögliche Ursachen:\n";
    $error .= "1. Unzureichende Berechtigungen im Verzeichnis\n";
    $error .= "2. Das Verzeichnis existiert nicht\n";
    $error .= "3. Der Webserver-Benutzer hat keine Schreibrechte\n\n";
    $error .= "LÖSUNG:\n";
    $error .= "1. Stellen Sie sicher, dass das Verzeichnis existiert:\n";
    $error .= "   sudo mkdir -p " . htmlspecialchars($dbDir) . "\n\n";
    $error .= "2. Setzen Sie die Berechtigungen:\n";
    $error .= "   sudo chown -R www-data:www-data " . htmlspecialchars($dbDir) . "\n";
    $error .= "   sudo chmod -R 755 " . htmlspecialchars($dbDir) . "\n\n";
    $error .= "3. Falls die Datei bereits existiert, prüfen Sie deren Berechtigungen:\n";
    $error .= "   sudo chown www-data:www-data " . htmlspecialchars($dbPath) . "\n";
    $error .= "   sudo chmod 644 " . htmlspecialchars($dbPath) . "\n\n";
    $error .= "Hinweis: Ersetzen Sie 'www-data' durch den Benutzer Ihres Webservers\n";
    $error .= "(z.B. 'apache', 'nginx', 'httpd' oder 'www-data').\n\n";
    $error .= "Original-Fehlermeldung: " . htmlspecialchars($e->getMessage()) . "\n";
    die("<pre>" . $error . "</pre>");
}

try {
    $db->exec('PRAGMA foreign_keys = ON');
} catch (Exception $e) {
    $error = "FEHLER: Datenbankkonfiguration fehlgeschlagen.\n\n";
    $error .= "Original-Fehlermeldung: " . htmlspecialchars($e->getMessage()) . "\n";
    die("<pre>" . $error . "</pre>");
}

$db->exec('CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER DEFAULT 1,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)');

$result = $db->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='missions'");
$oldTable = $result->fetchArray(SQLITE3_ASSOC);

if ($oldTable && strpos($oldTable['sql'], 'title') !== false) {
    $db->exec('DROP TABLE IF EXISTS missions');
}

$db->exec('CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL UNIQUE,
    grid_length INTEGER,
    grid_height INTEGER,
    field_size REAL,
    center_lat REAL,
    center_lng REAL,
    shape_type TEXT,
    bounds_ne_lat REAL,
    bounds_ne_lng REAL,
    bounds_sw_lat REAL,
    bounds_sw_lng REAL,
    num_areas INTEGER,
    status TEXT NOT NULL DEFAULT "pending",
    share_token TEXT,
    legend_data TEXT,
    started_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)');

try {
    $db->exec('ALTER TABLE missions ADD COLUMN legend_data TEXT');
} catch (Exception $e) {
}

$db->exec('CREATE TABLE IF NOT EXISTS drone_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL,
    drone_id INTEGER NOT NULL,
    drone_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    height REAL NOT NULL,
    battery INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES missions(mission_id) ON DELETE CASCADE
)');

$db->exec('CREATE TABLE IF NOT EXISTS map_icons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL,
    icon_type TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    label_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES missions(mission_id) ON DELETE CASCADE
)');

$db->exec('CREATE TABLE IF NOT EXISTS map_icon_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon_id INTEGER NOT NULL,
    mission_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
)');

$db->exec('CREATE TABLE IF NOT EXISTS address_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
)');

$db->exec('CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_missions_mission_id ON missions(mission_id)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_missions_share_token ON missions(share_token)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_mission_id ON drone_positions(mission_id)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_recorded_at ON drone_positions(recorded_at)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_drone_id ON drone_positions(drone_id)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_mission_id ON map_icons(mission_id)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_created_at ON map_icons(created_at)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_icon_id ON map_icon_positions(icon_id)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_mission_id ON map_icon_positions(mission_id)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_recorded_at ON map_icon_positions(recorded_at)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_lat_lng ON address_cache(latitude, longitude)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_cached_at ON address_cache(cached_at)');

// Notify install tracking webhook (fire-and-forget)
require_once __DIR__ . '/version.php';
if (function_exists('sendInstallTrackingWebhook')) {
    sendInstallTrackingWebhook(GITHUB_REPO_NAME, (string) APP_VERSION);
}

echo "Database setup completed successfully! Redirecting...";

header("Refresh: 2; url=index.php");
exit;

