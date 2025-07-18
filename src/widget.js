import { VapiClient } from './vapi.js';

// Configuration: API endpoint from env variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const JWT_ENDPOINT = `${API_BASE_URL}/api/auth/jwt`;

export class BuzzwaldWidget {
  constructor(config = {}) {
    this.config = {
      id: '',
      token: '',
      phoneNumber: '',
      position: 'bottom-right',
      backgroundColor: '#FFFF00',
      iconColor: '#000000',
      ...config
    };

    this.vapi = null;
    this.widgetElement = null;
    this.buttonElement = null;
    this.isInitialized = false;
    this.currentCallState = 'idle';
    this.retryCount = 0;
    this.maxRetries = 3;

    this.init();
  }

  async init() {
    if (this.isInitialized) {
      console.warn('Buzzwald widget is already initialized');
      return;
    }

    try {
      await this.ensureToken();
      this.validateConfig();
      this.checkBrowserSupport();
      this.injectStyles();
      this.createWidget();
      this.initializeVapi();
      this.isInitialized = true;
    } catch (error) {
      console.error('Buzzwald: Failed to initialize widget', error);
      this.handleInitializationError(error);
    }
  }

  async ensureToken() {
    if (!this.config.token) {
      if (!this.config.id) {
        throw new Error('ID is required to fetch JWT token');
      }
      try {
        this.config.token = await this.fetchJwt(this.config.id);
      } catch (err) {
        throw new Error('Failed to fetch authentication token: ' + (err.message || err));
      }
    }
  }

  async fetchJwt(assistant_id) {
    try {
      const response = await fetch(JWT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistant_id }),
        credentials: 'include', // if you need cookies for auth, else remove
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to fetch JWT: ${response.status}`);
      }
      const data = await response.json();
      return data.token;
    } catch (err) {
      console.error('JWT fetch error:', err);
      throw err;
    }
  }

  validateConfig() {
    if (!this.config.token) {
      throw new Error('Token is required');
    }

    if (!this.config.id) {
      throw new Error('ID is required');
    }

    if (typeof this.config.token !== 'string') {
      throw new Error('Token must be a string');
    }

    if (typeof this.config.id !== 'string') {
      throw new Error('ID must be a string');
    }

    // Validate position
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    if (!validPositions.includes(this.config.position)) {
      console.warn(`Buzzwald: Invalid position "${this.config.position}". Using default "bottom-right"`);
      this.config.position = 'bottom-right';
    }

    // Validate colors
    if (this.config.backgroundColor && !this.isValidColor(this.config.backgroundColor)) {
      console.warn(`Buzzwald: Invalid background color "${this.config.backgroundColor}". Using default`);
      this.config.backgroundColor = '#FFFF00';
    }

    if (this.config.iconColor && !this.isValidColor(this.config.iconColor)) {
      console.warn(`Buzzwald: Invalid icon color "${this.config.iconColor}". Using default`);
      this.config.iconColor = '#000000';
    }
  }

  isValidColor(color) {
    const div = document.createElement('div');
    div.style.color = color;
    return div.style.color !== '';
  }

  checkBrowserSupport() {
    // Check for required browser features
    if (!window.fetch) {
      throw new Error('Browser does not support fetch API');
    }

    if (!window.Promise) {
      throw new Error('Browser does not support Promises');
    }

    if (!window.addEventListener) {
      throw new Error('Browser does not support addEventListener');
    }
  }

  handleInitializationError(error) {
    // Create a simple error widget
    const errorWidget = document.createElement('div');
    errorWidget.className = 'buzzwald-widget-error';
    errorWidget.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: #ff4444;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      z-index: 2147483647;
      cursor: pointer;
      title: "Widget failed to initialize: ${error.message}";
    `;
    errorWidget.innerHTML = '!';
    errorWidget.title = `Widget failed to initialize: ${error.message}`;
    
    // Add click handler to show error details
    errorWidget.addEventListener('click', () => {
      alert(`Buzzwald Widget Error:\n${error.message}\n\nPlease check the console for more details.`);
    });

    document.body.appendChild(errorWidget);
    
    // Store reference for cleanup
    this.errorWidget = errorWidget;
  }

  injectStyles() {
    const styleId = 'buzzwald-widget-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Buzzwald Widget Styles */
      .buzzwald-widget {
        position: fixed;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        box-sizing: border-box;
      }

      .buzzwald-widget *,
      .buzzwald-widget *::before,
      .buzzwald-widget *::after {
        box-sizing: inherit;
      }

      .buzzwald-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: none;
        background-color: ${this.config.backgroundColor};
        color: ${this.config.iconColor};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        outline: none;
        font-size: 24px;
        line-height: 1;
      }

