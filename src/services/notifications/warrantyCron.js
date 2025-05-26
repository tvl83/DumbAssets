/**
 * Warranty Expiration Notification Cron
 * Schedules and sends warranty expiration notifications at noon in the configured timezone.
 * Exports a function to start the cron job.
 */

const cron = require('node-cron');
const { DateTime } = require('luxon');
const path = require('path');
const fs = require('fs');
const sendNotification = require('./appriseNotifier').sendNotification;

// Helper: debugLog fallback
const debugLog = (typeof global.debugLog === 'function') ? global.debugLog : (...args) => {
    if (process.env.DEBUG && String(process.env.DEBUG).toLowerCase() === 'true') {
        console.log(...args);
    }
};

// File paths
const assetsFilePath = path.join(__dirname, '..', '..', '..', 'data', 'Assets.json');
const subAssetsFilePath = path.join(__dirname, '..', '..', '..', 'data', 'SubAssets.json');
const notificationSettingsPath = path.join(__dirname, '..', '..', '..', 'data', 'notificationSettings.json');
const maintenanceTrackingPath = path.join(__dirname, '..', '..', '..', 'data', 'maintenanceTracking.json');

function readJsonFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Error reading JSON file ${filePath}:`, error);
    }
    return [];
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing JSON file ${filePath}:`, error);
        return false;
    }
}

async function startWarrantyCron() {
    // Warranty expiration checks at 12:01 PM daily
    cron.schedule('1 12 * * *', () => {
        const assets = readJsonFile(assetsFilePath);
        const now = DateTime.now();
        const settings = readJsonFile(notificationSettingsPath);
        const notificationSettings = settings.notificationSettings || {};
        const appriseUrl = process.env.APPRISE_URL;

        // Collect all warranty notifications to send
        const notificationsToSend = [];

        // Helper function to check and queue warranty notifications
        function checkAndQueueWarranty(asset, warranty, isSecondary = false) {
            if (!warranty || !warranty.expirationDate) return;
            const expDate = DateTime.fromISO(warranty.expirationDate, { zone: process.env.TZ || 'America/Chicago' });
            if (!expDate.isValid) return;
            const daysOut = Math.floor(expDate.diff(now, 'days').days);
            const warrantyType = isSecondary ? 'Secondary Warranty' : 'Warranty';

            if (notificationSettings.notify1Month && daysOut === 30) {
                notificationsToSend.push({
                    type: 'warranty_expiring',
                    data: {
                        id: asset.id,
                        parentId: asset.parentId, // For sub-assets
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 30,
                        warrantyType
                    },
                    config: { 
                        appriseUrl,
                        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                    }
                });
                debugLog(`[DEBUG] ${warrantyType} 30-day notification queued for asset: ${asset.name}`);
            }
            if (notificationSettings.notify2Week && daysOut === 14) {
                notificationsToSend.push({
                    type: 'warranty_expiring',
                    data: {
                        id: asset.id,
                        parentId: asset.parentId, // For sub-assets
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 14,
                        warrantyType
                    },
                    config: { 
                        appriseUrl,
                        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                    }
                });
                debugLog(`[DEBUG] ${warrantyType} 14-day notification queued for asset: ${asset.name}`);
            }
            if (notificationSettings.notify7Day && daysOut === 7) {
                notificationsToSend.push({
                    type: 'warranty_expiring',
                    data: {
                        id: asset.id,
                        parentId: asset.parentId, // For sub-assets
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 7,
                        warrantyType
                    },
                    config: { 
                        appriseUrl,
                        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                    }
                });
                debugLog(`[DEBUG] ${warrantyType} 7-day notification queued for asset: ${asset.name}`);
            }
            if (notificationSettings.notify3Day && daysOut === 3) {
                notificationsToSend.push({
                    type: 'warranty_expiring',
                    data: {
                        id: asset.id,
                        parentId: asset.parentId, // For sub-assets
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 3,
                        warrantyType
                    },
                    config: { 
                        appriseUrl,
                        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                    }
                });
                debugLog(`[DEBUG] ${warrantyType} 3-day notification queued for asset: ${asset.name}`);
            }
        }

        assets.forEach(asset => {
            // Check primary warranty
            checkAndQueueWarranty(asset, asset.warranty);
            
            // Check secondary warranty
            checkAndQueueWarranty(asset, asset.secondaryWarranty, true);
        });

        // Also check sub-assets for warranty notifications
        const subAssets = readJsonFile(subAssetsFilePath);
        subAssets.forEach(subAsset => {
            // Check primary warranty
            checkAndQueueWarranty(subAsset, subAsset.warranty);
            
            // Check secondary warranty
            checkAndQueueWarranty(subAsset, subAsset.secondaryWarranty, true);
        });

        // Send all queued notifications (they will be processed with 5-second delays)
        notificationsToSend.forEach(notification => {
            sendNotification(notification.type, notification.data, notification.config);
        });

        if (notificationsToSend.length > 0) {
            debugLog(`[DEBUG] ${notificationsToSend.length} warranty notifications queued for processing`);
        }
    }, {
        timezone: process.env.TZ || 'America/Chicago'
    });

    // Maintenance schedule checks at 12:02 PM daily (1 minute after warranty checks)
    cron.schedule('2 12 * * *', () => {
        checkMaintenanceSchedules();
    }, {
        timezone: process.env.TZ || 'America/Chicago'
    });
}

