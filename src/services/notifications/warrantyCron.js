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

function startWarrantyCron() {
    cron.schedule('1 12 * * *', () => {
        const assets = readJsonFile(assetsFilePath);
        const now = DateTime.now();
        const settings = readJsonFile(notificationSettingsPath);
        const notificationSettings = settings.notificationSettings || {};
        const appriseUrl = process.env.APPRISE_URL;

        // Helper function to check and send warranty notifications
        function checkAndNotifyWarranty(asset, warranty, isSecondary = false) {
            if (!warranty || !warranty.expirationDate) return;
            const expDate = DateTime.fromISO(warranty.expirationDate, { zone: process.env.TZ || 'America/Chicago' });
            if (!expDate.isValid) return;
            const daysOut = Math.floor(expDate.diff(now, 'days').days);
            const warrantyType = isSecondary ? 'Secondary Warranty' : 'Warranty';

            if (notificationSettings.notify1Month && daysOut === 30) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: warranty.expirationDate,
                    days: 30,
                    warrantyType
                }, { appriseUrl });
                debugLog(`[DEBUG] ${warrantyType} 30-day notification sent for asset: ${asset.name}`);
            }
            if (notificationSettings.notify2Week && daysOut === 14) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: warranty.expirationDate,
                    days: 14,
                    warrantyType
                }, { appriseUrl });
                debugLog(`[DEBUG] ${warrantyType} 14-day notification sent for asset: ${asset.name}`);
            }
            if (notificationSettings.notify7Day && daysOut === 7) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: warranty.expirationDate,
                    days: 7,
                    warrantyType
                }, { appriseUrl });
                debugLog(`[DEBUG] ${warrantyType} 7-day notification sent for asset: ${asset.name}`);
            }
            if (notificationSettings.notify3Day && daysOut === 3) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: warranty.expirationDate,
                    days: 3,
                    warrantyType
                }, { appriseUrl });
                debugLog(`[DEBUG] ${warrantyType} 3-day notification sent for asset: ${asset.name}`);
            }
        }

        assets.forEach(asset => {
            // Check primary warranty
            checkAndNotifyWarranty(asset, asset.warranty);
            
            // Check secondary warranty
            checkAndNotifyWarranty(asset, asset.secondaryWarranty, true);
        });
    }, {
        timezone: process.env.TZ || 'America/Chicago'
    });
}

// Maintenance Schedule notification logic
async function checkMaintenanceSchedules() {
    const settings = getSettings();
    if (!settings.notifyMaintenance) return;
    const assets = getAssets();
    const now = new Date();
    const appriseUrl = process.env.APPRISE_URL;
    for (const asset of assets) {
        if (asset.maintenanceSchedule) {
            let shouldNotify = false;
            let desc = '';
            if (asset.maintenanceSchedule.unit === 'custom' && asset.maintenanceSchedule.custom) {
                shouldNotify = true;
                desc = asset.maintenanceSchedule.custom;
            } else if (asset.maintenanceSchedule.frequency && asset.maintenanceSchedule.unit) {
                shouldNotify = true;
                desc = `Every ${asset.maintenanceSchedule.frequency} ${asset.maintenanceSchedule.unit}`;
            }
            if (shouldNotify) {
                sendNotification('maintenance_schedule', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    schedule: desc,
                    type: 'Asset'
                }, { appriseUrl });
                debugLog(`[DEBUG] Maintenance schedule notification sent for asset: ${asset.name}`);
            }
        }
        if (asset.subAssets) {
            for (const sub of asset.subAssets) {
                if (sub.maintenanceSchedule) {
                    let shouldNotify = false;
                    let desc = '';
                    if (sub.maintenanceSchedule.unit === 'custom' && sub.maintenanceSchedule.custom) {
                        shouldNotify = true;
                        desc = sub.maintenanceSchedule.custom;
                    } else if (sub.maintenanceSchedule.frequency && sub.maintenanceSchedule.unit) {
                        shouldNotify = true;
                        desc = `Every ${sub.maintenanceSchedule.frequency} ${sub.maintenanceSchedule.unit}`;
                    }
                    if (shouldNotify) {
                        sendNotification('maintenance_schedule', {
                            name: sub.name,
                            modelNumber: sub.modelNumber,
                            schedule: desc,
                            type: 'Sub-Asset',
                            parentAsset: asset.name
                        }, { appriseUrl });
                        debugLog(`[DEBUG] Maintenance schedule notification sent for sub-asset: ${sub.name}`);
                    }
                }
            }
        }
    }
}

module.exports = { startWarrantyCron, checkMaintenanceSchedules };