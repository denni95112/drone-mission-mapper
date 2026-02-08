/**
 * Map Initialization
 * Initializes all managers and sets up event handlers for map.php
 */

(function() {
    const header = document.querySelector('header');
    if (header) {
        header.addEventListener('mouseenter', () => {
            document.body.classList.add('header-expanded');
            setTimeout(() => {
                if (window.map) {
                    window.map.invalidateSize(false);
                }
            }, 350);
        });
        header.addEventListener('mouseleave', () => {
            document.body.classList.remove('header-expanded');
            setTimeout(() => {
                if (window.map) {
                    window.map.invalidateSize(false);
                }
            }, 350);
        });
    }
})();

/**
 * Initialize API connection toggle button
 */
function initApiConnectionToggle() {
    const toggleBtn = document.getElementById('api-connection-toggle');
    if (!toggleBtn) {
        console.warn('API connection toggle button not found, retrying...');
        setTimeout(initApiConnectionToggle, 200);
        return;
    }
    
    if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi === false) {
        toggleBtn.style.display = 'none';
        return;
    }
    
    if (!window.droneTracker) {
        console.warn('DroneTracker not available yet, retrying...');
        setTimeout(initApiConnectionToggle, 200);
        return;
    }
    
    console.log('Initializing API connection toggle button');
    
    function updateButtonState() {
        const actualToggleBtn = document.getElementById('api-connection-toggle');
        if (!actualToggleBtn) return;
        
        const isConnected = window.droneTracker.isConnected;
        const icon = document.getElementById('api-connection-icon');
        const text = document.getElementById('api-connection-text');
        
        if (isConnected) {
            actualToggleBtn.classList.remove('disconnected');
            if (icon) icon.textContent = '🔌';
            if (text) text.textContent = 'Verbunden';
            actualToggleBtn.title = 'API-Verbindung trennen';
        } else {
            actualToggleBtn.classList.add('disconnected');
            if (icon) icon.textContent = '🔴';
            if (text) text.textContent = 'Getrennt';
            actualToggleBtn.title = 'API-Verbindung herstellen';
        }
    }
    
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('API toggle clicked. Current state:', window.droneTracker.isConnected);
        
        if (window.droneTracker.isConnected) {
            console.log('Disconnecting from API...');
            window.droneTracker.stop();
            window.droneTracker.isConnected = false;
            
            if (window.zeitstrahlManager && window.zeitstrahlManager.stopLiveUpdates) {
                window.zeitstrahlManager.stopLiveUpdates();
                console.log('Stopped ZeitstrahlManager live updates');
            }
        } else {
            console.log('Connecting to API...');
            const missionId = window.missionManager?.currentMissionId || null;
            window.droneTracker.start(missionId);
            window.droneTracker.isConnected = true;
        }
        updateButtonState();
    });
    
    updateButtonState();
}

let initRetryCount = 0;
const MAX_INIT_RETRIES = 50;

/**
 * Initialize mission manager and all related components
 * Waits for Leaflet.draw to be available before initializing MissionManager
 */
