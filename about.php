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
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Über - <?php echo $config['navigation_title'] ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/about.css?v=<?php echo APP_VERSION; ?>">
</head>
<body>
    <?php include 'includes/header.php'; ?>
    
    <main>
        <div class="about-container">
            <div class="page-header">
                <h1>Über</h1>
                <p>Informationen über diese Anwendung</p>
            </div>
            
            <div class="about-content">
                <div class="about-section">
                    <h2>Version</h2>
                    <div class="version-info">
                        <div class="version-badge">v<?php echo htmlspecialchars(APP_VERSION); ?></div>
                    </div>
                </div>
                
                <div class="about-section">
                    <h2>GitHub Repository</h2>
                    <div class="github-info">
                        <p>
                            <strong>Besitzer:</strong> <?php echo htmlspecialchars(GITHUB_REPO_OWNER); ?><br>
                            <strong>Repository:</strong> <?php echo htmlspecialchars(GITHUB_REPO_NAME); ?>
                        </p>
                        <a href="https://github.com/<?php echo htmlspecialchars(GITHUB_REPO_OWNER); ?>/<?php echo htmlspecialchars(GITHUB_REPO_NAME); ?>" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="github-link">
                            🔗 Repository öffnen
                        </a>
                    </div>
                </div>
                
                <div class="about-section">
                    <h2>Lizenz</h2>
                    <p>MIT License - Erstellt von Dennis Bögner</p>
                </div>
            </div>
        </div>
    </main>
    
    <?php include 'includes/footer.php'; ?>
</body>
</html>
