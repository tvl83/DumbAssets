/**
 * DumbAssets - Asset Tracking Application
 * Main JavaScript file handling application logic
 */

// Import file upload module
import { initializeFileUploads, handleFileUploads } from '/src/services/fileUpload/index.js';
// Import asset renderer module
import { 
    initRenderer, 
    updateState, 
    updateSelectedIds, 
    renderAssetDetails,
    // Import list renderer functions
    initListRenderer,
    updateListState,
    updateDashboardFilter,
    updateSort,
    renderAssetList,
    sortAssets
} from '/src/services/render/index.js';
import {  registerServiceWorker } from './helpers/serviceWorkerHelper.js';
// Import collapsible sections functionality
import { initCollapsibleSections } from './js/collapsible.js';

// State management
let assets = [];
let subAssets = [];
let selectedAssetId = null;
let selectedSubAssetId = null;
let isEditMode = false;
let currentSort = { field: null, direction: 'asc' };
let dashboardFilter = null;

// Add these flags to track deletion
let deletePhoto = false;
let deleteReceipt = false;
let deleteManual = false;
let deleteSubPhoto = false;
let deleteSubReceipt = false;
let deleteSubManual = false;

// DOM Elements
const assetList = document.getElementById('assetList');
const assetDetails = document.getElementById('assetDetails');
const subAssetContainer = document.getElementById('subAssetContainer');
const subAssetList = document.getElementById('subAssetList');
const searchInput = document.getElementById('searchInput');
const addAssetBtn = document.getElementById('addAssetBtn');
const addSubAssetBtn = document.getElementById('addSubAssetBtn');
const assetModal = document.getElementById('assetModal');
const subAssetModal = document.getElementById('subAssetModal');
const assetForm = document.getElementById('assetForm');
const subAssetForm = document.getElementById('subAssetForm');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
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

// Helper function to get the API base URL
function getApiBaseUrl() {
    return window.location.origin + (window.appConfig?.basePath || '');
}

