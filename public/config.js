/**
 * Configuration settings for DumbAssets
 * Contains site settings and constants
 */

// Site title configuration from environment variable or default
const SITE_TITLE = 'DumbAssets';

// Cookie helper functions
function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Strict";
}

function getCookie(name) {
  const cookieName = name + "=";
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.indexOf(cookieName) === 0) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }
  return "";
}

// Update page title and site title elements
document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.getElementById('pageTitle');
  const siteTitle = document.getElementById('siteTitle');
  
  if (pageTitle) pageTitle.textContent = SITE_TITLE;
  if (siteTitle) siteTitle.textContent = SITE_TITLE;
  
  // Theme management
  initTheme();
});

// Initialize theme based on cookie or system preference
function initTheme() {
  const savedTheme = getCookie('theme');
  const prefersDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const prefersDark = prefersDarkMedia.matches;
  
  // Set initial theme
  if (savedTheme) {
    // User has explicitly chosen a theme
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    // Use system preference
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
  
  // Listen for system preference changes
  prefersDarkMedia.addEventListener('change', (e) => {
    // Only update theme automatically if user hasn't set a preference
    if (!getCookie('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  });
  
  // Set up theme toggle button event listener
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}

// Toggle between light and dark themes
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  setCookie('theme', newTheme);
} 