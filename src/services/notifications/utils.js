/**
 * Utility functions for Apprise Notification Service
 */

// Format a date as YYYY-MM-DD HH:mm:ss
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// Sanitize text for safe notification output
function sanitizeText(text) {
  if (!text) return '';
  return String(text).replace(/[\n\r]+/g, ' ').replace(/[^\w\s\-.,:;@#&()\[\]{}]/g, '');
}

module.exports = {
  formatDate,
  sanitizeText,
}; 