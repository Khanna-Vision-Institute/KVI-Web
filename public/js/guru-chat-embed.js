/**
 * Guru AI Chat Widget Embed Script
 * Include this script on your website to add the Guru AI chat widget.
 *
 * Page-aware agent + openers: URL/title triggers (PAGE_CHAT_RULES) pick agent + launcher/welcome prompts.
 * Optional override on any template:
 *   <body data-kvi-chat-agent="buffet" data-kvi-chat-openers='["Question 1","Question 2"]'>
 */

(function () {
    // Agent profiles — image, name, colors, role tag
    const AGENTS = {
        brandi: {
            name: 'Brandi',
            role: 'Your KVI Concierge',
            image: 'https://i.ibb.co/dnv2y3n/brandi.jpg',
            primary: '#b45309',
            secondary: '#d97706',
        },
        guru: {
            name: 'Guru',
            role: 'SMILE & EVO ICL Specialist',
            image: 'https://khanna-media-bucket.s3.us-east-1.amazonaws.com/Guru_AI.png',
            primary: '#4f46e5',
            secondary: '#7c3aed',
            objectFit: 'contain',
        },
        max: {
            name: 'Max',
            role: 'Vision Advisor',
            image: 'https://i.ibb.co/zTrvsCRz/PHOTO-2026-05-10-03-39-53.jpg',
            primary: '#0369a1',
            secondary: '#0891b2',
        },
        lucy: {
            name: 'Lucy',
            role: 'Vision Specialist',
            image: 'https://i.ibb.co/C3cgJWqX/PHOTO-2026-05-10-03-30-03.jpg',
            primary: '#047857',
            secondary: '#059669',
        },
        rose: {
            name: 'Rose',
            role: 'Senior Vision Guide',
            image: 'https://i.ibb.co/sJyQdsZV/PHOTO-2026-05-10-03-45-05.jpg',
            primary: '#be185d',
            secondary: '#db2777',
        },
        kate: {
            name: 'Kate',
            role: 'Cornea Specialist',
            image: 'https://i.ibb.co/TMZYDf9H/PHOTO-2026-05-10-03-50-50.jpg',
            primary: '#6d28d9',
            secondary: '#7c3aed',
        },
        sage: {
            name: 'Sage',
            role: 'Post-Op Concierge',
            image: 'https://i.ibb.co/ccyhQ7Wh/PHOTO-2026-05-10-04-01-23.jpg',
            primary: '#166534',
            secondary: '#15803d',
        },
        buffet: {
            name: 'Buffett',
            role: 'Financing Specialist',
            image: 'https://i.ibb.co/FbsM35Jv/PHOTO-2026-05-10-03-53-30.jpg',
            primary: '#1e3a8a',
            secondary: '#1d4ed8',
        },
        barbie: {
            name: 'Barbie',
            role: 'Provider Relations',
            image: 'https://i.ibb.co/MkhMF3Kw/PHOTO-2026-05-10-03-56-06.jpg',
            primary: '#1e40af',
            secondary: '#2563eb',
        },
        jill: {
            name: 'Jill',
            role: 'Patient Coordinator',
            image: 'https://khanna-media-bucket.s3.us-east-1.amazonaws.com/Guru_AI.png',
            primary: '#374151',
            secondary: '#4b5563',
            objectFit: 'contain',
        },
    };

    // Configuration
    const CONFIG = {
        apiUrl: '/api/guru', // Use relative URL through live server proxy
        primaryColor: '#b45309',
        secondaryColor: '#d97706',
        position: 'bottom-right', // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
        widgetSize: { width: 400, height: 600 },
        /** Curated openers JSON (Openers.html export) — used when no page-specific rule matches */
        openersUrl: '/api/kvi-chat-openers.json',
        voiceConfigUrl: '/api/kvi-voice/config',
        vapiSdkUrl: '/public/js/vendor/vapi-web.bundle.js',
    };

    /**
     * URL → default agent + topic openers for launcher bubble & welcome chips.
     * Order matters (first win). Uses location.pathname (+ optional query in match).
     * Override from HTML: <body data-kvi-chat-agent="buffet" data-kvi-chat-openers='["Q1","Q2"]'>
     */
    const PAGE_CHAT_RULES = [
        {
            agent: 'buffet',
            match: /financ|payment|pricing|\/cost\b|investment\b|monthly-pay|payment-plan|fee-quotes|\$0\b|apr\b|insurance-options|carecredit/i,
            openers: [
                'Hi — I specialize in fitting vision correction into real budgets. Are you leaning toward financing, weighing total cost vs. yearly contacts, or both?',
                'Want a simple breakdown of typical monthly-payment ranges (without any pressure)? I can outline how people usually compare options.',
                'Many patients ask whether vision correction is taxable/FSA/HSA-eligible — is that something you\'d like clarity on?',
                'If you\'d rather talk numbers privately, tell me whether you\'re planning LASIK-family surgery, lenses (ICL/PIE), or still deciding.',
            ],
        },
        {
            agent: 'sage',
            match: /post-?op|after-?care|recovery|healing|follow-?up|drops|appointment-after|day-after-surgery/i,
            openers: [
                'I\'m Sage — post-op questions are normal. Are you noticing fluctuating vision, light sensitivity, or something that feels urgent?',
                'If you\'re freshly post-op: are you asking about medications, shower/makeup timelines, exercise, or when to expect crisp vision?',
                'Tell me how many days you are out from surgery and which procedure — I can point you toward the safest next step (including calling the office if urgent).',
                'Need help interpreting instructions from your paperwork or portal? Paste the gist and I\'ll translate it.',
            ],
        },
        {
            agent: 'barbie',
            match: /referr|refer-a-patient|provider-relations|\bmdm\b|\bpto\b/i,
            openers: [
                'Hello — coordinating referrals is what I\'m here for. Are you a referring doctor\'s office, or helping a patient get records sent over?',
                'Do you need our fax/secure line, referral forms, post-op summaries, or help scheduling?',
                'If you tell me urgency (today vs routine) and what specialty you\'re coordinating, I\'ll streamline the next step.',
            ],
        },
        {
            agent: 'kate',
            match: /cornea|\b topography\b|\bthin cornea\b|cross-?link|\bkeratocon/i,
            openers: [
                'Kate here — thin corneas, topography quirks, or "not a candidate on paper?" That\'s exactly what I troubleshoot.',
                'Are you navigating complex measurements (topography/tomography), or trying to reconcile two different clinic opinions?',
                'If LASIK\'s unclear for you: do you want a plain-language read on implantable lenses vs surface-based options?',
            ],
        },
        {
            agent: 'guru',
            match: /smile-laser|zed-smile|\/smile[\/\-]/i,
            openers: [
                'Guru here — SMILE is the flap-free route a lot of active patients prefer. Want the quick overview of downtime vs LASIK?',
                'If SMILE fits your prescription and lifestyle goals, many people care most about dryness risk and workout timelines — where should we start?',
                'Curious if you\'re a reasonable SMILE candidate (high-level, non-medical triage)? Tell me roughly your age range and dependence on correction.',
                'Prefer "what it feels like day-of" vs technical talk? Pick one and I\'ll match your style.',
            ],
        },
        {
            agent: 'guru',
            match: /evo-icl|evo icl|\/icl\b|implantable lens|phakic/i,
            openers: [
                'Guru here — EVO ICL is a reversible lens path that\'s popular for strong prescriptions. Are you exploring it because of cornea thickness, high RX, or keeping options open?',
                'Many people compare EVO ICL vs laser on recovery and reversibility — which comparison matters most to you?',
                'Want a simple candidacy checklist (non-diagnostic) before you book a consult?',
                'Are you also comparing ICL vs another lens-based option (like PIE) for over-40 needs?',
            ],
        },
        {
            agent: 'max',
            match: /lasik|superlasik|all-laser|wavefront-lasik/i,
            openers: [
                'Max here — LASIK is the classic all-laser path with a long track record. Are you most concerned about safety, night vision, or recovery speed?',
                'If you\'re deciding vs SMILE: do you want a plain-English tradeoff summary for your lifestyle (sports, screens, travel)?',
                'Want help understanding what "candidate" usually means before you invest time in a consult?',
                'Are you comparing pricing/financing paths for LASIK specifically, or procedure choice first?',
            ],
        },
        {
            agent: 'rose',
            match: /pie\b|presbyopic|reading-glasses|over-40|midlife-vision|trifocal|multifocal-lens|cataract/i,
            openers: [
                'Rose here — if you\'re fighting readers or menu blur, you\'re not alone. Are you trying to fix near, distance, or both?',
                'Many people compare PIE-style premium lenses vs glasses/contacts for the 40+ chapter — what\'s your biggest daily annoyance?',
                'If cataracts are on your mind: are you early-stage curious, or already told you\'re close to surgical timing?',
                'Want a calm explainer of how premium lens options differ (without sales-y jargon)?',
            ],
        },
        {
            agent: 'lucy',
            match: /gen-?x|working-professional|screen-fatigue|dry-eye-basics|office-workers/i,
            openers: [
                'Lucy here — if screens, night driving, or contact-lens fatigue brought you in, tell me which is loudest for you.',
                'Are you mostly trying to reduce dependence on contacts, or improve comfort while you keep wearing them?',
                'Want a practical read on which modern options people your age tend to shortlist first?',
            ],
        },
    ];

    /** If <body data-kvi-chat-agent> is set without openers JSON */
    const AGENT_GENERIC_OPENERS = {
        guru: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'guru'; }).openers,
        max: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'max'; }).openers,
        buffet: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'buffet'; }).openers,
        rose: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'rose'; }).openers,
        sage: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'sage'; }).openers,
        barbie: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'barbie'; }).openers,
        kate: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'kate'; }).openers,
        lucy: PAGE_CHAT_RULES.find(function (r) { return r.agent === 'lucy'; }).openers,
    };

    function resolvePageChatContext() {
        const path = (typeof location !== 'undefined' && location.pathname ? location.pathname : '').toLowerCase();
        const q = (typeof location !== 'undefined' && location.search ? location.search : '').toLowerCase();
        const title = (typeof document !== 'undefined' && document.title ? document.title : '').toLowerCase();
        const combined = path + ' ' + q + ' ' + title;
        const body = typeof document !== 'undefined' ? document.body : null;
        if (body && body.dataset && body.dataset.kviChatAgent) {
            const agentKey = String(body.dataset.kviChatAgent).trim().toLowerCase();
            if (AGENTS[agentKey]) {
                let parsed = null;
                if (body.dataset.kviChatOpeners) {
                    try {
                        parsed = JSON.parse(body.dataset.kviChatOpeners);
                    } catch (e) { /* ignore */ }
                }
                const custom = Array.isArray(parsed)
                    ? parsed.map(String).map(function (s) { return s.trim(); }).filter(Boolean)
                    : [];
                const fallback = AGENT_GENERIC_OPENERS[agentKey] || null;
                return {
                    agent: agentKey,
                    pageOpeners: custom.length ? custom : (fallback && fallback.length ? fallback.slice() : null),
                };
            }
        }
        for (let i = 0; i < PAGE_CHAT_RULES.length; i++) {
            const rule = PAGE_CHAT_RULES[i];
            if (rule.match.test(combined)) {
                return { agent: rule.agent, pageOpeners: rule.openers.slice() };
            }
        }
        return { agent: 'brandi', pageOpeners: null };
    }

    /** Filled from JSON; fallback stays minimal if fetch fails */
    let OPENERS_CACHE = [];

    function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    async function loadOpenersFromFile() {
        try {
            const res = await fetch(CONFIG.openersUrl, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('openers HTTP ' + res.status);
            const data = await res.json();
            const list = data && Array.isArray(data.openers) ? data.openers : [];
            const cleaned = list
                .map((s) => (typeof s === 'string' ? s.trim() : ''))
                .filter(Boolean);
            OPENERS_CACHE = cleaned.length ? cleaned : OPENERS_CACHE;
        } catch (e) {
            console.warn('[Guru chat] Could not load openers JSON:', e && e.message);
        }
        if (!OPENERS_CACHE.length) {
            OPENERS_CACHE = [
                'Welcome to Khanna Vision Institute. What would you love to improve most today?',
            ];
        }
        return OPENERS_CACHE;
    }

    // Create and inject CSS
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

            /* ── Design tokens ── */
            .guru-chat-widget {
                --glass-bg:          rgba(255,255,255,0.6);
                --glass-border:      rgba(255,255,255,0.8);
                --shadow-color:      rgba(15,60,90,0.18);
                --bot-bubble-bg:     rgba(255,255,255,0.88);
                --bot-bubble-border: rgba(200,225,240,0.6);
                --text-primary:      #0d2233;
                --text-secondary:    #456070;
                --text-muted:        #8aabb8;
                --input-bg:          rgba(240,248,252,0.85);
                --focus-glow:        rgba(26,107,138,0.3);
                --font-display:      'DM Serif Display', Georgia, serif;
                --font-body:         'DM Sans', system-ui, sans-serif;
                --ease-spring:       cubic-bezier(0.34,1.25,0.64,1);
                position: fixed;
                z-index: 9999;
                font-family: var(--font-body);
            }

            .guru-chat-widget.bottom-right { bottom: 20px; right: 20px; }
            .guru-chat-widget.bottom-left  { bottom: 20px; left: 20px; }
            .guru-chat-widget.top-right    { top: 20px; right: 20px; }
            .guru-chat-widget.top-left     { top: 20px; left: 20px; }

            /* ══ LAUNCHER ══ */
            .guru-chat-toggle {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--agent-primary,#b45309), var(--agent-secondary,#d97706));
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                overflow: hidden;
                box-shadow:
                    0 8px 28px rgba(0,0,0,0.22),
                    0 0 0 4px rgba(255,255,255,0.18),
                    inset 0 1px 0 rgba(255,255,255,0.25);
                transition: all 0.32s var(--ease-spring);
                animation: guruPulse 3.2s ease-in-out infinite;
            }

            @keyframes guruPulse {
                0%,100% { box-shadow: 0 8px 28px rgba(0,0,0,0.22), 0 0 0 0 rgba(180,83,9,0); }
                50%     { box-shadow: 0 8px 28px rgba(0,0,0,0.22), 0 0 0 10px rgba(180,83,9,0.12); }
            }

            .guru-chat-toggle img {
                width: 58px;
                height: 58px;
                border-radius: 50%;
                object-fit: cover;
                object-position: top center;
                transition: transform 0.32s var(--ease-spring), opacity 0.28s ease;
            }

            .guru-chat-toggle:hover {
                transform: scale(1.08) translateY(-2px);
                animation: none;
                box-shadow:
                    0 14px 36px rgba(0,0,0,0.28),
                    0 0 0 5px rgba(255,255,255,0.22),
                    inset 0 1px 0 rgba(255,255,255,0.3);
            }
            .guru-chat-toggle:hover img { transform: scale(1.06); }
            .guru-chat-toggle:active    { transform: scale(0.97); }

            /* ══ CHAT CONTAINER — glassmorphism ══ */
            .guru-chat-container {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: ${CONFIG.widgetSize.width}px;
                height: ${CONFIG.widgetSize.height}px;
                border-radius: 24px;
                display: none;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transform: translateY(18px) scale(0.94);
                transform-origin: bottom right;
                transition: opacity 0.28s ease, transform 0.32s var(--ease-spring);
                background: var(--glass-bg);
                backdrop-filter: blur(24px) saturate(180%);
                -webkit-backdrop-filter: blur(24px) saturate(180%);
                border: 1.5px solid var(--glass-border);
                box-shadow:
                    0 32px 72px var(--shadow-color),
                    0 10px 28px rgba(0,0,0,0.07),
                    inset 0 1px 0 rgba(255,255,255,0.9);
            }

            .guru-chat-container.open {
                display: flex;
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0) scale(1);
            }

            /* Input always fully interactive when chat is open */
            .guru-chat-container.open input,
            .guru-chat-container.open button {
                pointer-events: auto !important;
            }

            /* ══ HEADER ══ */
            .guru-chat-header {
                position: relative;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 16px 14px 16px 18px;
                overflow: hidden;
                flex-shrink: 0;
                background: linear-gradient(
                    135deg,
                    var(--agent-primary,#b45309) 0%,
                    var(--agent-secondary,#d97706) 60%,
                    color-mix(in srgb, var(--agent-primary,#b45309) 65%, #000) 100%
                );
                transition: background 0.5s ease;
            }

            /* shimmer sweep */
            .guru-chat-header::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.13) 50%, transparent 80%);
                background-size: 200% 100%;
                animation: guruShimmer 3.8s ease-in-out infinite;
                pointer-events: none;
            }

            @keyframes guruShimmer {
                0%   { background-position: -100% 0; }
                60%  { background-position:  200% 0; }
                100% { background-position:  200% 0; }
            }

            .guru-header-content {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
                min-width: 0;
            }

            .guru-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
                position: relative;
                z-index: 2;
            }

            .guru-header-avatar-wrap {
                position: relative;
                flex-shrink: 0;
            }

            .guru-header-image {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,0.6);
                object-fit: cover;
                object-position: top center;
                box-shadow: 0 4px 14px rgba(0,0,0,0.25), 0 0 0 3px rgba(255,255,255,0.12);
                transition: opacity 0.28s ease, transform 0.28s ease;
                background: rgba(255,255,255,0.15);
            }
            .guru-header-image:hover { transform: scale(1.06); }

            .guru-header-online {
                position: absolute;
                bottom: 1px;
                right: 1px;
                width: 11px;
                height: 11px;
                background: #6effa0;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 0 6px #6effa0;
                animation: guruBlink 2.4s ease-in-out infinite;
            }

            @keyframes guruBlink {
                0%,100% { opacity: 1; }
                50%     { opacity: 0.45; }
            }

            .guru-header-text {
                text-align: left;
                flex: 1;
                min-width: 0;
            }

            .guru-header-text h2 {
                margin: 0 0 2px 0;
                font-family: var(--font-display);
                font-size: 17px;
                font-weight: 400;
                font-style: italic;
                letter-spacing: 0.02em;
                color: #fff;
                text-shadow: 0 1px 4px rgba(0,0,0,0.2);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .guru-header-role {
                margin: 0;
                font-family: var(--font-body);
                font-size: 10.5px;
                font-weight: 500;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                color: rgba(255,255,255,0.72);
            }

            .guru-header-handoff {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: rgba(255,255,255,0.18);
                backdrop-filter: blur(6px);
                border-radius: 20px;
                padding: 2px 9px;
                font-size: 10px;
                font-weight: 600;
                margin-top: 4px;
                letter-spacing: 0.04em;
                color: white;
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            .guru-header-handoff.show { opacity: 1; }

            .guru-chat-close {
                position: static;
                flex-shrink: 0;
                background: rgba(255,255,255,0.16);
                border: 1px solid rgba(255,255,255,0.28);
                color: rgba(255,255,255,0.92);
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                transition: all 0.22s ease;
                backdrop-filter: blur(4px);
                line-height: 1;
            }
            .guru-chat-close:hover {
                background: rgba(255,255,255,0.3);
                border-color: rgba(255,255,255,0.5);
                transform: scale(1.08) rotate(90deg);
            }
            #guruTalkButton {
                position: static;
                flex-shrink: 0;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.35);
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                transition: background 0.2s;
            }
            #guruTalkButton:hover {
                background: rgba(255,255,255,0.32);
            }
            #guruTalkButton.vapi-live {
                background: rgba(239, 68, 68, 0.92) !important;
                border-color: rgba(255,255,255,0.55) !important;
                animation: guru-talk-pulse 1.4s ease-in-out infinite;
            }
            @keyframes guru-talk-pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
                50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
            }

            /* ══ MESSAGES ══ */
            .guru-chat-messages {
                flex: 1;
                padding: 18px 16px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
                scroll-behavior: smooth;
                background: transparent;
                position: relative;
            }
            .guru-chat-messages.kvi-messages--incall {
                overflow: hidden;
            }
            .guru-chat-messages.kvi-messages--incall > :not(.kvi-voice-stage) {
                display: none !important;
            }

            .guru-chat-messages::-webkit-scrollbar { width: 4px; }
            .guru-chat-messages::-webkit-scrollbar-track { background: transparent; }
            .guru-chat-messages::-webkit-scrollbar-thumb {
                background: rgba(26,107,138,0.2);
                border-radius: 4px;
            }
            .guru-chat-messages::-webkit-scrollbar-thumb:hover {
                background: rgba(26,107,138,0.4);
            }

            .guru-message {
                max-width: 82%;
                padding: 11px 15px;
                border-radius: 18px;
                font-family: var(--font-body);
                font-size: 13.5px;
                line-height: 1.6;
                letter-spacing: 0.01em;
                word-break: break-word;
                overflow-wrap: break-word;
                position: relative;
                animation: guruMsgIn 0.32s cubic-bezier(0.34,1.3,0.64,1) both;
            }

            @keyframes guruMsgIn {
                from { opacity: 0; transform: translateY(10px) scale(0.96); }
                to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }

            .guru-message.bot {
                align-self: flex-start;
                background: var(--bot-bubble-bg);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid var(--bot-bubble-border);
                color: var(--text-primary);
                border-radius: 4px 18px 18px 18px;
                box-shadow:
                    0 4px 20px rgba(26,107,138,0.07),
                    0 1px 4px rgba(0,0,0,0.05),
                    inset 0 1px 0 rgba(255,255,255,0.95);
            }

            .guru-message.user {
                align-self: flex-end;
                background: linear-gradient(135deg, var(--agent-primary,#b45309), var(--agent-secondary,#d97706));
                color: #fff;
                border-radius: 18px 4px 18px 18px;
                font-weight: 500;
                box-shadow:
                    0 6px 22px rgba(0,0,0,0.18),
                    inset 0 1px 0 rgba(255,255,255,0.2);
            }

            .guru-message a {
                color: var(--agent-primary,#b45309);
                text-decoration: underline;
                word-break: break-all;
            }
            .guru-message.user a { color: rgba(255,255,255,0.9); }
            .guru-message a:hover { opacity: 0.8; }

            .guru-message.typing {
                background: var(--bot-bubble-bg);
                color: var(--text-muted);
                font-style: italic;
                border: 1px solid var(--bot-bubble-border);
                border-radius: 4px 18px 18px 18px;
            }

            /* ══ INPUT BAR ══ */
            .guru-chat-input-container {
                padding: 14px 16px;
                background: rgba(240,248,252,0.65);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-top: 1px solid rgba(200,225,240,0.5);
                flex-shrink: 0;
            }

            .guru-chat-input {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .guru-chat-input input {
                flex: 1;
                font-family: var(--font-body);
                font-size: 14px;
                color: var(--text-primary);
                background: var(--input-bg);
                border: 1.5px solid rgba(200,225,240,0.7);
                border-radius: 50px;
                padding: 11px 18px;
                outline: none;
                transition: all 0.24s ease;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.8);
            }
            .guru-chat-input input::placeholder { color: var(--text-muted); font-weight: 300; }
            .guru-chat-input input:focus {
                border-color: var(--agent-primary,#b45309);
                background: rgba(255,255,255,0.96);
                box-shadow: 0 0 0 4px var(--focus-glow), inset 0 1px 3px rgba(0,0,0,0.03);
            }

            .guru-chat-input button {
                width: 46px;
                height: 46px;
                border: none;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--agent-primary,#b45309), var(--agent-secondary,#d97706));
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: all 0.24s var(--ease-spring);
                box-shadow: 0 4px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2);
            }
            .guru-chat-input button:hover:not(:disabled) {
                transform: scale(1.1) rotate(-5deg);
                box-shadow: 0 8px 22px rgba(0,0,0,0.28);
            }
            .guru-chat-input button:active { transform: scale(0.95) rotate(0); }
            .guru-chat-input button:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

            /* ══ KVI VOICE STAGE (live Vapi call) ══ */
            .kvi-voice-stage{
                --vol:0;
                position:absolute; inset:0;
                display:flex; flex-direction:column;
                align-items:center; justify-content:center;
                gap:18px; padding:24px; isolation:isolate;
                overflow:hidden;
                animation:kvi-vs-in .35s ease both;
                z-index:2;
            }
            .kvi-vs-bg{
                position:absolute; inset:0; z-index:-1;
                background:
                    var(--voice-bg-mesh),
                    linear-gradient(180deg, rgba(252,253,255,0.99) 0%, rgba(245,249,252,0.99) 100%);
                opacity:0; transition:opacity .5s ease;
            }
            .kvi-voice-stage:not(.is-ended) .kvi-vs-bg{ opacity:1; }
            .kvi-vs-orb-wrap{ position:relative; width:200px; height:200px;
                display:grid; place-items:center; }
            .kvi-vs-avatar{
                width:88px; height:88px; border-radius:50%;
                object-fit:cover; position:relative; z-index:3;
                box-shadow:0 6px 20px rgba(0,0,0,.18);
                border:2px solid rgba(255,255,255,.85);
            }
            .kvi-vs-orb{
                position:absolute; z-index:1; width:140px; height:140px; border-radius:50%;
                background:radial-gradient(circle at 50% 40%,
                            var(--voice-orb-core), var(--voice-orb-glow) 70%, transparent 72%);
                filter:blur(2px);
                animation:kvi-vs-breath 4s ease-in-out infinite;
            }
            .kvi-vs-ring{
                position:absolute; z-index:0; border-radius:50%;
                border:1.5px solid var(--voice-orb-glow); opacity:.5;
            }
            .kvi-vs-ring--1{ width:150px; height:150px; animation:kvi-vs-ripple 4s ease-out infinite; }
            .kvi-vs-ring--2{ width:150px; height:150px; animation:kvi-vs-ripple 4s ease-out infinite 2s; }
            .kvi-vs-sound{
                position:absolute; z-index:2; width:108px; height:108px; border-radius:50%;
                border:2px solid var(--voice-ring-agent); opacity:0;
                transform:scale(calc(1 + (var(--vol) * .45)));
                transition:transform .08s linear, opacity .2s ease, border-color .3s ease;
            }
            .kvi-vs-loader{
                position:absolute; z-index:2; width:120px; height:120px; border-radius:50%;
                border:2px solid transparent; border-top-color:var(--voice-orb-core);
                opacity:0; animation:kvi-vs-spin 1s linear infinite;
            }
            .kvi-vs-status{
                margin:0; font:600 16px/1.3 var(--font-body), system-ui,-apple-system,sans-serif;
                color:#1f2937; text-align:center; letter-spacing:.2px;
                text-shadow:0 1px 2px rgba(255,255,255,.6);
            }
            .kvi-vs-hint{
                margin:-8px 0 0; font:500 12px/1 var(--font-body), system-ui,sans-serif;
                color:#6b7280; opacity:0; transition:opacity .3s ease;
            }
            .kvi-vs-actions{ display:none; gap:10px; }
            .kvi-vs-btn{
                border:none; border-radius:999px; padding:9px 18px; cursor:pointer;
                font:600 13px var(--font-body), system-ui,sans-serif;
                transition:transform .12s ease, filter .2s;
            }
            .kvi-vs-btn:active{ transform:scale(.96); }
            .kvi-vs-retry{ background:var(--voice-orb-core); color:#fff; }
            .kvi-vs-end{ background:#f3f4f6; color:#374151; }
            .kvi-vs-btn:focus-visible{ outline:2px solid var(--voice-orb-core); outline-offset:2px; }
            .is-connecting .kvi-vs-loader{ opacity:1; }
            .is-connecting .kvi-vs-orb{ animation-duration:6s; opacity:.6; }
            .is-connecting .kvi-vs-ring{ opacity:.25; }
            .is-listening .kvi-vs-hint{ opacity:.7; }
            .is-listening .kvi-vs-orb{ animation-duration:4s; }
            .is-user-speaking .kvi-vs-sound{ opacity:.9; border-color:var(--voice-ring-user); }
            .is-user-speaking .kvi-vs-orb{ opacity:.45; animation-duration:6s; }
            .is-user-speaking .kvi-vs-ring{ opacity:.2; }
            .is-agent-speaking .kvi-vs-sound{ opacity:1; border-color:var(--voice-ring-agent); }
            .is-agent-speaking .kvi-vs-orb{ animation-duration:1.6s; }
            .is-agent-speaking .kvi-vs-ring{ opacity:.6; animation-duration:2.4s; }
            .is-error .kvi-vs-orb,
            .is-error .kvi-vs-ring{ filter:grayscale(1); animation-play-state:paused; }
            .is-error .kvi-vs-actions{ display:flex; }
            .is-error .kvi-vs-hint{ opacity:0; }
            .is-ended{ animation:kvi-vs-out .9s ease forwards; }
            .is-ended .kvi-vs-avatar{ box-shadow:0 0 0 6px rgba(16,185,129,.25); }
            @keyframes kvi-vs-breath{
                0%,100%{ transform:scale(1); opacity:.85; }
                50%{ transform:scale(1.08); opacity:1; }
            }
            @keyframes kvi-vs-ripple{
                0%{ transform:scale(.7); opacity:.5; }
                80%{ opacity:0; }
                100%{ transform:scale(1.35); opacity:0; }
            }
            @keyframes kvi-vs-spin{ to{ transform:rotate(360deg); } }
            @keyframes kvi-vs-in{ from{ opacity:0; transform:scale(.96); } to{ opacity:1; transform:scale(1); } }
            @keyframes kvi-vs-out{ 0%{ opacity:1; transform:scale(1); } 100%{ opacity:0; transform:scale(.98); } }
            @media (prefers-reduced-motion:reduce){
                .kvi-voice-stage,
                .kvi-vs-orb,.kvi-vs-ring,.kvi-vs-loader,.kvi-vs-sound{ animation:none !important; }
                .kvi-vs-sound{ transform:none !important; }
                .kvi-vs-orb{ opacity:.7; }
                .is-connecting .kvi-vs-loader{ opacity:1; border:2px dashed var(--voice-orb-core); }
            }
            @media (max-width:480px){
                .kvi-voice-stage{ padding:20px; gap:14px; }
                .kvi-vs-orb-wrap{ width:170px; height:170px; }
                .kvi-vs-avatar{ width:76px; height:76px; }
            }
            .kvi-composer--incall .kvi-input,
            .kvi-composer--incall .kvi-send{ display:none !important; }
            .kvi-composer-cta{ display:none; text-align:center; padding:12px;
                font:500 13px var(--font-body), system-ui,sans-serif; color:#6b7280; }
            .kvi-composer--incall .kvi-composer-cta{ display:block; }
            .kvi-sysline{
                display:flex; align-items:center; justify-content:center; gap:8px;
                margin:10px auto; padding:6px 14px; max-width:88%;
                font:500 12.5px/1.4 var(--font-body), system-ui,sans-serif;
                color:#6b7280; text-align:center; background:transparent;
                animation:kvi-sysline-in .3s ease both;
            }
            .kvi-sysline-dot{
                width:7px; height:7px; border-radius:50%;
                background:var(--voice-orb-core,#d97706);
                box-shadow:0 0 0 0 var(--voice-orb-glow,rgba(180,83,9,.4));
                animation:kvi-sysline-pulse 1.4s ease-in-out infinite;
            }
            .kvi-sysline--connecting{ color:#4b5563; }
            .kvi-sysline--ended{
                color:#374151;
                background:linear-gradient(0deg, var(--voice-bg-mesh), var(--voice-bg-mesh));
                border-radius:999px;
            }
            .kvi-sysline-check{
                display:inline-grid; place-items:center; width:16px; height:16px; border-radius:50%;
                background:var(--voice-orb-core,#10b981); color:#fff; font-size:10px; font-weight:700; line-height:1;
            }
            @keyframes kvi-sysline-in{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:none; } }
            @keyframes kvi-sysline-pulse{
                0%,100%{ transform:scale(1); box-shadow:0 0 0 0 var(--voice-orb-glow,rgba(180,83,9,.4)); }
                50%{ transform:scale(1.15); box-shadow:0 0 0 5px transparent; }
            }
            @media (prefers-reduced-motion:reduce){
                .kvi-sysline,.kvi-sysline-dot{ animation:none; }
            }
            .kvi-voice-stage[data-agent],
            .kvi-sysline[data-agent]{ --agent-primary:#d97706; --agent-secondary:#b45309; }
            [data-agent="brandi"]{
                --agent-primary:#d97706; --agent-secondary:#b45309;
                --voice-orb-core:#d97706; --voice-orb-glow:rgba(180,83,9,.40);
                --voice-ring-user:#22d3ee; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(217,119,6,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(180,83,9,.06), transparent 55%);
            }
            [data-agent="guru"]{
                --agent-primary:#4f46e5; --agent-secondary:#6366f1;
                --voice-orb-core:#4f46e5; --voice-orb-glow:rgba(99,102,241,.40);
                --voice-ring-user:#22d3ee; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(79,70,229,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(99,102,241,.06), transparent 55%);
            }
            [data-agent="max"]{
                --agent-primary:#2563eb; --agent-secondary:#3b82f6;
                --voice-orb-core:#2563eb; --voice-orb-glow:rgba(59,130,246,.40);
                --voice-ring-user:#22d3ee; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(37,99,235,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(59,130,246,.06), transparent 55%);
            }
            [data-agent="lucy"]{
                --agent-primary:#7c3aed; --agent-secondary:#8b5cf6;
                --voice-orb-core:#7c3aed; --voice-orb-glow:rgba(139,92,246,.40);
                --voice-ring-user:#22d3ee; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(124,58,237,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(139,92,246,.06), transparent 55%);
            }
            [data-agent="rose"]{
                --agent-primary:#e11d48; --agent-secondary:#f43f5e;
                --voice-orb-core:#e11d48; --voice-orb-glow:rgba(244,63,94,.40);
                --voice-ring-user:#22d3ee; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(225,29,72,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(244,63,94,.06), transparent 55%);
            }
            [data-agent="kate"]{
                --agent-primary:#059669; --agent-secondary:#10b981;
                --voice-orb-core:#059669; --voice-orb-glow:rgba(16,185,129,.40);
                --voice-ring-user:#818cf8; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(5,150,105,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(16,185,129,.06), transparent 55%);
            }
            [data-agent="sage"]{
                --agent-primary:#0d9488; --agent-secondary:#14b8a6;
                --voice-orb-core:#0d9488; --voice-orb-glow:rgba(20,184,166,.40);
                --voice-ring-user:#818cf8; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(13,148,136,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(20,184,166,.06), transparent 55%);
            }
            [data-agent="buffett"], [data-agent="buffet"]{
                --agent-primary:#15803d; --agent-secondary:#22c55e;
                --voice-orb-core:#15803d; --voice-orb-glow:rgba(34,197,94,.40);
                --voice-ring-user:#818cf8; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(21,128,61,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(34,197,94,.06), transparent 55%);
            }
            [data-agent="barbie"]{
                --agent-primary:#db2777; --agent-secondary:#ec4899;
                --voice-orb-core:#db2777; --voice-orb-glow:rgba(236,72,153,.40);
                --voice-ring-user:#22d3ee; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(219,39,119,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(236,72,153,.06), transparent 55%);
            }
            [data-agent="jill"]{
                --agent-primary:#0284c7; --agent-secondary:#38bdf8;
                --voice-orb-core:#0284c7; --voice-orb-glow:rgba(56,189,248,.40);
                --voice-ring-user:#818cf8; --voice-ring-agent:var(--voice-orb-core);
                --voice-bg-mesh:
                    radial-gradient(120% 90% at 50% 8%, rgba(2,132,199,.10), transparent 60%),
                    radial-gradient(100% 80% at 50% 100%, rgba(56,189,248,.06), transparent 55%);
            }

            /* ══ LOADING DOTS ══ */
            .guru-loading-dots { display: inline-block; }
            .guru-loading-dots::after {
                content: '';
                animation: guruLoading 1.5s infinite;
            }
            @keyframes guruLoading {
                0%,20%  { content: '';   }
                40%     { content: '.';  }
                60%     { content: '..'; }
                80%,100%{ content: '...'; }
            }

            /* ══ SPEECH BUBBLE ══ */
            .guru-bubble {
                position: absolute;
                bottom: 72px;
                right: 78px;
                background: rgba(255,255,255,0.96);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                color: var(--text-primary,#0d2233);
                padding: 0;
                border-radius: 18px 18px 4px 18px;
                border: 1px solid rgba(200,225,240,0.7);
                box-shadow:
                    0 12px 40px rgba(15,60,90,0.14),
                    0 3px 10px rgba(0,0,0,0.06),
                    inset 0 1px 0 rgba(255,255,255,0.95);
                font-size: 13px;
                line-height: 1.5;
                max-width: 230px;
                min-width: 170px;
                pointer-events: auto;
                opacity: 0;
                transform: translateY(10px) scale(0.92);
                transition: opacity 0.4s cubic-bezier(.34,1.56,.64,1), transform 0.4s cubic-bezier(.34,1.56,.64,1);
                overflow: hidden;
                z-index: 2;
            }
            .guru-bubble.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            .guru-bubble-accent {
                height: 3px;
                background: linear-gradient(90deg, var(--agent-primary,#b45309), var(--agent-secondary,#d97706));
            }
            .guru-bubble-body {
                padding: 10px 30px 11px 13px;
                font-family: var(--font-body);
                position: relative;
            }
            .guru-bubble::after {
                content: '';
                position: absolute;
                bottom: 14px;
                right: -7px;
                width: 0;
                height: 0;
                border-top: 6px solid transparent;
                border-bottom: 6px solid transparent;
                border-left: 8px solid rgba(255,255,255,0.96);
            }
            .guru-bubble-close {
                position: absolute;
                top: 6px;
                right: 7px;
                background: rgba(240,248,252,0.9);
                border: none;
                cursor: pointer;
                font-size: 9px;
                color: #9ca3af;
                width: 19px;
                height: 19px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, color 0.2s;
            }
            .guru-bubble-close:hover { background: #e5e7eb; color: #374151; }

            /* ══ MOBILE ══ */
            @media (max-width: 480px) {
                .guru-chat-container {
                    width: calc(100vw - 32px) !important;
                    height: calc(100dvh - 120px) !important;
                    bottom: 80px !important;
                    right: 16px !important;
                }
                .guru-chat-widget.bottom-right {
                    right: 12px !important;
                    bottom: 12px !important;
                }
                .guru-bubble {
                    max-width: 190px;
                    font-size: 12.5px;
                    right: 74px;
                }
            }

            /* Opener chips (Openers.html — tappable suggestions) */
            .guru-welcome-block { display: flex; flex-direction: column; gap: 10px; }
            .guru-opener-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 4px;
                max-width: 100%;
            }
            .guru-opener-chip {
                cursor: pointer;
                font-family: var(--font-body);
                font-size: 12.5px;
                line-height: 1.45;
                text-align: left;
                padding: 9px 12px;
                border-radius: 14px 14px 14px 4px;
                border: 1px solid var(--bot-bubble-border);
                background: rgba(255,255,255,0.72);
                color: var(--text-primary);
                box-shadow: 0 2px 10px rgba(26,107,138,0.06);
                transition: transform 0.2s var(--ease-spring), box-shadow 0.2s ease;
                max-width: 100%;
            }
            .guru-opener-chip:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 14px rgba(26,107,138,0.1);
                border-color: color-mix(in srgb, var(--agent-primary, #b45309) 35%, transparent);
            }
            .guru-opener-hint {
                font-size: 12px;
                opacity: 0.85;
                margin-top: 4px;
            }

            @media (prefers-reduced-motion: reduce) {
                .guru-chat-toggle     { animation: none; }
                .guru-chat-header::before { animation: none; }
                .guru-message         { animation: none; }
                .guru-header-online   { animation: none; }
            }
        `;
        document.head.appendChild(style);
    }

    // Create chat widget HTML
    function createWidget() {
        const widget = document.createElement('div');
        widget.className = `guru-chat-widget ${CONFIG.position}`;

        widget.innerHTML = `
            <div class="guru-bubble" id="guruBubble">
                <div class="guru-bubble-accent" id="guruBubbleAccent"></div>
                <div class="guru-bubble-body">
                    <button class="guru-bubble-close" id="guruBubbleClose" title="Dismiss">✕</button>
                    <span id="guruBubbleText">Hi! I'm Brandi 👋 — tap to see ways we can help.</span>
            </div>
            </div>
            <button class="guru-chat-toggle" id="guruChatToggle" title="Chat with KVI">
                <img id="guruToggleImg" src="${AGENTS.brandi.image}" alt="Chat" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block;transition:opacity 0.3s ease;">
            </button>
            <div class="guru-chat-container" id="guruChatContainer">
                <div class="guru-chat-header" id="guruChatHeader">
                    <div class="guru-header-content">
                        <div class="guru-header-avatar-wrap">
                            <img id="guruHeaderImg" src="${AGENTS.brandi.image}" alt="Agent" class="guru-header-image">
                            <span class="guru-header-online"></span>
                        </div>
                        <div class="guru-header-text">
                            <h2 id="guruHeaderName">Brandi</h2>
                            <p class="guru-header-role" id="guruHeaderRole">Your KVI Concierge</p>
                            <span class="guru-header-handoff" id="guruHandoffBadge">✦ Connected</span>
                        </div>
                    </div>
                    <div class="guru-header-actions">
                        <button id="guruTalkButton" title="Start voice conversation">📞</button>
                        <button class="guru-chat-close" id="guruChatClose">&times;</button>
                    </div>
                </div>
                <div class="guru-chat-messages" id="guruChatMessages">
                    <div id="guruWelcomeBlock" class="guru-welcome-block" aria-live="polite"></div>
                </div>
                <div class="guru-chat-input-container kvi-composer" id="guruComposer">
                    <div class="kvi-composer-cta" role="status">Tap ■ to end call</div>
                    <div class="guru-chat-input">
                        <button id="guruVoiceButton" class="kvi-input" title="Voice input" style="width: 40px; height: 40px; border: none; border-radius: 50%; background: #f3f4f6; color: #6b7280; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-right: 8px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        </button>
                        <input type="text" id="guruMessageInput" class="kvi-input" placeholder="Type your message…" maxlength="500">
                        <button id="guruSendButton" class="kvi-send">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22,2 15,22 11,13 2,9"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(widget);
        return widget;
    }

    // Initialize chat functionality
    function initChat(widget) {
        const toggle = document.getElementById('guruChatToggle');
        const container = document.getElementById('guruChatContainer');
        const close = document.getElementById('guruChatClose');
        const messages = document.getElementById('guruChatMessages');
        const input = document.getElementById('guruMessageInput');
        const sendButton = document.getElementById('guruSendButton');

        const pageCtx = resolvePageChatContext();
        const PAGE_OVERRIDE_OPENERS = pageCtx.pageOpeners;
        let _activeAgent = pageCtx.agent;

        function getEffectiveOpeners() {
            if (PAGE_OVERRIDE_OPENERS && PAGE_OVERRIDE_OPENERS.length) return PAGE_OVERRIDE_OPENERS;
            return OPENERS_CACHE;
        }

        let isOpen = false;
        let isLoading = false;

        function toggleChat() {
            isOpen = !isOpen;
            if (isOpen) {
            container.classList.add('open');
                // Wait for CSS transition before focusing so input is fully interactive
                setTimeout(() => { if (isOpen) input.focus(); }, 320);
            } else {
                container.classList.remove('open');
            }
        }

        function linkify(text) {
            // Escape HTML first
            const escaped = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            // Clickable URLs
            const withLinks = escaped.replace(
                /(https?:\/\/[^\s<>"]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
            );
            // Clickable phone numbers  e.g. (805) 230-2126  or  +1 (805) 327-5758
            return withLinks.replace(
                /(\+?1?\s*\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4})/g,
                '<a href="tel:$1">$1</a>'
            );
        }

        function escapeHtml(s) {
            return String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function addMessage(text, type, isSmall = false) {
            if (type === 'user') {
                const wb = document.getElementById('guruWelcomeBlock');
                if (wb) wb.remove();
            }
            const messageDiv = document.createElement('div');
            messageDiv.className = `guru-message ${type}`;
            if (isSmall) {
                messageDiv.style.fontSize = '12px';
                messageDiv.style.opacity = '0.7';
            }
            // Use linkify for bot messages; plain text is safe for user messages
            if (type === 'bot') {
                messageDiv.innerHTML = linkify(text);
            } else {
            messageDiv.textContent = text;
            }
            messages.appendChild(messageDiv);
            scrollToBottom();
        }

        /** Welcome area: opener bubble + chips — page-specific list or Openers.html JSON */
        function renderWelcomeOpeners() {
            const wb = document.getElementById('guruWelcomeBlock');
            const pool = getEffectiveOpeners();
            if (!wb || !pool.length) return;
            const shuffled = shuffleArray(pool);
            const lead = shuffled[0];
            const chips = shuffled.slice(1, 4);
            wb.innerHTML =
                '<div class="guru-message bot">' + escapeHtml(lead) + '</div>' +
                '<div class="guru-opener-chips" role="group" aria-label="Suggested questions">' +
                chips.map(function (t) {
                    return '<button type="button" class="guru-opener-chip">' + escapeHtml(t) + '</button>';
                }).join('') +
                '</div>' +
                '<div class="guru-message bot guru-opener-hint">' +
                '💬 Tap a question or type below. Tap 📞 in the header for live voice with ' + escapeHtml((AGENTS[_activeAgent] || AGENTS.brandi).name) + '.' +
                '</div>';
            wb.querySelectorAll('.guru-opener-chip').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const t = btn.textContent;
                    input.value = t;
                    sendMessage();
                });
            });
        }

        function showTyping() {
            isLoading = true;
            sendButton.disabled = true;

            const typingDiv = document.createElement('div');
            typingDiv.className = 'guru-message bot typing';
            typingDiv.id = 'guruTypingIndicator';
            const _agentDisplayName = (AGENTS[_activeAgent] || AGENTS['brandi']).name;
            typingDiv.innerHTML = _agentDisplayName + ' is thinking<span class="guru-loading-dots"></span>';
            messages.appendChild(typingDiv);
            scrollToBottom();
        }

        function hideTyping() {
            isLoading = false;
            sendButton.disabled = false;

            const typingIndicator = document.getElementById('guruTypingIndicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
        }

        function scrollToBottom() {
            messages.scrollTop = messages.scrollHeight;
        }

        async function sendMessage() {
            const message = input.value.trim();
            if (!message || isLoading) return;

            // Add user message
            addMessage(message, 'user');
            input.value = '';

            // Show typing indicator
            showTyping();

            try {
                const response = await callAPI(message);
                hideTyping();
                
                // Add response message
                addMessage(response.answer, 'bot');

                // Optional: Show which model was used (but don't show 'openai' or 'vapi')
                if (response.model_used && response.model_used !== 'openai' && response.model_used !== 'vapi') {
                    addMessage(`Powered by ${response.model_used}`, 'bot', true);
                }
            } catch (error) {
                hideTyping();
                addMessage('Sorry, I\'m having trouble connecting right now. Please try again later or contact Khanna Institute directly.', 'bot');
                console.error('Guru API Error:', error);
            }
        }

        // Persistent session id — same for all messages in this widget session
        const _sessionId = 'web-' + Math.random().toString(36).slice(2) + '-' + Date.now();

        // Update widget visuals when the active agent changes
        function updateAgentUI(agentId, opts) {
            opts = opts || {};
            const key = (agentId || 'brandi').toLowerCase();
            const agent = AGENTS[key] || AGENTS['brandi'];

            // Update CSS variables on the widget root for color theming
            const widgetRoot = document.querySelector('.guru-chat-widget');
            if (widgetRoot) {
                widgetRoot.style.setProperty('--agent-primary', agent.primary);
                widgetRoot.style.setProperty('--agent-secondary', agent.secondary);
            }

            // Update header image + name + role
            const headerImg  = document.getElementById('guruHeaderImg');
            const headerName = document.getElementById('guruHeaderName');
            const headerRole = document.getElementById('guruHeaderRole');
            const badge      = document.getElementById('guruHandoffBadge');
            const toggleImg  = document.getElementById('guruToggleImg');

            const fit = agent.objectFit || 'cover';
            const pos = fit === 'contain' ? 'center' : 'top center';
            if (headerImg) {
                headerImg.style.opacity = '0';
                setTimeout(() => {
                    headerImg.src = agent.image;
                    headerImg.style.objectFit = fit;
                    headerImg.style.objectPosition = pos;
                    headerImg.style.opacity = '1';
                }, 200);
            }
            if (headerName)  headerName.textContent = agent.name;
            if (headerRole)  headerRole.textContent = agent.role;
            if (toggleImg) {
                toggleImg.style.opacity = '0';
                setTimeout(() => {
                    toggleImg.src = agent.image;
                    toggleImg.style.objectFit = fit;
                    toggleImg.style.objectPosition = pos;
                    toggleImg.style.opacity = '1';
                }, 200);
            }

            // Show "Connected to <Name>" badge briefly then fade (skip on initial page-based agent)
            if (badge && key !== 'brandi' && !opts.silent) {
                badge.textContent = '✦ ' + agent.name;
                badge.classList.add('show');
                setTimeout(() => badge.classList.remove('show'), 3500);
            }

            // Restart bubble cycle with new prompts (skipBubbleRestart MUST be checked first — _bubble* lets are below)
            if (!opts.skipBubbleRestart && !_bubbleDismissed && !isOpen) {
                clearInterval(_bubbleInterval);
                _bubbleIndex = 0;
                hideBubble();
                setTimeout(startBubbleCycle, 600);
            }
        }

        // Match header / launcher to page context (no handoff badge, no bubble race)
        updateAgentUI(_activeAgent, { silent: true, skipBubbleRestart: true });

        // ── Speech bubble (launcher) — page openers or Openers.html export ──
        let _bubbleDismissed = false;
        let _bubbleInterval  = null;
        let _bubbleIndex     = 0;

        const bubbleEl   = document.getElementById('guruBubble');
        const bubbleText = document.getElementById('guruBubbleText');
        const bubbleClose = document.getElementById('guruBubbleClose');

        function getBubblePrompts() {
            const list = getEffectiveOpeners();
            if (list && list.length) return list;
            return ['Welcome — tap to pick a question or type your own.'];
        }

        function isChatOpen() {
            return container.classList.contains('open');
        }

        function showBubble(text) {
            if (_bubbleDismissed || isChatOpen()) return;
            if (text !== undefined) bubbleText.textContent = text;
            bubbleEl.classList.add('visible');
        }

        function hideBubble() {
            bubbleEl.classList.remove('visible');
        }

        function startBubbleCycle() {
            if (_bubbleDismissed) return;
            const prompts = getBubblePrompts();
            _bubbleIndex = 0;
            showBubble(prompts[0]);

            clearInterval(_bubbleInterval);
            _bubbleInterval = setInterval(() => {
                if (_bubbleDismissed || isChatOpen()) { clearInterval(_bubbleInterval); return; }
                hideBubble();
                setTimeout(() => {
                    _bubbleIndex = (_bubbleIndex + 1) % getBubblePrompts().length;
                    showBubble(getBubblePrompts()[_bubbleIndex]);
                }, 400);
            }, 4500);
        }

        // Dismiss button
        bubbleClose.addEventListener('click', (e) => {
            e.stopPropagation();
            _bubbleDismissed = true;
            clearInterval(_bubbleInterval);
            hideBubble();
        });

        // Toggle button: hide bubble when opening, restart when closing
        toggle.addEventListener('click', () => {
            if (isChatOpen()) {
                // chat is about to close
                if (!_bubbleDismissed) {
                    setTimeout(startBubbleCycle, 1200);
                }
            } else {
                // chat is about to open
                clearInterval(_bubbleInterval);
                hideBubble();
            }
        });

        // Welcome + bubble: page-specific openers render immediately; default pages wait for JSON
        if (PAGE_OVERRIDE_OPENERS && PAGE_OVERRIDE_OPENERS.length) {
            renderWelcomeOpeners();
            setTimeout(startBubbleCycle, 2000);
            loadOpenersFromFile();
        } else {
            loadOpenersFromFile().then(function () {
                renderWelcomeOpeners();
                setTimeout(startBubbleCycle, 2000);
            });
        }
        // ── End speech bubble ──────────────────────────────────────────

        async function callAPI(query) {
            // Use webhook endpoint directly (it's configured and working)
            const endpoint = `${CONFIG.apiUrl}/vapi/webhook`;
            const body = JSON.stringify({
                message: { content: query },
                call: { id: _sessionId }
            });
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const firstMsg = Array.isArray(data.messages) ? data.messages[0] : null;
            const text =
                (firstMsg && (firstMsg.text ?? firstMsg.content)) ||
                data.answer ||
                'I received your message.';
            // Track active agent for typing indicator + handoff UI
            if (data.active_agent) {
                const changed = data.active_agent !== _activeAgent;
                _activeAgent = data.active_agent;
                if (changed) updateAgentUI(_activeAgent);
            }
            return {
                answer: text,
                model_used: data.model_used || 'openai'
            };
        }

        // ── OpenAI TTS (natural voice) ──────────────────────────────────────
        let currentAudio = null;

        async function speakOpenAI(text, onDone) {
            try {
                // Cancel any current playback
                if (currentAudio) { currentAudio.pause(); currentAudio = null; }

                const res = await fetch(`${CONFIG.apiUrl}/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, voice: 'nova' })
                });
                if (!res.ok) throw new Error('TTS request failed');

                const blob = await res.blob();
                const url  = URL.createObjectURL(blob);
                currentAudio = new Audio(url);
                currentAudio.onended = () => {
                    URL.revokeObjectURL(url);
                    currentAudio = null;
                    if (onDone) onDone();
                };
                currentAudio.onerror = () => {
                    currentAudio = null;
                    if (onDone) onDone();
                };
                currentAudio.play();
            } catch (e) {
                console.warn('[TTS] OpenAI TTS failed, falling back to browser TTS:', e);
                // Browser TTS fallback
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utt = new SpeechSynthesisUtterance(text);
                    utt.rate = 0.95; utt.pitch = 1.05; utt.volume = 1.0;
                    if (selectedVoice) utt.voice = selectedVoice;
                    utt.onend = onDone; utt.onerror = onDone;
                    window.speechSynthesis.speak(utt);
                } else if (onDone) onDone();
            }
        }

        // ── Continuous voice mic (tap once to start, tap again to stop) ────
        let micActive   = false;  // true while continuous mic mode is on
        let micSpeaking = false;  // true while AI is speaking (mic paused)
        let micRec      = null;   // SpeechRecognition instance for mic mode

                const voiceButton = document.getElementById('guruVoiceButton');

        function setMicButtonState(active) {
            if (!voiceButton) return;
            if (active) {
                voiceButton.style.background = '#ef4444';
                voiceButton.style.color      = 'white';
                voiceButton.title            = 'Stop voice mode';
            } else {
                    voiceButton.style.background = '#f3f4f6';
                voiceButton.style.color      = '#6b7280';
                voiceButton.title            = 'Voice mode';
            }
        }

        function startMicListening() {
            if (!micActive || micSpeaking || !micRec) return;
            try { micRec.start(); } catch(e) {}
        }

        function stopMicMode() {
            micActive = false;
            micSpeaking = false;
            setMicButtonState(false);
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            if (micRec) { try { micRec.stop(); } catch(e) {} }
        }

        if (('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && voiceButton) {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

            function buildMicRec() {
                const r = new SR();
                r.continuous      = false;
                r.interimResults  = true;
                r.lang            = 'en-US';

                // Show interim transcript in a floating bubble above input
                r.onresult = (event) => {
                    let interim = '', final_ = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const t = event.results[i][0].transcript;
                        if (event.results[i].isFinal) final_ += t + ' ';
                        else interim += t;
                    }
                    // Show live transcription in the input placeholder area
                    if (interim) input.placeholder = '🎤 ' + interim;

                    if (final_.trim()) {
                        input.placeholder = 'Type your message…';
                        const text = final_.trim();
                        addMessage(text, 'user');
                        micSpeaking = true;  // pause mic while AI responds

                        showTyping();
                        callAPI(text).then(response => {
                            hideTyping();
                            addMessage(response.answer, 'bot');
                            speakOpenAI(response.answer, () => {
                                micSpeaking = false;
                                // Auto-restart mic after AI finishes speaking
                                startMicListening();
                            });
                        }).catch(err => {
                            hideTyping();
                            addMessage('Sorry, I had trouble connecting. Please try again.', 'bot', true);
                            micSpeaking = false;
                            startMicListening();
                        });
                    }
                };

                r.onerror = (e) => {
                    if (e.error === 'no-speech') {
                        // Silence — just restart
                        if (micActive && !micSpeaking) setTimeout(startMicListening, 300);
                        return;
                    }
                    if (e.error === 'aborted') return;
                    console.warn('Mic error:', e.error);
                    if (micActive && !micSpeaking) setTimeout(startMicListening, 500);
                };

                r.onend = () => {
                    // Restart automatically unless AI is speaking or mode was stopped
                    if (micActive && !micSpeaking) setTimeout(startMicListening, 200);
                };

                return r;
            }

            voiceButton.addEventListener('click', () => {
                if (micActive) {
                    stopMicMode();
                } else {
                    micActive = true;
                    setMicButtonState(true);
                    micRec = buildMicRec();
                    startMicListening();
                    addMessage('🎤 Voice mode on — speak anytime. Tap the mic to stop.', 'bot', true);
                }
            });
        } else if (voiceButton) {
            voiceButton.style.opacity = '0.5';
            voiceButton.title = 'Voice not supported in this browser';
        }

        // Event listeners
        toggle.addEventListener('click', toggleChat);

        // ── Vapi Web voice (live call with active agent persona) ─────────────
        const talkButton = document.getElementById('guruTalkButton');
        let _voiceConfig = null;
        let _vapiClient = null;
        let _vapiCallActive = false;
        let _vapiConnecting = false;
        let _vapiSdkLoaded = false;
        const composerEl = document.getElementById('guruComposer');

        let _voiceStageEl = null;
        let _agentVoiceTimer = null;
        let _connectingSysline = null;

        function getVoiceAgentKey() {
            return (_activeAgent || 'brandi').toLowerCase();
        }

        function getVoiceAgentName() {
            return (AGENTS[_activeAgent] || AGENTS.brandi).name;
        }

        function setComposerIncall(on) {
            if (!composerEl) return;
            composerEl.classList.toggle('kvi-composer--incall', !!on);
        }

        function removeConnectingSysline() {
            if (_connectingSysline && _connectingSysline.parentNode) {
                _connectingSysline.parentNode.removeChild(_connectingSysline);
            }
            _connectingSysline = null;
        }

        function addVoiceSysline(type, text) {
            const el = document.createElement('div');
            el.className = 'kvi-sysline kvi-sysline--' + type;
            el.dataset.agent = getVoiceAgentKey();
            el.setAttribute('role', 'status');
            if (type === 'connecting') {
                el.innerHTML = '<span class="kvi-sysline-dot" aria-hidden="true"></span>' + text;
            } else {
                el.innerHTML = '<span class="kvi-sysline-check" aria-hidden="true">✓</span>' + text;
            }
            messages.appendChild(el);
            messages.scrollTop = messages.scrollHeight;
            return el;
        }

        function createVoiceStageEl() {
            const key = getVoiceAgentKey();
            const agent = AGENTS[_activeAgent] || AGENTS.brandi;
            const section = document.createElement('section');
            section.className = 'kvi-voice-stage is-connecting';
            section.dataset.agent = key;
            section.setAttribute('role', 'group');
            section.setAttribute('aria-label', 'Live voice call');
            section.innerHTML =
                '<div class="kvi-vs-bg" aria-hidden="true"></div>' +
                '<div class="kvi-vs-orb-wrap">' +
                '<span class="kvi-vs-ring kvi-vs-ring--1" aria-hidden="true"></span>' +
                '<span class="kvi-vs-ring kvi-vs-ring--2" aria-hidden="true"></span>' +
                '<span class="kvi-vs-sound" aria-hidden="true"></span>' +
                '<span class="kvi-vs-orb" aria-hidden="true"></span>' +
                '<span class="kvi-vs-loader" aria-hidden="true"></span>' +
                '<img class="kvi-vs-avatar" src="" alt="" />' +
                '</div>' +
                '<p class="kvi-vs-status" aria-live="polite">Connecting…</p>' +
                '<p class="kvi-vs-hint" aria-hidden="true">🎙 mic active</p>' +
                '<div class="kvi-vs-actions">' +
                '<button type="button" class="kvi-vs-btn kvi-vs-retry">Retry</button>' +
                '<button type="button" class="kvi-vs-btn kvi-vs-end">End call</button>' +
                '</div>';
            const avatar = section.querySelector('.kvi-vs-avatar');
            if (avatar) avatar.src = agent.image || '';
            section.querySelector('.kvi-vs-retry').addEventListener('click', async function () {
                hideVoiceStage({ addEnded: false, delay: 0 });
                await startVapiWebCall();
            });
            section.querySelector('.kvi-vs-end').addEventListener('click', function () {
                stopVapiWebCall();
            });
            return section;
        }

        function setMessagesVoiceActive(on) {
            messages.classList.toggle('kvi-messages--incall', !!on);
        }

        function showVoiceStage(mode, statusText) {
            if (!_voiceStageEl) {
                _voiceStageEl = createVoiceStageEl();
                messages.appendChild(_voiceStageEl);
            }
            removeConnectingSysline();
            setMessagesVoiceActive(true);
            setComposerIncall(true);
            if (mode) setVoiceMode(mode, statusText);
        }

        function setVoiceMode(mode, text) {
            if (!_voiceStageEl) return;
            _voiceStageEl.className = 'kvi-voice-stage is-' + mode;
            _voiceStageEl.dataset.agent = getVoiceAgentKey();
            if (text) {
                const statusEl = _voiceStageEl.querySelector('.kvi-vs-status');
                if (statusEl) statusEl.textContent = text;
            }
        }

        function hideVoiceStage(options) {
            const opts = typeof options === 'boolean'
                ? { addEnded: options }
                : (options || {});
            const addEnded = opts.addEnded !== false;
            const delay = opts.delay != null
                ? opts.delay
                : (_voiceStageEl && _voiceStageEl.classList.contains('is-ended') ? 900 : 0);

            clearTimeout(_agentVoiceTimer);
            _agentVoiceTimer = null;
            removeConnectingSysline();

            const el = _voiceStageEl;
            if (!el) {
                setComposerIncall(false);
                setMessagesVoiceActive(false);
                return;
            }
            _voiceStageEl = null;
            setComposerIncall(false);

            const removeEl = function () {
                if (el.parentNode) el.parentNode.removeChild(el);
                setMessagesVoiceActive(false);
                if (addEnded) {
                    addVoiceSysline('ended', 'Call ended — you can keep chatting below');
                }
            };
            if (delay > 0) setTimeout(removeEl, delay);
            else removeEl();
        }

        function loadScriptOnce(src) {
            return new Promise(function (resolve, reject) {
                if (document.querySelector('script[data-kvi-src="' + src + '"]')) {
                    resolve();
                    return;
                }
                const s = document.createElement('script');
                s.src = src;
                s.defer = true;
                s.setAttribute('data-kvi-src', src);
                s.onload = function () { resolve(); };
                s.onerror = function () { reject(new Error('Failed to load ' + src)); };
                document.head.appendChild(s);
            });
        }

        function getVapiConstructor() {
            if (!window.VapiWeb) return null;
            return window.VapiWeb.default || window.VapiWeb;
        }

        async function fetchVoiceConfig() {
            try {
                const res = await fetch(CONFIG.voiceConfigUrl, { credentials: 'same-origin' });
                if (!res.ok) return null;
                const data = await res.json();
                return data && data.enabled && data.publicKey ? data : null;
            } catch (e) {
                console.warn('[kvi-voice] config fetch failed:', e);
                return null;
            }
        }

        async function ensureVapiSdk() {
            if (_vapiSdkLoaded && getVapiConstructor()) return true;
            const url = (_voiceConfig && _voiceConfig.sdkUrl) || CONFIG.vapiSdkUrl;
            await loadScriptOnce(url);
            _vapiSdkLoaded = !!getVapiConstructor();
            return _vapiSdkLoaded;
        }

        function getActiveAssistantId() {
            if (!_voiceConfig || !_voiceConfig.agents) return null;
            const key = (_activeAgent || 'brandi').toLowerCase();
            const row = _voiceConfig.agents[key];
            return row && row.assistantId ? row.assistantId : null;
        }

        function setTalkButtonLive(active) {
            if (!talkButton) return;
            if (active) {
                talkButton.classList.add('vapi-live');
                talkButton.title = 'End voice call';
                talkButton.innerHTML = '■';
            } else {
                talkButton.classList.remove('vapi-live');
                talkButton.title = 'Start voice call with ' + (AGENTS[_activeAgent] || AGENTS.brandi).name;
                talkButton.innerHTML = '📞';
            }
        }

        function wireVapiEvents(client) {
            if (!client || client.__kviWired) return;
            client.__kviWired = true;

            client.on('call-start', function () {
                _vapiConnecting = false;
                _vapiCallActive = true;
                setTalkButtonLive(true);
                stopMicMode();
                removeConnectingSysline();
                if (!_voiceStageEl) {
                    showVoiceStage('connecting', 'Connecting to ' + getVoiceAgentName() + '…');
                }
                setVoiceMode('listening', 'Listening…');
            });
            client.on('call-end', function () {
                _vapiConnecting = false;
                _vapiCallActive = false;
                setTalkButtonLive(false);
                if (_voiceStageEl) {
                    setVoiceMode('ended', 'Call ended — you can keep chatting below');
                    hideVoiceStage({ addEnded: true, delay: 900 });
                } else {
                    setComposerIncall(false);
                    addVoiceSysline('ended', 'Call ended — you can keep chatting below');
                }
            });
            client.on('speech-start', function () {
                clearTimeout(_agentVoiceTimer);
                setVoiceMode('user-speaking', "You're speaking…");
            });
            client.on('speech-end', function () {
                setVoiceMode('listening', 'Listening…');
            });
            client.on('volume-level', function (level) {
                if (!_voiceStageEl) return;
                _voiceStageEl.style.setProperty('--vol', (level || 0).toFixed(2));
                if (level > 0.04 && !_voiceStageEl.classList.contains('is-user-speaking')) {
                    clearTimeout(_agentVoiceTimer);
                    const name = getVoiceAgentName();
                    if (!_voiceStageEl.classList.contains('is-agent-speaking')) {
                        setVoiceMode('agent-speaking', name + ' is speaking…');
                    }
                    _agentVoiceTimer = setTimeout(function () {
                        if (_voiceStageEl && !_voiceStageEl.classList.contains('is-user-speaking')) {
                            setVoiceMode('listening', 'Listening…');
                        }
                    }, 600);
                }
            });
            client.on('error', function (err) {
                console.error('[kvi-voice] Vapi error:', err);
                if (_voiceStageEl) {
                    setVoiceMode('error', 'Connection hiccup…');
                } else {
                    _vapiCallActive = false;
                    _vapiConnecting = false;
                    setTalkButtonLive(false);
                    setComposerIncall(false);
                    addMessage('Voice call error. You can keep chatting by text or call +1 (805) 327-5758.', 'bot', true);
                }
            });
        }

        async function ensureVapiClient() {
            if (!_voiceConfig || !_voiceConfig.publicKey) return null;
            if (!(await ensureVapiSdk())) return null;
            const Vapi = getVapiConstructor();
            if (!Vapi) return null;
            if (!_vapiClient) {
                _vapiClient = new Vapi(_voiceConfig.publicKey);
                wireVapiEvents(_vapiClient);
            }
            return _vapiClient;
        }

        async function startVapiWebCall() {
            const assistantId = getActiveAssistantId();
            if (!assistantId) {
                addMessage('Voice for this agent is not configured yet. Please chat by text or call +1 (805) 327-5758.', 'bot', true);
                return false;
            }
            const client = await ensureVapiClient();
            if (!client) {
                addMessage('Voice is temporarily unavailable. Please try text chat or call +1 (805) 327-5758.', 'bot', true);
                return false;
            }
            try {
                stopMicMode();
                const agentName = getVoiceAgentName();
                _vapiConnecting = true;
                removeConnectingSysline();
                showVoiceStage('connecting', 'Connecting to ' + agentName + '…');
                await client.start(assistantId, {
                    metadata: {
                        source: 'kvi-web-widget',
                        agentKey: _activeAgent,
                        page: typeof location !== 'undefined' ? location.pathname : '',
                    },
                });
                return true;
            } catch (err) {
                console.error('[kvi-voice] start failed:', err);
                _vapiConnecting = false;
                hideVoiceStage({ addEnded: false, delay: 0 });
                setComposerIncall(false);
                setMessagesVoiceActive(false);
                addMessage('Could not start voice call. Please allow microphone access and try again.', 'bot', true);
                return false;
            }
        }

        async function stopVapiWebCall() {
            if (!_vapiClient || (!_vapiCallActive && !_vapiConnecting && !_voiceStageEl)) return;
            _vapiConnecting = false;
            try {
                if (_vapiCallActive) {
                    await _vapiClient.stop();
                } else {
                    try { await _vapiClient.stop(); } catch (e) { /* may not be connected yet */ }
                }
            } catch (e) {
                console.warn('[kvi-voice] stop:', e);
            }
            if (_vapiCallActive) {
                _vapiCallActive = false;
                setTalkButtonLive(false);
                return;
            }
            _vapiCallActive = false;
            setTalkButtonLive(false);
            if (_voiceStageEl) {
                setVoiceMode('ended', 'Call ended — you can keep chatting below');
                hideVoiceStage({ addEnded: true, delay: 900 });
            } else {
                removeConnectingSysline();
                setComposerIncall(false);
                setMessagesVoiceActive(false);
            }
        }

        fetchVoiceConfig().then(function (cfg) {
            _voiceConfig = cfg;
            if (talkButton && cfg) {
                talkButton.title = 'Start voice call with ' + (AGENTS[_activeAgent] || AGENTS.brandi).name;
            }
        });

        let voiceConversationActive = false;
        let voiceRecognition = null;
        let selectedVoice = null;

        function initVoiceSelection() {
            if ('speechSynthesis' in window) {
                const loadVoices = () => {
                    const voices = window.speechSynthesis.getVoices();
                    selectedVoice = voices.find(v =>
                        v.name.includes('Samantha') ||
                        v.name.includes('Google US English Female') ||
                        v.name.includes('Microsoft Zira') ||
                        (v.lang.includes('en') && v.name.includes('Female'))
                    ) || voices.find(v => v.lang.includes('en-US')) || voices[0];
                };
                if (window.speechSynthesis.getVoices().length > 0) loadVoices();
                else window.speechSynthesis.addEventListener('voiceschanged', loadVoices, { once: true });
            }
        }
        initVoiceSelection();

        function startLegacyVoiceConversation() {
            if (voiceConversationActive) {
                stopLegacyVoiceConversation();
                return;
            }
            if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
                addMessage('Voice conversation requires Chrome, Edge, or Safari. Please call us at: +1 (805) 327-5758', 'bot', true);
                return;
            }
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            voiceRecognition = new SpeechRecognition();
            voiceRecognition.continuous = true;
            voiceRecognition.interimResults = true;
            voiceRecognition.lang = 'en-US';
            voiceRecognition.onstart = () => {
                voiceConversationActive = true;
                talkButton.style.background = 'rgba(239, 68, 68, 0.3)';
                talkButton.innerHTML = '⏹️';
                addMessage('🎤 Browser voice mode (basic). Speak naturally.', 'bot', true);
            };
            voiceRecognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
                }
                if (finalTranscript.trim()) {
                    addMessage(finalTranscript.trim(), 'user');
                    if (voiceRecognition) { try { voiceRecognition.stop(); } catch (e) {} }
                    showTyping();
                    callAPI(finalTranscript.trim()).then(response => {
                        hideTyping();
                        addMessage(response.answer, 'bot');
                        speakOpenAI(response.answer, () => {
                            if (voiceConversationActive && voiceRecognition) {
                                try { voiceRecognition.start(); } catch (e) {}
                            }
                        });
                    }).catch(() => {
                        hideTyping();
                        addMessage('Sorry, I had trouble processing that.', 'bot', true);
                    });
                }
            };
            voiceRecognition.onerror = (event) => {
                if (event.error === 'no-speech') return;
                stopLegacyVoiceConversation();
            };
            voiceRecognition.onend = () => {
                if (voiceConversationActive && !window.speechSynthesis.speaking) {
                    try { voiceRecognition.start(); } catch (e) {}
                }
            };
            try { voiceRecognition.start(); } catch (e) {
                addMessage('Please allow microphone access.', 'bot', true);
            }
        }

        function stopLegacyVoiceConversation() {
            voiceConversationActive = false;
            if (voiceRecognition) {
                try { voiceRecognition.stop(); } catch (e) {}
                voiceRecognition = null;
            }
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            setTalkButtonLive(false);
            talkButton.style.background = 'rgba(255, 255, 255, 0.2)';
        }

        if (talkButton) {
            talkButton.addEventListener('click', async function () {
                if (_vapiCallActive || _vapiConnecting) {
                    await stopVapiWebCall();
                    return;
                }
                if (voiceConversationActive) {
                    stopLegacyVoiceConversation();
                    return;
                }
                if (!_voiceConfig) _voiceConfig = await fetchVoiceConfig();
                if (_voiceConfig && getActiveAssistantId()) {
                    const ok = await startVapiWebCall();
                    if (ok) return;
                }
                startLegacyVoiceConversation();
            });
        }

        close.addEventListener('click', () => {
            stopMicMode();
            stopVapiWebCall();
            stopLegacyVoiceConversation();
            if (!_bubbleDismissed) setTimeout(startBubbleCycle, 1200);
            toggleChat();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isLoading) sendMessage();
        });

        sendButton.addEventListener('click', sendMessage);

        // Close when clicking outside the widget
        document.addEventListener('mousedown', (e) => {
            if (isOpen && !widget.contains(e.target)) {
                toggleChat();
            }
        });

        // Clicking anywhere inside the chat body re-focuses the input
        messages.addEventListener('click', () => {
            if (isOpen) input.focus();
        });
    }

    // Initialize when DOM is ready
    function init() {
        injectStyles();
        const widget = createWidget();
        initChat(widget);
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
