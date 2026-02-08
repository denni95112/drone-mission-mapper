<?php
/**
 * Database Migrations Page – all users can view, only admins can run
 */

require_once __DIR__ . '/includes/error_reporting.php';
require_once __DIR__ . '/includes/security_headers.php';
require_once __DIR__ . '/includes/utils.php';
require 'auth.php';
requireAuth();

require_once __DIR__ . '/includes/migration_runner.php';
require_once __DIR__ . '/version.php';

$config = getConfig();
if (isset($config['timezone'])) {
    date_default_timezone_set($config['timezone']);
}

$dbPath = getDatabasePath();
$dbDir = dirname($dbPath);
if (!is_dir($dbDir)) {
    @mkdir($dbDir, 0755, true);
}
if (!file_exists($dbPath) && !is_writable($dbDir)) {
    die('Datenbank-Verzeichnis ist nicht beschreibbar: ' . htmlspecialchars($dbDir, ENT_QUOTES, 'UTF-8'));
}
$db = new SQLite3($dbPath);
$db->exec('PRAGMA foreign_keys = ON');

$isAdmin = isAdmin();
$migrationFiles = getMigrationFiles();
$executedMigrations = getExecutedMigrations($db);
$pendingMigrations = getPendingMigrations($db);
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Datenbank Update - <?php echo $config['navigation_title']; ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
    <style>
        .migration-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .migration-table th, .migration-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .migration-table th { background-color: #f2f2f2; font-weight: bold; }
        .migration-status { padding: 4px 8px; border-radius: 4px; font-size: 0.9em; }
        .status-executed { background-color: #d4edda; color: #155724; }
        .status-pending { background-color: #fff3cd; color: #856404; }
        .execute-btn { padding: 6px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .execute-btn:hover { background-color: #0056b3; }
        .execute-btn:disabled { background-color: #6c757d; cursor: not-allowed; }
        .error-message { color: #dc3545; margin-top: 10px; }
        .success-message { color: #28a745; margin-top: 10px; }
        .info-box { background-color: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .explanation-box { background-color: #f8f9fa; border: 1px solid #dee2e6; border-left: 4px solid #007bff; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
        .explanation-box h3 { margin-top: 0; color: #007bff; }
        .explanation-box ul { margin: 10px 0; padding-left: 20px; }
    </style>
</head>
<body>
    <?php include 'includes/header.php'; ?>
    <main>
        <h1>Datenbank Update</h1>

        <div class="explanation-box">
            <h3>Was ist ein Datenbank-Update?</h3>
            <p>Ein Datenbank-Update passt die interne Struktur an, in der Ihre Daten gespeichert werden. Ihre Daten bleiben dabei erhalten.</p>
            <h3>Warum werden Updates benötigt?</h3>
            <ul>
                <li><strong>Neue Funktionen:</strong> Neue Features erfordern oft Anpassungen der Datenbank.</li>
                <li><strong>Verbesserungen:</strong> Performance und Stabilität.</li>
            </ul>
            <p><strong>Wichtig:</strong> Nur Administratoren können Updates ausführen.</p>
        </div>

        <div class="info-box">
            <?php if (count($pendingMigrations) > 0): ?>
                <p><strong>Es stehen <?php echo count($pendingMigrations); ?> ausstehende(s) Update(s) zur Verfügung.</strong></p>
            <?php else: ?>
                <p>Alle Updates wurden ausgeführt. Die Datenbank ist auf dem neuesten Stand.</p>
            <?php endif; ?>
        </div>

        <div id="message-container"></div>

        <table class="migration-table">
            <thead>
                <tr>
                    <th>Nummer</th>
                    <th>Update-Name</th>
                    <th>Status</th>
                    <th>Ausgeführt am</th>
                    <th>Aktionen</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($migrationFiles as $file): ?>
                    <?php
                    $isExecuted = in_array($file['name'], $executedMigrations);
                    $executionInfo = null;
                    if ($isExecuted) {
                        $stmt = $db->prepare('SELECT executed_at, executed_by, execution_time_ms FROM schema_migrations WHERE migration_name = :name');
                        $stmt->bindValue(':name', $file['name'], SQLITE3_TEXT);
                        $result = $stmt->execute();
                        $executionInfo = $result->fetchArray(SQLITE3_ASSOC);
                    }
                    ?>
                    <tr>
                        <td><?php echo htmlspecialchars(str_pad((string)$file['number'], 3, '0', STR_PAD_LEFT)); ?></td>
                        <td><?php echo htmlspecialchars($file['name']); ?></td>
                        <td>
                            <span class="migration-status <?php echo $isExecuted ? 'status-executed' : 'status-pending'; ?>">
                                <?php echo $isExecuted ? 'Ausgeführt' : 'Ausstehend'; ?>
                            </span>
                        </td>
                        <td>
                            <?php if ($executionInfo): ?>
                                <?php echo htmlspecialchars(toLocalTime($executionInfo['executed_at'])); ?>
                                <?php if (!empty($executionInfo['execution_time_ms'])): ?>
                                    <br><small>(<?php echo (int)$executionInfo['execution_time_ms']; ?> ms)</small>
                                <?php endif; ?>
                            <?php else: ?>
                                -
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!$isExecuted && $isAdmin): ?>
                                <button class="execute-btn" onclick="runMigration('<?php echo htmlspecialchars($file['name'], ENT_QUOTES); ?>')">Update ausführen</button>
                            <?php elseif (!$isExecuted && !$isAdmin): ?>
                                <span style="color: #6c757d;">Admin erforderlich</span>
                            <?php else: ?>
                                <span style="color: #28a745;">✓ Bereits ausgeführt</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </main>
    <?php include 'includes/footer.php'; ?>

    <script>
        const csrfToken = <?php echo json_encode(getCSRFToken()); ?>;

        function runMigration(migrationName) {
            if (!confirm('Datenbank-Update wirklich ausführen? Ihre Daten bleiben erhalten.')) return;
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Wird aktualisiert...';
            fetch('api/migrations.php?action=run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ migration_name: migrationName, csrf_token: csrfToken })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('message-container').innerHTML = '<div class="success-message">Update erfolgreich ausgeführt!</div>';
                    setTimeout(() => location.reload(), 1500);
                } else {
                    document.getElementById('message-container').innerHTML = '<div class="error-message">' + (data.error || 'Fehler') + '</div>';
                    btn.disabled = false;
                    btn.textContent = 'Update ausführen';
                }
            })
            .catch(err => {
                document.getElementById('message-container').innerHTML = '<div class="error-message">' + err.message + '</div>';
                btn.disabled = false;
                btn.textContent = 'Update ausführen';
            });
        }
    </script>
</body>
</html>
