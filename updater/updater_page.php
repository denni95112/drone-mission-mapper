<?php
$baseDir = realpath(dirname(__DIR__)) ?: dirname(__DIR__);
require_once $baseDir . '/includes/error_reporting.php';
require_once $baseDir . '/includes/security_headers.php';
require_once $baseDir . '/auth.php';
requireAuth();

if (!isAdmin()) {
    header('Location: ../map.php');
    exit;
}

$config = include $baseDir . '/config/config.php';
if (isset($config['timezone'])) {
    date_default_timezone_set($config['timezone']);
}

require_once $baseDir . '/includes/utils.php';
if (file_exists($baseDir . '/version.php')) {
    require_once $baseDir . '/version.php';
} elseif (file_exists($baseDir . '/includes/version.php')) {
    require_once $baseDir . '/includes/version.php';
} else {
    define('APP_VERSION', '0.0.0');
}

$basePath = '../';
require_once __DIR__ . '/updater.php';

$projectRoot = $baseDir;
$updater = new Updater($projectRoot);

$requirements = $updater->checkRequirements();
$requirementsError = null;
if (!$requirements['available']) {
    $requirementsError = 'Erforderliche PHP-Erweiterungen fehlen: ' . implode(', ', $requirements['missing']);
}

$currentVersion = APP_VERSION;
$updateInfo = null;
$error = null;
try {
    $updateInfo = $updater->checkForUpdates();
} catch (Exception $e) {
    $error = $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Update Tool - Admin</title>
    <link rel="stylesheet" href="<?php echo $basePath; ?>css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="<?php echo $basePath; ?>updater/updater.css?v=<?php echo APP_VERSION; ?>">
</head>
<body>
    <?php include $baseDir . '/includes/header.php'; ?>
    <main>
        <h1>Update Tool</h1>
        <div id="error-message-container" class="error-message" style="display: none;"></div>
        <div id="success-message-container" class="success-message" style="display: none;"></div>
        <?php if ($requirementsError): ?>
            <div class="error-message" style="display: block; margin-bottom: 1.5rem;"><?php echo htmlspecialchars($requirementsError); ?></div>
        <?php endif; ?>

        <div class="updater-container">
            <div class="version-section">
                <h2>Aktuelle Version</h2>
                <div class="version-badge current-version">v<?php echo htmlspecialchars($currentVersion); ?></div>
            </div>
            <div class="update-check-section">
                <h2>Update prüfen</h2>
                <button id="check-updates-btn" class="btn-primary">
                    <span class="btn-text">Auf Updates prüfen</span>
                    <span class="btn-spinner" style="display: none;">⏳</span>
                </button>
            </div>
            <div id="update-available-section" class="update-available-section" style="display: none;">
                <h2>Update verfügbar</h2>
                <div class="update-info">
                    <div class="version-comparison">
                        <span class="version-badge current-version">v<?php echo htmlspecialchars($currentVersion); ?></span>
                        <span class="version-arrow">→</span>
                        <span class="version-badge new-version" id="new-version-badge">v?.?.?</span>
                    </div>
                    <div id="release-notes" class="release-notes" style="display: none;"></div>
                    <a id="release-url" href="#" target="_blank" rel="noopener noreferrer" class="release-link" style="display: none;">Release auf GitHub ansehen</a>
                </div>
                <div class="update-actions">
                    <button id="update-now-btn" class="btn-update">
                        <span class="btn-text">Jetzt aktualisieren</span>
                        <span class="btn-spinner" style="display: none;">⏳</span>
                    </button>
                </div>
            </div>
            <div id="no-update-section" class="no-update-section" style="display: none;">
                <h2>Kein Update verfügbar</h2>
                <p>Sie verwenden bereits die neueste Version.</p>
            </div>
            <div id="update-progress-section" class="update-progress-section" style="display: none;">
                <h2>Update wird durchgeführt</h2>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div id="progress-bar-fill" class="progress-bar-fill" style="width: 0%;"></div>
                    </div>
                    <div id="progress-text" class="progress-text">Vorbereitung...</div>
                </div>
                <div id="update-status" class="update-status"></div>
            </div>
            <div id="update-complete-section" class="update-complete-section" style="display: none;">
                <h2>Update abgeschlossen</h2>
                <div id="update-results" class="update-results"></div>
                <div class="update-actions">
                    <button id="reload-page-btn" class="btn-primary">Seite neu laden</button>
                </div>
            </div>
        </div>
        <div class="info-section">
            <h3>Hinweise</h3>
            <ul>
                <li>Vor dem Update wird automatisch ein Backup erstellt</li>
                <li>Konfiguration und Datenbank werden geschützt</li>
                <li>Bei Fehler wird ein Rollback durchgeführt</li>
            </ul>
        </div>
    </main>
    <?php include $baseDir . '/includes/footer.php'; ?>
    <script>
        window.updaterConfig = {
            currentVersion: <?php echo json_encode($currentVersion); ?>,
            updateInfo: <?php echo json_encode($updateInfo); ?>,
            csrfToken: <?php echo json_encode(getCSRFToken()); ?>,
            basePath: <?php echo json_encode($basePath); ?>
        };
    </script>
    <script src="<?php echo $basePath; ?>updater/updater.js"></script>
</body>
</html>
