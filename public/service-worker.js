const CACHE_VERSION = "1.0.1"; // Increment this with each significant change
const CACHE_NAME = `DUMBASSETS_PWA_CACHE_V${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [];
const BASE_PATH = self.registration.scope;

// Helper to prepend base path to URLs that need it
function getAssetPath(url) {
    // If the URL is external (starts with http:// or https://), don't modify it
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // Remove any leading slashes and join with base path
    return `${BASE_PATH}${url.replace(/^\/+/, '')}`;
}

// Check if cache exists and what version it is
async function checkCacheVersion() {
    const keys = await caches.keys();
    
    // Find any existing DUMBASSETS cache
    const existingCache = keys.find(key => key.startsWith('DUMBASSETS_PWA_CACHE'));
    const existingVersion = existingCache ? existingCache.split('V')[1] : null;
    
    // Check if current version cache exists
    const currentCacheExists = keys.includes(CACHE_NAME);
    
    // Check for old versions
    const oldCaches = keys.filter(key => key !== CACHE_NAME && key.startsWith('DUMBASSETS_PWA_CACHE'));
    const hasOldVersions = oldCaches.length > 0;
    
    return {
        currentCacheExists,
        hasOldVersions,
        oldCaches,
        existingVersion
    };
}

// Function to clean up old caches
async function cleanOldCaches() {
    const { oldCaches } = await checkCacheVersion();
    if (oldCaches.length > 0) {
        console.log("Cleaning up old caches");
        await Promise.all(
            oldCaches.map(key => {
                console.log(`Deleting old cache: ${key}`);
                return caches.delete(key);
            })
        );
    }
    return oldCaches.length > 0;
}

// Function to notify clients about version status
async function notifyClients() {
    const { existingVersion } = await checkCacheVersion();
    if (existingVersion !== CACHE_VERSION) {
        // Clean up old caches before notifying about updates
        await cleanOldCaches();
        
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'UPDATE_AVAILABLE',
                    currentVersion: existingVersion,
                    newVersion: CACHE_VERSION
                });
            });
        });
    }
}

const preload = async () => {
    console.log("Preparing to install web app cache");
    
    // Check cache status
    const { currentCacheExists, existingVersion } = await checkCacheVersion();
    
    // If current version cache already exists, no need to reinstall
    if (currentCacheExists) {
        console.log(`Cache ${CACHE_NAME} already exists, using existing cache`);
        await notifyClients(); // Still check if we need to notify about updates
        return;
    }
    
    // If we have an older version, clean old caches and notify clients
    if (existingVersion && existingVersion !== CACHE_VERSION) {
        console.log(`New version ${CACHE_VERSION} available (current: ${existingVersion})`);
        
        // Clean up any old caches to prevent reload loops
        await cleanOldCaches();
        
        await notifyClients();
        return;
    }
    
    // If no cache exists at all, do initial installation
    if (!existingVersion) {
        await installCache();
    }
};

// Function to install or update the cache
async function installCache() {
    console.log(`Installing/updating cache to version ${CACHE_VERSION}`);
    const cache = await caches.open(CACHE_NAME);
    
    try {
        console.log("Fetching asset manifest...");
        const response = await fetch(getAssetPath("assets/asset-manifest.json"));
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const assets = await response.json();
        
        // Add base path to relative URLs
        const processedAssets = assets.map(asset => getAssetPath(asset));
        ASSETS_TO_CACHE.push(...processedAssets);
        
        // Always include critical files
        const criticalFiles = [
            'index.html',
            'index.js',
            'styles.css',
            'assets/manifest.json',
            'assets/dumbassets.png',
        ];
        
        criticalFiles.forEach(file => {
            const filePath = getAssetPath(file);
            if (!ASSETS_TO_CACHE.includes(filePath)) {
                ASSETS_TO_CACHE.push(filePath);
            }
        });
        
        console.log("Assets to cache:", ASSETS_TO_CACHE);
        await cache.addAll(ASSETS_TO_CACHE);
        console.log("Assets cached successfully");
        
        // Clear old caches after successful installation
        await cleanOldCaches();

        // Notify clients of successful update
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'UPDATE_COMPLETE',
                    version: CACHE_VERSION,
                    success: true
                });
            });
        });
    } catch (error) {
        console.error("Failed to cache assets:", error);
        // Notify clients of failed update
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'UPDATE_COMPLETE',
                    version: CACHE_VERSION,
                    success: false,
                    error: error.message
                });
            });
        });
    }
}

self.addEventListener("install", (event) => {
    console.log("Service Worker installing...");
    event.waitUntil(
        Promise.all([
            preload(),
            self.skipWaiting() // Skip waiting to allow new service worker to activate immediately
        ])
    );
});

self.addEventListener("activate", (event) => {
    console.log("Service Worker activating...");
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // Take control of all clients immediately
            notifyClients() // Check version and notify clients immediately
        ])
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Clone the request because it can only be used once
                return fetch(event.request.clone())
                    .then((response) => {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response because it can only be used once
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    });
            })
            .catch(() => {
                // Return a fallback response for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match(getAssetPath('index.html'));
                }
                return new Response('Network error happened', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' },
                });
            })
    );
});

// Listen for message events from the main script
self.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'GET_VERSION') {
        const { existingVersion } = await checkCacheVersion();
        // Send the current version to the client
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
                currentVersion: existingVersion,
                newVersion: CACHE_VERSION
            });
        }
    } else if (event.data && event.data.type === 'PERFORM_UPDATE') {
        // First check and clean up any old caches
        await cleanOldCaches();
        
        // User has confirmed they want to update
        await installCache();
        // Notify clients that update is complete
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'UPDATE_COMPLETE',
                    version: CACHE_VERSION
                });
            });
        });
    }
});