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

$error = '';
$success = '';
$deletedMissionId = null;
$missions = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_mission'])) {
    $missionId = trim($_POST['mission_id'] ?? '');
    
    if (empty($missionId)) {
        $error = 'Mission ID ist erforderlich.';
    } else {
        try {
            require_once __DIR__ . '/includes/utils.php';
            $db = getDB();
            
            $stmt = $db->prepare('SELECT id, status FROM missions WHERE mission_id = :mission_id');
            $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
            $mission = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            
            if (!$mission) {
                $error = 'Mission nicht gefunden.';
            } elseif ($mission['status'] === 'active') {
                $error = 'Aktive Missionen können nicht gelöscht werden. Bitte beenden Sie die Mission zuerst.';
            } else {
                $stmt = $db->prepare('DELETE FROM map_icon_positions WHERE mission_id = :mission_id');
                $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $stmt->execute();
                
                $stmt = $db->prepare('DELETE FROM map_icons WHERE mission_id = :mission_id');
                $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $stmt->execute();
                
                $stmt = $db->prepare('DELETE FROM drone_positions WHERE mission_id = :mission_id');
                $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $stmt->execute();
                
                $stmt = $db->prepare('DELETE FROM missions WHERE mission_id = :mission_id');
                $stmt->bindValue(':mission_id', $missionId, SQLITE3_TEXT);
                $stmt->execute();
                
                $success = 'Mission "' . htmlspecialchars($missionId) . '" wurde erfolgreich gelöscht.';
                $deletedMissionId = $missionId;
            }
        } catch (Exception $e) {
            $error = 'Fehler beim Löschen der Mission: ' . htmlspecialchars($e->getMessage());
        }
    }
}

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
    <title>Missionen löschen - <?php echo $config['navigation_title'] ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/delete_missions.css?v=<?php echo APP_VERSION; ?>">
</head>
<body>
    <?php include 'includes/header.php'; ?>
    
    <main>
        <div class="delete-missions-container">
            <div class="page-header">
                <h1>Missionen löschen</h1>
                <p>Verwalten und löschen Sie gespeicherte Missionen</p>
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
                                    <div style="display: flex; gap: 0.5rem;">
                                        <a href="view_mission.php?mission_id=<?php echo urlencode($mission['mission_id']); ?>" 
                                           class="btn-view" 
                                           title="Mission anzeigen"
                                           style="background-color: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; font-weight: 500; text-decoration: none; display: inline-block;">
                                            Anzeigen
                                        </a>
                                        <button class="delete-btn" 
                                                onclick="confirmDelete('<?php echo htmlspecialchars($mission['mission_id'], ENT_QUOTES); ?>')"
                                                <?php echo $mission['status'] === 'active' ? 'disabled title="Aktive Missionen können nicht gelöscht werden"' : ''; ?>>
                                            Löschen
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
    
    <!-- Delete Confirmation Dialog -->
    <div id="deleteConfirmDialog" class="delete-confirm-dialog">
        <div class="delete-confirm-content">
            <h3>Mission löschen?</h3>
            <p>Möchten Sie die Mission "<strong id="deleteMissionId"></strong>" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div class="delete-confirm-actions">
                <button class="btn-cancel" onclick="cancelDelete()">Abbrechen</button>
                <form id="deleteForm" method="POST" style="display: inline;">
                    <input type="hidden" name="mission_id" id="deleteMissionIdInput">
                    <button type="submit" name="delete_mission" class="btn-confirm-delete">Löschen</button>
                </form>
            </div>
        </div>
    </div>
    
    <?php include 'includes/footer.php'; ?>
    
    <script>
        window.deletedMissionId = <?php echo json_encode($deletedMissionId ?? null); ?>;
    </script>
    <script src="js/delete_missions.js"></script>
</body>
</html>

