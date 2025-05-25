/**
 * File Upload Module
 * Handles file uploads, previews, and drag-and-drop functionality
 */

import { validateFileType, formatFileSize } from './utils.js';
import { createPhotoPreview, createDocumentPreview } from '../render/previewRenderer.js';

// Get access to the global flags
let deletePhoto = false, deleteReceipt = false, deleteManual = false;
let deleteSubPhoto = false, deleteSubReceipt = false, deleteSubManual = false;

// Look for these flags in the window object to access them across modules
function getDeleteFlags() {
    // For main assets
    if (typeof window !== 'undefined') {
        deletePhoto = window.deletePhoto || false;
        deleteReceipt = window.deleteReceipt || false;
        deleteManual = window.deleteManual || false;
        // For sub-assets
        deleteSubPhoto = window.deleteSubPhoto || false;
        deleteSubReceipt = window.deleteSubReceipt || false;
        deleteSubManual = window.deleteSubManual || false;
    }
    return { deletePhoto, deleteReceipt, deleteManual, deleteSubPhoto, deleteSubReceipt, deleteSubManual };
}

/**
 * Upload a file to the server
 * @param {File} file - The file to upload
 * @param {string} type - The type of file ('image', 'receipt', or 'manual')
 * @param {string} id - The ID of the associated asset
 * @returns {Promise<{path: string, fileInfo: Object}|null>} - The path and info of the uploaded file, or null if the upload failed
 */
async function uploadFile(file, type, id) {
    let fieldName;
    let endpoint;
    const apiBaseUrl = window.location.origin + (window.appConfig?.basePath || '');
    
    if (type === 'image') {
        fieldName = 'photo';
        endpoint = `${apiBaseUrl}/api/upload/image`;
    } else if (type === 'manual') {
        fieldName = 'manual';
        endpoint = `${apiBaseUrl}/api/upload/manual`;
    } else {
        fieldName = 'receipt';
        endpoint = `${apiBaseUrl}/api/upload/receipt`;
    }
    const formData = new FormData();
    formData.append(fieldName, file);
    formData.append('id', id);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        return data;
    } catch (err) {
        console.error('File upload failed:', err);
        return null;
    }
}

/**
 * Setup file preview functionality for a file input element
 * @param {string} inputId - The ID of the file input element
 * @param {string} previewId - The ID of the preview container element
 * @param {boolean} isDocument - Whether the file is a document (true) or image (false)
 * @param {string} fileType - The type of file ('image', 'receipt', or 'manual')
 */
