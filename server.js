/**
 * DumbAssets - Asset Tracking Application
 * Server implementation for handling API requests and file operations
 */

// --- SECURITY & CONFIG IMPORTS ---
require('dotenv').config();
console.log('process.env:', process.env);
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const { sendNotification } = require('./src/services/notifications/appriseNotifier');
const { startWarrantyCron } = require('./src/services/notifications/warrantyCron');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'TRUE';

// Set timezone from environment variable or default to America/Chicago
process.env.TZ = process.env.TZ || 'America/Chicago';

function debugLog(...args) {
    if (DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// --- BASE PATH & PIN CONFIG ---
const BASE_PATH = (() => {
    if (!process.env.BASE_URL) {
        debugLog('No BASE_URL set, using empty base path');
        return '';
    }
    try {
        const url = new URL(process.env.BASE_URL);
        const path = url.pathname.replace(/\/$/, '');
        debugLog('Base URL Configuration:', {
            originalUrl: process.env.BASE_URL,
            extractedPath: path,
            protocol: url.protocol,
            hostname: url.hostname
        });
        return path;
    } catch {
        const path = process.env.BASE_URL.replace(/\/$/, '');
        debugLog('Using direct path as BASE_URL:', path);
        return path;
    }
})();
const projectName = require('./package.json').name.toUpperCase().replace(/-/g, '_');
const PIN = process.env.DUMBASSETS_PIN;
console.log('PIN:', PIN);
if (!PIN || PIN.trim() === '') {
    debugLog('PIN protection is disabled');
} else {
    debugLog('PIN protection is enabled, PIN length:', PIN.length);
}

// --- BRUTE FORCE PROTECTION ---
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;
function resetAttempts(ip) { loginAttempts.delete(ip); }
function isLockedOut(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return false;
    if (attempts.count >= MAX_ATTEMPTS) {
        const timeElapsed = Date.now() - attempts.lastAttempt;
        if (timeElapsed < LOCKOUT_TIME) return true;
        resetAttempts(ip);
    }
    return false;
}
function recordAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
}

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
        },
    },
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// --- PIN VERIFICATION ---
function verifyPin(storedPin, providedPin) {
    if (!storedPin || !providedPin) return false;
    if (storedPin.length !== providedPin.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(storedPin), Buffer.from(providedPin));
    } catch { return false; }
}

// --- AUTH MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    debugLog('Auth check for path:', req.path, 'Method:', req.method);
    if (!PIN || PIN.trim() === '') return next();
    if (!req.session.authenticated) {
        debugLog('Auth failed - No valid session');
        
        // Check if this is an API request
        if (req.path.startsWith('/api/') || req.xhr) {
            // Return JSON error for API requests
            return res.status(401).json({ 
                error: 'Authentication required', 
                redirectTo: BASE_PATH + '/login'
            });
        } else {
            // Redirect to login for page requests
        return res.redirect(BASE_PATH + '/login');
        }
    }
    debugLog('Auth successful - Valid session found');
    next();
};

// --- STATIC FILES & CONFIG ---
app.get(BASE_PATH + '/config.js', async (req, res) => {
    debugLog('Serving config.js with basePath:', BASE_PATH);
    
    // Set proper MIME type
    res.setHeader('Content-Type', 'application/javascript');
    
    // First send the dynamic config
    res.write(`
        window.appConfig = {
            basePath: '${BASE_PATH}',
            debug: ${DEBUG},
            siteTitle: '${process.env.SITE_TITLE || 'DumbTitle'}'
        };
    `);
    
    // Then append the static config.js content
    try {
        const staticConfig = await fs.promises.readFile(path.join(__dirname, 'public', 'config.js'), 'utf8');
        res.write('\n\n' + staticConfig);
    } catch (error) {
        console.error('Error reading static config.js:', error);
    }
    
    res.end();
});

