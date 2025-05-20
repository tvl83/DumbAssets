/**
 * DumbAssets - Asset Tracking Application
 * Main JavaScript file handling application logic
 */

// Import file upload module
import { initializeFileUploads, handleFileUploads } from '/src/services/fileUpload/index.js';
import { formatFileSize } from '/src/services/fileUpload/utils.js';
// Import asset renderer module
import { 
    initRenderer, 
    updateState, 
    updateSelectedIds, 
    renderAssetDetails,
    formatFilePath,
    // Import list renderer functions
    initListRenderer,
    updateListState,
    updateDashboardFilter,
    updateSort,
    renderAssetList,
    sortAssets,
    // Import file preview renderer
    setupFilePreview
} from '/src/services/render/index.js';

import { ChartManager } from '/managers/charts.js';

// Initialize chart manager
const chartManager = new ChartManager();

// Use setupFilePreview from the render index.js
import { registerServiceWorker } from './helpers/serviceWorkerHelper.js';
// Import collapsible sections functionality
import { initCollapsibleSections } from './js/collapsible.js';

// Initialize global variables for DOM elements
let assetModal, assetForm, subAssetModal, subAssetForm, assetList, assetDetails, subAssetContainer;
let searchInput, clearSearchBtn;

// Initialize variables for app state
let assets = [];
let subAssets = [];
let selectedAssetId = null;
let selectedSubAssetId = null;
let isEditMode = false;
let dashboardFilter = 'all';
let currentSort = { field: 'updatedAt', direction: 'desc' };

// Initialize variables for file deletion tracking
window.deletePhoto = false;
window.deleteReceipt = false;
window.deleteManual = false;
window.deleteSubPhoto = false;
window.deleteSubReceipt = false;
window.deleteSubManual = false;

// Store local references for easier access
let deletePhoto = window.deletePhoto;
let deleteReceipt = window.deleteReceipt;
let deleteManual = window.deleteManual;
let deleteSubPhoto = window.deleteSubPhoto;
let deleteSubReceipt = window.deleteSubReceipt;
let deleteSubManual = window.deleteSubManual;

// Initialize tag managers at the top with other app state variables
let assetTagManager = null;
let subAssetTagManager = null;

// DOM Elements
const subAssetList = document.getElementById('subAssetList');
const addAssetBtn = document.getElementById('addAssetBtn');
const addSubAssetBtn = document.getElementById('addSubAssetBtn');
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const mainContent = document.querySelector('.main-content');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sortNameBtn = document.getElementById('sortNameBtn');
const sortWarrantyBtn = document.getElementById('sortWarrantyBtn');

// Import functionality
const importModal = document.getElementById('importModal');
const importBtn = document.getElementById('importAssetsBtn');
const importFile = document.getElementById('importFile');
// const selectedFileName = document.getElementById('selectedFileName');
const startImportBtn = document.getElementById('startImportBtn');
const columnSelects = document.querySelectorAll('.column-select');

// Notification Settings UI Logic
const notificationBtn = document.getElementById('notificationBtn');
const notificationModal = document.getElementById('notificationModal');
const notificationForm = document.getElementById('notificationForm');
const saveNotificationSettings = document.getElementById('saveNotificationSettings');
const cancelNotificationSettings = document.getElementById('cancelNotificationSettings');
const notificationClose = notificationModal.querySelector('.close-btn');
const testNotificationSettings = document.getElementById('testNotificationSettings');

// Utility Functions
function generateId() {
    // Generate a 10-digit ID
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Button loading state handler
function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Data Functions
async function loadAssets() {
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/assets`, {
            credentials: 'include'
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = `${apiBaseUrl}/login`;
                return;
            }
            throw new Error('Failed to load assets');
        }
        assets = await response.json();
        // Update asset list in the modules
        updateState(assets, subAssets);
        updateListState(assets, subAssets, selectedAssetId);
        renderAssetList();
    } catch (error) {
        console.error('Error loading assets:', error);
        assets = [];
        updateState(assets, subAssets);
        updateListState(assets, subAssets, selectedAssetId);
        renderAssetList();
    }
}

async function loadSubAssets() {
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/subassets`, {
            credentials: 'include'
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = `${apiBaseUrl}/login`;
                return;
            }
            throw new Error('Failed to load sub-assets');
        }
        subAssets = await response.json();
        updateState(assets, subAssets);
        updateListState(assets, subAssets, selectedAssetId);
    } catch (error) {
        console.error('Error loading sub-assets:', error);
        subAssets = [];
        updateState(assets, subAssets);
        updateListState(assets, subAssets, selectedAssetId);
    }
}

// Load both assets and sub-assets, then render the dashboard
async function loadAllData() {
    await Promise.all([loadAssets(), loadSubAssets()]);
    renderEmptyState(); // This will call renderDashboard()
}

// Also add a dedicated refresh function to reload data without resetting the UI
async function refreshAllData() {
    try {
        await Promise.all([loadAssets(), loadSubAssets()]);
        return true;
    } catch (error) {
        console.error('Error refreshing data:', error);
        return false;
    }
}

// Helper function to get the API base URL
function getApiBaseUrl() {
    return window.location.origin + (window.appConfig?.basePath || '');
}

async function saveAsset(asset) {
    const saveBtn = assetForm.querySelector('.save-btn');
    setButtonLoading(saveBtn, true);

    try {
        const apiBaseUrl = getApiBaseUrl();
        
        // Create a copy to avoid mutation issues
        const assetToSave = { ...asset };
        
        console.log('Starting saveAsset with data:', {
            id: assetToSave.id,
            name: assetToSave.name,
            photoPath: assetToSave.photoPath,
            receiptPath: assetToSave.receiptPath,
            manualPath: assetToSave.manualPath
        });
        
        // Log the current state of delete flags
        console.log('Current delete flags:', {
            deletePhoto: window.deletePhoto,
            deleteReceipt: window.deleteReceipt,
            deleteManual: window.deleteManual
        });
        
        // Handle file deletions
        if (deletePhoto && assetToSave.photoPath) {
            console.log(`Deleting photo: ${assetToSave.photoPath}`);
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: assetToSave.photoPath }),
                credentials: 'include'
            });
            assetToSave.photoPath = null;
        }
        
        if (deleteReceipt && assetToSave.receiptPath) {
            console.log(`Deleting receipt: ${assetToSave.receiptPath}`);
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: assetToSave.receiptPath }),
                credentials: 'include'
            });
            assetToSave.receiptPath = null;
        }
        
        if (deleteManual && assetToSave.manualPath) {
            console.log(`Deleting manual: ${assetToSave.manualPath}`);
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: assetToSave.manualPath }),
                credentials: 'include'
            });
            assetToSave.manualPath = null;
        }
        
        console.log('After handling deletions, asset state:', {
            photoPath: assetToSave.photoPath,
            receiptPath: assetToSave.receiptPath,
            manualPath: assetToSave.manualPath
        });
        
        // Make the API call to save the asset
        const response = await fetch(`${apiBaseUrl}/api/asset`, {
            method: isEditMode ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assetToSave),
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to save asset');
        
        // Get the saved asset from the response
        const savedAsset = await response.json();
        console.log('Asset saved successfully. Response data:', {
            id: savedAsset.id,
            name: savedAsset.name,
            photoPath: savedAsset.photoPath,
            receiptPath: savedAsset.receiptPath,
            manualPath: savedAsset.manualPath
        });
        
        // Reload all data to ensure everything is updated
        await refreshAllData();
        
        // Close the modal
        closeAssetModal();
        
        // Reset delete flags both locally and on window
        deletePhoto = window.deletePhoto = false;
        deleteReceipt = window.deleteReceipt = false;
        deleteManual = window.deleteManual = false;
        
        // Always explicitly render the asset details if it's the current selection
        // or if this is a new asset that should be selected
        if (selectedAssetId === assetToSave.id || !selectedAssetId) {
            selectedAssetId = savedAsset.id;
            
            // Force a refresh of the asset from the server data
            const refreshedAsset = assets.find(a => a.id === savedAsset.id);
            if (refreshedAsset) {
                console.log('Refreshing asset display with data:', {
                    photoPath: refreshedAsset.photoPath,
                    receiptPath: refreshedAsset.receiptPath,
                    manualPath: refreshedAsset.manualPath
                });
            }
            
            refreshAssetDetails(savedAsset.id, false);
        }
        
        // Show success message
        showToast(isEditMode ? "Asset updated successfully!" : "Asset added successfully!");
        setButtonLoading(saveBtn, false);
    } catch (error) {
        console.error('Error saving asset:', error);
        alert('Error saving asset. Please try again.');
        setButtonLoading(saveBtn, false);
    }
}

