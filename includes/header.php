<?php
if (!isset($config)) {
    if (!function_exists('getConfig')) {
        require_once __DIR__ . '/utils.php';
    }
    $config = getConfig();
}
require_once __DIR__ . '/../version.php';
?>
<link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
<header>
    <nav>
        <div class="nav-header">
            <div class="nav-title-container">
                <?php 
                $logo_path = $config['logo_path'] ?? '';
                if (!empty($logo_path) && file_exists(__DIR__ . '/../' . $logo_path)): 
                ?>
                    <a href="map.php"><img src="<?php echo htmlspecialchars($logo_path, ENT_QUOTES, 'UTF-8'); ?>" alt="Logo" class="nav-logo"></a>
                <?php endif; ?>
                <span class="nav-title"><?php echo $config['navigation_title']; ?></span>
            </div>
            <div class="nav-actions">
                <a href="#" id="update-notification" class="update-notification" style="display: none;" title="Neue Version verfügbar">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
                    </svg>
                    <span class="update-badge"></span>
                </a>
            </div>
        </div>
        <ul class="nav-menu">
            <li><a href="map.php">Karte</a></li>
            <li><a href="view_missions.php">Missionen anzeigen</a></li>
            <li><a href="delete_missions.php">Missionen löschen</a></li>
            <li><a href="view_logs.php">Log-Dateien</a></li>
            <li><a href="settings.php">Einstellungen</a></li>
            <li><a href="about.php">Über</a></li>
            <li><a href="logout.php">Logout</a></li>
        </ul>
    </nav>
</header>

