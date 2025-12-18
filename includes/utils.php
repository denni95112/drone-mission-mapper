<?php
/**
 * Utility functions for security and common operations
 */

/**
 * Get database path from config, with fallback to default location
 * Normalizes paths for Windows and Linux
 */
function getDatabasePath() {
    $config = [];
    $configFile = __DIR__ . '/../config/config.php';
    if (file_exists($configFile)) {
        $config = @include $configFile;
        if (!is_array($config)) {
            $config = [];
        }
    }
    
    $dbPath = $config['database_path'] ?? null;
    
    if ($dbPath) {
        $dbPath = str_replace('\\', '/', $dbPath);
        
        $isAbsolute = false;
        if (DIRECTORY_SEPARATOR === '\\') {
            $isAbsolute = preg_match('/^[A-Za-z]:\/|^\/\/|^\\\\/', $dbPath);
        } else {
            $isAbsolute = strpos($dbPath, '/') === 0;
        }
        
        if (!$isAbsolute) {
            $projectRoot = realpath(__DIR__ . '/..');
            if ($projectRoot === false) {
                $projectRoot = __DIR__ . '/..';
            }
            $dbPath = $projectRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $dbPath);
        } else {
            $dbPath = str_replace('/', DIRECTORY_SEPARATOR, $dbPath);
        }
        
        return $dbPath;
    }
    
    return __DIR__ . '/../db/mission-mapper-database.sqlite';
}

/**
 * Ensure all required database tables exist
 * Creates them if they don't exist
 */
function ensureDatabaseTables($db) {
    $result = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='missions'");
    $missionsExists = $result->fetchArray() !== false;
    
    if (!$missionsExists) {
        $db->exec('CREATE TABLE IF NOT EXISTS auth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            user_id INTEGER DEFAULT 1,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )');
        
        $db->exec('CREATE TABLE IF NOT EXISTS missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id TEXT NOT NULL UNIQUE,
            grid_length INTEGER NOT NULL,
            grid_height INTEGER NOT NULL,
            field_size REAL NOT NULL,
            center_lat REAL NOT NULL,
            center_lng REAL NOT NULL,
            shape_type TEXT,
            bounds_ne_lat REAL,
            bounds_ne_lng REAL,
            bounds_sw_lat REAL,
            bounds_sw_lng REAL,
            num_areas INTEGER,
            status TEXT NOT NULL DEFAULT "pending",
            share_token TEXT,
            share_token_expires_at DATETIME,
            legend_data TEXT,
            started_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )');
        
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
        $db->exec('CREATE INDEX IF NOT EXISTS idx_missions_created_at_status ON missions(created_at DESC, status)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_mission_id ON drone_positions(mission_id)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_recorded_at ON drone_positions(recorded_at)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_mission_recorded ON drone_positions(mission_id, recorded_at DESC)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_drone_id ON drone_positions(drone_id)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_mission_id ON map_icons(mission_id)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_created_at ON map_icons(created_at)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_mission_type ON map_icons(mission_id, icon_type)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_icon_id ON map_icon_positions(icon_id)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_mission_id ON map_icon_positions(mission_id)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_recorded_at ON map_icon_positions(recorded_at)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_mission_recorded ON map_icon_positions(mission_id, recorded_at DESC)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_lat_lng ON address_cache(latitude, longitude)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_address_cache_cached_at ON address_cache(cached_at)');
    } else {
        $result = $db->query("PRAGMA table_info(missions)");
        $columns = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $columns[] = $row['name'];
        }
        
        if (!in_array('legend_data', $columns)) {
            try {
                $db->exec('ALTER TABLE missions ADD COLUMN legend_data TEXT');
            } catch (Exception $e) {
            }
        }
        
        if (!in_array('share_token_expires_at', $columns)) {
            try {
                $db->exec('ALTER TABLE missions ADD COLUMN share_token_expires_at DATETIME');
            } catch (Exception $e) {
            }
        }
        
        try {
            $db->exec('CREATE INDEX IF NOT EXISTS idx_missions_created_at_status ON missions(created_at DESC, status)');
            $db->exec('CREATE INDEX IF NOT EXISTS idx_drone_positions_mission_recorded ON drone_positions(mission_id, recorded_at DESC)');
            $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icons_mission_type ON map_icons(mission_id, icon_type)');
            $db->exec('CREATE INDEX IF NOT EXISTS idx_map_icon_positions_mission_recorded ON map_icon_positions(mission_id, recorded_at DESC)');
        } catch (Exception $e) {
        }
    }
}

