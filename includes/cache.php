<?php
/**
 * Caching utilities for performance optimization
 */

/**
 * Simple in-memory cache with TTL
 */
class SimpleCache {
    private static $cache = [];
    private static $cacheTime = [];
    private static $defaultTtl = 300; // 5 minutes default
    
    /**
     * Get cached value
     * @param string $key Cache key
     * @return mixed|null Cached value or null if not found/expired
     */
    static function get($key) {
        if (!isset(self::$cache[$key])) {
            return null;
        }
        
        $entry = self::$cache[$key];
        $ttl = isset($entry['ttl']) ? $entry['ttl'] : self::$defaultTtl;
        
        if (time() - $entry['time'] > $ttl) {
            unset(self::$cache[$key], self::$cacheTime[$key]);
            return null;
        }
        
        return $entry['data'];
    }
    
    /**
     * Set cached value
     * @param string $key Cache key
     * @param mixed $data Data to cache
     * @param int|null $ttl Time to live in seconds (null = use default)
     */
    static function set($key, $data, $ttl = null) {
        self::$cache[$key] = [
            'data' => $data,
            'time' => time(),
            'ttl' => $ttl ?? self::$defaultTtl
        ];
        self::$cacheTime[$key] = time();
    }
    
    /**
     * Invalidate cache entry
     * @param string $key Cache key
     */
    static function invalidate($key) {
        unset(self::$cache[$key], self::$cacheTime[$key]);
    }
    
    /**
     * Clear all cache
     */
    static function clear() {
        self::$cache = [];
        self::$cacheTime = [];
    }
    
    /**
     * Get cache statistics
     * @return array Cache stats
     */
    static function getStats() {
        $total = count(self::$cache);
        $expired = 0;
        $now = time();
        
        foreach (self::$cache as $key => $entry) {
            $ttl = isset($entry['ttl']) ? $entry['ttl'] : self::$defaultTtl;
            if ($now - $entry['time'] > $ttl) {
                $expired++;
            }
        }
        
        return [
            'total' => $total,
            'expired' => $expired,
            'active' => $total - $expired
        ];
    }
    
    /**
     * Clear all cache entries that start with a given prefix
     * @param string $prefix Key prefix to match
     */
    static function clearByPrefix($prefix) {
        $keys = array_keys(self::$cache);
        foreach ($keys as $key) {
            if (strpos($key, $prefix) === 0) {
                self::invalidate($key);
            }
        }
    }
}

/**
 * Mission-specific cache
 */
class MissionCache {
    private static $defaultTtl = 300; // 5 minutes
    
    /**
     * Get cached mission data
     * @param string $missionId Mission ID
     * @return array|null Cached mission data or null
     */
    static function get($missionId) {
        $key = "mission_{$missionId}";
        return SimpleCache::get($key);
    }
    
    /**
     * Set cached mission data
     * @param string $missionId Mission ID
     * @param array $data Mission data
     * @param int|null $ttl Time to live (null = use default)
     */
    static function set($missionId, $data, $ttl = null) {
        $key = "mission_{$missionId}";
        if (isset($data['status']) && $data['status'] === 'completed') {
            $ttl = $ttl ?? 3600;
        } else {
            $ttl = $ttl ?? self::$defaultTtl;
        }
        SimpleCache::set($key, $data, $ttl);
    }
    
    /**
     * Invalidate mission cache
     * @param string $missionId Mission ID
     */
    static function invalidate($missionId) {
        $key = "mission_{$missionId}";
        SimpleCache::invalidate($key);
    }
    
    /**
     * Clear all mission caches
     */
    static function clear() {
        SimpleCache::clearByPrefix('mission_');
    }
}

/**
 * API response cache
 */
class ApiCache {
    private static $defaultTtl = 5; // 5 seconds for API responses
    
    /**
     * Get cached API response
     * @param string $endpoint API endpoint
     * @param array $params Request parameters
     * @return mixed|null Cached response or null
     */
    static function get($endpoint, $params = []) {
        $key = self::buildKey($endpoint, $params);
        return SimpleCache::get($key);
    }
    
    /**
     * Set cached API response
     * @param string $endpoint API endpoint
     * @param array $params Request parameters
     * @param mixed $data Response data
     * @param int|null $ttl Time to live (null = use default)
     */
    static function set($endpoint, $params, $data, $ttl = null) {
        $key = self::buildKey($endpoint, $params);
        SimpleCache::set($key, $data, $ttl ?? self::$defaultTtl);
    }
    
    /**
     * Invalidate API cache
     * @param string $endpoint API endpoint
     * @param array $params Request parameters
     */
    static function invalidate($endpoint, $params = []) {
        $key = self::buildKey($endpoint, $params);
        SimpleCache::invalidate($key);
    }
    
    /**
     * Build cache key from endpoint and params
     * @param string $endpoint API endpoint
     * @param array $params Request parameters
     * @return string Cache key
     */
    private static function buildKey($endpoint, $params) {
        $paramStr = !empty($params) ? '_' . md5(json_encode($params)) : '';
        return "api_{$endpoint}{$paramStr}";
    }
}
