<?php
/**
 * Migration Runner for Drone Mission Mapper
 */

require_once __DIR__ . '/utils.php';

function ensureSchemaMigrationsTable($db) {
    $tableExists = $db->querySingle("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'");
    if (!$tableExists) {
        $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_name TEXT NOT NULL UNIQUE,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            executed_by TEXT,
            execution_time_ms INTEGER
        )');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name)');
    }
}

function getMigrationFiles() {
    $migrationsDir = __DIR__ . '/../migrations';
    $files = [];
    if (!is_dir($migrationsDir)) {
        return $files;
    }
    $items = scandir($migrationsDir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $migrationsDir . '/' . $item;
        if (is_file($path) && pathinfo($path, PATHINFO_EXTENSION) === 'php') {
            if (preg_match('/^(\d+)_/', $item, $matches)) {
                $files[] = [
                    'number' => (int) $matches[1],
                    'filename' => $item,
                    'path' => $path,
                    'name' => pathinfo($item, PATHINFO_FILENAME)
                ];
            }
        }
    }
    usort($files, function ($a, $b) { return $b['number'] - $a['number']; });
    return $files;
}

function getExecutedMigrations($db) {
    ensureSchemaMigrationsTable($db);
    $result = $db->query('SELECT migration_name FROM schema_migrations');
    $executed = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $executed[] = $row['migration_name'];
    }
    return $executed;
}

function isMigrationExecuted($db, $migrationName) {
    ensureSchemaMigrationsTable($db);
    $stmt = $db->prepare('SELECT COUNT(*) FROM schema_migrations WHERE migration_name = :name');
    $stmt->bindValue(':name', $migrationName, SQLITE3_TEXT);
    $r = $stmt->execute()->fetchArray(SQLITE3_NUM);
    return $r[0] > 0;
}

function getPendingMigrations($db) {
    $files = getMigrationFiles();
    $executed = getExecutedMigrations($db);
    $pending = [];
    foreach ($files as $file) {
        if (!in_array($file['name'], $executed)) {
            $pending[] = $file;
        }
    }
    return $pending;
}

function runMigration($db, $migrationPath, $migrationName, $executedBy = null) {
    ensureSchemaMigrationsTable($db);
    if (isMigrationExecuted($db, $migrationName)) {
        return ['success' => false, 'error' => 'Migration already executed'];
    }
    if (!file_exists($migrationPath)) {
        return ['success' => false, 'error' => 'Migration file not found'];
    }
    require_once $migrationPath;
    if (!function_exists('up')) {
        return ['success' => false, 'error' => 'Migration file does not define up() function'];
    }
    $start = microtime(true);
    try {
        $db->exec('PRAGMA busy_timeout = 10000');
        $db->exec('PRAGMA foreign_keys = OFF');
        $db->exec('BEGIN IMMEDIATE TRANSACTION');
        $result = up($db);
        if ($result !== true) {
            throw new Exception('Migration up() did not return true');
        }
        $executionTime = (int) round((microtime(true) - $start) * 1000);
        $stmt = $db->prepare('INSERT INTO schema_migrations (migration_name, executed_by, execution_time_ms) VALUES (:name, :by, :time)');
        $stmt->bindValue(':name', $migrationName, SQLITE3_TEXT);
        $stmt->bindValue(':by', $executedBy, SQLITE3_TEXT);
        $stmt->bindValue(':time', $executionTime, SQLITE3_INTEGER);
        $stmt->execute();
        $db->exec('COMMIT');
        $db->exec('PRAGMA foreign_keys = ON');
        return ['success' => true, 'execution_time_ms' => $executionTime];
    } catch (Exception $e) {
        try { $db->exec('ROLLBACK'); } catch (Exception $x) {}
        try { $db->exec('PRAGMA foreign_keys = ON'); } catch (Exception $x) {}
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function hasPendingMigrations($db = null) {
    if ($db === null) {
        try {
            $dbPath = getDatabasePath();
            if (!file_exists($dbPath)) {
                return false;
            }
            $db = new SQLite3($dbPath);
        } catch (Exception $e) {
            return false;
        }
    }
    return count(getPendingMigrations($db)) > 0;
}
