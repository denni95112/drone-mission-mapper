/**
 * Drone Tracker for Map
 * Fetches drone data from API and displays on map
 */
class DroneTracker {
    constructor(map, apiUrl) {
        this.map = map;
        this.apiUrl = apiUrl;
        this.markers = {};
        this.updateInterval = null;
        this.updateIntervalMs = 5000; // Update every 5 seconds (when no mission)
        this.missionUpdateIntervalMs = 30000; // Update every 30 seconds (when mission active)
        this.currentMissionId = null;
        this.currentDrones = []; // Store latest drone data
        this.subscribers = []; // List of callbacks to notify when data updates
    }
    
    /**
     * Subscribe to drone data updates
     * @param {Function} callback - Function to call with (drones) when data updates
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        // Immediately call with current data if available
        if (this.currentDrones.length > 0) {
            callback(this.currentDrones);
        }
    }
    
    /**
     * Unsubscribe from drone data updates
     * @param {Function} callback - The callback to remove
     */
    unsubscribe(callback) {
        this.subscribers = this.subscribers.filter(cb => cb !== callback);
    }
    
    /**
     * Cleanup method to prevent memory leaks
     */
    destroy() {
        this.stop();
        this.subscribers = [];
    }
    
    /**
     * Notify all subscribers of new drone data
     */
    notifySubscribers(drones) {
        this.subscribers.forEach(callback => {
            try {
                callback(drones);
            } catch (error) {
                console.error('Error in drone data subscriber:', error);
            }
        });
    }

    /**
     * Start tracking drones
     */
    start(missionId = null) {
        this.isStopped = false; // Reset stopped flag
        this.currentMissionId = missionId;
        const interval = missionId ? this.missionUpdateIntervalMs : this.updateIntervalMs;
        
        this.fetchAndUpdate();
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateInterval = setInterval(() => {
            if (!this.isStopped) {
                this.fetchAndUpdate();
            }
        }, interval);
    }
    
    /**
     * Set mission ID for tracking
     */
    setMissionId(missionId) {
        this.currentMissionId = missionId;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        const interval = missionId ? this.missionUpdateIntervalMs : this.updateIntervalMs;
        this.updateInterval = setInterval(() => {
            this.fetchAndUpdate();
        }, interval);
    }

    /**
     * Stop tracking drones
     */
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        // Clear all markers
        Object.values(this.markers).forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = {};
        // Set a flag to prevent any pending fetchAndUpdate calls
        this.isStopped = true;
    }

    /**
     * Fetch drone data from API and update map
     */
    async fetchAndUpdate() {
        // Don't fetch if stopped
        if (this.isStopped) {
            return;
        }
        
        // Don't fetch if API is disabled
        if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi === false) {
            return;
        }
        
        try {
            let url = this.apiUrl;
            if (this.currentMissionId) {
                url += '?mission_id=' + encodeURIComponent(this.currentMissionId);
            }
            
            const response = await safeFetch(url);
            const data = await response.json();
            
            // Check again if stopped (in case stop was called during fetch)
            if (this.isStopped) {
                return;
            }
            
            // Don't process if API is disabled
            if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi === false) {
                return;
            }
            
            if (data.success && data.drones) {
                // Store latest drone data
                this.currentDrones = data.drones;
                // Update markers on map
                this.updateMarkers(data.drones);
                // Notify all subscribers
                this.notifySubscribers(data.drones);
            }
        } catch (error) {
            console.error('Error fetching drone data:', error);
        }
    }

    /**
     * Update markers on map based on drone data
     */
    updateMarkers(drones) {
        // Don't show DroneTracker markers - only timeline should show drones
        // Hide all markers but keep them in memory for data purposes
        Object.values(this.markers).forEach(marker => {
            if (this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
        
        // Don't create/update markers - timeline will handle visualization
        return;
        
        // Remove old markers that are no longer in the data
        Object.keys(this.markers).forEach(droneId => {
            if (!drones.find(d => d.id == droneId)) {
                this.map.removeLayer(this.markers[droneId]);
                delete this.markers[droneId];
            }
        });

        // Update or create markers for each drone
        drones.forEach(drone => {
            const droneId = drone.id;
            const lat = drone.lat;
            const lng = drone.long;
            
            // Create popup content
            const popupContent = `
                <div style="min-width: 150px;">
                    <strong>${this.escapeHtml(drone.name)}</strong><br>
                    Höhe: ${drone.height}m<br>
                    Batterie: ${drone.battery}%<br>
                    <small>ID: ${drone.id}</small>
                </div>
            `;

            // Get battery color (green > 50%, yellow 30-50%, red < 30%)
            let batteryColor = '#10b981'; // green
            if (drone.battery < 30) {
                batteryColor = '#ef4444'; // red
            } else if (drone.battery < 50) {
                batteryColor = '#f59e0b'; // yellow
            }

            // Create custom icon with drone emoji and battery indicator
            const customIcon = L.divIcon({
                className: 'drone-marker',
                html: `
                    <div style="
                        position: relative;
                        width: 40px;
                        height: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                    ">
                        <div style="
                            font-size: 32px;
                            line-height: 1;
                            transform: rotate(-45deg);
                        ">🚁</div>
                        <div style="
                            position: absolute;
                            bottom: -2px;
                            right: -2px;
                            width: 12px;
                            height: 12px;
                            background-color: ${batteryColor};
                            border: 2px solid white;
                            border-radius: 50%;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                        " title="Batterie: ${drone.battery}%"></div>
                        <div style="
                            position: absolute;
                            top: -8px;
                            left: 50%;
                            transform: translateX(-50%);
                            background-color: rgba(0, 0, 0, 0.7);
                            color: white;
                            padding: 2px 6px;
                            border-radius: 10px;
                            font-size: 10px;
                            font-weight: bold;
                            white-space: nowrap;
                            line-height: 1;
                        ">${drone.id}</div>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            if (this.markers[droneId]) {
                // Update existing marker
                this.markers[droneId].setLatLng([lat, lng]);
                this.markers[droneId].setIcon(customIcon);
                this.markers[droneId].setPopupContent(popupContent);
            } else {
                // Create new marker
                const marker = L.marker([lat, lng], { icon: customIcon })
                    .addTo(this.map)
                    .bindPopup(popupContent);
                this.markers[droneId] = marker;
            }
        });
    }

    /**
     * Escape HTML to prevent XSS
     * @deprecated Use global escapeHtml() function from map-utils.js
     */
    escapeHtml(text) {
        return window.escapeHtml(text);
    }
}

