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

const assetsFilePath = path.join(__dirname, '../../../data/assets.json');
const notificationSettingsPath = path.join(__dirname, '../../../data/config.json');

function readJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return [];
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

        // Collect all notifications to send
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
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 30,
                        warrantyType
                    },
                    config: { appriseUrl }
                });
                debugLog(`[DEBUG] ${warrantyType} 30-day notification queued for asset: ${asset.name}`);
            }
            if (notificationSettings.notify2Week && daysOut === 14) {
                notificationsToSend.push({
                    type: 'warranty_expiring',
                    data: {
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 14,
                        warrantyType
                    },
                    config: { appriseUrl }
                });
                debugLog(`[DEBUG] ${warrantyType} 14-day notification queued for asset: ${asset.name}`);
            }
            if (notificationSettings.notify7Day && daysOut === 7) {
                notificationsToSend.push({
                    type: 'warranty_expiring',
                    data: {
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 7,
                        warrantyType
                    },
                    config: { appriseUrl }
                });
                debugLog(`[DEBUG] ${warrantyType} 7-day notification queued for asset: ${asset.name}`);
            }
            if (notificationSettings.notify3Day && daysOut === 3) {
                notificationsToSend.push({
                    type: 'warranty_expiring',
                    data: {
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        expirationDate: warranty.expirationDate,
                        days: 3,
                        warrantyType
                    },
                    config: { appriseUrl }
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
    const now = new Date();
    const appriseUrl = process.env.APPRISE_URL;

    // Collect all maintenance notifications to send
    const notificationsToSend = [];

    for (const asset of assets) {
        if (asset.maintenanceEvents && asset.maintenanceEvents.length > 0) {
            for (const event of asset.maintenanceEvents) {
                let shouldNotify = false;
                let desc = '';

                if (event.type === 'frequency' && event.frequency && event.frequencyUnit) {
                    shouldNotify = true;
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
                            name: asset.name,
                            modelNumber: asset.modelNumber,
                            eventName: event.name,
                            schedule: desc,
                            notes: event.notes,
                            type: 'Asset'
                        },
                        config: { appriseUrl }
                    });
                    debugLog(`[DEBUG] Maintenance event notification queued for asset: ${asset.name}, event: ${event.name}`);
                }
            }
        }

        if (asset.subAssets) {
            for (const sub of asset.subAssets) {
                if (sub.maintenanceEvents && sub.maintenanceEvents.length > 0) {
                    for (const event of sub.maintenanceEvents) {
                        let shouldNotify = false;
                        let desc = '';

                        if (event.type === 'frequency' && event.frequency && event.frequencyUnit) {
                            shouldNotify = true;
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
                                    name: sub.name,
                                    modelNumber: sub.modelNumber,
                                    eventName: event.name,
                                    schedule: desc,
                                    notes: event.notes,
                                    type: 'Sub-Asset',
                                    parentAsset: asset.name
                                },
                                config: { appriseUrl }
                            });
                            debugLog(`[DEBUG] Maintenance event notification queued for sub-asset: ${sub.name}, event: ${event.name}`);
                        }
                    }
                }
            }
        }
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