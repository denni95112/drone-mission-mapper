/**
 * Map Utilities
 * Shared utility functions for map-related operations
 */

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Attach to window for explicit global access
window.escapeHtml = escapeHtml;

/**
 * Generate a unique color for grid cells using HSL color space
 * Uses golden angle approximation for better color distribution
 * @param {number} index - Cell index (0-based)
 * @returns {string} HSL color string
 */
function generateColor(index) {
    const hue = (index * 137.508) % 360;
    const saturation = 70 + (index % 3) * 10;
    const lightness = 50 + (index % 2) * 10;
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

window.generateColor = generateColor;

/**
 * Get emoji icon for icon type
 * @param {string} iconType - Type of icon ('vehicle', 'person', 'drone', 'poi', 'fire', 'fire_truck', 'ambulance', 'police', 'thw')
 * @returns {string} Emoji character
 */
function getIconEmoji(iconType) {
    const emojis = {
        'vehicle': '🚗',
        'person': '👤',
        'drone': '🚁',
        'poi': '📍',
        'fire': '🔥',
        'fire_truck': '🚒',
        'ambulance': '🚑',
        'police': '🚔',
        'thw': '🚛'
    };
    return emojis[iconType] || '📍';
}

// Attach to window for explicit global access
window.getIconEmoji = getIconEmoji;

/**
 * Generate distinct colors for multiple drones
 * @param {number} count - Number of drones
 * @returns {Array<string>} Array of HSL color strings
 */
function generateDroneColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 360 / count) % 360;
        colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
}

window.generateDroneColors = generateDroneColors;

/**
 * Create an ellipse polygon from bounds
 * @param {L.LatLngBounds} bounds - Leaflet bounds object
 * @returns {L.Polygon} Leaflet polygon with ellipse shape
 */
function createEllipseFromBounds(bounds) {
    const center = bounds.getCenter();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    const a = Math.abs(ne.lat - center.lat);
    const b = Math.abs(ne.lng - center.lng);
    
    const points = [];
    const numPoints = 64;
    
    for (let i = 0; i < numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints;
        const lat = center.lat + a * Math.cos(angle);
        const lng = center.lng + b * Math.sin(angle);
        points.push([lat, lng]);
    }
    
    points.push(points[0]);
    
    const ellipse = L.polygon(points, {
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        weight: 2
    });
    
    return ellipse;
}

window.createEllipseFromBounds = createEllipseFromBounds;

/**
 * Safely set text content (prevents XSS)
 * @param {HTMLElement} element - Element to set text on
 * @param {string} text - Text content
 */
function setTextContent(element, text) {
    if (element) {
        element.textContent = text;
    }
}

window.setTextContent = setTextContent;

/**
 * Safely clear element content
 * @param {HTMLElement} element - Element to clear
 */
function clearElement(element) {
    if (element) {
        element.textContent = '';
    }
}

window.clearElement = clearElement;

/**
 * Safely set HTML content with escaping
 * @param {HTMLElement} element - Element to set HTML on
 * @param {string} html - HTML content (will be escaped)
 */
function setSafeHtml(element, html) {
    if (element) {
        element.innerHTML = escapeHtml(html);
    }
}

window.setSafeHtml = setSafeHtml;

/**
 * Validate mission ID format
 * @param {string} missionId - Mission ID to validate
 * @returns {boolean} True if valid
 */
function validateMissionId(missionId) {
    if (!missionId || typeof missionId !== 'string') {
        return false;
    }
    return /^[a-zA-Z0-9_\- ]{1,100}$/.test(missionId);
}

window.validateMissionId = validateMissionId;

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if valid
 */
function validateCoordinates(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number' &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180;
}

window.validateCoordinates = validateCoordinates;

/**
 * Get CSRF token from meta tag
 * @returns {string|null} CSRF token or null
 */
function getCSRFToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : null;
}

window.getCSRFToken = getCSRFToken;

/**
 * Safe fetch wrapper with error handling and CSRF token
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function safeFetch(url, options = {}) {
    const csrfToken = getCSRFToken();
    
    if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase())) {
        if (!options.headers) {
            options.headers = {};
        }
        if (options.headers instanceof Headers) {
            options.headers.set('X-CSRF-Token', csrfToken);
        } else {
            options.headers['X-CSRF-Token'] = csrfToken;
        }
    }
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

window.safeFetch = safeFetch;

