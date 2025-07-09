import Vapi from '@vapi-ai/web';

export class VapiClient {
  constructor(config) {
    this.config = config;
    this.vapi = null;
    this.isCallActive = false;
    this.eventListeners = new Map();
    this.initVapi();
  }

  initVapi() {
    this.vapi = new Vapi(this.config.apiKey);
    this.setupEventListeners();
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
      // Start call using Vapi SDK with assistant ID
      await this.vapi.start(this.config.assistant);
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