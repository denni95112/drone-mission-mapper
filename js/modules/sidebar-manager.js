/**
 * Sidebar Manager
 * Manages the unified sidebar with tabs
 */
class SidebarManager {
    constructor() {
        this.currentTab = 'mission';
        this.isCollapsed = false;
        this.init();
    }
    
    init() {
        // Sidebar toggle button (inside sidebar)
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Sidebar open button (outside sidebar, visible when closed)
        const openBtn = document.getElementById('sidebar-open-btn');
        if (openBtn) {
            openBtn.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Tab buttons
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                // Only allow switching to visible tabs
                if (tab.style.display !== 'none') {
                    this.switchTab(tabName);
                }
            });
        });
        
        // Ensure mission tools tab content is hidden on init (if tab button is hidden)
        const missionToolsTab = document.querySelector('.sidebar-tab[data-tab="mission-tools"]');
        const missionToolsContent = document.getElementById('tab-mission-tools');
        if (missionToolsTab && missionToolsTab.style.display === 'none' && missionToolsContent) {
            missionToolsContent.style.display = 'none';
            missionToolsContent.classList.remove('active');
        }
        
        // Update map margin
        this.updateMapMargin();
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const openBtn = document.getElementById('sidebar-open-btn');
        
        if (sidebar) {
            this.isCollapsed = !this.isCollapsed;
            sidebar.classList.toggle('collapsed', this.isCollapsed);
            this.updateMapMargin();
            
            // Show/hide open button
            if (openBtn) {
                openBtn.style.display = this.isCollapsed ? 'flex' : 'none';
            }
            
            // If opening sidebar and mission is active, switch to mission tools tab
            if (!this.isCollapsed && window.missionManager && window.missionManager.missionActive) {
                const toolsTab = document.querySelector('.sidebar-tab[data-tab="mission-tools"]');
                if (toolsTab && toolsTab.style.display !== 'none') {
                    this.showTab('mission-tools');
                }
            }
        }
    }
    
    switchTab(tabName) {
        // Check if the tab is visible (not hidden)
        const targetTab = document.querySelector(`.sidebar-tab[data-tab="${tabName}"]`);
        if (targetTab && targetTab.style.display === 'none') {
            // Tab is hidden, don't switch to it
            return;
        }
        
        // Update tab buttons
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab content - use CSS classes only
        document.querySelectorAll('.sidebar-tab-content').forEach(content => {
            if (content.id === `tab-${tabName}`) {
                // Show this tab content by adding active class
                content.classList.add('active');
                // Remove any inline display style to let CSS handle it
                if (content.style.display) {
                    content.style.display = '';
                }
            } else {
                // Hide other tab contents by removing active class
                content.classList.remove('active');
                // For mission-tools tab, ensure it's hidden if tab button is hidden
                if (content.id === 'tab-mission-tools') {
                    const toolsTabBtn = document.querySelector('.sidebar-tab[data-tab="mission-tools"]');
                    if (toolsTabBtn && toolsTabBtn.style.display === 'none') {
                        // Force hide if tab button is hidden (override CSS)
                        content.style.display = 'none';
                    } else {
                        // Remove inline style to let CSS handle it
                        if (content.style.display) {
                            content.style.display = '';
                        }
                    }
                } else {
                    // Remove inline styles for other tabs to let CSS handle visibility
                    if (content.style.display) {
                        content.style.display = '';
                    }
                }
            }
        });
        
        this.currentTab = tabName;
        
        // Ensure sidebar is visible when switching tabs
        if (this.isCollapsed) {
            this.toggleSidebar();
        }
    }
    
    updateMapMargin() {
        const map = document.getElementById('map');
        const openBtn = document.getElementById('sidebar-open-btn');
        const zeitstrahl = document.getElementById('zeitstrahl');
        const zeitstrahlOpenBtn = document.getElementById('zeitstrahl-open-btn');
        
        if (map) {
            // Map is now centered via CSS, don't set margin-left
            // Just ensure it's centered
            map.style.marginLeft = 'auto';
            map.style.marginRight = 'auto';
            
            if (this.isCollapsed) {
                if (openBtn) openBtn.style.display = 'block';
                // Update timeline position when sidebar is collapsed
                if (zeitstrahl) {
                    zeitstrahl.style.left = '50%';
                    zeitstrahl.style.maxWidth = '90%';
                }
                if (zeitstrahlOpenBtn) {
                    zeitstrahlOpenBtn.style.left = '50%';
                }
            } else {
                const sidebarWidth = window.innerWidth > 768 ? 380 : 0;
                // Map is centered via CSS, don't set margin-left
                map.style.marginLeft = 'auto';
                map.style.marginRight = 'auto';
                if (openBtn) openBtn.style.display = 'none';
                // Update timeline position when sidebar is visible
                if (zeitstrahl) {
                    zeitstrahl.style.left = `calc(${sidebarWidth}px + 50%)`;
                    zeitstrahl.style.maxWidth = `calc(90% - ${sidebarWidth}px)`;
                }
                if (zeitstrahlOpenBtn) {
                    zeitstrahlOpenBtn.style.left = `calc(${sidebarWidth}px + 50%)`;
                }
            }
            
            // Invalidate map size after margin change
            if (window.map) {
                setTimeout(() => {
                    window.map.invalidateSize();
                }, 100);
            }
        }
    }
    
    showTab(tabName) {
        this.switchTab(tabName);
    }
}

