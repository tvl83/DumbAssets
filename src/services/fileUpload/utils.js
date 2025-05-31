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

/**
 * Sanitizes a filename to prevent malicious script calls.
 * Removes any characters except alphanumerics, dash, underscore, and dot.
 * Also strips leading/trailing dots and spaces, and collapses multiple dots.
 * @param {string} filename
 * @returns {string} sanitized filename
 */
export function sanitizeFileName(filename) {
    if (typeof filename !== 'string') return '';
    // Remove path separators and collapse multiple dots
    let sanitized = filename.replace(/[/\\]+/g, '')
        .replace(/\.+/g, '.')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/^\.+/, '')
        .replace(/\s+/g, '_')
        .replace(/\.+$/, '');
    // Prevent empty filename
    if (!sanitized) sanitized = 'file';
    return sanitized;
}