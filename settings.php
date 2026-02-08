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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $navigation_title = trim($_POST['navigation_title'] ?? '');
    $logo_path = $config['logo_path'] ?? ''; // Keep existing logo path by default
    $debugMode = isset($_POST['debugMode']) && $_POST['debugMode'] === '1';
    $timezone = trim($_POST['timezone'] ?? 'Europe/Berlin');
    $map_default_lat = floatval($_POST['map_default_lat'] ?? 51.1657);
    $map_default_lng = floatval($_POST['map_default_lng'] ?? 10.4515);
    $map_default_zoom = intval($_POST['map_default_zoom'] ?? 6);
    $log_level = trim($_POST['log_level'] ?? 'info');
    
    $password_hash = $config['password_hash'] ?? '';
    $old_password = $_POST['old_password'] ?? '';
    $new_password = $_POST['new_password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';
    
    if (!empty($old_password) || !empty($new_password) || !empty($confirm_password)) {
        if (empty($old_password)) {
            $error = 'Bitte geben Sie Ihr aktuelles Passwort ein.';
        } elseif (empty($new_password)) {
            $error = 'Bitte geben Sie ein neues Passwort ein.';
        } elseif (strlen($new_password) < 6) {
            $error = 'Das neue Passwort muss mindestens 6 Zeichen lang sein.';
        } elseif ($new_password !== $confirm_password) {
            $error = 'Die neuen Passwörter stimmen nicht überein.';
        } else {
            $currentPasswordHash = $config['password_hash'] ?? '';
            $passwordValid = false;
            
            if (password_verify($old_password, $currentPasswordHash)) {
                $passwordValid = true;
            } elseif (hash('sha256', $old_password) === $currentPasswordHash) {
                $passwordValid = true;
            }
            
            if (!$passwordValid) {
                $error = 'Das aktuelle Passwort ist falsch.';
            } else {
                $password_hash = password_hash($new_password, PASSWORD_DEFAULT);
                $success = 'Passwort wurde erfolgreich geändert.';
            }
        }
    }
    
    if (isset($_POST['delete_logo']) && $_POST['delete_logo'] === '1') {
        $oldLogoPath = $config['logo_path'] ?? '';
        if (!empty($oldLogoPath)) {
            $oldLogoFullPath = __DIR__ . '/' . $oldLogoPath;
            if (file_exists($oldLogoFullPath) && is_file($oldLogoFullPath)) {
                @unlink($oldLogoFullPath);
            }
        }
        $logo_path = '';
    }
    
    if (isset($_FILES['logo_file']) && $_FILES['logo_file']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/uploads';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0755, true);
        }
        
        $uploadedFile = $_FILES['logo_file'];
        $fileName = $uploadedFile['name'];
        $fileTmpName = $uploadedFile['tmp_name'];
        $fileSize = $uploadedFile['size'];
        $fileError = $uploadedFile['error'];
        
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
        
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        $fileType = null;
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $fileType = finfo_file($finfo, $fileTmpName);
            finfo_close($finfo);
        } elseif (function_exists('mime_content_type')) {
            $fileType = mime_content_type($fileTmpName);
        }
        
        if (!in_array($fileExtension, $allowedExtensions)) {
            $error = 'Ungültiger Dateityp. Nur Bilder (JPEG, PNG, GIF, SVG, WebP) sind erlaubt.';
        } elseif ($fileType && !in_array($fileType, $allowedTypes)) {
            $error = 'Ungültiger Dateityp. Nur Bilder (JPEG, PNG, GIF, SVG, WebP) sind erlaubt.';
        } elseif ($fileSize > 5 * 1024 * 1024) {
            $error = 'Datei ist zu groß. Maximale Größe: 5 MB.';
        } else {
            $oldLogoPath = $config['logo_path'] ?? '';
            if (!empty($oldLogoPath)) {
                $oldLogoFullPath = __DIR__ . '/' . $oldLogoPath;
                if (file_exists($oldLogoFullPath) && is_file($oldLogoFullPath)) {
                    @unlink($oldLogoFullPath);
                }
            }
            
            $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
            $newFileName = 'logo_' . time() . '_' . uniqid() . '.' . $fileExtension;
            $newFilePath = $uploadDir . '/' . $newFileName;
            
            if (move_uploaded_file($fileTmpName, $newFilePath)) {
                $logo_path = 'uploads/' . $newFileName;
            } else {
                $error = 'Fehler beim Hochladen der Datei. Bitte überprüfen Sie die Schreibrechte.';
            }
        }
    }
    
    $valid_log_levels = ['debug', 'info', 'warning', 'error'];
    if (!in_array($log_level, $valid_log_levels)) {
        $error = 'Ungültiger Log-Level.';
    } elseif (empty($navigation_title)) {
        $error = 'Anwendungsname ist erforderlich.';
    } elseif ($map_default_lat < -90 || $map_default_lat > 90) {
        $error = 'Ungültiger Breitengrad. Bitte verwenden Sie einen Wert zwischen -90 und 90.';
    } elseif ($map_default_lng < -180 || $map_default_lng > 180) {
        $error = 'Ungültiger Längengrad. Bitte verwenden Sie einen Wert zwischen -180 und 180.';
    } elseif ($map_default_zoom < 1 || $map_default_zoom > 18) {
        $error = 'Ungültiger Zoom-Level. Bitte verwenden Sie einen Wert zwischen 1 und 18.';
    } else {
        $updatedConfig = $config;
        $updatedConfig['navigation_title'] = $navigation_title;
        $updatedConfig['logo_path'] = $logo_path;
        $updatedConfig['password_hash'] = $password_hash;
        $updatedConfig['debugMode'] = $debugMode;
        $updatedConfig['timezone'] = $timezone;
        $updatedConfig['map_default_lat'] = $map_default_lat;
        $updatedConfig['map_default_lng'] = $map_default_lng;
        $updatedConfig['map_default_zoom'] = $map_default_zoom;
        $updatedConfig['log_level'] = $log_level;
        
        $configDir = __DIR__ . '/config';
        $configContent = "<?php\nreturn " . var_export($updatedConfig, true) . ";\n";
        
        if (file_put_contents($configDir . '/config.php', $configContent)) {
            $success = 'Einstellungen wurden erfolgreich gespeichert.';
            $config = $updatedConfig;
        } else {
            $error = 'Fehler beim Speichern der Einstellungen. Bitte überprüfen Sie die Schreibrechte.';
        }
    }
}

