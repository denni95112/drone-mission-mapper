/**
 * Zeitstrahl Manager
 * Manages the horizontal timeline for viewing mission progression over time
 */
class ZeitstrahlManager {
    constructor(map, droneTracker) {
        this.map = map;
        this.droneTracker = droneTracker;
        this.currentMissionId = null;
        this.currentMission = null;
        this.timePositions = [];
        this.currentTimeIndex = 0;
        this.isPlaying = false;
        this.playSpeed = 1; // 1x, 2x, 4x
        this.playInterval = null;
        this.historicalMarkers = {};
        this.historicalIconMarkers = []; // Track icon markers for timeline display
        this.isLiveMode = false;
        this.liveUpdateCallback = null; // Callback for DroneTracker subscription
        this.liveTimeInterval = null; // Interval for updating live time
        this.startTime = null; // Mission start time
        this.allIconPositions = []; // Store all icon positions for history mode
        this.init();
    }
    
    init() {
        const closeBtn = document.getElementById('close-zeitstrahl-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        const openBtn = document.getElementById('zeitstrahl-open-btn');
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.show();
            });
        }
        
        const liveBtn = document.getElementById('zeitstrahl-live');
        if (liveBtn) {
            liveBtn.addEventListener('click', () => this.toggleLiveMode());
        }
        
        const playPauseBtn = document.getElementById('zeitstrahl-play-pause');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        const slider = document.getElementById('zeitstrahl-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                if (!this.isLiveMode) {
                    this.seekToTime(parseInt(e.target.value));
                }
            });
        }
        
        const speedBtn = document.getElementById('zeitstrahl-speed');
        if (speedBtn) {
            speedBtn.addEventListener('click', () => this.changeSpeed());
        }
    }
    
    async loadMission(missionId, missionData) {
        this.currentMissionId = missionId;
        this.currentMission = missionData;
        
        // Determine start time: use mission created_at or first position time
        // SQLite CURRENT_TIMESTAMP returns UTC, so we need to parse it correctly
        if (missionData && missionData.created_at) {
            this.startTime = this.parseSQLiteDate(missionData.created_at);
        } else {
            this.startTime = null; // Will be set from first position if available
        }
        
        // Load all time positions for this mission
        try {
            // Add cache busting parameter to ensure fresh data
            const cacheBuster = Date.now();
            const response = await fetch(`api/mission.php?mission_id=${encodeURIComponent(missionId)}&get_positions=1&_t=${cacheBuster}`);
            const data = await response.json();
            
            if (data.success && data.positions && data.positions.length > 0) {
                // Store all icon positions separately for history mode
                this.allIconPositions = data.positions.filter(pos => pos.type === 'icon');
                
                console.log('[Zeitstrahl] Loaded positions:', {
                    total: data.positions.length,
                    icons: this.allIconPositions.length,
                    drones: data.positions.filter(pos => pos.type === 'drone').length
                });
                
                // Group positions by time
                this.timePositions = this.groupPositionsByTime(data.positions);
                
                console.log('[Zeitstrahl] Grouped into time slots:', this.timePositions.length);
                
                // Set start time from first position if not already set
                if (!this.startTime && this.timePositions.length > 0) {
                    this.startTime = this.parseSQLiteDate(this.timePositions[0].time);
                }
                
                if (this.timePositions.length > 0) {
                    // If mission is active and timeline is already in live mode, keep it in live mode
                    // Otherwise, show historical timeline
                    if (missionData && missionData.status === 'active' && this.isLiveMode) {
                        // Keep live mode, but update slider for historical data
                        this.updateSlider();
                        this.updateTimeDisplay();
                    } else {
                        // Show timeline in history mode for any mission with positions (active or pending)
                        // Make sure timeline is visible
                        this.show();
                        this.updateSlider();
                        // If timeline was hidden, seek to first position to display it
                        if (this.timePositions.length > 0) {
                            this.seekToTime(0);
                        }
                        // Force update time display
                        this.updateTimeDisplay();
                    }
                } else {
                    console.log('No time positions found for mission');
                    // If mission is active, ensure timeline is shown in live mode
                    if (missionData && missionData.status === 'active') {
                        if (!this.isLiveMode) {
                            this.showInLiveMode();
                        }
                    } else {
                        // For pending missions without positions, show timeline button but keep timeline hidden
                        // User can open it manually, and it will show empty state
                        this.timePositions = [];
                        const openBtn = document.getElementById('zeitstrahl-open-btn');
                        if (openBtn && this.currentMissionId) {
                            openBtn.style.display = 'flex';
                        }
                        const zeitstrahl = document.getElementById('zeitstrahl');
                        if (zeitstrahl) {
                            zeitstrahl.style.display = 'none';
                        }
                    }
                }
            } else {
                console.log('No positions data available for mission');
                // If mission is active, ensure timeline is shown in live mode
                if (missionData && missionData.status === 'active') {
                    if (!this.isLiveMode) {
                        this.showInLiveMode();
                    }
                } else {
                    // No positions, but keep button visible so user can open timeline
                    // Timeline will show empty state
                    this.timePositions = [];
                    const openBtn = document.getElementById('zeitstrahl-open-btn');
                    if (openBtn && this.currentMissionId) {
                        openBtn.style.display = 'flex';
                    }
                    // Hide timeline but keep it openable
                    const zeitstrahl = document.getElementById('zeitstrahl');
                    if (zeitstrahl) {
                        zeitstrahl.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error loading mission positions:', error);
            // If mission is active, ensure timeline is shown in live mode even if loading failed
            if (missionData && missionData.status === 'active') {
                if (!this.isLiveMode) {
                    this.showInLiveMode();
                }
            } else {
                this.hide();
            }
        }
    }
    
    /**
     * Show timeline in live mode (for active missions without historical data)
     */
    showInLiveMode() {
        const zeitstrahl = document.getElementById('zeitstrahl');
        const openBtn = document.getElementById('zeitstrahl-open-btn');
        const missionName = document.getElementById('zeitstrahl-mission-name');
        
        if (!zeitstrahl || !this.currentMissionId) {
            return;
        }
        
        // Don't show timeline if flight path is enabled
        if (window.missionManager && window.missionManager.showMovement) {
            return;
        }
        
        // Hide history info banner when entering live mode
        this.hideHistoryInfo();
        
        // Set mission name
        if (this.currentMission && missionName) {
            missionName.textContent = this.currentMission.mission_id;
        }
        
        // Set start time if not already set (use current time for new active missions)
        if (!this.startTime && this.currentMission && this.currentMission.created_at) {
            this.startTime = this.parseSQLiteDate(this.currentMission.created_at);
        } else if (!this.startTime) {
            // If no created_at, use current time as start
            this.startTime = new Date();
        }
        
        // Show timeline
        zeitstrahl.style.display = 'flex';
        if (openBtn) openBtn.style.display = 'none';
        
        // Update time display
        this.updateTimeDisplay();
        
        // Enable live mode if not already enabled
        if (!this.isLiveMode) {
            this.toggleLiveMode();
        }
    }
    
    /**
     * Parse SQLite date string (UTC) to JavaScript Date object
     * SQLite stores dates as UTC but without timezone indicator
     */
    parseSQLiteDate(dateStr) {
        if (!dateStr) return null;
        // If the string already has timezone info, use it as-is
        if (dateStr.includes('T') && (dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-'))) {
            return new Date(dateStr);
        }
        // SQLite format (YYYY-MM-DD HH:MM:SS) - SQLite stores UTC, so append 'Z'
        return new Date(dateStr.replace(' ', 'T') + 'Z');
    }
    
    groupPositionsByTime(positions) {
        // Group positions by recorded_at timestamp
        const timeMap = new Map();
        
        positions.forEach(pos => {
            const timeKey = pos.recorded_at;
            if (!timeMap.has(timeKey)) {
                timeMap.set(timeKey, []);
            }
            timeMap.get(timeKey).push(pos);
        });
        
        // Convert to sorted array
        const grouped = Array.from(timeMap.entries())
            .sort((a, b) => {
                const dateA = this.parseSQLiteDate(a[0]);
                const dateB = this.parseSQLiteDate(b[0]);
                if (!dateA || !dateB) {
                    console.warn('[Zeitstrahl] Invalid date in groupPositionsByTime:', { a: a[0], b: b[0] });
                    return 0;
                }
                return dateA - dateB;
            })
            .map(([time, positions]) => ({ time, positions }));
        
        console.log('[Zeitstrahl] Grouped positions:', {
            totalPositions: positions.length,
            uniqueTimeSlots: grouped.length,
            timeSlots: grouped.map(g => ({ time: g.time, count: g.positions.length }))
        });
        
        return grouped;
    }
    
    show() {
        // Don't show timeline if flight path is enabled
        if (window.missionManager && window.missionManager.showMovement) {
            return;
        }
        
        // Check if we have a mission
        if (!this.currentMissionId) {
            this.hide();
            return;
        }
        
        // If mission is active and we have no positions yet, show in live mode
        if (this.currentMission && this.currentMission.status === 'active' && 
            (!this.timePositions || this.timePositions.length === 0)) {
            this.showInLiveMode();
            return;
        }
        
        const zeitstrahl = document.getElementById('zeitstrahl');
        const openBtn = document.getElementById('zeitstrahl-open-btn');
        const missionName = document.getElementById('zeitstrahl-mission-name');
        
        // Show timeline if we have a mission loaded (even without positions)
        if (zeitstrahl && this.currentMissionId) {
            if (this.currentMission && missionName) {
                missionName.textContent = this.currentMission.mission_id;
            }
            zeitstrahl.style.display = 'flex';
            if (openBtn) openBtn.style.display = 'none';
            
            // Only update slider and seek if we have positions
            if (this.timePositions && this.timePositions.length > 0) {
                // Show/hide history info banner based on mode
                if (!this.isLiveMode) {
                    this.showHistoryInfo();
                    this.hideRegularIcons();
                } else {
                    this.hideHistoryInfo();
                }
                
                // Make sure we're at the right position
                this.updateSlider();
                this.seekToTime(this.currentTimeIndex);
                
                // Update time display
                if (this.currentTimeIndex < this.timePositions.length) {
                    const timeData = this.timePositions[this.currentTimeIndex];
                    this.updateTimeDisplay(this.parseSQLiteDate(timeData.time));
                }
            } else {
                // No positions - show empty state
                this.updateTimeDisplay(null);
                this.clearMarkers();
                // Disable slider if no positions
                const slider = document.getElementById('zeitstrahl-slider');
                if (slider) {
                    slider.disabled = true;
                    slider.max = 0;
                    slider.value = 0;
                }
                // If in history mode but no positions, switch to live mode or restore done fields
                if (!this.isLiveMode) {
                    this.restoreAllDoneFields();
                    console.log('[Zeitstrahl] No positions available - cannot use history mode, restoring current state');
                }
            }
        }
    }
    
    hide() {
        const zeitstrahl = document.getElementById('zeitstrahl');
        const openBtn = document.getElementById('zeitstrahl-open-btn');
        
        if (zeitstrahl) {
            zeitstrahl.style.display = 'none';
        }
        if (openBtn && this.currentMissionId) {
            // Only show open button if there's a mission loaded
            openBtn.style.display = 'flex';
        }
        this.stop();
        this.clearMarkers();
        
        // Clear icon positions cache
        this.allIconPositions = [];
        
        // Hide history info banner when timeline is hidden
        this.hideHistoryInfo();
        
        // Show regular icons again when timeline is hidden
        this.showRegularIcons();
    }
    
    updateSlider() {
        const slider = document.getElementById('zeitstrahl-slider');
        if (slider) {
            if (this.timePositions && this.timePositions.length > 0) {
                const maxIndex = this.timePositions.length - 1;
                
                // Force update both max attribute and property
                slider.setAttribute('max', maxIndex);
                slider.max = maxIndex;
                
                // Ensure current index is within bounds
                if (this.currentTimeIndex > maxIndex) {
                    this.currentTimeIndex = maxIndex;
                }
                if (this.currentTimeIndex < 0) {
                    this.currentTimeIndex = 0;
                }
                
                slider.value = this.currentTimeIndex;
                slider.disabled = false;
                
                console.log('[Zeitstrahl] Slider updated:', {
                    max: maxIndex,
                    maxAttribute: slider.getAttribute('max'),
                    current: this.currentTimeIndex,
                    totalTimeSlots: this.timePositions.length,
                    sliderValue: slider.value
                });
            } else {
                slider.max = 0;
                slider.setAttribute('max', '0');
                slider.value = 0;
                slider.disabled = true;
            }
        }
    }
    
    seekToTime(index) {
        if (this.isLiveMode) return; // Don't seek in live mode
        
        if (!this.timePositions || this.timePositions.length === 0) {
            console.warn('[Zeitstrahl] seekToTime: No time positions available');
            return;
        }
        
        // Clamp index to valid range
        const maxIndex = this.timePositions.length - 1;
        if (index < 0) {
            console.warn('[Zeitstrahl] seekToTime: Index too low, clamping to 0');
            index = 0;
        }
        if (index > maxIndex) {
            console.warn(`[Zeitstrahl] seekToTime: Index ${index} exceeds max ${maxIndex}, clamping`);
            index = maxIndex;
        }
        
        this.currentTimeIndex = index;
        const timeData = this.timePositions[index];
        
        if (!timeData) {
            console.error(`[Zeitstrahl] seekToTime: No time data at index ${index}`);
            return;
        }
        
        console.log(`[Zeitstrahl] Seeking to time slot ${index}/${maxIndex}:`, timeData.time, `(${timeData.positions.length} positions)`);
        
        // Update time display (shown time on right)
        this.updateTimeDisplay(this.parseSQLiteDate(timeData.time));
        
        // Update slider
        const slider = document.getElementById('zeitstrahl-slider');
        if (slider) {
            slider.value = index;
            // Ensure slider max is correct
            if (parseInt(slider.max) !== maxIndex) {
                slider.max = maxIndex;
                console.log(`[Zeitstrahl] Updated slider max to ${maxIndex}`);
            }
        }
        
        // Hide regular icons when in history mode
        if (!this.isLiveMode) {
            this.hideRegularIcons();
        }
        
        // Update map with positions at this time (includes both drones and icons)
        this.updateMapForTime(timeData);
    }
    
    updateMapForTime(timeData) {
        // Clear existing historical markers
        this.clearMarkers();
        
        // Also clear any icon markers from timeline display
        if (this.historicalIconMarkers) {
            this.historicalIconMarkers.forEach(marker => {
                if (this.map.hasLayer(marker)) {
                    this.map.removeLayer(marker);
                }
            });
            this.historicalIconMarkers = [];
        }
        
        // Separate drone and icon positions
        const dronePositions = timeData.positions.filter(pos => pos.type === 'drone');
        const selectedTime = this.parseSQLiteDate(timeData.time);
        
        // Add markers for each drone at this time (only if API is enabled)
        if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi !== false) {
            dronePositions.forEach(pos => {
                const marker = L.marker([pos.latitude, pos.longitude], {
                    icon: L.divIcon({
                        className: 'drone-marker-historical',
                        html: `<div style="
                            background: #667eea;
                            width: 20px;
                            height: 20px;
                            border-radius: 50%;
                            border: 3px solid white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        "></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(this.map);
                
                marker.bindPopup(`
                    <strong>${pos.drone_name}</strong><br>
                    Höhe: ${pos.height}m<br>
                    Batterie: ${pos.battery}%<br>
                    Zeit: ${this.parseSQLiteDate(pos.recorded_at).toLocaleString('de-DE')}
                `);
                
                if (!this.historicalMarkers[timeData.time]) {
                    this.historicalMarkers[timeData.time] = [];
                }
                this.historicalMarkers[timeData.time].push(marker);
                
                // Log drone placement (historical)
                if (window.missionManager && window.missionManager.currentMissionId) {
                    window.missionManager.logDronePlacement('updateMapForTime', {
                        drone_id: pos.drone_id,
                        drone_name: pos.drone_name || 'N/A',
                        latitude: pos.latitude,
                        longitude: pos.longitude,
                        height: pos.height || 0,
                        battery: pos.battery || 0
                    });
                }
            });
        }
        
        // For icons, show all icons that exist at this time (placed before or at this time)
        // Use the latest position of each icon up to the selected time
        if (this.allIconPositions.length > 0 && window.missionManager && selectedTime) {
            this.historicalIconMarkers = [];
            
            // Group icon positions by icon_id
            const iconPositionsByIcon = {};
            this.allIconPositions.forEach(pos => {
                const iconId = pos.icon_id.toString();
                if (!iconPositionsByIcon[iconId]) {
                    iconPositionsByIcon[iconId] = [];
                }
                iconPositionsByIcon[iconId].push(pos);
            });
            
            // For each icon, find its latest position up to the selected time
            Object.keys(iconPositionsByIcon).forEach(iconId => {
                const positions = iconPositionsByIcon[iconId];
                
                // Filter positions that are at or before the selected time
                const validPositions = positions.filter(pos => {
                    const posTime = this.parseSQLiteDate(pos.recorded_at);
                    return posTime && posTime <= selectedTime;
                });
                
                // If there are valid positions, use the latest one
                if (validPositions.length > 0) {
                    // Sort by time descending to get the latest position
                    validPositions.sort((a, b) => {
                        const timeA = this.parseSQLiteDate(a.recorded_at);
                        const timeB = this.parseSQLiteDate(b.recorded_at);
                        return timeB - timeA; // Descending
                    });
                    
                    const latestPos = validPositions[0];
                    
                    const iconEmoji = window.getIconEmoji ? window.getIconEmoji(latestPos.icon_type) : '📍';
                    const iconHtml = `
                        <div class="icon-container">
                            <div class="icon-display">${iconEmoji}</div>
                            <div class="icon-label" contenteditable="false">${window.escapeHtml ? window.escapeHtml(latestPos.label_text || '') : (latestPos.label_text || '')}</div>
                        </div>
                    `;
                    
                    const marker = L.marker([latestPos.latitude, latestPos.longitude], {
                        icon: L.divIcon({
                            className: `map-icon-marker ${latestPos.icon_type}`,
                            html: iconHtml,
                            iconSize: [40, 60],
                            iconAnchor: [20, 40]
                        }),
                        draggable: false
                    }).addTo(this.map);
                    
                    if (latestPos.label_text) {
                        marker.bindPopup(`
                            <strong>${iconEmoji} ${window.escapeHtml ? window.escapeHtml(latestPos.label_text) : latestPos.label_text}</strong><br>
                            Typ: ${latestPos.icon_type}<br>
                            Zeit: ${this.parseSQLiteDate(latestPos.recorded_at).toLocaleString('de-DE')}
                        `);
                    }
                    
                    this.historicalIconMarkers.push(marker);
                }
            });
        }
        
        // Update done fields visualization based on selected time
        // Only update if we have valid time data
        if (timeData && timeData.time) {
            try {
                this.updateDoneFieldsForTime(timeData.time);
            } catch (error) {
                console.error('[DoneFields Timeline] Error updating done fields for time:', error);
                // Continue even if there's an error - don't block timeline navigation
            }
        }
    }
    
    updateDoneFieldsForTime(selectedTime) {
        // Update grid cells to show done status based on timestamp
        if (!window.missionManager || !window.missionManager.gridCells) {
            console.log('[DoneFields Timeline] Cannot update: missing missionManager or gridCells');
            return;
        }
        
        // If no doneFields, clear all done states
        if (!window.missionManager.doneFields || Object.keys(window.missionManager.doneFields).length === 0) {
            console.log('[DoneFields Timeline] No doneFields, clearing all done states');
            window.missionManager.gridCells.forEach(cell => {
                if (cell.polygon) {
                    cell.polygon.setStyle({
                        fillColor: cell.color,
                        fillOpacity: 0.4
                    });
                }
                if (cell.checkIcon) {
                    const checkDiv = cell.checkIcon.getElement();
                    if (checkDiv) {
                        const innerDiv = checkDiv.querySelector('div');
                        if (innerDiv) {
                            innerDiv.style.display = 'none';
                        }
                    }
                }
            });
            return;
        }
        
        const selectedTimeStr = selectedTime instanceof Date ? 
            selectedTime.toISOString().slice(0, 19).replace('T', ' ') : 
            selectedTime;
        
        // Parse selected time for comparison
        let selectedTimestamp = null;
        if (selectedTimeStr) {
            try {
                // Parse as SQLite datetime format (YYYY-MM-DD HH:mm:ss)
                selectedTimestamp = new Date(selectedTimeStr.replace(' ', 'T') + 'Z').getTime();
            } catch (e) {
                console.warn('[DoneFields Timeline] Could not parse selected time:', selectedTimeStr, e);
                return; // Can't update if we can't parse time
            }
        }
        
        if (selectedTimestamp === null) {
            return; // Can't update without a valid timestamp
        }
        
        let doneCount = 0;
        let notDoneCount = 0;
        
        // Update each grid cell based on done status and timestamp
        window.missionManager.gridCells.forEach(cell => {
            const fieldStatus = window.missionManager.doneFields[cell.number];
            
            // Determine if field should be shown as done at this time
            let isDoneAtTime = false;
            if (fieldStatus) {
                if (typeof fieldStatus === 'object' && fieldStatus.timestamp && fieldStatus.done === true) {
                    // New format with timestamp - check if done before or at selected time
                    try {
                        const doneTimestamp = new Date(fieldStatus.timestamp.replace(' ', 'T') + 'Z').getTime();
                        isDoneAtTime = doneTimestamp <= selectedTimestamp;
                    } catch (e) {
                        // If timestamp parsing fails, treat as always done if done=true
                        console.warn(`[DoneFields Timeline] Error parsing timestamp for field ${cell.number}:`, fieldStatus.timestamp, e);
                        isDoneAtTime = true;
                    }
                } else if (fieldStatus === true || (typeof fieldStatus === 'object' && fieldStatus.done === true && !fieldStatus.timestamp)) {
                    // Old format (boolean) or object without timestamp - show as done (backward compatibility)
                    isDoneAtTime = true;
                }
            }
            
            if (isDoneAtTime) doneCount++;
            else notDoneCount++;
            
            // Update cell styling
            if (cell.polygon) {
                if (isDoneAtTime) {
                    cell.polygon.setStyle({
                        fillColor: '#000000',
                        fillOpacity: 0.5
                    });
                } else {
                    cell.polygon.setStyle({
                        fillColor: cell.color,
                        fillOpacity: 0.4
                    });
                }
            }
            
            // Update check icon visibility
            if (cell.checkIcon) {
                const checkDiv = cell.checkIcon.getElement();
                if (checkDiv) {
                    const innerDiv = checkDiv.querySelector('div');
                    if (innerDiv) {
                        innerDiv.style.display = isDoneAtTime ? 'block' : 'none';
                    }
                }
            }
        });
        
        // Only log summary, not per-field details (to reduce console noise)
        if (doneCount > 0 || notDoneCount > 0) {
            console.log(`[DoneFields Timeline] Time ${selectedTimeStr}: ${doneCount} done, ${notDoneCount} not done`);
        }
    }
    
    clearMarkers() {
        Object.values(this.historicalMarkers).forEach(markers => {
            markers.forEach(marker => this.map.removeLayer(marker));
        });
        this.historicalMarkers = {};
        
        // Clear icon markers
        if (this.historicalIconMarkers) {
            this.historicalIconMarkers.forEach(marker => {
                if (this.map.hasLayer(marker)) {
                    this.map.removeLayer(marker);
                }
            });
            this.historicalIconMarkers = [];
        }
    }
    
    /**
     * Hide regular icons when timeline is in history mode
     */
    hideRegularIcons() {
        if (window.missionManager && window.missionManager.mapIcons) {
            Object.values(window.missionManager.mapIcons).forEach(icon => {
                if (icon && this.map.hasLayer(icon)) {
                    this.map.removeLayer(icon);
                }
            });
        }
    }
    
    /**
     * Show regular icons when timeline exits history mode
     */
    showRegularIcons() {
        if (window.missionManager && window.missionManager.mapIcons) {
            Object.values(window.missionManager.mapIcons).forEach(icon => {
                if (icon && !this.map.hasLayer(icon)) {
                    icon.addTo(this.map);
                }
            });
        }
        
        // Restore all done fields (show all done regardless of timestamp)
        this.restoreAllDoneFields();
    }
    
    /**
     * Restore all done fields regardless of timestamp (for live mode)
     */
    restoreAllDoneFields() {
        if (!window.missionManager || !window.missionManager.gridCells || !window.missionManager.doneFields) {
            return;
        }
        
        window.missionManager.gridCells.forEach(cell => {
            const fieldStatus = window.missionManager.doneFields[cell.number];
            const isDone = (typeof fieldStatus === 'object' && fieldStatus?.done === true) || fieldStatus === true;
            
            if (cell.polygon) {
                if (isDone) {
                    cell.polygon.setStyle({
                        fillColor: '#000000',
                        fillOpacity: 0.5
                    });
                } else {
                    cell.polygon.setStyle({
                        fillColor: cell.color,
                        fillOpacity: 0.4
                    });
                }
            }
            
            if (cell.checkIcon) {
                const checkDiv = cell.checkIcon.getElement();
                if (checkDiv) {
                    const innerDiv = checkDiv.querySelector('div');
                    if (innerDiv) {
                        innerDiv.style.display = isDone ? 'block' : 'none';
                    }
                }
            }
        });
    }
    
    /**
     * Show history info banner when in history mode
     */
    showHistoryInfo() {
        const infoBanner = document.getElementById('timeline-history-info');
        if (infoBanner) {
            infoBanner.style.display = 'block';
        }
    }
    
    /**
     * Hide history info banner when in live mode
     */
    hideHistoryInfo() {
        const infoBanner = document.getElementById('timeline-history-info');
        if (infoBanner) {
            infoBanner.style.display = 'none';
        }
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }
    
    play() {
        if (this.timePositions.length === 0) return;
        
        this.isPlaying = true;
        const playBtn = document.getElementById('zeitstrahl-play-pause');
        if (playBtn) playBtn.textContent = '⏸';
        
        const interval = 1000 / this.playSpeed; // milliseconds between frames
        
        this.playInterval = setInterval(() => {
            if (this.currentTimeIndex < this.timePositions.length - 1) {
                this.seekToTime(this.currentTimeIndex + 1);
            } else {
                this.stop();
            }
        }, interval);
    }
    
    stop() {
        this.isPlaying = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        const playBtn = document.getElementById('zeitstrahl-play-pause');
        if (playBtn) playBtn.textContent = '▶';
    }
    
    changeSpeed() {
        if (this.isLiveMode) return; // Don't change speed in live mode
        
        const speeds = [1, 2, 4];
        const currentIndex = speeds.indexOf(this.playSpeed);
        this.playSpeed = speeds[(currentIndex + 1) % speeds.length];
        
        const speedBtn = document.getElementById('zeitstrahl-speed');
        if (speedBtn) speedBtn.textContent = `${this.playSpeed}x`;
        
        // Restart playback if playing
        if (this.isPlaying) {
            this.stop();
            this.play();
        }
    }
    
    toggleLiveMode() {
        this.isLiveMode = !this.isLiveMode;
        
        const liveBtn = document.getElementById('zeitstrahl-live');
        const playPauseBtn = document.getElementById('zeitstrahl-play-pause');
        const speedBtn = document.getElementById('zeitstrahl-speed');
        const slider = document.getElementById('zeitstrahl-slider');
        const currentTimeEl = document.getElementById('zeitstrahl-current-time');
        
        if (this.isLiveMode) {
            // Enable live mode
            if (liveBtn) {
                liveBtn.classList.add('active');
                liveBtn.textContent = '🟢 Live';
            }
            
            // Hide history info banner in live mode
            this.hideHistoryInfo();
            
            // Show regular icons in live mode
            this.showRegularIcons();
            
            // Disable playback controls
            if (playPauseBtn) playPauseBtn.disabled = true;
            if (speedBtn) speedBtn.disabled = true;
            if (slider) slider.disabled = true;
            
            // Stop any playback
            this.stop();
            
            // Start live updates
            this.startLiveUpdates();
            
            // Update time display will be handled by updateLiveTime()
        } else {
            // Disable live mode (enter history mode)
            if (liveBtn) {
                liveBtn.classList.remove('active');
                liveBtn.textContent = '🔴 Live';
            }
            
            // Show history info banner in history mode
            this.showHistoryInfo();
            
            // Hide regular icons in history mode
            this.hideRegularIcons();
            
            // Enable playback controls only if we have positions
            const hasPositions = this.timePositions && this.timePositions.length > 0;
            if (playPauseBtn) playPauseBtn.disabled = !hasPositions;
            if (speedBtn) speedBtn.disabled = !hasPositions;
            if (slider) {
                if (hasPositions) {
                    slider.disabled = false;
                    this.updateSlider(); // Update slider max value
                    console.log('[Zeitstrahl] History mode: slider enabled, max value:', slider.max, 'current index:', this.currentTimeIndex, 'positions:', this.timePositions.length);
                } else {
                    slider.disabled = true;
                    console.log('[Zeitstrahl] History mode: slider disabled - no positions available');
                }
            }
            
            // Stop live updates
            this.stopLiveUpdates();
            
            // Restore DroneTracker markers visibility
            if (this.droneTracker) {
                // Re-show DroneTracker markers by triggering an update
                if (this.droneTracker.currentDrones && this.droneTracker.currentDrones.length > 0) {
                    this.droneTracker.updateMarkers(this.droneTracker.currentDrones);
                }
            }
            
            // Restore historical view only if we have positions
            if (hasPositions) {
                this.seekToTime(this.currentTimeIndex);
            } else {
                // No positions - show empty state and restore all done fields
                this.updateTimeDisplay(null);
                this.restoreAllDoneFields();
                console.log('[Zeitstrahl] History mode entered but no positions - showing current state');
            }
        }
        
        // Update time display after mode change
        this.updateTimeDisplay();
    }
    
    startLiveUpdates() {
        // Clear existing markers
        this.clearMarkers();
        
        // Start continuous time update
        this.updateLiveTime();
        this.liveTimeInterval = setInterval(() => {
            this.updateLiveTime();
        }, 1000); // Update every second
        
        // Subscribe to DroneTracker updates instead of fetching independently
        if (this.droneTracker && window.APP_CONFIG && window.APP_CONFIG.useUavBosApi !== false) {
            // Ensure DroneTracker is running (if it was stopped, start it)
            if (this.droneTracker.isStopped || !this.droneTracker.updateInterval) {
                console.log('Starting DroneTracker for timeline live mode');
                const missionId = this.currentMissionId || null;
                this.droneTracker.start(missionId);
            }
            
            // Define callback to handle drone data updates
            this.liveUpdateCallback = (drones) => {
                this.updateLiveMarkers(drones);
            };
            
            // Subscribe to DroneTracker
            this.droneTracker.subscribe(this.liveUpdateCallback);
            
            // If DroneTracker already has data, update immediately
            if (this.droneTracker.currentDrones && this.droneTracker.currentDrones.length > 0) {
                this.updateLiveMarkers(this.droneTracker.currentDrones);
            } else {
                // Trigger an immediate fetch if no data is available
                if (!this.droneTracker.isStopped) {
                    this.droneTracker.fetchAndUpdate();
                }
            }
        } else {
            if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi === false) {
                console.log('DroneTracker disabled - API usage is disabled');
            } else {
                console.warn('DroneTracker not available for timeline live mode');
            }
        }
    }
    
    /**
     * Update time display: start time on left, current/shown time on right
     * @param {Date} shownTime - The time to show on the right (current time in live mode, or selected time in history mode)
     */
    updateTimeDisplay(shownTime = null) {
        const startTimeEl = document.getElementById('zeitstrahl-start-time');
        const currentTimeEl = document.getElementById('zeitstrahl-current-time');
        
        // Helper function to format date as yyyy-MM-dd
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        // Update start time (left side) with date
        if (startTimeEl && this.startTime) {
            const dateStr = formatDate(this.startTime);
            const timeStr = this.startTime.toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            startTimeEl.textContent = `${dateStr} ${timeStr}`;
        } else if (startTimeEl) {
            startTimeEl.textContent = '--:--:--';
        }
        
        // Update current/shown time (right side) with date
        if (currentTimeEl) {
            if (shownTime === null && (!this.timePositions || this.timePositions.length === 0) && !this.isLiveMode) {
                // No positions available
                currentTimeEl.textContent = 'Keine Positionsdaten';
            } else if (this.isLiveMode) {
                // In live mode, show current time with date
                const now = new Date();
                const dateStr = formatDate(now);
                const timeStr = now.toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                currentTimeEl.textContent = `${dateStr} ${timeStr}`;
            } else if (shownTime) {
                // In history mode, show the selected time with date
                const dateStr = formatDate(shownTime);
                const timeStr = shownTime.toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                currentTimeEl.textContent = `${dateStr} ${timeStr}`;
            } else {
                currentTimeEl.textContent = '--:--:--';
            }
        }
    }
    
    /**
     * Update the live time display (called every second in live mode)
     */
    updateLiveTime() {
        // Update time display with current time (live mode)
        this.updateTimeDisplay();
    }
    
    stopLiveUpdates() {
        // Stop continuous time update
        if (this.liveTimeInterval) {
            clearInterval(this.liveTimeInterval);
            this.liveTimeInterval = null;
        }
        
        // Unsubscribe from DroneTracker
        if (this.droneTracker && this.liveUpdateCallback) {
            this.droneTracker.unsubscribe(this.liveUpdateCallback);
            this.liveUpdateCallback = null;
        }
        
        // Clear live markers
        if (this.historicalMarkers && this.historicalMarkers['live']) {
            this.historicalMarkers['live'].forEach(marker => {
                this.map.removeLayer(marker);
            });
            this.historicalMarkers['live'] = [];
        }
    }
    
    /**
     * Update live markers from drone data (called by DroneTracker subscription)
     */
    updateLiveMarkers(drones) {
        if (!drones || drones.length === 0) return;
        
        // Don't show drones if API is disabled
        if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi === false) {
            this.clearMarkers();
            return;
        }
        
        // Only show drones if mission is active
        if (!this.currentMission || this.currentMission.status !== 'active') {
            // Clear markers if mission is not active
            this.clearMarkers();
            return;
        }
        
        // Clear existing historical markers
        this.clearMarkers();
        
        // Add markers for each drone with proper drone icon
        drones.forEach(drone => {
            // Get battery color (green > 50%, yellow 30-50%, red < 30%)
            let batteryColor = '#10b981'; // green
            if (drone.battery < 30) {
                batteryColor = '#ef4444'; // red
            } else if (drone.battery < 50) {
                batteryColor = '#f59e0b'; // yellow
            }
            
            // Create popup content
            const popupContent = `
                <div style="min-width: 150px;">
                    <strong>${this.escapeHtml(drone.name)}</strong><br>
                    Höhe: ${drone.height}m<br>
                    Batterie: ${drone.battery}%<br>
                    <small>ID: ${drone.id}</small>
                </div>
            `;
            
            // Use proper drone icon (helicopter emoji) instead of green dot
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
            
            const marker = L.marker([drone.lat, drone.long], {
                icon: customIcon
            }).addTo(this.map);
            
            marker.bindPopup(popupContent);
            
            // Store marker for cleanup
            if (!this.historicalMarkers['live']) {
                this.historicalMarkers['live'] = [];
            }
            this.historicalMarkers['live'].push(marker);
            
            // Log drone placement
            if (window.missionManager && window.missionManager.currentMissionId) {
                window.missionManager.logDronePlacement('updateLiveMarkers', {
                    drone_id: drone.id,
                    drone_name: drone.name || 'N/A',
                    latitude: drone.lat,
                    longitude: drone.long,
                    height: drone.height || 0,
                    battery: drone.battery || 0
                });
            }
        });
        
        // Time display is updated continuously by updateLiveTime() in startLiveUpdates()
        // No need to update it here
        
        // Load all icons (no time filter in live mode)
        if (window.missionManager) {
            window.missionManager.loadIcons(this.currentMissionId);
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     * @deprecated Use global escapeHtml() function from map-utils.js
     */
    escapeHtml(text) {
        return window.escapeHtml(text);
    }
    
    hide() {
        const zeitstrahl = document.getElementById('zeitstrahl');
        const openBtn = document.getElementById('zeitstrahl-open-btn');
        
        if (zeitstrahl) {
            zeitstrahl.style.display = 'none';
        }
        if (openBtn && this.currentMissionId) {
            // Only show open button if there's a mission loaded
            openBtn.style.display = 'flex';
        }
        this.stop();
        this.stopLiveUpdates();
        this.isLiveMode = false;
        this.clearMarkers();
        
        // Reset UI
        const liveBtn = document.getElementById('zeitstrahl-live');
        const playPauseBtn = document.getElementById('zeitstrahl-play-pause');
        const speedBtn = document.getElementById('zeitstrahl-speed');
        const slider = document.getElementById('zeitstrahl-slider');
        
        if (liveBtn) {
            liveBtn.classList.remove('active');
            liveBtn.textContent = '🔴 Live';
        }
        if (playPauseBtn) playPauseBtn.disabled = false;
        if (speedBtn) speedBtn.disabled = false;
        if (slider) slider.disabled = false;
    }
}