// Unprotected routes and files (accessible without login)
app.get(BASE_PATH + '/login', (req, res) => {
    if (!PIN || PIN.trim() === '') return res.redirect(BASE_PATH + '/');
    if (req.session.authenticated) return res.redirect(BASE_PATH + '/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get(BASE_PATH + '/pin-length', (req, res) => {
    if (!PIN || PIN.trim() === '') return res.json({ length: 0 });
    res.json({ length: PIN.length });
});

app.post(BASE_PATH + '/verify-pin', (req, res) => {
    debugLog('PIN verification attempt from IP:', req.ip);
    if (!PIN || PIN.trim() === '') {
        req.session.authenticated = true;
        return res.status(200).json({ success: true });
    }
    const ip = req.ip;
    if (isLockedOut(ip)) {
        const attempts = loginAttempts.get(ip);
        const timeLeft = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
        return res.status(429).json({ error: `Too many attempts. Please try again in ${timeLeft} minutes.` });
    }
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string') {
        return res.status(400).json({ error: 'Invalid PIN format' });
    }
    const delay = crypto.randomInt(50, 150);
    setTimeout(() => {
        if (verifyPin(PIN, pin)) {
            resetAttempts(ip);
            req.session.authenticated = true;
            res.cookie(`${projectName}_PIN`, pin, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000
            });
            res.status(200).json({ success: true });
        } else {
            recordAttempt(ip);
            const attempts = loginAttempts.get(ip);
            const attemptsLeft = MAX_ATTEMPTS - attempts.count;
            res.status(401).json({ error: 'Invalid PIN', attemptsLeft: Math.max(0, attemptsLeft) });
        }
    }, delay);
});

// Login page static assets (need to be accessible without authentication)
app.use(BASE_PATH + '/styles.css', express.static('public/styles.css'));
app.use(BASE_PATH + '/script.js', express.static('public/script.js'));

// --- AUTHENTICATION MIDDLEWARE FOR ALL PROTECTED ROUTES ---
app.use((req, res, next) => {
    // Skip auth for login page and login-related resources
    if (req.path === BASE_PATH + '/login' || 
        req.path === BASE_PATH + '/pin-length' || 
        req.path === BASE_PATH + '/verify-pin' ||
        req.path === BASE_PATH + '/styles.css' ||
        req.path === BASE_PATH + '/script.js' ||
        req.path === BASE_PATH + '/config.js') {
        return next();
    }
    
    // Apply authentication middleware
    authMiddleware(req, res, next);
});

// Protected static file serving (only accessible after authentication)
app.use('/Images', authMiddleware, express.static(path.join(__dirname, 'data', 'Images')));
app.use('/Receipts', authMiddleware, express.static(path.join(__dirname, 'data', 'Receipts')));

// Protected API routes
app.use('/api', (req, res, next) => {
    console.log(`API Request: ${req.method} ${req.path}`);
    next();
});

// --- ASSET MANAGEMENT (existing code preserved) ---
// File paths
const assetsFilePath = path.join(__dirname, 'data', 'Assets.json');
const subAssetsFilePath = path.join(__dirname, 'data', 'SubAssets.json');

// Helper Functions
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

function writeJsonFile(filePath, data) {
    try {
        const dirPath = path.dirname(filePath);
        ensureDirectoryExists(dirPath);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
        return false;
    }
}