async function saveSubAsset(subAsset) {
    const saveBtn = subAssetForm.querySelector('.save-btn');
    setButtonLoading(saveBtn, true);

    try {
        const apiBaseUrl = getApiBaseUrl();
        
        // Debug logging to see what we're sending
        console.log('Saving sub-asset with data:', JSON.stringify(subAsset, null, 2));
        
        // Check for required fields that server expects
        if (!subAsset.id) {
            console.error('Missing required field: id');
        }
        if (!subAsset.name) {
            console.error('Missing required field: name');
        }
        if (!subAsset.parentId) {
            console.error('Missing required field: parentId');
        }
        
        // Ensure we're sending the required fields
        if (!subAsset.id || !subAsset.name || !subAsset.parentId) {
            throw new Error('Missing required fields for sub-asset. Check the console for details.');
        }
        
        if (deleteSubPhoto && subAsset.photoPath) {
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: subAsset.photoPath }),
                credentials: 'include'
            });
            subAsset.photoPath = null;
        }
        if (deleteSubReceipt && subAsset.receiptPath) {
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: subAsset.receiptPath }),
                credentials: 'include'
            });
            subAsset.receiptPath = null;
        }
        if (deleteSubManual && subAsset.manualPath) {
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: subAsset.manualPath }),
                credentials: 'include'
            });
            subAsset.manualPath = null;
        }
        
        const response = await fetch(`${apiBaseUrl}/api/subasset`, {
            method: isEditMode ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subAsset),
            credentials: 'include'
        });
        
        if (!response.ok) {
            // Get detailed error from response if available
            const errorText = await response.text();
            console.error('Server response:', response.status, errorText);
            throw new Error(`Failed to save sub-asset: ${errorText}`);
        }
        
        // Get the updated sub-asset from the response
        const savedSubAsset = await response.json();
        console.log('Server response with updated sub-asset:', savedSubAsset);
        
        // Reload all data to ensure everything is updated
        await refreshAllData();
        
        // Close the modal
        closeSubAssetModal();
        
        // Determine which view to render after saving
        if (subAsset.parentSubId) {
            // If this is a sub-sub-asset, go to the parent sub-asset view
            refreshAssetDetails(subAsset.parentSubId, true);
        } else if (selectedSubAssetId === subAsset.id) {
            // If we're editing the currently viewed sub-asset
            refreshAssetDetails(subAsset.id, true);
        } else {
            // Navigate based on the saved component's context
            await handleComponentNavigation(savedSubAsset);
        }
        
        // Show success message
        showToast(isEditMode ? "Component updated successfully!" : "Component added successfully!");
        setButtonLoading(saveBtn, false);
    } catch (error) {
        console.error('Error saving sub-asset:', error);
        alert('Error saving component. Please try again.');
        setButtonLoading(saveBtn, false);
    }
}

async function deleteAsset(assetId) {
    if (!confirm('Are you sure you want to delete this asset? This will also delete all its components.')) {
        return;
    }
    
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/asset/${assetId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to delete asset');
        updateSelectedIds(null, null);
        await refreshAllData();
        renderEmptyState();
        showToast("Asset deleted successfully!");
    } catch (error) {
        console.error('Error deleting asset:', error);
        alert('Error deleting asset. Please try again.');
    }
}

async function deleteSubAsset(subAssetId) {
    if (!confirm('Are you sure you want to delete this component? This will also delete any sub-components.')) {
        return;
    }
    
    try {
        const apiBaseUrl = getApiBaseUrl();
        
        // Find the sub-asset and its parent info before deleting
        const subAsset = subAssets.find(s => s.id === subAssetId);
        if (!subAsset) {
            throw new Error('Sub-asset not found');
        }
        
        // Store parent info for later
        const parentAssetId = subAsset.parentId;
        const parentSubId = subAsset.parentSubId;

        const response = await fetch(`${apiBaseUrl}/api/subasset/${subAssetId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to delete component');

        // Refresh all data first to ensure we have the latest state
        await refreshAllData();

        // Handle navigation and refresh views based on deleted component's context
        await handleComponentNavigation({ id: subAssetId, parentId: parentAssetId, parentSubId }, true);

        // If viewing the parent sub-asset or asset, refresh the current view
        if (selectedSubAssetId === parentSubId) {
            await refreshAssetDetails(parentSubId, true);
        } else if (selectedAssetId === parentAssetId && !selectedSubAssetId) {
            await refreshAssetDetails(parentAssetId, false);
        }
        
        showToast("Component deleted successfully!");
    } catch (error) {
        console.error('Error deleting component:', error);
        alert('Error deleting component. Please try again.');
    }
}

// Utility function to handle component navigation and rendering logic
async function handleComponentNavigation(component, isDeleted = false) {
    const parentAssetId = component.parentId;
    const parentSubId = component.parentSubId;

    // Case 1: If the component was being viewed when deleted
    // Or if it's a new/updated component and we want to show it
    if (!isDeleted && (component.id === selectedSubAssetId || !parentSubId)) {
        updateSelectedIds(selectedAssetId, component.id);
        await refreshAssetDetails(component.id, true);
        return;
    }

    // Case 2: Navigate to parent sub-asset if this was a sub-sub-asset
    if (parentSubId) {
        updateSelectedIds(selectedAssetId, parentSubId);
        await refreshAssetDetails(parentSubId, true);
        return;
    }

    // Case 3: Navigate to parent asset
    updateSelectedIds(parentAssetId, null);
    await refreshAssetDetails(parentAssetId, false);
}

// Rendering Functions
function renderDashboard() {
    // Calculate stats
    const totalAssets = assets.length;
    const totalSubAssets = subAssets.length;
    // Total Components is just the count of sub-assets
    const totalComponents = totalSubAssets;
    
    // Calculate total value including sub-assets
    const totalAssetsValue = assets.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
    const totalSubAssetsValue = subAssets.reduce((sum, sa) => sum + (parseFloat(sa.purchasePrice) || 0), 0);
    const totalValue = totalAssetsValue + totalSubAssetsValue;
    
    // Get all assets with warranties (both main assets and sub-assets)
    const assetWarranties = assets.filter(a => a.warranty && a.warranty.expirationDate);
    const subAssetWarranties = subAssets.filter(sa => sa.warranty && sa.warranty.expirationDate);
    const allWarranties = [...assetWarranties, ...subAssetWarranties];
    
    const now = new Date();
    let expired = 0, within60 = 0, within30 = 0, active = 0;
    
    allWarranties.forEach(item => {
        const exp = new Date(item.warranty.expirationDate);
        if (isNaN(exp)) return;
        
        const diff = (exp - now) / (1000 * 60 * 60 * 24);
        if (diff < 0) {
            expired++;
        } else if (diff <= 30) {
            within30++;
        } else if (diff <= 60) {
            within60++;
            active++;
        } else {
            active++;
        }
    });
    
    assetDetails.innerHTML = `
        <div class="dashboard">
            <h2 class="dashboard-title">Asset Overview</h2>
            <div class="dashboard-section">
                <div class="section-title">Totals</div>
                <div class="dashboard-cards totals-cards">
                    <div class="dashboard-card total${!dashboardFilter ? ' active' : ''}" data-filter="all">
                        <div class="card-label">Assets</div>
                        <div class="card-value">${totalAssets}</div>
                    </div>
                    <div class="dashboard-card components${dashboardFilter === 'components' ? ' active' : ''}" data-filter="components">
                        <div class="card-label">Components</div>
                        <div class="card-value">${totalComponents}</div>
                    </div>
                    <div class="dashboard-card value" data-filter="value">
                        <div class="card-label">Value</div>
                        <div class="card-value">${formatCurrency(totalValue)}</div>
                    </div>
                </div>
            </div>
            <div class="dashboard-section dashboard-warranty-section">
                <div class="section-title">Warranties</div>
                <div class="dashboard-cards warranty-cards">
                    <div class="dashboard-card warranties${dashboardFilter === 'warranties' ? ' active' : ''}" data-filter="warranties">
                        <div class="card-label">Total</div>
                        <div class="card-value">${allWarranties.length}</div>
                    </div>
                    <div class="dashboard-card within60${dashboardFilter === 'within60' ? ' active' : ''}" data-filter="within60">
                        <div class="card-label">In 60 days</div>
                        <div class="card-value">${within60}</div>
                    </div>
                    <div class="dashboard-card within30${dashboardFilter === 'within30' ? ' active' : ''}" data-filter="within30">
                        <div class="card-label">In 30 days</div>
                        <div class="card-value">${within30}</div>
                    </div>
                    <div class="dashboard-card expired${dashboardFilter === 'expired' ? ' active' : ''}" data-filter="expired">
                        <div class="card-label">Expired</div>
                        <div class="card-value">${expired}</div>
                    </div>
                    <div class="dashboard-card active-status${dashboardFilter === 'active' ? ' active' : ''}" data-filter="active">
                        <div class="card-label">Active</div>
                        <div class="card-value">${active}</div>
                    </div>
                </div>
            </div>
            <div class="dashboard-section">
                <div class="section-title">Analytics</div>
                <div class="dashboard-charts-section">
                    <div class="chart-container">
                        <h3>Warranty Status</h3>
                        <canvas id="warrantyPieChart" class="chart-canvas"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>Warranties Expiring Over Time</h3>
                        <canvas id="warrantyLineChart" class="chart-canvas"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create charts after the HTML has been added to the DOM
    chartManager.createWarrantyDashboard({ allWarranties, expired, within30, within60, active });
    
    // Add click handler for clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Remove active class from all cards
            assetDetails.querySelectorAll('.dashboard-card').forEach(c => {
                c.classList.remove('active');
            });

            // Reset all sort buttons to default state
            document.querySelectorAll('.sort-button').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('data-direction', 'asc');
                const sortIcon = btn.querySelector('.sort-icon');
                if (sortIcon) {
                    sortIcon.style.transform = '';
                }
            });
            
            // Reset filter and sort
            dashboardFilter = null;
            currentSort = { field: 'updatedAt', direction: 'desc' };
            updateDashboardFilter(null);
            updateSort(currentSort);

            // Reset selected asset and hide components section
            selectedAssetId = null;
            updateSelectedIds(null, null);
            
            // Re-render list and dashboard
            searchInput.value = '';
            renderAssetList(searchInput.value);
            renderEmptyState();
        });
    }

    // Add click handlers for filtering (except value card)
    assetDetails.querySelectorAll('.dashboard-card').forEach(card => {
        if (card.getAttribute('data-filter') === 'value') return;
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const filter = card.getAttribute('data-filter');
            
            // Remove active class from all cards
            assetDetails.querySelectorAll('.dashboard-card').forEach(c => {
                c.classList.remove('active');
            });
            
            // Add active class to clicked card
            card.classList.add('active');
            
            if (filter === 'all') {
                dashboardFilter = null;
            } else {
                dashboardFilter = filter;
            }
            updateDashboardFilter(dashboardFilter);
            renderAssetList(searchInput.value);
            if (!selectedAssetId) renderDashboard();
        });
    });
}