function setupFileInputPreview(inputId, previewId, isDocument = false, fileType = 'image') {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const uploadBox = document.querySelector(`[data-target="${inputId}"]`);
    
    if (!input || !preview) return;
    
    // Store the previous file value to restore if user cancels
    let previousValue = input.value;

    // Drag and drop handlers
    if (uploadBox) {
        uploadBox.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadBox.classList.add('drag-over');
        });

        uploadBox.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadBox.classList.remove('drag-over');
        });

        uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadBox.classList.add('drag-over');
        });

        uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadBox.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // Use the validateFileType utility function
                const validFiles = Array.from(files).filter(file => validateFileType(file, input.accept));
                
                if (validFiles.length > 0) {
                    input.files = new DataTransfer().files;
                    validFiles.forEach(file => {
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                    });
                    input.dispatchEvent(new Event('change'));
                } else {
                    alert('One or more files are not of the accepted type. Please upload valid files.');
                }
            }
        });
    }

    input.onchange = () => {
        // Clear the preview first
        preview.innerHTML = '';

        // Only show preview if there are files
        if (input.files && input.files.length > 0) {
            Array.from(input.files).forEach(file => {
                // Create the preview element using component approach
                const previewItem = document.createElement('div');
                
                if (isDocument) {
                    // For documents (receipt, manual, or import), use the document preview component
                    let docType;
                    if (fileType === 'receipt') {
                        docType = 'receipt';
                    } else if (fileType === 'import') {
                        docType = 'import';
                    } else if (fileType === 'manual') {
                        docType = 'manual';
                    } else {
                        docType = 'document';
                    }
                    const reader = new FileReader();
                    
                    // Set up delete handler
                    const deleteHandler = () => {
                        if (confirm(`Are you sure you want to delete this ${docType}?`)) {
                            previewItem.remove();
                            // Update the input files
                            const dataTransfer = new DataTransfer();
                            Array.from(input.files).forEach((f, i) => {
                                if (f !== file) {
                                    dataTransfer.items.add(f);
                                }
                            });
                            input.files = dataTransfer.files;
                            
                            // If this is an import file, reset the import form
                            if (fileType === 'import' && window.resetImportForm) {
                                window.resetImportForm();
                            }
                        }
                    };
                    
                    // Use createDocumentPreview for documents with filename and size
                    const docPreview = createDocumentPreview(docType, file.name, deleteHandler, file.name, formatFileSize(file.size));
                    previewItem.appendChild(docPreview);
                    
                } else {
                    // For images, use the photo preview component
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // Set up delete handler
                        const deleteHandler = () => {
                            if (confirm('Are you sure you want to delete this image?')) {
                                previewItem.remove();
                                // Update the input files
                                const dataTransfer = new DataTransfer();
                                Array.from(input.files).forEach((f, i) => {
                                    if (f !== file) {
                                        dataTransfer.items.add(f);
                                    }
                                });
                                input.files = dataTransfer.files;
                            }
                        };
                        
                        // Use createPhotoPreview for images with filename and size
                        const photoPreview = createPhotoPreview(e.target.result, deleteHandler, file.name, formatFileSize(file.size));
                        previewItem.appendChild(photoPreview);
                    };
                    reader.readAsDataURL(file);
                }

                preview.appendChild(previewItem);
            });
        }
    };
}

/**
 * Handle file uploads for an asset
 * @param {Object} asset - The asset to upload files for
 * @param {boolean} isEditMode - Whether we're editing an existing asset or creating a new one
 * @param {boolean} isSubAsset - Whether this is a sub-asset
 * @returns {Promise<Object>} - The updated asset with file paths
 */
