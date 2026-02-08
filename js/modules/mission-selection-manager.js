/**
 * Mission Selection Manager
 * Fetches and displays past missions for selection
 */
class MissionSelectionManager {
    constructor(map, missionManager, zeitstrahlManager) {
        this.map = map;
        this.missionManager = missionManager;
        this.zeitstrahlManager = zeitstrahlManager;
        this.missions = [];
        this.selectedMissionId = null;
        this.init();
    }
    
    init() {
        // Tab switching is handled by SidebarManager
        // Ensure DOM is ready before loading missions
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.startLoading();
            });
        } else {
            // DOM is already ready
            this.startLoading();
        }
    }
    
    startLoading() {
        // Verify DOM elements exist
        const itemsDiv = document.getElementById('mission-selection-items');
        if (!itemsDiv) {
            console.error('MissionSelectionManager: mission-selection-items element not found, retrying...');
            setTimeout(() => this.startLoading(), 100);
            return;
        }
        
        // Load missions
        this.loadMissions().then(() => {
            // After missions are loaded, try to load the last opened mission
            this.loadLastMission();
        });
        
        // Refresh missions every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadMissions();
        }, 30000);
    }
    
    /**
     * Cleanup method to prevent memory leaks
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    async loadMissions() {
        const loadingDiv = document.getElementById('mission-selection-loading');
        const itemsDiv = document.getElementById('mission-selection-items');
        
        if (!itemsDiv) {
            console.error('MissionSelectionManager: mission-selection-items element not found in loadMissions()');
            return;
        }
        
        try {
            console.log('MissionSelectionManager: Loading missions...');
            if (loadingDiv) loadingDiv.style.display = 'block';
            if (itemsDiv) itemsDiv.textContent = '';
            
            const response = await safeFetch('api/mission.php');
            const data = await response.json();
            console.log('MissionSelectionManager: Received data:', data);
            
            // Check for error response
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (data.success && Array.isArray(data.missions)) {
                this.missions = data.missions;
                console.log(`MissionSelectionManager: Found ${this.missions.length} missions`);
                this.renderMissions();
            } else if (data.success && data.missions === undefined) {
                // Handle case where missions array might be missing
                console.warn('MissionSelectionManager: success=true but missions array missing', data);
                this.missions = [];
                this.renderMissions();
            } else {
                console.warn('MissionSelectionManager: No missions in response or success=false', data);
                if (itemsDiv) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'mission-selection-empty';
                    emptyDiv.textContent = 'Keine Missionen gefunden';
                    itemsDiv.appendChild(emptyDiv);
                }
            }
        } catch (error) {
            console.error('MissionSelectionManager: Error loading missions:', error);
            if (itemsDiv) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'mission-selection-empty';
                errorDiv.textContent = 'Fehler beim Laden der Missionen: ' + (error.message || 'Unbekannter Fehler');
                itemsDiv.appendChild(errorDiv);
            }
        } finally {
            if (loadingDiv) loadingDiv.style.display = 'none';
        }
    }
    
    renderMissions() {
        const itemsDiv = document.getElementById('mission-selection-items');
        if (!itemsDiv) return;
        
        if (this.missions.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'mission-selection-empty';
            emptyDiv.textContent = 'Keine Missionen gefunden';
            itemsDiv.appendChild(emptyDiv);
            return;
        }
        
        // Clear existing content
        itemsDiv.textContent = '';
        
        // Create mission items using DOM methods (safer than innerHTML)
        this.missions.forEach(mission => {
            const statusClass = mission.status || 'pending';
            const statusText = {
                'pending': 'Ausstehend',
                'active': 'Aktiv',
                'completed': 'Abgeschlossen'
            }[statusClass] || statusClass;
            
            const createdDate = new Date(mission.created_at);
            
            const dateStr = createdDate.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Create mission item using DOM methods (safer than innerHTML)
            const itemDiv = document.createElement('div');
            itemDiv.className = 'mission-selection-item';
            if (this.selectedMissionId === mission.mission_id) {
                itemDiv.classList.add('active');
            }
            itemDiv.dataset.missionId = mission.mission_id;
            
            // Status
            const statusDiv = document.createElement('div');
            statusDiv.className = `mission-selection-item-status ${statusClass}`;
            statusDiv.textContent = statusText;
            itemDiv.appendChild(statusDiv);
            
            // Mission ID
            const idDiv = document.createElement('div');
            idDiv.className = 'mission-selection-item-id';
            idDiv.textContent = mission.mission_id;
            itemDiv.appendChild(idDiv);
            
            // Date
            const dateDiv = document.createElement('div');
            dateDiv.className = 'mission-selection-item-date';
            dateDiv.textContent = dateStr;
            itemDiv.appendChild(dateDiv);
            
            // Info
            const infoDiv = document.createElement('div');
            infoDiv.className = 'mission-selection-item-info';
            const areasSpan = document.createElement('span');
            areasSpan.textContent = `📍 ${mission.num_areas || 'N/A'} Bereiche`;
            infoDiv.appendChild(areasSpan);
            if (mission.position_count > 0) {
                const posSpan = document.createElement('span');
                posSpan.textContent = `📊 ${mission.position_count} Positionen`;
                infoDiv.appendChild(posSpan);
            }
            itemDiv.appendChild(infoDiv);
            
            // Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;';
            
            const viewLink = document.createElement('a');
            viewLink.href = `view_mission.php?mission_id=${encodeURIComponent(mission.mission_id)}`;
            viewLink.style.cssText = 'display: inline-block; background-color: #3b82f6; color: white; padding: 0.375rem 0.75rem; border-radius: 0.375rem; text-decoration: none; font-size: 0.875rem; font-weight: 500;';
            viewLink.textContent = '📋 Ansicht';
            actionsDiv.appendChild(viewLink);
            
            const shareBtn = document.createElement('button');
            shareBtn.type = 'button';
            shareBtn.className = 'share-mission-btn';
            shareBtn.dataset.missionId = mission.mission_id;
            shareBtn.style.cssText = 'background-color: #10b981; color: white; padding: 0.375rem 0.75rem; border-radius: 0.375rem; border: none; font-size: 0.875rem; font-weight: 500; cursor: pointer;';
            shareBtn.textContent = '🔗 Teilen';
            actionsDiv.appendChild(shareBtn);
            
            itemDiv.appendChild(actionsDiv);
            itemsDiv.appendChild(itemDiv);
        });
        
        // Add click handlers
        itemsDiv.querySelectorAll('.mission-selection-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't select if clicking on buttons
                if (e.target.closest('a, button')) {
                    return;
                }
                const missionId = item.dataset.missionId;
                this.selectMission(missionId);
            });
        });
        
        // Add share button handlers (use setTimeout to ensure DOM is ready)
        setTimeout(() => {
            itemsDiv.querySelectorAll('.share-mission-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const missionId = btn.dataset.missionId;
                    await this.generateShareLink(missionId, btn);
                });
            });
        }, 100);
    }
    
    async generateShareLink(missionId, buttonElement) {
        try {
            buttonElement.disabled = true;
            buttonElement.textContent = '⏳ ...';
            
            const formData = new FormData();
            formData.append('action', 'generate_share_token');
            formData.append('mission_id', missionId);
            
            const response = await safeFetch('api/mission.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success && data.share_url) {
                // Copy to clipboard
                await navigator.clipboard.writeText(data.share_url);
                
                // Show success message
                const originalText = buttonElement.textContent;
                buttonElement.textContent = '✓ Kopiert!';
                buttonElement.style.backgroundColor = '#10b981';
                
                // Show modal with share URL
                this.showShareModal(missionId, data.share_url);
                
                setTimeout(() => {
                    buttonElement.textContent = originalText;
                    buttonElement.style.backgroundColor = '#10b981';
                    buttonElement.disabled = false;
                }, 2000);
            } else {
                alert('Fehler beim Generieren des Share-Links: ' + (data.error || 'Unbekannter Fehler'));
                buttonElement.disabled = false;
                buttonElement.textContent = '🔗 Teilen';
            }
        } catch (error) {
            console.error('Error generating share link:', error);
            alert('Fehler beim Generieren des Share-Links: ' + error.message);
            buttonElement.disabled = false;
            buttonElement.textContent = '🔗 Teilen';
        }
    }
    
    showShareModal(missionId, shareUrl) {
        // Remove existing modal if any
        const existingModal = document.getElementById('share-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'share-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        // Create modal content using DOM methods (safer than innerHTML with user data)
        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2);';
        
        const title = document.createElement('h3');
        title.style.cssText = 'margin: 0 0 1rem 0; font-size: 1.25rem; font-weight: 600;';
        title.textContent = 'Mission teilen';
        modalContent.appendChild(title);
        
        const description = document.createElement('p');
        description.style.cssText = 'color: #64748b; margin: 0 0 1rem 0; font-size: 0.875rem;';
        description.textContent = 'Der Link wurde in die Zwischenablage kopiert. Sie können diesen Link mit anderen teilen, um die Mission im Ansichtsmodus anzuzeigen.';
        modalContent.appendChild(description);
        
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem;';
        
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.id = 'share-url-input';
        urlInput.value = shareUrl; // shareUrl is already URL-encoded from API
        urlInput.readOnly = true;
        urlInput.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; font-size: 0.875rem;';
        inputContainer.appendChild(urlInput);
        
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.id = 'copy-share-url-btn';
        copyBtn.style.cssText = 'padding: 0.5rem 1rem; background-color: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500;';
        copyBtn.textContent = 'Kopieren';
        inputContainer.appendChild(copyBtn);
        
        modalContent.appendChild(inputContainer);
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 0.5rem;';
        
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.id = 'close-share-modal';
        closeBtn.style.cssText = 'padding: 0.5rem 1rem; background-color: #e2e8f0; color: #1e293b; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500;';
        closeBtn.textContent = 'Schließen';
        buttonContainer.appendChild(closeBtn);
        
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelector('#close-share-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        // Copy button
        modal.querySelector('#copy-share-url-btn').addEventListener('click', async () => {
            const input = modal.querySelector('#share-url-input');
            await navigator.clipboard.writeText(shareUrl);
            const btn = modal.querySelector('#copy-share-url-btn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Kopiert!';
            btn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '#3b82f6';
            }, 2000);
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    async selectMission(missionId) {
        // Update selected state
        this.selectedMissionId = missionId;
        this.renderMissions();
        
        // Store in sessionStorage
        try {
            sessionStorage.setItem('lastMissionId', missionId);
        } catch (e) {
            console.warn('Could not store mission ID in sessionStorage:', e);
        }
        
        // Load mission details
        try {
            const response = await safeFetch(`api/mission.php?mission_id=${encodeURIComponent(missionId)}`);
            const data = await response.json();
            
            if (data.success && data.mission) {
                // Center map on mission
                if (data.mission.center_lat && data.mission.center_lng) {
                    this.map.setView([data.mission.center_lat, data.mission.center_lng], 15);
                }
                
                // If mission has bounds, show them
                if (data.mission.bounds_ne_lat && data.mission.bounds_sw_lat) {
                    const bounds = [
                        [data.mission.bounds_sw_lat, data.mission.bounds_sw_lng],
                        [data.mission.bounds_ne_lat, data.mission.bounds_ne_lng]
                    ];
                    this.map.fitBounds(bounds);
                }
                
                // Load mission into form and visualize on map
                if (this.missionManager) {
                    // This will populate the form, update UI state, and visualize the mission
                    await this.missionManager.loadMissionData(data.mission);
                    
                    // Load icons for this mission
                    this.missionManager.loadIcons(missionId);
                }
                
                // Try to load Zeitstrahl - it will show if positions exist, hide if not
                if (this.zeitstrahlManager) {
                    this.zeitstrahlManager.loadMission(missionId, data.mission);
                }
            }
        } catch (error) {
            console.error('Error loading mission details:', error);
        }
    }
    
    /**
     * Load last opened mission from sessionStorage
     */
    async loadLastMission() {
        try {
            const lastMissionId = sessionStorage.getItem('lastMissionId');
            if (lastMissionId) {
                // Verify mission still exists
                const response = await fetch(`api/mission.php?mission_id=${encodeURIComponent(lastMissionId)}`);
                const data = await response.json();
                
                if (data.success && data.mission) {
                    // Mission exists, load it
                    await this.selectMission(lastMissionId);
                    return true;
                } else {
                    // Mission no longer exists, remove from storage
                    sessionStorage.removeItem('lastMissionId');
                }
            }
        } catch (error) {
            console.error('Error loading last mission:', error);
            // Remove invalid mission ID from storage
            try {
                sessionStorage.removeItem('lastMissionId');
            } catch (e) {
                // Ignore
            }
        }
        return false;
    }
}