/**
 * Get database connection with error handling and connection pooling
 * Uses static variable to reuse connection within same request
 */
function getDB() {
    static $dbConnection = null;
    
    if ($dbConnection === null) {
        $dbPath = getDatabasePath();
        $dbDir = dirname($dbPath);
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }
        
        $dbConnection = new SQLite3($dbPath);
        $dbConnection->enableExceptions(true);
        
        $dbConnection->exec('PRAGMA foreign_keys = ON');
        $dbConnection->exec('PRAGMA journal_mode = WAL');
        $dbConnection->exec('PRAGMA synchronous = NORMAL');
        $dbConnection->exec('PRAGMA cache_size = -64000');
        $dbConnection->exec('PRAGMA temp_store = MEMORY');
        
        ensureDatabaseTables($dbConnection);
    }
    
    return $dbConnection;
}

/**
 * Get configuration with caching
 * Caches config in memory and checks file modification time
 */
function getConfig() {
    static $configCache = null;
    static $configCacheTime = null;
    
    $configFile = __DIR__ . '/../config/config.php';
    
    if (!file_exists($configFile)) {
        return [];
    }
    
    $mtime = filemtime($configFile);
    
    if ($configCache !== null && $configCacheTime === $mtime) {
        return $configCache;
    }
    
    $configCache = include $configFile;
    if (!is_array($configCache)) {
        $configCache = [];
    }
    $configCacheTime = $mtime;
    
    return $configCache;
}

/**
 * Generate or retrieve CSRF token
 * @return string CSRF token
 */
function generateCSRFToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Validate CSRF token
 * @param string $token Token to validate
 * @return bool True if token is valid
 */
function validateCSRFToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Validate latitude value
 * @param mixed $lat Latitude value
 * @return bool True if valid latitude (-90 to 90)
 */
function validateLatitude($lat) {
    if (!is_numeric($lat)) {
        return false;
    }
    $lat = floatval($lat);
    return $lat >= -90 && $lat <= 90;
}

/**
 * Validate longitude value
 * @param mixed $lng Longitude value
 * @return bool True if valid longitude (-180 to 180)
 */
function validateLongitude($lng) {
    if (!is_numeric($lng)) {
        return false;
    }
    $lng = floatval($lng);
    return $lng >= -180 && $lng <= 180;
}

/**
 * Validate mission ID format
 * @param string $missionId Mission ID to validate
 * @return bool True if valid mission ID format
 */
function validateMissionId($missionId) {
    if (empty($missionId) || !is_string($missionId)) {
        return false;
    }
    return preg_match('/^[a-zA-Z0-9_\- ]{1,100}$/', $missionId) === 1;
}

/**
 * Sanitize mission ID for safe display
 * @param string $missionId Mission ID to sanitize
 * @return string Sanitized mission ID
 */
function sanitizeMissionId($missionId) {
    return htmlspecialchars(trim($missionId), ENT_QUOTES, 'UTF-8');
}

/**
 * Verify share token for a mission
 * @param SQLite3 $db Database connection
 * @param string $missionId Mission ID
 * @param string $shareToken Share token to verify
 * @return bool True if token is valid and not expired
 */
function verifyShareToken($db, $missionId, $shareToken) {
    if (empty($missionId) || empty($shareToken)) {
        return false;
    }
    
    $stmt = $db->prepare('SELECT mission_id, share_token_expires_at FROM missions WHERE mission_id = :mission_id AND share_token = :share_token');
    $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
    $stmt->bindValue(':share_token', $shareToken, SQLITE3_TEXT);
    $result = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    
    if (!$result) {
        return false;
    }
    
    if (!empty($result['share_token_expires_at'])) {
        $expiresAt = strtotime($result['share_token_expires_at']);
        if ($expiresAt !== false && time() > $expiresAt) {
            return false;
        }
    }
    
    return true;
}

