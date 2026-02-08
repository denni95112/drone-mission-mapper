/**
 * View Mission Initialization
 * Initializes map and managers for view_mission.php
 */

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
 * Initialize map for view mission page
 * @param {number} mapLat - Map latitude
 * @param {number} mapLng - Map longitude
 * @param {number} mapZoom - Map zoom level
 * @param {Object} missionData - Mission data from PHP
 * @param {string} missionId - Mission ID
 */
function initViewMissionMap(mapLat, mapLng, mapZoom, missionData, missionId) {
    const map = L.map('map').setView([mapLat, mapLng], mapZoom);
    window.map = map;
    
    if (!window.mapTypeManager) {
        window.mapTypeManager = new MapTypeManager(map);
        console.log('MapTypeManager initialized successfully');
    }
    
    console.log('=== VIEW MISSION DEBUG ===');
    console.log('Mission data from PHP:', missionData);
    console.log('Mission ID:', missionId);
    console.log('Has bounds_ne_lat:', missionData.bounds_ne_lat);
    console.log('Has bounds_sw_lat:', missionData.bounds_sw_lat);
    console.log('Has num_areas:', missionData.num_areas);
    console.log('Has center_lat:', missionData.center_lat);
    console.log('Has center_lng:', missionData.center_lng);
    console.log('========================');
    
    console.log('Map initialized:', map);
    console.log('Map center:', map.getCenter());
    
    window.sidebarManager = new SidebarManager();
    
    (function() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
        const sidebarBackdrop = document.getElementById('sidebar-backdrop');
        
        function isMobile() {
            return window.innerWidth <= 768;
        }
        
        function openSidebar() {
            if (sidebar) {
                sidebar.classList.add('open');
                if (isMobile()) {
                    document.body.classList.add('sidebar-open-mobile');
                }
            }
            if (sidebarBackdrop) {
                sidebarBackdrop.classList.add('active');
            }
            if (isMobile()) {
                document.body.style.overflow = 'hidden';
            }
            updateOpenButton();
        }
        
        function closeSidebar() {
            if (sidebar) {
                sidebar.classList.remove('open');
                document.body.classList.remove('sidebar-open-mobile');
            }
            if (sidebarBackdrop) {
                sidebarBackdrop.classList.remove('active');
            }
            document.body.style.overflow = '';
            updateOpenButton();
        }
        
        function updateMobileSidebar() {
            if (!isMobile()) {
                // On desktop, ensure sidebar is not in mobile overlay mode
                closeSidebar();
                // Remove mobile body class
                document.body.classList.remove('sidebar-open-mobile');
            } else {
                // On mobile, sync body class with sidebar state
                if (sidebar && sidebar.classList.contains('open')) {
                    document.body.classList.add('sidebar-open-mobile');
                } else {
                    document.body.classList.remove('sidebar-open-mobile');
                }
            }
        }
        
        // Handle sidebar toggle button (inside sidebar)
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                if (isMobile()) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSidebar();
                }
            });
        }
        
        // Handle sidebar open button (outside sidebar) - mobile only
        // Desktop is handled by SidebarManager
        if (sidebarOpenBtn) {
            sidebarOpenBtn.addEventListener('click', (e) => {
                if (isMobile()) {
                    e.preventDefault();
                    e.stopPropagation();
                    openSidebar();
                }
                // Desktop: let SidebarManager handle it (already attached in SidebarManager.init())
            });
        }
        
        // Close sidebar when clicking backdrop
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', () => {
                closeSidebar();
            });
        }
        
        // Close sidebar when clicking outside on mobile
        if (sidebar) {
            sidebar.addEventListener('click', (e) => {
                // Only close if clicking the sidebar itself, not its children
                if (isMobile() && e.target === sidebar) {
                    closeSidebar();
                }
            });
        }
        
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                updateMobileSidebar();
                if (window.map) {
                    window.map.invalidateSize();
                }
            }, 250);
        });
        
        // Show/hide open button based on sidebar state
        function updateOpenButton() {
            if (sidebarOpenBtn) {
                if (isMobile()) {
                    // Mobile: show when sidebar is not open
                    if (sidebar && !sidebar.classList.contains('open')) {
                        sidebarOpenBtn.classList.remove('sidebar-open-btn-hidden');
                        // Remove inline display style to let CSS handle it
                        sidebarOpenBtn.style.removeProperty('display');
                    } else {
                        // Sidebar is open - hide button
                        sidebarOpenBtn.classList.add('sidebar-open-btn-hidden');
                        // Force hide with inline style as backup
                        sidebarOpenBtn.style.display = 'none';
                        sidebarOpenBtn.style.visibility = 'hidden';
                        sidebarOpenBtn.style.opacity = '0';
                    }
                } else {
                    // Desktop: show when sidebar is collapsed (using SidebarManager)
                    if (window.sidebarManager && window.sidebarManager.isCollapsed) {
                        sidebarOpenBtn.classList.remove('sidebar-open-btn-hidden');
                        sidebarOpenBtn.style.removeProperty('display');
                        sidebarOpenBtn.style.removeProperty('visibility');
                        sidebarOpenBtn.style.removeProperty('opacity');
                    } else {
                        sidebarOpenBtn.classList.add('sidebar-open-btn-hidden');
                        sidebarOpenBtn.style.display = 'none';
                    }
                }
            }
        }
        
        if (sidebar) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (isMobile()) {
                            if (sidebar.classList.contains('open')) {
                                document.body.classList.add('sidebar-open-mobile');
                            } else {
                                document.body.classList.remove('sidebar-open-mobile');
                            }
                        }
                        updateOpenButton();
                    }
                });
            });
            observer.observe(sidebar, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
        
        updateMobileSidebar();
        setTimeout(() => {
            updateOpenButton();
            if (isMobile() && sidebar) {
                if (sidebar.classList.contains('open')) {
                    document.body.classList.add('sidebar-open-mobile');
                } else {
                    document.body.classList.remove('sidebar-open-mobile');
                }
            }
        }, 100);
    })();
    
    map.whenReady(() => {
        console.log('Map is ready, initializing mission manager');
        console.log('Mission data available:', missionData);
        
        try {
            window.viewOnlyManager = new ViewOnlyMissionManager(map, missionData, missionId);
            console.log('ViewOnlyMissionManager initialized');
        } catch (error) {
            console.error('ERROR initializing ViewOnlyMissionManager:', error);
            console.error('Error stack:', error.stack);
            alert('Fehler beim Initialisieren der Mission: ' + error.message);
        }
    });
    
    /**
     * Initialize API connection toggle button for view mode
     */
    function initApiConnectionToggle() {
        const toggleBtn = document.getElementById('api-connection-toggle');
        if (!toggleBtn) return;
        
        if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi === false) {
            toggleBtn.style.display = 'none';
            return;
        }
        
        let droneTracker = null;
        let isConnected = false;
        
        function updateButtonState() {
            const icon = document.getElementById('api-connection-icon');
            const text = document.getElementById('api-connection-text');
            
            if (isConnected) {
                toggleBtn.classList.remove('disconnected');
                if (icon) icon.textContent = '🔌';
                if (text) text.textContent = 'Verbunden';
                toggleBtn.title = 'API-Verbindung trennen';
            } else {
                toggleBtn.classList.add('disconnected');
                if (icon) icon.textContent = '🔴';
                if (text) text.textContent = 'Getrennt';
                toggleBtn.title = 'API-Verbindung herstellen';
            }
        }
        
        toggleBtn.addEventListener('click', () => {
            if (isConnected) {
                if (droneTracker) {
                    droneTracker.stop();
                    droneTracker = null;
                }
                isConnected = false;
            } else {
                if (typeof DroneTracker !== 'undefined') {
                    droneTracker = new DroneTracker(map, 'api/drones.php');
                    const missionId = window.viewOnlyManager?.missionId || null;
                    droneTracker.start(missionId);
                    isConnected = true;
                } else {
                    alert('DroneTracker ist nicht verfügbar. Bitte laden Sie die Seite neu.');
                }
            }
            updateButtonState();
        });
        
        isConnected = false;
        updateButtonState();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApiConnectionToggle);
    } else {
        initApiConnectionToggle();
    }
    
    (function initLegendToggle() {
        function isMobile() {
            return window.innerWidth <= 768;
        }
        
        function getElements() {
            return {
                legend: document.getElementById('map-legend'),
                closeBtn: document.getElementById('map-legend-close-btn'),
                toggleBtn: document.getElementById('map-legend-toggle-btn')
            };
        }
        
        function closeLegend() {
            if (!isMobile()) return; // Only on mobile
            const { legend, toggleBtn } = getElements();
            if (!legend) return;
            
            legend.classList.add('legend-closed');
            legend.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.style.display = 'block';
            }
            // Store state
            try {
                localStorage.setItem('legend_closed', 'true');
            } catch (e) {
                console.warn('Could not save legend state:', e);
            }
        }
        
        function openLegend() {
            if (!isMobile()) return; // Only on mobile
            const { legend, toggleBtn } = getElements();
            if (!legend) return;
            
            legend.classList.remove('legend-closed');
            legend.style.display = 'flex';
            if (toggleBtn) {
                toggleBtn.style.display = 'none';
            }
            // Store state
            try {
                localStorage.setItem('legend_closed', 'false');
            } catch (e) {
                console.warn('Could not save legend state:', e);
            }
        }
        
        function updateLegendVisibility() {
            const { legend, toggleBtn } = getElements();
            if (!legend) return;
            
            if (!isMobile()) {
                if (legend.style.display === 'flex' || legend.style.display === 'block') {
                    if (toggleBtn) toggleBtn.style.display = 'none';
                }
                return;
            }
            
            try {
                const wasClosed = localStorage.getItem('legend_closed') === 'true';
                if (wasClosed && legend.style.display !== 'none') {
                    if (legend.style.display === 'flex' || legend.style.display === 'block') {
                        closeLegend();
                    }
                } else if (!wasClosed && legend.style.display === 'flex') {
                    if (toggleBtn) toggleBtn.style.display = 'none';
                }
            } catch (e) {
                console.warn('Could not read legend state:', e);
            }
        }
        
        function setupEventListeners() {
            const { closeBtn, toggleBtn } = getElements();
            
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeLegend();
                });
            }
            
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openLegend();
                });
            }
        }
        
        function init() {
            setupEventListeners();
            
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    updateLegendVisibility();
                }, 250);
            });
            
            setTimeout(updateLegendVisibility, 500);
            
            const { legend } = getElements();
            if (legend) {
                const observer = new MutationObserver(() => {
                    updateLegendVisibility();
                });
                observer.observe(legend, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            setTimeout(init, 100);
        }
    })();
    
    return map;
}