function generateId() {
    // Generate a 10-digit ID
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Initialize data directories
ensureDirectoryExists(path.join(__dirname, 'data', 'Images'));
ensureDirectoryExists(path.join(__dirname, 'data', 'Receipts'));

// Initialize empty files if they don't exist
if (!fs.existsSync(assetsFilePath)) {
    writeJsonFile(assetsFilePath, []);
}

if (!fs.existsSync(subAssetsFilePath)) {
    writeJsonFile(subAssetsFilePath, []);
}

// API Routes
// Get all assets
app.get('/api/assets', (req, res) => {
    const assets = readJsonFile(assetsFilePath);
    res.json(assets);
});

// Get all sub-assets
app.get('/api/subassets', (req, res) => {
    const subAssets = readJsonFile(subAssetsFilePath);
    res.json(subAssets);
});

// Create a new asset
app.post('/api/asset', async (req, res) => {
    const assets = readJsonFile(assetsFilePath);
    const newAsset = req.body;
    
    // Ensure required fields
    if (!newAsset.name) {
        return res.status(400).json({ error: 'Asset name is required' });
    }
    
    // Generate ID if not provided
    if (!newAsset.id) {
        newAsset.id = generateId();
    }
    
    // Set timestamps
    newAsset.createdAt = new Date().toISOString();
    newAsset.updatedAt = new Date().toISOString();
    
    assets.push(newAsset);
    let success = writeJsonFile(assetsFilePath, assets);
    if (success) {
        if (DEBUG) {
            console.log('[DEBUG] Asset added:', { name: newAsset.name, modelNumber: newAsset.modelNumber, description: newAsset.description });
        }
        // Notification logic
        try {
            const configPath = path.join(__dirname, 'data', 'config.json');
            let config = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            const notificationSettings = config.notificationSettings || {};
            const appriseUrl = process.env.APPRISE_URL || (config.appriseUrl || null);
            if (DEBUG) {
                console.log('[DEBUG] Notification settings (add):', notificationSettings, 'Apprise URL:', appriseUrl);
            }
            if (notificationSettings.notifyAdd && appriseUrl) {
                await sendNotification('asset_added', {
                    name: newAsset.name,
                    modelNumber: newAsset.modelNumber,
                    description: newAsset.description
                }, {
                    appriseUrl
                });
                if (DEBUG) {
                    console.log('[DEBUG] Asset added notification sent.');
                }
            }
        } catch (err) {
            console.error('Failed to send asset added notification:', err.message);
        }
        res.status(201).json(newAsset);
    } else {
        res.status(500).json({ error: 'Failed to create asset' });
    }
});

// Update an existing asset
app.put('/api/asset', (req, res) => {
    const assets = readJsonFile(assetsFilePath);
    const updatedAsset = req.body;
    
    // Ensure required fields
    if (!updatedAsset.id || !updatedAsset.name) {
        return res.status(400).json({ error: 'Asset ID and name are required' });
    }
    
    const index = assets.findIndex(a => a.id === updatedAsset.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Preserve creation date
    updatedAsset.createdAt = assets[index].createdAt;
    // Update the modification date
    updatedAsset.updatedAt = new Date().toISOString();
    
    assets[index] = updatedAsset;
    
    if (writeJsonFile(assetsFilePath, assets)) {
        if (DEBUG) {
            console.log('[DEBUG] Asset edited:', { id: updatedAsset.id, name: updatedAsset.name, modelNumber: updatedAsset.modelNumber });
        }
        // Notification logic
        try {
            const configPath = path.join(__dirname, 'data', 'config.json');
            let config = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            const notificationSettings = config.notificationSettings || {};
            const appriseUrl = process.env.APPRISE_URL || (config.appriseUrl || null);
            if (DEBUG) {
                console.log('[DEBUG] Notification settings (edit):', notificationSettings, 'Apprise URL:', appriseUrl);
            }
            if (notificationSettings.notifyEdit && appriseUrl) {
                sendNotification('asset_edited', {
                    name: updatedAsset.name,
                    modelNumber: updatedAsset.modelNumber,
                    description: updatedAsset.description
                }, {
                    appriseUrl
                });
                if (DEBUG) {
                    console.log('[DEBUG] Asset edited notification sent.');
                }
            }
        } catch (err) {
            console.error('Failed to send asset edited notification:', err.message);
        }
        res.json(updatedAsset);
    } else {
        res.status(500).json({ error: 'Failed to update asset' });
    }
});

// Delete an asset
app.delete('/api/asset/:id', (req, res) => {
    const assetId = req.params.id;
    const assets = readJsonFile(assetsFilePath);
    const subAssets = readJsonFile(subAssetsFilePath);
    
    // Find the asset to delete
    const assetIndex = assets.findIndex(a => a.id === assetId);
    
    if (assetIndex === -1) {
        return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Remove the asset
    const deletedAsset = assets.splice(assetIndex, 1)[0];
    
    // Remove all related sub-assets
    const updatedSubAssets = subAssets.filter(sa => sa.parentId !== assetId);
    
    // Write updated assets
    if (writeJsonFile(assetsFilePath, assets) && writeJsonFile(subAssetsFilePath, updatedSubAssets)) {
        if (DEBUG) {
            console.log('[DEBUG] Asset deleted:', { id: deletedAsset.id, name: deletedAsset.name, modelNumber: deletedAsset.modelNumber });
        }
        // Notification logic
        try {
            const configPath = path.join(__dirname, 'data', 'config.json');
            let config = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            const notificationSettings = config.notificationSettings || {};
            const appriseUrl = process.env.APPRISE_URL || (config.appriseUrl || null);
            if (DEBUG) {
                console.log('[DEBUG] Notification settings (delete):', notificationSettings, 'Apprise URL:', appriseUrl);
            }
            if (notificationSettings.notifyDelete && appriseUrl) {
                sendNotification('asset_deleted', {
                    name: deletedAsset.name,
                    modelNumber: deletedAsset.modelNumber,
                    description: deletedAsset.description
                }, {
                    appriseUrl
                });
                if (DEBUG) {
                    console.log('[DEBUG] Asset deleted notification sent.');
                }
            }
        } catch (err) {
            console.error('Failed to send asset deleted notification:', err.message);
        }
        res.json({ message: 'Asset deleted successfully' });
    } else {
        res.status(500).json({ error: 'Failed to delete asset' });
    }
});

// Create a new sub-asset
app.post('/api/subasset', (req, res) => {
    const subAssets = readJsonFile(subAssetsFilePath);
    const newSubAsset = req.body;
    
    // Ensure required fields
    if (!newSubAsset.name || !newSubAsset.parentId) {
        return res.status(400).json({ error: 'Sub-asset name and parent ID are required' });
    }
    
    // Generate ID if not provided
    if (!newSubAsset.id) {
        newSubAsset.id = generateId();
    }
    
    // Set timestamps
    newSubAsset.createdAt = new Date().toISOString();
    newSubAsset.updatedAt = new Date().toISOString();
    
    subAssets.push(newSubAsset);
    
    if (writeJsonFile(subAssetsFilePath, subAssets)) {
        res.status(201).json(newSubAsset);
    } else {
        res.status(500).json({ error: 'Failed to create sub-asset' });
    }
});

// Update an existing sub-asset
app.put('/api/subasset', (req, res) => {
    const subAssets = readJsonFile(subAssetsFilePath);
    const updatedSubAsset = req.body;
    
    // Ensure required fields
    if (!updatedSubAsset.id || !updatedSubAsset.name || !updatedSubAsset.parentId) {
        return res.status(400).json({ error: 'Sub-asset ID, name, and parent ID are required' });
    }
    
    const index = subAssets.findIndex(sa => sa.id === updatedSubAsset.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Sub-asset not found' });
    }
    
    // Preserve creation date
    updatedSubAsset.createdAt = subAssets[index].createdAt;
    // Update the modification date
    updatedSubAsset.updatedAt = new Date().toISOString();
    
    subAssets[index] = updatedSubAsset;
    
    if (writeJsonFile(subAssetsFilePath, subAssets)) {
        res.json(updatedSubAsset);
    } else {
        res.status(500).json({ error: 'Failed to update sub-asset' });
    }
});

// Delete a sub-asset
app.delete('/api/subasset/:id', (req, res) => {
    const subAssetId = req.params.id;
    const subAssets = readJsonFile(subAssetsFilePath);
    
    // Find the sub-asset to delete
    const subAssetIndex = subAssets.findIndex(sa => sa.id === subAssetId);
    
    if (subAssetIndex === -1) {
        return res.status(404).json({ error: 'Sub-asset not found' });
    }
    
    // Get the sub-asset to delete
    const deletedSubAsset = subAssets[subAssetIndex];
    
    // Find all child sub-assets (recursively)
    const subAssetIdsToDelete = [subAssetId];
    let childrenToCheck = subAssets.filter(sa => sa.parentSubId === subAssetId);
    
    while (childrenToCheck.length > 0) {
        const currentChild = childrenToCheck.shift();
        subAssetIdsToDelete.push(currentChild.id);
        
        // Find any children of this child
        const grandchildren = subAssets.filter(sa => sa.parentSubId === currentChild.id);
        childrenToCheck = [...childrenToCheck, ...grandchildren];
    }
    
    // Filter out all sub-assets that need to be deleted
    const updatedSubAssets = subAssets.filter(sa => !subAssetIdsToDelete.includes(sa.id));
    
    // Write updated sub-assets
    if (writeJsonFile(subAssetsFilePath, updatedSubAssets)) {
        // Try to delete image and receipt files if they exist
        try {
            if (deletedSubAsset.photoPath) {
                const photoPath = path.join(__dirname, deletedSubAsset.photoPath.substring(1));
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
            }
            
            if (deletedSubAsset.receiptPath) {
                const receiptPath = path.join(__dirname, deletedSubAsset.receiptPath.substring(1));
                if (fs.existsSync(receiptPath)) {
                    fs.unlinkSync(receiptPath);
                }
            }
        } catch (error) {
            console.error('Error deleting files:', error);
            // Continue even if file deletion fails
        }
        
        res.json({ message: 'Sub-asset deleted successfully' });
    } else {
        res.status(500).json({ error: 'Failed to delete sub-asset' });
    }
});

// File upload endpoints
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'data/Images');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.body.id || uuidv4()}${ext}`);
    }
});

const receiptStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'data/Receipts');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.body.id || uuidv4()}${ext}`);
    }
});

