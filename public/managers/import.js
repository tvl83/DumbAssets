// public/managers/import.js
// ImportManager handles all import modal logic, file selection, mapping, and import actions

import { DemoModeManager } from './demoModeManager.js';

export class ImportManager {
    constructor({
        importModal,
        importBtn,
        importFile,
        startImportBtn,
        columnSelects,
        showToast,
        setButtonLoading,
        loadAssets
    }) {
        this.importModal = importModal;
        this.importBtn = importBtn;
        this.importFile = importFile;
        this.startImportBtn = startImportBtn;
        this.columnSelects = columnSelects;
        this.showToast = showToast;
        this.setButtonLoading = setButtonLoading;
        this.loadAssets = loadAssets;
        this.demoModeManager = new DemoModeManager();
        this._bindEvents();
    }

    _bindEvents() {
        this.importBtn.addEventListener('click', () => {
            this.resetImportForm();
            this.importModal.style.display = 'block';
        });
        this.importModal.querySelector('.close-btn').addEventListener('click', () => {
            this.importModal.style.display = 'none';
            this.resetImportForm();
        });
        this.importFile.addEventListener('change', (e) => this._handleFileSelection(e));
        this.startImportBtn.addEventListener('click', () => this._handleImport());
        // Download Template button event
        const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
        if (downloadTemplateBtn) {
            downloadTemplateBtn.addEventListener('click', () => this._downloadTemplate());
        }
    }

    async _handleFileSelection(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            // Check if we're in demo mode
            if (this.demoModeManager.isDemoMode) {
                // In demo mode, parse the CSV file directly on client side
                const fileText = await file.text();
                const lines = fileText.split(/\r?\n/).filter(Boolean);
                if (lines.length < 1) {
                    alert('Invalid CSV file');
                    return;
                }
                
                const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
                
                // Show the column mapping section
                const mappingContainer = document.querySelector('.column-mapping');
                if (mappingContainer) mappingContainer.style.display = 'block';
                
                // Populate column selects
                this.columnSelects.forEach(select => {
                    select.innerHTML = '<option value="">Select Column</option>';
                    headers.forEach((header, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = header;
                        select.appendChild(option);
                    });
                });
                
                // Auto-map columns
                this.autoMapColumns(headers);
                this.startImportBtn.disabled = false;
                return;
            }
            
            // Normal mode: send to server for processing
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/import-assets', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to get headers');
            const data = await response.json();
            const headers = data.headers || [];
            // Show the column mapping section
            const mappingContainer = document.querySelector('.column-mapping');
            if (mappingContainer) mappingContainer.style.display = 'block';
            // Populate column selects
            this.columnSelects.forEach(select => {
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
            const tagsColumn = document.getElementById('tagsColumn');
            [urlColumn, warrantyColumn, warrantyExpirationColumn, tagsColumn].forEach(select => {
                if (!select) return;
                select.innerHTML = '<option value="">Select Column</option>';
                headers.forEach((header, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = header;
                    select.appendChild(option);
                });
            });
            const secondaryWarrantyColumn = document.getElementById('secondaryWarrantyColumn');
            const secondaryWarrantyExpirationColumn = document.getElementById('secondaryWarrantyExpirationColumn');
            [secondaryWarrantyColumn, secondaryWarrantyExpirationColumn].forEach(select => {
                if (!select) return;
                select.innerHTML = '<option value="">Select Column</option>';
                headers.forEach((header, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = header;
                    select.appendChild(option);
                });
            });
            this.autoMapColumns(headers);
            this.startImportBtn.disabled = headers.length === 0;
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Failed to read file: ' + error.message);
        }
    }

