<?php
require_once __DIR__ . '/includes/error_reporting.php';
require_once __DIR__ . '/includes/security_headers.php';

if (file_exists(__DIR__ . '/config/config.php')) {
    header('Location: index.php');
    exit;
}

require_once __DIR__ . '/version.php';

$error = '';
$success = false;

$isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';

$suggestedPaths = [];

if ($isWindows) {
    $suggestedPaths = [
        'C:/data/mission-mapper-database.sqlite' => 'C:/data/mission-mapper-database.sqlite - Empfohlen',
        'db/mission-mapper-database.sqlite' => 'db/mission-mapper-database.sqlite - Standard',
        '../data/mission-mapper-database.sqlite' => '../data/mission-mapper-database.sqlite - Relativ',
        'D:/apps/mission-mapper-database.sqlite' => 'D:/apps/mission-mapper-database.sqlite',
        'C:/ProgramData/mission-mapper-database.sqlite' => 'C:/ProgramData/mission-mapper-database.sqlite',
    ];
} else {
    $user = get_current_user();
    $suggestedPaths = [
        '/var/data/mission-mapper-database.sqlite' => '/var/data/mission-mapper-database.sqlite - Empfohlen',
        'db/mission-mapper-database.sqlite' => 'db/mission-mapper-database.sqlite - Standard',
        '/home/' . $user . '/data/mission-mapper-database.sqlite' => '/home/' . $user . '/data/mission-mapper-database.sqlite',
        '../data/mission-mapper-database.sqlite' => '../data/mission-mapper-database.sqlite - Relativ',
        '/opt/data/mission-mapper-database.sqlite' => '/opt/data/mission-mapper-database.sqlite',
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $navigation_title = trim($_POST['navigation_title'] ?? '');
    $password = $_POST['password'] ?? '';
    $map_default_lat = floatval($_POST['map_default_lat'] ?? 51.1657);
    $map_default_lng = floatval($_POST['map_default_lng'] ?? 10.4515);
    $map_default_zoom = intval($_POST['map_default_zoom'] ?? 6);
    $timezone = trim($_POST['timezone'] ?? 'Europe/Berlin');
    
    $database_path_dropdown = $_POST['database_path_dropdown'] ?? '';
    $database_path_custom = trim($_POST['database_path_custom'] ?? '');
    
    if ($database_path_dropdown === 'custom' && !empty($database_path_custom)) {
        $database_path = $database_path_custom;
    } elseif ($database_path_dropdown === 'custom' && empty($database_path_custom)) {
        $database_path = 'db/mission-mapper-database.sqlite';
    } elseif (!empty($database_path_dropdown)) {
        $database_path = $database_path_dropdown;
    } else {
        $database_path = 'db/mission-mapper-database.sqlite';
    }
    
    $database_path = trim($database_path);
    $database_path = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $database_path);
    
    if (empty($navigation_title) || empty($password) || empty($database_path)) {
        $error = 'Bitte füllen Sie alle erforderlichen Felder aus.';
    } elseif ($map_default_lat < -90 || $map_default_lat > 90) {
        $error = 'Ungültiger Breitengrad. Bitte verwenden Sie einen Wert zwischen -90 und 90.';
    } elseif ($map_default_lng < -180 || $map_default_lng > 180) {
        $error = 'Ungültiger Längengrad. Bitte verwenden Sie einen Wert zwischen -180 und 180.';
    } elseif ($map_default_zoom < 1 || $map_default_zoom > 18) {
        $error = 'Ungültiger Zoom-Level. Bitte verwenden Sie einen Wert zwischen 1 und 18.';
    } else {
        $password_hash = password_hash($password, PASSWORD_DEFAULT);
        
        $config = [
            'navigation_title' => $navigation_title,
            'token_name' => 'drone_mapper_token',
            'logo_path' => '',
            'debugMode' => false,
            'timezone' => $timezone,
            'database_path' => $database_path,
            'map_default_lat' => $map_default_lat,
            'map_default_lng' => $map_default_lng,
            'map_default_zoom' => $map_default_zoom,
            'password_hash' => $password_hash,
            'log_level' => 'info',
        ];
        
        $configDir = __DIR__ . '/config';
        if (!is_dir($configDir)) {
            mkdir($configDir, 0755, true);
        }
        
        $configContent = "<?php\nreturn " . var_export($config, true) . ";\n";
        
        if (file_put_contents($configDir . '/config.php', $configContent)) {
            header('Location: setup_database.php');
            exit;
        } else {
            $error = 'Fehler beim Speichern der Konfiguration. Bitte überprüfen Sie die Schreibrechte.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup - Drohnen-Missions-Mapper</title>
    <link rel="stylesheet" href="css/setup.css?v=<?php echo APP_VERSION; ?>">
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const dropdown = document.getElementById('database_path_dropdown');
            const customInput = document.getElementById('database_path_custom');
            
            function toggleCustomInput() {
                if (dropdown.value === 'custom') {
                    customInput.style.display = 'block';
                    customInput.required = true;
                } else {
                    customInput.style.display = 'none';
                    customInput.required = false;
                    customInput.value = '';
                }
            }
            
            dropdown.addEventListener('change', toggleCustomInput);
            toggleCustomInput(); // Initialize on page load
            
            // Tooltip functionality
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) {
                const tooltipText = tooltip.querySelector('.tooltiptext');
                tooltip.addEventListener('mouseenter', function() {
                    tooltipText.style.visibility = 'visible';
                    tooltipText.style.opacity = '1';
                });
                tooltip.addEventListener('mouseleave', function() {
                    tooltipText.style.visibility = 'hidden';
                    tooltipText.style.opacity = '0';
                });
            }
        });
    </script>
    <style>
        .tooltip {
            position: relative;
            display: inline-block;
        }
        .tooltip .tooltiptext {
            visibility: hidden;
            width: 300px;
            background-color: #333;
            color: #fff;
            text-align: left;
            border-radius: 6px;
            padding: 8px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -150px;
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 0.875rem;
            line-height: 1.4;
        }
        .tooltip:hover .tooltiptext {
            visibility: visible;
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="setup-container">
        <h1>Drohnen-Missions-Mapper Setup</h1>
        <p>Willkommen! Bitte konfigurieren Sie die Anwendung.</p>
        
        <?php if ($error): ?>
            <div class="error-message"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        
        <form method="post" action="setup.php">
            <div class="form-group">
                <label for="navigation_title">Anwendungsname:</label>
                <input type="text" id="navigation_title" name="navigation_title" value="Drohnen-Missions-Mapper" required>
            </div>
            
            <div class="form-group">
                <label for="password">Passwort:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <div class="form-group">
                <label for="database_path_dropdown">
                    Datenbank-Pfad
                    <span class="tooltip" style="cursor: help; margin-left: 5px;">?
                        <span class="tooltiptext">
                            <strong>Sicherheitshinweis:</strong> Speichere die Datenbank außerhalb des Web-Verzeichnisses!<br><br>
                            <strong>Beispiele:</strong><br>
                            <?php if ($isWindows): ?>
                            Windows: C:/data/mission-mapper-database.sqlite oder ..\\data\\mission-mapper-database.sqlite<br>
                            <?php else: ?>
                            Linux: /var/data/mission-mapper-database.sqlite oder ../data/mission-mapper-database.sqlite<br>
                            <?php endif; ?>
                            Relativ: db/mission-mapper-database.sqlite (Standard, weniger sicher)<br><br>
                            Wähle einen empfohlenen Pfad oder verwende "Eigener Pfad" für eine benutzerdefinierte Option.
                        </span>
                    </span>
                </label>
                <select name="database_path_dropdown" id="database_path_dropdown" required>
                    <?php foreach ($suggestedPaths as $path => $label): 
                        $pathEscaped = htmlspecialchars($path);
                        $labelEscaped = htmlspecialchars($label); ?>
                        <option value="<?= $pathEscaped ?>"><?= $labelEscaped ?></option>
                    <?php endforeach; ?>
                    <option value="custom">Eigener Pfad...</option>
                </select>
                <input type="text" name="database_path_custom" id="database_path_custom" placeholder="Eigener Pfad eingeben..." style="display: none; margin-top: 0.5rem;">
                <small>
                    <?php if ($isWindows): ?>
                        Betriebssystem erkannt: Windows
                    <?php else: ?>
                        Betriebssystem erkannt: Linux/Unix
                    <?php endif; ?>
                </small>
            </div>
            
            <div class="form-group">
                <label for="timezone">Zeitzone:</label>
                <select id="timezone" name="timezone">
                    <option value="Europe/Berlin" selected>Europe/Berlin</option>
                    <option value="Europe/Vienna">Europe/Vienna</option>
                    <option value="Europe/Zurich">Europe/Zurich</option>
                    <option value="UTC">UTC</option>
                </select>
            </div>
            
            <h3>Standard-Kartenposition</h3>
            
            <div class="form-group">
                <label for="map_default_lat">Breitengrad (Latitude):</label>
                <input type="number" id="map_default_lat" name="map_default_lat" step="any" value="51.1657" min="-90" max="90" required>
            </div>
            
            <div class="form-group">
                <label for="map_default_lng">Längengrad (Longitude):</label>
                <input type="number" id="map_default_lng" name="map_default_lng" step="any" value="10.4515" min="-180" max="180" required>
            </div>
            
            <div class="form-group">
                <label for="map_default_zoom">Zoom-Level (1-18):</label>
                <input type="number" id="map_default_zoom" name="map_default_zoom" value="6" min="1" max="18" required>
            </div>
            
            <button type="submit" class="btn-submit">Einrichten und loslegen</button>
        </form>
    </div>
</body>
</html>

