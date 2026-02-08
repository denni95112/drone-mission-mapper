<?php
/**
 * Check for updates from GitHub releases
 * Returns information about newer releases if available
 */

require_once __DIR__ . '/../includes/error_reporting.php';
require_once __DIR__ . '/../includes/security_headers.php';
require_once __DIR__ . '/../version.php';

header('Content-Type: application/json');

$cacheFile = __DIR__ . '/../cache/update_check.json';
$cacheDuration = 3600;

if (file_exists($cacheFile)) {
    $cacheData = json_decode(file_get_contents($cacheFile), true);
    if ($cacheData && isset($cacheData['timestamp']) && (time() - $cacheData['timestamp']) < $cacheDuration) {
        echo json_encode($cacheData['data']);
        exit;
    }
}

try {
    $owner = GITHUB_REPO_OWNER;
    $repo = GITHUB_REPO_NAME;
    $currentVersion = APP_VERSION;
    
    $url = "https://api.github.com/repos/{$owner}/{$repo}/releases/latest";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'User-Agent: drone-mission-mapper',
        'Accept: application/vnd.github.v3+json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        throw new Exception("cURL error: " . $curlError);
    }
    
    if ($httpCode !== 200) {
        throw new Exception("GitHub API returned status code: " . $httpCode);
    }
    
    $releaseData = json_decode($response, true);
    
    if (!$releaseData || !isset($releaseData['tag_name'])) {
        throw new Exception("Invalid response from GitHub API");
    }
    
    $latestVersion = ltrim($releaseData['tag_name'], 'v'); // Remove 'v' prefix if present
    $releaseUrl = $releaseData['html_url'] ?? '';
    $releaseName = $releaseData['name'] ?? $releaseData['tag_name'];
    $publishedAt = $releaseData['published_at'] ?? '';
    
    $hasUpdate = version_compare($latestVersion, $currentVersion, '>');
    
    $result = [
        'has_update' => $hasUpdate,
        'current_version' => $currentVersion,
        'latest_version' => $latestVersion,
        'release_url' => $releaseUrl,
        'release_name' => $releaseName,
        'published_at' => $publishedAt
    ];
    
    $cacheDir = dirname($cacheFile);
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }
    file_put_contents($cacheFile, json_encode([
        'timestamp' => time(),
        'data' => $result
    ]));
    
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log('Error checking for updates: ' . $e->getMessage());
    echo json_encode([
        'has_update' => false,
        'current_version' => APP_VERSION,
        'latest_version' => APP_VERSION,
        'error' => 'Failed to check for updates'
    ]);
}
