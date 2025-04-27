/**
 * Configuration settings for DumbAssets
 * Contains site settings and constants
 */

// Site title configuration from environment variable or default
const SITE_TITLE = 'DumbAssets';

// Update page title and site title elements
document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.getElementById('pageTitle');
  const siteTitle = document.getElementById('siteTitle');
  
  if (pageTitle) pageTitle.textContent = SITE_TITLE;
  if (siteTitle) siteTitle.textContent = SITE_TITLE;
  
  // Theme management
  initTheme();
});

// Initialize theme based on localStorage or system preference
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (prefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  
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
  localStorage.setItem('theme', newTheme);
} 