$timezones = [
    'Europe/Berlin' => 'Europe/Berlin (Deutschland)',
    'Europe/Vienna' => 'Europe/Vienna (Österreich)',
    'Europe/Zurich' => 'Europe/Zurich (Schweiz)',
    'UTC' => 'UTC',
];
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Einstellungen - <?php echo $config['navigation_title'] ?></title>
    <link rel="stylesheet" href="css/styles.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/navigation.css?v=<?php echo APP_VERSION; ?>">
    <link rel="stylesheet" href="css/settings.css?v=<?php echo APP_VERSION; ?>">
</head>
<body>
    <?php include 'includes/header.php'; ?>
    
    <main>
        <div class="settings-container">
            <div class="page-header">
                <h1>Einstellungen</h1>
                <p>Verwalten Sie die Anwendungskonfiguration</p>
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
            
            <form method="post" action="settings.php" class="settings-form" enctype="multipart/form-data">
                <div class="settings-section">
                    <h2>Allgemeine Einstellungen</h2>
                    
                    <div class="form-group">
                        <label for="navigation_title">Anwendungsname:</label>
                        <input type="text" id="navigation_title" name="navigation_title" 
                               value="<?php echo htmlspecialchars($config['navigation_title'] ?? ''); ?>" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="logo_file">Logo hochladen:</label>
                        <?php 
                        $currentLogoPath = $config['logo_path'] ?? '';
                        $currentLogoExists = !empty($currentLogoPath) && file_exists(__DIR__ . '/' . $currentLogoPath);
                        ?>
                        <?php if ($currentLogoExists): ?>
                            <div class="logo-preview-container">
                                <div class="logo-preview">
                                    <img src="<?php echo htmlspecialchars($currentLogoPath, ENT_QUOTES, 'UTF-8'); ?>" 
                                         alt="Aktuelles Logo" 
                                         class="logo-preview-image">
                                    <div class="logo-preview-info">
                                        <span class="logo-filename"><?php echo htmlspecialchars(basename($currentLogoPath)); ?></span>
                                        <button type="button" 
                                                class="btn-delete-logo" 
                                                onclick="document.getElementById('delete_logo_hidden').value = '1'; this.form.submit();">
                                            🗑️ Logo löschen
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <input type="hidden" id="delete_logo_hidden" name="delete_logo" value="0">
                        <?php endif; ?>
                        <input type="file" 
                               id="logo_file" 
                               name="logo_file" 
                               accept="image/jpeg,image/jpg,image/png,image/gif,image/svg+xml,image/webp"
                               class="logo-upload-input">
                        <small>
                            Unterstützte Formate: JPEG, PNG, GIF, SVG, WebP<br>
                            Maximale Dateigröße: 5 MB
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="timezone">Zeitzone:</label>
                        <select id="timezone" name="timezone">
                            <?php foreach ($timezones as $tz => $label): ?>
                                <option value="<?php echo htmlspecialchars($tz); ?>" 
                                        <?php echo ($config['timezone'] ?? 'Europe/Berlin') === $tz ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($label); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="debugMode" name="debugMode" value="1" 
                                   <?php echo ($config['debugMode'] ?? false) ? 'checked' : ''; ?>>
                            <span>Debug-Modus aktivieren</span>
                        </label>
                        <small>WARNUNG: Nur für Entwicklung verwenden! Zeigt PHP-Fehler auf allen Seiten an.</small>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h2>Passwort ändern</h2>
                    <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1rem;">
                        Lassen Sie die Felder leer, wenn Sie das Passwort nicht ändern möchten.
                    </p>
                    
                    <div class="form-group">
                        <label for="old_password">Aktuelles Passwort:</label>
                        <input type="password" 
                               id="old_password" 
                               name="old_password" 
                               class="password-input"
                               autocomplete="current-password">
                    </div>
                    
                    <div class="form-group">
                        <label for="new_password">Neues Passwort:</label>
                        <input type="password" 
                               id="new_password" 
                               name="new_password" 
                               class="password-input"
                               autocomplete="new-password">
                        <small>Mindestens 6 Zeichen</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="confirm_password">Neues Passwort bestätigen:</label>
                        <input type="password" 
                               id="confirm_password" 
                               name="confirm_password" 
                               class="password-input"
                               autocomplete="new-password">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h2>Karten-Einstellungen</h2>
                    
                    <div class="form-group">
                        <label for="map_default_lat">Standard-Breitengrad (Latitude):</label>
                        <input type="number" id="map_default_lat" name="map_default_lat" 
                               step="any" value="<?php echo htmlspecialchars($config['map_default_lat'] ?? 51.1657); ?>" 
                               min="-90" max="90" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="map_default_lng">Standard-Längengrad (Longitude):</label>
                        <input type="number" id="map_default_lng" name="map_default_lng" 
                               step="any" value="<?php echo htmlspecialchars($config['map_default_lng'] ?? 10.4515); ?>" 
                               min="-180" max="180" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="map_default_zoom">Standard-Zoom-Level (1-18):</label>
                        <input type="number" id="map_default_zoom" name="map_default_zoom" 
                               value="<?php echo htmlspecialchars($config['map_default_zoom'] ?? 6); ?>" 
                               min="1" max="18" required>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h2>Logging-Einstellungen</h2>
                    
                    <div class="form-group">
                        <label for="log_level">Log-Level:</label>
                        <select id="log_level" name="log_level">
                            <option value="debug" <?php echo ($config['log_level'] ?? 'info') === 'debug' ? 'selected' : ''; ?>>Debug (alles loggen)</option>
                            <option value="info" <?php echo ($config['log_level'] ?? 'info') === 'info' ? 'selected' : ''; ?>>Info (Info, Warnungen, Fehler)</option>
                            <option value="warning" <?php echo ($config['log_level'] ?? 'info') === 'warning' ? 'selected' : ''; ?>>Warning (Warnungen und Fehler)</option>
                            <option value="error" <?php echo ($config['log_level'] ?? 'info') === 'error' ? 'selected' : ''; ?>>Error (nur Fehler)</option>
                        </select>
                        <small>
                            <strong>Debug:</strong> Loggt alles (am ausführlichsten)<br>
                            <strong>Info:</strong> Loggt Info, Warnungen und Fehler<br>
                            <strong>Warning:</strong> Loggt nur Warnungen und Fehler<br>
                            <strong>Error:</strong> Loggt nur Fehler (am wenigsten ausführlich)
                        </small>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Einstellungen speichern</button>
                    <a href="map.php" class="btn-secondary">Abbrechen</a>
                </div>
            </form>
        </div>
    </main>
    
    <?php include 'includes/footer.php'; ?>
</body>
</html>