// In renderAssetList, only call renderDashboard if no asset is selected
// function renderAssetList has been moved to the listRenderer module

// Chart functionality has been moved to /public/managers/charts.js

function renderEmptyState() {
    // Always render dashboard when showing empty state
    renderDashboard();
    subAssetContainer.classList.add('hidden');
}

// Modal Functions
function openAssetModal(asset = null) {
    if (!assetModal || !assetForm) return;
    isEditMode = !!asset;
    document.getElementById('addAssetTitle').textContent = isEditMode ? 'Edit Asset' : 'Add Asset';
    assetForm.reset();
    
    // Reset loading state of save button
    const saveBtn = assetForm.querySelector('.save-btn');
    setButtonLoading(saveBtn, false);

    // Reset delete flags both locally and on window
    deletePhoto = window.deletePhoto = false;
    deleteReceipt = window.deleteReceipt = false;
    deleteManual = window.deleteManual = false;
    
    // Reset secondary warranty fields
    const secondaryWarrantyFields = document.getElementById('secondaryWarrantyFields');
    if (secondaryWarrantyFields) {
        secondaryWarrantyFields.style.display = 'none';
    }
    
    // Set up secondary warranty button
    const addSecondaryWarrantyBtn = document.getElementById('addSecondaryWarranty');
    if (addSecondaryWarrantyBtn) {
        addSecondaryWarrantyBtn.setAttribute('aria-expanded', 'false');
        addSecondaryWarrantyBtn.setAttribute('aria-controls', 'secondaryWarrantyFields');
        addSecondaryWarrantyBtn.title = 'Add Secondary Warranty';
        addSecondaryWarrantyBtn.onclick = () => {
            const fields = document.getElementById('secondaryWarrantyFields');
            const expanded = fields && fields.style.display !== 'none';
            if (fields) {
                if (expanded) {
                    fields.style.display = 'none';
                    addSecondaryWarrantyBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Warranty`;
                    addSecondaryWarrantyBtn.title = 'Add Secondary Warranty';
                    addSecondaryWarrantyBtn.setAttribute('aria-expanded', 'false');
                } else {
                    fields.style.display = 'block';
                    addSecondaryWarrantyBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Remove Secondary Warranty`;
                    addSecondaryWarrantyBtn.title = 'Remove Secondary Warranty';
                    addSecondaryWarrantyBtn.setAttribute('aria-expanded', 'true');
                }
            }
        };
    }
    
    // Clear file inputs and previews
    const photoInput = document.getElementById('assetPhoto');
    const receiptInput = document.getElementById('assetReceipt');
    const manualInput = document.getElementById('assetManual');
    const photoPreview = document.getElementById('photoPreview');
    const receiptPreview = document.getElementById('receiptPreview');
    const manualPreview = document.getElementById('manualPreview');
    
    if (!isEditMode) {
        // Clear file inputs and previews for new assets
        if (photoInput) photoInput.value = '';
        if (receiptInput) receiptInput.value = '';
        if (manualInput) manualInput.value = '';
        if (photoPreview) photoPreview.innerHTML = '';
        if (receiptPreview) receiptPreview.innerHTML = '';
        if (manualPreview) manualPreview.innerHTML = '';
    }
    
    if (isEditMode && asset) {
        document.getElementById('assetName').value = asset.name || '';
        document.getElementById('assetModel').value = asset.modelNumber || '';
        document.getElementById('assetManufacturer').value = asset.manufacturer || '';
        document.getElementById('assetSerial').value = asset.serialNumber || '';
        document.getElementById('assetPurchaseDate').value = asset.purchaseDate || '';
        document.getElementById('assetPrice').value = asset.price || '';
        document.getElementById('assetWarrantyScope').value = asset.warranty?.scope || '';
        document.getElementById('assetWarrantyExpiration').value = asset.warranty?.expirationDate ? new Date(asset.warranty.expirationDate).toISOString().split('T')[0] : '';
        document.getElementById('assetDescription').value = asset.description || '';
        document.getElementById('assetLink').value = asset.link || '';
        
        // Set tags
        assetTagManager.setTags(asset.tags || []);
        
        // Handle secondary warranty
        if (asset.secondaryWarranty) {
            const secondaryWarrantyFields = document.getElementById('secondaryWarrantyFields');
            if (secondaryWarrantyFields) {
                secondaryWarrantyFields.style.display = 'block';
                document.getElementById('assetSecondaryWarrantyScope').value = asset.secondaryWarranty.scope || '';
                document.getElementById('assetSecondaryWarrantyExpiration').value = asset.secondaryWarranty.expirationDate ? new Date(asset.secondaryWarranty.expirationDate).toISOString().split('T')[0] : '';
                if (addSecondaryWarrantyBtn) {
                    addSecondaryWarrantyBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Remove Secondary Warranty`;
                    addSecondaryWarrantyBtn.title = 'Remove Secondary Warranty';
                    addSecondaryWarrantyBtn.setAttribute('aria-expanded', 'true');
                }
            }
        } else {
            if (addSecondaryWarrantyBtn) {
                addSecondaryWarrantyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Warranty`;
                addSecondaryWarrantyBtn.title = 'Add Secondary Warranty';
                addSecondaryWarrantyBtn.setAttribute('aria-expanded', 'false');
            }
        }
        
        document.getElementById('assetLink').value = asset.link || '';
        document.getElementById('assetDescription').value = asset.description || '';
        
        // Set tags
        assetTagManager.setTags(asset.tags || []);

        // Preview existing files using our utility function
        if (asset.photoPath) {
            const photoInfo = asset.photoInfo?.[0] || {};
            setupFilePreview(
                photoPreview, 
                'photo', 
                formatFilePath(asset.photoPath), 
                photoInput, 
                { deletePhoto }, 
                'deletePhoto',
                photoInfo.originalName || asset.photoPath.split('/').pop(),
                photoInfo.size ? formatFileSize(photoInfo.size) : 'Unknown size'
            );
        }
        
        if (asset.receiptPath) {
            const receiptInfo = asset.receiptInfo?.[0] || {};
            setupFilePreview(
                receiptPreview, 
                'receipt', 
                formatFilePath(asset.receiptPath), 
                receiptInput, 
                { deleteReceipt }, 
                'deleteReceipt',
                receiptInfo.originalName || asset.receiptPath.split('/').pop(),
                receiptInfo.size ? formatFileSize(receiptInfo.size) : 'Unknown size'
            );
        }
        
        if (asset.manualPath) {
            const manualInfo = asset.manualInfo?.[0] || {};
            setupFilePreview(
                manualPreview, 
                'manual', 
                formatFilePath(asset.manualPath), 
                manualInput, 
                { deleteManual }, 
                'deleteManual',
                manualInfo.originalName || asset.manualPath.split('/').pop(),
                manualInfo.size ? formatFileSize(manualInfo.size) : 'Unknown size'
            );
            manualPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this manual?')) {
                    manualPreview.innerHTML = '';
                    manualInput.value = '';
                    deleteManual = window.deleteManual = true;
                }
            };
        }
    } else {
        assetForm.reset();
        assetTagManager.setTags([]);
    }
    // Set up form submission
    assetForm.onsubmit = (e) => {
        e.preventDefault();
        
        // Create asset object
        const newAsset = {
            name: document.getElementById('assetName').value,
            modelNumber: document.getElementById('assetModel').value,
            manufacturer: document.getElementById('assetManufacturer').value,
            serialNumber: document.getElementById('assetSerial').value,
            purchaseDate: document.getElementById('assetPurchaseDate').value,
            price: parseFloat(document.getElementById('assetPrice').value) || null,
            warranty: {
                scope: document.getElementById('assetWarrantyScope').value,
                expirationDate: document.getElementById('assetWarrantyExpiration').value
            },
            link: document.getElementById('assetLink').value,
            description: document.getElementById('assetDescription').value,
            tags: assetTagManager.getTags(),
            updatedAt: new Date().toISOString()
        };
        
        // Add secondary warranty if fields are visible and filled
        const secondaryWarrantyFields = document.getElementById('secondaryWarrantyFields');
        if (secondaryWarrantyFields && secondaryWarrantyFields.style.display !== 'none') {
            const secondaryScope = document.getElementById('assetSecondaryWarrantyScope').value;
            const secondaryExpiration = document.getElementById('assetSecondaryWarrantyExpiration').value;
            if (secondaryScope || secondaryExpiration) {
                newAsset.secondaryWarranty = {
                    scope: secondaryScope,
                    expirationDate: secondaryExpiration
                };
            }
        }
        
        // Add ID if editing, generate new one if adding
        if (isEditMode && asset) {
            newAsset.id = asset.id;
            newAsset.photoPath = asset.photoPath;
            newAsset.receiptPath = asset.receiptPath;
            newAsset.manualPath = asset.manualPath;
            newAsset.createdAt = asset.createdAt;
        } else {
            newAsset.id = generateId();
            newAsset.photoPath = null;
            newAsset.receiptPath = null;
            newAsset.manualPath = null;
            newAsset.createdAt = new Date().toISOString();
        }
        
        // Handle file uploads then save
        handleFileUploads(newAsset, isEditMode)
            .then(updatedAsset => saveAsset(updatedAsset));
    };
    
    // Set up cancel button
    const cancelBtn = assetForm.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            closeAssetModal();
        };
    }
    
    // Set up close button
    const closeBtn = assetModal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            closeAssetModal();
        };
    }
    
    // Show the modal
    assetModal.style.display = 'block';
    
    // // Initialize collapsible sections in the modal - with a slight delay to ensure content is visible
    // setTimeout(() => {
    //     initCollapsibleSections();
    // }, 50);
}

