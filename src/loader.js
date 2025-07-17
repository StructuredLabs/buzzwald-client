/**
 * Buzzwald Widget Loader
 * This script handles cache-busting by dynamically loading the latest widget version
 */
(function() {
  'use strict';

  // Prevent multiple loader initializations
  if (window.BuzzwaldLoader) {
    console.warn('Buzzwald loader already initialized');
    return;
  }

  // Mark loader as initialized
  window.BuzzwaldLoader = true;

  // Configuration
  const GITHUB_REPO = 'StructuredLabs/buzzwald-client';
  const CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_REPO;
  const VERSION_CHECK_URL = CDN_BASE + '@latest/dist/version.json';
  const FALLBACK_SCRIPT_URL = CDN_BASE + '@latest/dist/buzzwald-widget.js';
  
  // Cache settings
  const VERSION_CACHE_KEY = 'buzzwald_widget_version';
  const VERSION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const SCRIPT_CACHE_KEY = 'buzzwald_widget_script';
  const SCRIPT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /**
   * Get cached data with expiration check
   */
  function getCachedData(key, maxAge) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp > maxAge) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data.value;
    } catch (e) {
      return null;
    }
  }

  /**
   * Cache data with timestamp
   */
  function setCachedData(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify({
        value: value,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  /**
   * Fetch with timeout and error handling
   */
  function fetchWithTimeout(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Request timeout'));
      }, timeout);

      fetch(url, { 
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response;
      })
      .then(resolve)
      .catch(reject);
    });
  }

  /**
   * Get the latest version information
   */
  async function getLatestVersion() {
    // Check cache first
    const cachedVersion = getCachedData(VERSION_CACHE_KEY, VERSION_CACHE_DURATION);
    if (cachedVersion) {
      return cachedVersion;
    }

    try {
      const response = await fetchWithTimeout(VERSION_CHECK_URL);
      const versionData = await response.json();
      
      // Cache the version data
      setCachedData(VERSION_CACHE_KEY, versionData);
      
      return versionData;
    } catch (error) {
      console.warn('Failed to fetch version info:', error);
      return null;
    }
  }

  /**
   * Load the widget script with cache busting
   */
  function loadWidgetScript(scriptUrl) {
    return new Promise((resolve, reject) => {
      // Check if script is already loading or loaded
      const existingScript = document.querySelector('script[data-buzzwald-widget]');
      if (existingScript) {
        if (existingScript.dataset.loaded === 'true') {
          resolve();
          return;
        }
        // Script is loading, wait for it
        existingScript.addEventListener('load', resolve);
        existingScript.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.type = 'text/javascript';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.buzzwaldWidget = 'true';
      
      script.onload = function() {
        script.dataset.loaded = 'true';
        resolve();
      };
      
      script.onerror = function() {
        reject(new Error('Failed to load widget script'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialize the widget loader
   */
  async function initializeLoader() {
    try {
      // Get version info
      const versionData = await getLatestVersion();
      
      let scriptUrl;
      if (versionData && versionData.version && versionData.timestamp) {
        // Use versioned URL with timestamp for cache busting
        scriptUrl = `${CDN_BASE}@latest/dist/buzzwald-widget.js?v=${versionData.version}&t=${versionData.timestamp}`;
      } else {
        // Fallback to simple cache busting with current timestamp
        scriptUrl = `${FALLBACK_SCRIPT_URL}?t=${Date.now()}`;
      }

      // Load the widget script
      await loadWidgetScript(scriptUrl);
      
      console.log('Buzzwald widget loaded successfully');
    } catch (error) {
      console.error('Failed to load Buzzwald widget:', error);
      
      // Try fallback URL
      try {
        await loadWidgetScript(`${FALLBACK_SCRIPT_URL}?t=${Date.now()}`);
        console.log('Buzzwald widget loaded with fallback');
      } catch (fallbackError) {
        console.error('Fallback widget load also failed:', fallbackError);
        
        // Show error to user if configured
        if (window.BuzzwaldConfig && window.BuzzwaldConfig.onError) {
          window.BuzzwaldConfig.onError('Failed to load widget');
        }
      }
    }
  }

  /**
   * Wait for DOM to be ready
   */
  function waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Main loader function
   */
  async function main() {
    await waitForDOM();
    
    // Small delay to ensure config is set
    setTimeout(initializeLoader, 100);
    
    // Also watch for config changes
    let configCheckInterval;
    if (!window.BuzzwaldConfig) {
      configCheckInterval = setInterval(() => {
        if (window.BuzzwaldConfig) {
          clearInterval(configCheckInterval);
          initializeLoader();
        }
      }, 100);
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        if (configCheckInterval) {
          clearInterval(configCheckInterval);
        }
      }, 10000);
    }
  }

  // Start the loader
  main().catch(console.error);

})();