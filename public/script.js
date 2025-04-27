/**
 * DumbAssets - Asset Tracking Application
 * Main JavaScript file handling application logic
 */

// State management
let assets = [];
let subAssets = [];
let selectedAssetId = null;
let selectedSubAssetId = null;
let isEditMode = false;

// Add these flags to track deletion
let deletePhoto = false;
let deleteReceipt = false;
let deleteSubPhoto = false;
let deleteSubReceipt = false;

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
        const response = await fetch('/api/assets');
        if (!response.ok) throw new Error('Failed to load assets');
        assets = await response.json();
        renderAssetList();
    } catch (error) {
        console.error('Error loading assets:', error);
        // If we can't load from server, create empty array
        assets = [];
        renderAssetList();
    }
}

async function loadSubAssets() {
    try {
        const response = await fetch('/api/subassets');
        if (!response.ok) throw new Error('Failed to load sub-assets');
        subAssets = await response.json();
    } catch (error) {
        console.error('Error loading sub-assets:', error);
        // If we can't load from server, create empty array
        subAssets = [];
    }
}

async function saveAsset(asset) {
    try {
        if (deletePhoto && asset.photoPath) {
            await fetch('/api/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: asset.photoPath })
            });
            asset.photoPath = null;
        }
        if (deleteReceipt && asset.receiptPath) {
            await fetch('/api/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: asset.receiptPath })
            });
            asset.receiptPath = null;
        }
        const response = await fetch('/api/asset', {
            method: isEditMode ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(asset)
        });
        if (!response.ok) throw new Error('Failed to save asset');
        await loadAssets();
        closeAssetModal();
    } catch (error) {
        console.error('Error saving asset:', error);
        alert('Error saving asset. Please try again.');
    }
}