function closeAssetModal() {
    if (!assetModal) return;
    
    // Reset loading state of save button
    const saveBtn = assetForm.querySelector('.save-btn');
    setButtonLoading(saveBtn, false);

    // Clear file inputs and previews
    const photoInput = document.getElementById('assetPhoto');
    const receiptInput = document.getElementById('assetReceipt');
    const manualInput = document.getElementById('assetManual');
    const photoPreview = document.getElementById('photoPreview');
    const receiptPreview = document.getElementById('receiptPreview');
    const manualPreview = document.getElementById('manualPreview');

    if (photoInput) photoInput.value = '';
    if (receiptInput) receiptInput.value = '';
    if (manualInput) manualInput.value = '';
    if (photoPreview) photoPreview.innerHTML = '';
    if (receiptPreview) receiptPreview.innerHTML = '';
    if (manualPreview) manualPreview.innerHTML = '';

    assetModal.style.display = 'none';
}

function openSubAssetModal(subAsset = null, parentId = null, parentSubId = null) {
    if (!subAssetModal || !subAssetForm) return;
    isEditMode = !!subAsset;
    document.getElementById('addComponentTitle').textContent = isEditMode ? 'Edit Component' : 'Add Component';
    subAssetForm.reset();
    
    // Reset loading state of save button
    const saveBtn = subAssetForm.querySelector('.save-btn');
    setButtonLoading(saveBtn, false);

    // Reset delete flags both locally and on window
    deleteSubPhoto = window.deleteSubPhoto = false;
    deleteSubReceipt = window.deleteSubReceipt = false;
    deleteSubManual = window.deleteSubManual = false;
    
    // Clear file inputs and previews
    const photoInput = document.getElementById('subAssetPhoto');
    const receiptInput = document.getElementById('subAssetReceipt');
    const manualInput = document.getElementById('subAssetManual');
    const photoPreview = document.getElementById('subPhotoPreview');
    const receiptPreview = document.getElementById('subReceiptPreview');
    const manualPreview = document.getElementById('subManualPreview');
    
    if (!isEditMode) {
        // Clear file inputs and previews for new assets
        if (photoInput) photoInput.value = '';
        if (receiptInput) receiptInput.value = '';
        if (manualInput) manualInput.value = '';
        if (photoPreview) photoPreview.innerHTML = '';
        if (receiptPreview) receiptPreview.innerHTML = '';
        if (manualPreview) manualPreview.innerHTML = '';
    }
    
    // Set parent ID - Add null checks to prevent errors
    const parentIdInput = document.getElementById('parentAssetId');
    const parentSubIdInput = document.getElementById('parentSubAssetId');
    
    if (parentIdInput) parentIdInput.value = '';
    if (parentSubIdInput) parentSubIdInput.value = '';
    
    if (parentId && parentIdInput) {
        parentIdInput.value = parentId;
    }
    if (parentSubId && parentSubIdInput) {
        parentSubIdInput.value = parentSubId;
    }
    
    if (isEditMode && subAsset) {
        const idInput = document.getElementById('subAssetId');
        const nameInput = document.getElementById('subAssetName');
        const manufacturerInput = document.getElementById('subAssetManufacturer');
        const modelInput = document.getElementById('subAssetModel');
        const serialInput = document.getElementById('subAssetSerial');
        const purchaseDateInput = document.getElementById('subAssetPurchaseDate');
        const purchasePriceInput = document.getElementById('subAssetPurchasePrice');
        const notesInput = document.getElementById('subAssetNotes');
        const warrantyScopeInput = document.getElementById('subAssetWarrantyScope');
        const warrantyExpirationInput = document.getElementById('subAssetWarrantyExpiration');
        
        if (idInput) idInput.value = subAsset.id;
        if (nameInput) nameInput.value = subAsset.name || '';
        if (manufacturerInput) manufacturerInput.value = subAsset.manufacturer || '';
        if (modelInput) modelInput.value = subAsset.modelNumber || '';
        if (serialInput) serialInput.value = subAsset.serialNumber || '';
        if (purchaseDateInput) purchaseDateInput.value = subAsset.purchaseDate || '';
        if (purchasePriceInput) purchasePriceInput.value = subAsset.purchasePrice || '';
        if (parentIdInput) parentIdInput.value = subAsset.parentId || parentId || '';
        if (parentSubIdInput) parentSubIdInput.value = subAsset.parentSubId || parentSubId || '';
        if (notesInput) notesInput.value = subAsset.notes || '';
        if (warrantyScopeInput) warrantyScopeInput.value = subAsset.warranty?.scope || '';
        if (warrantyExpirationInput) warrantyExpirationInput.value = subAsset.warranty?.expirationDate ? new Date(subAsset.warranty.expirationDate).toISOString().split('T')[0] : '';
        
        // Set tags
        subAssetTagManager.setTags(subAsset.tags || []);

        // Preview existing images if available
        if (subAsset.photoPath) {
            const photoInfo = subAsset.photoInfo?.[0] || {};
            setupFilePreview(
                photoPreview, 
                'photo', 
                formatFilePath(subAsset.photoPath), 
                photoInput, 
                { deleteSubPhoto }, 
                'deleteSubPhoto',
                photoInfo.originalName || subAsset.photoPath.split('/').pop(),
                photoInfo.size ? formatFileSize(photoInfo.size) : 'Unknown size'
            );
        }
        
        if (subAsset.receiptPath) {
            const receiptInfo = subAsset.receiptInfo?.[0] || {};
            setupFilePreview(
                receiptPreview, 
                'receipt', 
                formatFilePath(subAsset.receiptPath), 
                receiptInput, 
                { deleteSubReceipt }, 
                'deleteSubReceipt',
                receiptInfo.originalName || subAsset.receiptPath.split('/').pop(),
                receiptInfo.size ? formatFileSize(receiptInfo.size) : 'Unknown size'
            );
        }
        
        if (subAsset.manualPath) {
            const manualInfo = subAsset.manualInfo?.[0] || {};
            setupFilePreview(
                manualPreview, 
                'manual', 
                formatFilePath(subAsset.manualPath), 
                manualInput, 
                { deleteSubManual }, 
                'deleteSubManual',
                manualInfo.originalName || subAsset.manualPath.split('/').pop(),
                manualInfo.size ? formatFileSize(manualInfo.size) : 'Unknown size');
            manualPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this manual?')) {
                    manualPreview.innerHTML = '';
                    manualInput.value = '';
                    deleteSubManual = window.deleteSubManual = true;
                }
            };
        }
    } else {
        subAssetForm.reset();
        subAssetTagManager.setTags([]);
    }
    
    // Set up form submission
    subAssetForm.onsubmit = (e) => {
        e.preventDefault();
        
        // Create sub-asset object with null checks
        const nameInput = document.getElementById('subAssetName');
        const modelInput = document.getElementById('subAssetModel');
        const serialInput = document.getElementById('subAssetSerial');
        const purchaseDateInput = document.getElementById('subAssetPurchaseDate');
        const purchasePriceInput = document.getElementById('subAssetPurchasePrice');
        const parentIdInput = document.getElementById('parentAssetId');
        const parentSubIdInput = document.getElementById('parentSubAssetId');
        const notesInput = document.getElementById('subAssetNotes');
        const idInput = document.getElementById('subAssetId');
        const warrantyScopeInput = document.getElementById('subAssetWarrantyScope');
        const warrantyExpirationInput = document.getElementById('subAssetWarrantyExpiration');
        
        // Ensure required fields exist and have values
        if (!nameInput || !nameInput.value.trim()) {
            alert('Name is required');
            return;
        }
        
        if (!parentIdInput || !parentIdInput.value.trim()) {
            console.error('Missing parent ID!');
            alert('Parent ID is required. Please try again.');
            return;
        }
        
        const newSubAsset = {
            id: idInput && idInput.value ? idInput.value : generateId(), // Generate new ID if not editing
            name: nameInput ? nameInput.value : '',
            manufacturer: document.getElementById('subAssetManufacturer').value,
            modelNumber: modelInput ? modelInput.value : '',
            serialNumber: serialInput ? serialInput.value : '',
            purchaseDate: purchaseDateInput ? purchaseDateInput.value : '',
            purchasePrice: purchasePriceInput ? parseFloat(purchasePriceInput.value) || null : null,
            parentId: parentIdInput ? parentIdInput.value : '',
            parentSubId: parentSubIdInput ? parentSubIdInput.value : '',
            notes: notesInput ? notesInput.value : '',
            tags: subAssetTagManager.getTags(),
            warranty: {
                scope: warrantyScopeInput ? warrantyScopeInput.value : '',
                expirationDate: warrantyExpirationInput ? warrantyExpirationInput.value : ''
            },
            updatedAt: new Date().toISOString()
        };
        
        // Debug log the sub-asset data before file uploads
        console.log('Sub-asset data before file uploads:', {
            id: newSubAsset.id,
            name: newSubAsset.name,
            parentId: newSubAsset.parentId,
            parentSubId: newSubAsset.parentSubId,
            warranty: newSubAsset.warranty
        });
        
        // Add file info if editing, generate new paths if adding
        if (isEditMode && subAsset) {
            newSubAsset.photoPath = subAsset.photoPath;
            newSubAsset.receiptPath = subAsset.receiptPath;
            newSubAsset.manualPath = subAsset.manualPath;
            newSubAsset.createdAt = subAsset.createdAt;
            
            // Handle file deletions
            if (deleteSubPhoto) newSubAsset.photoPath = null;
            if (deleteSubReceipt) newSubAsset.receiptPath = null;
            if (deleteSubManual) newSubAsset.manualPath = null;
        } else {
            newSubAsset.photoPath = null;
            newSubAsset.receiptPath = null;
            newSubAsset.manualPath = null;
            newSubAsset.createdAt = new Date().toISOString();
        }
        
        // Handle file uploads then save
        handleFileUploads(newSubAsset, isEditMode, true)
            .then(updatedSubAsset => saveSubAsset(updatedSubAsset));
    };
    
    // Set up cancel button
    const cancelBtn = subAssetForm.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            closeSubAssetModal();
        };
    }
    
    // Set up close button
    const closeBtn = subAssetModal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            closeSubAssetModal();
        };
    }
    
    // Show the modal
    subAssetModal.style.display = 'block';
    
    // // Initialize any collapsible sections in the modal
    // setTimeout(() => {
    //     initCollapsibleSections();
    // }, 50);
}

