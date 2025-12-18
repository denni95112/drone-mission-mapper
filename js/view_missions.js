document.addEventListener('DOMContentLoaded', () => {
    const exportButtons = document.querySelectorAll('.export-btn');
    
    exportButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const missionId = btn.getAttribute('data-mission-id');
            if (missionId) {
                handleExport(missionId);
            }
        });
    });
});

/**
 * Handle export of mission positions
 * @param {string} missionId - Mission ID to export
 */
async function handleExport(missionId) {
    const exportDialog = document.getElementById('export-dialog');
    const exportStatus = document.getElementById('export-status');
    const exportProgressBar = document.getElementById('export-progress-bar');
    const exportProgressText = document.getElementById('export-progress-text');
    const exportPercentage = document.getElementById('export-percentage');
    const exportCancelBtn = document.getElementById('export-cancel-btn');
    
    if (!exportDialog) return;
    
    let exportId = null;
    let isExporting = true;
    let cancelRequested = false;
    
    exportDialog.style.display = 'flex';
    exportStatus.textContent = 'Export wird vorbereitet...';
    exportProgressBar.style.width = '0%';
    exportProgressText.textContent = '0 / 0';
    exportPercentage.textContent = '0%';
    exportCancelBtn.style.display = 'block';
    exportCancelBtn.disabled = false;
    exportCancelBtn.textContent = 'Abbrechen';
    
    exportCancelBtn.onclick = () => {
        if (isExporting) {
            cancelRequested = true;
            exportCancelBtn.textContent = 'Wird abgebrochen...';
            exportCancelBtn.disabled = true;
        } else {
            exportDialog.style.display = 'none';
        }
    };
    
    try {
        const startResponse = await safeFetch('api/export_positions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'start_export',
                mission_id: missionId
            })
        });
        
        const startData = await startResponse.json();
        
        if (!startData.success) {
            throw new Error(startData.error || 'Failed to start export');
        }
        
        exportId = startData.export_id;
        const total = startData.total;
        
        if (total === 0) {
            exportStatus.textContent = 'Keine Positionsdaten gefunden.';
            exportProgressBar.style.width = '100%';
            exportProgressText.textContent = '0 / 0';
            exportPercentage.textContent = '100%';
            setTimeout(() => {
                exportDialog.style.display = 'none';
                isExporting = false;
            }, 2000);
            return;
        }
        
        exportStatus.textContent = `Adressen werden aufgelöst... (0 / ${total})`;
        exportProgressText.textContent = `0 / ${total}`;
        exportPercentage.textContent = '0%';
        
        const batchSize = 10;
        let processed = 0;
        
        while (processed < total && !cancelRequested) {
            const batchResponse = await safeFetch('api/export_positions.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'process_batch',
                    export_id: exportId,
                    batch_size: batchSize.toString()
                })
            });
            
            const batchData = await batchResponse.json();
            
            if (!batchData.success) {
                throw new Error(batchData.error || 'Failed to process batch');
            }
            
            processed = batchData.processed;
            const percentage = Math.round((processed / total) * 100);
            
            exportProgressBar.style.width = `${percentage}%`;
            exportProgressText.textContent = `${processed} / ${total}`;
            exportPercentage.textContent = `${percentage}%`;
            
            let statusText = `Adressen werden aufgelöst... (${processed} / ${total})`;
            if (batchData.cache_stats) {
                const stats = batchData.cache_stats;
                const hitRate = stats.hit_rate || 0;
                statusText += ` | Cache: ${stats.hits} Treffer, ${stats.misses} Fehlschläge (${hitRate}%)`;
            }
            exportStatus.textContent = statusText;
            
            if (batchData.completed) {
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (cancelRequested) {
            exportStatus.textContent = 'Export abgebrochen.';
            setTimeout(() => {
                exportDialog.style.display = 'none';
                isExporting = false;
            }, 2000);
            return;
        }
        
        exportStatus.textContent = 'CSV wird generiert...';
        const csvResponse = await safeFetch('api/export_positions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'get_csv',
                export_id: exportId
            })
        });
        
        const csvData = await csvResponse.json();
        
        if (!csvData.success) {
            throw new Error(csvData.error || 'Failed to generate CSV');
        }
        
        const csvContent = csvData.csv;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${missionId}-positions-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        let statusText = 'Export erfolgreich abgeschlossen!';
        if (csvData.cache_stats) {
            const stats = csvData.cache_stats;
            const hitRate = stats.hit_rate || 0;
            statusText += `\n\nCache-Statistik:\nTreffer: ${stats.hits}, Fehlschläge: ${stats.misses}, Trefferquote: ${hitRate}%`;
        }
        
        exportStatus.textContent = statusText;
        exportProgressBar.style.width = '100%';
        exportProgressText.textContent = `${total} / ${total}`;
        exportPercentage.textContent = '100%';
        
        setTimeout(() => {
            exportDialog.style.display = 'none';
            isExporting = false;
        }, 4000);
        
    } catch (error) {
        console.error('Export error:', error);
        exportStatus.textContent = `Fehler: ${error.message}`;
        exportCancelBtn.textContent = 'Schließen';
        exportCancelBtn.disabled = false;
        exportCancelBtn.onclick = () => {
            exportDialog.style.display = 'none';
            isExporting = false;
        };
    }
}

document.getElementById('export-dialog')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('export-dialog')) {
        const exportDialog = document.getElementById('export-dialog');
        const isExporting = exportDialog?.querySelector('#export-cancel-btn')?.disabled === false && 
                           exportDialog?.querySelector('#export-status')?.textContent?.includes('wird');
        if (!isExporting) {
            exportDialog.style.display = 'none';
        }
    }
});
