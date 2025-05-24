# DumbAssets Demo Mode

## Overview
Demo mode is now fully modular and centralized via the `DemoModeManager` abstraction. All demo mode checks and storage access are routed through this manager, which delegates to `DemoStorageManager` for localStorage operations. This ensures that demo mode logic is easy to maintain, swap, or remove.

## Key Files
- `public/managers/demoModeManager.js`: Central abstraction for demo mode logic.
- `public/managers/demoStorage.js`: Handles all CRUD operations in localStorage for demo mode.
- All main modules (`script.js`, `settings.js`, `import.js`, `fileUploader.js`, `assetRenderer.js`) now use `DemoModeManager` for demo mode logic.

## How It Works
- To check if demo mode is enabled, use `demoModeManager.isDemoMode`.
- All asset, sub-asset, settings, file, and import operations in demo mode are routed through `demoModeManager` methods.
- All POST/PUT/DELETE API calls are blocked server-side in demo mode.

## How to Remove Demo Mode
1. Delete `public/managers/demoModeManager.js` and `public/managers/demoStorage.js`.
2. Remove all imports and usages of `DemoModeManager` in the codebase.
3. Restore direct API calls and normal storage logic in the main modules.

## UI and State
- All UI and state updates in demo mode reflect the latest localStorage state via `DemoModeManager`.
- Settings, dashboard, and file previews are always in sync with demo mode storage.

## Extending or Swapping Demo Mode
- To swap out demo mode logic, simply update or replace `DemoModeManager` and/or `DemoStorageManager`.
- No changes are needed in the main application logic.

## Testing
- In demo mode, all `POST`, `PUT`, `DELETE` API calls are blocked server-side.
- LocalStorage is used for all CRUD operations.
- Once in demo mode, you can use the this fetch request as a client-side test:
```javascript
// Run all tests at once
const testEndpoints = [
    { url: '/api/asset', method: 'POST', body: { name: 'Test' } },
    { url: '/api/asset', method: 'PUT', body: { id: '123', name: 'Test' } },
    { url: '/api/asset/123', method: 'DELETE' },
    { url: '/api/subasset', method: 'POST', body: { name: 'Test' } },
    { url: '/api/settings', method: 'POST', body: { test: true } }
];

testEndpoints.forEach(async (test, i) => {
    try {
        const response = await fetch(test.url, {
            method: test.method,
            headers: test.body ? { 'Content-Type': 'application/json' } : {},
            body: test.body ? JSON.stringify(test.body) : undefined,
            credentials: 'include'
        });
        const result = await response.json();
        console.log(`Test ${i + 1} (${test.method} ${test.url}):`, result);
    } catch (error) {
        console.error(`Test ${i + 1} failed:`, error);
    }
});
```
- each request should return 403

---
For questions, see the code comments in `demoModeManager.js` and `demoStorage.js`.
