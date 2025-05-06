/**
 * State Sync Helper
 * Handles synchronization of state between modules
 */

// Function to update state in both renderer modules
function syncState(assets, subAssets, selectedAssetId) {
    // These functions should be imported where this is used
    if (typeof updateState === 'function') {
        updateState(assets, subAssets);
    }
    
    if (typeof updateListState === 'function') {
        updateListState(assets, subAssets, selectedAssetId);
    }
}

export { syncState }; 