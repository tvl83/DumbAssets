/**
 * DemoStorageManager - Client-side storage manager for demo mode
 * Handles all CRUD operations using localStorage when DEMO_MODE is enabled
 */
export class DemoStorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            ASSETS: 'dumbAssets_demo_assets',
            SUBASSETS: 'dumbAssets_demo_subassets',
            SETTINGS: 'dumbAssets_demo_settings'
        };
        this.initializeStorage();
    }

    /**
     * Initialize storage with sample data if empty
     */
    initializeStorage() {
        if (!this.getAssets().length) {
            // Load initial data from server once
            this.loadInitialData();
        }
    }

    /**
     * Load initial data from server to populate demo storage
     */
    async loadInitialData() {
        try {
            const apiBaseUrl = this.getApiBaseUrl();
            
            // Load assets
            const assetsResponse = await fetch(`${apiBaseUrl}/api/assets`, {
                credentials: 'include'
            });
            if (assetsResponse.ok) {
                const assets = await assetsResponse.json();
                localStorage.setItem(this.STORAGE_KEYS.ASSETS, JSON.stringify(assets));
            }

            // Load sub-assets
            const subAssetsResponse = await fetch(`${apiBaseUrl}/api/subassets`, {
                credentials: 'include'
            });
            if (subAssetsResponse.ok) {
                const subAssets = await subAssetsResponse.json();
                localStorage.setItem(this.STORAGE_KEYS.SUBASSETS, JSON.stringify(subAssets));
            }
        } catch (error) {
            console.warn('Could not load initial data for demo mode:', error);
            // Initialize with empty arrays if server data unavailable
            localStorage.setItem(this.STORAGE_KEYS.ASSETS, JSON.stringify([]));
            localStorage.setItem(this.STORAGE_KEYS.SUBASSETS, JSON.stringify([]));
        }
    }

    /**
     * Get API base URL helper
     */
    getApiBaseUrl() {
        return window.location.protocol + '//' + window.location.host;
    }

    /**
     * Generate a unique ID
     */
    generateId() {
        return Math.floor(Math.random() * 10000000000).toString();
    }

    // === ASSETS METHODS ===

    /**
     * Get all assets from localStorage
     */
    getAssets() {
        const stored = localStorage.getItem(this.STORAGE_KEYS.ASSETS);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Save assets to localStorage
     */
    saveAssets(assets) {
        localStorage.setItem(this.STORAGE_KEYS.ASSETS, JSON.stringify(assets));
    }

    /**
     * Create or update an asset
     */
    saveAsset(asset) {
        const assets = this.getAssets();
        const isEditMode = !!asset.id && assets.some(a => a.id === asset.id);
        
        if (isEditMode) {
            // Update existing asset
            const index = assets.findIndex(a => a.id === asset.id);
            if (index !== -1) {
                // Preserve creation date
                asset.createdAt = assets[index].createdAt;
                asset.updatedAt = new Date().toISOString();
                assets[index] = asset;
            }
        } else {
            // Create new asset
            if (!asset.id) {
                asset.id = this.generateId();
            }
            asset.createdAt = new Date().toISOString();
            asset.updatedAt = new Date().toISOString();
            assets.push(asset);
        }

        this.saveAssets(assets);
        return Promise.resolve(asset);
    }

    /**
     * Delete an asset
     */
    deleteAsset(assetId) {
        const assets = this.getAssets();
        const subAssets = this.getSubAssets();
        
        // Remove the asset
        const filteredAssets = assets.filter(a => a.id !== assetId);
        
        // Remove all related sub-assets
        const filteredSubAssets = subAssets.filter(sa => sa.parentId !== assetId);
        
        this.saveAssets(filteredAssets);
        this.saveSubAssets(filteredSubAssets);
        
        return Promise.resolve({ message: 'Asset deleted successfully' });
    }

    // === SUB-ASSETS METHODS ===

    /**
     * Get all sub-assets from localStorage
     */
    getSubAssets() {
        const stored = localStorage.getItem(this.STORAGE_KEYS.SUBASSETS);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Save sub-assets to localStorage
     */
    saveSubAssets(subAssets) {
        localStorage.setItem(this.STORAGE_KEYS.SUBASSETS, JSON.stringify(subAssets));
    }

    /**
     * Create or update a sub-asset
     */
    saveSubAsset(subAsset) {
        const subAssets = this.getSubAssets();
        const isEditMode = !!subAsset.id && subAssets.some(sa => sa.id === subAsset.id);
        
        if (isEditMode) {
            // Update existing sub-asset
            const index = subAssets.findIndex(sa => sa.id === subAsset.id);
            if (index !== -1) {
                // Preserve creation date
                subAsset.createdAt = subAssets[index].createdAt;
                subAsset.updatedAt = new Date().toISOString();
                subAssets[index] = subAsset;
            }
        } else {
            // Create new sub-asset
            if (!subAsset.id) {
                subAsset.id = this.generateId();
            }
            subAsset.createdAt = new Date().toISOString();
            subAsset.updatedAt = new Date().toISOString();
            subAssets.push(subAsset);
        }

        this.saveSubAssets(subAssets);
        return Promise.resolve(subAsset);
    }

    /**
     * Delete a sub-asset and its children
     */
    deleteSubAsset(subAssetId) {
        const subAssets = this.getSubAssets();
        
        // Find sub-assets to delete (including nested children)
        const subAssetIdsToDelete = new Set([subAssetId]);
        let childrenToProcess = [subAssets.find(sa => sa.id === subAssetId)].filter(Boolean);
        
        while (childrenToProcess.length > 0) {
            const current = childrenToProcess.shift();
            
            // Find all direct children of this component
            const directChildren = subAssets.filter(sa => 
                sa.parentSubId === current.id && 
                !subAssetIdsToDelete.has(sa.id)
            );
            
            // Add valid children to deletion set and processing queue
            directChildren.forEach(child => {
                subAssetIdsToDelete.add(child.id);
                childrenToProcess.push(child);
            });
        }
        
        // Filter out all sub-assets that need to be deleted
        const filteredSubAssets = subAssets.filter(sa => !subAssetIdsToDelete.has(sa.id));
        
        this.saveSubAssets(filteredSubAssets);
        return Promise.resolve({ message: 'Sub-asset deleted successfully' });
    }

    // === SETTINGS METHODS ===

    /**
     * Get settings from localStorage
     */
    getSettings() {
        const stored = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
        return stored ? JSON.parse(stored) : {};
    }

    /**
     * Save settings to localStorage
     */
    saveSettings(settings) {
        localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        return Promise.resolve(settings);
    }

    // === FILE UPLOAD SIMULATION ===

    /**
     * Simulate file upload by creating a data URL
     * In demo mode, files are stored as base64 data URLs
     */
    async uploadFile(file, type, assetId) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const mockPath = `/demo-files/${type}/${assetId}_${Date.now()}_${file.name}`;
                
                // Store the file data in localStorage for later retrieval
                const fileKey = `dumbAssets_demo_file_${mockPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
                localStorage.setItem(fileKey, dataUrl);
                
                resolve({
                    path: mockPath,
                    fileInfo: {
                        originalName: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified
                    }
                });
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Get file data URL for demo files
     */
    getFileDataUrl(path) {
        if (!path || !path.startsWith('/demo-files/')) {
            return path; // Return original path for non-demo files
        }
        
        const fileKey = `dumbAssets_demo_file_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        return localStorage.getItem(fileKey) || path;
    }

    /**
     * Delete file simulation
     */
    deleteFile(path) {
        if (path && path.startsWith('/demo-files/')) {
            const fileKey = `dumbAssets_demo_file_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
            localStorage.removeItem(fileKey);
        }
        return Promise.resolve({ message: 'File deleted successfully' });
    }

    // === IMPORT SIMULATION ===

    /**
     * Simulate asset import
     */
    importAssets(importData) {
        const { assets: newAssets = [], subAssets: newSubAssets = [] } = importData;
        const currentAssets = this.getAssets();
        const currentSubAssets = this.getSubAssets();
        
        // Generate new IDs for imported assets
        const processedAssets = newAssets.map(asset => ({
            ...asset,
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));
        
        const processedSubAssets = newSubAssets.map(subAsset => ({
            ...subAsset,
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));
        
        // Merge with existing data
        this.saveAssets([...currentAssets, ...processedAssets]);
        this.saveSubAssets([...currentSubAssets, ...processedSubAssets]);
        
        return Promise.resolve({
            message: 'Assets imported successfully',
            imported: {
                assets: processedAssets.length,
                subAssets: processedSubAssets.length
            }
        });
    }

    // === UTILITY METHODS ===

    /**
     * Clear all demo data
     */
    clearDemoData() {
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Clear demo files
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('dumbAssets_demo_file_')) {
                localStorage.removeItem(key);
            }
        });
    }

    /**
     * Check if we're in demo mode
     */
    static isDemoMode() {
        return window.appConfig && window.appConfig.demoMode;
    }
}
