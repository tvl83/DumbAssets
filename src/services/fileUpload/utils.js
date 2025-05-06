/**
 * File Upload Utilities
 * Helper functions for file upload operations
 */

/**
 * Validates a file against accepted types
 * @param {File} file - The file to validate
 * @param {string} acceptString - A comma-separated string of accepted file types
 * @returns {boolean} - Whether the file is valid
 */
export function validateFileType(file, acceptString) {
    if (!file || !acceptString) return false;
    
    const acceptedTypes = acceptString.split(',').map(type => type.trim());
    const fileType = file.type;
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    return acceptedTypes.some(type => {
        if (type === 'image/*') return fileType.startsWith('image/');
        if (type.includes('*')) return fileType.startsWith(type.replace('*', ''));
        return type === fileType || type === fileExtension;
    });
}

/**
 * Formats a file size in bytes to a human-readable string
 * @param {number} bytes - The file size in bytes
 * @returns {string} - The formatted file size
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 