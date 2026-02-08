/**
 * Update Checker
 * Checks for newer releases on GitHub and displays notification
 */
class UpdateChecker {
    constructor() {
        this.checkInterval = null;
        this.checkIntervalMs = 3600000; // Check every hour (3600000ms)
        this.updateNotification = null;
        this.init();
    }
    
    init() {
        // Get the update notification element
        this.updateNotification = document.getElementById('update-notification');
        
        if (!this.updateNotification) {
            console.warn('UpdateChecker: update-notification element not found');
            return;
        }
        
        // Add click handler to open release page
        this.updateNotification.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.latestReleaseUrl) {
                window.open(this.latestReleaseUrl, '_blank');
            }
        });
        
        // Check for updates immediately
        this.checkForUpdates();
        
        // Set up periodic checking
        this.checkInterval = setInterval(() => {
            this.checkForUpdates();
        }, this.checkIntervalMs);
    }
    
    async checkForUpdates() {
        try {
            const fetchFn = typeof window.safeFetch === 'function' ? window.safeFetch : fetch;
            const response = await fetchFn('api/check_update.php');
            const data = await response.json();
            
            if (data.has_update) {
                this.showNotification(data);
            } else {
                this.hideNotification();
            }
        } catch (error) {
            console.error('UpdateChecker: Error checking for updates:', error);
            // Don't show notification on error
            this.hideNotification();
        }
    }
    
    showNotification(updateData) {
        if (!this.updateNotification) {
            return;
        }
        
        this.latestReleaseUrl = updateData.release_url || '';
        const latestVersion = updateData.latest_version || '';
        const currentVersion = updateData.current_version || '';
        
        // Update tooltip
        this.updateNotification.title = `Neue Version ${latestVersion} verfügbar (aktuell: ${currentVersion})`;
        
        // Show notification
        this.updateNotification.style.display = 'flex';
    }
    
    hideNotification() {
        if (this.updateNotification) {
            this.updateNotification.style.display = 'none';
        }
    }
    
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}
