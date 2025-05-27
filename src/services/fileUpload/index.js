/**
 * File Upload Module
 * Main entry point that exports all file upload related functionality
 */

import {
    uploadFile,
    setupFileInputPreview,
    handleFileUploads,
    setupDragAndDrop
} from './fileUploader.js';

import { initializeFileUploads } from './init.js';

export {
    uploadFile,
    setupFileInputPreview as setupFilePreview, // Export with the original name for backward compatibility
    handleFileUploads,
    setupDragAndDrop,
    initializeFileUploads
}; 