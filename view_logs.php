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

$logsDir = __DIR__ . '/logs';
$logFiles = [];
$selectedLog = $_GET['log'] ?? '';
$logContent = '';
$error = '';
$success = '';

// Handle log file deletion
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_log'])) {
    $logToDelete = trim($_POST['log_name'] ?? '');
    
    if (empty($logToDelete)) {
        $error = 'Log-Dateiname ist erforderlich.';
    } else {
        // Security: Only allow deletion of .log files in the logs directory
        $logPath = $logsDir . '/' . basename($logToDelete);
        
        // Verify it's actually in the logs directory (prevent directory traversal)
        $realLogsDir = realpath($logsDir);
        $realLogPath = realpath($logPath);
        
        if ($realLogPath === false || strpos($realLogPath, $realLogsDir) !== 0) {
            $error = 'Ungültiger Dateipfad.';
        } elseif (!file_exists($logPath)) {
            $error = 'Log-Datei nicht gefunden.';
        } elseif (pathinfo($logPath, PATHINFO_EXTENSION) !== 'log') {
            $error = 'Nur .log-Dateien können gelöscht werden.';
        } else {
            if (@unlink($logPath)) {
                $success = 'Log-Datei "' . htmlspecialchars($logToDelete) . '" wurde erfolgreich gelöscht.';
                // If deleted log was selected, clear selection
                if ($selectedLog === $logToDelete) {
                    $selectedLog = '';
                    $logContent = '';
                }
            } else {
                $error = 'Fehler beim Löschen der Log-Datei. Bitte überprüfen Sie die Schreibrechte.';
            }
        }
    }
}

// Get all log files
if (is_dir($logsDir)) {
    $files = scandir($logsDir);
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..' && is_file($logsDir . '/' . $file) && pathinfo($file, PATHINFO_EXTENSION) === 'log') {
            $filePath = $logsDir . '/' . $file;
            $logFiles[] = [
                'name' => $file,
                'path' => $filePath,
                'size' => filesize($filePath),
                'modified' => filemtime($filePath)
            ];
        }
    }
    
    // Sort by modification time (newest first)
    usort($logFiles, function($a, $b) {
        return $b['modified'] - $a['modified'];
    });
}

// Load selected log file content
if (!empty($selectedLog) && in_array($selectedLog, array_column($logFiles, 'name'))) {
    $logPath = $logsDir . '/' . $selectedLog;
    if (file_exists($logPath) && is_readable($logPath)) {
        $logContent = file_get_contents($logPath);
    }
}

/**
 * Format file size in human-readable format
 * @param int $bytes File size in bytes
 * @return string Formatted file size
 */
function formatFileSize($bytes) {
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 2) . ' GB';
    } elseif ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 2) . ' MB';
    } elseif ($bytes >= 1024) {
        return number_format($bytes / 1024, 2) . ' KB';
    } else {
        return $bytes . ' bytes';
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log-Dateien anzeigen - <?php echo $config['navigation_title'] ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/view_logs.css?v=<?php echo APP_VERSION; ?>">
</head>
<body>
    <?php include 'includes/header.php'; ?>
    
    <main>
        <div class="view-logs-container">
            <div class="page-header">
                <h1>Log-Dateien anzeigen</h1>
                <p>Wählen Sie eine Log-Datei aus, um ihren Inhalt anzuzeigen</p>
            </div>
            
            <?php if ($error): ?>
                <div class="alert alert-error">
                    <?php echo htmlspecialchars($error); ?>
                </div>
            <?php endif; ?>
            
            <?php if ($success): ?>
                <div class="alert alert-success">
                    <?php echo htmlspecialchars($success); ?>
                </div>
            <?php endif; ?>
            
            <?php if (empty($logFiles)): ?>
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>Keine Log-Dateien gefunden</h3>
                    <p>Es sind noch keine Log-Dateien vorhanden.</p>
                </div>
            <?php else: ?>
                <div class="logs-layout">
                    <div class="logs-sidebar">
                        <div class="logs-sidebar-header">
                            Log-Dateien (<?php echo count($logFiles) ?>)
                        </div>
                        <div class="logs-list">
                            <?php foreach ($logFiles as $logFile): ?>
                                <div class="log-file-item <?php echo $selectedLog === $logFile['name'] ? 'active' : ''; ?>" 
                                     onclick="window.location.href='?log=<?php echo urlencode($logFile['name']); ?>'">
                                    <div class="log-file-name"><?php echo htmlspecialchars($logFile['name']); ?></div>
                                    <div class="log-file-meta">
                                        <span><?php echo formatFileSize($logFile['size']); ?></span>
                                        <span><?php echo date('d.m.Y H:i', $logFile['modified']); ?></span>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    
                    <div class="log-content-panel">
                        <?php if (!empty($selectedLog) && !empty($logContent)): ?>
                            <div class="log-content-header">
                                <h3><?php echo htmlspecialchars($selectedLog); ?></h3>
                                <div class="log-content-actions">
                                    <button type="button" class="btn btn-secondary" onclick="downloadLog()">📥 Herunterladen</button>
                                    <button type="button" class="btn btn-secondary" onclick="copyLog()">📋 Kopieren</button>
                                    <button type="button" class="btn btn-danger" onclick="confirmDeleteLog('<?php echo htmlspecialchars($selectedLog, ENT_QUOTES); ?>')">🗑️ Löschen</button>
                                </div>
                            </div>
                            <div class="log-content-body" id="log-content"><?php echo htmlspecialchars($logContent); ?></div>
                        <?php else: ?>
                            <div class="empty-state">
                                <div class="empty-state-icon">📄</div>
                                <h3>Keine Datei ausgewählt</h3>
                                <p>Wählen Sie eine Log-Datei aus der Liste aus, um ihren Inhalt anzuzeigen.</p>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </main>
    
    <?php include 'includes/footer.php'; ?>
    
    <!-- Delete Confirmation Dialog -->
    <div id="deleteLogDialog" class="delete-log-dialog" style="display: none;">
        <div class="delete-log-content">
            <h3>Log-Datei löschen?</h3>
            <p>Möchten Sie die Log-Datei "<strong id="deleteLogName"></strong>" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div class="delete-log-actions">
                <button class="btn btn-secondary" onclick="cancelDeleteLog()">Abbrechen</button>
                <form id="deleteLogForm" method="POST" style="display: inline;">
                    <input type="hidden" name="log_name" id="deleteLogNameInput">
                    <button type="submit" name="delete_log" class="btn btn-danger">Löschen</button>
                </form>
            </div>
        </div>
    </div>
    
    <script>
        window.selectedLogName = <?php echo json_encode($selectedLog); ?>;
    </script>
    <script src="js/view_logs.js"></script>
</body>
</html>

