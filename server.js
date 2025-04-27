require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'TRUE';

function debugLog(...args) {
    if (DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Base URL configuration
const BASE_PATH = (() => {
    if (!process.env.BASE_URL) {
        debugLog('No BASE_URL set, using empty base path');
        return '';
    }
    try {
        const url = new URL(process.env.BASE_URL);
        const path = url.pathname.replace(/\/$/, ''); // Remove trailing slash
        debugLog('Base URL Configuration:', {
            originalUrl: process.env.BASE_URL,
            extractedPath: path,
            protocol: url.protocol,
            hostname: url.hostname
        });
        return path;
    } catch {
        // If BASE_URL is just a path (e.g. /app)
        const path = process.env.BASE_URL.replace(/\/$/, '');
        debugLog('Using direct path as BASE_URL:', path);
        return path;
    }
})();

// Get the project name from package.json to use for the PIN environment variable
const projectName = require('./package.json').name.toUpperCase().replace(/-/g, '_');
const PIN = process.env[`${projectName}_PIN`];

// Log whether PIN protection is enabled
if (!PIN || PIN.trim() === '') {
    debugLog('PIN protection is disabled');
} else {
    debugLog('PIN protection is enabled, PIN length:', PIN.length);
}

// Brute force protection
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

function resetAttempts(ip) {
    debugLog('Resetting login attempts for IP:', ip);
    loginAttempts.delete(ip);
}

function isLockedOut(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return false;
    
    if (attempts.count >= MAX_ATTEMPTS) {
        const timeElapsed = Date.now() - attempts.lastAttempt;
        if (timeElapsed < LOCKOUT_TIME) {
            debugLog('IP is locked out:', ip, 'Time remaining:', Math.ceil((LOCKOUT_TIME - timeElapsed) / 1000 / 60), 'minutes');
            return true;
        }
        resetAttempts(ip);
    }
    return false;
}

function recordAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
    debugLog('Login attempt recorded for IP:', ip, 'Count:', attempts.count);
}

// Security middleware
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

// Session configuration with secure settings
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Constant-time PIN comparison to prevent timing attacks
function verifyPin(storedPin, providedPin) {
    if (!storedPin || !providedPin) return false;
    if (storedPin.length !== providedPin.length) return false;
    
    try {
        return crypto.timingSafeEqual(
            Buffer.from(storedPin),
            Buffer.from(providedPin)
        );
    } catch {
        return false;
    }
}

// Authentication middleware
const authMiddleware = (req, res, next) => {
    debugLog('Auth check for path:', req.path, 'Method:', req.method);
    
    // If no PIN is set, bypass authentication
    if (!PIN || PIN.trim() === '') {
        debugLog('Auth bypassed - No PIN configured');
        return next();
    }

    // Check if user is authenticated via session
    if (!req.session.authenticated) {
        debugLog('Auth failed - No valid session, redirecting to login');
        return res.redirect(BASE_PATH + '/login');
    }
    debugLog('Auth successful - Valid session found');
    next();
};

// Serve config.js for frontend
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

// Serve static files for public assets
app.use(BASE_PATH + '/styles.css', express.static('public/styles.css'));
app.use(BASE_PATH + '/script.js', express.static('public/script.js'));

// Routes
app.get(BASE_PATH + '/', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(BASE_PATH + '/login', (req, res) => {
    // If no PIN is set, redirect to index
    if (!PIN || PIN.trim() === '') {
        return res.redirect(BASE_PATH + '/');
    }

    if (req.session.authenticated) {
        return res.redirect(BASE_PATH + '/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get(BASE_PATH + '/pin-length', (req, res) => {
    // If no PIN is set, return 0 length
    if (!PIN || PIN.trim() === '') {
        return res.json({ length: 0 });
    }
    res.json({ length: PIN.length });
});

app.post(BASE_PATH + '/verify-pin', (req, res) => {
    debugLog('PIN verification attempt from IP:', req.ip);
    
    // If no PIN is set, authentication is successful
    if (!PIN || PIN.trim() === '') {
        debugLog('PIN verification bypassed - No PIN configured');
        req.session.authenticated = true;
        return res.status(200).json({ success: true });
    }

    const ip = req.ip;
    
    // Check if IP is locked out
    if (isLockedOut(ip)) {
        const attempts = loginAttempts.get(ip);
        const timeLeft = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
        debugLog('PIN verification blocked - IP is locked out:', ip);
        return res.status(429).json({ 
            error: `Too many attempts. Please try again in ${timeLeft} minutes.`
        });
    }

    const { pin } = req.body;
    
    if (!pin || typeof pin !== 'string') {
        debugLog('PIN verification failed - Invalid PIN format');
        return res.status(400).json({ error: 'Invalid PIN format' });
    }

    // Add artificial delay to further prevent timing attacks
    const delay = crypto.randomInt(50, 150);
    setTimeout(() => {
        if (verifyPin(PIN, pin)) {
            debugLog('PIN verification successful');
            // Reset attempts on successful login
            resetAttempts(ip);
            
            // Set authentication in session
            req.session.authenticated = true;
            
            // Set secure cookie
            res.cookie(`${projectName}_PIN`, pin, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            res.status(200).json({ success: true });
        } else {
            debugLog('PIN verification failed - Invalid PIN');
            // Record failed attempt
            recordAttempt(ip);
            
            const attempts = loginAttempts.get(ip);
            const attemptsLeft = MAX_ATTEMPTS - attempts.count;
            
            res.status(401).json({ 
                error: 'Invalid PIN',
                attemptsLeft: Math.max(0, attemptsLeft)
            });
        }
    }, delay);
});

// Cleanup old lockouts periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
        if (now - attempts.lastAttempt >= LOCKOUT_TIME) {
            loginAttempts.delete(ip);
        }
    }
}, 60000); // Clean up every minute

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