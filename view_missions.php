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

$missions = [];

try {
    require_once __DIR__ . '/includes/utils.php';
    $db = getDB();
    
    $stmt = $db->prepare('SELECT m.*, 
        (SELECT COUNT(*) FROM drone_positions WHERE mission_id = m.mission_id) as position_count
        FROM missions m 
        ORDER BY m.created_at DESC');
    $result = $stmt->execute();
    
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $missions[] = $row;
    }
} catch (Exception $e) {
    $error = 'Fehler beim Laden der Missionen: ' . htmlspecialchars($e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Missionen anzeigen - <?php echo $config['navigation_title'] ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/view_missions.css?v=<?php echo APP_VERSION; ?>">
</head>
<body>
    <?php include 'includes/header.php'; ?>
    
    <main>
        <div class="view-missions-container">
            <div class="page-header">
                <h1>Missionen anzeigen</h1>
                <p>Wählen Sie eine Mission aus, um sie im Ansichtsmodus zu öffnen</p>
            </div>
            
            <?php if (empty($missions)): ?>
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>Keine Missionen gefunden</h3>
                    <p>Es sind noch keine Missionen vorhanden.</p>
                </div>
            <?php else: ?>
                <table class="missions-table">
                    <thead>
                        <tr>
                            <th>Mission ID</th>
                            <th>Status</th>
                            <th>Erstellt am</th>
                            <th>Informationen</th>
                            <th>Aktion</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($missions as $mission): ?>
                            <?php
                            $createdDate = new DateTime($mission['created_at']);
                            $dateStr = $createdDate->format('d.m.Y H:i');
                            
                            $statusText = [
                                'pending' => 'Ausstehend',
                                'active' => 'Aktiv',
                                'completed' => 'Abgeschlossen'
                            ][$mission['status']] ?? $mission['status'];
                            ?>
                            <tr>
                                <td class="mission-id"><?php echo htmlspecialchars($mission['mission_id']); ?></td>
                                <td>
                                    <span class="mission-status <?php echo htmlspecialchars($mission['status']); ?>">
                                        <?php echo htmlspecialchars($statusText); ?>
                                    </span>
                                </td>
                                <td><?php echo htmlspecialchars($dateStr); ?></td>
                                <td>
                                    <div class="mission-info">
                                        <span>📍 <?php echo htmlspecialchars($mission['num_areas'] ?? 'N/A'); ?> Bereiche</span>
                                        <?php if (isset($mission['position_count']) && $mission['position_count'] > 0): ?>
                                            <span>📊 <?php echo htmlspecialchars($mission['position_count']); ?> Positionen</span>
                                        <?php endif; ?>
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <a href="view_mission.php?mission_id=<?php echo urlencode($mission['mission_id']); ?>" class="view-btn">
                                            Anzeigen
                                        </a>
                                        <button type="button" class="export-btn" data-mission-id="<?php echo htmlspecialchars($mission['mission_id']); ?>" 
                                                style="background-color: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; font-weight: 500; transition: background-color 0.2s; font-size: 0.875rem;">
                                            📥 Export
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    </main>
    
    <?php include 'includes/footer.php'; ?>
    
    <!-- Export Progress Dialog -->
    <div id="export-dialog">
        <div>
            <h3>📊 Positionen exportieren</h3>
            <p id="export-status">Export wird vorbereitet...</p>
            <div>
                <div id="export-progress-bar"></div>
            </div>
            <div>
                <span id="export-progress-text">0 / 0</span>
                <span id="export-percentage">0%</span>
            </div>
            <div>
                <button type="button" id="export-cancel-btn">Abbrechen</button>
            </div>
        </div>
    </div>
    
    <script src="js/view_missions.js"></script>
</body>
</html>

