/**
 * Share Manager
 * Handles mission sharing functionality
 */
class ShareManager {
    constructor(missionManager) {
        this.missionManager = missionManager;
        this.init();
    }
    
    init() {
        // Share mission button in map legend
        const shareBtn = document.getElementById('share-current-mission-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareCurrentMission());
        }
    }
    
    /**
     * Update share button visibility based on mission state
     */
    updateShareButton() {
        const shareSection = document.getElementById('map-legend-share');
        if (!shareSection) return;
        
        // Show share button if there's a current mission
        if (this.missionManager && this.missionManager.currentMissionId) {
            shareSection.style.display = 'block';
        } else {
            shareSection.style.display = 'none';
        }
    }
    
    /**
     * Share current mission
     */
    async shareCurrentMission() {
        if (!this.missionManager || !this.missionManager.currentMissionId) {
            alert('Bitte wählen Sie zuerst eine Mission aus oder starten Sie eine neue Mission.');
            return;
        }
        
        const missionId = this.missionManager.currentMissionId;
        const shareBtn = document.getElementById('share-current-mission-btn');
        if (!shareBtn) return;
        
        try {
            shareBtn.disabled = true;
            const originalText = shareBtn.textContent;
            shareBtn.textContent = '⏳ ...';
            
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
                shareBtn.textContent = '✓ Kopiert!';
                shareBtn.style.backgroundColor = '#10b981';
                
                // Show modal with share URL
                this.showShareModal(missionId, data.share_url);
                
                setTimeout(() => {
                    shareBtn.textContent = originalText;
                    shareBtn.style.backgroundColor = '';
                    shareBtn.disabled = false;
                }, 2000);
            } else {
                alert('Fehler beim Generieren des Share-Links: ' + (data.error || 'Unbekannter Fehler'));
                shareBtn.disabled = false;
                shareBtn.textContent = '🔗 Mission teilen';
            }
        } catch (error) {
            console.error('Error generating share link:', error);
            alert('Fehler beim Generieren des Share-Links: ' + error.message);
            shareBtn.disabled = false;
            shareBtn.textContent = '🔗 Mission teilen';
        }
    }
    
    /**
     * Show share modal
     */
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
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem; font-weight: 600;">Mission teilen</h3>
                <p style="color: #64748b; margin: 0 0 1rem 0; font-size: 0.875rem;">
                    Der Link wurde in die Zwischenablage kopiert. Sie können diesen Link mit anderen teilen, um die Mission im Ansichtsmodus anzuzeigen.
                </p>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                    <input type="text" id="share-url-input" value="${shareUrl}" readonly 
                           style="flex: 1; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; font-size: 0.875rem;">
                    <button type="button" id="copy-share-url-btn" 
                            style="padding: 0.5rem 1rem; background-color: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500;">
                        Kopieren
                    </button>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button type="button" id="close-share-modal" 
                            style="padding: 0.5rem 1rem; background-color: #e2e8f0; color: #1e293b; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500;">
                        Schließen
                    </button>
                </div>
            </div>
        `;
        
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
}