    async _handleImport() {
        this.setButtonLoading(this.startImportBtn, true);
        const file = this.importFile.files[0];
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
            url: document.getElementById('urlColumn').value,
            warranty: document.getElementById('warrantyColumn').value,
            warrantyExpiration: document.getElementById('warrantyExpirationColumn').value,
            secondaryWarranty: document.getElementById('secondaryWarrantyColumn') ? document.getElementById('secondaryWarrantyColumn').value : '',
            secondaryWarrantyExpiration: document.getElementById('secondaryWarrantyExpirationColumn') ? document.getElementById('secondaryWarrantyExpirationColumn').value : '',
            tags: document.getElementById('tagsColumn') ? document.getElementById('tagsColumn').value : ''
        };
        if (!mappings.name) {
            alert('Please map the Name column');
            this.setButtonLoading(this.startImportBtn, false);
            return;
        }
        // Client-side validation: read file and check required fields, date columns, tags
        try {
            const fileText = await file.text();
            const lines = fileText.split(/\r?\n/).filter(Boolean);
            if (lines.length < 2) throw new Error('No data rows found in file.');
            const headers = lines[0].split(',');
            const dataRows = lines.slice(1);
            const dateCols = ['purchaseDate', 'warrantyExpiration', 'secondaryWarrantyExpiration'];
            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i].split(',');
                // Validate name
                const nameIdx = mappings.name !== '' ? parseInt(mappings.name) : -1;
                if (nameIdx === -1 || !row[nameIdx] || !row[nameIdx].trim()) {
                    alert(`Row ${i+2}: Name is required.`);
                    this.setButtonLoading(this.startImportBtn, false);
                    return;
                }
                // Validate date columns
                for (const col of dateCols) {
                    const idx = mappings[col] !== '' ? parseInt(mappings[col]) : -1;
                    if (idx !== -1 && row[idx] && row[idx].trim()) {
                        const val = row[idx].replace(/"/g, '');
                        if (isNaN(Date.parse(val))) {
                            alert(`Row ${i+2}: Invalid date in column '${headers[idx]}' (${val})`);
                            this.setButtonLoading(this.startImportBtn, false);
                            return;
                        }
                    }
                }
            }
        } catch (validationError) {
            alert('Validation error: ' + validationError.message);
            this.setButtonLoading(this.startImportBtn, false);
            return;
        }
        // ...existing code for sending to backend...
        try {
            // Check if we're in demo mode
            if (this.demoModeManager.isDemoMode) {
                // In demo mode, process the import locally
                const fileText = await file.text();
                const lines = fileText.split(/\r?\n/).filter(Boolean);
                const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
                const dataRows = lines.slice(1);
                
                let importedCount = 0;
                
                for (const row of dataRows) {
                    const columns = row.split(',').map(col => col.trim().replace(/"/g, ''));
                    
                    // Build asset object from mappings
                    const asset = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    // Map columns to asset properties
                    if (mappings.name && columns[mappings.name]) asset.name = columns[mappings.name];
                    if (mappings.model && columns[mappings.model]) asset.modelNumber = columns[mappings.model];
                    if (mappings.manufacturer && columns[mappings.manufacturer]) asset.manufacturer = columns[mappings.manufacturer];
                    if (mappings.serial && columns[mappings.serial]) asset.serialNumber = columns[mappings.serial];
                    if (mappings.purchasePrice && columns[mappings.purchasePrice]) {
                        const price = parseFloat(columns[mappings.purchasePrice].replace(/[^0-9.-]/g, ''));
                        if (!isNaN(price)) asset.purchasePrice = price;
                    }
                    if (mappings.notes && columns[mappings.notes]) asset.notes = columns[mappings.notes];
                    if (mappings.url && columns[mappings.url]) asset.link = columns[mappings.url];
                    
                    // Handle dates
                    if (mappings.purchaseDate && columns[mappings.purchaseDate]) {
                        const date = new Date(columns[mappings.purchaseDate]);
                        if (!isNaN(date.getTime())) asset.purchaseDate = date.toISOString();
                    }
                    
                    // Handle warranty
                    if (mappings.warranty && columns[mappings.warranty]) {
                        asset.warranty = { scope: columns[mappings.warranty] };
                    }
                    if (mappings.warrantyExpiration && columns[mappings.warrantyExpiration]) {
                        const date = new Date(columns[mappings.warrantyExpiration]);
                        if (!isNaN(date.getTime())) {
                            if (!asset.warranty) asset.warranty = {};
                            asset.warranty.expirationDate = date.toISOString();
                        }
                    }
                    
                    // Handle secondary warranty
                    if (mappings.secondaryWarranty && columns[mappings.secondaryWarranty]) {
                        asset.secondaryWarranty = { scope: columns[mappings.secondaryWarranty] };
                    }
                    if (mappings.secondaryWarrantyExpiration && columns[mappings.secondaryWarrantyExpiration]) {
                        const date = new Date(columns[mappings.secondaryWarrantyExpiration]);
                        if (!isNaN(date.getTime())) {
                            if (!asset.secondaryWarranty) asset.secondaryWarranty = {};
                            asset.secondaryWarranty.expirationDate = date.toISOString();
                        }
                    }
                    
                    // Handle tags
                    if (mappings.tags && columns[mappings.tags]) {
                        asset.tags = columns[mappings.tags].split(',').map(tag => tag.trim()).filter(tag => tag);
                    }
                    
                    // Skip if no name
                    if (!asset.name) continue;
                    
                    // Save asset using demo storage manager
                    await this.demoModeManager.saveAsset(asset);
                    importedCount++;
                }
                
                alert(`Successfully imported ${importedCount} assets`);
                this.importModal.style.display = 'none';
                this.importFile.value = '';
                this.startImportBtn.disabled = true;
                this.setButtonLoading(this.startImportBtn, false);
                this.columnSelects.forEach(select => {
                    select.innerHTML = '<option value="">Select Column</option>';
                });
                await this.loadAssets();
                // Rerender dashboard after import
                if (window.renderDashboard) window.renderDashboard();
                return;
            }
            
            // Normal mode: send to server
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mappings', JSON.stringify(mappings));
            const response = await fetch('/api/import-assets', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            if (!response.ok) {
                if (response.status === 401) {
                    window.location.reload();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Import failed');
            }
            const result = await response.json();
            alert(`Successfully imported ${result.importedCount} assets`);
            this.importModal.style.display = 'none';
            this.importFile.value = '';
            this.startImportBtn.disabled = true;
            this.setButtonLoading(this.startImportBtn, false);
            this.columnSelects.forEach(select => {
                select.innerHTML = '<option value="">Select Column</option>';
            });
            await this.loadAssets();
            // Rerender dashboard after import
            if (window.renderDashboard) window.renderDashboard();
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import assets: ' + error.message);
            this.setButtonLoading(this.startImportBtn, false);
        }
    }

    autoMapColumns(headers) {
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
            warrantyExpirationColumn: ["warranty expiration", "warranty expiry", "warranty end", "warranty end date", "expiration", "expiry"],
            secondaryWarrantyColumn: ["secondary warranty", "secondary warranty scope", "warranty 2", "warranty2", "warranty scope 2"],
            secondaryWarrantyExpirationColumn: ["secondary warranty expiration", "secondary warranty expiry", "secondary warranty end", "secondary warranty end date", "warranty 2 expiration", "warranty2 expiration", "warranty expiration 2", "warranty expiry 2"],
            tagsColumn: ["tags", "tag", "labels", "categories"]
        };
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

    resetImportForm() {
        // Remove file preview and clear file input
        const importFilePreview = document.getElementById('importFilePreview');
        if (importFilePreview) importFilePreview.innerHTML = '';
        if (this.importFile) {
            this.importFile.value = '';
            // Forcibly remove files from input (for browsers that keep the file after value='')
            if (this.importFile.files && this.importFile.files.length > 0) {
                const dt = new DataTransfer();
                this.importFile.files = dt.files;
            }
        }
        this.columnSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Column</option>';
        });
        // Explicitly reset all individual column selects in case they are not in columnSelects
        const columnIds = [
            'nameColumn',
            'modelColumn',
            'manufacturerColumn',
            'serialColumn',
            'purchaseDateColumn',
            'purchasePriceColumn',
            'notesColumn',
            'urlColumn',
            'warrantyColumn',
            'warrantyExpirationColumn',
            'secondaryWarrantyColumn',
            'secondaryWarrantyExpirationColumn',
            'tagsColumn'
        ];
        columnIds.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">Select Column</option>';
                select.value = '';
            }
        });
        this.startImportBtn.disabled = true;
        // Optionally hide column mapping UI if needed
        const mappingContainer = document.querySelector('.column-mapping');
        if (mappingContainer) mappingContainer.style.display = 'none';
    }

    _downloadTemplate() {
        // Define the headers for the template CSV
        const headers = [
            'Name',
            'Manufacturer',
            'Model',
            'Serial',
            'Purchase Date',
            'Purchase Price',
            'Notes',
            'URL',
            'Warranty',
            'Warranty Expiration',
            'Secondary Warranty',
            'Secondary Warranty Expiration',
            'Tags'
        ];
        // Generate test data row
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const testRow = headers.map(h => {
            const lower = h.toLowerCase();
            if (lower.includes('date') || lower.includes('expiration')) return today;
            if (lower === 'tags') return '"tag1,tag2,tag3"'; // CSV string for tags
            if (lower === 'purchase price') return '123.45';
            return `Test ${h}`;
        });
        const csvContent = headers.join(',') + '\n' + testRow.join(',') + '\n';
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'assets.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }
}

// Make resetImportForm globally accessible for fileUploader.js
if (typeof window !== 'undefined') {
    window.resetImportForm = (...args) => {
        if (typeof ImportManager !== 'undefined' && ImportManager.prototype.resetImportForm) {
            // Find the importManager instance if possible
            if (window.importManager && typeof window.importManager.resetImportForm === 'function') {
                window.importManager.resetImportForm(...args);
            }
        }
    };
}
