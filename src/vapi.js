export class VapiClient {
  constructor(config) {
    this.config = config;
    this.vapi = null;
    this.isCallActive = false;
    this.eventListeners = new Map();
    
    this.loadVapiSDK();
  }

  async loadVapiSDK() {
    try {
      // Load Vapi Web SDK if not already loaded
      if (typeof window.Vapi === 'undefined') {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/dist/index.js');
      }
      
      // Verify Vapi is available
      if (typeof window.Vapi === 'undefined') {
        throw new Error('Failed to load Vapi SDK');
      }
      
      // Initialize Vapi client
      this.vapi = new window.Vapi(this.config.apiKey);

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to load Vapi SDK:', error);
      throw new Error('Voice service unavailable. Please try again later.');
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      script.ontimeout = () => reject(new Error(`Script load timeout: ${src}`));
      
      // Add timeout
      setTimeout(() => {
        reject(new Error(`Script load timeout: ${src}`));
      }, 10000);
      
      document.head.appendChild(script);
    });
  }

  setupEventListeners() {
    if (!this.vapi) return;

    // Call started
    this.vapi.on('call-start', () => {
      this.isCallActive = true;
      this.emit('call-start');
    });

    // Speech started (user or assistant)
    this.vapi.on('speech-start', () => {
      this.emit('speech-start');
    });

    // Speech ended
    this.vapi.on('speech-end', () => {
      this.emit('speech-end');
    });

    // Call ended
    this.vapi.on('call-end', () => {
      this.isCallActive = false;
      this.emit('call-end');
    });

    // Error handling
    this.vapi.on('error', (error) => {
      console.error('Vapi error:', error);
      this.isCallActive = false;
      this.emit('error', error);
    });

    // Volume level (for visual feedback)
    this.vapi.on('volume-level', (level) => {
      this.emit('volume-level', level);
    });

    // Message events
    this.vapi.on('message', (message) => {
      this.emit('message', message);
    });
  }

  async start() {
    if (!this.vapi) {
      throw new Error('Vapi client not initialized');
    }

    if (this.isCallActive) {
      console.warn('Call is already active');
      return;
    }

    try {
      // Start call with configuration
      await this.vapi.start({
        // Basic call configuration
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Keep responses brief and natural for a phone conversation.'
            }
          ]
        },
        voice: {
          provider: 'azure',
          voiceId: 'andrew'
        },
        // If phoneNumber is provided, make it an outbound call
        ...(this.config.phoneNumber && {
          phoneNumber: this.config.phoneNumber
        })
      });
    } catch (error) {
      console.error('Failed to start Vapi call:', error);
      throw error;
    }
  }

  stop() {
    if (!this.vapi || !this.isCallActive) {
      return;
    }

    try {
      this.vapi.stop();
    } catch (error) {
      console.error('Failed to stop Vapi call:', error);
    }
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.eventListeners.has(event)) return;
    
    this.eventListeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  destroy() {
    if (this.vapi) {
      this.stop();
      this.vapi = null;
    }
    this.eventListeners.clear();
  }
}