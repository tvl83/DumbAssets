// Utility functions for DumbAssets
// Place in public/helpers/utils.js

export function generateId() {
    // Generate a 10-digit ID
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

export function formatCurrency(amount) {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
