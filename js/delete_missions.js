let missionToDelete = null;

function confirmDelete(missionId) {
    missionToDelete = missionId;
    document.getElementById('deleteMissionId').textContent = missionId;
    document.getElementById('deleteMissionIdInput').value = missionId;
    document.getElementById('deleteConfirmDialog').classList.add('active');
}

function cancelDelete() {
    missionToDelete = null;
    document.getElementById('deleteConfirmDialog').classList.remove('active');
}

// Close dialog when clicking outside
document.getElementById('deleteConfirmDialog').addEventListener('click', function(e) {
    if (e.target === this) {
        cancelDelete();
    }
});

// Close dialog with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cancelDelete();
    }
});

// Clear localStorage for deleted mission (legend data)
if (window.deletedMissionId) {
    (function() {
        const deletedMissionId = window.deletedMissionId;
        try {
            localStorage.removeItem('legend_' + deletedMissionId);
            console.log('Cleared legend data for deleted mission:', deletedMissionId);
        } catch (e) {
            console.error('Error clearing legend data from localStorage:', e);
        }
    })();
}
