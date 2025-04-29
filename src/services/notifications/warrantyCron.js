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
        const configPath = path.join(__dirname, '../../../data/config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        const notificationSettings = config.notificationSettings || {};
        const appriseUrl = process.env.APPRISE_URL || (config.appriseUrl || null);
        if (!(notificationSettings.notify1Month || notificationSettings.notify2Week || notificationSettings.notify7Day || notificationSettings.notify3Day)) {
            return;
        }
        const now = DateTime.now().setZone(process.env.TZ || 'America/Chicago');
        const todayNoon = now.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
        if (now < todayNoon) return;
        assets.forEach(asset => {
            if (!asset.warranty || !asset.warranty.expirationDate) return;
            const expDate = DateTime.fromISO(asset.warranty.expirationDate, { zone: process.env.TZ || 'America/Chicago' });
            if (!expDate.isValid) return;
            const daysOut = Math.floor(expDate.diff(now, 'days').days);
            if (notificationSettings.notify1Month && daysOut === 30) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: asset.warranty.expirationDate,
                    days: 30
                }, { appriseUrl });
                debugLog(`[DEBUG] Warranty 30-day notification sent for asset: ${asset.name}`);
            }
            if (notificationSettings.notify2Week && daysOut === 14) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: asset.warranty.expirationDate,
                    days: 14
                }, { appriseUrl });
                debugLog(`[DEBUG] Warranty 14-day notification sent for asset: ${asset.name}`);
            }
            if (notificationSettings.notify7Day && daysOut === 7) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: asset.warranty.expirationDate,
                    days: 7
                }, { appriseUrl });
                debugLog(`[DEBUG] Warranty 7-day notification sent for asset: ${asset.name}`);
            }
            if (notificationSettings.notify3Day && daysOut === 3) {
                sendNotification('warranty_expiring', {
                    name: asset.name,
                    modelNumber: asset.modelNumber,
                    expirationDate: asset.warranty.expirationDate,
                    days: 3
                }, { appriseUrl });
                debugLog(`[DEBUG] Warranty 3-day notification sent for asset: ${asset.name}`);
            }
        });
    }, {
        timezone: process.env.TZ || 'America/Chicago'
    });
}

module.exports = { startWarrantyCron }; 