async function saveAsset(asset) {
    try {
        const apiBaseUrl = getApiBaseUrl();
        
        if (deletePhoto && asset.photoPath) {
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: asset.photoPath }),
                credentials: 'include'
            });
            asset.photoPath = null;
        }
        if (deleteReceipt && asset.receiptPath) {
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: asset.receiptPath }),
                credentials: 'include'
            });
            asset.receiptPath = null;
        }
        if (deleteManual && asset.manualPath) {
            await fetch(`${apiBaseUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: asset.manualPath }),
                credentials: 'include'
            });
            asset.manualPath = null;
        }
        const response = await fetch(`${apiBaseUrl}/api/asset`, {
            method: isEditMode ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(asset),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to save asset');
        await loadAssets();
        closeAssetModal();
        // Refresh the asset details view if we're currently viewing the edited asset
        if (selectedAssetId === asset.id) {
            renderAssetDetails(asset.id);
        }
    } catch (error) {
        console.error('Error saving asset:', error);
        alert('Error saving asset. Please try again.');
    }
}

async function saveSubAsset(subAsset) {
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
        const updatedSubAsset = await response.json();
        console.log('Server response with updated sub-asset:', updatedSubAsset);
        
        // Load the updated sub-assets
        await loadSubAssets();
        
        // Close the modal
        closeSubAssetModal();
        
        // Refresh the asset details view to show the updated sub-assets
        if (selectedAssetId) {
            renderAssetDetails(selectedAssetId);
        }
    } catch (error) {
        console.error('Error saving sub-asset:', error);
        alert('Error saving component. Please try again.');
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
        await loadAssets();
        await loadSubAssets();
        renderEmptyState();
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
        const response = await fetch(`${apiBaseUrl}/api/subasset/${subAssetId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to delete component');
        updateSelectedIds(selectedAssetId, null);
        await loadSubAssets();
        if (selectedAssetId) {
            renderAssetDetails(selectedAssetId);
        }
    } catch (error) {
        console.error('Error deleting component:', error);
        alert('Error deleting component. Please try again.');
    }
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
            <div class="dashboard-top-row">
                <div class="dashboard-card total${!dashboardFilter ? ' active' : ''}" data-filter="all">
                    <div class="card-label">Total Assets</div>
                    <div class="card-value">${totalAssets}</div>
                </div>
                <div class="dashboard-card components" data-filter="components">
                    <div class="card-label">Total Components</div>
                    <div class="card-value">${totalComponents}</div>
                </div>
                <div class="dashboard-card value" data-filter="value">
                    <div class="card-label">Total Value</div>
                    <div class="card-value">${formatCurrency(totalValue)}</div>
                </div>
            </div>
            <div class="dashboard-warranty-section">
                <div class="warranty-title">Warranties</div>
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
        </div>
    `;
    // Add click handlers for filtering (except value card)
    assetDetails.querySelectorAll('.dashboard-card').forEach(card => {
        if (card.getAttribute('data-filter') === 'value') return;
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const filter = card.getAttribute('data-filter');
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
    deletePhoto = false;
    deleteReceipt = false;
    deleteManual = false;
    
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
        document.getElementById('assetSerial').value = asset.serialNumber || '';
        document.getElementById('assetPurchaseDate').value = asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '';
        document.getElementById('assetPrice').value = asset.price || '';
        document.getElementById('assetWarrantyScope').value = asset.warranty?.scope || '';
        document.getElementById('assetWarrantyExpiration').value = asset.warranty?.expirationDate ? new Date(asset.warranty.expirationDate).toISOString().split('T')[0] : '';
        document.getElementById('assetLink').value = asset.link || '';
        document.getElementById('assetDescription').value = asset.description || '';
        // Preview existing images
        if (photoPreview && asset.photoPath) {
            photoPreview.innerHTML = `<div style="position:relative;display:inline-block;">
                <img src="${asset.photoPath}" alt="Asset Photo">
                <button type="button" class="delete-preview-btn" title="Delete Image" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;padding:2px;cursor:pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>`;
            photoPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this image?')) {
                    photoPreview.innerHTML = '';
                    photoInput.value = '';
                    deletePhoto = true;
                }
            };
        }
        if (receiptPreview && asset.receiptPath) {
            receiptPreview.innerHTML = `<div class="receipt-preview" style="position:relative;display:inline-block;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>Receipt file attached</span>
                <button type="button" class="delete-preview-btn" title="Delete Receipt" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;padding:2px;cursor:pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>`;
            receiptPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this receipt?')) {
                    receiptPreview.innerHTML = '';
                    receiptInput.value = '';
                    deleteReceipt = true;
                }
            };
        }
        if (manualPreview && asset.manualPath) {
            manualPreview.innerHTML = `<div class="manual-preview" style="position:relative;display:inline-block;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>Manual file attached</span>
                <button type="button" class="delete-preview-btn" title="Delete Manual" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;padding:2px;cursor:pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>`;
            manualPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this manual?')) {
                    manualPreview.innerHTML = '';
                    manualInput.value = '';
                    deleteManual = true;
                }
            };
        }
    }
    // Set up form submission
    assetForm.onsubmit = (e) => {
        e.preventDefault();
        
        // Create asset object
        const newAsset = {
            name: document.getElementById('assetName').value,
            modelNumber: document.getElementById('assetModel').value,
            serialNumber: document.getElementById('assetSerial').value,
            purchaseDate: document.getElementById('assetPurchaseDate').value,
            price: parseFloat(document.getElementById('assetPrice').value) || null,
            warranty: {
                scope: document.getElementById('assetWarrantyScope').value,
                expirationDate: document.getElementById('assetWarrantyExpiration').value
            },
            link: document.getElementById('assetLink').value,
            description: document.getElementById('assetDescription').value,
            updatedAt: new Date().toISOString()
        };
        
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
    deleteSubPhoto = false;
    deleteSubReceipt = false;
    deleteSubManual = false;
    
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
        const modelInput = document.getElementById('subAssetModel');
        const serialInput = document.getElementById('subAssetSerial');
        const purchaseDateInput = document.getElementById('subAssetPurchaseDate');
        const purchasePriceInput = document.getElementById('subAssetPurchasePrice');
        const notesInput = document.getElementById('subAssetNotes');
        const warrantyScopeInput = document.getElementById('subAssetWarrantyScope');
        const warrantyExpirationInput = document.getElementById('subAssetWarrantyExpiration');
        
        if (idInput) idInput.value = subAsset.id;
        if (nameInput) nameInput.value = subAsset.name || '';
        if (modelInput) modelInput.value = subAsset.modelNumber || '';
        if (serialInput) serialInput.value = subAsset.serialNumber || '';
        if (purchaseDateInput) purchaseDateInput.value = subAsset.purchaseDate || '';
        if (purchasePriceInput) purchasePriceInput.value = subAsset.purchasePrice || '';
        if (parentIdInput) parentIdInput.value = subAsset.parentId || parentId || '';
        if (parentSubIdInput) parentSubIdInput.value = subAsset.parentSubId || parentSubId || '';
        if (notesInput) notesInput.value = subAsset.notes || '';
        if (warrantyScopeInput) warrantyScopeInput.value = subAsset.warranty?.scope || '';
        if (warrantyExpirationInput) warrantyExpirationInput.value = subAsset.warranty?.expirationDate ? new Date(subAsset.warranty.expirationDate).toISOString().split('T')[0] : '';
        
        // Preview existing images if available
        if (photoPreview && subAsset.photoPath) {
            photoPreview.innerHTML = `<div class="preview-item">
                <img src="${subAsset.photoPath}" alt="Component Photo" style="max-width:100%;max-height:150px;">
                <button type="button" class="delete-preview-btn" title="Delete Image">×</button>
            </div>`;
            photoPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this image?')) {
                    photoPreview.innerHTML = '';
                    photoInput.value = '';
                    deleteSubPhoto = true;
                }
            };
        }
        if (receiptPreview && subAsset.receiptPath) {
            receiptPreview.innerHTML = `<div class="preview-item">
                <span>Receipt file attached</span>
                <button type="button" class="delete-preview-btn" title="Delete Receipt">×</button>
            </div>`;
            receiptPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this receipt?')) {
                    receiptPreview.innerHTML = '';
                    receiptInput.value = '';
                    deleteSubReceipt = true;
                }
            };
        }
        if (manualPreview && subAsset.manualPath) {
            manualPreview.innerHTML = `<div class="preview-item">
                <span>Manual file attached</span>
                <button type="button" class="delete-preview-btn" title="Delete Manual">×</button>
            </div>`;
            manualPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this manual?')) {
                    manualPreview.innerHTML = '';
                    manualInput.value = '';
                    deleteSubManual = true;
                }
            };
        }
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
            modelNumber: modelInput ? modelInput.value : '',
            serialNumber: serialInput ? serialInput.value : '',
            purchaseDate: purchaseDateInput ? purchaseDateInput.value : '',
            purchasePrice: purchasePriceInput ? parseFloat(purchasePriceInput.value) || null : null,
            parentId: parentIdInput ? parentIdInput.value : '',
            parentSubId: parentSubIdInput ? parentSubIdInput.value : '',
            notes: notesInput ? notesInput.value : '',
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
}
function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarCloseBtn) sidebarCloseBtn.style.display = 'block';
    if (sidebarToggle) sidebarToggle.style.display = 'none';
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
// Close sidebar when clicking outside (on main content) on mobile
if (mainContent) {
    mainContent.addEventListener('click', () => {
        if (window.innerWidth <= 768) closeSidebar();
    });
}
// Optionally close sidebar on navigation
function handleSidebarNav() {
    if (window.innerWidth <= 768) closeSidebar();
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
    const file = importFile.files[0];
    if (!file) return;

    // Get column mappings
    const mappings = {
        name: document.getElementById('nameColumn').value,
        model: document.getElementById('modelColumn').value,
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
        columnSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Column</option>';
        });
        
        // Refresh asset list
        console.log('Refreshing asset list after import');
        await loadAssets();
    } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import assets: ' + error.message);
    }
});

// Auto-mapping logic for import columns
function autoMapColumns(headers) {
    const mappingRules = {
        nameColumn: ["name"],
        modelColumn: ["model", "model #", "model number", "model num"],
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
    }
});

testNotificationSettings.addEventListener('click', async () => {
    testNotificationSettings.disabled = true;
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
        setTimeout(() => { testNotificationSettings.disabled = false; }, 1500);
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
        
        if (diff >= 0 && diff <= 30) {
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
    
    // Add event listeners
    const editBtn = header.querySelector('.edit-sub-btn');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const subToEdit = subAssets.find(sa => sa.id === subAsset.id);
        openSubAssetModal(subToEdit);
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
    info.innerHTML = `
        ${subAsset.modelNumber ? `<span>${subAsset.modelNumber}</span>` : ''}
        ${subAsset.serialNumber ? `<span>#${subAsset.serialNumber}</span>` : ''}
    `;
    element.appendChild(info);
    
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
                    
                    if (diff >= 0 && diff <= 30) {
                        childWarrantyDot = '<div class="warranty-expiring-dot"></div>';
                    } else if (diff > 30 && diff <= 60) {
                        childWarrantyDot = '<div class="warranty-warning-dot"></div>';
                    }
                }
                
                childElement.innerHTML = `
                    <div class="sub-asset-header">
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
                    </div>
                    <div class="sub-asset-info">
                        ${child.modelNumber ? `<span>${child.modelNumber}</span>` : ''}
                        ${child.serialNumber ? `<span>#${child.serialNumber}</span>` : ''}
                    </div>
                `;
                
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
    
    element.addEventListener('click', (e) => {
        // Prevent click if clicking on an action button
        if (e.target.closest('button')) return;
        e.stopPropagation();
        updateSelectedIds(selectedAssetId, subAsset.id);
        renderAssetDetails(subAsset.id, true);
    });
    
    return element;
}

// Keep at the end
document.addEventListener('DOMContentLoaded', () => {
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
        homeBtn.addEventListener('click', () => {
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
        });
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