import { joinPath } from '../helpers/paths.js';

// Function to register the service worker
export const registerServiceWorker = () => {
  if ("serviceWorker" in navigator) {
      // Add cache-busting version parameter to service worker URL
      const swVersion = new Date().getTime(); // Use timestamp as version
      navigator.serviceWorker.register(joinPath(`service-worker.js?v=${swVersion}`))
          .then((reg) => {
              console.log("Service Worker registered:", reg.scope);
              // Check version immediately after registration
              checkVersion();
          })
          .catch((err) => console.log("Service Worker registration failed:", err));
          
      // Listen for version messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'UPDATE_AVAILABLE') {
            console.log(`Update available: ${event.data.newVersion} (current: ${event.data.currentVersion})`);
            // Tell service worker to perform the update
            navigator.serviceWorker.controller.postMessage({ type: 'PERFORM_UPDATE' });
          } else if (event.data.type === 'UPDATE_COMPLETE') {
            console.log(`Update complete to version: ${event.data.version}`);
            // Only reload if update was successful
            if (event.data.success !== false) {
              console.log("Reloading page to apply new cache");
              window.location.reload();
            }
          }
      });
      
      // Check for version updates when the page becomes visible
      document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.serviceWorker.controller) {
              checkVersion();
          }
      });
      
      // // Also check periodically for version updates
      // setInterval(() => {
      //     if (navigator.serviceWorker.controller) {
      //         checkVersion();
      //     }
      // }, 60 * 60 * 1000); // Check every hour
  }
}
    
// Check the current service worker version
function checkVersion() {
  if (!navigator.serviceWorker.controller) return;
  
  // Create a message channel for the response
  const messageChannel = new MessageChannel();
  
  // Listen for the response
  messageChannel.port1.onmessage = (event) => {
      if (event.data.currentVersion !== event.data.newVersion) {
          console.log("New version available:", event.data.newVersion);
      }
  };
  
  // Ask the service worker for its version
  navigator.serviceWorker.controller.postMessage(
      { type: 'GET_VERSION' },
      [messageChannel.port2]
  );
}