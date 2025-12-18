function downloadLog() {
    const logName = window.selectedLogName || 'log.txt';
    const logContent = document.getElementById('log-content').textContent;
    
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', logName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function copyLog() {
    const logContent = document.getElementById('log-content').textContent;
    
    navigator.clipboard.writeText(logContent).then(() => {
        alert('Log-Inhalt in die Zwischenablage kopiert!');
    }).catch(err => {
        console.error('Fehler beim Kopieren:', err);
        alert('Fehler beim Kopieren in die Zwischenablage.');
    });
}

function confirmDeleteLog(logName) {
    const dialog = document.getElementById('deleteLogDialog');
    const logNameDisplay = document.getElementById('deleteLogName');
    const logNameInput = document.getElementById('deleteLogNameInput');
    
    if (dialog && logNameDisplay && logNameInput) {
        logNameDisplay.textContent = logName;
        logNameInput.value = logName;
        dialog.style.display = 'flex';
    }
}

function cancelDeleteLog() {
    const dialog = document.getElementById('deleteLogDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}