async function handleFileUploads(asset, isEditMode, isSubAsset = false) {
    // Get the current delete flags
    getDeleteFlags();
    
    // Clone the asset to avoid modifying the original
    const assetCopy = { ...asset };
    
    // Log initial state of file paths
    console.log('handleFileUploads starting with asset:', {
        id: assetCopy.id,
        name: assetCopy.name,
        parentId: assetCopy.parentId || null
    });
    
    // Initialize file info arrays if they don't exist
    assetCopy.photoInfo = assetCopy.photoInfo || [];
    assetCopy.receiptInfo = assetCopy.receiptInfo || [];
    assetCopy.manualInfo = assetCopy.manualInfo || [];
    
    // Get file inputs
    const photoInput = document.getElementById(isSubAsset ? 'subAssetPhoto' : 'assetPhoto');
    const receiptInput = document.getElementById(isSubAsset ? 'subAssetReceipt' : 'assetReceipt');
    const manualInput = document.getElementById(isSubAsset ? 'subAssetManual' : 'assetManual');
    
    // Make sure inputs exist before trying to access them
    if (!photoInput || !receiptInput || !manualInput) {
        console.error('File inputs not found:', {
            photoInput: !!photoInput,
            receiptInput: !!receiptInput,
            manualInput: !!manualInput
        });
        return assetCopy;
    }
    
    // Initialize arrays for multiple files
    assetCopy.photoPaths = assetCopy.photoPaths || [];
    assetCopy.receiptPaths = assetCopy.receiptPaths || [];
    assetCopy.manualPaths = assetCopy.manualPaths || [];
    
    // Handle photo uploads
    if (photoInput.files && photoInput.files.length > 0) {
        console.log(`Uploading ${photoInput.files.length} photo(s)`);
        assetCopy.photoPaths = [];
        assetCopy.photoInfo = [];
        for (const file of photoInput.files) {
            const result = await uploadFile(file, 'image', assetCopy.id);
            if (result) {
                assetCopy.photoPaths.push(result.path);
                assetCopy.photoInfo.push(result.fileInfo);
            }
        }
        // Set the first photo as the main photo
        assetCopy.photoPath = assetCopy.photoPaths[0] || null;
        console.log(`Setting main photoPath to: ${assetCopy.photoPath}`);
    } else if (isEditMode) {
        if ((isSubAsset ? deleteSubPhoto : deletePhoto) && assetCopy.photoPath) {
            assetCopy.photoPath = null;
            assetCopy.photoPaths = [];
            assetCopy.photoInfo = [];
        }
    }
    
    // Handle receipt uploads
    if (receiptInput.files && receiptInput.files.length > 0) {
        console.log(`Uploading ${receiptInput.files.length} receipt(s)`);
        assetCopy.receiptPaths = [];
        assetCopy.receiptInfo = [];
        for (const file of receiptInput.files) {
            const result = await uploadFile(file, 'receipt', assetCopy.id);
            if (result) {
                assetCopy.receiptPaths.push(result.path);
                assetCopy.receiptInfo.push(result.fileInfo);
            }
        }
        // Set the first receipt as the main receipt
        assetCopy.receiptPath = assetCopy.receiptPaths[0] || null;
        console.log(`Setting main receiptPath to: ${assetCopy.receiptPath}`);
    } else if (isEditMode) {
        if ((isSubAsset ? deleteSubReceipt : deleteReceipt) && assetCopy.receiptPath) {
            assetCopy.receiptPath = null;
            assetCopy.receiptPaths = [];
            assetCopy.receiptInfo = [];
        }
    }

    // Handle manual uploads
    if (manualInput.files && manualInput.files.length > 0) {
        console.log(`Uploading ${manualInput.files.length} manual(s)`);
        assetCopy.manualPaths = [];
        assetCopy.manualInfo = [];
        for (const file of manualInput.files) {
            const result = await uploadFile(file, 'manual', assetCopy.id);
            if (result) {
                assetCopy.manualPaths.push(result.path);
                assetCopy.manualInfo.push(result.fileInfo);
            }
        }
        // Set the first manual as the main manual
        assetCopy.manualPath = assetCopy.manualPaths[0] || null;
        console.log(`Setting main manualPath to: ${assetCopy.manualPath}`);
    } else if (isEditMode) {
        if ((isSubAsset ? deleteSubManual : deleteManual) && assetCopy.manualPath) {
            assetCopy.manualPath = null;
            assetCopy.manualPaths = [];
            assetCopy.manualInfo = [];
        }
    }
    
    return assetCopy;
}

/**
 * Set up drag and drop functionality for all file upload boxes
 */
function setupDragAndDrop() {
    // Add click handler for file upload boxes
    document.querySelectorAll('.file-upload-box').forEach(box => {
        const fileInput = box.querySelector('input[type="file"]');
        box.addEventListener('click', (e) => {
            // Only trigger file input if clicking the box itself, not its children
            if (e.target === box) {
                fileInput.click();
            }
        });
    });

    // Add drag and drop handlers for file upload boxes
    document.querySelectorAll('.file-upload-box').forEach(box => {
        const fileInput = box.querySelector('input[type="file"]');
        const targetId = box.getAttribute('data-target');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            box.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            box.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            box.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            box.classList.add('drag-over');
        }

        function unhighlight(e) {
            box.classList.remove('drag-over');
        }

        box.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }

        function handleFiles(files) {
            if (files.length > 0) {
                const file = files[0];
                // Use the validateFileType utility function
                if (validateFileType(file, fileInput.accept)) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change'));
                } else {
                    alert('Invalid file type. Please upload a supported file.');
                }
            }
        }
    });
}

// Export the functions
export {
    uploadFile,
    setupFileInputPreview,
    handleFileUploads,
    setupDragAndDrop
};