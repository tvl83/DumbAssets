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

// Get the configured timezone
const TIMEZONE = process.env.TZ || 'America/Chicago';

/**
 * Robust date parsing function that handles multiple formats
 * @param {string|Date} dateValue - The date value to parse
 * @returns {DateTime|null} - Luxon DateTime object or null if invalid
 */
function parseDate(dateValue) {
    if (!dateValue) return null;
    
    try {
        // If it's already a DateTime object, return it
        if (dateValue instanceof DateTime) {
            return dateValue.isValid ? dateValue : null;
        }
        
        // If it's a Date object, convert to DateTime
        if (dateValue instanceof Date) {
            return DateTime.fromJSDate(dateValue, { zone: TIMEZONE });
        }
        
        // If it's a string, try multiple parsing methods
        if (typeof dateValue === 'string') {
            // Try ISO format first (YYYY-MM-DD)
            if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return DateTime.fromISO(dateValue, { zone: TIMEZONE });
            }
            
            // Try MM/DD/YYYY format
            if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                const [month, day, year] = dateValue.split('/').map(Number);
                return DateTime.fromObject({ year, month, day }, { zone: TIMEZONE });
            }
            
            // Try other ISO formats
            const isoDate = DateTime.fromISO(dateValue, { zone: TIMEZONE });
            if (isoDate.isValid) return isoDate;
            
            // Try parsing as JS Date, then convert
            const jsDate = new Date(dateValue);
            if (!isNaN(jsDate.getTime())) {
                return DateTime.fromJSDate(jsDate, { zone: TIMEZONE });
            }
        }
        
        // If it's a number, treat as timestamp
        if (typeof dateValue === 'number' && !isNaN(dateValue)) {
            return DateTime.fromMillis(dateValue, { zone: TIMEZONE });
        }
        
        debugLog(`[WARNING] Could not parse date: ${dateValue}`);
        return null;
    } catch (error) {
        debugLog(`[ERROR] Date parsing failed for "${dateValue}":`, error.message);
        return null;
    }
}

/**
 * Safely add time periods to a date with proper month/year handling
 * @param {DateTime} baseDate - The base date to add to
 * @param {number} amount - The amount to add
 * @param {string} unit - The unit (days, weeks, months, years)
 * @returns {DateTime|null} - The calculated date or null if invalid
 */
function addTimePeriod(baseDate, amount, unit) {
    if (!baseDate || !baseDate.isValid) return null;
    
    try {
        const numericAmount = parseInt(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            debugLog(`[WARNING] Invalid amount for date calculation: ${amount}`);
            return null;
        }
        
        let result;
        switch (unit.toLowerCase()) {
            case 'days':
            case 'day':
                result = baseDate.plus({ days: numericAmount });
                break;
            case 'weeks':
            case 'week':
                result = baseDate.plus({ weeks: numericAmount });
                break;
            case 'months':
            case 'month':
                result = baseDate.plus({ months: numericAmount });
                break;
            case 'years':
            case 'year':
                result = baseDate.plus({ years: numericAmount });
                break;
            default:
                debugLog(`[WARNING] Invalid frequency unit: ${unit}`);
                return null;
        }
        
        if (!result.isValid) {
            debugLog(`[ERROR] Date calculation resulted in invalid date: ${baseDate.toISO()} + ${amount} ${unit}`);
            return null;
        }
        
        return result;
    } catch (error) {
        debugLog(`[ERROR] Date calculation failed:`, error.message);
        return null;
    }
}

/**
 * Get today's date in the configured timezone as YYYY-MM-DD string
 * @returns {string} - Today's date in YYYY-MM-DD format
 */
function getTodayString() {
    return DateTime.now().setZone(TIMEZONE).toISODate();
}

/**
 * Convert a DateTime to YYYY-MM-DD string in the configured timezone
 * @param {DateTime} dateTime - The DateTime to convert
 * @returns {string|null} - Date string or null if invalid
 */
