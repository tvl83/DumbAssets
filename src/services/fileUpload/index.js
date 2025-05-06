/**
 * File Upload Module
 * Main entry point that exports all file upload related functionality
 */

import {
    uploadFile,
    setupFilePreview,
    handleFileUploads,
    setupDragAndDrop
} from './fileUploader.js';

import { initializeFileUploads } from './init.js';

export {
    uploadFile,
    setupFilePreview,
    handleFileUploads,
    setupDragAndDrop,
    initializeFileUploads
}; 