function closeSubAssetModal() {
    if (!subAssetModal) return;
    
    // Reset loading state of save button
    const saveBtn = subAssetForm.querySelector('.save-btn');
    setButtonLoading(saveBtn, false);

    // Clear file inputs and previews
    const photoInput = document.getElementById('subAssetPhoto');
    const receiptInput = document.getElementById('subAssetReceipt');
    const manualInput = document.getElementById('subAssetManual');
    const photoPreview = document.getElementById('subPhotoPreview');
    const receiptPreview = document.getElementById('subReceiptPreview');
    const manualPreview = document.getElementById('subManualPreview');

    if (photoInput) photoInput.value = '';
    if (receiptInput) receiptInput.value = '';
    if (manualInput) manualInput.value = '';
    if (photoPreview) photoPreview.innerHTML = '';
    if (receiptPreview) receiptPreview.innerHTML = '';
    if (manualPreview) manualPreview.innerHTML = '';

    subAssetModal.style.display = 'none';
}

function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarCloseBtn) sidebarCloseBtn.style.display = 'none';
    if (sidebarToggle) sidebarToggle.style.display = 'block';
    document.querySelector('.app-container').classList.remove('sidebar-active');
    
    // Hide overlay directly with JavaScript for cross-browser compatibility
    if (sidebarOverlay) {
        sidebarOverlay.style.display = 'none';
        sidebarOverlay.style.opacity = '0';
        sidebarOverlay.style.pointerEvents = 'none';
    }
}

function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarCloseBtn) sidebarCloseBtn.style.display = 'block';
    if (sidebarToggle) sidebarToggle.style.display = 'none';
    document.querySelector('.app-container').classList.add('sidebar-active');
    
    // Show overlay directly with JavaScript for cross-browser compatibility
    // Only in mobile view (width <= 853px)
    if (sidebarOverlay && window.innerWidth <= 853) {
        sidebarOverlay.style.display = 'block';
        sidebarOverlay.style.opacity = '1';
        sidebarOverlay.style.pointerEvents = 'auto';
    }
}

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
}
if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', () => {
        closeSidebar();
    });
}

// Close sidebar when clicking the overlay
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSidebar();
    });
}

// Handle window resize events to update sidebar overlay
window.addEventListener('resize', () => {
    // If we're now in desktop mode but overlay is visible, hide it
    if (window.innerWidth > 853 && sidebarOverlay) {
        sidebarOverlay.style.display = 'none';
        sidebarOverlay.style.opacity = '0';
        sidebarOverlay.style.pointerEvents = 'none';
    }
    // If we're now in mobile mode with sidebar open, show overlay
    else if (window.innerWidth <= 853 && sidebar && sidebar.classList.contains('open') && sidebarOverlay) {
        sidebarOverlay.style.display = 'block';
        sidebarOverlay.style.opacity = '1';
        sidebarOverlay.style.pointerEvents = 'auto';
    }
});

// Optionally close sidebar on navigation
function handleSidebarNav() {
    if (window.innerWidth <= 853) closeSidebar();
}
// Call handleSidebarNav after asset/sub-asset click
// In renderAssetList and createSubAssetElement, after renderAssetDetails(...), call handleSidebarNav();

// Open import modal
importBtn.addEventListener('click', () => {
    importModal.style.display = 'block';
});

// Close import modal
importModal.querySelector('.close-btn').addEventListener('click', () => {
    importModal.style.display = 'none';
    // Reset the import form when closing the modal
    resetImportForm();
});

// Handle file selection
importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // selectedFileName.textContent = file.name;
    
    try {
        // Read the file and get headers
        const formData = new FormData();
        formData.append('file', file);
        
        console.log('Sending file to get headers...');
        const response = await fetch('/api/import-assets', {
        method: 'POST',
            body: formData,
            credentials: 'include' // Maintain session
        });
        
        console.log('Header response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('Unauthorized, redirecting to login');
                window.location.href = '/login';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to read file');
        }
        
        const data = await response.json();
        console.log('Headers received:', data.headers);
        const headers = data.headers || [];
        
        // Show the column mapping section
        const mappingContainer = document.querySelector('.column-mapping');
        if (mappingContainer) {
            mappingContainer.style.display = 'block';
        }
        
        // Populate column selects
        columnSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Column</option>';
            headers.forEach((header, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = header;
                select.appendChild(option);
            });
        });
        
        // Also populate new selects
        const urlColumn = document.getElementById('urlColumn');
        const warrantyColumn = document.getElementById('warrantyColumn');
        const warrantyExpirationColumn = document.getElementById('warrantyExpirationColumn');
        [urlColumn, warrantyColumn, warrantyExpirationColumn].forEach(select => {
            if (!select) return;
            select.innerHTML = '<option value="">Select Column</option>';
            headers.forEach((header, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = header;
                select.appendChild(option);
            });
        });
        
        // Auto-map columns after populating
        autoMapColumns(headers);
        
        startImportBtn.disabled = headers.length === 0;
    } catch (error) {
        console.error('Error reading file:', error);
        alert('Failed to read file: ' + error.message);
    }
});

