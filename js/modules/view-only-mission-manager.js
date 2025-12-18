/**
 * View Only Mission Manager
 * Manages mission display in view-only mode (read-only)
 */
class ViewOnlyMissionManager {
    constructor(map, missionData, missionId) {
        this.map = map;
        this.missionData = missionData;
        this.missionId = missionId;
        this.showMovement = false;
        this.movementLayers = {}; // Store movement path layers per icon
        this.selectedIconId = 'all'; // Selected icon ID or 'all'
        this.gridCells = [];
        this.legendData = {};
        this.doneFields = {}; // Store done status for fields (read-only in view mode)
        this.mapIcons = {};
        this.gridLayer = null;
        this.timeoutIds = []; // Store timeout IDs for cleanup
        this.intervalIds = []; // Store interval IDs for cleanup
        this.init();
    }
    
    init() {
        console.log('ViewOnlyMissionManager init called');
        console.log('Map ready:', this.map);
        console.log('Mission data:', this.missionData);
        
        // Load legend data from localStorage first
        this.loadLegendData();
        
        // Load done fields from mission data
        if (this.missionData && this.missionData.done_fields_parsed) {
            this.doneFields = this.missionData.done_fields_parsed || {};
        }
        
        // Load mission data immediately (map should be ready from whenReady)
        this.loadMissionData();
        
        // Load icons
        this.loadIcons();
        
        // Load drones (only if API is enabled)
        if (!window.APP_CONFIG || window.APP_CONFIG.useUavBosApi !== false) {
            this.loadDrones();
        }
        
        // Movement toggle
        const movementToggle = document.getElementById('show-movement-toggle');
        if (movementToggle) {
            movementToggle.addEventListener('change', (e) => {
                this.toggleMovement(e.target.checked);
            });
        }
        
        // Icon movement select
        const iconMovementSelect = document.getElementById('icon-movement-select');
        if (iconMovementSelect) {
            iconMovementSelect.addEventListener('change', (e) => {
                this.selectedIconId = e.target.value;
                if (this.showMovement && this.missionId) {
                    this.loadIconMovements(this.missionId);
                }
            });
        }
        
        // GPS sharing
        this.initGPSSharing();
        
        // Periodically refresh icons to show new GPS positions from others
        this.startIconRefresh();
    }
    
    initGPSSharing() {
        this.gpsInterval = null;
        this.gpsIconId = null;
        
        const sendOnceBtn = document.getElementById('send-gps-once-btn');
        const sendContinuousBtn = document.getElementById('send-gps-continuous-btn');
        
        if (sendOnceBtn) {
            sendOnceBtn.addEventListener('click', () => {
                this.sendGPSPosition(false);
            });
        }
        
        if (sendContinuousBtn) {
            sendContinuousBtn.addEventListener('click', () => {
                if (this.gpsInterval) {
                    this.stopGPSSharing();
                } else {
                    this.startGPSSharing();
                }
            });
        }
    }
    
    async sendGPSPosition(updateExisting = false) {
        const nameInput = document.getElementById('gps-name');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) {
            alert('Bitte geben Sie einen Namen ein.');
            return;
        }
        
        const iconTypeInput = document.querySelector('input[name="gps-icon-type"]:checked');
        const iconType = iconTypeInput ? iconTypeInput.value : 'vehicle';
        
