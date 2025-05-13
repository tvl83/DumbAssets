/**
 * File Upload Module Initialization
 * Easy entry point to set up all file upload functionality
 */

import { setupFilePreview, setupDragAndDrop } from './index.js';

/**
 * Initialize all file upload functionality for standard assets and sub-assets
 */
export function initializeFileUploads() {
    // Initialize asset file uploads
    setupFilePreview('assetPhoto', 'photoPreview', false);
    setupFilePreview('assetReceipt', 'receiptPreview', true);
    setupFilePreview('assetManual', 'manualPreview', true);
    
    // Initialize sub-asset file uploads
    setupFilePreview('subAssetPhoto', 'subPhotoPreview', false);
    setupFilePreview('subAssetReceipt', 'subReceiptPreview', true);
    setupFilePreview('subAssetManual', 'subManualPreview', true);
    
    // Initialize import file uploads
    setupFilePreview('importFile', 'importFilePreview', true);

    // Initialize drag and drop functionality
    setupDragAndDrop();
    
    console.log('File upload functionality initialized');
} 