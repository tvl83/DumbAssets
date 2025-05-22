// SettingsManager handles all settings modal logic, loading, saving, and dashboard order drag/drop
export class SettingsManager {
    constructor({
        settingsBtn,
        settingsModal,
        notificationForm,
        saveSettings,
        cancelSettings,
        settingsClose,
        testNotificationSettings,
        setButtonLoading,
        showToast,
        renderDashboard,
        getDashboardOrder
    }) {
        this.settingsBtn = settingsBtn;
        this.settingsModal = settingsModal;
        this.notificationForm = notificationForm;
        this.saveSettings = saveSettings;
        this.cancelSettings = cancelSettings;
        this.settingsClose = settingsClose;
        this.testNotificationSettings = testNotificationSettings;
        this.setButtonLoading = setButtonLoading;
        this.showToast = showToast;
        this.renderDashboard = renderDashboard;
        this.getDashboardOrder = getDashboardOrder;
        this.selectedAssetId = null;
        this.DEBUG = false;
        this._bindEvents();
    }

    _bindEvents() {
        this.settingsBtn.addEventListener('click', async () => {
            await this.loadSettings();
            this.settingsModal.style.display = 'block';
            // Use last opened tab if available
            const lastTab = localStorage.getItem('dumbAssetSettingsLastOpenedPane') || 'notifications';
            this.showSettingsTab(lastTab);
        });
        this.settingsClose.addEventListener('click', () => this.closeSettingsModal());
        this.cancelSettings.addEventListener('click', () => this.closeSettingsModal());
        this.saveSettings.addEventListener('click', () => this._saveSettings());
        this.testNotificationSettings.addEventListener('click', () => this._testNotificationSettings());
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                // Save last opened tab to localStorage
                localStorage.setItem('dumbAssetSettingsLastOpenedPane', tabId);
                this.showSettingsTab(tabId);
            });
        });
    }

    closeSettingsModal() {
        this.settingsModal.style.display = 'none';
    }

    showSettingsTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabId}-tab`);
        });
        if (tabId === 'notifications') {
            this.testNotificationSettings.style.display = 'block';
        } else {
            this.testNotificationSettings.style.display = 'none';
        }
        if (tabId === 'interface') {
            this.initSortable();
        }
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings', { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load settings');
            const settings = await response.json();
            const notificationSettings = settings.notificationSettings || {};
            this.notificationForm.notifyAdd.checked = !!notificationSettings.notifyAdd;
            this.notificationForm.notifyDelete.checked = !!notificationSettings.notifyDelete;
            this.notificationForm.notifyEdit.checked = !!notificationSettings.notifyEdit;
            this.notificationForm.notify1Month.checked = !!notificationSettings.notify1Month;
            this.notificationForm.notify2Week.checked = !!notificationSettings.notify2Week;
            this.notificationForm.notify7Day.checked = !!notificationSettings.notify7Day;
            this.notificationForm.notify3Day.checked = !!notificationSettings.notify3Day;
            const interfaceSettings = settings.interfaceSettings || {};
            // Dashboard order
            if (interfaceSettings.dashboardOrder && Array.isArray(interfaceSettings.dashboardOrder)) {
                const dashboardSectionsContainer = document.getElementById('dashboardSections');
                if (dashboardSectionsContainer) {
                    const sections = dashboardSectionsContainer.querySelectorAll('.sortable-item');
                    const orderedSections = [];
                    interfaceSettings.dashboardOrder.forEach(sectionName => {
                        Array.from(sections).forEach(section => {
                            if (section.getAttribute('data-section') === sectionName) {
                                orderedSections.push(section);
                            }
                        });
                    });
                    dashboardSectionsContainer.innerHTML = '';
                    orderedSections.forEach(section => {
                        dashboardSectionsContainer.appendChild(section);
                    });
                }
            }
            // Dashboard visibility
            const vis = interfaceSettings.dashboardVisibility || { totals: true, warranties: true, analytics: true };
            document.getElementById('toggleTotals').checked = !!vis.totals;
            document.getElementById('toggleWarranties').checked = !!vis.warranties;
            document.getElementById('toggleAnalytics').checked = !!vis.analytics;
            // Card visibility toggles
            if (typeof window.renderCardVisibilityToggles === 'function') {
                window.renderCardVisibilityToggles(settings);
            }
            localStorage.setItem('dumbAssetSettings', JSON.stringify(settings));
        } catch (err) {
            console.error('Error loading settings:', err);
            this.notificationForm.notifyAdd.checked = true;
            this.notificationForm.notifyDelete.checked = false;
            this.notificationForm.notifyEdit.checked = true;
            this.notificationForm.notify1Month.checked = true;
            this.notificationForm.notify2Week.checked = false;
            this.notificationForm.notify7Day.checked = true;
            this.notificationForm.notify3Day.checked = false;
        }
    }

    async _saveSettings() {
        this.setButtonLoading(this.saveSettings, true);
        const settings = {
            notificationSettings: {
                notifyAdd: this.notificationForm.notifyAdd.checked,
                notifyDelete: this.notificationForm.notifyDelete.checked,
                notifyEdit: this.notificationForm.notifyEdit.checked,
                notify1Month: this.notificationForm.notify1Month.checked,
                notify2Week: this.notificationForm.notify2Week.checked,
                notify7Day: this.notificationForm.notify7Day.checked,
                notify3Day: this.notificationForm.notify3Day.checked
            },
            interfaceSettings: {
                dashboardOrder: [],
                dashboardVisibility: {
                    totals: document.getElementById('toggleTotals').checked,
                    warranties: document.getElementById('toggleWarranties').checked,
                    analytics: document.getElementById('toggleAnalytics').checked
                },
                cardVisibility: {
                    assets: document.getElementById('toggleCardTotalAssets')?.checked !== false,
                    components: document.getElementById('toggleCardTotalComponents')?.checked !== false,
                    value: document.getElementById('toggleCardTotalValue')?.checked !== false,
                    warranties: document.getElementById('toggleCardWarrantiesTotal')?.checked !== false,
                    within60: document.getElementById('toggleCardWarrantiesWithin60')?.checked !== false,
                    within30: document.getElementById('toggleCardWarrantiesWithin30')?.checked !== false,
                    expired: document.getElementById('toggleCardWarrantiesExpired')?.checked !== false,
                    active: document.getElementById('toggleCardWarrantiesActive')?.checked !== false
                }
            }
        };
        const dashboardSections = document.querySelectorAll('#dashboardSections .sortable-item');
        dashboardSections.forEach(section => {
            settings.interfaceSettings.dashboardOrder.push(section.getAttribute('data-section'));
        });
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to save settings');
            localStorage.setItem('dumbAssetSettings', JSON.stringify(settings));
            this.closeSettingsModal();
            this.showToast('Settings saved');
            if (!this.selectedAssetId && typeof this.renderDashboard === 'function') {
                this.renderDashboard();
            }
        } catch (err) {
            alert('Failed to save settings.');
            console.error(err);
        } finally {
            this.setButtonLoading(this.saveSettings, false);
        }
    }

    async _testNotificationSettings() {
        if (this.DEBUG) {
            console.log('[DEBUG] Test notification settings button clicked');
        }
        this.setButtonLoading(this.testNotificationSettings, true);
        try {
            const enabledTypes = [];
            const f = this.notificationForm;
            if (f.notifyAdd.checked) enabledTypes.push('notifyAdd');
            if (f.notifyDelete.checked) enabledTypes.push('notifyDelete');
            if (f.notifyEdit.checked) enabledTypes.push('notifyEdit');
            if (f.notify1Month.checked) enabledTypes.push('notify1Month');
            if (f.notify2Week.checked) enabledTypes.push('notify2Week');
            if (f.notify7Day.checked) enabledTypes.push('notify7Day');
            if (f.notify3Day.checked) enabledTypes.push('notify3Day');
            if (enabledTypes.length === 0) enabledTypes.push('notifyAdd');
            const response = await fetch('/api/notification-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledTypes })
            });
            if (!response.ok) throw new Error('Failed to send test notifications');
            this.showToast('Test notifications sent successfully!');
        } catch (error) {
            console.error('Error sending test notifications:', error);
            this.showToast('Failed to send test notifications');
        } finally {
            this.setButtonLoading(this.testNotificationSettings, false);
        }
    }

    cleanupPlaceholders(container) {
        const oldPlaceholders = container.querySelectorAll('.sortable-placeholder');
        oldPlaceholders.forEach(el => el.parentNode.removeChild(el));
    }

    // Drag and drop for dashboard order
    initSortable() {
        const container = document.getElementById('dashboardSections');
        if (!container) return;
        let draggedItem = null;
        let placeholder = null;
        let initialX, initialY, startClientX, startClientY;
        let itemHeight, itemWidth;
        let isTouch = false;
        this.cleanupPlaceholders(container);
        // Remove all old event listeners by cloning each sortable-item
        const oldItems = Array.from(container.querySelectorAll('.sortable-item'));
        oldItems.forEach(item => {
            const clone = item.cloneNode(true);
            item.parentNode.replaceChild(clone, item);
        });
        // Now select the fresh clones
        const items = container.querySelectorAll('.sortable-item');
        const self = this;
        items.forEach(item => {
            // Desktop (mouse)
            item.addEventListener('mousedown', (e) => {
                const isInteractiveElement = e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select');
                if (e.target.closest('.sortable-handle') || (!isInteractiveElement)) {
                    e.preventDefault();
                    isTouch = false;
                    startDrag(item, e.clientX, e.clientY);
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                }
            });
            // Mobile (touch)
            item.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                const isInteractiveElement = e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select');
                if (e.target.closest('.sortable-handle') || (!isInteractiveElement)) {
                    e.preventDefault();
                    isTouch = true;
                    startDrag(item, touch.clientX, touch.clientY);
                    document.addEventListener('touchmove', onTouchMove, { passive: false });
                    document.addEventListener('touchend', onTouchEnd);
                }
            });
        });
        function startDrag(item, clientX, clientY) {
            self.cleanupPlaceholders(container);
            draggedItem = item;
            draggedItem.classList.add('dragging');
            const rect = draggedItem.getBoundingClientRect();
            itemHeight = rect.height;
            itemWidth = rect.width;
            placeholder = document.createElement('div');
            placeholder.classList.add('sortable-placeholder');
            placeholder.style.height = `${itemHeight}px`;
            placeholder.style.width = `${itemWidth}px`;
            const itemContent = draggedItem.textContent.trim();
            if (itemContent) {
                const ghostContent = document.createElement('span');
                ghostContent.textContent = itemContent;
                ghostContent.style.opacity = '0.5';
                ghostContent.style.padding = '10px 15px';
                ghostContent.style.display = 'flex';
                ghostContent.style.alignItems = 'center';
                placeholder.appendChild(ghostContent);
            }
            initialX = rect.left;
            initialY = rect.top;
            startClientX = clientX;
            startClientY = clientY;
            draggedItem.parentNode.insertBefore(placeholder, draggedItem);
            draggedItem.style.position = 'fixed';
            draggedItem.style.zIndex = '1000';
            draggedItem.style.width = `${itemWidth}px`;
            draggedItem.style.left = `${initialX}px`;
            draggedItem.style.top = `${initialY}px`;
        }
        function onMouseMove(e) {
            if (!draggedItem) return;
            e.preventDefault();
            moveDraggedItem(e.clientX, e.clientY);
        }
        function onTouchMove(e) {
            if (!draggedItem) return;
            e.preventDefault();
            const touch = e.touches[0];
            moveDraggedItem(touch.clientX, touch.clientY);
        }
        function moveDraggedItem(clientX, clientY) {
            const deltaX = clientX - startClientX;
            const deltaY = clientY - startClientY;
            draggedItem.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            const draggingRect = draggedItem.getBoundingClientRect();
            const draggingMiddleY = draggingRect.top + draggingRect.height / 2;
            const siblings = Array.from(container.querySelectorAll('.sortable-item:not(.dragging)'));
            if (siblings.length === 0) return;
            const firstItem = siblings[0];
            const lastItem = siblings[siblings.length - 1];
            const firstRect = firstItem.getBoundingClientRect();
            const lastRect = lastItem.getBoundingClientRect();
            siblings.forEach(item => item.classList.remove('shift-up', 'shift-down'));
            if (draggingMiddleY < firstRect.top + firstRect.height * 0.25) {
                firstItem.classList.add('shift-down');
                container.insertBefore(placeholder, firstItem);
                return;
            }
            if (draggingMiddleY > lastRect.bottom - lastRect.height * 0.25) {
                lastItem.classList.add('shift-up');
                container.insertBefore(placeholder, lastItem.nextElementSibling);
                return;
            }
            let closestItem = null;
            let closestDistance = Infinity;
            siblings.forEach(sibling => {
                const rect = sibling.getBoundingClientRect();
                const distance = Math.abs(rect.top + rect.height / 2 - draggingMiddleY);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestItem = sibling;
                }
            });
            if (closestItem) {
                const rect = closestItem.getBoundingClientRect();
                const threshold = rect.top + rect.height * 0.4;
                const isAfter = draggingMiddleY > threshold;
                siblings.forEach(item => {
                    item.classList.remove('shift-up', 'shift-down');
                });
                if (isAfter && placeholder.nextElementSibling !== closestItem) {
                    closestItem.classList.add('shift-down');
                    container.insertBefore(placeholder, closestItem.nextElementSibling);
                } else if (!isAfter && placeholder.previousElementSibling !== closestItem) {
                    closestItem.classList.add('shift-up');
                    container.insertBefore(placeholder, closestItem);
                }
            }
        }
        function onMouseUp() {
            if (draggedItem) finishDrag();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        function onTouchEnd() {
            if (draggedItem) finishDrag();
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        }
        function finishDrag() {
            container.querySelectorAll('.shift-up, .shift-down').forEach(item => {
                item.classList.remove('shift-up', 'shift-down');
            });
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(draggedItem, placeholder);
                placeholder.parentNode.removeChild(placeholder);
            }
            self.cleanupPlaceholders(container);
            draggedItem.classList.remove('dragging');
            draggedItem.style.position = '';
            draggedItem.style.top = '';
            draggedItem.style.left = '';
            draggedItem.style.width = '';
            draggedItem.style.transform = '';
            draggedItem.style.zIndex = '';
            draggedItem.animate([
                { transform: 'scale(1.03)', backgroundColor: 'rgba(37, 100, 235, 0.1)' },
                { transform: 'scale(1)', backgroundColor: 'var(--file-label-color)' }
            ], {
                duration: 300,
                easing: 'ease-out'
            });
            draggedItem = null;
            placeholder = null;
            const newOrder = [];
            document.querySelectorAll('#dashboardSections .sortable-item').forEach(item => {
                newOrder.push(item.getAttribute('data-section'));
            });
            try {
                const settings = JSON.parse(localStorage.getItem('dumbAssetSettings')) || {};
                if (!settings.interfaceSettings) settings.interfaceSettings = {};
                settings.interfaceSettings.dashboardOrder = newOrder;
                localStorage.setItem('dumbAssetSettings', JSON.stringify(settings));
            } catch (err) {
                console.error('Error updating local storage', err);
            }
        }
    }
}
