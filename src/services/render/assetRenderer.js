/**
 * Asset Renderer Service
 * Handles rendering of asset details, sub-assets, and related UI components
 */

// Import utility functions if needed
// These will be injected when we use the module
let formatDate;
let formatCurrency;

// These functions from other modules will be injected
let openAssetModal;
let openSubAssetModal;
let deleteAsset;
let deleteSubAsset;
let createSubAssetElement;
let handleSidebarNav;
let renderSubAssets;

// Global state references - will be passed from main script
let assets = [];
let subAssets = [];
let selectedAssetId = null;
let selectedSubAssetId = null;

// DOM element references - will be passed from main script
let assetList;
let assetDetails;
let subAssetContainer;

/**
 * Initialize the renderer with required dependencies
 * 
 * @param {Object} config Configuration object with dependencies
 */
function initRenderer(config) {
    // Store references to utility functions
    formatDate = config.formatDate;
    formatCurrency = config.formatCurrency;
    
    // Store references to other module functions
    openAssetModal = config.openAssetModal;
    openSubAssetModal = config.openSubAssetModal;
    deleteAsset = config.deleteAsset;
    deleteSubAsset = config.deleteSubAsset;
    createSubAssetElement = config.createSubAssetElement;
    handleSidebarNav = config.handleSidebarNav;
    renderSubAssets = config.renderSubAssets;
    
    // Store references to global state
    assets = config.assets;
    subAssets = config.subAssets;
    
    // Store references to DOM elements
    assetList = config.assetList;
    assetDetails = config.assetDetails;
    subAssetContainer = config.subAssetContainer;
}

/**
 * Update the global state references
 * 
 * @param {Array} newAssets Updated assets array
 * @param {Array} newSubAssets Updated sub-assets array
 */
function updateState(newAssets, newSubAssets) {
    assets = newAssets;
    subAssets = newSubAssets;
}

/**
 * Update the selected asset and sub-asset IDs
 * 
 * @param {String} assetId Selected asset ID
 * @param {String} subAssetId Selected sub-asset ID
 */
function updateSelectedIds(assetId, subAssetId) {
    selectedAssetId = assetId;
    selectedSubAssetId = subAssetId;
}

/**
 * Render asset details in the UI
 * 
 * @param {String} assetId ID of the asset to render
 * @param {Boolean} isSubAsset Whether the asset is a sub-asset
 * @returns {void}
 */
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
    
    // Update active class in list using dataset.id instead of name
    if (!isSub) {
        const assetItems = assetList.querySelectorAll('.asset-item');
        assetItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === assetId) {
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
                    Added: ${formatDate(asset.createdAt)}
                    ${asset.updatedAt !== asset.createdAt ? ` • Updated: ${formatDate(asset.updatedAt)}` : ''}
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
        <div class="asset-files">
            <div class="files-grid">
                ${asset.photoPath ? `
                <div class="file-item photo">
                    <img src="${asset.photoPath}" alt="${asset.name}" class="asset-image">
                    <div class="file-label">Photo</div>
                </div>
                ` : ''}
                ${asset.receiptPath ? `
                <div class="file-item receipt">
                    <a href="${asset.receiptPath}" target="_blank" class="file-preview">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <div class="file-label">Receipt</div>
                    </a>
                </div>
                ` : ''}
                ${asset.manualPath ? `
                <div class="file-item manual">
                    <a href="${asset.manualPath}" target="_blank" class="file-preview">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <div class="file-label">Manual</div>
                    </a>
                </div>
                ` : ''}
            </div>
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

// Export the module functions
export {
    initRenderer,
    updateState,
    updateSelectedIds,
    renderAssetDetails
}; 