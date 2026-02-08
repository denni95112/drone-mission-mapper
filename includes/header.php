<?php
if (!isset($config)) {
    if (!function_exists('getConfig')) {
        require_once __DIR__ . '/utils.php';
    }
    $config = getConfig();
}
require_once __DIR__ . '/../version.php';

$basePath = (strpos($_SERVER['PHP_SELF'], '/updater/') !== false) ? '../' : '';

$hasPendingMigrations = false;
if (file_exists(__DIR__ . '/migration_runner.php')) {
    try {
        require_once __DIR__ . '/migration_runner.php';
        $hasPendingMigrations = hasPendingMigrations();
    } catch (Exception $e) {
    }
}

$versionCheck = checkGitHubVersion(APP_VERSION, GITHUB_REPO_OWNER, GITHUB_REPO_NAME);
$hasUpdate = $versionCheck && !empty($versionCheck['available']);
$is_admin = function_exists('isAdmin') && isAdmin();
?>
<link rel="stylesheet" href="<?php echo $basePath; ?>css/navigation.css?v=<?php echo APP_VERSION; ?>">
<header>
    <nav>
        <div class="nav-header">
            <div class="nav-title-container">
                <?php
                $logo_path = $config['logo_path'] ?? '';
                if (!empty($logo_path) && file_exists(__DIR__ . '/../' . $logo_path)):
                ?>
                    <a href="<?php echo $basePath; ?>map.php"><img src="<?php echo $basePath . htmlspecialchars($logo_path, ENT_QUOTES, 'UTF-8'); ?>" alt="Logo" class="nav-logo"></a>
                <?php endif; ?>
                <span class="nav-title"><?php echo $config['navigation_title']; ?> - v<?php echo APP_VERSION; ?> beta</span>
            </div>
            <div class="nav-actions">
                <?php if ($hasPendingMigrations): ?>
                    <a href="<?php echo $basePath; ?>migrations.php" class="migration-notification" title="Datenbank-Update verfügbar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        <span class="migration-badge"></span>
                    </a>
                <?php endif; ?>
                <?php if ($hasUpdate): ?>
                    <a href="<?php echo $is_admin ? $basePath . 'updater/updater_page.php' : htmlspecialchars($versionCheck['url'], ENT_QUOTES, 'UTF-8'); ?>" <?php if (!$is_admin): ?>target="_blank" rel="noopener noreferrer"<?php endif; ?> class="update-notification" title="Neue Version <?php echo htmlspecialchars($versionCheck['version'], ENT_QUOTES, 'UTF-8'); ?> verfügbar">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
                        </svg>
                        <span class="update-badge">v<?php echo htmlspecialchars($versionCheck['version'], ENT_QUOTES, 'UTF-8'); ?></span>
                    </a>
                <?php else: ?>
                    <a href="#" id="update-notification" class="update-notification" style="display: none;" title="Neue Version verfügbar">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
                        </svg>
                        <span class="update-badge"></span>
                    </a>
                <?php endif; ?>
            </div>
        </div>
        <ul class="nav-menu">
            <li><a href="<?php echo $basePath; ?>map.php">Karte</a></li>
            <li><a href="<?php echo $basePath; ?>view_missions.php">Missionen anzeigen</a></li>
            <li><a href="https://github.com/<?php echo GITHUB_REPO_OWNER . '/' . GITHUB_REPO_NAME; ?>/wiki" target="_blank" rel="noopener noreferrer">Hilfe / Wiki</a></li>
            <li><a href="<?php echo $basePath; ?>changelog.php">Changelog</a></li>
            <li><a href="<?php echo $basePath; ?>about.php">Über</a></li>
            <li class="nav-dropdown-parent">
                <span class="nav-dropdown-toggle">Einstellungen</span>
                <ul class="nav-dropdown">
                    <li><a href="<?php echo $basePath; ?>settings.php">App Einstellungen</a></li>
                    <li><a href="<?php echo $basePath; ?>delete_missions.php">Missionen löschen</a></li>
                    <li><a href="<?php echo $basePath; ?>view_logs.php">Log-Dateien</a></li>
                    <li><a href="<?php echo $basePath; ?>migrations.php">Datenbank Update</a></li>
                    <?php if ($is_admin): ?>
                        <li><a href="<?php echo $basePath; ?>updater/updater_page.php">Update Tool</a></li>
                    <?php endif; ?>
                </ul>
            </li>
            
            <li><a href="<?php echo $basePath; ?>logout.php">Logout</a></li>
        </ul>
    </nav>
</header>

