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

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'TRUE';

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
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'"],
        },
    },
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
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
app.get(BASE_PATH + '/config.js', (req, res) => {
    debugLog('Serving config.js with basePath:', BASE_PATH);
    res.type('application/javascript').send(`
        window.appConfig = {
            basePath: '${BASE_PATH}',
            debug: ${DEBUG},
            siteTitle: '${process.env.SITE_TITLE || 'DumbTitle'}'
        };
    `);
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
app.use('/Images', express.static(path.join(__dirname, 'data', 'Images')));
app.use('/Receipts', express.static(path.join(__dirname, 'data', 'Receipts')));

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
app.post('/api/asset', (req, res) => {
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
    
    if (writeJsonFile(assetsFilePath, assets)) {
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
        // Try to delete image and receipt files if they exist
        try {
            if (deletedAsset.photoPath) {
                const photoPath = path.join(__dirname, deletedAsset.photoPath.substring(1));
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
            }
            
            if (deletedAsset.receiptPath) {
                const receiptPath = path.join(__dirname, deletedAsset.receiptPath.substring(1));
                if (fs.existsSync(receiptPath)) {
                    fs.unlinkSync(receiptPath);
                }
            }
        } catch (error) {
            console.error('Error deleting files:', error);
            // Continue even if file deletion fails
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