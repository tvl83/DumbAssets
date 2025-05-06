/**
 * Render Services Index
 * Re-exports all functions from the asset renderer modules
 */

// Import from asset renderer module
import {
    initRenderer,
    updateState,
    updateSelectedIds,
    renderAssetDetails
} from './assetRenderer.js';

// Import from list renderer module
import {
    initListRenderer,
    updateListState,
    updateDashboardFilter,
    updateSort,
    renderAssetList,
    sortAssets
} from './listRenderer.js';

// Import from sync helper
import { syncState } from './syncHelper.js';

// Export all render service functions
export {
    // Asset renderer functions
    initRenderer,
    updateState,
    updateSelectedIds,
    renderAssetDetails,
    
    // List renderer functions
    initListRenderer,
    updateListState,
    updateDashboardFilter,
    updateSort,
    renderAssetList,
    sortAssets,
    
    // Sync helper function
    syncState
}; 