/**
 * Export Positions Module
 * Handles CSV export of position data with address resolution
 */

function initExportPositions(missionId) {
    const exportBtn = document.getElementById('export-positions-btn');
    const exportDialog = document.getElementById('export-dialog');
    const exportStatus = document.getElementById('export-status');
    const exportProgressBar = document.getElementById('export-progress-bar');
    const exportProgressText = document.getElementById('export-progress-text');
    const exportPercentage = document.getElementById('export-percentage');
    const exportCancelBtn = document.getElementById('export-cancel-btn');
    
    if (!exportBtn || !exportDialog) {
        console.warn('Export elements not found');
        return;
    }
    
    let exportId = null;
    let isExporting = false;
    let cancelRequested = false;
    
    exportBtn.addEventListener('click', async () => {
        if (isExporting) {
            return;
        }
        
        isExporting = true;
        cancelRequested = false;
        exportDialog.style.display = 'flex';
        exportStatus.textContent = 'Export wird vorbereitet...';
        exportProgressBar.style.width = '0%';
        exportProgressText.textContent = '0 / 0';
        exportPercentage.textContent = '0%';
        exportCancelBtn.style.display = 'block';
        
        try {
            // Start export
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
            
            // Process in batches
            const batchSize = 10;
            let processed = 0;
            
            while (processed < total && !cancelRequested) {
                // Process batch
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
                exportStatus.textContent = `Adressen werden aufgelöst... (${processed} / ${total})`;
                
                if (batchData.completed) {
                    break;
                }
                
                // Small delay to prevent overwhelming the server
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
            
            // Get final CSV
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
            
            // Download CSV
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
            
            exportStatus.textContent = 'Export erfolgreich abgeschlossen!';
            exportProgressBar.style.width = '100%';
            exportProgressText.textContent = `${total} / ${total}`;
            exportPercentage.textContent = '100%';
            
            setTimeout(() => {
                exportDialog.style.display = 'none';
                isExporting = false;
            }, 2000);
            
        } catch (error) {
            console.error('Export error:', error);
            exportStatus.textContent = `Fehler: ${error.message}`;
            exportCancelBtn.textContent = 'Schließen';
            exportCancelBtn.onclick = () => {
                exportDialog.style.display = 'none';
                isExporting = false;
            };
        }
    });
    
    exportCancelBtn.addEventListener('click', () => {
        if (isExporting) {
            cancelRequested = true;
            exportCancelBtn.textContent = 'Wird abgebrochen...';
            exportCancelBtn.disabled = true;
        } else {
            exportDialog.style.display = 'none';
        }
    });
    
    // Close dialog when clicking outside
    exportDialog.addEventListener('click', (e) => {
        if (e.target === exportDialog && !isExporting) {
            exportDialog.style.display = 'none';
        }
    });
}

