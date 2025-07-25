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
      size: 'medium', // New: size option (small, medium, large, custom)
      customSize: null, // New: custom size in pixels for when size is 'custom'
      ...config
    };

    this.vapi = null;
    this.widgetElement = null;
    this.buttonElement = null;
    this.isInitialized = false;
    this.currentCallState = 'idle';
    this.retryCount = 0;
    this.maxRetries = 3;
    this.usageLimitRetryTimer = null;
    this.usageLimitRetryAttempts = 0;
    this.maxUsageLimitRetries = 10;

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
        // Preserve usage limit error properties when re-throwing
        if (err.isUsageLimit) {
          throw err; // Pass through usage limit errors without wrapping
        } else {
          throw new Error('Failed to fetch authentication token: ' + (err.message || err));
        }
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
      
      // Handle both success and error responses
      const data = await response.json().catch(() => ({}));
      
      // Check for usage limit error (402 Payment Required or error field)
      if (response.status === 402 || data.error) {
        const usageError = new Error(data.error || `Usage limit exceeded (${response.status})`);
        usageError.isUsageLimit = true;
        throw usageError;
      }
      
      // Handle other non-OK responses
      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch JWT: ${response.status}`);
      }
      
      // Success case
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

    // Validate position - now includes center
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'];
    if (!validPositions.includes(this.config.position)) {
      console.warn(`Buzzwald: Invalid position "${this.config.position}". Using default "bottom-right"`);
      this.config.position = 'bottom-right';
    }

    // Validate size
    const validSizes = ['small', 'medium', 'large', 'custom'];
    if (!validSizes.includes(this.config.size)) {
      console.warn(`Buzzwald: Invalid size "${this.config.size}". Using default "medium"`);
      this.config.size = 'medium';
    }

    // Validate custom size if size is 'custom'
    if (this.config.size === 'custom') {
      if (!this.config.customSize || typeof this.config.customSize !== 'number' || this.config.customSize < 40 || this.config.customSize > 300) {
        console.warn(`Buzzwald: Invalid custom size "${this.config.customSize}". Using default "medium"`);
        this.config.size = 'medium';
        this.config.customSize = null;
      }
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

  getButtonDimensions() {
    let buttonSize, fontSize, iconSize;
    
    switch (this.config.size) {
      case 'small':
        buttonSize = 50;
        fontSize = 20;
        iconSize = 20;
        break;
      case 'large':
        buttonSize = 80;
        fontSize = 32;
        iconSize = 32;
        break;
      case 'custom':
        buttonSize = this.config.customSize;
        fontSize = Math.round(this.config.customSize * 0.4); // 40% of button size
        iconSize = Math.round(this.config.customSize * 0.4);
        break;
      case 'medium':
      default:
        buttonSize = 60;
        fontSize = 24;
        iconSize = 24;
        break;
    }
    
    return { buttonSize, fontSize, iconSize };
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
    // Check if this is a usage limit error
    if (error.isUsageLimit || (error.message && error.message.includes('Usage limit exceeded'))) {
      this.createUsageLimitWidget(error);
    } else {
      this.createGenericErrorWidget(error);
    }
  }

  createUsageLimitWidget(error) {
    try {
      // Inject styles first
      this.injectStyles();
      
      // Create disabled widget that looks like the normal widget but is non-functional
      this.widgetElement = document.createElement('div');
      this.widgetElement.className = `buzzwald-widget ${this.config.position}`;
      
      this.buttonElement = document.createElement('button');
      this.buttonElement.className = 'buzzwald-button buzzwald-button-disabled';
      this.buttonElement.setAttribute('aria-label', 'Voice calls unavailable - limit reached');
      this.buttonElement.innerHTML = this.getPhoneIcon();
      this.buttonElement.disabled = true;
      
      // Add click handler to show usage limit message
      this.buttonElement.addEventListener('click', (e) => {
        e.preventDefault();
        this.showUsageLimitMessage(error);
      });
      
      this.widgetElement.appendChild(this.buttonElement);
      document.body.appendChild(this.widgetElement);
      
      // Show initial usage limit message
      setTimeout(() => this.showUsageLimitMessage(error), 500);
    
      // Start auto-recovery mechanism
      this.startUsageLimitRetry();
    } catch (err) {
      console.error('Error creating usage limit widget:', err);
      // Fallback to generic error widget if usage limit widget fails
      this.createGenericErrorWidget(error);
    }
  }

  startUsageLimitRetry() {
    // Clear any existing retry timer
    if (this.usageLimitRetryTimer) {
      clearInterval(this.usageLimitRetryTimer);
    }
    
    this.usageLimitRetryTimer = setInterval(async () => {
      this.usageLimitRetryAttempts++;
      
      try {
        // Try to fetch a new JWT token
        const newToken = await this.fetchJwt(this.config.id);
        
        // Stop retrying
        clearInterval(this.usageLimitRetryTimer);
        this.usageLimitRetryTimer = null;
        
        // Update config with new token
        this.config.token = newToken;
        
        // Restore the widget to functional state
        this.restoreWidget();
        
      } catch (err) {
        if (err.isUsageLimit) {
          // Stop retrying if max attempts reached
          if (this.usageLimitRetryAttempts >= this.maxUsageLimitRetries) {
            clearInterval(this.usageLimitRetryTimer);
            this.usageLimitRetryTimer = null;
          }
        } else {
          console.error('Auto-recovery failed with different error:', err);
          clearInterval(this.usageLimitRetryTimer);
          this.usageLimitRetryTimer = null;
        }
      }
    }, 30000); // Check every 30 seconds
  }

  restoreWidget() {
    try {
      // Remove existing disabled widget
      if (this.widgetElement) {
        this.widgetElement.remove();
        this.widgetElement = null;
      }
      
      // Complete the normal initialization process
      this.validateConfig();
      this.checkBrowserSupport();
      this.injectStyles();
      this.createWidget();
      this.initializeVapi();
      this.isInitialized = true;
      
      // Show success message
      this.showRestoreSuccessMessage();
    } catch (err) {
      console.error('Failed to restore widget:', err);
      // Fall back to generic error widget if restore fails
      this.createGenericErrorWidget(err);
    }
  }

  showRestoreSuccessMessage() {
    // Create success message overlay  
    const messageOverlay = document.createElement('div');
    messageOverlay.className = 'buzzwald-restore-success-message';
    
    // Position the message based on widget position
    let positionStyles = '';
    switch (this.config.position) {
      case 'bottom-right':
        positionStyles = 'bottom: 90px; right: 20px;';
        break;
      case 'bottom-left':
        positionStyles = 'bottom: 90px; left: 20px;';
        break;
      case 'top-right':
        positionStyles = 'top: 90px; right: 20px;';
        break;
      case 'top-left':
        positionStyles = 'top: 90px; left: 20px;';
        break;
      case 'center':
        positionStyles = 'top: calc(50% + 60px); left: 50%; transform: translateX(-50%);';
        break;
      default:
        positionStyles = 'bottom: 90px; right: 20px;';
    }
    
    messageOverlay.style.cssText = `
      position: fixed;
      ${positionStyles}
      background: #28a745;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      z-index: 2147483647;
      max-width: 250px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    messageOverlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">🎉 Voice Calls Restored!</div>
      <div>You can now use voice calls again.</div>
    `;
    
    document.body.appendChild(messageOverlay);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (messageOverlay.parentNode) {
        messageOverlay.parentNode.removeChild(messageOverlay);
      }
    }, 4000);
  }

  createGenericErrorWidget(error) {
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

  showUsageLimitMessage(error) {
    // Create usage limit message overlay
    const messageOverlay = document.createElement('div');
    messageOverlay.className = 'buzzwald-usage-limit-message';
    
    // Position the message based on widget position
    let positionStyles = '';
    switch (this.config.position) {
      case 'bottom-right':
        positionStyles = 'bottom: 90px; right: 20px;';
        break;
      case 'bottom-left':
        positionStyles = 'bottom: 90px; left: 20px;';
        break;
      case 'top-right':
        positionStyles = 'top: 90px; right: 20px;';
        break;
      case 'top-left':
        positionStyles = 'top: 90px; left: 20px;';
        break;
      case 'center':
        positionStyles = 'top: calc(50% + 60px); left: 50%; transform: translateX(-50%);';
        break;
      default:
        positionStyles = 'bottom: 90px; right: 20px;';
    }
    
    messageOverlay.style.cssText = `
      position: fixed;
      ${positionStyles}
      background: #ff6b35;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      z-index: 2147483647;
      max-width: 250px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: pointer;
    `;
    // Use the server's specific error message, or fallback to generic
    const errorMessage = error?.message || 'Please upgrade your plan to continue using voice calls.';
    
    messageOverlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">Voice Call Limit Reached</div>
      <div>${errorMessage}</div>
      <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">Click to dismiss</div>
    `;
    
    // Add click to dismiss
    messageOverlay.addEventListener('click', () => {
      if (messageOverlay.parentNode) {
        messageOverlay.parentNode.removeChild(messageOverlay);
      }
    });
    
    document.body.appendChild(messageOverlay);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (messageOverlay.parentNode) {
        messageOverlay.parentNode.removeChild(messageOverlay);
      }
    }, 8000);
  }

  injectStyles() {
    const styleId = 'buzzwald-widget-styles';
    if (document.getElementById(styleId)) return;

    const { buttonSize, fontSize, iconSize } = this.getButtonDimensions();

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
        width: ${buttonSize}px;
        height: ${buttonSize}px;
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
        font-size: ${fontSize}px;
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

      .buzzwald-widget.center {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
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

      .buzzwald-button-disabled {
        background-color: #cccccc !important;
        color: #666666 !important;
        cursor: not-allowed !important;
        opacity: 0.8 !important;
        display: flex !important;
        visibility: visible !important;
      }

      .buzzwald-button-disabled:hover {
        transform: none !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        background-color: #cccccc !important;
      }

      .buzzwald-button-disabled:active {
        transform: none !important;
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
        width: ${iconSize}px;
        height: ${iconSize}px;
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

        .buzzwald-widget.center {
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
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
    
    if (error.isUsageLimit || message.includes('Usage limit exceeded')) {
      // Use the server's specific message for usage limits
      return message;
    } else if (message.includes('permission') || message.includes('denied')) {
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
    
    // Position the message based on widget position
    let positionStyles = '';
    switch (this.config.position) {
      case 'bottom-right':
        positionStyles = 'bottom: 90px; right: 20px;';
        break;
      case 'bottom-left':
        positionStyles = 'bottom: 90px; left: 20px;';
        break;
      case 'top-right':
        positionStyles = 'top: 90px; right: 20px;';
        break;
      case 'top-left':
        positionStyles = 'top: 90px; left: 20px;';
        break;
      case 'center':
        positionStyles = 'top: calc(50% + 60px); left: 50%; transform: translateX(-50%);';
        break;
      default:
        positionStyles = 'bottom: 90px; right: 20px;';
    }
    
    errorMsg.style.cssText = `
      position: fixed;
      ${positionStyles}
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
          if (err.isUsageLimit) {
            this.showErrorMessage('Voice call limit reached. Please upgrade your plan.');
          } else {
            this.showErrorMessage('Session expired. Please refresh.');
          }
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
            if (err.isUsageLimit) {
              this.showErrorMessage('Voice call limit reached. Please upgrade your plan.');
            } else {
              this.showErrorMessage('Session expired. Please refresh.');
            }
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

      // Clear usage limit retry timer
      if (this.usageLimitRetryTimer) {
        clearInterval(this.usageLimitRetryTimer);
        this.usageLimitRetryTimer = null;
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