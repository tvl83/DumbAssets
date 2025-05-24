// DemoModeManager - Central abstraction for demo mode logic
// Handles all demo mode checks and routes storage access to DemoStorageManager
import { DemoStorageManager } from './demoStorage.js';

export class DemoModeManager {
    constructor() {
        this.isDemoMode = DemoStorageManager.isDemoMode();
        this.demoStorageManager = this.isDemoMode ? new DemoStorageManager() : null;
    }

    // --- Demo mode check ---
    static isDemoMode() {
        return DemoStorageManager.isDemoMode();
    }

    // --- Asset methods ---
    getAssets() {
        return this.isDemoMode ? this.demoStorageManager.getAssets() : null;
    }
    saveAsset(asset) {
        return this.isDemoMode ? this.demoStorageManager.saveAsset(asset) : null;
    }
    deleteAsset(assetId) {
        return this.isDemoMode ? this.demoStorageManager.deleteAsset(assetId) : null;
    }

    // --- Sub-asset methods ---
    getSubAssets() {
        return this.isDemoMode ? this.demoStorageManager.getSubAssets() : null;
    }
    saveSubAsset(subAsset) {
        return this.isDemoMode ? this.demoStorageManager.saveSubAsset(subAsset) : null;
    }
    deleteSubAsset(subAssetId) {
        return this.isDemoMode ? this.demoStorageManager.deleteSubAsset(subAssetId) : null;
    }

    // --- Settings methods ---
    getSettings() {
        return this.isDemoMode ? this.demoStorageManager.getSettings() : null;
    }
    saveSettings(settings) {
        return this.isDemoMode ? this.demoStorageManager.saveSettings(settings) : null;
    }

    // --- File methods ---
    uploadFile(file, type, assetId) {
        return this.isDemoMode ? this.demoStorageManager.uploadFile(file, type, assetId) : null;
    }
    getFileDataUrl(path) {
        return this.isDemoMode ? this.demoStorageManager.getFileDataUrl(path) : path;
    }
    deleteFile(path) {
        return this.isDemoMode ? this.demoStorageManager.deleteFile(path) : null;
    }

    // --- Import simulation ---
    importAssets(importData) {
        return this.isDemoMode ? this.demoStorageManager.importAssets(importData) : null;
    }

    // --- Utility ---
    clearDemoData() {
        if (this.isDemoMode) this.demoStorageManager.clearDemoData();
    }
}
