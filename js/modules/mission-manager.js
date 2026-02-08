/**
 * Mission Manager
 * Handles mission creation, grid generation, and mission start/stop
 */
class MissionManager {
    constructor(droneTracker, map) {
        this.droneTracker = droneTracker;
        this.map = map;
        this.currentMissionId = null;
        this.missionActive = false;
        this.currentMissionStatus = null; // Track mission status: 'pending', 'active', 'completed'
        this.currentShape = 'rectangle';
        this.drawnLayer = null;
        this.drawControl = null;
        this.drawnItems = null;
        this.shapeData = null;
        this.drawHandler = null;
        this.gridLayer = null;
        this.gridCells = [];
        this.legendData = {};
        this.legendEditing = false;
        this.doneFields = {}; // Store done status for fields (keyed by cellNumber)
        this.selectedIconType = null;
        this.mapIcons = {};
        this.showMovement = false;
        this.movementLayers = {}; // Store movement path layers per icon
        this.movementMarkers = {}; // Store position markers
        this.selectedIconId = 'all'; // Selected icon ID or 'all'
        this.timeoutIds = []; // Store timeout IDs for cleanup
        this.init();
    }
    
    init() {
        const generateBtn = document.getElementById('generate-grid-btn');
        const startBtn = document.getElementById('start-mission-btn');
        const stopBtn = document.getElementById('stop-mission-btn');
        const clearBtn = document.getElementById('clear-drawing-btn');
        const createNoRasterBtn = document.getElementById('create-mission-no-raster-btn');
        const missionForm = document.getElementById('mission-form');
        
        // Shape selection buttons - set up first to ensure they work
        document.querySelectorAll('.btn-shape').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const shape = e.currentTarget.dataset.shape;
                console.log('Shape button clicked:', shape);
                this.selectShape(shape);
            });
        });
        
        // No raster mode checkbox
        const noRasterCheckbox = document.getElementById('no-raster-mode');
        if (noRasterCheckbox) {
            // Initialize toggle state on page load
            this.toggleNoRasterMode(noRasterCheckbox.checked);
            
            noRasterCheckbox.addEventListener('change', (e) => {
                console.log('No raster checkbox changed:', e.target.checked);
                this.toggleNoRasterMode(e.target.checked);
            });
        } else {
            console.warn('No raster mode checkbox not found');
        }
        
        generateBtn.addEventListener('click', () => this.generateGrid());
        startBtn.addEventListener('click', () => this.startMission());
        stopBtn.addEventListener('click', () => this.stopMission());
        clearBtn.addEventListener('click', () => this.clearDrawing());
        if (createNoRasterBtn) {
            createNoRasterBtn.addEventListener('click', () => this.createMissionNoRaster());
        }
        
        // Grid mode toggle (number of areas vs field size)
        const gridModeRadios = document.querySelectorAll('input[name="grid-mode"]');
        const numAreasContainer = document.getElementById('num-areas-container');
        const fieldSizeContainer = document.getElementById('field-size-container');
        const numAreasInput = document.getElementById('num_areas');
        const fieldSizeInput = document.getElementById('field_size');
        
        gridModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'num-areas') {
                    numAreasContainer.style.display = 'block';
                    fieldSizeContainer.style.display = 'none';
                    numAreasInput.required = true;
                    fieldSizeInput.required = false;
                } else {
                    numAreasContainer.style.display = 'none';
                    fieldSizeContainer.style.display = 'block';
                    numAreasInput.required = false;
                    fieldSizeInput.required = true;
                }
            });
        });
        
        // Reset form button
        const resetBtn = document.getElementById('reset-form-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetForm());
        }
        
        // Print button
        const printBtn = document.getElementById('print-btn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printMap());
        }
        
        // Icon type selection
        document.querySelectorAll('.icon-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const iconType = e.currentTarget.dataset.iconType;
                this.selectIconType(iconType);
            });
        });
        
        // Map click handler for placing icons
        // Use a higher priority to ensure it runs before other handlers
        this.map.on('click', (e) => {
            // Only place icon if icon type is selected
            if (this.selectedIconType) {
                // Disable placement in timeline history mode
                if (window.zeitstrahlManager && !window.zeitstrahlManager.isLiveMode) {
                    this.showStatus('Icon-Platzierung im Historienmodus deaktiviert. Wechseln Sie zu Live.', 'error');
                    return;
                }
                // Check if drawing is active by checking if any draw handler is currently drawing
                let isDrawingActive = false;
                if (this.drawControl && this.drawControl._toolbars) {
                    // Check if any drawing handler is active
                    const toolbars = this.drawControl._toolbars;
                    for (let key in toolbars) {
                        if (toolbars[key] && toolbars[key]._activeMode) {
                            isDrawingActive = true;
                            break;
                        }
                    }
                }
                
                if (!isDrawingActive) {
                    // Prevent event from propagating to other handlers
                    L.DomEvent.stopPropagation(e);
                    this.placeIcon(e.latlng, this.selectedIconType);
                }
            }
        }, this);
        
        // Legend edit button
        const editLegendBtn = document.getElementById('edit-legend-btn');
        if (editLegendBtn) {
            editLegendBtn.addEventListener('click', () => this.toggleLegendEdit());
        }
        
        // Legend search input
        const legendSearchInput = document.getElementById('legend-search-input');
        if (legendSearchInput) {
            legendSearchInput.addEventListener('input', (e) => {
                this.filterLegend(e.target.value);
            });
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
                if (this.showMovement && this.currentMissionId) {
                    this.loadIconMovements(this.currentMissionId);
                }
            });
        }
        
        missionForm.addEventListener('submit', (e) => {
            e.preventDefault();
        });
        
        // Mission ID input handler for no-raster mode
        const missionIdInput = document.getElementById('mission_id');
        if (missionIdInput) {
            missionIdInput.addEventListener('input', () => {
                const noRasterCheckbox = document.getElementById('no-raster-mode');
                const startBtn = document.getElementById('start-mission-btn');
                if (noRasterCheckbox && noRasterCheckbox.checked && startBtn) {
                    // Enable start button if mission ID is filled and no mission is active
                    startBtn.disabled = !missionIdInput.value.trim() || this.missionActive || this.currentMissionStatus === 'active';
                }
            });
        }
        
        // Initialize drawing
        this.initDrawing();
    }
    
    selectShape(shape) {
        this.currentShape = shape;
        
        // Update button states
        document.querySelectorAll('.btn-shape').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-shape="${shape}"]`).classList.add('active');
        
        // Reinitialize drawing with new shape
        this.initDrawing();
    }
    
    initDrawing() {
        // Don't allow drawing if mission is active or completed
        if (this.missionActive || this.currentMissionStatus === 'completed') {
            return;
        }
        
        // Check if Leaflet.draw is available
        if (typeof L.Control === 'undefined' || typeof L.Control.Draw === 'undefined') {
            console.error('Leaflet.draw library is not loaded');
            this.showStatus('Zeichen-Bibliothek wird geladen... Bitte warten Sie einen Moment.', 'info');
            const timeoutId = setTimeout(() => this.initDrawing(), 500);
            this.timeoutIds.push(timeoutId);
            return;
        }
        
        // Remove existing draw control
        if (this.drawControl) {
            try {
                this.map.removeControl(this.drawControl);
            } catch (e) {
                console.warn('Error removing draw control:', e);
            }
            this.drawControl = null;
        }
        
        // Remove existing event listener
        if (this.drawHandler) {
            try {
                this.map.off(L.Draw.Event.CREATED, this.drawHandler);
            } catch (e) {
                console.warn('Error removing draw handler:', e);
            }
            this.drawHandler = null;
        }
        
        // Remove existing drawn layer
        if (this.drawnLayer) {
            try {
                this.map.removeLayer(this.drawnLayer);
            } catch (e) {
                console.warn('Error removing drawn layer:', e);
            }
            this.drawnLayer = null;
        }
        
        // Remove existing feature group
        if (this.drawnItems) {
            try {
                this.map.removeLayer(this.drawnItems);
            } catch (e) {
                console.warn('Error removing drawn items:', e);
            }
            this.drawnItems = null;
        }
        
        // Configure draw options based on selected shape
        const drawOptions = {
            position: 'topleft',
            draw: {
                polygon: false,
                polyline: false,
                marker: false,
                circlemarker: false,
                rectangle: this.currentShape === 'rectangle' || this.currentShape === 'ellipse',
                circle: this.currentShape === 'circle',
                circlemarker: false
            },
            edit: {
                featureGroup: null,
                remove: false
            }
        };
        
        // Create feature group for drawn items
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);
        
        drawOptions.edit.featureGroup = this.drawnItems;
        
        // Create draw control
        try {
            this.drawControl = new L.Control.Draw(drawOptions);
            this.map.addControl(this.drawControl);
            
            // Handle draw events
            this.drawHandler = (e) => {
                const layer = e.layer;
                this.drawnItems.addLayer(layer);
                
                // Process the drawn shape
                this.processDrawnShape(layer);
            };
            
            this.map.on(L.Draw.Event.CREATED, this.drawHandler);
            
            // Update clear button visibility
            document.getElementById('clear-drawing-btn').style.display = 'none';
            document.getElementById('generate-grid-btn').disabled = true;
            
            // Clear any error messages
            const statusDiv = document.getElementById('mission-status');
            if (statusDiv && statusDiv.classList.contains('info')) {
                statusDiv.className = 'mission-status';
                statusDiv.textContent = '';
            }
        } catch (error) {
            console.error('Error initializing draw control:', error);
            console.error('Error details:', error.message, error.stack);
            this.showStatus('Fehler beim Initialisieren des Zeichen-Tools: ' + error.message, 'error');
        }
    }
    
    processDrawnShape(layer) {
        // Don't allow processing new shapes if mission is active or completed
        if (this.missionActive || this.currentMissionStatus === 'completed') {
            // Remove the layer that was just drawn
            this.map.removeLayer(layer);
            if (this.drawnItems) {
                this.drawnItems.removeLayer(layer);
            }
            this.showStatus('Kann keine neuen Formen zeichnen, während eine Mission aktiv oder abgeschlossen ist.', 'error');
            return;
        }
        
        let bounds, center, shapeType;
        
        if (this.currentShape === 'rectangle') {
            bounds = layer.getBounds();
            center = bounds.getCenter();
            shapeType = 'rectangle';
        } else if (this.currentShape === 'ellipse') {
            // Convert rectangle to ellipse
            bounds = layer.getBounds();
            center = bounds.getCenter();
            shapeType = 'ellipse';
            
            // Remove the rectangle and create an ellipse polygon
            this.map.removeLayer(layer);
            this.drawnItems.removeLayer(layer);
            
            // Create ellipse as polygon
            const ellipse = this.createEllipseFromBounds(bounds);
            this.drawnItems.addLayer(ellipse);
            layer = ellipse;
        } else if (this.currentShape === 'circle') {
            const circle = layer;
            const centerLatLng = circle.getLatLng();
            const radius = circle.getRadius(); // in meters
            
            // Calculate bounds for circle
            const north = this.destinationPoint(centerLatLng.lat, centerLatLng.lng, radius, 0);
            const south = this.destinationPoint(centerLatLng.lat, centerLatLng.lng, radius, 180);
            const east = this.destinationPoint(centerLatLng.lat, centerLatLng.lng, radius, 90);
            const west = this.destinationPoint(centerLatLng.lat, centerLatLng.lng, radius, 270);
            
            bounds = L.latLngBounds([south.lat, west.lng], [north.lat, east.lng]);
            center = centerLatLng;
            shapeType = 'circle';
        }
        
        // Store shape data
        this.shapeData = {
            type: shapeType,
            bounds: bounds,
            center: center,
            layer: layer
        };
        
        this.drawnLayer = layer;
        
        // Calculate area
        const area = this.calculateArea(bounds, shapeType);
        
        // Show info
        const infoDiv = document.getElementById('drawing-info');
        infoDiv.textContent = `Form: ${shapeType === 'rectangle' ? 'Rechteck' : shapeType === 'circle' ? 'Kreis' : 'Oval'}, Fläche: ${area.toFixed(2)} m²`;
        infoDiv.classList.add('active');
        
        // Enable buttons
        document.getElementById('clear-drawing-btn').style.display = 'block';
        document.getElementById('generate-grid-btn').disabled = false;
    }
    
    calculateArea(bounds, shapeType) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        // Calculate distance in meters
        const latDiff = ne.lat - sw.lat;
        const lngDiff = ne.lng - sw.lng;
        
        // Approximate meters per degree
        const latMeters = latDiff * 111000;
        const lngMeters = lngDiff * 111000 * Math.cos((ne.lat + sw.lat) / 2 * Math.PI / 180);
        
        if (shapeType === 'rectangle') {
            return Math.abs(latMeters * lngMeters);
        } else if (shapeType === 'circle') {
            const radius = Math.sqrt(latMeters * latMeters + lngMeters * lngMeters) / 2;
            return Math.PI * radius * radius;
        } else if (shapeType === 'ellipse') {
            const a = Math.abs(latMeters) / 2;
            const b = Math.abs(lngMeters) / 2;
            return Math.PI * a * b;
        }
        
        return 0;
    }
    
    createEllipseFromBounds(bounds) {
        return window.createEllipseFromBounds(bounds);
    }
    
    destinationPoint(lat, lng, distance, bearing) {
        const R = 6371000; // Earth radius in meters
        const lat1 = lat * Math.PI / 180;
        const lng1 = lng * Math.PI / 180;
        const bearingRad = bearing * Math.PI / 180;
        
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(distance / R) +
            Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearingRad)
        );
        
        const lng2 = lng1 + Math.atan2(
            Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1),
            Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
        );
        
        return {
            lat: lat2 * 180 / Math.PI,
            lng: lng2 * 180 / Math.PI
        };
    }
    
    clearDrawing() {
        // Don't allow clearing if mission is active or completed
        if (this.missionActive) {
            this.showStatus('Raster kann nicht gelöscht werden, während eine Mission aktiv ist.', 'error');
            return;
        }
        
        // Check if current mission is completed
        if (this.currentMissionId && this.currentMissionStatus === 'completed') {
            this.showStatus('Raster kann nicht gelöscht werden, da die Mission abgeschlossen ist.', 'error');
            return;
        }
        
        if (this.drawnLayer) {
            this.map.removeLayer(this.drawnLayer);
            this.drawnLayer = null;
        }
        
        if (this.drawnItems) {
            this.drawnItems.clearLayers();
        }
        
        // Remove grid visualization if exists
        if (this.gridLayer) {
            this.map.removeLayer(this.gridLayer);
            this.gridLayer = null;
        }
        
        this.gridCells = [];
        this.legendData = {};
        this.hideLegendPanel();
        
        // Clear map legend UI (right side)
        const mapLegend = document.getElementById('map-legend');
        const mapLegendItems = document.getElementById('map-legend-items');
        if (mapLegend) {
            mapLegend.style.display = 'none';
        }
        if (mapLegendItems) {
            mapLegendItems.textContent = '';
        }
        
        // Clear sidebar legend items
        const legendItems = document.getElementById('legend-items');
        if (legendItems) {
            legendItems.textContent = '';
        }
        
        this.shapeData = null;
        
        document.getElementById('drawing-info').classList.remove('active');
        document.getElementById('clear-drawing-btn').style.display = 'none';
        document.getElementById('generate-grid-btn').disabled = true;
        
        // Reinitialize drawing
        this.initDrawing();
    }
    
    async generateGrid() {
        // Don't allow generating grid if mission is active or completed
        if (this.missionActive) {
            this.showStatus('Kann kein neues Raster erstellen, während eine Mission aktiv ist.', 'error');
            return;
        }
        
        if (this.currentMissionStatus === 'completed') {
            this.showStatus('Kann kein neues Raster erstellen, da die Mission abgeschlossen ist.', 'error');
            return;
        }
        
        const missionId = document.getElementById('mission_id').value.trim();
        
        // Determine which mode is selected
        const gridMode = document.querySelector('input[name="grid-mode"]:checked').value;
        let numAreas, fieldSize;
        
        if (gridMode === 'num-areas') {
            // Mode 1: Number of areas specified (dropdown: 1, 4, 9, 16, ...)
            const numAreasEl = document.getElementById('num_areas');
            numAreas = parseInt(numAreasEl ? numAreasEl.value : '', 10);
            if (!missionId || !Number.isInteger(numAreas) || numAreas < 1) {
                this.showStatus('Bitte füllen Sie alle Felder aus (Mission-ID und Anzahl Bereiche).', 'error');
                return;
            }
        } else {
            // Mode 2: Field size specified
            fieldSize = parseFloat(document.getElementById('field_size').value);
            if (!missionId || !fieldSize || fieldSize <= 0) {
                this.showStatus('Bitte füllen Sie alle Felder aus.', 'error');
                return;
            }
        }
        
        if (!this.shapeData) {
            this.showStatus('Bitte zeichnen Sie zuerst eine Form auf der Karte.', 'error');
            return;
        }
        
        if (!this.shapeData.bounds) {
            this.showStatus('Ungültige Form-Daten. Bitte zeichnen Sie eine neue Form.', 'error');
            return;
        }
        
        // Calculate grid based on shape
        const bounds = this.shapeData.bounds;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        // Calculate dimensions in meters
        const latDiff = ne.lat - sw.lat;
        const lngDiff = ne.lng - sw.lng;
        const latMeters = Math.abs(latDiff * 111000);
        const lngMeters = Math.abs(lngDiff * 111000 * Math.cos((ne.lat + sw.lat) / 2 * Math.PI / 180));
        const totalArea = latMeters * lngMeters;
        
        if (!Number.isFinite(totalArea) || totalArea <= 0) {
            this.showStatus('Bitte zeichnen Sie eine Fläche mit gültiger Größe (nicht nur eine Linie oder einen Punkt).', 'error');
            return;
        }
        
        let gridLength, gridHeight;
        
        if (gridMode === 'num-areas') {
            // Mode 1: Calculate field size from number of areas
            // Try to create a grid that's as square-like as possible
            const areaPerCell = totalArea / numAreas;
            let aspectRatio = latMeters > 0 ? lngMeters / latMeters : 1;
            if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) aspectRatio = 1;
            
            if (aspectRatio > 1) {
                // Wider than tall
                gridHeight = Math.ceil(Math.sqrt(numAreas / aspectRatio));
                gridLength = Math.ceil(numAreas / gridHeight);
            } else {
                // Taller than wide
                gridLength = Math.ceil(Math.sqrt(numAreas * aspectRatio));
                gridHeight = Math.ceil(numAreas / gridLength);
            }
            gridLength = Math.max(1, gridLength);
            gridHeight = Math.max(1, gridHeight);
            
            // Calculate actual field size from the grid dimensions
            fieldSize = Math.sqrt(areaPerCell);
            if (!Number.isFinite(fieldSize) || fieldSize <= 0) {
                this.showStatus('Bitte zeichnen Sie eine größere Fläche für die gewählte Anzahl Bereiche.', 'error');
                return;
            }
        } else {
            // Mode 2: Calculate number of areas from field size
            // Calculate how many fields fit in each direction
            const fieldSideLength = Math.sqrt(fieldSize); // Side length of square field in meters
            
            // Calculate grid dimensions based on field size
            gridLength = Math.floor(lngMeters / fieldSideLength);
            gridHeight = Math.floor(latMeters / fieldSideLength);
            
            // Ensure we have at least 1 field in each direction
            if (gridLength < 1) gridLength = 1;
            if (gridHeight < 1) gridHeight = 1;
            
            // Calculate actual number of areas
            numAreas = gridLength * gridHeight;
            
            // Recalculate actual field size based on the actual grid dimensions
            // This ensures the fields fit exactly in the bounds
            const actualFieldWidth = lngMeters / gridLength;
            const actualFieldHeight = latMeters / gridHeight;
            fieldSize = actualFieldWidth * actualFieldHeight;
        }
        
        // Get center from shape (calculate if not set)
        let center;
        if (this.shapeData.center) {
            center = this.shapeData.center;
        } else {
            // Calculate center from bounds if not set
            center = bounds.getCenter();
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'create_grid');
            formData.append('mission_id', missionId);
            formData.append('grid_length', gridLength);
            formData.append('grid_height', gridHeight);
            formData.append('field_size', fieldSize);
            formData.append('center_lat', center.lat);
            formData.append('center_lng', center.lng);
            formData.append('shape_type', this.shapeData.type);
            formData.append('bounds_ne_lat', ne.lat);
            formData.append('bounds_ne_lng', ne.lng);
            formData.append('bounds_sw_lat', sw.lat);
            formData.append('bounds_sw_lng', sw.lng);
            formData.append('num_areas', String(Number(numAreas)));
            
            const response = await safeFetch('api/mission.php', {
                method: 'POST',
                body: formData
            });
            
            const rawText = await response.text();
            let data;
            try {
                data = rawText ? JSON.parse(rawText) : {};
            } catch (e) {
                console.error('Grid API response was not JSON:', rawText);
                this.showStatus('Fehler beim Erstellen des Rasters: Ungültige Server-Antwort.', 'error');
                return;
            }
            
            if (data.success) {
                this.showStatus(`Raster erfolgreich erstellt! (${gridLength}x${gridHeight} = ${gridLength * gridHeight} Bereiche)`, 'success');
                document.getElementById('start-mission-btn').disabled = false;
                this.currentMissionId = missionId;
                
                // Update logger with mission ID
                if (window.fileLogger) {
                    window.fileLogger.setMissionId(missionId);
                }
                this.missionActive = false; // Mission is not active yet, just created
                
                // Show mission tools tab so users can place icons
                this.showMissionToolsTab();
                
                // Update share button visibility
                if (window.shareManager) {
                    window.shareManager.updateShareButton();
                }
                
                // Load legend data if exists (await to ensure it's loaded before visualizing)
                await this.loadLegendData();
                
                // Visualize grid on map
                this.visualizeGrid(bounds, gridLength, gridHeight);
            } else {
                this.showStatus(data.error || 'Fehler beim Erstellen des Rasters.', 'error');
            }
        } catch (error) {
            console.error('Error creating grid:', error);
            this.showStatus('Fehler beim Erstellen des Rasters.', 'error');
        }
    }
    
    toggleNoRasterMode(enabled) {
        const rasterContainer = document.getElementById('raster-mode-container');
        const generateBtn = document.getElementById('generate-grid-btn');
        const createNoRasterBtn = document.getElementById('create-mission-no-raster-btn');
        const startBtn = document.getElementById('start-mission-btn');
        const missionIdInput = document.getElementById('mission_id');
        const shapeFormGroup = document.getElementById('shape-selection-group');
        
        if (enabled) {
            // Hide raster-specific UI elements and shape selection
            if (rasterContainer) {
                rasterContainer.style.display = 'none';
            }
            if (generateBtn) {
                generateBtn.style.display = 'none';
            }
            if (shapeFormGroup) {
                shapeFormGroup.style.display = 'none';
            }
            if (createNoRasterBtn) {
                createNoRasterBtn.style.display = 'none';
            }
            
            // Show and configure start mission button (it will create and start in one step)
            if (startBtn) {
                startBtn.style.display = 'block';
                // Enable button if mission ID is filled and no mission is currently active
                if (missionIdInput && missionIdInput.value.trim() && !this.missionActive && this.currentMissionStatus !== 'active') {
                    startBtn.disabled = false;
                } else {
                    startBtn.disabled = true;
                }
            }
        } else {
            // Show raster options and shape selection
            if (rasterContainer) {
                rasterContainer.style.display = 'block';
            }
            if (generateBtn) {
                generateBtn.style.display = 'block';
            }
            if (shapeFormGroup) {
                shapeFormGroup.style.display = 'block';
            }
            if (createNoRasterBtn) {
                createNoRasterBtn.style.display = 'none';
            }
            
            // For normal missions, start button should be disabled until grid is created
            if (startBtn && !this.currentMissionId) {
                startBtn.disabled = true;
            }
        }
    }
    
    async createMissionNoRaster() {
        // Don't allow creating mission if one is already active or completed
        if (this.missionActive) {
            this.showStatus('Kann keine neue Mission erstellen, während eine Mission aktiv ist.', 'error');
            return;
        }
        
        if (this.currentMissionStatus === 'completed') {
            this.showStatus('Kann keine neue Mission erstellen, da die aktuelle Mission abgeschlossen ist.', 'error');
            return;
        }
        
        const missionId = document.getElementById('mission_id').value.trim();
        
        if (!missionId) {
            this.showStatus('Bitte geben Sie eine Mission ID ein.', 'error');
            return;
        }
        
        // Get map center as default location
        const mapCenter = this.map.getCenter();
        
        try {
            const formData = new FormData();
            formData.append('action', 'create_mission');
            formData.append('mission_id', missionId);
            formData.append('center_lat', mapCenter.lat);
            formData.append('center_lng', mapCenter.lng);
            
            const response = await safeFetch('api/mission.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showStatus('Mission ohne Raster erfolgreich erstellt! Sie können jetzt Icons platzieren.', 'success');
                
                // Enable and show start mission button
                const startBtn = document.getElementById('start-mission-btn');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.style.display = 'block';
                }
                
                this.currentMissionId = missionId;
                
                // Update logger with mission ID
                if (window.fileLogger) {
                    window.fileLogger.setMissionId(missionId);
                }
                this.missionActive = false; // Mission is not active yet, just created
                
                // Show mission tools tab so users can place icons
                this.showMissionToolsTab();
                
                // Update share button visibility
                if (window.shareManager) {
                    window.shareManager.updateShareButton();
                }
                
                // Disable the create button and mission ID input
                const createNoRasterBtn = document.getElementById('create-mission-no-raster-btn');
                if (createNoRasterBtn) {
                    createNoRasterBtn.disabled = true;
                }
                const missionIdInput = document.getElementById('mission_id');
                if (missionIdInput) {
                    missionIdInput.disabled = true;
                }
            } else {
                this.showStatus(data.error || 'Fehler beim Erstellen der Mission.', 'error');
            }
        } catch (error) {
            console.error('Error creating mission without raster:', error);
            this.showStatus('Fehler beim Erstellen der Mission.', 'error');
        }
    }
    
    async startMission() {
        const missionId = document.getElementById('mission_id').value.trim();
        const noRasterCheckbox = document.getElementById('no-raster-mode');
        const isNoRasterMode = noRasterCheckbox && noRasterCheckbox.checked;
        
        if (!missionId) {
            this.showStatus('Bitte geben Sie eine Mission ID ein.', 'error');
            return;
        }
        
        // If no-raster mode is enabled, create the mission first, then start it
        if (isNoRasterMode) {
            // Check if mission already exists
            if (this.currentMissionId === missionId && this.currentMissionStatus === 'pending') {
                // Mission already exists, just start it
            } else {
                // Create mission without raster first
                try {
                    const mapCenter = this.map.getCenter();
                    const formData = new FormData();
                    formData.append('action', 'create_mission');
                    formData.append('mission_id', missionId);
                    formData.append('center_lat', mapCenter.lat);
                    formData.append('center_lng', mapCenter.lng);
                    
                    const createResponse = await safeFetch('api/mission.php', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const createData = await createResponse.json();
                    
                    if (!createData.success) {
                        // Mission might already exist, try to start it anyway
                        if (createData.error && createData.error.includes('already exists')) {
                            // Mission exists, continue to start it
                        } else {
                            this.showStatus(createData.error || 'Fehler beim Erstellen der Mission.', 'error');
                            return;
                        }
                    } else {
                        // Mission created successfully
                        this.currentMissionId = missionId;
                        this.currentMissionStatus = 'pending';
                        
                        // Update logger with mission ID
                        if (window.fileLogger) {
                            window.fileLogger.setMissionId(missionId);
                        }
                        
                        // Show mission tools tab
                        this.showMissionToolsTab();
                        
                        // Update share button visibility
                        if (window.shareManager) {
                            window.shareManager.updateShareButton();
                        }
                    }
                } catch (error) {
                    console.error('Error creating mission without raster:', error);
                    this.showStatus('Fehler beim Erstellen der Mission.', 'error');
                    return;
                }
            }
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'start_mission');
            formData.append('mission_id', missionId);
            
            const response = await safeFetch('api/mission.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showStatus('Mission gestartet! Daten werden alle 30 Sekunden gespeichert.', 'info');
                
                const startBtn = document.getElementById('start-mission-btn');
                const stopBtn = document.getElementById('stop-mission-btn');
                const missionIdInput = document.getElementById('mission_id');
                
                if (startBtn) {
                    startBtn.style.display = 'none';
                }
                if (stopBtn) {
                    stopBtn.style.display = 'block';
                    stopBtn.disabled = false; // Ensure it's enabled
                }
                
                // Disable form elements
                if (missionIdInput) {
                    missionIdInput.disabled = true;
                }
                
                // Only disable raster-related elements if not in no-raster mode
                if (!isNoRasterMode) {
                    const generateBtn = document.getElementById('generate-grid-btn');
                    if (generateBtn) {
                        generateBtn.disabled = true;
                    }
                    const numAreasInput = document.getElementById('num_areas');
                    if (numAreasInput) {
                        numAreasInput.disabled = true;
                    }
                }
                
                const clearBtn = document.getElementById('clear-drawing-btn');
                if (clearBtn) {
                    clearBtn.disabled = true; // Disable clear button during mission
                }
                
                // Disable shape buttons
                document.querySelectorAll('.btn-shape').forEach(btn => {
                    btn.disabled = true;
                });
                
                this.currentMissionId = missionId;
                
                // Update logger with mission ID
                if (window.fileLogger) {
                    window.fileLogger.setMissionId(missionId);
                }
                this.missionActive = true; // Mission is now active
                this.currentMissionStatus = 'active';
                if (this.droneTracker) this.droneTracker.setMissionId(missionId);
                
                // Update share button visibility
                if (window.shareManager) {
                    window.shareManager.updateShareButton();
                }
                
                // Show mission tools tab and make it active
                this.showMissionToolsTab();
                
                // Store in sessionStorage
                try {
                    sessionStorage.setItem('lastMissionId', missionId);
                } catch (e) {
                    console.warn('Could not store mission ID in sessionStorage:', e);
                }
                
                // Initialize timeline for active mission
                if (window.zeitstrahlManager) {
                    // Create mission data object for timeline
                    const missionData = {
                        mission_id: missionId,
                        status: 'active'
                    };
                    // Set mission data immediately
                    window.zeitstrahlManager.currentMissionId = missionId;
                    window.zeitstrahlManager.currentMission = missionData;
                    window.zeitstrahlManager.timePositions = []; // Initialize empty for new active mission
                    
                    // Show timeline in live mode immediately (don't wait for API call)
                    window.zeitstrahlManager.showInLiveMode();
                    
                    // Load historical positions in background (if any exist)
                    window.zeitstrahlManager.loadMission(missionId, missionData).catch(error => {
                        console.error('Error loading mission positions:', error);
                        // Timeline is already shown in live mode, so we can continue
                    });
                }
                
                // Load icons for this mission
                this.loadIcons(missionId);
            } else {
                this.showStatus(data.error || 'Fehler beim Starten der Mission.', 'error');
            }
        } catch (error) {
            console.error('Error starting mission:', error);
            this.showStatus('Fehler beim Starten der Mission.', 'error');
        }
    }
    
    async stopMission() {
        const missionId = document.getElementById('mission_id').value.trim();
        
        if (!missionId) {
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'stop_mission');
            formData.append('mission_id', missionId);
            
            const response = await safeFetch('api/mission.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showStatus('Mission beendet.', 'success');
                
                // Mission is now completed - update status and UI
                this.missionActive = false; // Mission is no longer active
                this.currentMissionStatus = 'completed'; // Mission is now completed
                
                // Update UI based on completed status (will disable drawing/clearing)
                this.updateUIForMissionStatus('completed');
                
                // Keep currentMissionId set - mission still exists, just not active anymore
                // Users should still be able to place icons on completed missions
                this.droneTracker.setMissionId(null);
                
                // Update share button visibility
                if (window.shareManager) {
                    window.shareManager.updateShareButton();
                }
                
                // Keep mission tools tab visible - users can still place icons
                // Tab is already visible if currentMissionId is set
                
                // Remove API connection warning
                this.hideApiConnectionWarning();
                
                // Clear from sessionStorage when mission is stopped
                try {
                    const storedMissionId = sessionStorage.getItem('lastMissionId');
                    if (storedMissionId === missionId) {
                        sessionStorage.removeItem('lastMissionId');
                    }
                } catch (e) {
                    // Ignore
                }
            } else {
                this.showStatus(data.error || 'Fehler beim Beenden der Mission.', 'error');
            }
        } catch (error) {
            console.error('Error stopping mission:', error);
            this.showStatus('Fehler beim Beenden der Mission.', 'error');
        }
    }
    
    setupPageCloseWarning() {
        // Remove existing listener if any
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        }
        
        // Add warning when user tries to close page during active mission
        this.beforeUnloadHandler = (e) => {
            if (this.missionActive) {
                e.preventDefault();
                e.returnValue = 'Die Mission ist aktiv. Wenn Sie diese Seite schließen, wird die API-Verbindung unterbrochen und keine weiteren Drohnendaten werden gesammelt. Möchten Sie die Seite wirklich schließen?';
                return e.returnValue;
            }
        };
        
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
    
    showApiConnectionWarning() {
        // Remove existing warning if any
        const existingWarning = document.getElementById('api-connection-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        // Create warning banner
        const warning = document.createElement('div');
        warning.id = 'api-connection-warning';
        warning.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background-color: #fef3c7;
            border-bottom: 2px solid #f59e0b;
            padding: 0.75rem 1rem;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        // Create warning content using DOM methods (safer than innerHTML)
        const iconSpan = document.createElement('span');
        iconSpan.style.fontSize = '1.2rem';
        iconSpan.textContent = '⚠️';
        
        const mainSpan = document.createElement('span');
        mainSpan.style.fontWeight = '600';
        mainSpan.style.color = '#92400e';
        mainSpan.textContent = 'WICHTIG: Die API-Verbindung wird unterbrochen, wenn Sie diese Seite schließen!';
        
        const subSpan = document.createElement('span');
        subSpan.style.color = '#78350f';
        subSpan.style.fontSize = '0.9rem';
        subSpan.textContent = 'Bitte lassen Sie diese Seite geöffnet, damit die Drohnendaten kontinuierlich gesammelt werden können.';
        
        warning.appendChild(iconSpan);
        warning.appendChild(mainSpan);
        warning.appendChild(subSpan);
        
        document.body.insertBefore(warning, document.body.firstChild);
        
        // Adjust map container height to account for warning banner (don't add margin, reduce height)
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            // Calculate warning banner height (approximately 50px)
            const warningHeight = 50;
            mapContainer.style.height = `calc(100vh - 60px - ${warningHeight}px)`;
            mapContainer.style.maxHeight = `calc(100vh - 60px - ${warningHeight}px)`;
        }
        
        // Also adjust main element
        const mainElement = document.querySelector('main');
        if (mainElement) {
            const warningHeight = 50;
            mainElement.style.height = `calc(100vh - 60px - ${warningHeight}px)`;
            mainElement.style.maxHeight = `calc(100vh - 60px - ${warningHeight}px)`;
        }
    }
    
    hideApiConnectionWarning() {
        const warning = document.getElementById('api-connection-warning');
        if (warning) {
            warning.remove();
        }
        
        // Restore map container height
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.style.height = '';
            mapContainer.style.maxHeight = '';
        }
        
        // Restore main element height
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.style.height = '';
            mainElement.style.maxHeight = '';
        }
        
        // Remove beforeunload listener
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
    }
    
    generateColor(index) {
        return window.generateColor(index);
    }
    
    /**
     * Load and visualize mission data from database
     */
    async loadMissionData(missionData) {
        // Populate form fields
        this.loadMissionIntoForm(missionData);
        
        // Clear existing grid and drawing
        if (this.gridLayer) {
            this.map.removeLayer(this.gridLayer);
            this.gridLayer = null;
        }
        if (this.drawnLayer) {
            this.map.removeLayer(this.drawnLayer);
            this.drawnLayer = null;
        }
        
        // Check if mission has grid data (raster)
        const hasGrid = missionData.grid_length && missionData.grid_height && missionData.field_size;
        const hasBounds = missionData.bounds_ne_lat && missionData.bounds_sw_lat;
        
        // If mission doesn't have grid, it's a no-raster mission
        if (!hasGrid) {
            // Mission without raster - just set the mission ID and center map
            this.currentMissionId = missionData.mission_id;
            this.currentMissionStatus = missionData.status || 'pending';
            
            // Center map on mission center if available
            if (missionData.center_lat && missionData.center_lng) {
                this.map.setView([missionData.center_lat, missionData.center_lng], 15);
            }
            
            // Show mission tools tab
            this.showMissionToolsTab();
            
            // Load icons for this mission
            this.loadIcons(missionData.mission_id);
            
            // Update share button visibility
            if (window.shareManager) {
                window.shareManager.updateShareButton();
            }
            
            // Enable and show start mission button if mission is pending
            const startBtn = document.getElementById('start-mission-btn');
            if (startBtn) {
                if (missionData.status === 'pending') {
                    startBtn.disabled = false;
                    startBtn.style.display = 'block';
                }
            }
            
            return; // Don't try to visualize grid
        }
        
        // Check if mission has bounds data (required for grid visualization)
        if (!hasBounds || !missionData.num_areas) {
            console.warn('Mission data incomplete, cannot visualize grid');
            return;
        }
        
        // Create bounds from mission data
        const bounds = L.latLngBounds(
            [missionData.bounds_sw_lat, missionData.bounds_sw_lng],
            [missionData.bounds_ne_lat, missionData.bounds_ne_lng]
        );
        
        // Recreate the shape based on shape_type
        const shapeType = missionData.shape_type || 'rectangle';
        
        if (shapeType === 'circle') {
            // Calculate center and radius for circle
            const center = bounds.getCenter();
            const radius = bounds.getNorthEast().distanceTo(center);
            
            const circle = L.circle(center, {
                radius: radius,
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.2,
                weight: 2
            });
            
            this.drawnLayer = circle.addTo(this.map);
        } else if (shapeType === 'ellipse') {
            // Create ellipse from bounds
            const ellipse = this.createEllipseFromBounds(bounds);
            this.drawnLayer = ellipse.addTo(this.map);
        } else {
            // Rectangle
            const rectangle = L.rectangle(bounds, {
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.2,
                weight: 2
            });
            
            this.drawnLayer = rectangle.addTo(this.map);
        }
        
        // Calculate grid dimensions based on num_areas
        // We need to approximate gridLength and gridHeight from num_areas
        // Use a simple approach: find factors that multiply to num_areas
        const numAreas = missionData.num_areas;
        let gridLength = Math.ceil(Math.sqrt(numAreas));
        let gridHeight = Math.ceil(numAreas / gridLength);
        
        // Ensure gridLength * gridHeight >= numAreas
        while (gridLength * gridHeight < numAreas) {
            gridLength++;
            gridHeight = Math.ceil(numAreas / gridLength);
        }
        
        // Store mission data first (needed for loadLegendData)
        this.currentMissionId = missionData.mission_id;
        const center = bounds.getCenter();
        this.shapeData = {
            type: shapeType,
            bounds: bounds,
            center: center
        };
        
        // Load legend data before visualizing grid (await to ensure it's loaded)
        await this.loadLegendData();
        
        // Visualize the grid
        this.visualizeGrid(bounds, gridLength, gridHeight);
        
        // Fit map to bounds
        this.map.fitBounds(bounds);
        
        // Render legend with loaded data (updateLegend is called by visualizeGrid, but we ensure it's called after loadLegendData)
        this.updateLegend();
    }
    
    /**
     * Load mission data into form fields and update UI state
     */
    loadMissionIntoForm(missionData) {
        // Populate form fields
        const missionIdInput = document.getElementById('mission_id');
        const numAreasInput = document.getElementById('num_areas');
        
        if (missionIdInput) {
            missionIdInput.value = missionData.mission_id || '';
        }
        if (numAreasInput) {
            const validAreas = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
            const n = parseInt(missionData.num_areas, 10) || 9;
            const chosen = validAreas.includes(n) ? n : validAreas.reduce((prev, curr) => Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev);
            numAreasInput.value = String(chosen);
        }
        
        // Check if mission has grid (raster)
        const hasGrid = missionData.grid_length && missionData.grid_height && missionData.field_size;
        
        // Update no-raster mode checkbox based on mission data
        const noRasterCheckbox = document.getElementById('no-raster-mode');
        if (noRasterCheckbox) {
            noRasterCheckbox.checked = !hasGrid;
            this.toggleNoRasterMode(!hasGrid);
        }
        
        // Update current mission ID and status
        this.currentMissionId = missionData.mission_id;
        this.missionActive = missionData.status === 'active';
        this.currentMissionStatus = missionData.status || null;
        
        // Update UI state based on mission status
        this.updateUIForMissionStatus(missionData.status);
        
        // Show mission tools tab whenever there's a mission (so users can place icons)
        // Icons can be placed on missions regardless of status
        if (this.currentMissionId) {
            this.showMissionToolsTab();
        } else {
            this.hideMissionToolsTab();
        }
        
        
        // Clear movement paths if toggle is on (will reload if still enabled)
        if (this.showMovement) {
            this.clearMovementPaths();
            // Reload movement paths for new mission
            this.loadIconMovements(missionData.mission_id);
        }
        
        // Update icon select dropdown
        this.updateIconMovementSelect();
        
        // Update share button visibility
        if (window.shareManager) {
            window.shareManager.updateShareButton();
        }
        
        // If mission is active, automatically start live updates
        if (this.missionActive && window.zeitstrahlManager) {
            // Wait a bit for the map to be ready
            const timeoutId1 = setTimeout(() => {
                // Show timeline if not already visible
                if (window.zeitstrahlManager) {
                    window.zeitstrahlManager.show();
                    // Enable live mode if not already enabled
                    if (!window.zeitstrahlManager.isLiveMode) {
                        window.zeitstrahlManager.toggleLiveMode();
                    }
                }
            }, 500);
            this.timeoutIds.push(timeoutId1);
        }
        
        // Switch to Mission Verwaltung tab
        if (window.sidebarManager) {
            window.sidebarManager.showTab('mission');
        }
    }
    
    /**
     * Reset form and clear all mission data to allow creating a new mission
     */
    resetForm() {
        // Clear form fields
        const missionIdInput = document.getElementById('mission_id');
        const numAreasInput = document.getElementById('num_areas');
        const fieldSizeInput = document.getElementById('field_size');
        
        if (missionIdInput) {
            missionIdInput.value = '';
            missionIdInput.disabled = false;
        }
        if (numAreasInput) {
            numAreasInput.value = '9';
            numAreasInput.disabled = false;
        }
        if (fieldSizeInput) {
            fieldSizeInput.value = '';
        }
        
        // Reset no-raster mode checkbox - do this early to restore UI elements
        const noRasterCheckbox = document.getElementById('no-raster-mode');
        if (noRasterCheckbox) {
            noRasterCheckbox.checked = false;
            // Force toggle to ensure all UI elements are properly shown/hidden
            this.toggleNoRasterMode(false);
        }
        
        // Ensure shape selection is visible (in case it was hidden)
        const shapeFormGroup = document.getElementById('shape-selection-group');
        if (shapeFormGroup) {
            shapeFormGroup.style.display = 'block';
        }
        
        // Ensure raster container is visible
        const rasterContainer = document.getElementById('raster-mode-container');
        if (rasterContainer) {
            rasterContainer.style.display = 'block';
        }
        
        // Reset grid mode to default (number of areas)
        const numAreasRadio = document.getElementById('grid-mode-num-areas');
        const numAreasContainer = document.getElementById('num-areas-container');
        const fieldSizeContainer = document.getElementById('field-size-container');
        if (numAreasRadio) {
            numAreasRadio.checked = true;
            if (numAreasContainer) numAreasContainer.style.display = 'block';
            if (fieldSizeContainer) fieldSizeContainer.style.display = 'none';
            if (numAreasInput) numAreasInput.required = true;
            if (fieldSizeInput) fieldSizeInput.required = false;
        }
        
        // Clear mission state first
        this.currentMissionId = null;
        this.missionActive = false;
        this.currentMissionStatus = null;
        
        // Reset buttons
        const generateBtn = document.getElementById('generate-grid-btn');
        const createNoRasterBtn = document.getElementById('create-mission-no-raster-btn');
        const startBtn = document.getElementById('start-mission-btn');
        const stopBtn = document.getElementById('stop-mission-btn');
        const clearBtn = document.getElementById('clear-drawing-btn');
        const shapeButtons = document.querySelectorAll('.btn-shape');
        
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.style.display = 'block';
        }
        if (createNoRasterBtn) {
            createNoRasterBtn.disabled = true;
            createNoRasterBtn.style.display = 'none';
        }
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.style.display = 'block';
        }
        if (stopBtn) {
            stopBtn.style.display = 'none';
            stopBtn.disabled = false;
        }
        if (clearBtn) {
            clearBtn.disabled = false;
            clearBtn.style.display = 'none'; // Hidden by default, shown when drawing exists
        }
        shapeButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('active');
        });
        // Set rectangle as active by default
        const rectangleBtn = document.querySelector('[data-shape="rectangle"]');
        if (rectangleBtn) {
            rectangleBtn.classList.add('active');
        }
        this.currentShape = 'rectangle';
        
        // Hide mission tools tab
        this.hideMissionToolsTab();
        
        // Clear drawing and grid
        this.clearDrawing();
        
        // Explicitly clear legend data and UI
        this.legendData = {};
        this.legendEditing = false;
        
        // Clear sidebar legend
        const legendItems = document.getElementById('legend-items');
        if (legendItems) {
            legendItems.textContent = '';
        }
        
        // Clear map legend (right side)
        const mapLegend = document.getElementById('map-legend');
        const mapLegendItems = document.getElementById('map-legend-items');
        if (mapLegend) {
            mapLegend.style.display = 'none';
        }
        if (mapLegendItems) {
            mapLegendItems.textContent = '';
        }
        
        // Reset legend edit button
        const editLegendBtn = document.getElementById('edit-legend-btn');
        if (editLegendBtn) {
            editLegendBtn.textContent = 'Legende bearbeiten';
        }
        
        // Reinitialize drawing tools
        this.initDrawing();
        
        // Restore Mission ID input (missionIdInput already declared above)
        const missionIdDisplay = document.getElementById('mission_id_display');
        if (missionIdInput) {
            missionIdInput.style.display = 'block';
            missionIdInput.disabled = false;
        }
        if (missionIdDisplay) {
            missionIdDisplay.style.display = 'none';
        }
        
        // Restore Anzahl Bereiche input (numAreasInput already declared above)
        const numAreasDisplay = document.getElementById('num_areas_display');
        if (numAreasInput) {
            numAreasInput.style.display = 'block';
            numAreasInput.disabled = false;
        }
        if (numAreasDisplay) {
            numAreasDisplay.style.display = 'none';
        }
        
        // Enable grid mode radio buttons
        const gridModeRadios = document.querySelectorAll('input[name="grid-mode"]');
        gridModeRadios.forEach(radio => {
            radio.disabled = false;
            const label = radio.closest('label');
            if (label) {
                label.style.cursor = 'pointer';
                label.style.opacity = '1';
            }
        });
        
        // Clear drone tracker
        if (this.droneTracker) {
            this.droneTracker.setMissionId(null);
        }
        
        // Clear movement paths
        this.clearMovementPaths();
        
        // Clear icons - remove all tracked icons
        Object.values(this.mapIcons).forEach(icon => {
            if (icon && this.map.hasLayer(icon)) {
                this.map.removeLayer(icon);
            }
        });
        this.mapIcons = {};
        
        // Also remove any icon markers that might not be tracked (safety measure)
        // Iterate through all layers and remove any markers with map-icon-marker class
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                const icon = layer.options?.icon;
                if (icon && icon.options && icon.options.className && 
                    icon.options.className.includes('map-icon-marker')) {
                    this.map.removeLayer(layer);
                }
            }
        });
        
        // Hide and clear timeline
        if (window.zeitstrahlManager) {
            window.zeitstrahlManager.hide();
            // Clear timeline mission data
            window.zeitstrahlManager.currentMissionId = null;
            window.zeitstrahlManager.currentMission = null;
            window.zeitstrahlManager.timePositions = [];
            window.zeitstrahlManager.currentTimeIndex = 0;
            window.zeitstrahlManager.startTime = null;
            // Hide timeline open button
            const zeitstrahlOpenBtn = document.getElementById('zeitstrahl-open-btn');
            if (zeitstrahlOpenBtn) {
                zeitstrahlOpenBtn.style.display = 'none';
            }
        }
        
        if (this.droneTracker) {
            this.droneTracker.stop();
            if (this.droneTracker.isConnected !== undefined) this.droneTracker.isConnected = false;
        }
        this.hideApiConnectionWarning();
        
        this.showStatus('Formular zurückgesetzt. Sie können jetzt eine neue Mission erstellen.', 'info');
    }
    
    /**
     * Update UI elements based on mission status
     */
    updateUIForMissionStatus(status) {
        const startBtn = document.getElementById('start-mission-btn');
        const stopBtn = document.getElementById('stop-mission-btn');
        const generateBtn = document.getElementById('generate-grid-btn');
        const missionIdInput = document.getElementById('mission_id');
        const missionIdDisplay = document.getElementById('mission_id_display');
        const numAreasInput = document.getElementById('num_areas');
        const numAreasDisplay = document.getElementById('num_areas_display');
        const clearBtn = document.getElementById('clear-drawing-btn');
        const shapeButtons = document.querySelectorAll('.btn-shape');
        const gridModeRadios = document.querySelectorAll('input[name="grid-mode"]');
        
        // Store current status
        this.currentMissionStatus = status;
        
        if (status === 'active' || status === 'completed') {
            // Mission is active or completed - show stop button for active, hide for completed
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) {
                stopBtn.style.display = status === 'active' ? 'block' : 'none';
                if (status === 'active') stopBtn.disabled = false;
            }
            if (generateBtn) generateBtn.disabled = true;
            
            // Mission ID: Hide input, show as text
            if (missionIdInput) {
                missionIdInput.style.display = 'none';
                missionIdInput.disabled = true;
            }
            if (missionIdDisplay && missionIdInput) {
                missionIdDisplay.textContent = missionIdInput.value || this.currentMissionId || '';
                missionIdDisplay.style.display = 'block';
            }
            
            // Anzahl Bereiche: Hide input, show as text
            if (numAreasInput) {
                numAreasInput.style.display = 'none';
                numAreasInput.disabled = true;
            }
            if (numAreasDisplay && numAreasInput) {
                numAreasDisplay.textContent = numAreasInput.value || '';
                numAreasDisplay.style.display = 'block';
            }
            
            // Disable grid mode radio buttons (Raster-Modus)
            gridModeRadios.forEach(radio => {
                radio.disabled = true;
                // Also disable parent label styling
                const label = radio.closest('label');
                if (label) {
                    label.style.cursor = 'not-allowed';
                    label.style.opacity = '0.6';
                }
            });
            
            if (clearBtn) clearBtn.disabled = true;
            shapeButtons.forEach(btn => btn.disabled = true);
            
            // Disable drawing controls
            this.disableDrawingControls();
            
            // Set drone tracker to this mission if active
            if (status === 'active' && this.droneTracker) {
                this.droneTracker.setMissionId(this.currentMissionId);
            }
        } else {
            // Mission is pending - show start button, hide stop button, enable drawing
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';
            if (generateBtn) generateBtn.disabled = false;
            
            // Mission ID: Show input, hide display
            if (missionIdInput) {
                missionIdInput.style.display = 'block';
                missionIdInput.disabled = false;
            }
            if (missionIdDisplay) {
                missionIdDisplay.style.display = 'none';
            }
            
            // Anzahl Bereiche: Show input, hide display
            if (numAreasInput) {
                numAreasInput.style.display = 'block';
                numAreasInput.disabled = false;
            }
            if (numAreasDisplay) {
                numAreasDisplay.style.display = 'none';
            }
            
            // Enable grid mode radio buttons (Raster-Modus)
            gridModeRadios.forEach(radio => {
                radio.disabled = false;
                const label = radio.closest('label');
                if (label) {
                    label.style.cursor = 'pointer';
                    label.style.opacity = '1';
                }
            });
            
            if (clearBtn) clearBtn.disabled = false;
            shapeButtons.forEach(btn => btn.disabled = false);
            
            // Enable drawing controls (if not already initialized)
            this.enableDrawingControls();
            
            // Clear drone tracker mission ID if not active
            if (this.droneTracker && !this.missionActive) {
                this.droneTracker.setMissionId(null);
            }
        }
    }
    
    disableDrawingControls() {
        // Remove draw control from map
        if (this.drawControl) {
            try {
                this.map.removeControl(this.drawControl);
            } catch (e) {
                console.warn('Error removing draw control:', e);
            }
        }
    }
    
    enableDrawingControls() {
        // Only reinitialize drawing if we don't have a draw control and mission is pending
        if (!this.drawControl && this.currentMissionStatus === 'pending') {
            // Draw control will be initialized when user draws a shape
            // initDrawing() is called automatically when needed
        }
    }
    
    /**
     * Show mission tools tab (only visible when mission is active)
     */
    showMissionToolsTab() {
        const toolsTab = document.querySelector('.sidebar-tab[data-tab="mission-tools"]');
        const toolsTabContent = document.getElementById('tab-mission-tools');
        
        if (toolsTab) {
            toolsTab.style.display = 'flex';
        }
        if (toolsTabContent) {
            // Remove inline display style to let CSS classes handle visibility
            toolsTabContent.style.display = '';
        }
        
        // Ensure sidebar is open and switch to mission tools tab (make it default)
        if (window.sidebarManager) {
            // Open sidebar if collapsed
            if (window.sidebarManager.isCollapsed) {
                window.sidebarManager.toggleSidebar();
            }
            // Switch to mission tools tab (this will be the default when mission is active)
            // Only switch if tab is visible
            if (toolsTab && toolsTab.style.display !== 'none') {
                window.sidebarManager.showTab('mission-tools');
            }
        }
    }
    
    /**
     * Hide mission tools tab
     */
    hideMissionToolsTab() {
        const toolsTab = document.querySelector('.sidebar-tab[data-tab="mission-tools"]');
        const toolsTabContent = document.getElementById('tab-mission-tools');
        
        if (toolsTab) {
            toolsTab.style.display = 'none';
            toolsTab.classList.remove('active');
        }
        if (toolsTabContent) {
            toolsTabContent.style.display = 'none';
            toolsTabContent.classList.remove('active');
        }
        
        // If mission tools tab was active, switch back to mission tab
        if (window.sidebarManager && window.sidebarManager.currentTab === 'mission-tools') {
            window.sidebarManager.showTab('mission');
        }
    }
    
    /**
     * Log icon placement to file
     * @param {string} functionName - Name of the function that placed the icon
     * @param {Object} iconInfo - Icon information (icon_id, icon_type, latitude, longitude, label_text)
     */
    async logIconPlacement(functionName, iconInfo) {
        if (!this.currentMissionId) {
            return; // Don't log if no mission is active
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'log_icon_placement');
            formData.append('mission_id', this.currentMissionId);
            formData.append('function_name', functionName);
            
            if (iconInfo.icon_id !== undefined && iconInfo.icon_id !== null) {
                formData.append('icon_id', iconInfo.icon_id);
            }
            if (iconInfo.icon_type) {
                formData.append('icon_type', iconInfo.icon_type);
            }
            if (iconInfo.latitude !== undefined && iconInfo.latitude !== null) {
                formData.append('latitude', iconInfo.latitude);
            }
            if (iconInfo.longitude !== undefined && iconInfo.longitude !== null) {
                formData.append('longitude', iconInfo.longitude);
            }
            if (iconInfo.label_text !== undefined) {
                formData.append('label_text', iconInfo.label_text || '');
            }
            
            // Fire and forget - don't wait for response
            safeFetch('api/log_icon.php', {
                method: 'POST',
                body: formData
            }).catch(error => {
                console.warn('Failed to log icon placement:', error);
            });
        } catch (error) {
            console.warn('Error logging icon placement:', error);
        }
    }
    
    /**
     * Log drone placement to file
     * @param {string} functionName - Name of the function that placed the drone
     * @param {Object} droneInfo - Drone information (drone_id, drone_name, latitude, longitude, height, battery)
     */
    async logDronePlacement(functionName, droneInfo) {
        if (!this.currentMissionId) {
            return; // Don't log if no mission is active
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'log_drone_placement');
            formData.append('mission_id', this.currentMissionId);
            formData.append('function_name', functionName);
            
            if (droneInfo.drone_id !== undefined && droneInfo.drone_id !== null) {
                formData.append('drone_id', droneInfo.drone_id);
            }
            if (droneInfo.drone_name) {
                formData.append('drone_name', droneInfo.drone_name);
            }
            if (droneInfo.latitude !== undefined && droneInfo.latitude !== null) {
                formData.append('latitude', droneInfo.latitude);
            }
            if (droneInfo.longitude !== undefined && droneInfo.longitude !== null) {
                formData.append('longitude', droneInfo.longitude);
            }
            if (droneInfo.height !== undefined && droneInfo.height !== null) {
                formData.append('height', droneInfo.height);
            }
            if (droneInfo.battery !== undefined && droneInfo.battery !== null) {
                formData.append('battery', droneInfo.battery);
            }
            
            // Fire and forget - don't wait for response
            fetch('api/log_icon.php', {
                method: 'POST',
                body: formData
            }).catch(error => {
                console.warn('Failed to log drone placement:', error);
            });
        } catch (error) {
            console.warn('Error logging drone placement:', error);
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
        // Remove existing grid if any
        if (this.gridLayer) {
            this.map.removeLayer(this.gridLayer);
        }
        
        // Clear existing cells
        this.gridCells = [];
        
        // Create a new layer group for grid
        this.gridLayer = L.layerGroup().addTo(this.map);
        
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        // Calculate cell dimensions
        const latStep = (ne.lat - sw.lat) / gridHeight;
        const lngStep = (ne.lng - sw.lng) / gridLength;
        
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
        
        // Draw grid lines
        for (let i = 0; i <= gridHeight; i++) {
            const lat = sw.lat + (i * latStep);
            const line = L.polyline([
                [lat, sw.lng],
                [lat, ne.lng]
            ], {
                color: '#667eea',
                weight: 1,
                opacity: 0.6,
                dashArray: '5, 5'
            });
            this.gridLayer.addLayer(line);
        }
        
        for (let j = 0; j <= gridLength; j++) {
            const lng = sw.lng + (j * lngStep);
            const line = L.polyline([
                [sw.lat, lng],
                [ne.lat, lng]
            ], {
                color: '#667eea',
                weight: 1,
                opacity: 0.6,
                dashArray: '5, 5'
            });
            this.gridLayer.addLayer(line);
        }
        
        // Create colored cells
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
                    fillOpacity: 0.4,
                    weight: 1
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
                            // getLabelContent() already escapes user content, but we'll use safer DOM manipulation
                            const content = getLabelContent();
                            // Since content may contain HTML (<br>, <span>), we need innerHTML
                            // but getLabelContent() already escapes user input via this.escapeHtml()
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
                
                // Create check icon marker (initially hidden)
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
                
                // Click handler to toggle done status (Ctrl+Click required to avoid accidental marks when moving icons)
                cellPolygon.on('click', (e) => {
                    if (!(e.originalEvent && e.originalEvent.ctrlKey)) {
                        return;
                    }
                    // Don't toggle if icon placement is active
                    if (this.selectedIconType) {
                        return;
                    }
                    
                    // Ensure doneFields is an object, not an array
                    if (Array.isArray(this.doneFields)) {
                        console.warn(`[DoneFields] doneFields was an array, converting to object`);
                        const tempObj = {};
                        this.doneFields.forEach((value, index) => {
                            if (value !== null && value !== undefined) {
                                tempObj[index + 1] = value; // cellNumber is 1-indexed
                            }
                        });
                        this.doneFields = tempObj;
                    }
                    if (!this.doneFields || typeof this.doneFields !== 'object' || Array.isArray(this.doneFields)) {
                        this.doneFields = {};
                    }
                    
                    // Toggle done status with timestamp
                    const currentStatus = this.doneFields[cellNumber];
                    // Handle both old format (boolean) and new format (object)
                    const isDone = (typeof currentStatus === 'object' && currentStatus?.done === true) || currentStatus === true || false;
                    
                    console.log(`[DoneFields] Toggling field ${cellNumber}, currentStatus:`, currentStatus, 'isDone:', isDone);
                    
                    const now = new Date();
                    const timestamp = now.toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:mm:ss
                    
                    if (!isDone) {
                        // Mark as done with timestamp
                        this.doneFields[cellNumber] = { done: true, timestamp: timestamp };
                        console.log(`[DoneFields] Marked field ${cellNumber} as done with timestamp:`, timestamp);
                        console.log(`[DoneFields] doneFields is array:`, Array.isArray(this.doneFields), 'doneFields:', this.doneFields);
                    } else {
                        // Mark as not done (remove entry or set to false)
                        delete this.doneFields[cellNumber];
                        console.log(`[DoneFields] Marked field ${cellNumber} as not done, removed from doneFields`);
                    }
                    
                    // Update cell background color (black for done fields, original color otherwise)
                    const cell = this.gridCells.find(c => c.number === cellNumber);
                    if (cell) {
                        const fieldStatus = this.doneFields[cellNumber];
                        const isDone = (typeof fieldStatus === 'object' && fieldStatus?.done === true) || fieldStatus === true;
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
                    
                    // Show/hide check icon
                    const checkDiv = checkIcon.getElement();
                    if (checkDiv) {
                        const innerDiv = checkDiv.querySelector('div');
                        if (innerDiv) {
                            const fieldStatus = this.doneFields[cellNumber];
                            const isDone = (typeof fieldStatus === 'object' && fieldStatus?.done === true) || fieldStatus === true;
                            innerDiv.style.display = isDone ? 'block' : 'none';
                        }
                    }
                    
                    // Save done status to database
                    this.saveDoneFields();
                    
                    // Update progress
                    this.updateProgress();
                    
                    // Prevent map click event propagation
                    L.DomEvent.stopPropagation(e);
                });
                
                // Initialize check icon visibility and background color based on loaded done status
                // Note: We need to set display after marker is added to map
                const timeoutId2 = setTimeout(() => {
                    const fieldStatus = this.doneFields[cellNumber];
                    const isDone = (typeof fieldStatus === 'object' && fieldStatus?.done === true) || fieldStatus === true;
                    if (isDone) {
                        // Update background color to black for done fields
                        cellPolygon.setStyle({
                            fillColor: '#000000',
                            fillOpacity: 0.5
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
                this.timeoutIds.push(timeoutId2);
                
                this.gridLayer.addLayer(cellPolygon);
                this.gridLayer.addLayer(cellLabel);
                this.gridLayer.addLayer(checkIcon);
                
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
                
                // Initialize legend data (use cellNumber for backward compatibility)
                if (this.legendData[cellNumber] === undefined) {
                    this.legendData[cellNumber] = '';
                }
            }
        }
        
        // Show legend panel
        this.showLegendPanel();
        this.updateLegend();
    }
    
    showLegendPanel() {
        // Show legend tab in sidebar
        if (window.sidebarManager && this.gridCells.length > 0) {
            window.sidebarManager.showTab('legend');
        }
    }
    
    hideLegendPanel() {
        // Switch to mission tab
        if (window.sidebarManager) {
            window.sidebarManager.showTab('mission');
        }
    }
    
    updateLegend() {
        // Update progress first
        this.updateProgress();
        
        // Update sidebar legend
        const legendItems = document.getElementById('legend-items');
        const searchInput = document.getElementById('legend-search-input');
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        if (legendItems) {
            legendItems.textContent = '';
            
            this.gridCells.forEach(cell => {
                // Get cell ID (Excel style like A1, B2) and text
                const cellId = cell.id || cell.number.toString();
                const cellText = (this.legendData[cell.number] || '').toLowerCase();
                
                // Filter based on search query (matches field ID or text)
                if (searchQuery && !cellId.toLowerCase().includes(searchQuery) && !cellText.includes(searchQuery)) {
                    return; // Skip this cell if it doesn't match search
                }
                
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.dataset.cellNumber = cell.number;
                item.dataset.cellId = cellId;
                
                // Use black background if field is done
                const isDone = this.doneFields[cell.number] || false;
                const bgColor = isDone ? '#000000' : cell.color;
                
                const colorDiv = document.createElement('div');
                colorDiv.className = 'legend-color';
                colorDiv.style.backgroundColor = bgColor;
                
                const numberSpan = document.createElement('span');
                numberSpan.className = 'legend-item-number';
                numberSpan.textContent = cellId + ':';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'legend-item-input';
                input.value = this.legendData[cell.number] || '';
                input.placeholder = 'Beschreibung...';
                input.disabled = !this.legendEditing;
                
                // Save on input (as user types) and on blur (when field loses focus)
                input.addEventListener('input', (e) => {
                    this.legendData[cell.number] = e.target.value;
                    this.saveLegendData();
                    // Also update map legend
                    this.updateMapLegend();
                    // Re-filter legend if search is active
                    if (searchQuery) {
                        this.filterLegend(searchQuery);
                    }
                });
                
                input.addEventListener('blur', (e) => {
                    // Also save on blur to ensure data is saved even if input event didn't fire
                    this.legendData[cell.number] = e.target.value;
                    this.saveLegendData();
                    // Also update map legend
                    this.updateMapLegend();
                    // Re-filter legend if search is active
                    if (searchQuery) {
                        this.filterLegend(searchQuery);
                    }
                });
                
                item.appendChild(colorDiv);
                item.appendChild(numberSpan);
                item.appendChild(input);
                legendItems.appendChild(item);
            });
        }
        
        // Update map legend (right side)
        this.updateMapLegend();
    }
    
    filterLegend(searchQuery) {
        // Simply re-render the legend with the search query
        this.updateLegend();
    }
    
    updateMapLegend() {
        const mapLegend = document.getElementById('map-legend');
        const mapLegendItems = document.getElementById('map-legend-items');
        
        if (!mapLegend || !mapLegendItems) return;
        
        // Filter cells to only show those with text
        const cellsWithText = this.gridCells.filter(cell => {
            const text = this.legendData[cell.number];
            return text && text.trim().length > 0;
        });
        
        if (cellsWithText.length === 0) {
            mapLegend.style.display = 'none';
            return;
        }
        
        // Show legend and populate items
        mapLegend.style.display = 'block';
        mapLegendItems.textContent = '';
        
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
        
        // Update share button visibility
        if (window.shareManager) {
            window.shareManager.updateShareButton();
        }
    }
    
    toggleLegendEdit() {
        this.legendEditing = !this.legendEditing;
        const btn = document.getElementById('edit-legend-btn');
        const inputs = document.querySelectorAll('.legend-item-input');
        
        if (this.legendEditing) {
            btn.textContent = 'Speichern';
            inputs.forEach(input => input.disabled = false);
        } else {
            btn.textContent = 'Legende bearbeiten';
            inputs.forEach(input => input.disabled = true);
            this.saveLegendData();
        }
    }
    
    async saveLegendData() {
        // Store legend data in database and localStorage for this mission
        if (this.currentMissionId) {
            const legendJson = JSON.stringify(this.legendData);
            
            // Save to localStorage (for offline/backup)
            try {
                localStorage.setItem(`legend_${this.currentMissionId}`, legendJson);
                console.log('Saved legend data to localStorage for mission:', this.currentMissionId);
            } catch (e) {
                console.error('Error saving legend data to localStorage:', e);
            }
            
            // Save to database
            try {
                const formData = new FormData();
                formData.append('action', 'save_legend');
                formData.append('mission_id', this.currentMissionId);
                formData.append('legend_data', legendJson);
                
                const response = await fetch('api/mission.php', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                if (data.success) {
                    console.log('Saved legend data to database for mission:', this.currentMissionId, this.legendData);
                } else {
                    console.error('Error saving legend data to database:', data.error);
                }
            } catch (e) {
                console.error('Error saving legend data to database:', e);
            }
        } else {
            console.warn('Cannot save legend data: no currentMissionId');
        }
    }
    
    async saveDoneFields() {
        // Store done fields status in database
        if (this.currentMissionId) {
            // Ensure doneFields is an object, not an array
            // Convert array to object if needed (handle backward compatibility)
            let doneFieldsToSave = {};
            if (Array.isArray(this.doneFields)) {
                console.log(`[DoneFields] Converting array format to object format before saving`);
                this.doneFields.forEach((value, index) => {
                    if (value !== null && value !== undefined) {
                        // cellNumber is 1-indexed, array is 0-indexed
                        const cellNumber = index + 1;
                        doneFieldsToSave[cellNumber] = value;
                    }
                });
                // Update this.doneFields to object format for future use
                this.doneFields = doneFieldsToSave;
            } else {
                // Filter out null/undefined values
                Object.keys(this.doneFields).forEach(key => {
                    if (this.doneFields[key] !== null && this.doneFields[key] !== undefined) {
                        doneFieldsToSave[key] = this.doneFields[key];
                    }
                });
            }
            
            const doneFieldsJson = JSON.stringify(doneFieldsToSave);
            console.log(`[DoneFields] Saving done fields for mission ${this.currentMissionId}:`, doneFieldsToSave);
            console.log(`[DoneFields] JSON to save:`, doneFieldsJson);
            
            try {
                const formData = new FormData();
                formData.append('action', 'save_done_fields');
                formData.append('mission_id', this.currentMissionId);
                formData.append('done_fields', doneFieldsJson);
                
                console.log(`[DoneFields] Sending to API: mission_id=${this.currentMissionId}, JSON length=${doneFieldsJson.length}`);
                
                console.log(`[DoneFields] Sending to API: mission_id=${this.currentMissionId}, done_fields length=${doneFieldsJson.length}`);
                
                const response = await fetch('api/mission.php', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                if (data.success) {
                    console.log(`[DoneFields] Successfully saved done fields for mission ${this.currentMissionId}`);
                } else {
                    console.error('[DoneFields] Failed to save done fields:', data.error);
                }
            } catch (error) {
                console.error('[DoneFields] Error saving done fields:', error);
            }
        } else {
            console.warn('[DoneFields] Cannot save done fields: no currentMissionId');
        }
    }
    
    async loadDoneFields() {
        // Load done fields status from database
        // Handles both old format (boolean) and new format (object with timestamp)
        if (this.currentMissionId) {
            console.log(`[DoneFields] Loading done fields for mission ${this.currentMissionId}`);
            try {
                const response = await safeFetch(`api/mission.php?mission_id=${encodeURIComponent(this.currentMissionId)}`);
                const data = await response.json();
                
                console.log(`[DoneFields] API response:`, data);
                
                if (data.success && data.mission) {
                    console.log(`[DoneFields] Mission data received, done_fields_parsed:`, data.mission.done_fields_parsed);
                    if (data.mission.done_fields_parsed) {
                        const loadedData = data.mission.done_fields_parsed;
                        // Convert array to object if needed (handle backward compatibility)
                        if (Array.isArray(loadedData)) {
                            console.log(`[DoneFields] Converting array format to object format`);
                            this.doneFields = {};
                            loadedData.forEach((value, index) => {
                                if (value !== null && value !== undefined) {
                                    // cellNumber is 1-indexed, array is 0-indexed
                                    const cellNumber = index + 1;
                                    this.doneFields[cellNumber] = value;
                                }
                            });
                            console.log(`[DoneFields] Converted array to object:`, this.doneFields);
                        } else {
                            this.doneFields = loadedData || {};
                            console.log(`[DoneFields] Loaded done fields as object:`, this.doneFields);
                        }
                    } else {
                        this.doneFields = {};
                        console.log(`[DoneFields] No done_fields_parsed in mission data, using empty object`);
                    }
                } else {
                    this.doneFields = {};
                    console.warn(`[DoneFields] API request not successful or no mission data, using empty object`);
                }
                
                // Update progress after loading
                this.updateProgress();
            } catch (error) {
                console.error('[DoneFields] Error loading done fields:', error);
                this.doneFields = {};
                // Update progress even on error (will show 0)
                this.updateProgress();
            }
        } else {
            console.warn('[DoneFields] Cannot load done fields: no currentMissionId');
        }
    }
    
    updateProgress() {
        const progressSection = document.getElementById('legend-progress-section');
        const progressBar = document.getElementById('legend-progress-bar');
        const progressText = document.getElementById('legend-progress-text');
        const progressLabel = document.getElementById('legend-progress-label');
        
        if (!progressSection || !progressBar || !progressText || !progressLabel) {
            return;
        }
        
        // Calculate progress
        const totalFields = this.gridCells.length;
        // Count done fields (handle both old boolean format and new object format)
        const doneFields = Object.values(this.doneFields).filter(status => {
            return (typeof status === 'object' && status?.done === true) || status === true;
        }).length;
        
        // Show/hide progress section based on whether we have fields
        if (totalFields > 0) {
            progressSection.style.display = 'block';
            
            const percentage = totalFields > 0 ? (doneFields / totalFields) * 100 : 0;
            
            // Update progress bar
            progressBar.style.width = `${percentage}%`;
            
            // Update text
            progressText.textContent = `${doneFields} / ${totalFields}`;
            
            // Update label (singular/plural)
            if (doneFields === 1) {
                progressLabel.textContent = 'Feld erledigt';
            } else {
                progressLabel.textContent = 'Felder erledigt';
            }
        } else {
            progressSection.style.display = 'none';
        }
    }
    
    async loadLegendData() {
        if (this.currentMissionId) {
            // Load done fields as well
            await this.loadDoneFields();
            
            // First try to load from database
            try {
                const response = await safeFetch(`api/mission.php?mission_id=${encodeURIComponent(this.currentMissionId)}`);
                const data = await response.json();
                
                if (data.success && data.mission && data.mission.legend_data_parsed) {
                    // Load from database
                    const loaded = data.mission.legend_data_parsed;
                    // Merge loaded data with existing (don't overwrite if already set)
                    this.legendData = { ...this.legendData, ...loaded };
                    console.log('Loaded legend data from database for mission:', this.currentMissionId, this.legendData);
                    
                    // Also update localStorage with database data
                    try {
                        localStorage.setItem(`legend_${this.currentMissionId}`, JSON.stringify(this.legendData));
                    } catch (e) {
                        console.warn('Could not update localStorage:', e);
                    }
                    return;
                }
            } catch (e) {
                console.warn('Error loading legend data from database:', e);
            }
            
            // Fallback to localStorage
            const saved = localStorage.getItem(`legend_${this.currentMissionId}`);
            if (saved) {
                try {
                    const loaded = JSON.parse(saved);
                    // Merge loaded data with existing (don't overwrite if already set)
                    this.legendData = { ...this.legendData, ...loaded };
                    console.log('Loaded legend data from localStorage for mission:', this.currentMissionId, this.legendData);
                } catch (e) {
                    console.error('Error loading legend data from localStorage:', e);
                    this.legendData = {};
                }
            } else {
                console.log('No saved legend data found for mission:', this.currentMissionId);
            }
        } else {
            console.warn('Cannot load legend data: no currentMissionId');
        }
    }
    
    /**
     * Show PDF export dialog
     */
    /**
     * Print map using browser print dialog
     */
    printMap() {
        // Check if icons should be hidden
        const hideIconsCheckbox = document.getElementById('hide-icons-print');
        const hideIcons = hideIconsCheckbox ? hideIconsCheckbox.checked : false;
        
        // Add print class to body to trigger print styles
        document.body.classList.add('printing');
        if (hideIcons) {
            document.body.classList.add('hide-icons-print');
        }
        
        // Trigger print dialog
        window.print();
        
        // Remove print class after print dialog closes
        const timeoutId3 = setTimeout(() => {
            document.body.classList.remove('printing', 'hide-icons-print');
        }, 1000);
        this.timeoutIds.push(timeoutId3);
    }
    
    // Panel toggle is now handled by sidebar
    
    showStatus(message, type) {
        const statusDiv = document.getElementById('mission-status');
        statusDiv.textContent = message;
        statusDiv.className = 'mission-status ' + type;
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            const timeoutId = setTimeout(() => {
                statusDiv.className = 'mission-status';
                statusDiv.textContent = '';
            }, 5000);
            this.timeoutIds.push(timeoutId);
        }
    }
    
    /**
     * Cancel icon placement mode (e.g. when switching timeline to history mode).
     */
    cancelIconPlacementMode() {
        if (!this.selectedIconType) return;
        this.selectedIconType = null;
        document.querySelectorAll('.icon-type-btn').forEach(btn => btn.classList.remove('active'));
        this.map.getContainer().style.cursor = '';
    }
    
    selectIconType(iconType) {
        console.log('selectIconType called', iconType);
        
        // Disable icon type selection when timeline is in history mode
        if (window.zeitstrahlManager && !window.zeitstrahlManager.isLiveMode) {
            this.showStatus('Icon-Platzierung im Historienmodus deaktiviert. Wechseln Sie zu Live.', 'error');
            return;
        }
        
        // Update button states
        document.querySelectorAll('.icon-type-btn').forEach(btn => {
            if (btn.dataset.iconType === iconType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.selectedIconType = iconType;
        
        // Change cursor to indicate icon placement mode
        this.map.getContainer().style.cursor = 'crosshair';
        
        // Disable drawing temporarily when placing icons
        if (this.drawControl) {
            // Disable the draw control
            try {
                this.map.removeControl(this.drawControl);
                this.drawControl = null;
            } catch (e) {
                console.warn('Error disabling draw control:', e);
            }
        }
    }
    
    async placeIcon(latlng, iconType) {
        console.log('placeIcon called', latlng, iconType, 'currentMissionId:', this.currentMissionId);
        
        if (!this.currentMissionId) {
            this.showStatus('Bitte erstellen Sie zuerst eine Mission.', 'error');
            // Reset icon selection
            this.selectedIconType = null;
            document.querySelectorAll('.icon-type-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.map.getContainer().style.cursor = '';
            return;
        }
        
        if (window.zeitstrahlManager && !window.zeitstrahlManager.isLiveMode) {
            this.showStatus('Icon-Platzierung im Historienmodus deaktiviert. Wechseln Sie zu Live.', 'error');
            this.selectedIconType = null;
            document.querySelectorAll('.icon-type-btn').forEach(btn => btn.classList.remove('active'));
            this.map.getContainer().style.cursor = '';
            return;
        }
        
        // Create icon on map
        const icon = this.createIconMarker(latlng, iconType, '');
        const iconId = Date.now().toString();
        this.mapIcons[iconId] = icon;
        
        // Save to database
        try {
            const formData = new FormData();
            formData.append('action', 'create_icon');
            formData.append('mission_id', this.currentMissionId);
            formData.append('icon_type', iconType);
            formData.append('latitude', latlng.lat);
            formData.append('longitude', latlng.lng);
            formData.append('label_text', '');
            
            const response = await safeFetch('api/map_icons.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update icon with real ID from database
                icon.iconId = data.icon_id;
                
                // Remove temporary entry and add with real ID
                if (this.mapIcons[iconId] && this.mapIcons[iconId] === icon) {
                    delete this.mapIcons[iconId];
                }
                this.mapIcons[data.icon_id] = icon;
                
                // Ensure icon is still on the map (should be, but double-check)
                if (!this.map.hasLayer(icon)) {
                    icon.addTo(this.map);
                }
                
                // Log icon placement
                this.logIconPlacement('placeIcon', {
                    icon_id: data.icon_id,
                    icon_type: iconType,
                    latitude: latlng.lat,
                    longitude: latlng.lng,
                    label_text: ''
                });
                
                this.showStatus('Icon erfolgreich gespeichert.', 'success');
                
                // Update icon movement select if movement is enabled
                if (this.showMovement) {
                    this.updateIconMovementSelect();
                }
                
                // Reload timeline to show icon positions
                // Add a small delay to ensure database is updated
                if (window.zeitstrahlManager && this.currentMissionId) {
                    setTimeout(async () => {
                        try {
                            // Get current mission data with cache busting
                            const cacheBuster = Date.now();
                            const missionResponse = await safeFetch(`api/mission.php?mission_id=${encodeURIComponent(this.currentMissionId)}&_t=${cacheBuster}`);
                            const missionDataResponse = await missionResponse.json();
                            
                            if (missionDataResponse.success && missionDataResponse.mission) {
                                // Use fresh mission data and reload timeline
                                await window.zeitstrahlManager.loadMission(this.currentMissionId, missionDataResponse.mission);
                            } else {
                                // Fallback to existing mission data
                                const missionData = window.zeitstrahlManager.currentMission || {
                                    mission_id: this.currentMissionId,
                                    status: this.currentMissionStatus || 'pending'
                                };
                                // Force reload with cache busting
                                await window.zeitstrahlManager.loadMission(this.currentMissionId, missionData);
                            }
                        } catch (error) {
                            console.error('Error reloading timeline after icon placement:', error);
                        }
                    }, 500); // 500ms delay to ensure database write is complete
                }
            } else {
                const errorMsg = data.error || 'Unbekannter Fehler';
                console.error('Error saving icon:', errorMsg);
                this.showStatus('Fehler beim Speichern des Icons: ' + errorMsg, 'error');
                this.map.removeLayer(icon);
                delete this.mapIcons[iconId];
            }
        } catch (error) {
            console.error('Error saving icon:', error);
            this.map.removeLayer(icon);
            delete this.mapIcons[iconId];
        }
        
        // Reset icon selection
        this.selectedIconType = null;
        document.querySelectorAll('.icon-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        this.map.getContainer().style.cursor = '';
        
        // Re-enable drawing if needed
        if (!this.missionActive) {
            this.initDrawing();
        }
    }
    
    createIconMarker(latlng, iconType, labelText) {
        const iconHtml = `
            <div class="icon-container">
                <div class="icon-display">${this.getIconEmoji(iconType)}</div>
                <div class="icon-label" contenteditable="false">${labelText || 'Text'}</div>
            </div>
        `;
        
        const icon = L.marker(latlng, {
            icon: L.divIcon({
                className: `map-icon-marker ${iconType}`,
                html: iconHtml,
                iconSize: [40, 60],
                iconAnchor: [20, 40]
            }),
            draggable: true
        }).addTo(this.map);
        
        // Log icon placement when marker is added to map
        if (this.currentMissionId) {
            // Note: This will be called for both new placements and loaded icons
            // The actual logging happens in placeIcon and loadIcons to avoid duplicates
        }
        
        // Make label editable
        const labelElement = icon.getElement().querySelector('.icon-label');
        if (labelElement) {
            labelElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editIconLabel(icon, labelElement);
            });
        }
        
        // Handle drag end
        icon.on('dragend', () => {
            this.updateIconPosition(icon);
        });
        
        // Add delete on right-click
        icon.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            if (confirm('Icon löschen?')) {
                this.deleteIcon(icon);
            }
        });
        
        return icon;
    }
    
    getIconEmoji(iconType) {
        return window.getIconEmoji(iconType);
    }
    
    editIconLabel(icon, labelElement) {
        const currentText = labelElement.textContent.trim();
        labelElement.contentEditable = 'true';
        labelElement.classList.add('editing');
        labelElement.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(labelElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        const finishEdit = () => {
            labelElement.contentEditable = 'false';
            labelElement.classList.remove('editing');
            const newText = labelElement.textContent.trim();
            this.updateIconLabel(icon, newText);
        };
        
        labelElement.addEventListener('blur', finishEdit, { once: true });
        labelElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                labelElement.textContent = currentText;
                finishEdit();
            }
        }, { once: true });
    }
    
    async updateIconLabel(icon, newText) {
        if (!icon.iconId) return;
        
        try {
            const formData = new FormData();
            formData.append('action', 'update_icon');
            formData.append('icon_id', icon.iconId);
            formData.append('label_text', newText);
            
            const response = await safeFetch('api/map_icons.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.success && window.zeitstrahlManager && this.currentMissionId) {
                // Refresh timeline so history view shows updated label
                setTimeout(async () => {
                    try {
                        const missionData = window.zeitstrahlManager.currentMission || {
                            mission_id: this.currentMissionId,
                            status: this.currentMissionStatus || 'pending'
                        };
                        await window.zeitstrahlManager.loadMission(this.currentMissionId, missionData);
                    } catch (err) {
                        console.error('Error reloading timeline after label update:', err);
                    }
                }, 200);
            } else if (!data.success) {
                console.error('Error updating icon label:', data.error);
            }
        } catch (error) {
            console.error('Error updating icon label:', error);
        }
    }
    
    async updateIconPosition(icon) {
        if (!icon.iconId) return;
        
        const latlng = icon.getLatLng();
        
        try {
            const formData = new FormData();
            formData.append('action', 'update_icon');
            formData.append('icon_id', icon.iconId);
            formData.append('latitude', latlng.lat);
            formData.append('longitude', latlng.lng);
            
            const response = await safeFetch('api/map_icons.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.success) {
                // Get icon type and label for logging
                const iconType = icon.options?.icon?.options?.className?.match(/\b(vehicle|person|drone|poi|fire|fire_truck|ambulance|police|thw)\b/)?.[1] || 'unknown';
                const labelElement = icon.getElement()?.querySelector('.icon-label');
                const labelText = labelElement?.textContent?.trim() || '';
                
                // Log icon position update
                this.logIconPlacement('updateIconPosition', {
                    icon_id: icon.iconId,
                    icon_type: iconType,
                    latitude: latlng.lat,
                    longitude: latlng.lng,
                    label_text: labelText
                });
                
                // Refresh timeline so the move appears in history
                if (window.zeitstrahlManager && this.currentMissionId) {
                    setTimeout(async () => {
                        try {
                            const missionData = window.zeitstrahlManager.currentMission || {
                                mission_id: this.currentMissionId,
                                status: this.currentMissionStatus || 'pending'
                            };
                            await window.zeitstrahlManager.loadMission(this.currentMissionId, missionData);
                        } catch (err) {
                            console.error('Error reloading timeline after icon move:', err);
                        }
                    }, 300);
                }
            } else {
                console.error('Error updating icon position:', data.error);
            }
        } catch (error) {
            console.error('Error updating icon position:', error);
        }
    }
    
    async deleteIcon(icon) {
        if (!icon.iconId) {
            this.map.removeLayer(icon);
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'delete_icon');
            formData.append('icon_id', icon.iconId);
            
            const response = await safeFetch('api/map_icons.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.map.removeLayer(icon);
                delete this.mapIcons[icon.iconId];
            } else {
                this.showStatus('Fehler beim Löschen des Icons.', 'error');
            }
        } catch (error) {
            console.error('Error deleting icon:', error);
            this.showStatus('Fehler beim Löschen des Icons.', 'error');
        }
    }
    
    async loadIcons(missionId, beforeTime = null) {
        // Clear existing icons - remove all tracked icons
        Object.values(this.mapIcons).forEach(icon => {
            if (icon && this.map.hasLayer(icon)) {
                this.map.removeLayer(icon);
            }
        });
        this.mapIcons = {};
        
        // Also remove any icon markers that might not be tracked (safety measure)
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                const icon = layer.options?.icon;
                if (icon && icon.options && icon.options.className && 
                    icon.options.className.includes('map-icon-marker')) {
                    this.map.removeLayer(layer);
                }
            }
        });
        
        if (!missionId) return;
        
        try {
            let url = `api/map_icons.php?mission_id=${encodeURIComponent(missionId)}`;
            if (beforeTime) {
                url += `&before_time=${encodeURIComponent(beforeTime)}`;
            }
            
            const response = await safeFetch(url);
            const data = await response.json();
            
            if (data.success && data.icons) {
                data.icons.forEach(iconData => {
                    // Check if icon already exists (shouldn't after clearing, but double-check)
                    if (this.mapIcons[iconData.id]) {
                        // Icon already exists, update it instead of creating new
                        const existingIcon = this.mapIcons[iconData.id];
                        const latlng = L.latLng(iconData.latitude, iconData.longitude);
                        existingIcon.setLatLng(latlng);
                        
                        // Update label if changed
                        const labelElement = existingIcon.getElement()?.querySelector('.icon-label');
                        if (labelElement && iconData.label_text) {
                            labelElement.textContent = this.escapeHtml(iconData.label_text);
                        }
                        return; // Skip creating new icon
                    }
                    
                    // Create new icon
                    const latlng = L.latLng(iconData.latitude, iconData.longitude);
                    const icon = this.createIconMarker(latlng, iconData.icon_type, iconData.label_text || '');
                    icon.iconId = iconData.id;
                    this.mapIcons[iconData.id] = icon;
                    
                    // Log icon placement (when loading from database)
                    this.logIconPlacement('loadIcons', {
                        icon_id: iconData.id,
                        icon_type: iconData.icon_type,
                        latitude: iconData.latitude,
                        longitude: iconData.longitude,
                        label_text: iconData.label_text || ''
                    });
                });
                
                // Update icon movement select if movement is enabled
                if (this.showMovement) {
                    this.updateIconMovementSelect();
                }
            }
        } catch (error) {
            console.error('Error loading icons:', error);
        }
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
            // Hide timeline
            if (window.zeitstrahlManager) {
                window.zeitstrahlManager.hide();
            }
            
            // Update icon select dropdown
            this.updateIconMovementSelect();
            
            // Load and display icon movements
            if (this.currentMissionId) {
                await this.loadIconMovements(this.currentMissionId);
            } else {
                this.showStatus('Bitte wählen Sie zuerst eine Mission aus.', 'error');
                const movementToggle = document.getElementById('show-movement-toggle');
                if (movementToggle) movementToggle.checked = false;
                this.showMovement = false;
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
            // Build URL with optional icon filter
            let url = `api/map_icons.php?mission_id=${encodeURIComponent(missionId)}&get_positions=1`;
            if (this.selectedIconId && this.selectedIconId !== 'all') {
                url += `&icon_id=${encodeURIComponent(this.selectedIconId)}`;
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
                
                const iconCount = Object.keys(positionsByIcon).length;
                this.showStatus(`Bewegung für ${iconCount} Icon(s) angezeigt.`, 'success');
            } else {
                this.showStatus('Keine Bewegungsdaten für diese Mission gefunden.', 'info');
            }
        } catch (error) {
            console.error('Error loading icon movements:', error);
            this.showStatus('Fehler beim Laden der Bewegung.', 'error');
        }
    }
    
    /**
     * Generate distinct colors for drones
     */
    generateDroneColors(count) {
        return window.generateDroneColors(count);
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
     * Escape HTML to prevent XSS
     * @deprecated Use global escapeHtml() function from map-utils.js
     */
    escapeHtml(text) {
        return window.escapeHtml(text);
    }
    
    /**
     * Cleanup method to prevent memory leaks
     * Clears all timeouts, intervals, and removes event listeners
     */
    destroy() {
        // Clear all timeouts
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        
        // Remove draw control
        if (this.drawControl) {
            try {
                this.map.removeControl(this.drawControl);
            } catch (e) {
                console.warn('Error removing draw control:', e);
            }
            this.drawControl = null;
        }
        
        // Remove drawn items
        if (this.drawnItems) {
            this.drawnItems.clearLayers();
            this.drawnItems = null;
        }
        
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
