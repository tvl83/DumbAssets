# File Upload Module

A modular service for handling file uploads, previews, and drag-and-drop functionality in the DumbAssets application.

## Features

- File upload handling for images, receipts, and manuals
- Drag and drop functionality with validation
- File preview generation
- Support for multiple file uploads
- Clean API for file handling operations

## Usage

```javascript
// Import the module
import { 
    setupFilePreview, 
    handleFileUploads, 
    setupDragAndDrop 
} from '../services/fileUpload';

// Initialize file previews
document.addEventListener('DOMContentLoaded', () => {
    // Setup file previews
    setupFilePreview('assetPhoto', 'photoPreview', false);
    setupFilePreview('assetReceipt', 'receiptPreview', true);
    setupFilePreview('assetManual', 'manualPreview', true);

    // Setup drag and drop
    setupDragAndDrop();
});

// Handle file uploads during form submission
async function saveAsset() {
    const asset = {...}; // your asset object
    const isEditMode = true; // or false for new assets
    
    // This will upload files and return updated asset with file paths
    const updatedAsset = await handleFileUploads(asset, isEditMode);
    
    // Continue with saving the asset
    // ...
}
```

## API

### `setupFilePreview(inputId, previewId, isDocument)`

Sets up file preview functionality for a file input.

- `inputId`: The ID of the file input element
- `previewId`: The ID of the preview container element
- `isDocument`: Whether the file is a document (true) or image (false)

### `handleFileUploads(asset, isEditMode, isSubAsset)`

Handles file uploads for an asset.

- `asset`: The asset object to upload files for
- `isEditMode`: Whether we're editing an existing asset or creating a new one
- `isSubAsset`: Whether this is a sub-asset (default: false)
- Returns: Promise that resolves to the updated asset with file paths

### `setupDragAndDrop()`

Sets up drag and drop functionality for all file upload boxes.

### `uploadFile(file, type, id)`

Uploads a file to the server.

- `file`: The file to upload
- `type`: The type of file ('image', 'receipt', or 'manual')
- `id`: The ID of the associated asset
- Returns: Promise that resolves to the path of the uploaded file, or null if the upload failed 