/**
 * Notification Queue Manager
 * Manages a queue of notifications to prevent overwhelming users with simultaneous notifications.
 * Implements a 5-second delay between notifications when multiple are sent at the same time.
 */

// Helper: debugLog fallback
const debugLog = (typeof global.debugLog === 'function') ? global.debugLog : (...args) => {
    if (process.env.DEBUG && String(process.env.DEBUG).toLowerCase() === 'true') {
        console.log(...args);
    }
};

class NotificationQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.delayBetweenNotifications = 5000; // 5 seconds
    }

    /**
     * Add a notification to the queue
     * @param {Function} notificationFunction - The function to call to send the notification
     * @param {Array} args - Arguments to pass to the notification function
     */
    enqueue(notificationFunction, args) {
        this.queue.push({ fn: notificationFunction, args });
        debugLog(`[DEBUG] Notification queued. Queue length: ${this.queue.length}`);
        
        // Start processing if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process the notification queue with delays
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        debugLog(`[DEBUG] Starting to process notification queue with ${this.queue.length} notifications`);

        while (this.queue.length > 0) {
            const { fn, args } = this.queue.shift();
            
            try {
                // Send the notification
                debugLog(`[DEBUG] Sending notification. Remaining in queue: ${this.queue.length}`);
                await fn(...args);
                
                // If there are more notifications in queue, wait before sending the next one
                if (this.queue.length > 0) {
                    debugLog(`[DEBUG] Waiting ${this.delayBetweenNotifications/1000} seconds before next notification`);
                    await this.delay(this.delayBetweenNotifications);
                }
            } catch (error) {
                console.error('Error sending notification:', error);
                // Continue processing even if one notification fails
            }
        }

        debugLog(`[DEBUG] Finished processing notification queue`);
        this.isProcessing = false;
    }

    /**
     * Helper function to create a delay
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get the current queue length
     */
    getQueueLength() {
        return this.queue.length;
    }

    /**
     * Check if the queue is currently processing
     */
    isCurrentlyProcessing() {
        return this.isProcessing;
    }
}

// Create a singleton instance
const notificationQueue = new NotificationQueue();

module.exports = notificationQueue; 