/**
 * Apprise Notification Service for DumbAssets
 * Encapsulates Apprise CLI integration for sending notifications about asset events.
 * Handles message formatting, CLI invocation, and error logging.
 */

const { spawn } = require('child_process');
const path = require('path');
const { formatDate, sanitizeText } = require('./utils');

/**
 * Send a notification using Apprise
 * @param {string} eventType - Type of event (e.g., 'asset_added', 'import_complete')
 * @param {Object} assetData - Data about the asset/event (e.g., { name, modelNumber, price })
 * @param {Object} config - Configuration object (appriseUrl, appriseMessage, etc.)
 * @returns {Promise<void>}
 */
async function sendNotification(eventType, assetData, config) {
  const { appriseUrl, appriseMessage } = config;
  if (!appriseUrl) return;

  try {
    // Sanitize asset data for message
    const safeData = {};
    for (const key in assetData) {
      safeData[key] = sanitizeText(assetData[key]);
    }
    // Add eventType and date
    safeData.eventType = eventType;
    safeData.date = formatDate(new Date());

    // Replace placeholders in message template
    let message = appriseMessage;
    Object.entries(safeData).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    await new Promise((resolve, reject) => {
      const appriseProcess = spawn('apprise', [appriseUrl, '-b', message]);
      appriseProcess.stdout.on('data', (data) => {
        console.info(`Apprise Output: ${data.toString().trim()}`);
      });
      appriseProcess.stderr.on('data', (data) => {
        console.error(`Apprise Error: ${data.toString().trim()}`);
      });
      appriseProcess.on('close', (code) => {
        if (code === 0) {
          console.info(`Notification sent: ${eventType} (${safeData.name || ''})`);
          resolve();
        } else {
          reject(new Error(`Apprise process exited with code ${code}`));
        }
      });
      appriseProcess.on('error', (err) => {
        reject(new Error(`Apprise process failed to start: ${err.message}`));
      });
    });
  } catch (err) {
    console.error(`Failed to send notification: ${err.message}`);
  }
}

module.exports = {
  sendNotification,
}; 