function toDateString(dateTime) {
    if (!dateTime || !dateTime.isValid) return null;
    return dateTime.setZone(TIMEZONE).toISODate();
}

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
    cron.schedule('1 12 * * *', async () => {
        const assets = readJsonFile(assetsFilePath);
        const subAssets = readJsonFile(subAssetsFilePath);
        const now = DateTime.now().setZone(TIMEZONE);
        const today = getTodayString();
        const settings = readJsonFile(notificationSettingsPath);
        const notificationSettings = settings.notificationSettings || {};
        const appriseUrl = process.env.APPRISE_URL;

        debugLog(`[DEBUG] Starting warranty check for ${today} in timezone ${TIMEZONE}`);

        // Collect all warranty notifications to send
        const notificationsToSend = [];

        // Helper function to check and queue warranty notifications
        function checkAndQueueWarranty(asset, warranty, isSecondary = false, isSubAsset = false) {
            if (!warranty || !warranty.expirationDate) return;
            
            try {
                const expDate = parseDate(warranty.expirationDate);
                if (!expDate) {
                    debugLog(`[WARNING] Invalid warranty expiration date for ${isSubAsset ? 'component' : 'asset'}: ${asset.name} - date: ${warranty.expirationDate}`);
                    return;
                }
                
                const daysOut = Math.floor(expDate.diff(now, 'days').days);
                const warrantyType = isSecondary ? 'Secondary Warranty' : 'Warranty';
                const assetType = isSubAsset ? 'Component' : 'Asset';

                debugLog(`[DEBUG] Checking ${warrantyType.toLowerCase()} for ${assetType.toLowerCase()}: ${asset.name} - Expires: ${toDateString(expDate)}, Days remaining: ${daysOut}`);

                // Check each notification threshold
                const thresholds = [
                    { setting: 'notify1Month', days: 30 },
                    { setting: 'notify2Week', days: 14 },
                    { setting: 'notify7Day', days: 7 },
                    { setting: 'notify3Day', days: 3 }
                ];

                thresholds.forEach(threshold => {
                    if (notificationSettings[threshold.setting] && daysOut === threshold.days) {
                        notificationsToSend.push({
                            type: 'warranty_expiring',
                            data: {
                                id: asset.id,
                                parentId: asset.parentId, // For sub-assets
                                name: asset.name,
                                modelNumber: asset.modelNumber,
                                expirationDate: warranty.expirationDate,
                                days: threshold.days,
                                warrantyType,
                                assetType
                            },
                            config: { 
                                appriseUrl,
                                baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                            }
                        });
                        debugLog(`[DEBUG] ${warrantyType} ${threshold.days}-day notification queued for ${assetType.toLowerCase()}: ${asset.name}`);
                    }
                });

                // Safety check for expired warranties (1-7 days past expiration)
                if (daysOut >= -7 && daysOut < 0) {
                    debugLog(`[WARNING] ${warrantyType} expired ${Math.abs(daysOut)} days ago for ${assetType.toLowerCase()}: ${asset.name}`);
                }
            } catch (error) {
                debugLog(`[ERROR] Error processing ${warrantyType.toLowerCase()} for ${isSubAsset ? 'component' : 'asset'} "${asset.name}":`, error.message);
            }
        }

        // Check assets for warranty notifications
        debugLog(`[DEBUG] Checking ${assets.length} assets for warranty notifications`);
        assets.forEach(asset => {
            try {
                // Check primary warranty
                checkAndQueueWarranty(asset, asset.warranty, false, false);
                
                // Check secondary warranty
                checkAndQueueWarranty(asset, asset.secondaryWarranty, true, false);
            } catch (error) {
                debugLog(`[ERROR] Error processing asset "${asset.name}":`, error.message);
                // Continue with other assets
            }
        });

        // Check sub-assets for warranty notifications
        debugLog(`[DEBUG] Checking ${subAssets.length} sub-assets for warranty notifications`);
        subAssets.forEach(subAsset => {
            try {
                // Check primary warranty
                checkAndQueueWarranty(subAsset, subAsset.warranty, false, true);
                
                // Check secondary warranty
                checkAndQueueWarranty(subAsset, subAsset.secondaryWarranty, true, true);
            } catch (error) {
                debugLog(`[ERROR] Error processing sub-asset "${subAsset.name}":`, error.message);
                // Continue with other sub-assets
            }
        });

        // Send all queued warranty notifications with error handling
        let successfulNotifications = 0;
        let failedNotifications = 0;

        for (const notification of notificationsToSend) {
            try {
                await sendNotification(notification.type, notification.data, notification.config);
                successfulNotifications++;
            } catch (error) {
                debugLog(`[ERROR] Failed to send warranty notification for ${notification.data.assetType} "${notification.data.name}", ${notification.data.warrantyType}:`, error.message);
                failedNotifications++;
            }
        }

        // Calculate summary statistics
        const totalChecked = assets.length + subAssets.length;
        const totalWarranties = assets.reduce((sum, a) => {
            let count = 0;
            if (a.warranty && a.warranty.expirationDate) count++;
            if (a.secondaryWarranty && a.secondaryWarranty.expirationDate) count++;
            return sum + count;
        }, 0) + subAssets.reduce((sum, a) => {
            let count = 0;
            if (a.warranty && a.warranty.expirationDate) count++;
            if (a.secondaryWarranty && a.secondaryWarranty.expirationDate) count++;
            return sum + count;
        }, 0);

        // Log comprehensive summary
        debugLog(`[SUMMARY] Warranty check completed for ${today}:`);
        debugLog(`  - Assets checked: ${totalChecked} (${assets.length} main assets, ${subAssets.length} components)`);
        debugLog(`  - Total warranties: ${totalWarranties}`);
        debugLog(`  - Notifications queued: ${notificationsToSend.length}`);
        debugLog(`  - Notifications sent successfully: ${successfulNotifications}`);
        debugLog(`  - Notifications failed: ${failedNotifications}`);
        debugLog(`  - Notification settings: 1M=${notificationSettings.notify1Month}, 2W=${notificationSettings.notify2Week}, 7D=${notificationSettings.notify7Day}, 3D=${notificationSettings.notify3Day}`);

        if (notificationsToSend.length > 0) {
            console.log(`Warranty check completed: ${successfulNotifications}/${notificationsToSend.length} notifications sent successfully`);
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
    const subAssets = readJsonFile(subAssetsFilePath);
    const now = DateTime.now().setZone(TIMEZONE);
    const today = getTodayString();
    const appriseUrl = process.env.APPRISE_URL;

    debugLog(`[DEBUG] Starting maintenance check for ${today} in timezone ${TIMEZONE}`);

    // Load and update maintenance tracking
    let maintenanceTracking = readJsonFile(maintenanceTrackingPath);
    if (!Array.isArray(maintenanceTracking)) {
        maintenanceTracking = [];
    }

    // Clean up old and invalid tracking records
    const originalTrackingCount = maintenanceTracking.length;
    maintenanceTracking = cleanupMaintenanceTracking(maintenanceTracking);
    if (maintenanceTracking.length !== originalTrackingCount) {
        debugLog(`[DEBUG] Cleaned up ${originalTrackingCount - maintenanceTracking.length} old/invalid tracking records`);
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

        // Validate frequency and frequencyUnit
        const numericFrequency = parseInt(frequency);
        if (isNaN(numericFrequency) || numericFrequency <= 0) {
            debugLog(`[ERROR] Invalid frequency for maintenance event: ${eventName} on asset: ${assetId} - frequency: ${frequency}`);
            return false;
        }

        const validUnits = ['days', 'day', 'weeks', 'week', 'months', 'month', 'years', 'year'];
        if (!validUnits.includes(frequencyUnit.toLowerCase())) {
            debugLog(`[ERROR] Invalid frequency unit for maintenance event: ${eventName} on asset: ${assetId} - unit: ${frequencyUnit}`);
            return false;
        }

        const trackingKey = `${assetId}_${eventName}`;
        let tracking = maintenanceTracking.find(t => t.key === trackingKey);
        
        // Parse the next due date using robust parsing
        const dueDate = parseDate(nextDueDate);
        if (!dueDate) {
            debugLog(`[ERROR] Invalid nextDueDate for maintenance event: ${eventName} on asset: ${assetId} - date: ${nextDueDate}`);
            return false;
        }

        const dueDateStr = toDateString(dueDate);
        const today = getTodayString();
        
        debugLog(`[DEBUG] Checking maintenance: ${eventName} on asset ${assetId} - Due: ${dueDateStr}, Today: ${today}`);
        
        // Check if today is the due date OR if we're past due (safety net)
        if (today === dueDateStr || dueDate.diffNow('days').days <= 0) {
            // Check if we already notified today to prevent duplicates
            if (tracking && tracking.lastNotified === today) {
                debugLog(`[DEBUG] Already notified today for maintenance event: ${eventName} on asset: ${assetId}`);
                return false;
            }

            // Create or update tracking record
            if (!tracking) {
                tracking = {
                    key: trackingKey,
                    lastNotified: today,
                    frequency: numericFrequency,
                    frequencyUnit: frequencyUnit.toLowerCase(),
                    nextDueDate: dueDateStr,
                    originalDueDate: dueDateStr
                };
                maintenanceTracking.push(tracking);
                debugLog(`[DEBUG] Created new tracking record for: ${trackingKey}`);
            } else {
                tracking.lastNotified = today;
                debugLog(`[DEBUG] Updated tracking record for: ${trackingKey}`);
            }

            // Calculate next due date using robust date arithmetic
            const nextDate = addTimePeriod(dueDate, numericFrequency, frequencyUnit);
            if (!nextDate) {
                debugLog(`[ERROR] Could not calculate next due date for maintenance event: ${eventName} on asset: ${assetId}`);
                return false;
            }
            
            // Update the tracking with the calculated next due date
            const nextDueDateStr = toDateString(nextDate);
            tracking.nextDueDate = nextDueDateStr;
            
            debugLog(`[DEBUG] Maintenance notification triggered for ${eventName} on asset ${assetId}. Next due: ${nextDueDateStr}`);
            return true;
        }
        
        // Add safety check for overdue maintenance (more than 7 days past due)
        const daysPastDue = -dueDate.diffNow('days').days;
        if (daysPastDue > 7) {
            debugLog(`[WARNING] Maintenance event is ${daysPastDue} days overdue: ${eventName} on asset: ${assetId}`);
            // Could optionally send an overdue notification here
        }
        
        return false;
    }

    // Helper function to safely process maintenance events
    function processMaintenanceEvents(asset, isSubAsset = false) {
        if (!asset.maintenanceEvents || !Array.isArray(asset.maintenanceEvents)) {
            return; // No maintenance events to process
        }

        const assetType = isSubAsset ? 'Component' : 'Asset';
        debugLog(`[DEBUG] Processing ${asset.maintenanceEvents.length} maintenance events for ${assetType}: ${asset.name} (ID: ${asset.id})`);

        for (const event of asset.maintenanceEvents) {
            try {
                // Validate the maintenance event
                if (!validateMaintenanceEvent(event, asset.id)) {
                    continue; // Skip invalid events
                }

                let shouldNotify = false;
                let desc = '';

                if (event.type === 'frequency' && event.frequency && event.frequencyUnit) {
                    shouldNotify = shouldSendFrequencyNotification(asset.id, event.name, event.frequency, event.frequencyUnit, event.nextDueDate);
                    desc = `Every ${event.frequency} ${event.frequencyUnit}`;
                } else if (event.type === 'specific' && event.specificDate) {
                    // Parse the specific date using robust parsing
                    const eventDate = parseDate(event.specificDate);
                    if (!eventDate) {
                        debugLog(`[ERROR] Invalid specificDate for maintenance event: ${event.name} on asset: ${asset.id} - date: ${event.specificDate}`);
                        continue; // Skip this invalid event
                    }
                    
                    const eventDateStr = toDateString(eventDate);
                    const daysUntilEvent = Math.floor(eventDate.diff(now, 'days').days);
                    
                    debugLog(`[DEBUG] Checking specific date maintenance: ${event.name} on asset ${asset.id} - Event date: ${eventDateStr}, Days until: ${daysUntilEvent}`);
                    
                    // Create tracking key to prevent duplicate notifications
                    const trackingKey = `${asset.id}_${event.name}_specific_${eventDateStr}`;
                    const existingTracking = maintenanceTracking.find(t => t.key === trackingKey);
                    
                    // Notify 7 days before specific date (and only once)
                    if (daysUntilEvent === 7 && !existingTracking) {
                        shouldNotify = true;
                        desc = `Due on ${eventDateStr}`;
                        
                        // Add tracking to prevent duplicate notifications
                        maintenanceTracking.push({
                            key: trackingKey,
                            lastNotified: today,
                            eventDate: eventDateStr,
                            notificationType: '7day_advance'
                        });
                        
                        debugLog(`[DEBUG] 7-day advance notification triggered for specific date maintenance: ${event.name} on asset ${asset.id}`);
                    }
                    // Also notify on the actual due date
                    else if (daysUntilEvent === 0) {
                        const dueDateTrackingKey = `${asset.id}_${event.name}_specific_due_${eventDateStr}`;
                        const dueDateTracking = maintenanceTracking.find(t => t.key === dueDateTrackingKey);
                        
                        if (!dueDateTracking) {
                            shouldNotify = true;
                            desc = `Due TODAY (${eventDateStr})`;
                            
                            // Add tracking for due date notification
                            maintenanceTracking.push({
                                key: dueDateTrackingKey,
                                lastNotified: today,
                                eventDate: eventDateStr,
                                notificationType: 'due_date'
                            });
                            
                            debugLog(`[DEBUG] Due date notification triggered for specific date maintenance: ${event.name} on asset ${asset.id}`);
                        }
                    }
                    // Safety net: notify for overdue specific dates (1-3 days past due, only once)
                    else if (daysUntilEvent >= -3 && daysUntilEvent < 0) {
                        const overdueTrackingKey = `${asset.id}_${event.name}_specific_overdue_${eventDateStr}`;
                        const overdueTracking = maintenanceTracking.find(t => t.key === overdueTrackingKey);
                        
                        if (!overdueTracking) {
                            shouldNotify = true;
                            desc = `OVERDUE (was due ${eventDateStr})`;
                            
                            // Add tracking for overdue notification
                            maintenanceTracking.push({
                                key: overdueTrackingKey,
                                lastNotified: today,
                                eventDate: eventDateStr,
                                notificationType: 'overdue'
                            });
                            
                            debugLog(`[DEBUG] Overdue notification triggered for specific date maintenance: ${event.name} on asset ${asset.id} - ${Math.abs(daysUntilEvent)} days overdue`);
                        }
                    }
                }

                if (shouldNotify) {
                    const notificationData = {
                        id: asset.id,
                        name: asset.name,
                        modelNumber: asset.modelNumber,
                        eventName: event.name,
                        schedule: desc,
                        notes: event.notes,
                        type: assetType
                    };

                    // Add parent information for sub-assets
                    if (isSubAsset && asset.parentId) {
                        notificationData.parentId = asset.parentId;
                        const parentAsset = assets.find(a => a.id === asset.parentId);
                        notificationData.parentAsset = parentAsset ? parentAsset.name : 'Unknown Parent';
                    }

                    notificationsToSend.push({
                        type: 'maintenance_schedule',
                        data: notificationData,
                        config: { 
                            appriseUrl,
                            baseUrl: process.env.BASE_URL || 'http://localhost:3000'
                        }
                    });
                    
                    debugLog(`[DEBUG] Maintenance event notification queued for ${assetType.toLowerCase()}: ${asset.name}, event: ${event.name}`);
                }
            } catch (error) {
                debugLog(`[ERROR] Error processing maintenance event "${event.name}" for ${assetType.toLowerCase()} "${asset.name}":`, error.message);
                // Continue processing other events even if one fails
            }
        }
    }

    // Check assets for maintenance events
    debugLog(`[DEBUG] Checking ${assets.length} assets for maintenance events`);
    for (const asset of assets) {
        try {
            processMaintenanceEvents(asset, false);
        } catch (error) {
            debugLog(`[ERROR] Error processing asset "${asset.name}":`, error.message);
            // Continue with other assets
        }
    }

    // Check sub-assets for maintenance events
    debugLog(`[DEBUG] Checking ${subAssets.length} sub-assets for maintenance events`);
    for (const subAsset of subAssets) {
        try {
            processMaintenanceEvents(subAsset, true);
        } catch (error) {
            debugLog(`[ERROR] Error processing sub-asset "${subAsset.name}":`, error.message);
            // Continue with other sub-assets
        }
    }

    // Save updated maintenance tracking with error handling
    try {
        if (!writeJsonFile(maintenanceTrackingPath, maintenanceTracking)) {
            debugLog(`[ERROR] Failed to save maintenance tracking data to ${maintenanceTrackingPath}`);
        } else {
            debugLog(`[DEBUG] Maintenance tracking data saved successfully (${maintenanceTracking.length} records)`);
        }
    } catch (error) {
        debugLog(`[ERROR] Exception while saving maintenance tracking:`, error.message);
    }

    // Update nextDueDate in asset maintenance events based on tracking updates
    let assetsUpdated = false;
    let subAssetsUpdated = false;

    try {
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
            if (writeJsonFile(assetsFilePath, assets)) {
                debugLog(`[DEBUG] Assets file updated with new nextDueDate values`);
            } else {
                debugLog(`[ERROR] Failed to save updated assets file`);
            }
        }

        if (subAssetsUpdated) {
            if (writeJsonFile(subAssetsFilePath, subAssets)) {
                debugLog(`[DEBUG] SubAssets file updated with new nextDueDate values`);
            } else {
                debugLog(`[ERROR] Failed to save updated sub-assets file`);
            }
        }
    } catch (error) {
        debugLog(`[ERROR] Exception while updating asset files:`, error.message);
    }

    // Send all queued maintenance notifications with error handling
    let successfulNotifications = 0;
    let failedNotifications = 0;

    for (const notification of notificationsToSend) {
        try {
            await sendNotification(notification.type, notification.data, notification.config);
            successfulNotifications++;
        } catch (error) {
            debugLog(`[ERROR] Failed to send maintenance notification for ${notification.data.type} "${notification.data.name}", event "${notification.data.eventName}":`, error.message);
            failedNotifications++;
        }
    }

    // Log summary of maintenance check results
    const totalChecked = assets.length + subAssets.length;
    const totalEvents = assets.reduce((sum, a) => sum + (a.maintenanceEvents?.length || 0), 0) + 
                       subAssets.reduce((sum, a) => sum + (a.maintenanceEvents?.length || 0), 0);
    
    debugLog(`[SUMMARY] Maintenance check completed for ${today}:`);
    debugLog(`  - Assets checked: ${totalChecked} (${assets.length} main assets, ${subAssets.length} components)`);
    debugLog(`  - Total maintenance events: ${totalEvents}`);
    debugLog(`  - Notifications queued: ${notificationsToSend.length}`);
    debugLog(`  - Notifications sent successfully: ${successfulNotifications}`);
    debugLog(`  - Notifications failed: ${failedNotifications}`);
    debugLog(`  - Tracking records: ${maintenanceTracking.length}`);
    debugLog(`  - Assets updated: ${assetsUpdated ? 'Yes' : 'No'}`);
    debugLog(`  - Sub-assets updated: ${subAssetsUpdated ? 'Yes' : 'No'}`);

    if (notificationsToSend.length > 0) {
        console.log(`Maintenance check completed: ${successfulNotifications}/${notificationsToSend.length} notifications sent successfully`);
    }
}

/**
 * Clean up old and invalid maintenance tracking records
 * @param {Array} maintenanceTracking - The maintenance tracking array
 * @returns {Array} - Cleaned tracking array
 */
function cleanupMaintenanceTracking(maintenanceTracking) {
    if (!Array.isArray(maintenanceTracking)) return [];
    
    const today = getTodayString();
    const thirtyDaysAgo = DateTime.now().setZone(TIMEZONE).minus({ days: 30 }).toISODate();
    
    return maintenanceTracking.filter(tracking => {
        // Remove records that are invalid
        if (!tracking.key || !tracking.lastNotified) {
            debugLog(`[DEBUG] Removing invalid tracking record: ${JSON.stringify(tracking)}`);
            return false;
        }
        
        // Remove very old specific date tracking records (older than 30 days)
        if (tracking.notificationType && tracking.lastNotified < thirtyDaysAgo) {
            debugLog(`[DEBUG] Removing old specific date tracking record: ${tracking.key}`);
            return false;
        }
        
        // Validate date formats in tracking records
        if (tracking.nextDueDate && !parseDate(tracking.nextDueDate)) {
            debugLog(`[WARNING] Removing tracking record with invalid nextDueDate: ${tracking.key} - ${tracking.nextDueDate}`);
            return false;
        }
        
        return true;
    });
}

/**
 * Validate maintenance event configuration
 * @param {Object} event - The maintenance event to validate
 * @param {string} assetId - The asset ID for logging
 * @returns {boolean} - True if valid, false otherwise
 */
function validateMaintenanceEvent(event, assetId) {
    if (!event || !event.name) {
        debugLog(`[WARNING] Maintenance event missing name for asset: ${assetId}`);
        return false;
    }
    
    if (event.type === 'frequency') {
        if (!event.frequency || !event.frequencyUnit) {
            debugLog(`[WARNING] Frequency maintenance event missing frequency/unit for asset: ${assetId}, event: ${event.name}`);
            return false;
        }
        
        const numericFrequency = parseInt(event.frequency);
        if (isNaN(numericFrequency) || numericFrequency <= 0) {
            debugLog(`[WARNING] Invalid frequency for asset: ${assetId}, event: ${event.name} - frequency: ${event.frequency}`);
            return false;
        }
        
        const validUnits = ['days', 'day', 'weeks', 'week', 'months', 'month', 'years', 'year'];
        if (!validUnits.includes(event.frequencyUnit.toLowerCase())) {
            debugLog(`[WARNING] Invalid frequency unit for asset: ${assetId}, event: ${event.name} - unit: ${event.frequencyUnit}`);
            return false;
        }
        
        if (!event.nextDueDate) {
            debugLog(`[WARNING] Frequency maintenance event missing nextDueDate for asset: ${assetId}, event: ${event.name}`);
            return false;
        }
    } else if (event.type === 'specific') {
        if (!event.specificDate) {
            debugLog(`[WARNING] Specific date maintenance event missing specificDate for asset: ${assetId}, event: ${event.name}`);
            return false;
        }
        
        if (!parseDate(event.specificDate)) {
            debugLog(`[WARNING] Invalid specificDate for asset: ${assetId}, event: ${event.name} - date: ${event.specificDate}`);
            return false;
        }
    } else {
        debugLog(`[WARNING] Invalid maintenance event type for asset: ${assetId}, event: ${event.name} - type: ${event.type}`);
        return false;
    }
    
    return true;
}

module.exports = { startWarrantyCron, checkMaintenanceSchedules };