const uploadImage = multer({ storage: imageStorage });
const uploadReceipt = multer({ storage: receiptStorage });

app.post('/api/upload/image', uploadImage.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const photoPath = `/Images/${req.file.filename}`;
    res.json({ path: photoPath });
});

app.post('/api/upload/receipt', uploadReceipt.single('receipt'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const receiptPath = `/Receipts/${req.file.filename}`;
    res.json({ path: receiptPath });
});

// Delete a file (image or receipt)
app.post('/api/delete-file', (req, res) => {
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'No file path provided' });
    const absPath = path.join(__dirname, filePath.startsWith('/') ? filePath.substring(1) : filePath);
    fs.unlink(absPath, (err) => {
        if (err) {
            // If file doesn't exist, treat as success
            if (err.code === 'ENOENT') return res.json({ message: 'File already deleted' });
            return res.status(500).json({ error: 'Failed to delete file' });
        }
        res.json({ message: 'File deleted' });
    });
});

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Import assets route
app.post('/api/import-assets', authMiddleware, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // First get column headers
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // If this is the first request (no mappings provided), return the headers
        if (!req.body.mappings) {
            const headers = data[0] || [];
            return res.json({ headers });
        }

        // When processing with mappings, use raw sheet data for better parsing
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
        console.log("Sample row:", jsonData.length > 0 ? jsonData[0] : "No data");
        
        // Get column mappings from request
        const mappings = JSON.parse(req.body.mappings);
        console.log("Mappings:", mappings);
        
        // Convert column index mappings to actual column names
        const headers = data[0] || [];
        const columnMappings = {
            name: mappings.name !== '' ? headers[parseInt(mappings.name, 10)] : '',
            model: mappings.model !== '' ? headers[parseInt(mappings.model, 10)] : '',
            serial: mappings.serial !== '' ? headers[parseInt(mappings.serial, 10)] : '',
            purchaseDate: mappings.purchaseDate !== '' ? headers[parseInt(mappings.purchaseDate, 10)] : '',
            purchasePrice: mappings.purchasePrice !== '' ? headers[parseInt(mappings.purchasePrice, 10)] : '',
            notes: mappings.notes !== '' ? headers[parseInt(mappings.notes, 10)] : '',
            url: mappings.url !== '' ? headers[parseInt(mappings.url, 10)] : '',
            warranty: mappings.warranty !== '' ? headers[parseInt(mappings.warranty, 10)] : '',
            warrantyExpiration: mappings.warrantyExpiration !== '' ? headers[parseInt(mappings.warrantyExpiration, 10)] : ''
        };
        console.log("Column name mappings:", columnMappings);
        
        // Transform data using header-based mappings
        const transformedData = jsonData.map(row => {
            // Create a unique ID for each asset
            const assetId = uuidv4();
            console.log("Processing row:", row);
            
            // Use column names to access the data
            const asset = {
                id: assetId,
                name: columnMappings.name ? (row[columnMappings.name] || '') : '',
                modelNumber: columnMappings.model ? (row[columnMappings.model] || '') : '',
                serialNumber: columnMappings.serial ? (row[columnMappings.serial] || '') : '',
                purchaseDate: columnMappings.purchaseDate ? (row[columnMappings.purchaseDate] || '') : '',
                price: columnMappings.purchasePrice ? (row[columnMappings.purchasePrice] || '') : '',
                description: columnMappings.notes ? (row[columnMappings.notes] || '') : '',
                link: columnMappings.url ? (row[columnMappings.url] || '') : '',
                photoPath: null,
                receiptPath: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                warranty: {
                    scope: columnMappings.warranty ? (row[columnMappings.warranty] || '') : '',
                    expirationDate: columnMappings.warrantyExpiration ? (row[columnMappings.warrantyExpiration] || '') : ''
                }
            };
            return asset;
        });

        // Sample the first asset for debugging
        console.log("Sample transformed asset:", transformedData.length > 0 ? transformedData[0] : "No data");

        // Save transformed data to assets.json
        const assetsPath = path.join(__dirname, 'data', 'Assets.json');
        let existingAssets = [];
        
        if (fs.existsSync(assetsPath)) {
            const fileContent = fs.readFileSync(assetsPath, 'utf8');
            existingAssets = JSON.parse(fileContent);
        }

        // Add new assets to existing ones
        const updatedAssets = [...existingAssets, ...transformedData];
        
        // Write back to file
        fs.writeFileSync(assetsPath, JSON.stringify(updatedAssets, null, 2));

        res.json({ 
            message: 'Import successful', 
            importedCount: transformedData.length 
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import assets: ' + error.message });
    }
});

