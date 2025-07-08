(function(){"use strict";class r{constructor(t){this.config=t,this.vapi=null,this.isCallActive=!1,this.eventListeners=new Map,this.loadVapiSDK()}async loadVapiSDK(){try{if(typeof window.vapiSDK>"u"&&await this.loadScript("https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js"),typeof window.vapiSDK>"u")throw new Error("Failed to load Vapi SDK");this.vapi=window.vapiSDK.run({apiKey:this.config.apiKey,assistant:this.config.assistant,config:{}}),this.setupEventListeners()}catch(t){throw console.error("Failed to load Vapi SDK:",t),new Error("Voice service unavailable. Please try again later.")}}loadScript(t){return new Promise((e,i)=>{if(document.querySelector(`script[src="${t}"]`)){e();return}const s=document.createElement("script");s.src=t,s.onload=e,s.onerror=()=>i(new Error(`Failed to load script: ${t}`)),s.ontimeout=()=>i(new Error(`Script load timeout: ${t}`)),setTimeout(()=>{i(new Error(`Script load timeout: ${t}`))},1e4),document.head.appendChild(s)})}setupEventListeners(){this.vapi&&(this.vapi.on("call-start",()=>{this.isCallActive=!0,this.emit("call-start")}),this.vapi.on("speech-start",()=>{this.emit("speech-start")}),this.vapi.on("speech-end",()=>{this.emit("speech-end")}),this.vapi.on("call-end",()=>{this.isCallActive=!1,this.emit("call-end")}),this.vapi.on("error",t=>{console.error("Vapi error:",t),this.isCallActive=!1,this.emit("error",t)}),this.vapi.on("volume-level",t=>{this.emit("volume-level",t)}),this.vapi.on("message",t=>{this.emit("message",t)}))}async start(){if(!this.vapi)throw new Error("Vapi client not initialized");if(this.isCallActive){console.warn("Call is already active");return}try{await this.vapi.start()}catch(t){throw console.error("Failed to start Vapi call:",t),t}}stop(){if(!(!this.vapi||!this.isCallActive))try{this.vapi.stop()}catch(t){console.error("Failed to stop Vapi call:",t)}}on(t,e){this.eventListeners.has(t)||this.eventListeners.set(t,[]),this.eventListeners.get(t).push(e)}off(t,e){if(!this.eventListeners.has(t))return;const i=this.eventListeners.get(t),o=i.indexOf(e);o>-1&&i.splice(o,1)}emit(t,e){this.eventListeners.has(t)&&this.eventListeners.get(t).forEach(i=>{try{i(e)}catch(o){console.error(`Error in event listener for ${t}:`,o)}})}destroy(){this.vapi&&(this.stop(),this.vapi=null),this.eventListeners.clear()}}class a{constructor(t={}){this.config={apiKey:"",vapiKey:"",assistant:"",phoneNumber:"",position:"bottom-right",backgroundColor:"#FFFF00",iconColor:"#000000",mockMode:!1,...t},this.vapi=null,this.widgetElement=null,this.buttonElement=null,this.isInitialized=!1,this.currentCallState="idle",this.retryCount=0,this.maxRetries=3,this.init()}init(){if(this.isInitialized){console.warn("Buzzwald widget is already initialized");return}try{this.validateConfig(),this.checkBrowserSupport(),this.injectStyles(),this.createWidget(),this.initializeVapi(),this.isInitialized=!0}catch(t){console.error("Buzzwald: Failed to initialize widget",t),this.handleInitializationError(t)}}validateConfig(){if(!this.config.vapiKey)throw new Error("Vapi key is required");if(!this.config.assistant)throw new Error("Vapi assistant ID is required");if(typeof this.config.vapiKey!="string")throw new Error("Vapi key must be a string");if(typeof this.config.assistant!="string")throw new Error("Assistant ID must be a string");["bottom-right","bottom-left","top-right","top-left"].includes(this.config.position)||(console.warn(`Buzzwald: Invalid position "${this.config.position}". Using default "bottom-right"`),this.config.position="bottom-right"),this.config.backgroundColor&&!this.isValidColor(this.config.backgroundColor)&&(console.warn(`Buzzwald: Invalid background color "${this.config.backgroundColor}". Using default`),this.config.backgroundColor="#FFFF00"),this.config.iconColor&&!this.isValidColor(this.config.iconColor)&&(console.warn(`Buzzwald: Invalid icon color "${this.config.iconColor}". Using default`),this.config.iconColor="#000000")}isValidColor(t){const e=document.createElement("div");return e.style.color=t,e.style.color!==""}checkBrowserSupport(){if(!window.fetch)throw new Error("Browser does not support fetch API");if(!window.Promise)throw new Error("Browser does not support Promises");if(!window.addEventListener)throw new Error("Browser does not support addEventListener")}handleInitializationError(t){const e=document.createElement("div");e.className="buzzwald-widget-error",e.style.cssText=`
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
      title: "Widget failed to initialize: ${t.message}";
    `,e.innerHTML="!",e.title=`Widget failed to initialize: ${t.message}`,e.addEventListener("click",()=>{alert(`Buzzwald Widget Error:
${t.message}

Please check the console for more details.`)}),document.body.appendChild(e),this.errorWidget=e}injectStyles(){const t="buzzwald-widget-styles";if(document.getElementById(t))return;const e=document.createElement("style");e.id=t,e.textContent=`
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
    `,document.head.appendChild(e)}createWidget(){this.widgetElement=document.createElement("div"),this.widgetElement.className=`buzzwald-widget ${this.config.position}`,this.buttonElement=document.createElement("button"),this.buttonElement.className="buzzwald-button",this.buttonElement.setAttribute("aria-label","Start phone call"),this.buttonElement.innerHTML=this.getPhoneIcon(),this.buttonElement.addEventListener("click",()=>this.handleButtonClick()),this.widgetElement.appendChild(this.buttonElement),document.body.appendChild(this.widgetElement)}getPhoneIcon(){return`
      <svg class="buzzwald-phone-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>
    `}async handleButtonClick(){if(!this.vapi){console.error("Buzzwald: Vapi client not initialized"),this.showErrorMessage("Voice client not available");return}if(this.currentCallState==="connecting"||this.currentCallState==="connected"){this.vapi.stop();return}try{await this.vapi.start(),this.retryCount=0}catch(t){console.error("Buzzwald: Failed to start call",t),this.handleCallError(t)}}handleCallError(t){this.updateCallState("ended"),this.showErrorMessage(this.getUserFriendlyError(t)),this.isNetworkError(t)&&this.retryCount<this.maxRetries?(this.retryCount++,console.log(`Buzzwald: Retrying call (${this.retryCount}/${this.maxRetries})`),setTimeout(()=>{this.updateCallState("idle"),this.retryCount<this.maxRetries&&setTimeout(()=>this.handleButtonClick(),1e3)},2e3)):(this.retryCount=0,setTimeout(()=>this.updateCallState("idle"),3e3))}getUserFriendlyError(t){const e=t.message||t.toString();return e.includes("permission")||e.includes("denied")?"Please allow microphone access":e.includes("network")||e.includes("connection")?"Network error, retrying...":e.includes("api")||e.includes("key")?"Configuration error":"Call failed, please try again"}isNetworkError(t){const e=t.message||t.toString();return e.includes("network")||e.includes("connection")||e.includes("timeout")||e.includes("fetch")}showErrorMessage(t){const e=document.createElement("div");e.style.cssText=`
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
    `,e.textContent=t,document.body.appendChild(e),setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},3e3)}initializeVapi(){this.config.mockMode?this.vapi=this.createMockVapiClient():this.vapi=new r({apiKey:this.config.vapiKey,assistant:this.config.assistant,phoneNumber:this.config.phoneNumber}),this.vapi.on("call-start",()=>this.updateCallState("connecting")),this.vapi.on("speech-start",()=>this.updateCallState("connected")),this.vapi.on("call-end",()=>{this.updateCallState("ended"),setTimeout(()=>this.updateCallState("idle"),2e3)}),this.vapi.on("error",t=>{console.error("Buzzwald: Vapi error",t),this.updateCallState("ended"),setTimeout(()=>this.updateCallState("idle"),2e3)})}createMockVapiClient(){return{eventListeners:new Map,async start(){console.log("🎭 Mock: Starting Vapi call"),this.emit("call-start"),setTimeout(()=>this.emit("speech-start"),2e3),setTimeout(()=>{console.log("🎭 Mock: Auto-ending call"),this.emit("call-end")},1e4)},stop(){console.log("🎭 Mock: Stopping call"),this.emit("call-end")},on(t,e){this.eventListeners.has(t)||this.eventListeners.set(t,[]),this.eventListeners.get(t).push(e)},off(t,e){if(!this.eventListeners.has(t))return;const i=this.eventListeners.get(t),o=i.indexOf(e);o>-1&&i.splice(o,1)},emit(t,e){this.eventListeners.has(t)&&this.eventListeners.get(t).forEach(i=>{try{i(e)}catch(o){console.error(`Error in event listener for ${t}:`,o)}})},destroy(){this.eventListeners.clear()}}}updateCallState(t){switch(this.currentCallState=t,this.buttonElement.classList.remove("connecting","connected","ended"),t!=="idle"&&this.buttonElement.classList.add(t),t){case"connecting":this.buttonElement.setAttribute("aria-label","Connecting...");break;case"connected":this.buttonElement.setAttribute("aria-label","End call");break;case"ended":this.buttonElement.setAttribute("aria-label","Call ended");break;default:this.buttonElement.setAttribute("aria-label","Start phone call")}}destroy(){try{this.vapi&&(this.vapi.destroy(),this.vapi=null),this.widgetElement&&(this.widgetElement.remove(),this.widgetElement=null),this.errorWidget&&(this.errorWidget.remove(),this.errorWidget=null);const t=document.getElementById("buzzwald-widget-styles");t&&t.remove(),this.retryTimeout&&(clearTimeout(this.retryTimeout),this.retryTimeout=null),this.isInitialized=!1}catch(t){console.error("Buzzwald: Error during widget destruction",t)}}}(function(){if(window.buzzwaldWidget){console.warn("Buzzwald widget is already initialized");return}function n(){try{const t=window.BuzzwaldConfig||{};if(!t.mockMode&&!t.vapiKey){console.error("Buzzwald: vapiKey is required in window.BuzzwaldConfig");return}if(!t.mockMode&&!t.assistant){console.error("Buzzwald: assistant is required in window.BuzzwaldConfig");return}window.buzzwaldWidget=new a(t),window.buzzwaldDestroy=function(){window.buzzwaldWidget&&(window.buzzwaldWidget.destroy(),window.buzzwaldWidget=null,window.buzzwaldDestroy=null)},console.log("Buzzwald widget initialized successfully")}catch(t){console.error("Failed to initialize Buzzwald widget:",t)}}if(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",n):n(),!window.BuzzwaldConfig){let t=setInterval(()=>{window.BuzzwaldConfig&&!window.buzzwaldWidget&&(clearInterval(t),n())},100);setTimeout(()=>{clearInterval(t)},1e4)}})()})();
