/**
 * File Upload Module
 * Handles file uploads, previews, and drag-and-drop functionality
 */

import { validateFileType, formatFileSize } from './utils.js';

/**
 * Upload a file to the server
 * @param {File} file - The file to upload
 * @param {string} type - The type of file ('image', 'receipt', or 'manual')
 * @param {string} id - The ID of the associated asset
 * @returns {Promise<string|null>} - The path of the uploaded file, or null if the upload failed
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
        return data.path;
    } catch (err) {
        console.error('File upload failed:', err);
        return null;
    }
}

/**
 * Setup file preview functionality for a file input
 * @param {string} inputId - The ID of the file input element
 * @param {string} previewId - The ID of the preview container element
 * @param {boolean} isDocument - Whether the file is a document (true) or image (false)
 */
function setupFilePreview(inputId, previewId, isDocument = false) {
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
                const previewItem = document.createElement('div');
                previewItem.className = 'file-preview-item';
                
                if (isDocument) {
                    // For documents, show icon and filename
                    previewItem.innerHTML = `
                        <div class="manual-preview">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span>${file.name}</span>
                            <span class="file-size">${formatFileSize(file.size)}</span>
                            <button type="button" class="delete-preview-btn" title="Delete File">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/>
                                    <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            </button>
                        </div>
                    `;
                } else {
                    // For images, show preview
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        previewItem.innerHTML = `
                            <img src="${e.target.result}" alt="Preview">
                            <div class="file-info">
                                <span>${file.name}</span>
                                <span class="file-size">${formatFileSize(file.size)}</span>
                            </div>
                            <button type="button" class="delete-preview-btn" title="Delete Image">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/>
                                    <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            </button>
                        `;
                    };
                    reader.readAsDataURL(file);
                }

                // Add delete handler
                const deleteBtn = previewItem.querySelector('.delete-preview-btn');
                if (deleteBtn) {
                    deleteBtn.onclick = () => {
                        if (confirm('Are you sure you want to delete this file?')) {
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
    // Clone the asset to avoid modifying the original
    const assetCopy = { ...asset };
    
    // Check and preserve required fields
    console.log('handleFileUploads starting with asset:', {
        id: assetCopy.id,
        name: assetCopy.name,
        parentId: assetCopy.parentId || null
    });
    
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
        return assetCopy; // Return unmodified asset if inputs are missing
    }
    
    // Initialize arrays for multiple files
    assetCopy.photoPaths = assetCopy.photoPaths || [];
    assetCopy.receiptPaths = assetCopy.receiptPaths || [];
    assetCopy.manualPaths = assetCopy.manualPaths || [];
    
    // Handle photo uploads
    if (photoInput.files && photoInput.files.length > 0) {
        for (const file of photoInput.files) {
            const photoPath = await uploadFile(file, 'image', assetCopy.id);
            if (photoPath) {
                assetCopy.photoPaths.push(photoPath);
            }
        }
        // Set the first photo as the main photo
        assetCopy.photoPath = assetCopy.photoPaths[0] || null;
    } else if (isEditMode) {
        // If editing and no new photos, preserve existing photo paths
        assetCopy.photoPath = asset.photoPath;
        assetCopy.photoPaths = asset.photoPaths || [];
    }
    
    // Handle receipt uploads
    if (receiptInput.files && receiptInput.files.length > 0) {
        for (const file of receiptInput.files) {
            const receiptPath = await uploadFile(file, 'receipt', assetCopy.id);
            if (receiptPath) {
                assetCopy.receiptPaths.push(receiptPath);
            }
        }
        // Set the first receipt as the main receipt
        assetCopy.receiptPath = assetCopy.receiptPaths[0] || null;
    } else if (isEditMode) {
        // If editing and no new receipts, preserve existing receipt paths
        assetCopy.receiptPath = asset.receiptPath;
        assetCopy.receiptPaths = asset.receiptPaths || [];
    }

    // Handle manual uploads
    if (manualInput.files && manualInput.files.length > 0) {
        for (const file of manualInput.files) {
            const manualPath = await uploadFile(file, 'manual', assetCopy.id);
            if (manualPath) {
                assetCopy.manualPaths.push(manualPath);
            }
        }
        // Set the first manual as the main manual
        assetCopy.manualPath = assetCopy.manualPaths[0] || null;
    } else if (isEditMode) {
        // If editing and no new manuals, preserve existing manual paths
        assetCopy.manualPath = asset.manualPath;
        assetCopy.manualPaths = asset.manualPaths || [];
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
    setupFilePreview,
    handleFileUploads,
    setupDragAndDrop
}; 