async function saveSubAsset(subAsset) {
    try {
        if (deleteSubPhoto && subAsset.photoPath) {
            await fetch('/api/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: subAsset.photoPath })
            });
            subAsset.photoPath = null;
        }
        if (deleteSubReceipt && subAsset.receiptPath) {
            await fetch('/api/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: subAsset.receiptPath })
            });
            subAsset.receiptPath = null;
        }
        const response = await fetch('/api/subasset', {
            method: isEditMode ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subAsset)
        });
        if (!response.ok) throw new Error('Failed to save sub-asset');
        await loadSubAssets();
        closeSubAssetModal();
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
        const response = await fetch(`/api/asset/${assetId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete asset');
        selectedAssetId = null;
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
        const response = await fetch(`/api/subasset/${subAssetId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete component');
        selectedSubAssetId = null;
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
function renderAssetList(filterText = '') {
    if (!assetList) return;
    assetList.innerHTML = '';
    if (!filterText) {
        // Show only main assets if not searching
        if (assets.length === 0) {
            assetList.innerHTML = `
                <div class="empty-state">
                    <p>No assets found. Add your first asset to get started.</p>
                </div>
            `;
            return;
        }
        assets.forEach(asset => {
            const assetItem = document.createElement('div');
            assetItem.className = 'asset-item';
            if (asset.id === selectedAssetId) {
                assetItem.classList.add('active');
            }
            assetItem.innerHTML = `
                <div class="asset-item-name">${asset.name}</div>
                <div class="asset-item-details">
                    ${asset.modelNumber ? `<span>${asset.modelNumber}</span>` : ''}
                    ${asset.serialNumber ? `<span>#${asset.serialNumber}</span>` : ''}
                </div>
            `;
            assetItem.addEventListener('click', () => {
                renderAssetDetails(asset.id);
            });
            assetList.appendChild(assetItem);
        });
        return;
    }
    // Search across assets, sub-assets, and sub-sub-assets
    const results = [];
    // Main assets
    assets.forEach(asset => {
        if (
            asset.name.toLowerCase().includes(filterText.toLowerCase()) ||
            (asset.modelNumber && asset.modelNumber.toLowerCase().includes(filterText.toLowerCase())) ||
            (asset.serialNumber && asset.serialNumber.toLowerCase().includes(filterText.toLowerCase())) ||
            (asset.description && asset.description.toLowerCase().includes(filterText.toLowerCase()))
        ) {
            results.push({
                type: 'Asset',
                label: asset.name,
                context: '',
                id: asset.id,
                isSub: false
            });
        }
    });
    // Sub-assets and sub-sub-assets
    subAssets.forEach(sub => {
        const parentAsset = assets.find(a => a.id === sub.parentId);
        if (
            sub.name.toLowerCase().includes(filterText.toLowerCase()) ||
            (sub.modelNumber && sub.modelNumber.toLowerCase().includes(filterText.toLowerCase())) ||
            (sub.serialNumber && sub.serialNumber.toLowerCase().includes(filterText.toLowerCase())) ||
            (sub.description && sub.description.toLowerCase().includes(filterText.toLowerCase()))
        ) {
            if (!sub.parentSubId) {
                // First-level sub-asset
                results.push({
                    type: 'Component',
                    label: sub.name,
                    context: parentAsset ? `(under ${parentAsset.name})` : '',
                    id: sub.id,
                    isSub: true
                });
            } else {
                // Sub-sub-asset
                results.push({
                    type: 'Sub-Component',
                    label: sub.name,
                    context: parentAsset ? `(under ${parentAsset.name})` : '',
                    id: sub.id,
                    isSub: true
                });
            }
        }
    });
    if (results.length === 0) {
        assetList.innerHTML = `<div class="empty-state"><p>No matching assets or components found.</p></div>`;
        return;
    }
    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'asset-item';
        let pillClass = '';
        let pillLabel = '';
        if (result.type === 'Asset') {
            pillClass = 'asset'; pillLabel = 'Asset';
        } else if (result.type === 'Component') {
            pillClass = 'component'; pillLabel = 'Component';
        } else if (result.type === 'Sub-Component') {
            pillClass = 'subcomponent'; pillLabel = 'Sub-Component';
        }
        item.innerHTML = `
            <span class="type-pill ${pillClass}">${pillLabel}</span>
            <span>${result.label}</span> <span style="color:var(--secondary-color);font-size:0.95em;">${result.context}</span>
        `;
        item.addEventListener('click', () => {
            renderAssetDetails(result.id, result.isSub);
        });
        assetList.appendChild(item);
    });
}

function renderAssetDetails(assetId, isSubAsset = false) {
    // Find the asset or sub-asset
    let asset, isSub = false;
    if (!isSubAsset) {
        asset = assets.find(a => a.id === assetId);
    } else {
        asset = subAssets.find(sa => sa.id === assetId);
        isSub = true;
    }
    if (!asset) return;
    
    // Update selected asset/sub-asset
    if (!isSub) {
        selectedAssetId = assetId;
        selectedSubAssetId = null;
    } else {
        selectedSubAssetId = assetId;
    }
    
    // Update active class in list
    if (!isSub) {
        const assetItems = assetList.querySelectorAll('.asset-item');
        assetItems.forEach(item => {
            item.classList.remove('active');
            if (item.querySelector('.asset-item-name').textContent === asset.name) {
                item.classList.add('active');
            }
        });
    }
    
    // Render asset or sub-asset details
    assetDetails.innerHTML = `
        <div class="asset-header">
            <div class="asset-title">
                <h2>${asset.name}</h2>
                <div class="asset-meta">
                    Added on ${formatDate(asset.createdAt)}
                    ${asset.updatedAt !== asset.createdAt ? ` • Updated on ${formatDate(asset.updatedAt)}` : ''}
                </div>
            </div>
            <div class="asset-actions">
                ${isSub ? `<button class="back-to-parent-btn" title="Back to Parent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>` : ''}
                <button class="edit-asset-btn" data-id="${asset.id}" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z"/></svg>
                </button>
                <button class="delete-asset-btn" data-id="${asset.id}" title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        </div>
        <div class="asset-info">
            <div class="info-item">
                <div class="info-label">Model Number</div>
                <div>${asset.modelNumber || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Serial Number</div>
                <div>${asset.serialNumber || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Purchase Date</div>
                <div>${formatDate(asset.purchaseDate)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Price</div>
                <div>${formatCurrency(asset.price)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Warranty</div>
                <div>${asset.warranty?.scope || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Warranty Expiration</div>
                <div>${formatDate(asset.warranty?.expirationDate)}</div>
            </div>
            ${asset.link ? `
            <div class="info-item">
                <div class="info-label">Link</div>
                <div><a href="${asset.link}" target="_blank" rel="noopener noreferrer">${asset.link}</a></div>
            </div>
            ` : ''}
        </div>
        ${asset.description ? `
        <div class="asset-description">
            <strong>Description:</strong>
            <p>${asset.description}</p>
        </div>
        ` : ''}
        <div class="asset-media">
            ${asset.photoPath ? `
            <div>
                <img src="${asset.photoPath}" alt="${asset.name}" class="asset-image">
            </div>
            ` : ''}
            ${asset.receiptPath ? `
            <div class="receipt-preview">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <a href="${asset.receiptPath}" target="_blank">View Receipt</a>
            </div>
            ` : ''}
        </div>
    `;
    // Add event listeners
    if (isSub) {
        const backBtn = assetDetails.querySelector('.back-to-parent-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                // If sub-sub-asset, go to parent sub-asset; else go to main asset
                if (asset.parentSubId) {
                    renderAssetDetails(asset.parentSubId, true);
                        } else {
                    renderAssetDetails(asset.parentId);
                }
            });
        }
    }
    const editBtn = assetDetails.querySelector('.edit-asset-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            if (isSub) openSubAssetModal(asset);
            else openAssetModal(asset);
        });
    }
    const deleteBtn = assetDetails.querySelector('.delete-asset-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (isSub) deleteSubAsset(asset.id);
            else deleteAsset(asset.id);
        });
    }
    // Only render sub-assets if viewing a main asset
    if (!isSub) {
        renderSubAssets(assetId);
    } else {
        subAssetContainer.classList.add('hidden');
        // If this is a first-level sub-asset (not a sub-sub-asset), show sub-sub-assets and add sub-component button at bottom
        if (!asset.parentSubId) {
            // Components & Attachments section
            const subSubAssets = subAssets.filter(sa => sa.parentSubId === asset.id);
            const section = document.createElement('div');
            section.className = 'sub-asset-section';
            section.innerHTML = `
                <div class="sub-asset-header">
                    <h3>Components & Attachments</h3>
                </div>
            `;
            const list = document.createElement('div');
            list.className = 'sub-asset-list';
            if (subSubAssets.length === 0) {
                list.innerHTML = `<div class="empty-state"><p>No components found. Add your first component.</p></div>`;
            } else {
                subSubAssets.forEach(child => {
                    const childElement = createSubAssetElement(child);
                    list.appendChild(childElement);
                });
            }
            section.appendChild(list);
            // Add Sub-Component button
            const addSubBtn = document.createElement('button');
            addSubBtn.className = 'add-sub-asset-btn';
            addSubBtn.textContent = '+ Add Sub-Component';
            addSubBtn.style.marginTop = '1rem';
            addSubBtn.onclick = () => openSubAssetModal(null, asset.parentId, asset.id);
            section.appendChild(addSubBtn);
            assetDetails.appendChild(section);
        }
    }
    handleSidebarNav();
}

function renderSubAssets(parentAssetId) {
    if (!subAssetContainer || !subAssetList) return;
    
    // Get sub-assets for this parent
    const parentSubAssets = subAssets.filter(sa => sa.parentId === parentAssetId && sa.parentSubId === null);
    
    // Show or hide the container
    if (parentSubAssets.length === 0) {
        subAssetContainer.classList.remove('hidden');
        subAssetList.innerHTML = `
            <div class="empty-state">
                <p>No components found. Add your first component.</p>
            </div>
        `;
                                } else {
        subAssetContainer.classList.remove('hidden');
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
    
    // Create header with name and actions
    const header = document.createElement('div');
    header.className = 'sub-asset-header';
    header.innerHTML = `
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
                childElement.innerHTML = `
                    <div class="sub-asset-header">
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
        renderAssetDetails(subAsset.id, true);
    });
    
    return element;
}

function renderEmptyState() {
    assetDetails.innerHTML = `
        <div class="empty-state">
            <p>Select an asset to view details or add a new one</p>
        </div>
    `;
    
    subAssetContainer.classList.add('hidden');
}

// Modal Functions
function openAssetModal(asset = null) {
    if (!assetModal || !assetForm) return;
    isEditMode = !!asset;
    document.getElementById('modalTitle').textContent = isEditMode ? 'Edit Asset' : 'Add Asset';
    assetForm.reset();
    deletePhoto = false;
    deleteReceipt = false;
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
        const photoPreview = document.getElementById('photoPreview');
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
                    document.getElementById('assetPhoto').value = '';
                    deletePhoto = true;
                }
            };
        }
        const receiptPreview = document.getElementById('receiptPreview');
        if (receiptPreview && asset.receiptPath) {
            receiptPreview.innerHTML = `<div class="receipt-preview" style="position:relative;display:inline-block;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>Receipt file attached</span>
                <button type="button" class="delete-preview-btn" title="Delete Receipt" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;padding:2px;cursor:pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>`;
            receiptPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this receipt?')) {
                    receiptPreview.innerHTML = '';
                    document.getElementById('assetReceipt').value = '';
                    deleteReceipt = true;
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
            newAsset.createdAt = asset.createdAt;
        } else {
            newAsset.id = generateId();
            newAsset.photoPath = null;
            newAsset.receiptPath = null;
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
    
    // Set up file preview
    setupFilePreview('assetPhoto', 'photoPreview');
    setupFilePreview('assetReceipt', 'receiptPreview', true);
    
    // Show the modal
    assetModal.style.display = 'block';
}

function closeAssetModal() {
    if (!assetModal) return;
    assetModal.style.display = 'none';
}

function openSubAssetModal(subAsset = null, parentId = null, parentSubId = null) {
    if (!subAssetModal || !subAssetForm) return;
    isEditMode = !!subAsset;
    document.getElementById('subModalTitle').textContent = isEditMode ? 'Edit Component' : 'Add Component';
    subAssetForm.reset();
    deleteSubPhoto = false;
    deleteSubReceipt = false;
    document.getElementById('parentAssetId').value = subAsset?.parentId || parentId || '';
    document.getElementById('parentSubAssetId').value = subAsset?.parentSubId || parentSubId || '';
    if (isEditMode && subAsset) {
        document.getElementById('subAssetName').value = subAsset.name || '';
        document.getElementById('subAssetModel').value = subAsset.modelNumber || '';
        document.getElementById('subAssetSerial').value = subAsset.serialNumber || '';
        document.getElementById('subAssetPurchaseDate').value = subAsset.purchaseDate ? new Date(subAsset.purchaseDate).toISOString().split('T')[0] : '';
        document.getElementById('subAssetPrice').value = subAsset.price || '';
        document.getElementById('subAssetWarrantyScope').value = subAsset.warranty?.scope || '';
        document.getElementById('subAssetWarrantyExpiration').value = subAsset.warranty?.expirationDate ? new Date(subAsset.warranty.expirationDate).toISOString().split('T')[0] : '';
        document.getElementById('subAssetLink').value = subAsset.link || '';
        document.getElementById('subAssetDescription').value = subAsset.description || '';
        // Preview existing images
        const photoPreview = document.getElementById('subPhotoPreview');
        if (photoPreview && subAsset.photoPath) {
            photoPreview.innerHTML = `<div style="position:relative;display:inline-block;">
                <img src="${subAsset.photoPath}" alt="Component Photo">
                <button type="button" class="delete-preview-btn" title="Delete Image" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;padding:2px;cursor:pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>`;
            photoPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this image?')) {
                    photoPreview.innerHTML = '';
                    document.getElementById('subAssetPhoto').value = '';
                    deleteSubPhoto = true;
                }
            };
        }
        const receiptPreview = document.getElementById('subReceiptPreview');
        if (receiptPreview && subAsset.receiptPath) {
            receiptPreview.innerHTML = `<div class="receipt-preview" style="position:relative;display:inline-block;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>Receipt file attached</span>
                <button type="button" class="delete-preview-btn" title="Delete Receipt" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;padding:2px;cursor:pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>`;
            receiptPreview.querySelector('.delete-preview-btn').onclick = () => {
                if (confirm('Are you sure you want to delete this receipt?')) {
                    receiptPreview.innerHTML = '';
                    document.getElementById('subAssetReceipt').value = '';
                    deleteSubReceipt = true;
                }
            };
        }
    }
    // Set up form submission
    subAssetForm.onsubmit = (e) => {
        e.preventDefault();
        
        // Create sub-asset object
        const newSubAsset = {
            name: document.getElementById('subAssetName').value,
            parentId: document.getElementById('parentAssetId').value,
            parentSubId: document.getElementById('parentSubAssetId').value || null,
            modelNumber: document.getElementById('subAssetModel').value,
            serialNumber: document.getElementById('subAssetSerial').value,
            purchaseDate: document.getElementById('subAssetPurchaseDate').value,
            price: parseFloat(document.getElementById('subAssetPrice').value) || null,
            warranty: {
                scope: document.getElementById('subAssetWarrantyScope').value,
                expirationDate: document.getElementById('subAssetWarrantyExpiration').value
            },
            link: document.getElementById('subAssetLink').value,
            description: document.getElementById('subAssetDescription').value,
            updatedAt: new Date().toISOString()
        };
        
        // Add ID if editing, generate new one if adding
        if (isEditMode && subAsset) {
            newSubAsset.id = subAsset.id;
            newSubAsset.photoPath = subAsset.photoPath;
            newSubAsset.receiptPath = subAsset.receiptPath;
            newSubAsset.createdAt = subAsset.createdAt;
        } else {
            newSubAsset.id = generateId();
            newSubAsset.photoPath = null;
            newSubAsset.receiptPath = null;
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
    
    // Set up file preview
    setupFilePreview('subAssetPhoto', 'subPhotoPreview');
    setupFilePreview('subAssetReceipt', 'subReceiptPreview', true);
    
    // Show the modal
    subAssetModal.style.display = 'block';
}

function closeSubAssetModal() {
    if (!subAssetModal) return;
    subAssetModal.style.display = 'none';
}

// File handling functions
function setupFilePreview(inputId, previewId, isDocument = false) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    if (!input || !preview) return;
    
    // Store the previous file value to restore if user cancels
    let previousValue = input.value;

    input.onchange = () => {
        // Determine if there is an existing image
        let hasExisting = false;
        if (inputId === 'assetPhoto') {
            const assetName = document.getElementById('assetName');
            const editingAsset = assets.find(a => a.name === assetName?.value);
            hasExisting = editingAsset && editingAsset.photoPath;
        } else if (inputId === 'subAssetPhoto') {
            const subAssetName = document.getElementById('subAssetName');
            const editingSub = subAssets.find(sa => sa.name === subAssetName?.value);
            hasExisting = editingSub && editingSub.photoPath;
        }
        // If there is an existing image and a new file is selected, warn the user
        if (hasExisting && input.files && input.files[0]) {
            const confirmOverride = confirm('This will override the previous image. Are you sure?');
            if (!confirmOverride) {
                input.value = previousValue;
                return;
            }
        }
        previousValue = input.value;
        preview.innerHTML = '';
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (isDocument) {
                // For documents, show icon and filename
                preview.innerHTML = `
                    <div class="receipt-preview">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>${file.name}</span>
                    </div>
                `;
            } else {
                // For images, show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(file);
            }
        }
    };
}

async function handleFileUploads(asset, isEditMode, isSubAsset = false) {
    // Clone the asset to avoid modifying the original
    const assetCopy = { ...asset };
    
    // Get file inputs
    const photoInput = document.getElementById(isSubAsset ? 'subAssetPhoto' : 'assetPhoto');
    const receiptInput = document.getElementById(isSubAsset ? 'subAssetReceipt' : 'assetReceipt');
    
    // Handle photo upload
    if (photoInput.files && photoInput.files[0]) {
        const photoPath = await uploadFile(photoInput.files[0], 'image', assetCopy.id);
        assetCopy.photoPath = photoPath;
    }
    
    // Handle receipt upload
    if (receiptInput.files && receiptInput.files[0]) {
        const receiptPath = await uploadFile(receiptInput.files[0], 'receipt', assetCopy.id);
        assetCopy.receiptPath = receiptPath;
    }
    
    return assetCopy;
}

async function uploadFile(file, type, id) {
    // type: 'image' or 'receipt'
    const endpoint = type === 'image' ? '/api/upload/image' : '/api/upload/receipt';
    const formData = new FormData();
    formData.append(type === 'image' ? 'photo' : 'receipt', file);
    formData.append('id', id);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        return data.path;
    } catch (err) {
        alert('File upload failed.');
        return null;
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    loadAssets();
    loadSubAssets();
    
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
});

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