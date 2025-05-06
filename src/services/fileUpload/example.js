/**
 * Example usage of the File Upload Module
 * This file demonstrates how to use the fileUpload service
 */

import { 
    initializeFileUploads, 
    handleFileUploads, 
    setupFilePreview, 
    setupDragAndDrop 
} from './index.js';

/**
 * Example 1: Initialize all file upload functionality
 * This is the easiest way to set up file uploads
 */
function example1() {
    // This sets up all file previews and drag-and-drop functionality
    initializeFileUploads();
    
    // Then in your form submit handler:
    document.getElementById('assetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const asset = {
            id: 'asset-123',
            name: 'Sample Asset',
            // ... other asset properties
        };
        
        const updatedAsset = await handleFileUploads(asset, false);
        console.log('Asset with file paths:', updatedAsset);
        
        // Continue with saving the asset
        // saveAsset(updatedAsset);
    });
}

/**
 * Example 2: Custom setup for specific elements
 * Use this when you need more control
 */
function example2() {
    // Set up specific file preview elements
    setupFilePreview('customPhoto', 'customPhotoPreview', false);
    setupFilePreview('customDocument', 'customDocumentPreview', true);
    
    // Manually set up drag and drop
    setupDragAndDrop();
    
    // Handle file uploads
    document.getElementById('customForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const customObject = {
            id: 'custom-123',
            name: 'Custom Object',
            // ... other properties
        };
        
        // Custom implementation for handling file uploads
        const photoInput = document.getElementById('customPhoto');
        const docInput = document.getElementById('customDocument');
        
        if (photoInput.files.length > 0) {
            const result = await uploadFile(photoInput.files[0], 'image', customObject.id);
            if (result) {
                customObject.photoPath = result;
            }
        }
        
        if (docInput.files.length > 0) {
            const result = await uploadFile(docInput.files[0], 'manual', customObject.id);
            if (result) {
                customObject.docPath = result;
            }
        }
        
        console.log('Custom object with file paths:', customObject);
        // Continue with saving
    });
}

// Call examples when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Choose one example to use
    // example1();
    // example2();
}); 