// Get notification settings
app.get('/api/notification-settings', authMiddleware, (req, res) => {
    try {
        const configPath = path.join(__dirname, 'data', 'config.json');
        if (!fs.existsSync(configPath)) {
            // Default settings if config does not exist
            return res.json({
                notifyAdd: true,
                notifyDelete: false,
                notifyEdit: true,
                notify1Month: true,
                notify2Week: false,
                notify7Day: true,
                notify3Day: false
            });
        }
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        res.json(config.notificationSettings || {});
    } catch (err) {
        res.status(500).json({ error: 'Failed to load notification settings' });
    }
});

// Save notification settings
app.post('/api/notification-settings', authMiddleware, express.json(), (req, res) => {
    try {
        const configPath = path.join(__dirname, 'data', 'config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        config.notificationSettings = req.body;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save notification settings' });
    }
});

// Test notification endpoint
app.post('/api/notification-test', authMiddleware, async (req, res) => {
    if (DEBUG) {
        console.log('[DEBUG] /api/notification-test called');
    }
    try {
        const configPath = path.join(__dirname, 'data', 'config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        // Use APPRISE_URL from env or config
        const appriseUrl = process.env.APPRISE_URL || (config.appriseUrl || null);
        if (DEBUG) {
            console.log('[DEBUG] Notification settings (test):', config.notificationSettings, 'Apprise URL:', appriseUrl);
        }
        if (!appriseUrl) return res.status(400).json({ error: 'No Apprise URL configured.' });
        // Send test notification
        await sendNotification('test', { name: 'Test Notification', eventType: 'test' }, {
            appriseUrl,
            appriseMessage: 'This is a test notification from DumbAssets.'
        });
        if (DEBUG) {
            console.log('[DEBUG] Test notification sent.');
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send test notification.' });
    }
});

// --- CATCH-ALL: Serve index.html if authenticated, else redirect to login ---
app.get('*', (req, res) => {
    if (!PIN || PIN.trim() === '' || req.session.authenticated) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect(BASE_PATH + '/login');
    }
});

// --- CLEANUP LOCKOUTS ---
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
        if (now - attempts.lastAttempt >= LOCKOUT_TIME) {
            loginAttempts.delete(ip);
        }
    }
}, 60000);

// Warranty expiration notification cron
startWarrantyCron();

// --- START SERVER ---
app.listen(PORT, () => {
    debugLog('Server Configuration:', {
        port: PORT,
        basePath: BASE_PATH,
        pinProtection: !!PIN,
        nodeEnv: process.env.NODE_ENV || 'development',
        debug: DEBUG
    });
    console.log(`Server running on port ${PORT}`);
}); 
// --- END --- 