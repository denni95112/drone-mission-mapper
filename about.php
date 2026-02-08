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
    <title>Über - <?php echo $config['navigation_title']; ?></title>
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
                <section class="about-section">
                    <h2>Autor</h2>
                    <div class="about-content-inner">
                        <p><strong>Dennis Bögner</strong></p>
                        <p>
                            <a href="https://github.com/denni95112" target="_blank" rel="noopener noreferrer" class="github-link">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                GitHub: @denni95112
                            </a>
                        </p>
                    </div>
                </section>

                <section class="about-section">
                    <h2>Projekt</h2>
                    <div class="about-content-inner">
                        <p>
                            <strong>Website:</strong>
                            <a href="https://open-drone-tools.de/" target="_blank" rel="noopener noreferrer">https://open-drone-tools.de/</a>
                        </p>
                        <p>
                            <strong>E-Mail:</strong>
                            <a href="mailto:info@open-drone-tools.de">info@open-drone-tools.de</a>
                        </p>
                    </div>
                </section>

                <section class="about-section">
                    <h2>Version</h2>
                    <div class="about-content-inner">
                        <div class="version-info">
                            <div class="version-badge">v<?php echo htmlspecialchars(APP_VERSION); ?></div>
                        </div>
                        <p>
                            <a href="changelog.php" class="changelog-link">Changelog anzeigen</a>
                        </p>
                        <p>
                            <strong>GitHub:</strong>
                            <a href="https://github.com/<?php echo htmlspecialchars(GITHUB_REPO_OWNER); ?>/<?php echo htmlspecialchars(GITHUB_REPO_NAME); ?>" target="_blank" rel="noopener noreferrer" class="github-link">Repository</a>
                        </p>
                    </div>
                </section>

                <section class="about-section">
                    <h2>Verwandte Projekte (open-drone-tools.de)</h2>
                    <div class="about-content-inner">
                        <div class="project-list">
                            <div class="project-item">
                                <h3>Drohnen-Einsatztagebuch</h3>
                                <p class="project-description">Einsatzdokumentation für BOS-Drohneneinheiten</p>
                                <a href="https://github.com/denni95112/drohnen-einsatztagebuch" target="_blank" rel="noopener noreferrer" class="project-link">GitHub Repository</a>
                            </div>
                            <div class="project-item">
                                <h3>Drohnen-Flug-und-Dienstbuch</h3>
                                <p class="project-description">PWA zur Verwaltung von Flugprotokollen, Diensten und Piloten für BOS</p>
                                <a href="https://github.com/denni95112/drohnen-flug-und-dienstbuch" target="_blank" rel="noopener noreferrer" class="project-link">GitHub Repository</a>
                            </div>
                            <div class="project-item">
                                <h3>Drone Mission Mapper</h3>
                                <p class="project-description">Missionen planen und auf der Karte visualisieren (diese Anwendung)</p>
                                <a href="https://github.com/<?php echo htmlspecialchars(GITHUB_REPO_OWNER); ?>/<?php echo htmlspecialchars(GITHUB_REPO_NAME); ?>" target="_blank" rel="noopener noreferrer" class="project-link">GitHub Repository</a>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="about-section">
                    <h2>Lizenz</h2>
                    <div class="about-content-inner">
                        <p><strong>MIT License</strong> – Erstellt von Dennis Bögner</p>
                    </div>
                </section>

                <section class="about-section">
                    <h2>Unterstützung</h2>
                    <div class="about-content-inner">
                        <p>Wenn Ihnen dieses Projekt gefällt und Sie den Entwickler unterstützen möchten:</p>
                        <?php include __DIR__ . '/includes/buy_me_a_coffee.php'; ?>
                    </div>
                </section>
            </div>
        </div>
    </main>

    <?php include 'includes/footer.php'; ?>
</body>
</html>
