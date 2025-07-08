import { BuzzwaldWidget } from './widget.js';

// IIFE (Immediately Invoked Function Expression) to create the widget
(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.buzzwaldWidget) {
    console.warn('Buzzwald widget is already initialized');
    return;
  }

  // Wait for DOM to be ready
  function initializeWidget() {
    try {
      // Get configuration from window.BuzzwaldConfig
      const config = window.BuzzwaldConfig || {};
      
      // Validate required configuration (unless in mock mode)
      if (!config.mockMode && !config.vapiKey) {
        console.error('Buzzwald: vapiKey is required in window.BuzzwaldConfig');
        return;
      }

      // Create and initialize widget
      window.buzzwaldWidget = new BuzzwaldWidget(config);

      // Expose destroy method for cleanup
      window.buzzwaldDestroy = function() {
        if (window.buzzwaldWidget) {
          window.buzzwaldWidget.destroy();
          window.buzzwaldWidget = null;
          window.buzzwaldDestroy = null;
        }
      };

      console.log('Buzzwald widget initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Buzzwald widget:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    // DOM is already ready
    initializeWidget();
  }

  // Also initialize if called after DOM is ready but config is set later
  if (!window.BuzzwaldConfig) {
    // Watch for config to be set
    let configCheckInterval = setInterval(() => {
      if (window.BuzzwaldConfig && !window.buzzwaldWidget) {
        clearInterval(configCheckInterval);
        initializeWidget();
      }
    }, 100);

    // Stop checking after 10 seconds
    setTimeout(() => {
      clearInterval(configCheckInterval);
    }, 10000);
  }
})();