        try {
            // Get current position
            const position = await this.getCurrentPosition();
            
            // Get token if available
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            
            const formData = new FormData();
            if (updateExisting && this.gpsIconId) {
                formData.append('action', 'update_icon');
                formData.append('icon_id', this.gpsIconId);
                formData.append('latitude', position.coords.latitude);
                formData.append('longitude', position.coords.longitude);
                formData.append('label_text', name);
                if (token) {
                    formData.append('token', token);
                    formData.append('mission_id', this.missionId);
                }
            } else {
                formData.append('action', 'create_icon');
                formData.append('mission_id', this.missionId);
                formData.append('icon_type', iconType);
                formData.append('latitude', position.coords.latitude);
                formData.append('longitude', position.coords.longitude);
                formData.append('label_text', name);
                if (token) {
                    formData.append('token', token);
                }
            }
            
            const response = await safeFetch('api/map_icons.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (!updateExisting && data.icon_id) {
                    this.gpsIconId = data.icon_id;
                }
                
                // Refresh icons to show the new position
                await this.loadIcons();
                
                if (!updateExisting) {
                    console.log('GPS position sent successfully');
                }
            } else {
                alert('Fehler beim Senden der GPS-Position: ' + (data.error || 'Unbekannter Fehler'));
            }
        } catch (error) {
            console.error('Error sending GPS position:', error);
            if (error.code === error.PERMISSION_DENIED) {
                alert('GPS-Zugriff wurde verweigert. Bitte erlauben Sie den Zugriff auf Ihren Standort.');
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                alert('GPS-Position konnte nicht ermittelt werden.');
            } else {
                alert('Fehler beim Abrufen der GPS-Position: ' + error.message);
            }
        }
    }
    
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation wird von diesem Browser nicht unterstützt.'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }
    
    startGPSSharing() {
        if (this.gpsInterval) {
            return; // Already running
        }
        
        // Send immediately
        this.sendGPSPosition(false);
        
        // Then send every 30 seconds
        this.gpsInterval = setInterval(() => {
            this.sendGPSPosition(true);
        }, 30000);
        this.intervalIds.push(this.gpsInterval);
        
        const sendContinuousBtn = document.getElementById('send-gps-continuous-btn');
        const gpsContinuousText = document.getElementById('gps-continuous-text');
        if (sendContinuousBtn) {
            sendContinuousBtn.style.backgroundColor = '#ef4444';
            if (gpsContinuousText) {
                gpsContinuousText.textContent = '⏹️ GPS senden stoppen';
            }
        }
    }
    
    stopGPSSharing() {
        if (this.gpsInterval) {
            clearInterval(this.gpsInterval);
            this.gpsInterval = null;
        }
        
        const sendContinuousBtn = document.getElementById('send-gps-continuous-btn');
        const gpsContinuousText = document.getElementById('gps-continuous-text');
        if (sendContinuousBtn) {
            sendContinuousBtn.style.backgroundColor = '#10b981';
            if (gpsContinuousText) {
                gpsContinuousText.textContent = '🔄 GPS alle 30 Sek. senden';
            }
        }
    }
    
    startIconRefresh() {
        // Refresh icons every 10 seconds to show new GPS positions from others
        const intervalId = setInterval(async () => {
            await this.loadIcons();
        }, 10000);
        this.intervalIds.push(intervalId);
    }
    
    loadMissionData() {
        console.log('=== loadMissionData START ===');
        console.log('Loading mission data:', this.missionData);
        console.log('Mission data keys:', Object.keys(this.missionData));
        console.log('Mission data type:', typeof this.missionData);
        
        // Check if we have bounds data - handle null, empty string, or 0
        const boundsNeLat = this.missionData.bounds_ne_lat;
        const boundsSwLat = this.missionData.bounds_sw_lat;
        const boundsNeLng = this.missionData.bounds_ne_lng;
        const boundsSwLng = this.missionData.bounds_sw_lng;
        
        console.log('Bounds check:', {
            bounds_ne_lat: boundsNeLat,
            bounds_ne_lng: boundsNeLng,
            bounds_sw_lat: boundsSwLat,
            bounds_sw_lng: boundsSwLng
        });
        
        const hasBounds = boundsNeLat && 
                         boundsSwLat && 
                         boundsNeLat !== '' && 
                         boundsSwLat !== '' &&
                         boundsNeLat !== null &&
                         boundsSwLat !== null &&
                         !isNaN(parseFloat(boundsNeLat)) &&
                         !isNaN(parseFloat(boundsSwLat)) &&
                         parseFloat(boundsNeLat) !== 0 &&
                         parseFloat(boundsSwLat) !== 0;
                         
        console.log('Has bounds:', hasBounds);
        
        if (!hasBounds) {
            console.warn('Mission data missing bounds, using center point', {
                bounds_ne_lat: this.missionData.bounds_ne_lat,
                bounds_ne_lng: this.missionData.bounds_ne_lng,
                bounds_sw_lat: this.missionData.bounds_sw_lat,
                bounds_sw_lng: this.missionData.bounds_sw_lng,
                center_lat: this.missionData.center_lat,
                center_lng: this.missionData.center_lng
            });
            
            // If we have center but no bounds, create a small bounds around center
            if (this.missionData.center_lat && this.missionData.center_lng && 
                this.missionData.center_lat !== '' && this.missionData.center_lng !== '') {
                const center = L.latLng(
                    parseFloat(this.missionData.center_lat), 
                    parseFloat(this.missionData.center_lng)
                );
                const offset = 0.01; // ~1km
                const bounds = L.latLngBounds(
                    [center.lat - offset, center.lng - offset],
                    [center.lat + offset, center.lng + offset]
                );
                this.missionData.bounds_ne_lat = bounds.getNorthEast().lat;
                this.missionData.bounds_ne_lng = bounds.getNorthEast().lng;
                this.missionData.bounds_sw_lat = bounds.getSouthWest().lat;
                this.missionData.bounds_sw_lng = bounds.getSouthWest().lng;
                console.log('Created bounds from center:', bounds);
            } else {
                console.error('Cannot create mission visualization - missing bounds and center');
                console.error('Mission data:', this.missionData);
                // Don't return - try to show what we can
                alert('Mission-Daten unvollständig: Keine Bounds oder Center-Position gefunden. Die Visualisierung wird möglicherweise nicht vollständig angezeigt.');
                // Create default bounds around default location
                const defaultCenter = L.latLng(51.1657, 10.4515);
                const offset = 0.01;
                const defaultBounds = L.latLngBounds(
                    [defaultCenter.lat - offset, defaultCenter.lng - offset],
                    [defaultCenter.lat + offset, defaultCenter.lng + offset]
                );
                this.missionData.bounds_ne_lat = defaultBounds.getNorthEast().lat;
                this.missionData.bounds_ne_lng = defaultBounds.getNorthEast().lng;
                this.missionData.bounds_sw_lat = defaultBounds.getSouthWest().lat;
                this.missionData.bounds_sw_lng = defaultBounds.getSouthWest().lng;
                console.log('Using default bounds:', defaultBounds);
            }
        }
        
        // Check if mission has grid data (raster)
        const hasGrid = this.missionData.grid_length && this.missionData.grid_height && this.missionData.field_size;
        const hasBounds = this.missionData.bounds_ne_lat && this.missionData.bounds_sw_lat;
        
        // If mission doesn't have grid, it's a no-raster mission - just center map and load icons
        if (!hasGrid || !hasBounds) {
            console.log('Mission without raster - skipping grid visualization');
            // Center map on mission center if available
            if (this.missionData.center_lat && this.missionData.center_lng) {
                this.map.setView([this.missionData.center_lat, this.missionData.center_lng], 15);
            }
            // Load icons for this mission
            this.loadIcons();
            return; // Don't try to visualize grid
        }
        
        if (!this.missionData.num_areas || this.missionData.num_areas === '' || this.missionData.num_areas === 0) {
            console.warn('Mission data missing num_areas, defaulting to 10');
            this.missionData.num_areas = 10;
        }
        
        console.log('Proceeding with visualization. num_areas:', this.missionData.num_areas);
        
        // Create bounds - ensure values are numbers
        try {
            const bounds = L.latLngBounds(
                [parseFloat(this.missionData.bounds_sw_lat), parseFloat(this.missionData.bounds_sw_lng)],
                [parseFloat(this.missionData.bounds_ne_lat), parseFloat(this.missionData.bounds_ne_lng)]
            );
            
            console.log('Created bounds:', bounds);
            console.log('Bounds isValid:', bounds.isValid());
            
            if (!bounds.isValid()) {
                console.error('Invalid bounds! Cannot proceed.');
                return;
            }
        
        // Recreate the shape
        const shapeType = this.missionData.shape_type || 'rectangle';
        
        if (shapeType === 'circle') {
            const center = bounds.getCenter();
            const radius = bounds.getNorthEast().distanceTo(center);
            L.circle(center, {
                radius: radius,
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(this.map);
        } else if (shapeType === 'ellipse') {
            // Create ellipse polygon using shared utility function
            const ellipse = window.createEllipseFromBounds(bounds);
            // Update styling to match view mission style
            ellipse.setStyle({
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.2,
                weight: 2
            });
            ellipse.addTo(this.map);
        } else {
            L.rectangle(bounds, {
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(this.map);
        }
        
        // Calculate grid dimensions
        const numAreas = parseInt(this.missionData.num_areas) || 10;
        console.log('Calculating grid for', numAreas, 'areas');
        let gridLength = Math.ceil(Math.sqrt(numAreas));
        let gridHeight = Math.ceil(numAreas / gridLength);
        while (gridLength * gridHeight < numAreas) {
            gridLength++;
            gridHeight = Math.ceil(numAreas / gridLength);
        }
        
        console.log('Grid dimensions:', { gridLength, gridHeight, numAreas });
        
        // Visualize grid
        console.log('Calling visualizeGrid...');
        this.visualizeGrid(bounds, gridLength, gridHeight);
        
        // Fit map to bounds
        this.map.fitBounds(bounds);
        
        console.log('Mission data loaded and grid visualized');
        } catch (error) {
            console.error('ERROR in loadMissionData:', error);
            console.error('Error stack:', error.stack);
            alert('Fehler beim Laden der Mission: ' + error.message);
        }
    }
    
    /**
     * Convert column index to Excel-style letter (0->A, 1->B, 26->AA, etc.)
     */
    getExcelColumnLetter(colIndex) {
        let result = '';
        colIndex += 1; // Convert 0-based to 1-based
        while (colIndex > 0) {
            colIndex--;
            result = String.fromCharCode(65 + (colIndex % 26)) + result;
            colIndex = Math.floor(colIndex / 26);
        }
        return result;
    }
    
    visualizeGrid(bounds, gridLength, gridHeight) {
        console.log('=== visualizeGrid START ===');
        console.log('visualizeGrid called', { bounds, gridLength, gridHeight });
        console.log('Bounds isValid:', bounds.isValid());
        console.log('Map object:', this.map);
        console.log('Map layers count:', this.map._layers ? Object.keys(this.map._layers).length : 'unknown');
        
        // Remove existing grid if any
        if (this.gridLayer) {
            console.log('Removing existing grid layer');
            this.map.removeLayer(this.gridLayer);
        }
        
        // Clear existing cells
        this.gridCells = [];
        console.log('Cleared gridCells array');
        
        // Create a new layer group for grid
        this.gridLayer = L.layerGroup();
        this.gridLayer.addTo(this.map);
        console.log('Created and added gridLayer to map');
        console.log('GridLayer after adding:', this.gridLayer);
        console.log('Map layers after adding grid:', this.map._layers ? Object.keys(this.map._layers).length : 'unknown');
        
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        console.log('Bounds corners:', { ne: { lat: ne.lat, lng: ne.lng }, sw: { lat: sw.lat, lng: sw.lng } });
        
        // Calculate cell dimensions
        const latStep = (ne.lat - sw.lat) / gridHeight;
        const lngStep = (ne.lng - sw.lng) / gridLength;
        
        console.log('Grid steps:', { latStep, lngStep, gridHeight, gridLength });
        
        if (isNaN(latStep) || isNaN(lngStep) || latStep === 0 || lngStep === 0) {
            console.error('Invalid grid steps! Cannot draw grid.');
            return;
        }
        
        // Add column labels on top (A, B, C, ...)
        const labelOffset = 0.0001; // Small offset to place labels outside the grid
        for (let j = 0; j < gridLength; j++) {
            const colLetter = this.getExcelColumnLetter(j);
            const labelLat = ne.lat + labelOffset;
            const labelLng = sw.lng + (j * lngStep) + (lngStep / 2);
            
            const colLabel = L.marker([labelLat, labelLng], {
                icon: L.divIcon({
                    className: 'grid-column-label',
                    html: `<div style="
                        background: rgba(255, 255, 255, 0.9);
                        color: #1e293b;
                        border: 2px solid #667eea;
                        border-radius: 4px;
                        padding: 2px 6px;
                        font-size: 12px;
                        font-weight: bold;
                        text-align: center;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        white-space: nowrap;
                    ">${colLetter}</div>`,
                    iconSize: [30, 20],
                    iconAnchor: [15, 10]
                })
            });
            this.gridLayer.addLayer(colLabel);
        }
        
        // Add row labels on left (1, 2, 3, ...)
        for (let i = 0; i < gridHeight; i++) {
            const rowNumber = i + 1;
            const labelLat = sw.lat + (i * latStep) + (latStep / 2);
            const labelLng = sw.lng - labelOffset;
            
            const rowLabel = L.marker([labelLat, labelLng], {
                icon: L.divIcon({
                    className: 'grid-row-label',
                    html: `<div style="
                        background: rgba(255, 255, 255, 0.9);
                        color: #1e293b;
                        border: 2px solid #667eea;
                        border-radius: 4px;
                        padding: 2px 6px;
                        font-size: 12px;
                        font-weight: bold;
                        text-align: center;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        white-space: nowrap;
                    ">${rowNumber}</div>`,
                    iconSize: [30, 20],
                    iconAnchor: [35, 10]
                })
            });
            this.gridLayer.addLayer(rowLabel);
        }
        
        // Draw grid lines (lighter and less prominent)
        console.log('Drawing grid lines...');
        let linesAdded = 0;
        for (let i = 0; i <= gridHeight; i++) {
            const lat = sw.lat + (i * latStep);
            const line = L.polyline([
                [lat, sw.lng],
                [lat, ne.lng]
            ], {
                color: '#667eea',
                weight: 0.5, // Thinner lines
                opacity: 0.3, // More transparent
                dashArray: '3, 3' // Smaller dashes
            });
            this.gridLayer.addLayer(line);
            linesAdded++;
        }
        console.log('Added', linesAdded, 'horizontal grid lines');
        
        linesAdded = 0;
        for (let j = 0; j <= gridLength; j++) {
            const lng = sw.lng + (j * lngStep);
            const line = L.polyline([
                [sw.lat, lng],
                [ne.lat, lng]
            ], {
                color: '#667eea',
                weight: 0.5, // Thinner lines
                opacity: 0.3, // More transparent
                dashArray: '3, 3' // Smaller dashes
            });
            this.gridLayer.addLayer(line);
            linesAdded++;
        }
        console.log('Added', linesAdded, 'vertical grid lines');
        
        // Create colored cells
        console.log('Creating colored cells...');
        let cellsCreated = 0;
        for (let i = 0; i < gridHeight; i++) {
            for (let j = 0; j < gridLength; j++) {
                const cellTop = sw.lat + (i * latStep);
                const cellBottom = sw.lat + ((i + 1) * latStep);
                const cellLeft = sw.lng + (j * lngStep);
                const cellRight = sw.lng + ((j + 1) * lngStep);
                
                // Generate Excel-style ID (A1, B2, etc.)
                const colLetter = this.getExcelColumnLetter(j);
                const rowNumber = i + 1;
                const cellId = `${colLetter}${rowNumber}`;
                
                // Calculate sequential number for color generation (starting from 1)
                const cellNumber = (i * gridLength) + j + 1;
                
                // Generate unique color for this cell
                const color = this.generateColor(cellNumber - 1);
                
                // Create colored rectangle for the cell
                const cellPolygon = L.rectangle([
                    [cellTop, cellLeft],
                    [cellBottom, cellRight]
                ], {
                    color: '#667eea',
                    fillColor: color,
                    fillOpacity: 0.25, // Reduced from 0.4 to make map more visible
                    weight: 0.5, // Thinner border
                    opacity: 0.4 // Border opacity
                });
                
                // Add cell ID label (hidden by default, shown on hover)
                const cellCenterLat = cellTop + (latStep / 2);
                const cellCenterLng = cellLeft + (lngStep / 2);
                
                // Function to get label content (ID + legend text if available)
                const getLabelContent = () => {
                    const legendText = this.legendData[cellNumber] || '';
                    if (legendText.trim()) {
                        return `${cellId}<br><span style="font-size: 0.9em; font-weight: normal; opacity: 0.9;">${this.escapeHtml(legendText)}</span>`;
                    }
                    return cellId;
                };
                
                const cellLabel = L.marker([cellCenterLat, cellCenterLng], {
                    icon: L.divIcon({
                        className: 'grid-cell-number',
                        html: `<div class="grid-cell-label" style="
                            background: ${color};
                            color: white;
                            border-radius: 4px;
                            padding: 4px 8px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            font-size: 11px;
                            font-weight: bold;
                            border: 2px solid white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            opacity: 0;
                            transition: opacity 0.2s ease;
                            pointer-events: none;
                            text-align: center;
                            line-height: 1.3;
                            max-width: 200px;
                            white-space: normal;
                            word-wrap: break-word;
                        ">${cellId}</div>`,
                        iconSize: [120, 60],
                        iconAnchor: [60, 30]
                    })
                });
                
                // Show label on hover with updated content
                cellPolygon.on('mouseover', () => {
                    const labelDiv = cellLabel.getElement();
                    if (labelDiv) {
                        const innerDiv = labelDiv.querySelector('.grid-cell-label');
                        if (innerDiv) {
                            // Update content to include legend text if available
                            // getLabelContent() already escapes user content via this.escapeHtml()
                            const content = getLabelContent();
                            innerDiv.innerHTML = content;
                            innerDiv.style.opacity = '1';
                        }
                    }
                });
                
                cellPolygon.on('mouseout', () => {
                    const labelDiv = cellLabel.getElement();
                    if (labelDiv) {
                        const innerDiv = labelDiv.querySelector('.grid-cell-label');
                        if (innerDiv) {
                            innerDiv.style.opacity = '0';
                        }
                    }
                });
                
                // Create check icon marker (for done fields - read-only in view mode)
                const checkIcon = L.marker([cellCenterLat, cellCenterLng], {
                    icon: L.divIcon({
                        className: 'grid-cell-check',
                        html: `<div style="
                            font-size: 48px;
                            color: #10b981;
                            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                            pointer-events: none;
                            display: none;
                        ">✓</div>`,
                        iconSize: [48, 48],
                        iconAnchor: [24, 24]
                    })
                });
                
                this.gridLayer.addLayer(cellPolygon);
                this.gridLayer.addLayer(cellLabel);
                this.gridLayer.addLayer(checkIcon);
                
                // Initialize check icon visibility and background color if field is done
                // Note: We need to set display after marker is added to map
                const timeoutId = setTimeout(() => {
                    if (this.doneFields[cellNumber]) {
                        // Update background color to darker for done fields
                        cellPolygon.setStyle({
                            fillColor: '#000000',
                            fillOpacity: 0.35 // Slightly more transparent
                        });
                        
                        // Show check icon
                        const checkDiv = checkIcon.getElement();
                        if (checkDiv) {
                            const innerDiv = checkDiv.querySelector('div');
                            if (innerDiv) {
                                innerDiv.style.display = 'block';
                            }
                        }
                    }
                }, 100);
                this.timeoutIds.push(timeoutId);
                
                // Store cell data (keep both ID and number for compatibility)
                this.gridCells.push({
                    id: cellId,
                    number: cellNumber,
                    color: color,
                    bounds: L.latLngBounds([cellTop, cellLeft], [cellBottom, cellRight]),
                    polygon: cellPolygon,
                    label: cellLabel,
                    checkIcon: checkIcon
                });
            }
        }
        
        console.log('Grid visualization complete. Cells created:', this.gridCells.length);
        console.log('Grid layer has', this.gridLayer.getLayers().length, 'layers');
        
        // Verify grid was created
        if (this.gridCells.length === 0) {
            console.error('ERROR: No grid cells were created!');
            alert('Fehler: Raster konnte nicht erstellt werden. Bitte überprüfen Sie die Missions-Daten.');
        } else {
            console.log('Grid successfully created with', this.gridCells.length, 'cells');
        }
        
        // Update legend immediately after grid is created
        this.updateLegend();
    }
    
    generateColor(index) {
        return window.generateColor(index);
    }
    
    async loadLegendData() {
        // First try to load from database
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            let url = `api/mission.php?mission_id=${encodeURIComponent(this.missionId)}`;
            if (token) {
                url += `&token=${encodeURIComponent(token)}`;
            }
            
            const response = await safeFetch(url);
            const data = await response.json();
            
            if (data.success && data.mission && data.mission.legend_data_parsed) {
                // Load from database
                this.legendData = data.mission.legend_data_parsed;
                console.log('Loaded legend data from database for mission:', this.missionId, this.legendData);
                
                // Also update localStorage with database data
                try {
                    localStorage.setItem(`legend_${this.missionId}`, JSON.stringify(this.legendData));
                } catch (e) {
                    console.warn('Could not update localStorage:', e);
                }
                this.updateLegend();
                return;
            }
        } catch (e) {
            console.warn('Error loading legend data from database:', e);
        }
        
        // Fallback to localStorage
        const saved = localStorage.getItem(`legend_${this.missionId}`);
        if (saved) {
            try {
                this.legendData = JSON.parse(saved);
                console.log('Loaded legend data from localStorage for mission:', this.missionId);
            } catch (e) {
                console.error('Error loading legend data from localStorage:', e);
                this.legendData = {};
            }
        }
        this.updateLegend();
    }
    
    updateLegend() {
        console.log('Updating legend. Grid cells:', this.gridCells.length);
        // Only update map legend (sidebar legend removed)
        this.updateMapLegend();
    }
    
    updateMapLegend() {
        const mapLegendItems = document.getElementById('map-legend-items');
        const mapLegend = document.getElementById('map-legend');
        
        if (!mapLegendItems || !mapLegend) {
            console.warn('Legend elements not found');
            return;
        }

        mapLegendItems.textContent = '';

        // Filter cells to only show those with text
        const cellsWithText = this.gridCells.filter(cell => {
            const text = this.legendData[cell.number];
            return text && text.trim().length > 0;
        });

        console.log('Legend update - cells with text:', cellsWithText.length);
        console.log('Legend data:', this.legendData);
        console.log('Grid cells:', this.gridCells.length);

        if (cellsWithText.length === 0) {
            mapLegend.style.display = 'none';
            console.log('No cells with text, hiding legend');
            return;
        }
        
        // Always populate legend items first, regardless of visibility state
        cellsWithText.forEach(cell => {
            const item = document.createElement('div');
            item.className = 'map-legend-item';
            
            const colorDiv = document.createElement('div');
            colorDiv.className = 'map-legend-color';
            colorDiv.style.backgroundColor = cell.color;
            
            const textDiv = document.createElement('div');
            textDiv.className = 'map-legend-text';
            textDiv.textContent = `${cell.number}: ${this.legendData[cell.number]}`;
            
            item.appendChild(colorDiv);
            item.appendChild(textDiv);
            mapLegendItems.appendChild(item);
        });
        
        console.log('Legend items added:', mapLegendItems.children.length);
        
        // Now control visibility based on mobile state and user preference
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            try {
                const wasClosed = localStorage.getItem('legend_closed') === 'true';
                if (wasClosed) {
                    // Legend was closed by user - hide it but show toggle button
                    mapLegend.style.display = 'none';
                    const toggleBtn = document.getElementById('map-legend-toggle-btn');
                    if (toggleBtn) {
                        toggleBtn.style.display = 'block';
                    }
                    console.log('Legend closed by user on mobile - items populated but hidden');
                    return;
                }
            } catch (e) {
                console.warn('Could not read legend state:', e);
            }
        }
        
        // Show legend (either desktop or mobile with legend open)
        mapLegend.style.setProperty('display', 'flex', 'important');
        const toggleBtn = document.getElementById('map-legend-toggle-btn');
        if (toggleBtn) {
            toggleBtn.style.display = 'none';
        }
        console.log('Showing legend with', cellsWithText.length, 'items');
    }
    
    async loadIcons() {
        try {
            console.log('Loading icons for mission:', this.missionId);
            // Include token in request if we have it (for token-based access)
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            let url = `api/map_icons.php?mission_id=${encodeURIComponent(this.missionId)}`;
            if (token) {
                url += `&token=${encodeURIComponent(token)}`;
            }
            const response = await safeFetch(url);
            const data = await response.json();
            console.log('Icons response:', data);
            
            if (data.success && data.icons && Array.isArray(data.icons)) {
                console.log('Found', data.icons.length, 'icons');
                
                // Remove icons that no longer exist in the database
                const currentIconIds = new Set(data.icons.map(icon => icon.id));
                Object.keys(this.mapIcons).forEach(iconId => {
                    if (!currentIconIds.has(parseInt(iconId))) {
                        this.map.removeLayer(this.mapIcons[iconId]);
                        delete this.mapIcons[iconId];
                    }
                });
                
                if (data.icons.length === 0) {
                    console.log('No icons in database for this mission');
                } else {
                    data.icons.forEach(iconData => {
                        const iconId = iconData.id;
                        
                        // If icon already exists, update its position
                        if (this.mapIcons[iconId]) {
                            const latlng = L.latLng(
                                parseFloat(iconData.latitude), 
                                parseFloat(iconData.longitude)
                            );
                            this.mapIcons[iconId].setLatLng(latlng);
                            
                            // Update label if changed
                            const labelElement = this.mapIcons[iconId].getElement()?.querySelector('.icon-label');
                            if (labelElement && iconData.label_text) {
                                labelElement.textContent = this.escapeHtml(iconData.label_text);
                            }
                        } else {
                            // Create new icon
                            console.log('Processing icon:', iconData);
                            const latlng = L.latLng(
                                parseFloat(iconData.latitude), 
                                parseFloat(iconData.longitude)
                            );
                            const icon = this.createIconMarker(latlng, iconData.icon_type, iconData.label_text || '');
                            icon.iconId = iconData.id;
                            this.mapIcons[iconData.id] = icon;
                            console.log('Added icon to map:', iconData);
                        }
                    });
                    console.log('All icons loaded. Total:', Object.keys(this.mapIcons).length);
                    
                    // Update icon movement select dropdown if movement is enabled
                    if (this.showMovement) {
                        this.updateIconMovementSelect();
                    }
                }
            } else {
                console.log('No icons found or error:', data);
            }
        } catch (error) {
            console.error('Error loading icons:', error);
            console.error('Error stack:', error.stack);
        }
    }
    
    async loadDrones() {
        // Don't load drones if API is disabled
        if (window.APP_CONFIG && window.APP_CONFIG.useUavBosApi === false) {
            console.log('API is disabled, skipping drone loading');
            return;
        }
        
        try {
            console.log('Loading drones for mission:', this.missionId);
            // Include token in request if we have it (for token-based access)
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            let url = `api/drones.php?mission_id=${encodeURIComponent(this.missionId)}`;
            if (token) {
                url += `&token=${encodeURIComponent(token)}`;
            }
            const response = await safeFetch(url);
            
            if (!response.ok) {
                console.error('Failed to fetch drones. Status:', response.status);
                return;
            }
            
            const data = await response.json();
            console.log('Drones response:', data);
            
            if (data.success && data.drones && Array.isArray(data.drones)) {
                console.log('Found', data.drones.length, 'drones');
                if (data.drones.length === 0) {
                    console.log('No drones in database for this mission');
                } else {
                    data.drones.forEach(drone => {
                        console.log('Processing drone:', drone);
                        this.createDroneMarker(drone);
                    });
                    console.log('All drones loaded. Total:', data.drones.length);
                }
            } else {
                console.log('No drones found or error:', data);
            }
        } catch (error) {
            console.error('Error loading drones:', error);
            console.error('Error stack:', error.stack);
        }
    }
    
    createDroneMarker(drone) {
        const lat = parseFloat(drone.lat);
        const lng = parseFloat(drone.long);
        const battery = parseInt(drone.battery) || 0;
        
        // Determine battery color
        let batteryColor = '#10b981'; // green
        if (battery < 20) {
            batteryColor = '#ef4444'; // red
        } else if (battery < 50) {
            batteryColor = '#f59e0b'; // orange
        }
        
        const popupContent = `
            <strong>${this.escapeHtml(drone.name || drone.id)}</strong><br>
            Höhe: ${drone.height || 0}m<br>
            Batterie: ${battery}%<br>
            Position: ${lat.toFixed(6)}, ${lng.toFixed(6)}
        `;
        
        // Create custom icon with battery color
        const customIcon = L.divIcon({
            className: 'drone-marker',
            html: `
                <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 24px; transform: rotate(-45deg);">🚁</span>
                    <div style="
                        position: absolute;
                        bottom: 0;
                        right: 0;
                        width: 12px;
                        height: 12px;
                        background-color: ${batteryColor};
                        border: 2px solid white;
                        border-radius: 50%;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    " title="Batterie: ${battery}%"></div>
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
                    ">${this.escapeHtml(drone.id)}</div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        const marker = L.marker([lat, lng], { icon: customIcon })
            .addTo(this.map)
            .bindPopup(popupContent);
        
        console.log('Drone marker added:', drone.id);
        return marker;
    }
    
    createIconMarker(latlng, iconType, labelText) {
        // Ensure label is always visible, even if empty
        const displayText = (labelText && String(labelText).trim()) ? String(labelText).trim() : 'Text';
        
        console.log('Creating icon marker:', { latlng, iconType, labelText, displayText });
        
        const iconHtml = `
            <div class="icon-container">
                <div class="icon-display">${this.getIconEmoji(iconType)}</div>
                <div class="icon-label" style="contenteditable: false; cursor: default; display: block !important; visibility: visible !important; opacity: 1 !important;">${this.escapeHtml(displayText)}</div>
            </div>
        `;
        
        const icon = L.marker(latlng, {
            icon: L.divIcon({
                className: `map-icon-marker ${iconType}`,
                html: iconHtml,
                iconSize: [40, 60],
                iconAnchor: [20, 40]
            }),
            draggable: false
        });
        
        icon.addTo(this.map);
        console.log('Icon added to map:', icon);
        
        return icon;
    }
    
    getIconEmoji(iconType) {
        return window.getIconEmoji(iconType);
    }
    
    escapeHtml(text) {
        return window.escapeHtml(text);
    }
    
    /**
     * Toggle icon movement visualization
     */
    async toggleMovement(enabled) {
        this.showMovement = enabled;
        
        // Show/hide icon select dropdown
        const selectContainer = document.getElementById('icon-movement-select-container');
        if (selectContainer) {
            selectContainer.style.display = enabled ? 'block' : 'none';
        }
        
        if (enabled) {
            // Hide timeline if it exists
            if (window.zeitstrahlManager) {
                window.zeitstrahlManager.hide();
            }
            
            // Update icon select dropdown
            this.updateIconMovementSelect();
            
            // Load and display icon movements
            if (this.missionId) {
                await this.loadIconMovements(this.missionId);
            }
        } else {
            // Clear movement paths
            this.clearMovementPaths();
        }
    }
    
    /**
     * Update icon movement select dropdown with current icons
     */
    updateIconMovementSelect() {
        const select = document.getElementById('icon-movement-select');
        if (!select) return;
        
        // Clear existing options except "All"
        select.textContent = '';
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Alle Icons';
        select.appendChild(allOption);
        
        // Add options for each icon
        Object.keys(this.mapIcons).forEach(iconId => {
            const icon = this.mapIcons[iconId];
            if (!icon || !icon.iconId) return;
            
            // Get icon type and label
            const iconType = icon.options?.icon?.options?.className?.match(/\b(vehicle|person|drone|poi|fire|fire_truck|ambulance|police|thw)\b/)?.[1] || 'poi';
            const labelElement = icon.getElement()?.querySelector('.icon-label');
            const labelText = labelElement?.textContent?.trim() || 'Unbenannt';
            const emoji = this.getIconEmoji(iconType);
            
            const option = document.createElement('option');
            option.value = icon.iconId;
            option.textContent = `${emoji} ${this.escapeHtml(labelText)}`;
            select.appendChild(option);
        });
        
        // Restore selected value
        select.value = this.selectedIconId;
    }
    
    /**
     * Load and display icon movement paths
     */
    async loadIconMovements(missionId) {
        if (!missionId) return;
        
        // Clear existing movement paths
        this.clearMovementPaths();
        
        try {
            // Include token in request if we have it (for token-based access)
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            
            // Build URL with optional icon filter
            let url = `api/map_icons.php?mission_id=${encodeURIComponent(missionId)}&get_positions=1`;
            if (this.selectedIconId && this.selectedIconId !== 'all') {
                url += `&icon_id=${encodeURIComponent(this.selectedIconId)}`;
            }
            if (token) {
                url += `&token=${encodeURIComponent(token)}`;
            }
            
            const response = await safeFetch(url);
            const data = await response.json();
            
            if (data.success && data.positions && data.positions.length > 0) {
                // Group positions by icon_id
                const positionsByIcon = {};
                data.positions.forEach(pos => {
                    const iconId = pos.icon_id.toString();
                    if (!positionsByIcon[iconId]) {
                        positionsByIcon[iconId] = {
                            iconId: pos.icon_id,
                            iconType: pos.icon_type,
                            labelText: pos.label_text || 'Unbenannt',
                            positions: []
                        };
                    }
                    positionsByIcon[iconId].positions.push({
                        lat: pos.latitude,
                        lng: pos.longitude,
                        recordedAt: pos.recorded_at
                    });
                });
                
                // Sort positions by time for each icon
                Object.keys(positionsByIcon).forEach(iconId => {
                    positionsByIcon[iconId].positions.sort((a, b) => {
                        return new Date(a.recordedAt) - new Date(b.recordedAt);
                    });
                });
                
                // Generate colors for each icon
                const iconColors = this.generateDroneColors(Object.keys(positionsByIcon).length);
                
                // Draw movement paths
                let colorIndex = 0;
                Object.keys(positionsByIcon).forEach(iconId => {
                    const iconData = positionsByIcon[iconId];
                    const color = iconColors[colorIndex];
                    
                    // Create polyline connecting all positions
                    const latlngs = iconData.positions.map(p => [p.lat, p.lng]);
                    const polyline = L.polyline(latlngs, {
                        color: color,
                        weight: 3,
                        opacity: 0.7,
                        smoothFactor: 1
                    }).addTo(this.map);
                    
                    // Create markers for each position
                    const markers = [];
                    iconData.positions.forEach((pos, index) => {
                        const marker = L.circleMarker([pos.lat, pos.lng], {
                            radius: 4,
                            fillColor: color,
                            color: '#fff',
                            weight: 2,
                            opacity: 0.8,
                            fillOpacity: 0.8
                        }).addTo(this.map);
                        
                        const emoji = this.getIconEmoji(iconData.iconType);
                        marker.bindPopup(`
                            <div style="min-width: 150px;">
                                <strong>${emoji} ${this.escapeHtml(iconData.labelText)}</strong><br>
                                Position: ${index + 1} / ${iconData.positions.length}<br>
                                <small>Zeit: ${new Date(pos.recordedAt).toLocaleString('de-DE')}</small>
                            </div>
                        `);
                        
                        markers.push(marker);
                    });
                    
                    // Store layers
                    this.movementLayers[iconId] = {
                        polyline: polyline,
                        markers: markers
                    };
                    
                    colorIndex++;
                });
            }
        } catch (error) {
            console.error('Error loading icon movements:', error);
        }
    }
    
    /**
     * Generate distinct colors for icons
     */
    generateDroneColors(count) {
        return window.generateDroneColors(count);
    }
    
    /**
     * Get icon emoji based on type
     */
    getIconEmoji(iconType) {
        return window.getIconEmoji(iconType);
    }
    
    /**
     * Clear all movement path visualizations
     */
    clearMovementPaths() {
        // Remove all polylines and markers
        Object.values(this.movementLayers).forEach(layer => {
            if (layer.polyline) {
                this.map.removeLayer(layer.polyline);
            }
            if (layer.markers) {
                layer.markers.forEach(marker => {
                    this.map.removeLayer(marker);
                });
            }
        });
        
        this.movementLayers = {};
    }
    
    /**
     * Cleanup method to prevent memory leaks
     */
    destroy() {
        // Clear all timeouts
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        
        // Clear all intervals
        this.intervalIds.forEach(id => clearInterval(id));
        this.intervalIds = [];
        
        // Stop GPS sharing
        this.stopGPSSharing();
        
        // Remove grid layer
        if (this.gridLayer) {
            this.map.removeLayer(this.gridLayer);
            this.gridLayer = null;
        }
        
        // Clear grid cells
        this.gridCells = [];
        
        // Clear movement layers
        this.clearMovementPaths();
        
        // Remove map icons
        Object.values(this.mapIcons).forEach(icon => {
            if (icon && this.map.hasLayer(icon)) {
                this.map.removeLayer(icon);
            }
        });
        this.mapIcons = {};
    }
}
