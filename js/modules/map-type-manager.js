/**
 * Map Type Manager
 * Manages switching between different map tile layers (OSM, Terrain, Satellite, etc.)
 */

class MapTypeManager {
    constructor(map) {
        this.map = map;
        this.currentTileLayer = null;
        this.tileLayers = {
            'osm': {
                name: 'Standard',
                layer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                })
            },
            'terrain': {
                name: 'Gelände',
                layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
                    maxZoom: 17
                })
            },
            'satellite': {
                name: 'Satellit',
                layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                    maxZoom: 19
                })
            }
        };
        
        // Default map type
        this.currentMapType = 'osm';
        this.init();
    }
    
    init() {
        // Load saved map type from localStorage
        const savedMapType = localStorage.getItem('mapType');
        if (savedMapType && this.tileLayers[savedMapType]) {
            this.currentMapType = savedMapType;
        }
        
        // Initialize with default or saved map type
        this.setMapType(this.currentMapType);
        
        // Initialize UI
        this.initUI();
    }
    
    initUI() {
        const selector = document.getElementById('map-type-select');
        if (selector) {
            // Set current value
            selector.value = this.currentMapType;
            
            // Add event listener
            selector.addEventListener('change', (e) => {
                this.setMapType(e.target.value);
            });
        }
    }
    
    setMapType(mapType) {
        if (!this.tileLayers[mapType]) {
            console.error('Invalid map type:', mapType);
            return;
        }
        
        // Remove current tile layer
        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }
        
        // Add new tile layer
        this.currentTileLayer = this.tileLayers[mapType].layer;
        this.currentTileLayer.addTo(this.map);
        this.currentMapType = mapType;
        
        // Save to localStorage
        localStorage.setItem('mapType', mapType);
        
        // Update selector if it exists
        const selector = document.getElementById('map-type-select');
        if (selector) {
            selector.value = mapType;
        }
    }
    
    getCurrentMapType() {
        return this.currentMapType;
    }
}