// Handle import
startImportBtn.addEventListener('click', async () => {
    setButtonLoading(startImportBtn, true);
    
    const file = importFile.files[0];
    if (!file) return;

    // Get column mappings
    const mappings = {
        name: document.getElementById('nameColumn').value,
        model: document.getElementById('modelColumn').value,
        manufacturer: document.getElementById('manufacturerColumn').value,
        serial: document.getElementById('serialColumn').value,
        purchaseDate: document.getElementById('purchaseDateColumn').value,
        purchasePrice: document.getElementById('purchasePriceColumn').value,
        notes: document.getElementById('notesColumn').value,
        url: urlColumn.value,
        warranty: warrantyColumn.value,
        warrantyExpiration: warrantyExpirationColumn.value
    };

    // Validate required mappings
    if (!mappings.name) {
        alert('Please map the Name column');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mappings', JSON.stringify(mappings));

        console.log('Sending import data with mappings:', mappings);
        const response = await fetch('/api/import-assets', {
            method: 'POST',
            body: formData,
            credentials: 'include' // Maintain session
        });

        console.log('Import response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('Unauthorized, redirecting to login');
                window.location.href = '/login';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Import failed');
        }

        const result = await response.json();
        console.log('Import result:', result);
        alert(`Successfully imported ${result.importedCount} assets`);
        
        // Close modal and reset form
        importModal.style.display = 'none';
        importFile.value = '';
        // selectedFileName.textContent = 'No file chosen';
        startImportBtn.disabled = true;
        setButtonLoading(startImportBtn, false);
        columnSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Column</option>';
        });
        
        // Refresh asset list
        console.log('Refreshing asset list after import');
        await loadAssets();
    } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import assets: ' + error.message);
        setButtonLoading(startImportBtn, false);
    }
});

// Auto-mapping logic for import columns
function autoMapColumns(headers) {
    const mappingRules = {
        nameColumn: ["name"],
        modelColumn: ["model", "model #", "model number", "model num"],
        manufacturerColumn: ["manufacturer", "make", "brand", "company"],
        serialColumn: ["serial", "serial #", "serial number", "serial num"],
        purchaseDateColumn: ["purchase date", "date purchased", "bought date"],
        purchasePriceColumn: ["purchase price", "price", "cost", "amount"],
        notesColumn: ["notes", "note", "description", "desc", "comments"],
        urlColumn: ["url", "link", "website"],
        warrantyColumn: ["warranty", "warranty scope", "coverage"],
        warrantyExpirationColumn: ["warranty expiration", "warranty expiry", "warranty end", "warranty end date", "expiration", "expiry"]
    };
    
    // Normalize a string for comparison
    function normalize(str) {
        return str.toLowerCase().replace(/[^a-z0-9]/g, "");
    }
    
    Object.entries(mappingRules).forEach(([dropdownId, variations]) => {
        const select = document.getElementById(dropdownId);
        if (!select) return;
        let foundIndex = "";
        for (let i = 0; i < headers.length; i++) {
            const headerNorm = normalize(headers[i]);
            if (variations.some(variant => headerNorm === normalize(variant))) {
                foundIndex = i;
                break;
            }
        }
        select.value = foundIndex;
    });
}

// Global function to reset the import form
function resetImportForm() {
    // Reset all column mapping dropdowns
    const columnSelects = document.querySelectorAll('.column-select');
    columnSelects.forEach(select => {
        select.innerHTML = '<option value="">Select Column</option>';
    });
    
    // Disable the start import button
    const startImportBtn = document.getElementById('startImportBtn');
    if (startImportBtn) {
        startImportBtn.disabled = true;
    }
}

// Make it available globally
window.resetImportForm = resetImportForm;

// Open modal
notificationBtn.addEventListener('click', async () => {
    await loadNotificationSettings();
    notificationModal.style.display = 'block';
});
// Close modal
function closeNotificationModal() {
    notificationModal.style.display = 'none';
}
notificationClose.addEventListener('click', closeNotificationModal);
cancelNotificationSettings.addEventListener('click', closeNotificationModal);

