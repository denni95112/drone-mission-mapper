/**
 * Client-side caching for API responses
 * Reduces server load and improves response times
 */
class ResponseCache {
    constructor(ttl = 5000) {
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    /**
     * Get cached response
     * @param {string} key Cache key (usually URL)
     * @returns {any|null} Cached data or null if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        
        if (Date.now() - entry.time > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data;
    }
    
    /**
     * Set cached response
     * @param {string} key Cache key
     * @param {any} data Data to cache
     * @param {number|null} ttl Time to live in milliseconds (null = use default)
     */
    set(key, data, ttl = null) {
        this.cache.set(key, {
            data: data,
            time: Date.now(),
            ttl: ttl ?? this.ttl
        });
    }
    
    /**
     * Invalidate cache entry
     * @param {string} key Cache key
     */
    invalidate(key) {
        this.cache.delete(key);
    }
    
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }
    
    /**
     * Get cache statistics
     * @returns {object} Cache stats
     */
    getStats() {
        const total = this.cache.size;
        const now = Date.now();
        let expired = 0;
        let active = 0;
        
        this.cache.forEach(entry => {
            if (now - entry.time > entry.ttl) {
                expired++;
            } else {
                active++;
            }
        });
        
        return {
            total: total,
            active: active,
            expired: expired
        };
    }
    
    /**
     * Clean expired entries
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        
        this.cache.forEach((entry, key) => {
            if (now - entry.time > entry.ttl) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => this.cache.delete(key));
        
        return keysToDelete.length;
    }
}

const apiCache = new ResponseCache(3000);

setInterval(() => {
    apiCache.cleanup();
}, 30000);

/**
 * Enhanced fetch with caching
 * @param {string} url URL to fetch
 * @param {object} options Fetch options
 * @param {number|null} cacheTtl Cache TTL in milliseconds (null = use default)
 * @returns {Promise} Fetch promise
 */
async function fetchWithCache(url, options = {}, cacheTtl = null) {
    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET') {
        return fetch(url, options);
    }
    
    const cached = apiCache.get(url);
    if (cached !== null) {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => cached,
            text: async () => JSON.stringify(cached),
            clone: function() { return this; }
        });
    }
    
    try {
        const response = await fetch(url, options);
        if (response.ok) {
            const data = await response.json();
            apiCache.set(url, data, cacheTtl);
        }
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

window.apiCache = apiCache;
window.fetchWithCache = fetchWithCache;
