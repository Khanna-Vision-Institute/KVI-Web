/**
 * iGuru AI Chat Widget - Standalone Version (No Voice)
 * Universal chat widget that can be customized for any website/genre
 * 
 * Usage:
 * <script src="iguru-widget.js"></script>
 * 
 * Or with custom config:
 * <script>
 *   window.iGuruConfig = {
 *     apiUrl: 'https://your-api.com/api/guru',
 *     name: 'iGuru',
 *     primaryColor: '#4f46e5',
 *     position: 'bottom-right'
 *   };
 * </script>
 * <script src="iguru-widget.js"></script>
 */

(function() {
    // Default Configuration - Can be overridden by window.iGuruConfig
    const DEFAULT_CONFIG = {
        apiUrl: 'https://khannainstitute.com/api/guru', // Your backend API URL
        name: 'iGuru', // Widget name
        primaryColor: '#4f46e5', // Primary brand color
        secondaryColor: '#7c3aed', // Secondary/accent color
        position: 'bottom-right', // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
        widgetSize: { width: 400, height: 600 },
        welcomeMessage: "Hi! I'm iGuru, your AI assistant. How can I help you today?",
        placeholder: "Type your message...",
        enableVoice: false, // No voice features
        botAvatar: '🤖', // Bot emoji/icon
        userAvatar: '👤' // User emoji/icon
    };

    // Merge with custom config if provided
    const CONFIG = Object.assign({}, DEFAULT_CONFIG, window.iGuruConfig || {});

    // Create and inject CSS
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .iguru-widget {
                position: fixed;
                z-index: 9999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .iguru-widget.bottom-right {
                bottom: 20px;
                right: 20px;
            }

            .iguru-widget.bottom-left {
                bottom: 20px;
                left: 20px;
            }

            .iguru-widget.top-right {
                top: 20px;
                right: 20px;
            }

            .iguru-widget.top-left {
                top: 20px;
                left: 20px;
            }

            .iguru-toggle {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${CONFIG.primaryColor}, ${CONFIG.secondaryColor});
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
                color: white;
                font-size: 24px;
                padding: 0;
            }

            .iguru-toggle:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 20px rgba(0,0,0,0.2);
            }

            .iguru-container {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: ${CONFIG.widgetSize.width}px;
                height: ${CONFIG.widgetSize.height}px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.15);
                display: none;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                transform: translateY(20px) scale(0.95);
                transition: all 0.3s ease;
            }

            .iguru-container.open {
                display: flex;
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            .iguru-header {
                background: linear-gradient(135deg, ${CONFIG.primaryColor}, ${CONFIG.secondaryColor});
                color: white;
                padding: 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-radius: 20px 20px 0 0;
            }

            .iguru-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }

            .iguru-close {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transition: all 0.2s;
            }

            .iguru-close:hover {
                background: rgba(255,255,255,0.3);
            }

            .iguru-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f9fafb;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .iguru-message {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .iguru-message.user {
                flex-direction: row-reverse;
            }

            .iguru-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                flex-shrink: 0;
            }

            .iguru-message.bot .iguru-avatar {
                background: ${CONFIG.primaryColor}20;
            }

            .iguru-message.user .iguru-avatar {
                background: ${CONFIG.secondaryColor}20;
            }

            .iguru-bubble {
                max-width: 75%;
                padding: 12px 16px;
                border-radius: 18px;
                word-wrap: break-word;
                line-height: 1.5;
            }

            .iguru-message.bot .iguru-bubble {
                background: white;
                color: #1f2937;
                border: 1px solid #e5e7eb;
            }

            .iguru-message.user .iguru-bubble {
                background: linear-gradient(135deg, ${CONFIG.primaryColor}, ${CONFIG.secondaryColor});
                color: white;
            }

            .iguru-input-container {
                padding: 16px;
                background: white;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .iguru-input {
                flex: 1;
                border: 1px solid #e5e7eb;
                border-radius: 24px;
                padding: 12px 16px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }

            .iguru-input:focus {
                border-color: ${CONFIG.primaryColor};
            }

            .iguru-send {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${CONFIG.primaryColor}, ${CONFIG.secondaryColor});
                border: none;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                font-size: 18px;
            }

            .iguru-send:hover {
                transform: scale(1.05);
            }

            .iguru-send:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .iguru-typing {
                display: flex;
                gap: 4px;
                padding: 12px 16px;
            }

            .iguru-typing span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${CONFIG.primaryColor};
                animation: typing 1.4s infinite;
            }

            .iguru-typing span:nth-child(2) {
                animation-delay: 0.2s;
            }

            .iguru-typing span:nth-child(3) {
                animation-delay: 0.4s;
            }

            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                    opacity: 0.7;
                }
                30% {
                    transform: translateY(-10px);
                    opacity: 1;
                }
            }

            .iguru-error {
                background: #fee2e2;
                color: #991b1b;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                margin: 8px 0;
            }
        `;
        document.head.appendChild(style);
    }

    // Create widget HTML
    function createWidget() {
        const widget = document.createElement('div');
        widget.className = `iguru-widget ${CONFIG.position}`;
        widget.innerHTML = `
            <div class="iguru-container" id="iguruContainer">
                <div class="iguru-header">
                    <h3>${CONFIG.name}</h3>
                    <button class="iguru-close" id="iguruClose">×</button>
                </div>
                <div class="iguru-messages" id="iguruMessages"></div>
                <div class="iguru-input-container">
                    <input 
                        type="text" 
                        class="iguru-input" 
                        id="iguruInput" 
                        placeholder="${CONFIG.placeholder}"
                    />
                    <button class="iguru-send" id="iguruSend">➤</button>
                </div>
            </div>
            <button class="iguru-toggle" id="iguruToggle">${CONFIG.botAvatar}</button>
        `;
        document.body.appendChild(widget);
        return widget;
    }

    // Initialize widget
    function init() {
        // Inject styles
        injectStyles();

        // Create widget
        const widget = createWidget();

        // Get elements
        const toggle = document.getElementById('iguruToggle');
        const container = document.getElementById('iguruContainer');
        const close = document.getElementById('iguruClose');
        const input = document.getElementById('iguruInput');
        const send = document.getElementById('iguruSend');
        const messages = document.getElementById('iguruMessages');

        // State
        let isOpen = false;
        let conversationHistory = [];

        // Add welcome message
        function addWelcomeMessage() {
            addMessage(CONFIG.welcomeMessage, 'bot');
        }

        // Add message to chat
        function addMessage(text, type = 'user') {
            const messageDiv = document.createElement('div');
            messageDiv.className = `iguru-message ${type}`;
            
            const avatar = document.createElement('div');
            avatar.className = 'iguru-avatar';
            avatar.textContent = type === 'bot' ? CONFIG.botAvatar : CONFIG.userAvatar;
            
            const bubble = document.createElement('div');
            bubble.className = 'iguru-bubble';
            bubble.textContent = text;
            
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(bubble);
            messages.appendChild(messageDiv);
            
            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;
            
            return messageDiv;
        }

        // Show typing indicator
        function showTyping() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'iguru-message bot';
            typingDiv.id = 'iguruTyping';
            
            const avatar = document.createElement('div');
            avatar.className = 'iguru-avatar';
            avatar.textContent = CONFIG.botAvatar;
            
            const typing = document.createElement('div');
            typing.className = 'iguru-typing';
            typing.innerHTML = '<span></span><span></span><span></span>';
            
            typingDiv.appendChild(avatar);
            typingDiv.appendChild(typing);
            messages.appendChild(typingDiv);
            messages.scrollTop = messages.scrollHeight;
        }

        // Hide typing indicator
        function hideTyping() {
            const typing = document.getElementById('iguruTyping');
            if (typing) {
                typing.remove();
            }
        }

        // Show error message
        function showError(message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'iguru-error';
            errorDiv.textContent = message;
            messages.appendChild(errorDiv);
            messages.scrollTop = messages.scrollHeight;
            
            // Remove after 5 seconds
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }

        // Send message to API
        async function sendMessage(text) {
            try {
                showTyping();
                
                // Use /ask endpoint (not /vapi/webhook)
                const response = await fetch(`${CONFIG.apiUrl}/ask`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: text,
                        top_k: 5
                    })
                });

                hideTyping();

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                
                // Add bot response
                if (data.answer) {
                    addMessage(data.answer, 'bot');
                } else {
                    showError('Sorry, I couldn\'t generate a response. Please try again.');
                }

            } catch (error) {
                hideTyping();
                console.error('iGuru API Error:', error);
                showError('Sorry, there was an error. Please try again.');
            }
        }

        // Handle send
        function handleSend() {
            const text = input.value.trim();
            if (!text) return;

            // Add user message
            addMessage(text, 'user');
            conversationHistory.push({ role: 'user', content: text });

            // Clear input
            input.value = '';

            // Send to API
            sendMessage(text);
        }

        // Toggle widget
        toggle.addEventListener('click', () => {
            isOpen = !isOpen;
            if (isOpen) {
                container.classList.add('open');
                input.focus();
                if (messages.children.length === 0) {
                    addWelcomeMessage();
                }
            } else {
                container.classList.remove('open');
            }
        });

        // Close widget
        close.addEventListener('click', () => {
            isOpen = false;
            container.classList.remove('open');
        });

        // Send on Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSend();
            }
        });

        // Send button
        send.addEventListener('click', handleSend);

        // Close on outside click (optional)
        document.addEventListener('click', (e) => {
            if (isOpen && !widget.contains(e.target)) {
                // Uncomment to close on outside click
                // isOpen = false;
                // container.classList.remove('open');
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