// Maintenance Schedule notification logic
async function checkMaintenanceSchedules() {
    const settings = readJsonFile(notificationSettingsPath);
    const notificationSettings = settings.notificationSettings || {};
    if (!notificationSettings.notifyMaintenance) return;
    
    const assets = readJsonFile(assetsFilePath);
    const subAssets = readJsonFile(subAssetsFilePath); // Load sub-assets separately
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const appriseUrl = process.env.APPRISE_URL;

    // Load and update maintenance tracking
    let maintenanceTracking = readJsonFile(maintenanceTrackingPath);
    if (!Array.isArray(maintenanceTracking)) {
        maintenanceTracking = [];
    }

    // Collect all maintenance notifications to send
    const notificationsToSend = [];

    // Helper function to check if we should send a frequency-based notification
    function shouldSendFrequencyNotification(assetId, eventName, frequency, frequencyUnit, nextDueDate) {
        // If no nextDueDate is provided, we can't schedule notifications
        if (!nextDueDate) {
            debugLog(`[DEBUG] No nextDueDate specified for maintenance event: ${eventName} on asset: ${assetId}`);
            return false;
        }

        const trackingKey = `${assetId}_${eventName}`;
        let tracking = maintenanceTracking.find(t => t.key === trackingKey);
        
        // Parse the next due date
        const dueDate = new Date(nextDueDate);
        if (isNaN(dueDate)) {
            debugLog(`[DEBUG] Invalid nextDueDate for maintenance event: ${eventName} on asset: ${assetId}`);
            return false;
        }

        const dueDateStr = dueDate.toISOString().split('T')[0];
        
        // Check if today is the due date
        if (today === dueDateStr) {
            // Create or update tracking record
            if (!tracking) {
                tracking = {
                    key: trackingKey,
                    lastNotified: today,
                    frequency: frequency,
                    frequencyUnit: frequencyUnit,
                    nextDueDate: nextDueDate
                };
                maintenanceTracking.push(tracking);
            } else {
                tracking.lastNotified = today;
            }

            // Calculate next due date based on frequency
            const nextDate = new Date(dueDate);
            switch (frequencyUnit) {
                case 'days':
                    nextDate.setDate(dueDate.getDate() + parseInt(frequency));
                    break;
                case 'weeks':
                    nextDate.setDate(dueDate.getDate() + (parseInt(frequency) * 7));
                    break;
                case 'months':
                    nextDate.setMonth(dueDate.getMonth() + parseInt(frequency));
                    break;
                case 'years':
                    nextDate.setFullYear(dueDate.getFullYear() + parseInt(frequency));
                    break;
            }
            
            // Update the tracking with the calculated next due date
            tracking.nextDueDate = nextDate.toISOString().split('T')[0];
            
            debugLog(`[DEBUG] Maintenance notification sent for ${eventName}. Next due: ${tracking.nextDueDate}`);
            return true;
        }
        
        return false;
    }

    // Check assets for maintenance events
    for (const asset of assets) {
        if (asset.maintenanceEvents && asset.maintenanceEvents.length > 0) {
            for (const event of asset.maintenanceEvents) {
                let shouldNotify = false;
                let desc = '';

                if (event.type === 'frequency' && event.frequency && event.frequencyUnit) {
                    shouldNotify = shouldSendFrequencyNotification(asset.id, event.name, event.frequency, event.frequencyUnit, event.nextDueDate);
                    desc = `Every ${event.frequency} ${event.frequencyUnit}`;
                } else if (event.type === 'specific' && event.specificDate) {
                    const eventDate = new Date(event.specificDate);
                    const daysUntilEvent = Math.floor((eventDate - now) / (1000 * 60 * 60 * 24));
                    
                    // Notify 7 days before specific date
                    if (daysUntilEvent === 7) {
                        shouldNotify = true;
                        desc = `Due on ${event.specificDate}`;
                    }
                }

                if (shouldNotify) {
                    notificationsToSend.push({
                        type: 'maintenance_schedule',
                        data: {
                            id: asset.id,
                            name: asset.name,
                            modelNumber: asset.modelNumber,
                            eventName: event.name,
                            schedule: desc,
                            notes: event.notes,
                            type: 'Asset'
                        },
                        config: { 
                            appriseUrl,
                            baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                        }
                    });
                    debugLog(`[DEBUG] Maintenance event notification queued for asset: ${asset.name}, event: ${event.name}`);
                }
            }
        }
    }

    // Check sub-assets for maintenance events
    for (const subAsset of subAssets) {
        if (subAsset.maintenanceEvents && subAsset.maintenanceEvents.length > 0) {
            // Find parent asset for context
            const parentAsset = assets.find(a => a.id === subAsset.parentId);
            const parentName = parentAsset ? parentAsset.name : 'Unknown Parent';
            
            for (const event of subAsset.maintenanceEvents) {
                let shouldNotify = false;
                let desc = '';

                if (event.type === 'frequency' && event.frequency && event.frequencyUnit) {
                    shouldNotify = shouldSendFrequencyNotification(subAsset.id, event.name, event.frequency, event.frequencyUnit, event.nextDueDate);
                    desc = `Every ${event.frequency} ${event.frequencyUnit}`;
                } else if (event.type === 'specific' && event.specificDate) {
                    const eventDate = new Date(event.specificDate);
                    const daysUntilEvent = Math.floor((eventDate - now) / (1000 * 60 * 60 * 24));
                    
                    // Notify 7 days before specific date
                    if (daysUntilEvent === 7) {
                        shouldNotify = true;
                        desc = `Due on ${event.specificDate}`;
                    }
                }

                if (shouldNotify) {
                    notificationsToSend.push({
                        type: 'maintenance_schedule',
                        data: {
                            id: subAsset.id,
                            parentId: subAsset.parentId,
                            name: subAsset.name,
                            modelNumber: subAsset.modelNumber,
                            eventName: event.name,
                            schedule: desc,
                            notes: event.notes,
                            type: 'Component',
                            parentAsset: parentName
                        },
                        config: { 
                            appriseUrl,
                            baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                        }
                    });
                    debugLog(`[DEBUG] Maintenance event notification queued for sub-asset: ${subAsset.name}, event: ${event.name}`);
                }
            }
        }
    }

    // Save updated maintenance tracking
    writeJsonFile(maintenanceTrackingPath, maintenanceTracking);

    // Update nextDueDate in asset maintenance events based on tracking updates
    let assetsUpdated = false;
    let subAssetsUpdated = false;

    // Update assets
    assets.forEach(asset => {
        if (asset.maintenanceEvents && asset.maintenanceEvents.length > 0) {
            asset.maintenanceEvents.forEach(event => {
                if (event.type === 'frequency') {
                    const trackingKey = `${asset.id}_${event.name}`;
                    const tracking = maintenanceTracking.find(t => t.key === trackingKey);
                    if (tracking && tracking.nextDueDate !== event.nextDueDate) {
                        event.nextDueDate = tracking.nextDueDate;
                        assetsUpdated = true;
                        debugLog(`[DEBUG] Updated nextDueDate for asset ${asset.name}, event ${event.name}: ${event.nextDueDate}`);
                    }
                }
            });
        }
    });

    // Update sub-assets
    subAssets.forEach(subAsset => {
        if (subAsset.maintenanceEvents && subAsset.maintenanceEvents.length > 0) {
            subAsset.maintenanceEvents.forEach(event => {
                if (event.type === 'frequency') {
                    const trackingKey = `${subAsset.id}_${event.name}`;
                    const tracking = maintenanceTracking.find(t => t.key === trackingKey);
                    if (tracking && tracking.nextDueDate !== event.nextDueDate) {
                        event.nextDueDate = tracking.nextDueDate;
                        subAssetsUpdated = true;
                        debugLog(`[DEBUG] Updated nextDueDate for sub-asset ${subAsset.name}, event ${event.name}: ${event.nextDueDate}`);
                    }
                }
            });
        }
    });

    // Save updated assets and sub-assets if any nextDueDate was updated
    if (assetsUpdated) {
        writeJsonFile(assetsFilePath, assets);
        debugLog(`[DEBUG] Assets file updated with new nextDueDate values`);
    }

    if (subAssetsUpdated) {
        writeJsonFile(subAssetsFilePath, subAssets);
        debugLog(`[DEBUG] SubAssets file updated with new nextDueDate values`);
    }

    // Send all queued maintenance notifications (they will be processed with 5-second delays)
    notificationsToSend.forEach(notification => {
        sendNotification(notification.type, notification.data, notification.config);
    });

    if (notificationsToSend.length > 0) {
        debugLog(`[DEBUG] ${notificationsToSend.length} maintenance notifications queued for processing`);
    }
}

module.exports = { startWarrantyCron, checkMaintenanceSchedules };