function initMissionManager() {
    if (!window.mapTypeManager && window.map && typeof MapTypeManager !== 'undefined') {
        window.mapTypeManager = new MapTypeManager(window.map);
        console.log('MapTypeManager initialized successfully');
    }
    
    if (!window.sidebarManager && typeof SidebarManager !== 'undefined') {
        window.sidebarManager = new SidebarManager();
    }
    
    if (!window.droneTracker && typeof DroneTracker !== 'undefined') {
        if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi !== false) {
            window.droneTracker = new DroneTracker(window.map, 'api/drones.php');
            window.droneTracker.start();
            window.droneTracker.isConnected = true;
        } else {
            window.droneTracker = new DroneTracker(window.map, 'api/drones.php');
            window.droneTracker.isConnected = false;
        }
    }
    
    if (!window.zeitstrahlManager && typeof ZeitstrahlManager !== 'undefined') {
        window.zeitstrahlManager = new ZeitstrahlManager(window.map, window.droneTracker);
    }
    
    if (typeof L === 'undefined' || typeof L.Control === 'undefined' || typeof L.Control.Draw === 'undefined') {
        if (initRetryCount < MAX_INIT_RETRIES) {
            initRetryCount++;
            setTimeout(initMissionManager, 100);
            return;
        } else {
            console.error('Leaflet.draw failed to load after maximum retries');
            return;
        }
    }
    
    // Check if MissionManager class is defined
    if (typeof MissionManager === 'undefined') {
        if (initRetryCount < MAX_INIT_RETRIES) {
            initRetryCount++;
            if (initRetryCount % 10 === 0) {
                console.warn(`MissionManager class is not loaded yet, retrying... (attempt ${initRetryCount}/${MAX_INIT_RETRIES})`);
                const scripts = Array.from(document.querySelectorAll('script[src]'));
                const missionManagerScript = scripts.find(s => s.src.includes('mission-manager.js'));
                if (!missionManagerScript) {
                    console.error('mission-manager.js script tag not found in DOM!');
                } else if (missionManagerScript.onerror) {
                    console.error('mission-manager.js script failed to load!');
                }
            }
            setTimeout(initMissionManager, 100);
            return;
        } else {
            console.error('MissionManager class failed to load after maximum retries.');
            console.error('Please check:');
            console.error('1. Browser console for JavaScript errors in mission-manager.js');
            console.error('2. Network tab to verify mission-manager.js loaded successfully');
            console.error('3. That mission-manager.js contains: class MissionManager { ... }');
            return;
        }
    }
    
    initRetryCount = 0;
    
    if (!window.missionManager) {
        try {
            window.missionManager = new MissionManager(window.droneTracker, window.map);
            console.log('MissionManager initialized successfully');
        } catch (error) {
            console.error('Error initializing MissionManager:', error);
            return;
        }
    }
    
    if (!window.shareManager) {
        try {
            window.shareManager = new ShareManager(window.missionManager);
            console.log('ShareManager initialized successfully');
        } catch (error) {
            console.error('Error initializing ShareManager:', error);
        }
    }
    
    if (!window.missionSelectionManager) {
        try {
            window.missionSelectionManager = new MissionSelectionManager(window.map, window.missionManager, window.zeitstrahlManager);
            console.log('MissionSelectionManager initialized successfully');
        } catch (error) {
            console.error('Error initializing MissionSelectionManager:', error);
        }
    }
    
    if (!window.kmlManager) {
        try {
            window.kmlManager = new KMLManager(window.missionManager);
            console.log('KMLManager initialized successfully');
        } catch (error) {
            console.error('Error initializing KMLManager:', error);
        }
    }
    
    initApiConnectionToggle();
    initReloadPageButton();
}

/**
 * Initialize reload page button
 */
function initReloadPageButton() {
    const reloadBtn = document.getElementById('reload-page-btn');
    if (!reloadBtn) {
        setTimeout(initReloadPageButton, 200);
        return;
    }
    
    reloadBtn.addEventListener('click', () => {
        window.location.reload();
    });
}

/**
 * Ensure map container is properly centered
 */
function ensureMapCentering() {
    if (!isMapPage()) {
        return;
    }
    
    const mapContainer = document.getElementById('map');
    const mainContainer = document.querySelector('main');
    
    if (mapContainer && mainContainer) {
        if (!document.body.classList.contains('map-page')) {
            document.body.classList.add('map-page');
        }
        
        if (document.body.classList.contains('token-access')) {
            document.body.classList.remove('token-access');
        }
        
        mainContainer.style.removeProperty('height');
        mainContainer.style.removeProperty('max-height');
        mainContainer.style.removeProperty('margin-left');
        mainContainer.style.removeProperty('width');
        mainContainer.style.removeProperty('display');
        mainContainer.style.removeProperty('align-items');
        mainContainer.style.removeProperty('justify-content');
        mainContainer.style.removeProperty('position');
        
        mapContainer.style.removeProperty('width');
        mapContainer.style.removeProperty('height');
        mapContainer.style.removeProperty('max-height');
        mapContainer.style.removeProperty('aspect-ratio');
        mapContainer.style.removeProperty('margin');
        mapContainer.style.removeProperty('margin-left');
        mapContainer.style.removeProperty('margin-right');
        mapContainer.style.removeProperty('margin-top');
        mapContainer.style.removeProperty('margin-bottom');
        
        void mapContainer.offsetHeight;
        void mainContainer.offsetHeight;
    }
}

/**
 * Fix map size and centering when page becomes visible
 */
function handleMapResize() {
    if (typeof window.map !== 'undefined' && window.map) {
        if (isMapPage()) {
            ensureMapCentering();
        }
        
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            const originalDisplay = mapContainer.style.display;
            mapContainer.style.display = 'none';
            void mapContainer.offsetHeight;
            mapContainer.style.display = originalDisplay || '';
            void mapContainer.offsetHeight;
        }
        
        setTimeout(() => {
            if (isMapPage()) {
                ensureMapCentering();
            }
            if (window.map) {
                window.map.invalidateSize(false); // false = don't pan
            }
        }, 50);
        
        setTimeout(() => {
            if (isMapPage()) {
                ensureMapCentering();
            }
            if (window.map) {
                window.map.invalidateSize(false);
            }
        }, 200);
        
        setTimeout(() => {
            if (isMapPage()) {
                ensureMapCentering();
            }
            if (window.map) {
                window.map.invalidateSize(false);
            }
        }, 500);
        
        setTimeout(() => {
            if (isMapPage()) {
                ensureMapCentering();
            }
            if (window.map) {
                window.map.invalidateSize(false);
            }
        }, 1000);
    }
}

