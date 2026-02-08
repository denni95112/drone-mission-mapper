/**
 * KML Manager Module
 * Handles KML export and import for DJI Drones
 */

class KMLManager {
    constructor(missionManager) {
        this.missionManager = missionManager;
        this.currentMissionId = null;
        this.init();
    }
    
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }
    
    setupEventListeners() {
        const exportBtn = document.getElementById('export-kml-btn');
        const importFile = document.getElementById('import-kml-file');
        const statusDiv = document.getElementById('kml-status');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportKML());
        }
        
        if (importFile) {
            importFile.addEventListener('change', (e) => this.importKML(e));
        }
        
        if (this.missionManager) {
            this.updateMissionId();
            
            this.missionIdCheckInterval = setInterval(() => {
                this.updateMissionId();
            }, 1000);
        }
    }
    
    updateMissionId() {
        const newMissionId = this.missionManager?.currentMissionId || 
                             (document.getElementById('mission_id')?.value?.trim()) || 
                             null;
        
        if (newMissionId !== this.currentMissionId) {
            this.currentMissionId = newMissionId;
        }
    }
    
    destroy() {
        if (this.missionIdCheckInterval) {
            clearInterval(this.missionIdCheckInterval);
            this.missionIdCheckInterval = null;
        }
    }
    
    async exportKML() {
        this.updateMissionId();
        
        if (!this.currentMissionId) {
            this.showStatus('Bitte wählen Sie zuerst eine Mission aus.', 'error');
            return;
        }
        
        const includeFlightPath = document.getElementById('include-flight-path')?.checked || false;
        const onlyFireIcons = document.getElementById('only-fire-icons')?.checked || false;
        const statusDiv = document.getElementById('kml-status');
        
        try {
            this.showStatus('KML wird exportiert...', 'info');
            
            const url = `api/kml.php?mission_id=${encodeURIComponent(this.currentMissionId)}&include_flight_path=${includeFlightPath ? '1' : '0'}&only_fire_icons=${onlyFireIcons ? '1' : '0'}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.google-earth.kml+xml'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const kmlContent = await response.text();
            
            const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
            const link = document.createElement('a');
            const urlObj = URL.createObjectURL(blob);
            link.setAttribute('href', urlObj);
            link.setAttribute('download', `${this.currentMissionId}-mission.kml`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(urlObj);
            
            this.showStatus('KML erfolgreich exportiert!', 'success');
            
            setTimeout(() => {
                this.hideStatus();
            }, 3000);
            
        } catch (error) {
            console.error('KML export error:', error);
            this.showStatus(`Fehler beim Export: ${error.message}`, 'error');
        }
    }
    
    async importKML(event) {
        this.updateMissionId();
        
        if (!this.currentMissionId) {
            this.showStatus('Bitte wählen Sie zuerst eine Mission aus.', 'error');
            event.target.value = ''; // Clear file input
            return;
        }
        
        const file = event.target.files[0];
        
        if (!file) {
            return;
        }
        
        if (!file.name.toLowerCase().endsWith('.kml') && !file.name.toLowerCase().endsWith('.xml')) {
            this.showStatus('Bitte wählen Sie eine KML-Datei (.kml oder .xml)', 'error');
            event.target.value = '';
            return;
        }
        
        const statusDiv = document.getElementById('kml-status');
        const formData = new FormData();
        formData.append('action', 'import');
        formData.append('mission_id', this.currentMissionId);
        formData.append('kml_file', file);
        
        try {
            this.showStatus('KML wird importiert...', 'info');
            
            const response = await safeFetch('api/kml.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Import failed');
            }
            
            const imported = data.imported || 0;
            const total = data.total || 0;
            const errors = data.errors || [];
            
            let message = `${imported} Wegpunkt(e) erfolgreich importiert`;
            if (total > imported) {
                message += ` (${total - imported} übersprungen)`;
            }
            if (errors.length > 0) {
                message += `. ${errors.length} Fehler aufgetreten.`;
            }
            
            this.showStatus(message, imported > 0 ? 'success' : 'warning');
            
            event.target.value = '';
            
            if (this.missionManager && typeof this.missionManager.loadIcons === 'function') {
                setTimeout(() => {
                    this.missionManager.loadIcons();
                }, 500);
            }
            
            setTimeout(() => {
                this.hideStatus();
            }, 5000);
            
        } catch (error) {
            console.error('KML import error:', error);
            this.showStatus(`Fehler beim Import: ${error.message}`, 'error');
            event.target.value = '';
            
            setTimeout(() => {
                this.hideStatus();
            }, 5000);
        }
    }
    
    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('kml-status');
        if (!statusDiv) return;
        
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        
        switch (type) {
            case 'success':
                statusDiv.style.background = '#d1fae5';
                statusDiv.style.color = '#065f46';
                statusDiv.style.border = '1px solid #10b981';
                break;
            case 'error':
                statusDiv.style.background = '#fee2e2';
                statusDiv.style.color = '#991b1b';
                statusDiv.style.border = '1px solid #ef4444';
                break;
            case 'warning':
                statusDiv.style.background = '#fef3c7';
                statusDiv.style.color = '#92400e';
                statusDiv.style.border = '1px solid #f59e0b';
                break;
            default:
                statusDiv.style.background = '#dbeafe';
                statusDiv.style.color = '#1e40af';
                statusDiv.style.border = '1px solid #3b82f6';
        }
    }
    
    hideStatus() {
        const statusDiv = document.getElementById('kml-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KMLManager;
}
