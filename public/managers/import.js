// public/managers/import.js
// ImportManager handles all import modal logic, file selection, mapping, and import actions

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
        this._bindEvents();
    }

    _bindEvents() {
        this.importBtn.addEventListener('click', () => {
            this.importModal.style.display = 'block';
        });
        this.importModal.querySelector('.close-btn').addEventListener('click', () => {
            this.importModal.style.display = 'none';
            this.resetImportForm();
        });
        this.importFile.addEventListener('change', (e) => this._handleFileSelection(e));
        this.startImportBtn.addEventListener('click', () => this._handleImport());
    }

    async _handleFileSelection(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
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
            warrantyExpiration: document.getElementById('warrantyExpirationColumn').value
        };
        if (!mappings.name) {
            alert('Please map the Name column');
            this.setButtonLoading(this.startImportBtn, false);
            return;
        }
        try {
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
            warrantyExpirationColumn: ["warranty expiration", "warranty expiry", "warranty end", "warranty end date", "expiration", "expiry"]
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
        this.importFile.value = '';
        this.columnSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Column</option>';
        });
        this.startImportBtn.disabled = true;
    }
}