// Load settings from backend
async function loadNotificationSettings() {
    try {
        const response = await fetch('/api/notification-settings', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load notification settings');
        const settings = await response.json();
        notificationForm.notifyAdd.checked = !!settings.notifyAdd;
        notificationForm.notifyDelete.checked = !!settings.notifyDelete;
        notificationForm.notifyEdit.checked = !!settings.notifyEdit;
        notificationForm.notify1Month.checked = !!settings.notify1Month;
        notificationForm.notify2Week.checked = !!settings.notify2Week;
        notificationForm.notify7Day.checked = !!settings.notify7Day;
        notificationForm.notify3Day.checked = !!settings.notify3Day;
    } catch (err) {
        // fallback: uncheck all
        notificationForm.notifyAdd.checked = true;
        notificationForm.notifyDelete.checked = false;
        notificationForm.notifyEdit.checked = true;
        notificationForm.notify1Month.checked = true;
        notificationForm.notify2Week.checked = false;
        notificationForm.notify7Day.checked = true;
        notificationForm.notify3Day.checked = false;
    }
}

// Save settings to backend
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

saveNotificationSettings.addEventListener('click', async () => {
    setButtonLoading(saveNotificationSettings, true);
    
    const settings = {
        notifyAdd: notificationForm.notifyAdd.checked,
        notifyDelete: notificationForm.notifyDelete.checked,
        notifyEdit: notificationForm.notifyEdit.checked,
        notify1Month: notificationForm.notify1Month.checked,
        notify2Week: notificationForm.notify2Week.checked,
        notify7Day: notificationForm.notify7Day.checked,
        notify3Day: notificationForm.notify3Day.checked
    };
    try {
        const response = await fetch('/api/notification-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to save notification settings');
        closeNotificationModal();
        showToast('Settings saved');
    } catch (err) {
        alert('Failed to save notification settings.');
    } finally {
        setButtonLoading(saveNotificationSettings, false);
    }
});

testNotificationSettings.addEventListener('click', async () => {
    setButtonLoading(testNotificationSettings, true);
    
    try {
        const response = await fetch('/api/notification-test', {
            method: 'POST',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to send test notification');
        showToast('Test notification sent');
    } catch (err) {
        showToast('Failed to send test notification');
    } finally {
        setButtonLoading(testNotificationSettings, false);
    }
});

// Sorting Functions
function updateSortButtons(activeButton) {
    // Remove active class from all buttons
    document.querySelectorAll('.sort-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Set active button and update its direction
    if (activeButton) {
        activeButton.classList.add('active');
        const direction = activeButton.getAttribute('data-direction');
        const sortIcon = activeButton.querySelector('.sort-icon');
        if (sortIcon) {
            sortIcon.style.transform = direction === 'desc' ? 'rotate(180deg)' : '';
        }
    }
}

// Add click-off-to-close for modals
[assetModal, subAssetModal, importModal, notificationModal].forEach(modal => {
    if (modal) {
        modal.addEventListener('mousedown', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
});

// Note: syncState is now directly called from loadAssets and loadSubAssets functions
// No need to redefine functions which could cause errors in strict mode

function renderSubAssets(parentAssetId) {
    if (!subAssetContainer || !subAssetList) return;
    
    // Get sub-assets for this parent
    const parentSubAssets = subAssets.filter(sa => sa.parentId === parentAssetId && !sa.parentSubId);
    
    // Show or hide the container
    subAssetContainer.classList.remove('hidden');
    
    if (parentSubAssets.length === 0) {
        subAssetList.innerHTML = `
            <div class="empty-state">
                <p>No components found. Add your first component.</p>
            </div>
        `;
    } else {
        subAssetList.innerHTML = '';
        
        // Render each sub-asset with any children
        parentSubAssets.forEach(subAsset => {
            const subAssetElement = createSubAssetElement(subAsset);
            subAssetList.appendChild(subAssetElement);
        });
    }
    
    // Set up the "Add Sub-Asset" button
    if (addSubAssetBtn) {
        addSubAssetBtn.onclick = () => {
            openSubAssetModal(null, parentAssetId);
        };
    }
}

function createSubAssetElement(subAsset) {
    const element = document.createElement('div');
    element.className = 'sub-asset-item';
    if (subAsset.id === selectedSubAssetId) {
        element.classList.add('active');
    }
    
    // Check warranty expiration
    let warrantyDot = '';
    if (subAsset.warranty && subAsset.warranty.expirationDate) {
        const expDate = new Date(subAsset.warranty.expirationDate);
        const now = new Date();
        const diff = (expDate - now) / (1000 * 60 * 60 * 24); // difference in days
        
        if (diff < 0) {
            // Warranty has expired
            warrantyDot = `<div class="warranty-expired-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
            </div>`;
        } else if (diff >= 0 && diff <= 30) {
            warrantyDot = '<div class="warranty-expiring-dot"></div>';
        } else if (diff > 30 && diff <= 60) {
            warrantyDot = '<div class="warranty-warning-dot"></div>';
        }
    }
    
    // Create header with name and actions
    const header = document.createElement('div');
    header.className = 'sub-asset-header';
    header.innerHTML = `
        ${warrantyDot}
        <div class="sub-asset-title">${subAsset.name}</div>
        <div class="sub-asset-actions">
            <button class="edit-sub-btn" data-id="${subAsset.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z"/></svg>
            </button>
            <button class="delete-sub-btn" data-id="${subAsset.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
        </div>
    `;
    
    // Set up button event listeners
    const editBtn = header.querySelector('.edit-sub-btn');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSubAssetModal(subAsset);
    });
    
    const deleteBtn = header.querySelector('.delete-sub-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSubAsset(subAsset.id);
    });
    
    element.appendChild(header);
    
    // Add summary info
    const info = document.createElement('div');
    info.className = 'sub-asset-info';
    
    // Create model/serial info and tags section
    info.innerHTML = `
        <div>
            ${subAsset.modelNumber ? `<span>${subAsset.modelNumber}</span>` : ''}
            ${subAsset.serialNumber ? `<span>#${subAsset.serialNumber}</span>` : ''}
        </div>
        ${subAsset.tags && subAsset.tags.length > 0 ? `
        <div class="tag-list">
            ${subAsset.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>`: ''}
    `;
    
    element.appendChild(info);
    
    // Add file previews
    const filePreviewsContainer = document.createElement('div');
    filePreviewsContainer.className = 'sub-asset-files';
    
    // Add file previews if available
    if (subAsset.photoPath || subAsset.receiptPath || subAsset.manualPath) {
        const files = document.createElement('div');
        files.className = 'compact-files-grid';
        
        if (subAsset.photoPath) {
            files.innerHTML += `
                <div class="compact-file-item photo">
                    <a href="${formatFilePath(subAsset.photoPath)}" target="_blank">
                        <img src="${formatFilePath(subAsset.photoPath)}" alt="${subAsset.name}" class="compact-asset-image">
                    </a>
                </div>
            `;
        }
        
        if (subAsset.receiptPath) {
            files.innerHTML += `
                <div class="compact-file-item receipt">
                    <a href="${formatFilePath(subAsset.receiptPath)}" target="_blank">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2"/>
                            <path d="M14 8h-8"/>
                            <path d="M15 12h-9"/>
                            <path d="M15 16h-9"/>
                        </svg>
                    </a>
                </div>
            `;
        }
        
        if (subAsset.manualPath) {
            files.innerHTML += `
                <div class="compact-file-item manual">
                    <a href="${formatFilePath(subAsset.manualPath)}" target="_blank">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <path d="M14 2v6h6"/>
                            <path d="M16 13H8"/>
                            <path d="M16 17H8"/>
                            <path d="M10 9H8"/>
                        </svg>
                    </a>
                </div>
            `;
        }
        
        filePreviewsContainer.appendChild(files);
    }
    
    element.appendChild(filePreviewsContainer);
    
    // Check for children (only for first level sub-assets)
    if (!subAsset.parentSubId) {
        const children = subAssets.filter(sa => sa.parentSubId === subAsset.id);
        
        if (children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'sub-asset-children';
            
            children.forEach(child => {
                const childElement = document.createElement('div');
                childElement.className = 'sub-asset-item child';
                
                // Check warranty expiration for child
                let childWarrantyDot = '';
                if (child.warranty && child.warranty.expirationDate) {
                    const expDate = new Date(child.warranty.expirationDate);
                    const now = new Date();
                    const diff = (expDate - now) / (1000 * 60 * 60 * 24);
                    
                    if (diff < 0) {
                        // Warranty has expired
                        childWarrantyDot = `<div class="warranty-expired-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>`;
                    } else if (diff >= 0 && diff <= 30) {
                        childWarrantyDot = '<div class="warranty-expiring-dot"></div>';
                    } else if (diff > 30 && diff <= 60) {
                        childWarrantyDot = '<div class="warranty-warning-dot"></div>';
                    }
                }
                
                // Create child header
                const childHeader = document.createElement('div');
                childHeader.className = 'sub-asset-header';
                childHeader.innerHTML = `
                    ${childWarrantyDot}
                    <div class="sub-asset-title">${child.name}</div>
                    <div class="sub-asset-actions">
                        <button class="edit-sub-btn" data-id="${child.id}" title="Edit">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z"/></svg>
                        </button>
                        <button class="delete-sub-btn" data-id="${child.id}" title="Delete">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                `;
                childElement.appendChild(childHeader);
                
                // Add child info section with tags
                const childInfo = document.createElement('div');
                childInfo.className = 'sub-asset-info';
                childInfo.innerHTML = `
                    <div>
                        ${child.modelNumber ? `<span>${child.modelNumber}</span>` : ''}
                        ${child.serialNumber ? `<span>#${child.serialNumber}</span>` : ''}
                    </div>
                    ${child.tags && child.tags.length > 0 ? `
                    <div class="tag-list">
                        ${child.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>`: ''}
                `;
                childElement.appendChild(childInfo);
                
                // Add file previews container for the child
                const childFilePreviewsContainer = document.createElement('div');
                childFilePreviewsContainer.className = 'sub-asset-files';
                
                if (child.photoPath || child.receiptPath || child.manualPath) {
                    const childFiles = document.createElement('div');
                    childFiles.className = 'compact-files-grid';
                    
                    if (child.photoPath) {
                        childFiles.innerHTML += `
                            <div class="compact-file-item photo">
                                <a href="${formatFilePath(child.photoPath)}" target="_blank">
                                    <img src="${formatFilePath(child.photoPath)}" alt="${child.name}" class="compact-asset-image">
                                </a>
                            </div>
                        `;
                    }
                    
                    if (child.receiptPath) {
                        childFiles.innerHTML += `
                            <div class="compact-file-item receipt">
                                <a href="${formatFilePath(child.receiptPath)}" target="_blank">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                        <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2"/>
                                        <path d="M14 8h-8"/>
                                        <path d="M15 12h-9"/>
                                        <path d="M15 16h-9"/>
                                    </svg>
                                </a>
                            </div>
                        `;
                    }
                    
                    if (child.manualPath) {
                        childFiles.innerHTML += `
                            <div class="compact-file-item manual">
                                <a href="${formatFilePath(child.manualPath)}" target="_blank">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <path d="M14 2v6h6"/>
                                        <path d="M16 13H8"/>
                                        <path d="M16 17H8"/>
                                        <path d="M10 9H8"/>
                                    </svg>
                                </a>
                            </div>
                        `;
                    }

                    childFilePreviewsContainer.appendChild(childFiles);
                }
                childElement.appendChild(childFilePreviewsContainer);
                
                // Add event listeners to child
                const childEditBtn = childElement.querySelector('.edit-sub-btn');
                childEditBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openSubAssetModal(child);
                });
                
                const childDeleteBtn = childElement.querySelector('.delete-sub-btn');
                childDeleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSubAsset(child.id);
                });
                
                // Make sub-sub-asset clickable to show details
                childElement.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    e.stopPropagation();
                    updateSelectedIds(selectedAssetId, child.id);
                    renderAssetDetails(child.id, true);
                });
                
                childrenContainer.appendChild(childElement);
            });
            
            element.appendChild(childrenContainer);
        }
    }
    
    // Make the component clickable to show details
    element.addEventListener('click', (e) => {
        // Prevent click if clicking on an action button
        if (e.target.closest('button')) return;
        e.stopPropagation();
        updateSelectedIds(selectedAssetId, subAsset.id);
        renderAssetDetails(subAsset.id, true);
    });
    
    return element;
}

// Add/enhance function to render asset details properly
async function refreshAssetDetails(assetId, isSubAsset = false) {
    console.log(`Refreshing ${isSubAsset ? 'sub-asset' : 'asset'} details for ID: ${assetId}`);
    
    if (!assetId) {
        console.log('No ID provided for refresh');
        return;
    }
    
    // Ensure we have fresh data before proceeding
    const collection = isSubAsset ? subAssets : assets;
    const item = collection.find(a => a.id === assetId);
    
    if (!item) {
        console.error(`Could not find ${isSubAsset ? 'sub-asset' : 'asset'} with ID: ${assetId}`);
        // If item not found and we're refreshing a sub-asset, try to refresh the parent asset instead
        if (isSubAsset) {
            const parentAssetId = collection.find(a => a.id === assetId)?.parentId;
            if (parentAssetId) {
                console.log('Falling back to parent asset view');
                refreshAssetDetails(parentAssetId, false);
                return;
            }
        }
        return;
    }
    
    // Log item details for debugging
    console.log(`Found ${isSubAsset ? 'sub-asset' : 'asset'} data:`, {
        id: item.id,
        name: item.name,
        photoPath: item.photoPath,
        receiptPath: item.receiptPath,
        manualPath: item.manualPath,
        updatedAt: item.updatedAt
    });
    
    // Ensure that any image paths are properly formatted
    if (item.photoPath) {
        console.log(`Original photo path: ${item.photoPath}`);
        const formattedPhotoPath = formatFilePath(item.photoPath);
        console.log(`Formatted photo path: ${formattedPhotoPath}`);
    } else {
        console.log(`No photo path found for asset ${item.id}`);
    }
    
    if (item.receiptPath) {
        console.log(`Original receipt path: ${item.receiptPath}`);
        const formattedReceiptPath = formatFilePath(item.receiptPath);
        console.log(`Formatted receipt path: ${formattedReceiptPath}`);
    }
    
    if (item.manualPath) {
        console.log(`Original manual path: ${item.manualPath}`);
        const formattedManualPath = formatFilePath(item.manualPath);
        console.log(`Formatted manual path: ${formattedManualPath}`);
    }
    
    // Add secondary warranty info if it exists
    let detailsHtml = '';
    if (item.secondaryWarranty) {
        detailsHtml += `
            <div class="info-item">
                <div class="info-label">Secondary Warranty</div>
                <div>${item.secondaryWarranty.scope || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Secondary Warranty Expiration</div>
                <div>${formatDate(item.secondaryWarranty.expirationDate)}</div>
            </div>
        `;
    }
    
    // Render the details with a brief delay to ensure the DOM is ready
    // and any data changes are fully applied
    setTimeout(() => {
        console.log(`Rendering details for ${isSubAsset ? 'sub-asset' : 'asset'} ${item.id}`);
        renderAssetDetails(assetId, isSubAsset);
    }, 50);
}

// DOM initialization function
function initializeDOMElements() {
    // Initialize DOM elements
    assetModal = document.getElementById('assetModal');
    assetForm = document.getElementById('assetForm');
    subAssetModal = document.getElementById('subAssetModal');
    subAssetForm = document.getElementById('subAssetForm');
    assetList = document.getElementById('assetList');
    assetDetails = document.getElementById('assetDetails');
    subAssetContainer = document.getElementById('subAssetContainer');
    searchInput = document.getElementById('searchInput');
    clearSearchBtn = document.getElementById('clearSearchBtn');
    
    // Log the initialization status
    console.log('DOM Elements initialized:', {
        assetModal: !!assetModal,
        assetForm: !!assetForm,
        subAssetModal: !!subAssetModal,
        subAssetForm: !!subAssetForm,
        assetList: !!assetList,
        assetDetails: !!assetDetails,
        subAssetContainer: !!subAssetContainer,
        searchInput: !!searchInput,
        clearSearchBtn: !!clearSearchBtn
    });
    
    // Initialize tag managers
    assetTagManager = setupTagInput('assetTags', 'assetTagsContainer');
    subAssetTagManager = setupTagInput('subAssetTags', 'subAssetTagsContainer');
}

// Tag management functions
function setupTagInput(inputId, containerId) {
    const tags = new Set();
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);

    function renderTags() {
        if (!container) return;
        container.innerHTML = Array.from(tags).map(tag => `
            <span class="tag">
                ${tag}
                <button class="remove-tag" data-tag="${tag}" title="Remove tag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </span>
        `).join('');

        // Add click handlers to remove buttons
        container.querySelectorAll('.remove-tag').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const tagToRemove = btn.dataset.tag;
                tags.delete(tagToRemove);
                renderTags();
            };
        });
    }

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = input.value.trim();
                if (tag && !tags.has(tag)) {
                    tags.add(tag);
                    input.value = '';
                    renderTags();
                }
            }
        });
    }

    return {
        getTags: () => Array.from(tags),
        setTags: (newTags) => {
            tags.clear();
            newTags.forEach(tag => tags.add(tag));
            renderTags();
        },
        addTag: (tag) => {
            tags.add(tag);
            renderTags();
        },
        removeTag: (tag) => {
            tags.delete(tag);
            renderTags();
        },
        clearTags: () => {
            tags.clear();
            renderTags();
        }
    };
}

// Keep at the end
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    initializeDOMElements();
    
    // Check if DOM elements exist
    if (!assetList || !assetDetails) {
        console.error('Required DOM elements not found.');
        return;
    }
    
    // Set up file upload functionality
    initializeFileUploads();
    
    // Initialize collapsible sections
    initCollapsibleSections();
    
    // Initialize the asset renderer module
    initRenderer({
        // Utility functions
        formatDate,
        formatCurrency,
        
        // Module functions
        openAssetModal,
        openSubAssetModal,
        deleteAsset,
        deleteSubAsset,
        createSubAssetElement,
        handleSidebarNav,
        renderSubAssets,
        
        // Global state
        assets,
        subAssets,
        
        // DOM elements
        assetList,
        assetDetails,
        subAssetContainer
    });
    
    // Initialize the list renderer module
    initListRenderer({
        // Module functions
        updateSelectedIds,
        renderAssetDetails,
        handleSidebarNav,
        
        // Global state
        assets,
        subAssets,
        selectedAssetId,
        dashboardFilter,
        currentSort,
        searchInput,
        
        // DOM elements
        assetList
    });
    
    // Set up search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderAssetList(e.target.value);
            if (clearSearchBtn) {
                clearSearchBtn.style.display = e.target.value ? 'flex' : 'none';
            }
        });
    }
    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            renderAssetList('');
            searchInput.focus();
        });
    }
    
    // Set up home button
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => goHome());
    }

    function goHome() {
        // Clear selected asset
        updateSelectedIds(null, null);
        
        // Remove active class from all asset items
        document.querySelectorAll('.asset-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Render dashboard
        renderEmptyState();
        
        // Close sidebar on mobile
        handleSidebarNav();
    }
    
    // Set up add asset button
    if (addAssetBtn) {
        addAssetBtn.addEventListener('click', () => {
            openAssetModal();
        });
    }
    
    // Add event listener for escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAssetModal();
            closeSubAssetModal();
        }
    });
    
    // Set the page and site title from config if available
    if (window.appConfig && window.appConfig.siteTitle) {
        const siteTitleElem = document.getElementById('siteTitle');
        if (siteTitleElem) {
            siteTitleElem.textContent = window.appConfig.siteTitle || 'DumbAssets';
        }
        const pageTitleElem = document.getElementById('pageTitle');
        if (pageTitleElem) {
            pageTitleElem.textContent = window.appConfig.siteTitle || 'DumbAssets';
        }
        siteTitleElem.addEventListener('click', () => goHome());
    }
    

    // Set up sort buttons
    const sortNameBtn = document.getElementById('sortNameBtn');
    const sortWarrantyBtn = document.getElementById('sortWarrantyBtn');
    
    if (sortNameBtn) {
        sortNameBtn.addEventListener('click', () => {
            const currentDirection = sortNameBtn.getAttribute('data-direction') || 'asc';
            const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
            
            // Update button state
            sortNameBtn.setAttribute('data-direction', newDirection);
            sortWarrantyBtn.setAttribute('data-direction', 'asc');
            
            // Update sort settings
            currentSort = { field: 'name', direction: newDirection };
            updateSort(currentSort);
            
            // Update UI
            updateSortButtons(sortNameBtn);
            
            // Re-render with sort
            renderAssetList(searchInput ? searchInput.value : '');
        });
    }
    
    if (sortWarrantyBtn) {
        sortWarrantyBtn.addEventListener('click', () => {
            const currentDirection = sortWarrantyBtn.getAttribute('data-direction') || 'asc';
            const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
            
            // Update button state
            sortWarrantyBtn.setAttribute('data-direction', newDirection);
            sortNameBtn.setAttribute('data-direction', 'asc');
            
            // Update sort settings
            currentSort = { field: 'warranty', direction: newDirection };
            updateSort(currentSort);
            
            // Update UI
            updateSortButtons(sortWarrantyBtn);
            
            // Re-render with sort
            renderAssetList(searchInput ? searchInput.value : '');
        });
    }
    
    // Top Sort Button (optional)
    const topSortBtn = document.getElementById('topSortBtn');
    if (topSortBtn) {
        topSortBtn.addEventListener('click', () => {
            const sortOptions = document.getElementById('sortOptions');
            if (sortOptions) {
                sortOptions.classList.toggle('visible');
            }
        });
    }
    
    // Load initial data
    loadAllData();
    registerServiceWorker();
});