      .buzzwald-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
      }

      .buzzwald-button:active {
        transform: scale(0.95);
      }

      .buzzwald-button:focus {
        outline: 2px solid #0066CC;
        outline-offset: 2px;
      }

      .buzzwald-widget.bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .buzzwald-widget.bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .buzzwald-widget.top-right {
        top: 20px;
        right: 20px;
      }

      .buzzwald-widget.top-left {
        top: 20px;
        left: 20px;
      }

      .buzzwald-button.connecting {
        animation: buzzwald-pulse 1.5s infinite;
      }

      .buzzwald-button.connected {
        background-color: #00AA00;
        color: #FFFFFF;
      }

      .buzzwald-button.ended {
        background-color: #FF0000;
        color: #FFFFFF;
      }

      @keyframes buzzwald-pulse {
        0% {
          transform: scale(1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        50% {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        100% {
          transform: scale(1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      }

      .buzzwald-phone-icon {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }

      @media (max-width: 768px) {
        .buzzwald-widget.bottom-right,
        .buzzwald-widget.bottom-left {
          bottom: 15px;
        }
        
        .buzzwald-widget.bottom-right {
          right: 15px;
        }
        
        .buzzwald-widget.bottom-left {
          left: 15px;
        }
        
        .buzzwald-widget.top-right {
          right: 15px;
        }
        
        .buzzwald-widget.top-left {
          left: 15px;
        }
      }

      /* Hide Vapi's default button */
      .vapi-support-btn,
      #vapi-support-btn,
      [id*="vapi"],
      [class*="vapi"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  createWidget() {
    // Create widget container
    this.widgetElement = document.createElement('div');
    this.widgetElement.className = `buzzwald-widget ${this.config.position}`;

    // Create button element
    this.buttonElement = document.createElement('button');
    this.buttonElement.className = 'buzzwald-button';
    this.buttonElement.setAttribute('aria-label', 'Start phone call');
    this.buttonElement.innerHTML = this.getPhoneIcon();

    // Add click event listener
    this.buttonElement.addEventListener('click', () => this.handleButtonClick());

    // Add widget to DOM
    this.widgetElement.appendChild(this.buttonElement);
    document.body.appendChild(this.widgetElement);

    // Hide any Vapi buttons that might appear
    this.hideVapiButtons();
  }

  hideVapiButtons() {
    // Function to hide Vapi buttons
    const hideButtons = () => {
      const vapiButtons = document.querySelectorAll('.vapi-support-btn, #vapi-support-btn, [id*="vapi"], [class*="vapi"]:not([class*="buzzwald"])');
      vapiButtons.forEach(button => {
        if (button && !button.closest('.buzzwald-widget')) {
          button.style.display = 'none';
        }
      });
    };

    // Hide immediately
    hideButtons();

    // Keep checking for new Vapi buttons
    const observer = new MutationObserver(() => {
      hideButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Store observer for cleanup
    this.vapiButtonObserver = observer;
  }

  getPhoneIcon() {
    return `
      <svg class="buzzwald-phone-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>
    `;
  }

  async handleButtonClick() {
    if (!this.vapi) {
      console.error('Buzzwald: Vapi client not initialized');
      this.showErrorMessage('Voice client not available');
      return;
    }

    if (this.currentCallState === 'connecting' || this.currentCallState === 'connected') {
      this.vapi.stop();
      return;
    }

    try {
      await this.vapi.start();
      this.retryCount = 0; // Reset retry count on successful start
    } catch (error) {
      console.error('Buzzwald: Failed to start call', error);
      this.handleCallError(error);
    }
  }


  handleCallError(error) {
    this.updateCallState('ended');
    
    // Show user-friendly error message
    this.showErrorMessage(this.getUserFriendlyError(error));
    
    // Retry logic for network errors
    if (this.isNetworkError(error) && this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Buzzwald: Retrying call (${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.updateCallState('idle');
        // Auto-retry after delay
        if (this.retryCount < this.maxRetries) {
          setTimeout(() => this.handleButtonClick(), 1000);
        }
      }, 2000);
    } else {
      this.retryCount = 0;
      setTimeout(() => this.updateCallState('idle'), 3000);
    }
  }

  getUserFriendlyError(error) {
    const message = error.message || error.toString();
    
    if (message.includes('permission') || message.includes('denied')) {
      return 'Please allow microphone access';
    } else if (message.includes('network') || message.includes('connection')) {
      return 'Network error, retrying...';
    } else if (message.includes('api') || message.includes('key')) {
      return 'Configuration error';
    } else {
      return 'Call failed, please try again';
    }
  }

  isNetworkError(error) {
    const message = error.message || error.toString();
    return message.includes('network') || 
           message.includes('connection') || 
           message.includes('timeout') ||
           message.includes('fetch');
  }

  showErrorMessage(message) {
    // Create temporary error message
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 2147483647;
      max-width: 200px;
      word-wrap: break-word;
    `;
    errorMsg.textContent = message;
    
    document.body.appendChild(errorMsg);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (errorMsg.parentNode) {
        errorMsg.parentNode.removeChild(errorMsg);
      }
    }, 3000);
  }

  initializeVapi() {
    this.vapi = new VapiClient({
      id: this.config.id,
      token: this.config.token,
      phoneNumber: this.config.phoneNumber
    });
    this.attachVapiListeners();
  }

  // Attach all Vapi event listeners in one place
  attachVapiListeners() {
    // Remove previous listeners if needed (optional, depending on your VapiClient implementation)
    // If your VapiClient supports an 'off' method, you could remove old listeners here.

    this.vapi.on('call-start', () => this.updateCallState('connecting'));
    this.vapi.on('speech-start', () => this.updateCallState('connected'));
    this.vapi.on('call-end', () => {
      this.updateCallState('ended');
      setTimeout(() => this.updateCallState('idle'), 2000);
    });
    this.vapi.on('error', async (error) => {
      console.error('Buzzwald: Vapi error', error);
      // Check for JWT expiry error from Vapi
      if (
        error &&
        error.type === 'start-method-error' &&
        error.error &&
        typeof error.error.message === 'string' &&
        error.error.message.includes('JWT has expired')
      ) {
        try {
          console.log('JWT expired, fetching new token');
          this.config.token = await this.fetchJwt(this.config.id);
          // Re-instantiate VapiClient with new token
          if (this.vapi) {
            this.vapi.destroy();
          }
          this.vapi = new VapiClient({
            id: this.config.id,
            token: this.config.token,
            phoneNumber: this.config.phoneNumber
          });
          this.attachVapiListeners();
          // Optionally, you could retry the failed action here
        } catch (err) {
          this.showErrorMessage('Session expired. Please refresh.');
        }
      }
      this.updateCallState('ended');
      setTimeout(() => this.updateCallState('idle'), 2000);
    });
    // Handle JWT expiry: listen for auth errors from VapiClient if supported
    if (typeof this.vapi.on === 'function') {
      this.vapi.on('authError', async (error) => {
        if (error && error.code === 'jwt_expired') {
          try {
            this.config.token = await this.fetchJwt(this.config.id);
            if (this.vapi) {
              this.vapi.destroy();
            }
            this.vapi = new VapiClient({
              id: this.config.id,
              token: this.config.token,
              phoneNumber: this.config.phoneNumber
            });
            this.attachVapiListeners();
          } catch (err) {
            this.showErrorMessage('Session expired. Please refresh.');
          }
        }
      });
    }
  }

  updateCallState(state) {
    this.currentCallState = state;
    
    // Remove all state classes
    this.buttonElement.classList.remove('connecting', 'connected', 'ended');
    
    // Add current state class
    if (state !== 'idle') {
      this.buttonElement.classList.add(state);
    }

    // Update button text/icon based on state
    switch (state) {
      case 'connecting':
        this.buttonElement.setAttribute('aria-label', 'Connecting...');
        break;
      case 'connected':
        this.buttonElement.setAttribute('aria-label', 'End call');
        break;
      case 'ended':
        this.buttonElement.setAttribute('aria-label', 'Call ended');
        break;
      default:
        this.buttonElement.setAttribute('aria-label', 'Start phone call');
    }
  }

  destroy() {
    try {
      if (this.vapi) {
        this.vapi.destroy();
        this.vapi = null;
      }

      if (this.widgetElement) {
        this.widgetElement.remove();
        this.widgetElement = null;
      }

      if (this.errorWidget) {
        this.errorWidget.remove();
        this.errorWidget = null;
      }

      const style = document.getElementById('buzzwald-widget-styles');
      if (style) {
        style.remove();
      }

      // Clear any pending timeouts
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }

      // Clean up mutation observer
      if (this.vapiButtonObserver) {
        this.vapiButtonObserver.disconnect();
        this.vapiButtonObserver = null;
      }

      this.isInitialized = false;
    } catch (error) {
      console.error('Buzzwald: Error during widget destruction', error);
    }
  }
}