/**
 * Check if we're on the map page
 * @returns {boolean} True if on map page
 */
function isMapPage() {
    return document.body.classList.contains('map-page');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (isMapPage()) {
            ensureMapCentering();
        }
        initMissionManager();
        setTimeout(() => {
            if (isMapPage()) {
                ensureMapCentering();
            }
            if (window.map) window.map.invalidateSize();
        }, 300);
    });
} else {
    if (isMapPage()) {
        ensureMapCentering();
    }
    initMissionManager();
    setTimeout(() => {
        if (isMapPage()) {
            ensureMapCentering();
        }
        if (window.map) window.map.invalidateSize();
    }, 300);
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isMapPage()) {
        ensureMapCentering();
        handleMapResize();
    }
});

window.addEventListener('pageshow', (event) => {
    console.log('pageshow event fired, persisted:', event.persisted);
    
    if (!isMapPage()) {
        return;
    }
    
    ensureMapCentering();
    
    if (event.persisted) {
        console.log('Page restored from cache, reinitializing map...');
        
        if (document.body) {
            const originalDisplay = document.body.style.display;
            document.body.style.display = 'none';
            void document.body.offsetHeight;
            document.body.style.display = originalDisplay || '';
            void document.body.offsetHeight;
        }
        
        const mainContainer = document.querySelector('main');
        const mapContainer = document.getElementById('map');
        if (mainContainer) {
            mainContainer.style.display = 'none';
            void mainContainer.offsetHeight;
            mainContainer.style.display = '';
            void mainContainer.offsetHeight;
        }
        if (mapContainer) {
            mapContainer.style.display = 'none';
            void mapContainer.offsetHeight;
            mapContainer.style.display = '';
            void mapContainer.offsetHeight;
        }
        
        setTimeout(() => {
            ensureMapCentering();
            handleMapResize();
        }, 50);
        
        setTimeout(() => {
            ensureMapCentering();
            if (window.map) {
                window.map.invalidateSize(false);
            }
        }, 200);
        
        setTimeout(() => {
            ensureMapCentering();
            if (window.map) {
                window.map.invalidateSize(false);
            }
        }, 500);
    } else {
        setTimeout(() => {
            ensureMapCentering();
            handleMapResize();
        }, 0);
        
        setTimeout(() => {
            ensureMapCentering();
            if (window.map) {
                window.map.invalidateSize(false);
            }
        }, 100);
        
        setTimeout(() => {
            ensureMapCentering();
            if (window.map) {
                window.map.invalidateSize(false);
            }
        }, 300);
    }
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        handleMapResize();
    }, 250);
});

window.addEventListener('load', () => {
    handleMapResize();
});

window.addEventListener('focus', () => {
    if (isMapPage()) {
        ensureMapCentering();
        handleMapResize();
    }
});

const mapContainer = document.getElementById('map');
if (mapContainer && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
        if (window.map) {
            setTimeout(() => {
                window.map.invalidateSize(false);
            }, 100);
        }
    });
    
    observer.observe(mapContainer, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        childList: false,
        subtree: false
    });
}

const mainElement = document.querySelector('main');
if (mainElement && typeof MutationObserver !== 'undefined') {
    const mainObserver = new MutationObserver(() => {
        if (window.map) {
            setTimeout(() => {
                window.map.invalidateSize(false);
            }, 100);
        }
    });
    
    mainObserver.observe(mainElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        childList: false,
        subtree: false
    });
}

(function() {
    /**
     * Convert arguments to string
     * @param {Array} args - Arguments to convert
     * @returns {string} String representation
     */
    function argsToString(args) {
        return args.map(arg => {
            if (arg === null) return 'null';
            if (arg === undefined) return 'undefined';
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 0);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }
    
    console.log = function(...args) {
        if (window.fileLogger) {
            window.fileLogger.debug(argsToString(args));
        }
    };
    
    console.warn = function(...args) {
        if (window.fileLogger) {
            window.fileLogger.warn(argsToString(args));
        }
    };
    
    console.error = function(...args) {
        if (window.fileLogger) {
            window.fileLogger.error(argsToString(args));
        }
    };
    
    console.info = function(...args) {
        if (window.fileLogger) {
            window.fileLogger.info(argsToString(args));
        }
    };
    
    console.debug = function(...args) {
        if (window.fileLogger) {
            window.fileLogger.debug(argsToString(args));
        }
    };
})();

