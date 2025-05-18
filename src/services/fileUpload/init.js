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
    setupFilePreview('assetPhoto', 'photoPreview', false, 'image');
    setupFilePreview('assetReceipt', 'receiptPreview', true, 'receipt');
    setupFilePreview('assetManual', 'manualPreview', true, 'manual');
    
    // Initialize sub-asset file uploads
    setupFilePreview('subAssetPhoto', 'subPhotoPreview', false);
    setupFilePreview('subAssetReceipt', 'subReceiptPreview', true, 'receipt');
    setupFilePreview('subAssetManual', 'subManualPreview', true, 'manual');
    
    // Initialize import file uploads
    setupFilePreview('importFile', 'importFilePreview', true, 'import');

    // Initialize drag and drop functionality
    setupDragAndDrop();
    
    console.log('File upload functionality initialized');
} 