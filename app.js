/**********************************************************
 * TimeSync v2.1 - Modern meeting scheduler for different timezones
 * 
 * Features:
 * - Fill time-zone aware availability
 * - Handles overnight ranges (e.g. 22:00 - 06:00)
 * - Shareable URL encoding
 * - Better mobile responsiveness
 * - Improved error handling & validation
 **********************************************************/

// ==================== UTILITY FUNCTIONS ====================

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const uid = () => Math.random().toString(36).substring(2, 9);

// Fixed toast function
const toast = (msg, type = 'info') => {
    const root = qs('#toastRoot');
    if (!root) return;

    const el = document.createElement('div');
    const colors = {
        info: 'bg-blue-500',
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500'
    };

    el.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-xl shadow-lg animate-slideIn max-w-sm`;
    el.textContent = msg;
    root.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => el.remove(), 300);
    }, 3000);
};

// Fixed debounce function
function debounce(fn, wait = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}

// Shareable URL encoding/decoding
function encodeState(obj) {
    try {
        const s = JSON.stringify(obj);
        return btoa(encodeURIComponent(s));
    } catch (e) {
        console.error('Failed to encode state:', e);
        return null;
    }
}

function decodeState(str) {
    try {
        const dec = decodeURIComponent(atob(str));
        return JSON.parse(dec);
    } catch (e) {
        console.error('Failed to decode state:', e);
        return null;
    }
}

// HTML escaping for security
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Pad numbers with leading zeros
const pad = (n) => String(n).padStart(2, '0');

// ==================== TIMEZONE DATA ====================

const TIMEZONES = [
    "UTC", "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
    "America/Anchorage", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Mexico_City", "America/New_York", "America/Phoenix", "America/Sao_Paulo",
    "America/Toronto", "Asia/Colombo", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Jakarta",
    "Asia/Karachi", "Asia/Kolkata", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore",
    "Asia/Tokyo", "Australia/Sydney", "Europe/Amsterdam", "Europe/Berlin", "Europe/London",
    "Europe/Madrid", "Europe/Moscow", "Europe/Paris", "Europe/Rome", "Europe/Istanbul",
    "Pacific/Auckland", "Pacific/Fiji"
];

// ==================== AI CONFIGURATION ====================

const AI_CONFIG = {
    USE_PROXY: true,
    PROXY_URL: 'https://your-app.vercel.app/api/ai',
    DIRECT_API_URL: 'https://openrouter.ai/api/v1',
    API_KEY_PARTS: ['sk-or', '-v1-', ''],
    MODEL: 'openai/gpt-oss-20b:free',
    DEFAULT_HEADERS: {
        referer: 'https://timesync.app',
        title: 'TimeSync Meeting Scheduler'
    },
    FEATURES: {
        smartSuggestions: true,
        conflictResolver: true,
        etiquetteChecker: true
    }
};

// Reconstruct API key from parts (basic obfuscation)
const getApiKey = () => AI_CONFIG.API_KEY_PARTS.join('');

// ==================== STATE MANAGEMENT ====================

// Undo/Redo History
const history = {
    past: [],
    future: [],
    maxSize: 50,

    push(action) {
        this.past.push(action);
        if (this.past.length > this.maxSize) this.past.shift();
        this.future = [];
        updateUndoRedoButtons();
    },

    undo() {
        if (this.past.length === 0) return null;
        const action = this.past.pop();
        this.future.push(action);
        updateUndoRedoButtons();
        return action;
    },

    redo() {
        if (this.future.length === 0) return null;
        const action = this.future.pop();
        this.past.push(action);
        updateUndoRedoButtons();
        return action;
    }
};

function updateUndoRedoButtons() {
    const undoBtn = qs('#undoBtn');
    const redoBtn = qs('#redoBtn');
    if (undoBtn) undoBtn.disabled = history.past.length === 0;
    if (redoBtn) redoBtn.disabled = history.future.length === 0;
}

// Application State (in-memory only)
const state = {
    participants: [],
    duration: 60,
    days: 1,
    maxSuggestions: 5,
    excludeLunch: false,
    currentViewDay: 0,
    cache: {},
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    searchTerm: '',
    timeRangeStart: 0,
    timeRangeEnd: 24
};

// ==================== DOM ELEMENTS ====================

const els = {
    nameInput: qs('#nameInput'),
    tzSelect: qs('#tzSelect'),
    startInput: qs('#startInput'),
    endInput: qs('#endInput'),
    prioritySelect: qs('#prioritySelect'),
    addBtn: qs('#addBtn'),
    quickAddBtn: qs('#quickAddBtn'),
    participantsContainer: qs('#participantsContainer'),
    participantSearch: qs('#participantSearch'),
    heatmap: qs('#heatmap'),
    suggestions: qs('#suggestions'),
    demoBtn: qs('#demoBtn'),
    shareBtn: qs('#shareBtn'),
    aiSuggestBtn: qs('#aiSuggestBtn'),
    toggleTheme: qs('#toggleTheme'),
    detectedTz: qs('#detectedTz'),
    durationSelect: qs('#durationSelect'),
    daysSelect: qs('#daysSelect'),
    maxSuggestions: qs('#maxSuggestions'),
    excludeLunch: qs('#excludeLunch'),
    clearAllBtn: qs('#clearAllBtn'),
    viewDaySelect: qs('#viewDaySelect'),
    refreshSuggestionsBtn: qs('#refreshSuggestionsBtn'),
    bulkImportBtn: qs('#bulkImportBtn'),
    bulkModal: qs('#bulkModal'),
    closeBulkModal: qs('#closeBulkModal'),
    bulkTextarea: qs('#bulkTextarea'),
    bulkImportConfirm: qs('#bulkImportConfirm'),
    bulkImportCancel: qs('#bulkImportCancel'),
    statsParticipants: qs('#statsParticipants'),
    statsTimezones: qs('#statsTimezones'),
    statsCompatibility: qs('#statsCompatibility'),
    undoBtn: qs('#undoBtn'),
    redoBtn: qs('#redoBtn'),
    dateFormatSelect: qs('#dateFormatSelect'),
    timeFormatSelect: qs('#timeFormatSelect'),
    editModal: qs('#editModal'),
    editName: qs('#editName'),
    editTz: qs('#editTz'),
    editStart: qs('#editStart'),
    editEnd: qs('#editEnd'),
    editPriority: qs('#editPriority'),
    editConfirm: qs('#editConfirm'),
    editCancel: qs('#editCancel'),
    clearAllModal: qs('#clearAllModal'),
    clearAllConfirm: qs('#clearAllConfirm'),
    clearAllCancel: qs('#clearAllCancel'),
    removeParticipantModal: qs('#removeParticipantModal'),
    removeParticipantConfirm: qs('#removeParticipantConfirm'),
    removeParticipantCancel: qs('#removeParticipantCancel'),
    settingsToggleFloating: qs('#settingsToggleFloating'),
    settingsPanel: qs('#settingsPanel'),
    closeSettingsPanel: qs('#closeSettingsPanel'),
    timeRangeStart: qs('#timeRangeStart'),
    timeRangeEnd: qs('#timeRangeEnd'),
    analyticsContent: qs('#analyticsContent'),
    goldenHoursInfo: qs('#goldenHoursInfo'),
    goldenHoursList: qs('#goldenHoursList'),
    loadingOverlay: qs('#loadingOverlay'),
    loadingText: qs('#loadingText'),
    aiInsightsCard: qs('#aiInsightsCard'),
    aiStatusText: qs('#aiStatusText'),
    aiStatusSpinner: qs('#aiStatusSpinner'),
    aiSmartContent: qs('#aiSmartContent'),
    aiConflictContent: qs('#aiConflictContent')
};

let pendingRemoveId = null;
let lastRemoveBtn = null;
let currentEditId = null;
let heatmapTooltip = null;
const AI_SUGGESTION_DELAY = 10000;
let aiSuggestionTimer = null;

// ==================== AI FUNCTIONS ====================
// ADD THIS BEFORE: function init() {

function resolveAIConfig() {
    if (AI_CONFIG.USE_PROXY) {
        if (!AI_CONFIG.PROXY_URL || AI_CONFIG.PROXY_URL.includes('your-app')) {
            throw new Error('AI proxy URL is not configured yet.');
        }
        return { mode: 'proxy', url: AI_CONFIG.PROXY_URL };
    }

    const apiKey = getApiKey();
    if (!apiKey || apiKey.includes('YOUR_KEY_HERE')) {
        throw new Error('AI direct API key is missing.');
    }

    if (!AI_CONFIG.DIRECT_API_URL) {
        throw new Error('AI direct API URL is missing.');
    }

    return { mode: 'direct', url: AI_CONFIG.DIRECT_API_URL, apiKey };
}

function extractAIJsonContent(aiText) {
    if (!aiText) {
        throw new Error('AI returned an empty response.');
    }

    let text = aiText.trim();

    if (text.includes('```json')) {
        const parts = text.split('```json');
        if (parts[1]) {
            text = parts[1].split('```')[0].trim();
        }
    } else if (text.includes('```')) {
        const parts = text.split('```');
        if (parts[1]) {
            text = parts[1].split('```')[0].trim();
        }
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('No JSON object found in AI response.');
    }

    return text.slice(firstBrace, lastBrace + 1);
}

function parseAIJson(aiText, context) {
    const jsonCandidate = extractAIJsonContent(aiText);
    try {
        return JSON.parse(jsonCandidate);
    } catch (error) {
        console.error(`Failed to parse ${context}:`, jsonCandidate, error);
        throw new Error(`${context} was not valid JSON. Please try again.`);
    }
}

function getAIMessageContent(response, context) {
    if (!response || typeof response !== 'object') {
        throw new Error(`${context} missing AI response.`);
    }

    if (response.error) {
        const errorMsg = typeof response.error === 'string'
            ? response.error
            : response.error.message || JSON.stringify(response.error);
        throw new Error(errorMsg);
    }

    const choice = response?.choices?.[0];
    const message = choice?.message;

    if (!message) {
        console.error(`${context} raw response with no message:`, response);
        throw new Error(`${context} response was empty. Please try again.`);
    }

    if (message.parsed) {
        return message.parsed;
    }

    let content = message.content;

    if (Array.isArray(content)) {
        content = content.map(part => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object') {
                if (typeof part.text === 'string') return part.text;
                if (typeof part.content === 'string') return part.content;
                if (typeof part.value === 'string') return part.value;
            }
            return '';
        }).join('');
    }

    if (typeof content !== 'string') {
        if (typeof message.text === 'string') {
            content = message.text;
        } else if (typeof response.output_text === 'string') {
            content = response.output_text;
        } else {
            content = '';
        }
    }

    content = content.trim();

    if (!content) {
        console.error(`${context} raw response with no usable content:`, response);
        throw new Error(`${context} response was empty. Please try again.`);
    }

    return content;
}

function buildAIStatusMarkup(message, { loading = false, tone = 'muted' } = {}) {
    const toneClasses = {
        muted: 'text-slate-500 dark:text-slate-300',
        info: 'text-blue-600 dark:text-blue-300',
        success: 'text-emerald-600 dark:text-emerald-300',
        warning: 'text-orange-600 dark:text-orange-300',
        error: 'text-red-600 dark:text-red-300'
    };

    const spinnerMarkup = loading
        ? '<span class="spinner inline-block" style="width:18px;height:18px;border-width:3px;"></span>'
        : '';

    return `
        <div class="flex items-center gap-2 text-sm ${toneClasses[tone] || toneClasses.muted}">
            ${spinnerMarkup}
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}

function setAIStatus(message, { loading = false } = {}) {
    if (els.aiStatusText) {
        els.aiStatusText.textContent = message;
    }
    if (els.aiStatusSpinner) {
        if (loading) {
            els.aiStatusSpinner.classList.remove('hidden');
        } else {
            els.aiStatusSpinner.classList.add('hidden');
        }
    }
}

function setAISmartMessage(message, options = {}) {
    if (els.aiSmartContent) {
        els.aiSmartContent.innerHTML = buildAIStatusMarkup(message, options);
    }
}

function setAIConflictMessage(message, options = {}) {
    if (els.aiConflictContent) {
        els.aiConflictContent.innerHTML = buildAIStatusMarkup(message, options);
    }
}

function cancelScheduledAISuggestions() {
    if (aiSuggestionTimer) {
        clearTimeout(aiSuggestionTimer);
        aiSuggestionTimer = null;
    }
}

function resetAIInsights() {
    cancelScheduledAISuggestions();
    setAIStatus('Add participants to generate AI insights.');
    setAISmartMessage('Add participants to generate personalized recommendations.');
    if (AI_CONFIG.FEATURES.conflictResolver) {
        setAIConflictMessage('Add at least two participants to evaluate potential conflicts.');
    } else {
        setAIConflictMessage('The conflict resolver is disabled in this configuration.', { tone: 'warning' });
    }
}

function scheduleAISmartSuggestions(reason = 'update') {
    if (!AI_CONFIG.FEATURES.smartSuggestions) {
        cancelScheduledAISuggestions();
        setAIStatus('AI smart suggestions are disabled in this configuration.');
        setAISmartMessage('Enable AI smart suggestions in AI_CONFIG to use this feature.', { tone: 'warning' });
        return;
    }

    cancelScheduledAISuggestions();

    if (state.participants.length === 0) {
        resetAIInsights();
        return;
    }

    const statusMessage = reason === 'manual'
        ? 'AI will refresh insights shortly...'
        : 'AI will refresh insights in about 30 seconds...';

    setAIStatus(statusMessage, { loading: true });
    setAISmartMessage('Waiting a moment before running AI so you can finish editing participants...', { loading: true, tone: 'info' });
    if (AI_CONFIG.FEATURES.conflictResolver) {
        if (state.participants.length < 2) {
            setAIConflictMessage('Add at least two participants to evaluate potential conflicts.');
        } else {
            setAIConflictMessage('Waiting for AI insights before checking conflicts...', { loading: true, tone: 'info' });
        }
    } else {
        setAIConflictMessage('The conflict resolver is disabled in this configuration.', { tone: 'warning' });
    }

    aiSuggestionTimer = setTimeout(() => {
        aiSuggestionTimer = null;
        getAISmartSuggestions({ triggeredBy: 'auto', showToast: false });
    }, AI_SUGGESTION_DELAY);
}

const AI_SYSTEM_PROMPT = `You are TimeSync AI, a scheduling assistant.
- ALWAYS return valid JSON with double quotes and no trailing commas.
- Do NOT wrap the JSON in markdown fences or prose.
- Keep any explanations inside the JSON fields provided.
- If you cannot comply, return {"error":"Unable to complete request"}.`;

/**
 * Main AI API call function
 */
async function callAI(messages, options = {}) {
    const startTime = Date.now();

    try {
        const config = resolveAIConfig();

        const payload = {
            model: AI_CONFIG.MODEL,
            messages,
        };

        if (options.responseFormat) {
            payload.response_format = options.responseFormat;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (config.mode === 'direct') {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const referer = AI_CONFIG.DEFAULT_HEADERS?.referer;
        const title = AI_CONFIG.DEFAULT_HEADERS?.title;

        if (referer) {
            headers['HTTP-Referer'] = referer;
        }
        if (title) {
            headers['X-Title'] = title;
        }

        const endpoint = config.mode === 'proxy'
            ? config.url
            : `${config.url.replace(/\/chat\/completions$/, '').replace(/\/$/, '')}/chat/completions`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`AI request failed (${response.status}): ${errorText || response.statusText}`);
        }

        const data = await response.json();
        console.log(`AI request completed in ${Date.now() - startTime}ms`);
        return data;

    } catch (error) {
        let normalized = error instanceof Error ? error : new Error(String(error));
        if (normalized instanceof TypeError) {
            normalized = new Error('Network error contacting AI service. If you are calling the AI API directly, ensure it allows browser requests or enable the proxy.');
        }
        console.error('AI API Error:', normalized);
        throw normalized;
    }
}

/**
 * Show/hide loading overlay
 */
function showAILoading(message = 'AI is thinking...') {
    if (els.loadingOverlay) {
        els.loadingOverlay.classList.remove('hidden');
        if (els.loadingText) els.loadingText.textContent = message;
    }
}

function hideAILoading() {
    if (els.loadingOverlay) {
        els.loadingOverlay.classList.add('hidden');
    }
}

/**
 * FEATURE 1: AI Smart Time Suggestions
 */
async function getAISmartSuggestions(arg) {
    let options = {};

    if (arg && typeof arg === 'object') {
        if (typeof arg.preventDefault === 'function') {
            arg.preventDefault();
            options = { triggeredBy: 'manual', showToast: true };
        } else {
            options = arg;
        }
    }

    const triggeredBy = options.triggeredBy || 'manual';
    const showToastOnSuccess = options.showToast !== false;

    if (!AI_CONFIG.FEATURES.smartSuggestions) {
        setAIStatus('AI smart suggestions are disabled in this configuration.');
        setAISmartMessage('Enable AI smart suggestions in AI_CONFIG to use this feature.', { tone: 'warning' });
        if (triggeredBy !== 'auto') {
            toast('AI suggestions are disabled', 'info');
        }
        return;
    }

    cancelScheduledAISuggestions();

    if (state.participants.length === 0) {
        resetAIInsights();
        if (triggeredBy !== 'auto') {
            toast('Add participants first', 'warning');
        }
        return;
    }

    setAIStatus('AI is analyzing the latest availability...', { loading: true });
    setAISmartMessage('Crunching timezone overlap data...', { loading: true, tone: 'info' });

    try {
        const participantSummary = state.participants.map(p => {
            const offset = getTimezoneOffset(p.timezone);
            return `- ${p.name} (${p.timezone}, UTC${formatOffset(offset)}): ${p.start}-${p.end}, ${p.priority.toUpperCase()}`;
        }).join('\n');

        const currentSuggestions = calculateBestTimes().slice(0, 3);
        const suggestionContext = currentSuggestions.map((s, i) => {
            return `Suggestion ${i + 1}: ${s.start.toISOString()}, Score: ${s.score}, Available: ${s.available.length}/${state.participants.length}`;
        }).join('\n');

        const prompt = `You are an expert meeting scheduler. Analyze these participants and provide intelligent meeting time recommendations.

PARTICIPANTS:
${participantSummary}

MEETING DETAILS:
- Duration: ${state.duration} minutes
- Days to check: Next ${state.days} day(s)
- Current date: ${new Date().toISOString()}

CURRENT SYSTEM SUGGESTIONS:
${suggestionContext}

YOUR TASK:
1. Analyze timezone spread and compatibility
2. Identify the best 2-3 meeting times
3. Provide clear reasoning for each suggestion
4. Flag any concerns (early mornings, late nights)
5. Suggest alternatives if conflicts exist

IMPORTANT CONSIDERATIONS:
- REQUIRED participants must be available
- Avoid times before 7 AM or after 10 PM local time
- Prioritize core business hours (9 AM - 5 PM local)
- Be fair across all timezones
- Consider work-life balance

RESPONSE FORMAT (JSON only, no markdown):
{
  "overall_assessment": "Brief 1-2 sentence summary of timezone compatibility",
  "recommendations": [
    {
      "time_utc": "2024-01-15T14:00:00Z",
      "rating": "excellent|good|acceptable|challenging",
      "reasoning": "Why this time works well",
      "concerns": ["Any issues or compromises needed"],
      "local_times": {
        "participant_name": "10:00 AM (9-5 work hours)",
        "another_participant": "3:00 PM (core hours)"
      }
    }
  ],
  "conflict_solutions": ["Creative solutions if no perfect time exists"],
  "general_advice": "Additional scheduling tips"
}

I am strict about this Return ONLY valid JSON, no other text.`;

        const messages = [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ];

        const response = await callAI(messages, {
            responseFormat: { type: 'json_object' }
        });
        const content = getAIMessageContent(response, 'AI suggestion');
        const aiSuggestions = typeof content === 'string'
            ? parseAIJson(content, 'AI suggestion response')
            : content;

        displayAISuggestions(aiSuggestions);

        const hasConflictSolutions = Array.isArray(aiSuggestions?.conflict_solutions) && aiSuggestions.conflict_solutions.length > 0;

        if (hasConflictSolutions) {
            displayConflictSolutions(aiSuggestions.conflict_solutions);
        }

        if (AI_CONFIG.FEATURES.conflictResolver && state.participants.length >= 2 && !hasConflictSolutions) {
            await checkAndResolveConflicts();
        }

        const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setAIStatus(`AI insights updated at ${formattedTime}`, { loading: false });

        if (showToastOnSuccess) {
            toast('✨ AI analysis complete', 'success');
        }

    } catch (error) {
        console.error('AI Suggestions Error:', error);
        setAIStatus('AI analysis failed. Please try again.', { loading: false });
        setAISmartMessage(error.message || 'Unknown error while requesting AI suggestions.', { tone: 'error' });
        if (triggeredBy !== 'auto') {
            toast('AI analysis failed: ' + error.message, 'error');
        }
    }
}

/**
 * Display AI suggestions in UI
 */
function displayAISuggestions(aiData) {
    if (!els.aiSmartContent) return;

    if (!aiData || !Array.isArray(aiData.recommendations) || aiData.recommendations.length === 0) {
        setAISmartMessage('AI did not return any recommendations. Please try again.', { tone: 'warning' });
        return;
    }

    const generalAdvice = aiData.general_advice ? `
        <div class="text-sm text-purple-700 dark:text-purple-300 mb-3">
            <strong>Tip:</strong> ${escapeHtml(aiData.general_advice)}
        </div>
    ` : '';

    const recommendationsMarkup = aiData.recommendations.map((rec, idx) => {
        const ratingColors = {
            excellent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            good: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            acceptable: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            challenging: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        };

        const ratingClass = ratingColors[rec.rating] || ratingColors.good;
        const displayTime = rec.time_utc ? new Date(rec.time_utc).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        }) : 'Time TBD';

        const concernsMarkup = Array.isArray(rec.concerns) && rec.concerns.length > 0 ? `
                <div class="text-xs text-orange-600 dark:text-orange-400 mb-2">
                    <strong>Concerns:</strong> ${rec.concerns.map(c => escapeHtml(c)).join(', ')}
                </div>
            ` : '';

        const localTimesMarkup = rec.local_times ? Object.entries(rec.local_times).map(([name, time]) => `
                    <div class="flex items-center gap-2">
                        <span class="text-slate-500">•</span>
                        <span><strong>${escapeHtml(name)}:</strong> ${escapeHtml(time)}</span>
                    </div>
                `).join('') : '';

        return `
            <div class="glass p-3 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-sm">Option ${idx + 1}</span>
                    <span class="text-xs px-2 py-1 rounded ${ratingClass}">${escapeHtml((rec.rating || 'good').toUpperCase())}</span>
                </div>

                <div class="text-sm mb-2">
                    <strong>Time:</strong> ${escapeHtml(displayTime)}
                </div>

                <div class="text-xs text-slate-600 dark:text-slate-300 mb-2">
                    ${escapeHtml(rec.reasoning || 'No reasoning provided.')}
                </div>

                ${concernsMarkup}

                ${localTimesMarkup ? `
                    <div class="text-xs mt-2 space-y-1">
                        <div class="font-semibold">Local Times:</div>
                        ${localTimesMarkup}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    els.aiSmartContent.innerHTML = `
        <div class="text-sm text-purple-800 dark:text-purple-100 mb-3">
            <strong>Assessment:</strong> ${escapeHtml(aiData.overall_assessment || 'No assessment provided.')}
        </div>
        ${generalAdvice}
        <div class="space-y-3">
            <div class="text-xs font-semibold text-purple-900 dark:text-purple-100 uppercase tracking-wide">
                AI Recommended Times:
            </div>
            ${recommendationsMarkup}
        </div>
    `;
}

/**
 * FEATURE 2: Conflict Resolver
 * Automatically triggered when suggestions have low scores
 */
async function checkAndResolveConflicts() {
    if (!AI_CONFIG.FEATURES.conflictResolver) {
        setAIConflictMessage('The conflict resolver is disabled in this configuration.', { tone: 'warning' });
        return;
    }

    if (state.participants.length < 2) {
        setAIConflictMessage('Add at least two participants to evaluate potential conflicts.');
        return;
    }

    const suggestions = calculateBestTimes();

    if (suggestions.length === 0) {
        setAIConflictMessage('Generate meeting suggestions to analyze conflicts.', { tone: 'info' });
        return;
    }

    const avgScore = suggestions.reduce((sum, s) => sum + s.score, 0) / suggestions.length;
    const slotsNeeded = Math.ceil(state.duration / 30);
    const maxScore = (slotsNeeded * state.participants.length) + (2 * state.participants.filter(p => p.priority === 'required').length);
    const scorePercentage = maxScore > 0 ? (avgScore / maxScore) * 100 : 0;

    if (scorePercentage < 60) {
        setAIConflictMessage('Asking AI for creative alternatives to handle conflicts...', { loading: true, tone: 'warning' });
        await getConflictResolution();
    } else {
        setAIConflictMessage('No major conflicts detected. Overlap scores look healthy.', { tone: 'success' });
    }
}

/**
 * Get AI conflict resolution
 */
async function getConflictResolution() {
    try {
        const participantSummary = state.participants.map(p => {
            const offset = getTimezoneOffset(p.timezone);
            return `${p.name} (${p.timezone}, UTC${formatOffset(offset)}): ${p.start}-${p.end}, ${p.priority}`;
        }).join('\n');

        const prompt = `You are resolving scheduling conflicts for a meeting with challenging timezone differences.

PARTICIPANTS:
${participantSummary}

MEETING: ${state.duration} minutes

The current suggestions have low overlap scores, indicating significant timezone challenges.

Provide 3-5 creative, practical solutions. Be specific and actionable.

RESPONSE FORMAT (JSON only):
{
  "solutions": [
    "Specific actionable solution 1",
    "Specific actionable solution 2",
    "Specific actionable solution 3"
  ]
}

Examples of good solutions:
- "Split into 2 meetings: Americas/Europe at 2 PM UTC, Asia-Pacific at 9 AM UTC next day"
- "Use async standup format: Record 10-min updates, 15-min sync for questions at 3 PM UTC"
- "Rotate meeting times weekly to share the inconvenience fairly"

Return ONLY valid JSON.`;

        const messages = [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ];
        const response = await callAI(messages, {
            responseFormat: { type: 'json_object' }
        });

        const content = getAIMessageContent(response, 'AI conflict resolution');
        const data = typeof content === 'string'
            ? parseAIJson(content, 'AI conflict resolution response')
            : content;
        displayConflictSolutions(data.solutions);

    } catch (error) {
        console.error('Conflict resolution error:', error);
        setAIConflictMessage('AI conflict resolver failed: ' + (error.message || 'Unknown error'), { tone: 'error' });
    }
}

/**
 * Display conflict solutions
 */
function displayConflictSolutions(solutions) {
    if (!els.aiConflictContent) return;

    if (!solutions || solutions.length === 0) {
        setAIConflictMessage('AI could not find alternative solutions right now.', { tone: 'warning' });
        return;
    }

    const items = solutions.map(sol => `
        <li class="flex items-start gap-2">
            <span class="text-orange-500">→</span>
            <span>${escapeHtml(sol)}</span>
        </li>
    `).join('');

    els.aiConflictContent.innerHTML = `
        <p class="text-sm text-orange-700 dark:text-orange-300 mb-2">
            Your timezone spread makes finding perfect overlap difficult. Consider these AI-suggested alternatives:
        </p>
        <ul class="space-y-2 text-sm text-orange-700 dark:text-orange-300">
            ${items}
        </ul>
    `;
}

/**
 * FEATURE 3: Timezone Etiquette Checker
 * Add badges to existing suggestions
 */
function addEtiquetteBadges() {
    const suggestions = calculateBestTimes();

    suggestions.forEach((sug, idx) => {
        const card = document.querySelector(`[data-suggestion-index="${idx}"]`);
        if (!card) return;

        const badges = [];
        let allGood = true;

        sug.localTimes.forEach(lt => {
            if (!lt.available) return;

            const timeMatch = lt.time.match(/(\d+):(\d+)/);
            if (!timeMatch) return;

            let hour = parseInt(timeMatch[1], 10);
            const isPM = lt.time.toLowerCase().includes('pm');
            const isAM = lt.time.toLowerCase().includes('am');

            if (isAM && hour === 12) hour = 0;
            if (isPM && hour !== 12) hour += 12;

            if (hour < 7) {
                allGood = false;
                badges.push(`<span class="text-xs px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded">⚠️ Early for ${escapeHtml(lt.name)} (${hour}AM)</span>`);
            } else if (hour >= 22) {
                allGood = false;
                const adjusted = hour > 12 ? hour - 12 : hour;
                badges.push(`<span class="text-xs px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded">🌙 Late for ${escapeHtml(lt.name)} (${adjusted}PM)</span>`);
            }
        });

        if (allGood && sug.available.length === state.participants.length) {
            badges.push('<span class="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded">✅ Respectful for all</span>');
        }

        if (badges.length > 0) {
            const badgeContainer = document.createElement('div');
            badgeContainer.className = 'etiquette-badges flex flex-wrap gap-2 mt-2';
            badgeContainer.innerHTML = badges.join('');

            const existingBadges = card.querySelector('.etiquette-badges');
            if (existingBadges) existingBadges.remove();

            const insertionPoint = card.querySelector('.flex.flex-wrap.gap-2');
            if (insertionPoint) {
                insertionPoint.before(badgeContainer);
            } else {
                card.appendChild(badgeContainer);
            }
        }
    });
}

// ==================== INITIALIZATION ====================

function init() {
    console.log('🚀 TimeSync v2.1 initializing...');

    // Set theme based on user preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }

    // Populate timezone selects
    TIMEZONES.forEach(tz => {
        const opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = tz;
        if (els.tzSelect) els.tzSelect.appendChild(opt);

        const opt2 = opt.cloneNode(true);
        if (els.editTz) els.editTz.appendChild(opt2);
    });

    // Populate time range selects
    for (let i = 0; i <= 24; i++) {
        const label = i === 0 ? '12am' : i === 12 ? '12pm' : i < 12 ? `${i}am` : `${i - 12}pm`;

        const opt1 = document.createElement('option');
        opt1.value = i;
        opt1.textContent = label;
        if (els.timeRangeStart) els.timeRangeStart.appendChild(opt1);

        const opt2 = opt1.cloneNode(true);
        if (els.timeRangeEnd) els.timeRangeEnd.appendChild(opt2);
    }

    if (els.timeRangeEnd) els.timeRangeEnd.value = 24;

    // Detect user timezone
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (els.detectedTz) els.detectedTz.textContent = userTz;

    // Load from URL if present
    const params = new URLSearchParams(location.search);
    if (params.get('state')) {
        const decoded = decodeState(params.get('state'));
        if (decoded && decoded.participants && Array.isArray(decoded.participants)) {
            state.participants = decoded.participants;
            toast('Loaded from share link', 'success');
        }
    }

    // Initial render
    render();
    if (state.participants.length > 0) {
        scheduleAISmartSuggestions('initial-load');
    }
    attachEventListeners();
    setupKeyboardShortcuts();
    setupDragAndDrop();

    console.log('✅ TimeSync v2.1 initialized successfully');
    resetAIInsights();
}

// ==================== RENDERING ====================

function render() {
    renderParticipants();
    renderHeatmap();
    calculateAndRenderSuggestions();
    updateStats();
    updateViewDayOptions();
    renderAnalytics();
}

const renderDebounced = debounce(render, 200);

// ==================== PARTICIPANT MANAGEMENT ====================

function validateParticipant(name, timezone, start, end) {
    const errors = [];

    if (!name || name.trim().length === 0) {
        errors.push('Name is required');
    }

    if (name && name.length > 50) {
        errors.push('Name must be 50 characters or less');
    }

    if (!timezone || !TIMEZONES.includes(timezone)) {
        errors.push('Please select a valid timezone');
    }

    if (!start || !end) {
        errors.push('Start and end times are required');
    }

    if (start && end) {
        const startMin = parseTime(start);
        const endMin = parseTime(end);
        if (startMin === endMin) {
            errors.push('Start and end times cannot be the same');
        }
    }

    return errors;
}

function addParticipant() {
    const name = els.nameInput.value.trim();
    const tz = els.tzSelect.value;
    const start = els.startInput.value || '09:00';
    const end = els.endInput.value || '17:00';
    const priority = els.prioritySelect.value;

    // Validation
    const errors = validateParticipant(name, tz, start, end);
    if (errors.length > 0) {
        toast(errors[0], 'warning');
        els.nameInput.classList.add('error-shake');
        setTimeout(() => els.nameInput.classList.remove('error-shake'), 400);
        return;
    }

    if (state.participants.length >= 20) {
        toast('Maximum 20 participants allowed', 'error');
        return;
    }

    const participant = {
        id: uid(),
        name,
        timezone: tz,
        start,
        end,
        priority,
        color: generateColor(state.participants.length)
    };

    history.push({
        type: 'add',
        participant: { ...participant }
    });

    state.participants.push(participant);

    els.nameInput.value = '';
    els.tzSelect.value = '';

    render();
    scheduleAISmartSuggestions('participant-add');
    toast('✓ Participant added', 'success');
}

function removeParticipant(id) {
    const participant = state.participants.find(p => p.id === id);
    if (!participant) return;

    history.push({
        type: 'remove',
        participant: { ...participant },
        index: state.participants.findIndex(p => p.id === id)
    });

    state.participants = state.participants.filter(p => p.id !== id);
    render();
    scheduleAISmartSuggestions('participant-remove');
}

function editParticipant(id) {
    const participant = state.participants.find(p => p.id === id);
    if (!participant) return;

    currentEditId = id;
    els.editName.value = participant.name;
    els.editTz.value = participant.timezone;
    els.editStart.value = participant.start;
    els.editEnd.value = participant.end;
    els.editPriority.value = participant.priority || 'required';
    els.editModal.classList.remove('hidden');
}

function saveEdit() {
    if (!currentEditId) return;

    const participant = state.participants.find(p => p.id === currentEditId);
    if (!participant) return;

    const name = els.editName.value.trim();
    const timezone = els.editTz.value;
    const start = els.editStart.value;
    const end = els.editEnd.value;

    // Validation
    const errors = validateParticipant(name, timezone, start, end);
    if (errors.length > 0) {
        toast(errors[0], 'warning');
        return;
    }

    const oldParticipant = { ...participant };

    participant.name = name;
    participant.timezone = timezone;
    participant.start = start;
    participant.end = end;
    participant.priority = els.editPriority.value;

    history.push({
        type: 'edit',
        id: currentEditId,
        oldParticipant,
        newParticipant: { ...participant }
    });

    els.editModal.classList.add('hidden');
    currentEditId = null;
    render();
    scheduleAISmartSuggestions('participant-edit');
    toast('✓ Participant updated', 'success');
}

function performUndo() {
    const action = history.undo();
    if (!action) return;

    switch (action.type) {
        case 'add':
            state.participants = state.participants.filter(p => p.id !== action.participant.id);
            break;
        case 'remove':
            state.participants.splice(action.index, 0, action.participant);
            break;
        case 'edit':
            const p = state.participants.find(p => p.id === action.id);
            if (p) Object.assign(p, action.oldParticipant);
            break;
    }

    render();
    scheduleAISmartSuggestions('undo');
    toast('↶ Undone', 'info');
}

function performRedo() {
    const action = history.redo();
    if (!action) return;

    switch (action.type) {
        case 'add':
            state.participants.push(action.participant);
            break;
        case 'remove':
            state.participants.splice(action.index, 1);
            break;
        case 'edit':
            const p = state.participants.find(p => p.id === action.id);
            if (p) Object.assign(p, action.newParticipant);
            break;
    }

    render();
    scheduleAISmartSuggestions('redo');
    toast('↷ Redone', 'info');
}

// ==================== RENDERING PARTICIPANTS ====================

function renderParticipants() {
    const container = els.participantsContainer;
    if (!container) return;

    container.innerHTML = '';

    if (state.participants.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <div class="text-4xl mb-2">👥</div>
                <div class="text-sm">No participants yet</div>
                <div class="text-xs mt-1">Add some or load demo data</div>
            </div>
        `;
        return;
    }

    const filtered = state.searchTerm
        ? state.participants.filter(p =>
            p.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            p.timezone.toLowerCase().includes(state.searchTerm.toLowerCase())
        )
        : state.participants;

    const sorted = [...filtered].sort((a, b) => {
        const offsetA = getTimezoneOffset(a.timezone);
        const offsetB = getTimezoneOffset(b.timezone);
        return offsetA - offsetB;
    });

    sorted.forEach((p, idx) => {
        const el = document.createElement('div');
        el.className = 'glass p-4 rounded-xl transition-smooth hover:shadow-lg animate-slideIn';
        el.style.animationDelay = `${idx * 0.05}s`;
        el.draggable = true;
        el.dataset.id = p.id;

        const priorityBadge = p.priority === 'required'
            ? '<span class="priority-badge bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">⭐ Required</span>'
            : '<span class="priority-badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">◯ Optional</span>';

        el.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="drag-handle text-slate-400 hover:text-slate-600 cursor-grab" title="Drag to reorder">
                    ⋮⋮
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <div class="font-semibold truncate editable" data-field="name">${escapeHtml(p.name)}</div>
                        ${priorityBadge}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="editable" data-field="timezone">🌍 ${escapeHtml(p.timezone)}</span>
                        </div>
                        <div class="mt-1">
                            <span class="editable" data-field="time">⏰ ${formatTime(p.start, state.timeFormat)} - ${formatTime(p.end, state.timeFormat)}</span>
                            <span class="ml-2 text-slate-400">(${formatOffset(getTimezoneOffset(p.timezone))})</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-1">
                    <button class="edit-btn text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-lg transition-smooth text-sm">
                        ✏️
                    </button>
                    <button class="remove-btn text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-smooth text-sm">
                        ✕
                    </button>
                </div>
            </div>
        `;
        container.appendChild(el);
    });

    // Attach event listeners
    qsa('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('[data-id]').dataset.id;
            pendingRemoveId = id;
            lastRemoveBtn = e.currentTarget;
            const participant = state.participants.find(p => p.id === id);
            if (participant) {
                const nameNode = document.getElementById('removeParticipantName');
                if (nameNode) nameNode.textContent = participant.name;
            }
            els.removeParticipantModal.classList.remove('hidden');
        });
    });

    qsa('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('[data-id]').dataset.id;
            editParticipant(id);
        });
    });

    qsa('.editable').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.target.closest('[data-id]').dataset.id;
            editParticipant(id);
        });
    });
}

// ==================== DRAG AND DROP ====================

function setupDragAndDrop() {
    let draggedElement = null;

    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('[data-id]') && e.target.querySelector('.drag-handle')) {
            draggedElement = e.target.closest('[data-id]');
            draggedElement.classList.add('dragging');
        }
    });

    document.addEventListener('dragend', (e) => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            draggedElement = null;
        }
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(els.participantsContainer, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (!dragging) return;

        if (afterElement == null) {
            els.participantsContainer.appendChild(dragging);
        } else {
            els.participantsContainer.insertBefore(dragging, afterElement);
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        const newOrder = qsa('[data-id]').map(el => el.dataset.id);
        const reordered = newOrder.map(id => state.participants.find(p => p.id === id)).filter(Boolean);
        state.participants = reordered;
        toast('Participants reordered', 'success');
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('[data-id]:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ==================== HEATMAP ====================

function getHeatmapTooltip() {
    if (!heatmapTooltip) {
        heatmapTooltip = document.createElement('div');
        heatmapTooltip.id = 'heatmapTooltip';
        heatmapTooltip.style.position = 'fixed';
        heatmapTooltip.style.top = '-1000px';
        heatmapTooltip.style.left = '-1000px';
        heatmapTooltip.style.opacity = '0';
        heatmapTooltip.style.zIndex = '9999';
        heatmapTooltip.style.pointerEvents = 'none';
        heatmapTooltip.style.transition = 'opacity .15s ease, transform .15s ease';
        heatmapTooltip.style.transform = 'translate(-50%, -4px)';
        heatmapTooltip.className = 'bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-600 px-3 py-2 rounded-xl shadow-xl text-xs leading-snug backdrop-blur-sm';
        document.body.appendChild(heatmapTooltip);
    }
    return heatmapTooltip;
}

function hideHeatmapTooltip() {
    if (!heatmapTooltip) return;
    heatmapTooltip.style.opacity = '0';
    heatmapTooltip.style.transform = 'translate(-50%, -4px)';
    setTimeout(() => {
        if (heatmapTooltip.style.opacity === '0') {
            heatmapTooltip.style.top = '-1000px';
            heatmapTooltip.style.left = '-1000px';
        }
    }, 200);
}

window.addEventListener('scroll', hideHeatmapTooltip, true);
window.addEventListener('resize', hideHeatmapTooltip);

function renderHeatmap() {
    const container = els.heatmap;
    if (!container) return;

    container.innerHTML = '';

    if (state.participants.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <div class="text-4xl mb-2">📊</div>
                <div class="text-sm">Add participants to see availability</div>
            </div>
        `;
        return;
    }

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + state.currentViewDay);

    const slots = calculateSlotAvailability(baseDate);

    // Filter slots based on time range
    const startSlot = state.timeRangeStart * 2;
    const endSlot = state.timeRangeEnd * 2;
    const visibleSlots = slots.slice(startSlot, endSlot);

    // Detect golden hours
    const goldenThreshold = Math.ceil(state.participants.length * 0.8);
    const goldenHours = [];
    visibleSlots.forEach((slot, i) => {
        if (slot.count >= goldenThreshold) {
            const hour = Math.floor((startSlot + i) / 2);
            const minute = ((startSlot + i) % 2) * 30;
            goldenHours.push(`${pad(hour)}:${pad(minute)} UTC`);
        }
    });

    if (goldenHours.length > 0) {
        els.goldenHoursInfo.classList.remove('hidden');
        els.goldenHoursList.textContent = goldenHours.join(', ');
    } else {
        els.goldenHoursInfo.classList.add('hidden');
    }

    // Create header row
    const headerRow = document.createElement('div');
    headerRow.className = 'flex gap-1 mb-2';

    for (let i = startSlot; i < endSlot; i++) {
        const hour = Math.floor(i / 2);
        const minute = (i % 2) * 30;
        const cell = document.createElement('div');
        cell.className = 'cell text-xs text-slate-500 dark:text-white';

        if (minute === 0) {
            cell.textContent = formatHourLabel(hour, state.timeFormat);
        } else {
            cell.textContent = '';
        }

        headerRow.appendChild(cell);
    }
    container.appendChild(headerRow);

    // Create availability row
    const availRow = document.createElement('div');
    availRow.className = 'flex gap-1';

    visibleSlots.forEach((slot, idx) => {
        const i = startSlot + idx;
        const cell = document.createElement('div');
        cell.className = 'cell cursor-pointer';
        cell.dataset.slot = i;

        const level = state.participants.length > 0
            ? Math.round((slot.count / state.participants.length) * 10)
            : 0;

        cell.classList.add(...getColorClass(level).split(' '));

        if (slot.hasConflict) {
            cell.classList.add('conflict');
        }

        if (slot.count >= goldenThreshold) {
            cell.classList.add('golden');
        }

        cell.textContent = slot.count || '—';

        // Tooltip
        cell.addEventListener('mouseenter', () => {
            const hour = Math.floor(i / 2);
            const minute = (i % 2) * 30;
            const timeStr = `${pad(hour)}:${pad(minute)} UTC`;
            const tt = getHeatmapTooltip();
            tt.innerHTML = `
                <div class="font-semibold text-sm mb-1">${timeStr}</div>
                <div class="text-xs text-slate-700 dark:text-slate-300">
                    ${slot.count > 0 ? `${slot.count}/${state.participants.length} available` : 'No one available'}
                </div>
                ${slot.participants.length > 0 ? `
                    <div class="mt-2 text-xs space-y-1">
                        ${slot.participants.map(p => `
                            <div class="flex items-center gap-1">
                                <div class="initials" style="background: ${p.color}; width: 16px; height: 16px; font-size: 0.5rem;">
                                    ${getInitials(p.name)}
                                </div>
                                <span>${escapeHtml(p.name)}</span>
                                ${p.isConflict ? '<span class="text-red-500">⚠️</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${slot.hasConflict ? '<div class="text-xs text-red-500 mt-2">⚠️ Inconvenient for some</div>' : ''}
                ${slot.count >= goldenThreshold ? '<div class="text-xs text-yellow-600 mt-2">⭐ Golden hour!</div>' : ''}
            `;
            const rect = cell.getBoundingClientRect();
            const desiredLeft = rect.left + rect.width / 2;
            let top = rect.top - 10;
            const ttHeight = tt.offsetHeight || 0;
            let placeBelow = false;
            if (top - ttHeight < 8) {
                top = rect.bottom + 10;
                placeBelow = true;
            }
            tt.style.left = desiredLeft + 'px';
            tt.style.top = top + 'px';
            tt.style.transform = placeBelow ? 'translate(-50%, 6px)' : 'translate(-50%, -6px)';
            requestAnimationFrame(() => {
                tt.style.opacity = '1';
                tt.style.transform = placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -10px)';
            });
        });

        cell.addEventListener('mouseleave', hideHeatmapTooltip);
        availRow.appendChild(cell);
    });

    container.appendChild(availRow);
}

function calculateSlotAvailability(baseDate) {
    const cacheKey = `slots-${baseDate.toDateString()}-${JSON.stringify(state.participants.map(p => p.id))}`;

    if (state.cache[cacheKey]) {
        return state.cache[cacheKey];
    }

    const slots = Array.from({ length: 48 }, () => ({
        count: 0,
        participants: [],
        hasConflict: false
    }));

    const year = baseDate.getUTCFullYear();
    const month = baseDate.getUTCMonth();
    const date = baseDate.getUTCDate();

    state.participants.forEach(p => {
        for (let i = 0; i < 48; i++) {
            const utcDate = new Date(Date.UTC(year, month, date, 0, i * 30));

            try {
                const parts = new Intl.DateTimeFormat('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: p.timezone
                }).formatToParts(utcDate);

                const localHour = parseInt(parts.find(x => x.type === 'hour').value);
                const localMin = parseInt(parts.find(x => x.type === 'minute').value);
                const localMinutes = localHour * 60 + localMin;

                const startMin = parseTime(p.start);
                const endMin = parseTime(p.end);

                if (state.excludeLunch) {
                    const lunchStart = 12 * 60;
                    const lunchEnd = 13 * 60;
                    if (localMinutes >= lunchStart && localMinutes < lunchEnd) {
                        continue;
                    }
                }

                const isConflict = localHour < 7 || localHour >= 22;

                if (isInRange(localMinutes, startMin, endMin)) {
                    slots[i].count++;
                    slots[i].participants.push({
                        name: p.name,
                        color: p.color,
                        isConflict
                    });

                    if (isConflict) {
                        slots[i].hasConflict = true;
                    }
                }
            } catch (e) {
                console.error('Error calculating slot for timezone:', p.timezone, e);
            }
        }
    });

    state.cache[cacheKey] = slots;
    return slots;
}

// ==================== SUGGESTIONS ====================

function calculateAndRenderSuggestions() {
    const container = els.suggestions;
    if (!container) return;

    if (state.participants.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <div class="text-4xl mb-2">✨</div>
                <div class="text-sm">Add participants to get suggestions</div>
            </div>
        `;
        return;
    }

    const suggestions = calculateBestTimes();

    if (suggestions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <div class="text-4xl mb-2">😔</div>
                <div class="text-sm">No overlapping availability found</div>
                <div class="text-xs mt-2">Try adjusting participant hours or settings</div>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    suggestions.forEach((sug, idx) => {
        const card = document.createElement('div');
        card.className = 'glass p-4 rounded-xl transition-smooth hover:shadow-xl animate-slideIn';
        card.style.animationDelay = `${idx * 0.1}s`;
        card.dataset.suggestionIndex = idx;

        const startDate = sug.start;
        const endDate = new Date(startDate.getTime() + state.duration * 60000);

        const requiredCount = sug.localTimes.filter(lt => lt.priority === 'required' && lt.available).length;
        const totalRequired = state.participants.filter(p => p.priority === 'required').length;
        const slotsNeeded = Math.ceil(state.duration / 30);
        const maxScore = (slotsNeeded * state.participants.length) + (2 * totalRequired);
        const pct = maxScore > 0 ? Math.min(sug.score / maxScore, 1) : 0;
        const eased = Math.pow(pct, 0.95);
        const hue = Math.round(eased * 120);
        const scoreColor = `hsl(${hue} 65% 40%)`;

        card.innerHTML = `
            <div class="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-lg">${formatDateTime(startDate)}</div>
                    <div class="text-xs text-slate-500 mt-1">
                        ${formatDay(startDate)} • ${state.duration} minutes
                    </div>
                    ${totalRequired > 0 ? `
                        <div class="text-xs mt-1 ${requiredCount === totalRequired ? 'text-green-600' : 'text-orange-600'}">
                            ${requiredCount}/${totalRequired} required participants available
                        </div>
                    ` : ''}
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold leading-tight" style="color:${scoreColor}">
                        ${sug.score}<span class="text-base text-slate-400">/${maxScore}</span>
                    </div>
                    <div class="mt-1 h-1.5 w-20 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div class="h-full" style="background:${scoreColor};width:${(pct * 100).toFixed(1)}%"></div>
                    </div>
                    <div class="text-[10px] uppercase tracking-wide text-slate-400 mt-1">Score</div>
                </div>
            </div>

            <div class="mb-3 pb-3 border-b border-slate-200 dark:border-slate-600">
                <div class="text-xs font-semibold mb-2 text-slate-600 dark:text-slate-300">
                    ${sug.available.length}/${state.participants.length} participants available
                </div>
                <div class="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    ${sug.localTimes.map(lt => `
                        <div class="flex items-center gap-2 text-xs">
                            <div class="initials" style="background: ${lt.color}; width: 20px; height: 20px; font-size: 0.55rem;">
                                ${getInitials(lt.name)}
                            </div>
                            <span class="font-medium ${lt.priority === 'required' ? 'text-yellow-600' : ''}">${escapeHtml(lt.name)}${lt.priority === 'required' ? ' ⭐' : ''}:</span>
                            <span class="text-slate-600 dark:text-slate-300">${lt.time}</span>
                            ${!lt.available ? '<span class="text-red-500 text-xs">⚠️ unavailable</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="flex flex-wrap gap-2">
                <button class="add-google px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs transition-smooth" data-index="${idx}">
                    📅 Google
                </button>
                <button class="add-outlook px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-smooth" data-index="${idx}">
                    📧 Outlook
                </button>
                <button class="export-ics px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs transition-smooth" data-index="${idx}">
                    📄 .ics
                </button>
                <button class="copy-invite px-3 py-2 border-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-smooth" data-index="${idx}">
                    📋 Copy
                </button>
            </div>
        `;

        container.appendChild(card);
    });

    // Attach event listeners for calendar exports
    qsa('.export-ics').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.closest('button').dataset.index);
            downloadICS(suggestions[idx]);
        });
    });

    qsa('.add-google').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.closest('button').dataset.index);
            openGoogleCalendar(suggestions[idx]);
        });
    });

    qsa('.add-outlook').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.closest('button').dataset.index);
            openOutlookCalendar(suggestions[idx]);
        });
    });

    qsa('.copy-invite').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.closest('button').dataset.index);
            copyEmailTemplate(suggestions[idx]);
        });
    });

    if (AI_CONFIG.FEATURES.etiquetteChecker) {
        addEtiquetteBadges();
    }
}

function calculateBestTimes() {
    const results = [];
    const slotsNeeded = Math.ceil(state.duration / 30);

    for (let day = 0; day < state.days; day++) {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + day);

        const slots = calculateSlotAvailability(baseDate);

        for (let i = 0; i <= 48 - slotsNeeded; i++) {
            let score = 0;
            let availableSet = new Set();
            let requiredScore = 0;

            for (let j = 0; j < slotsNeeded; j++) {
                score += slots[i + j].count;
                slots[i + j].participants.forEach(p => availableSet.add(p.name));
            }

            state.participants.forEach(p => {
                if (p.priority === 'required' && availableSet.has(p.name)) {
                    requiredScore += 2;
                }
            });

            score += requiredScore;

            if (score > 0) {
                const startMinutes = i * 30;
                const startDate = new Date(Date.UTC(
                    baseDate.getUTCFullYear(),
                    baseDate.getUTCMonth(),
                    baseDate.getUTCDate(),
                    0,
                    startMinutes
                ));

                const localTimes = state.participants.map(p => {
                    try {
                        const localStr = startDate.toLocaleString('en-US', {
                            timeZone: p.timezone,
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: state.timeFormat === '12h'
                        });

                        return {
                            name: p.name,
                            time: localStr,
                            available: availableSet.has(p.name),
                            color: p.color,
                            priority: p.priority || 'required'
                        };
                    } catch (e) {
                        console.error('Error formatting local time:', e);
                        return {
                            name: p.name,
                            time: 'Error',
                            available: false,
                            color: p.color,
                            priority: p.priority || 'required'
                        };
                    }
                });

                results.push({
                    start: startDate,
                    score,
                    available: Array.from(availableSet),
                    localTimes,
                    day
                });
            }
        }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, state.maxSuggestions);
}

function copyEmailTemplate(suggestion) {
    const start = suggestion.start;
    const end = new Date(start.getTime() + state.duration * 60000);

    const template = `Subject: Meeting Invitation - ${formatDateTime(start)}

Hi team,

I'd like to invite you to a meeting at the following time:

📅 Date: ${formatDay(start)}, ${formatDate(start, state.dateFormat)}
⏰ Time: ${formatDateTime(start)} - ${formatDateTime(end)} UTC

Local times for participants:
${suggestion.localTimes.map(lt => `  • ${lt.name}: ${lt.time}${!lt.available ? ' (unavailable)' : ''}`).join('\n')}

Available participants: ${suggestion.available.join(', ')}

Please confirm your attendance.

---
Generated by TimeSync`;

    navigator.clipboard.writeText(template).then(() => {
        toast('✓ Email template copied', 'success');
    }).catch(() => {
        toast('Failed to copy to clipboard', 'error');
    });
}

function downloadICS(suggestion) {
    const start = suggestion.start;
    const end = new Date(start.getTime() + state.duration * 60000);

    const formatICSDate = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//TimeSync v2.1//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:timesync-${Date.now()}@timesync.app`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(start)}`,
        `DTEND:${formatICSDate(end)}`,
        `SUMMARY:Team Meeting (${suggestion.available.length} participants)`,
        `DESCRIPTION:Suggested by TimeSync\\n\\nParticipants:\\n${suggestion.available.join('\\n')}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `meeting-${start.toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    toast('✓ Calendar event downloaded', 'success');
}

// ==================== ANALYTICS ====================

function renderAnalytics() {
    const container = els.analyticsContent;
    if (!container) return;

    if (state.participants.length < 2) {
        container.innerHTML = `
            <div class="text-center py-4 text-slate-400">
                <div class="text-2xl mb-1">📊</div>
                <div class="text-xs">Add 2+ participants for analytics</div>
            </div>
        `;
        return;
    }

    // Calculate timezone compatibility score
    const score = calculateTimezoneCompatibility();

    // Find worst combinations
    const worstPairs = findWorstTimezonePairs();

    container.innerHTML = `
        <div class="space-y-3">
            <div class="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div class="text-xs font-semibold mb-2">Timezone Compatibility Score</div>
                <div class="flex items-center gap-3">
                    <div class="text-2xl font-bold ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'}">${score}/100</div>
                    <div class="flex-1">
                        <div class="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div class="h-full ${score >= 70 ? 'bg-green-600' : score >= 40 ? 'bg-yellow-600' : 'bg-red-600'}" style="width: ${score}%"></div>
                        </div>
                    </div>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    ${score >= 70 ? '✓ Excellent overlap potential' : score >= 40 ? '⚠️ Moderate overlap - compromise needed' : '❌ Poor overlap - consider splitting meetings'}
                </div>
            </div>

            ${worstPairs.length > 0 ? `
                <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div class="text-xs font-semibold mb-2 text-red-800 dark:text-red-200">⚠️ Difficult Pairings</div>
                    <div class="space-y-1">
                        ${worstPairs.map(pair => `
                            <div class="text-xs text-red-700 dark:text-red-300">
                                ${escapeHtml(pair.p1)} & ${escapeHtml(pair.p2)}: ${pair.overlap}hr overlap
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function calculateTimezoneCompatibility() {
    if (state.participants.length < 2) return 0;

    const baseDate = new Date();
    const slots = calculateSlotAvailability(baseDate);

    // Calculate average availability per slot
    const avgAvailability = slots.reduce((sum, slot) => sum + slot.count, 0) / slots.length;
    const maxPossible = state.participants.length;

    // Calculate golden hours (80%+ available)
    const goldenThreshold = Math.ceil(state.participants.length * 0.8);
    const goldenSlots = slots.filter(s => s.count >= goldenThreshold).length;

    // Score based on average availability and golden hours
    const avgScore = (avgAvailability / maxPossible) * 60;
    const goldenScore = (goldenSlots / 48) * 40;

    return Math.round(avgScore + goldenScore);
}

function findWorstTimezonePairs() {
    if (state.participants.length < 2) return [];

    const pairs = [];

    for (let i = 0; i < state.participants.length; i++) {
        for (let j = i + 1; j < state.participants.length; j++) {
            const p1 = state.participants[i];
            const p2 = state.participants[j];

            const overlap = calculatePairOverlap(p1, p2);

            if (overlap < 3) {
                pairs.push({
                    p1: p1.name,
                    p2: p2.name,
                    overlap
                });
            }
        }
    }

    return pairs.sort((a, b) => a.overlap - b.overlap).slice(0, 3);
}

function calculatePairOverlap(p1, p2) {
    const baseDate = new Date();
    const year = baseDate.getUTCFullYear();
    const month = baseDate.getUTCMonth();
    const date = baseDate.getUTCDate();

    let overlapSlots = 0;

    for (let i = 0; i < 48; i++) {
        const utcDate = new Date(Date.UTC(year, month, date, 0, i * 30));

        try {
            const parts1 = new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: p1.timezone
            }).formatToParts(utcDate);

            const parts2 = new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: p2.timezone
            }).formatToParts(utcDate);

            const local1 = parseInt(parts1.find(x => x.type === 'hour').value) * 60 +
                parseInt(parts1.find(x => x.type === 'minute').value);
            const local2 = parseInt(parts2.find(x => x.type === 'hour').value) * 60 +
                parseInt(parts2.find(x => x.type === 'minute').value);

            const start1 = parseTime(p1.start);
            const end1 = parseTime(p1.end);
            const start2 = parseTime(p2.start);
            const end2 = parseTime(p2.end);

            if (isInRange(local1, start1, end1) && isInRange(local2, start2, end2)) {
                overlapSlots++;
            }
        } catch (e) {
            console.error('Error calculating pair overlap:', e);
        }
    }

    return Math.round((overlapSlots * 0.5) * 10) / 10;
}

// ==================== STATS ====================

function updateStats() {
    if (els.statsParticipants) els.statsParticipants.textContent = state.participants.length;

    if (state.participants.length === 0) {
        if (els.statsTimezones) els.statsTimezones.textContent = '0 hrs';
        if (els.statsCompatibility) els.statsCompatibility.textContent = '—';
        return;
    }

    const offsets = state.participants.map(p => getTimezoneOffset(p.timezone));
    const spread = Math.max(...offsets) - Math.min(...offsets);
    if (els.statsTimezones) els.statsTimezones.textContent = `${(spread / 60).toFixed(1)} hrs`;

    const score = calculateTimezoneCompatibility();
    if (els.statsCompatibility) els.statsCompatibility.textContent = `${score}/100`;
}

function updateViewDayOptions() {
    if (!els.viewDaySelect) return;

    els.viewDaySelect.innerHTML = '';
    for (let i = 0; i < state.days; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        const date = new Date();
        date.setDate(date.getDate() + i);
        opt.textContent = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        els.viewDaySelect.appendChild(opt);
    }
}

// ==================== UTILITY FUNCTIONS ====================

function getInitials(name) {
    if (!name) return '';
    const parts = name
        .split(/\s+/)
        .map(p => p.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
        .filter(p => /[A-Za-z0-9]/.test(p));
    if (parts.length === 0) return '';
    const initials = parts
        .slice(0, 2)
        .map(p => p[0].toUpperCase())
        .join('');
    return initials;
}

function generateColor(index) {
    const colors = [
        '#14b8a6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b',
        '#10b981', '#3b82f6', '#6366f1', '#ef4444', '#84cc16'
    ];
    return colors[index % colors.length];
}

function getTimezoneOffset(tz) {
    try {
        const now = new Date();
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
        return (tzDate - utcDate) / 60000;
    } catch (e) {
        console.error('Error getting timezone offset:', e);
        return 0;
    }
}

function formatOffset(minutes) {
    const sign = minutes >= 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    return `UTC${sign}${hours}${mins ? ':' + pad(mins) : ''}`;
}

function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatTime(timeStr, format) {
    const [h, m] = timeStr.split(':').map(Number);

    if (format === '24h') {
        return `${pad(h)}:${pad(m)}`;
    }

    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${pad(m)} ${period}`;
}

function formatHourLabel(hour, format) {
    if (format === '24h') {
        return `${pad(hour)}:00`;
    }

    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function isInRange(minutes, start, end) {
    if (start <= end) {
        return minutes >= start && minutes < end;
    }
    return minutes >= start || minutes < end;
}

function getColorClass(level) {
    if (level === 0) return 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300';
    if (level <= 2) return 'bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200';
    if (level <= 4) return 'bg-emerald-200 dark:bg-emerald-700 text-emerald-800 dark:text-emerald-200';
    if (level <= 6) return 'bg-emerald-400 dark:bg-emerald-600 text-white';
    if (level <= 8) return 'bg-emerald-500 dark:bg-emerald-500 text-white';
    return 'bg-emerald-700 dark:bg-emerald-400 text-white';
}

function formatDateTime(date) {
    const opts = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: state.timeFormat === '12h'
    };
    return date.toLocaleString('en-US', opts);
}

function formatDate(date, format) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    switch (format) {
        case 'DD/MM/YYYY':
            return `${pad(day)}/${pad(month)}/${year}`;
        case 'YYYY-MM-DD':
            return `${year}-${pad(month)}-${pad(day)}`;
        default:
            return `${pad(month)}/${pad(day)}/${year}`;
    }
}

function formatDay(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

// ==================== URL SHARING ====================

function shareLink() {
    const data = { participants: state.participants };
    const encoded = encodeState(data);

    if (!encoded) {
        toast('Failed to create share link', 'error');
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('state', encoded);

    navigator.clipboard.writeText(url.toString()).then(() => {
        toast('✓ Share link copied to clipboard', 'success');
    }).catch(() => {
        toast('Failed to copy to clipboard', 'error');
    });
}

// ==================== BULK IMPORT ====================

function bulkImport() {
    const text = els.bulkTextarea.value.trim();
    if (!text) {
        toast('Please enter participant data', 'warning');
        return;
    }

    const lines = text.split('\n').filter(l => l.trim());
    let imported = 0;
    let skipped = 0;

    lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            const [name, tz, start = '09:00', end = '17:00', priority = 'required'] = parts;

            const errors = validateParticipant(name, tz, start, end);

            if (errors.length === 0 && TIMEZONES.includes(tz)) {
                state.participants.push({
                    id: uid(),
                    name,
                    timezone: tz,
                    start,
                    end,
                    priority,
                    color: generateColor(state.participants.length)
                });
                imported++;
            } else {
                skipped++;
            }
        } else {
            skipped++;
        }
    });

    if (imported > 0) {
        els.bulkModal.classList.add('hidden');
        els.bulkTextarea.value = '';
        render();
        scheduleAISmartSuggestions('bulk-import');
        toast(`✓ Imported ${imported} participants${skipped > 0 ? ` (${skipped} skipped)` : ''}`, 'success');
    } else {
        toast('No valid participants found', 'error');
    }
}

// ==================== DEMO DATA ====================

function loadDemo() {
    state.participants = [
        { id: uid(), name: 'Alice (NYC)', timezone: 'America/New_York', start: '09:00', end: '17:00', priority: 'required', color: '#14b8a6' },
        { id: uid(), name: 'Bob (London)', timezone: 'Europe/London', start: '08:30', end: '16:30', priority: 'required', color: '#06b6d4' },
        { id: uid(), name: 'Chen (Beijing)', timezone: 'Asia/Shanghai', start: '09:00', end: '18:00', priority: 'optional', color: '#8b5cf6' },
        { id: uid(), name: 'Diana (Sydney)', timezone: 'Australia/Sydney', start: '09:00', end: '17:00', priority: 'optional', color: '#ec4899' },
        { id: uid(), name: 'Erik (Berlin)', timezone: 'Europe/Berlin', start: '08:00', end: '16:00', priority: 'required', color: '#f59e0b' }
    ];

    render();
    scheduleAISmartSuggestions('demo');
    toast('✓ Demo data loaded', 'success');
}

// ==================== KEYBOARD SHORTCUTS ====================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Save: Ctrl/Cmd + S (disabled for now since we're not using localStorage)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            toast('Auto-save in memory only', 'info');
        }

        // New participant: Ctrl/Cmd + N
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (els.nameInput) els.nameInput.focus();
        }

        // Undo: Ctrl/Cmd + Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            performUndo();
        }

        // Redo: Ctrl/Cmd + Shift + Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
            e.preventDefault();
            performRedo();
        }
    });
}

// ==================== EVENT LISTENERS ====================

function attachEventListeners() {
    // Add participant
    if (els.addBtn) els.addBtn.addEventListener('click', addParticipant);

    // Quick add
    if (els.quickAddBtn) {
        els.quickAddBtn.addEventListener('click', () => {
            const names = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley'];
            const name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
            const tz = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];

            state.participants.push({
                id: uid(),
                name,
                timezone: tz,
                start: '09:00',
                end: '17:00',
                priority: 'required',
                color: generateColor(state.participants.length)
            });

            render();
            scheduleAISmartSuggestions('quick-add');
            toast('✓ Random participant added', 'success');
        });
    }

    // Enter key to add participant
    if (els.nameInput) {
        els.nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addParticipant();
        });
    }

    // Search participants
    if (els.participantSearch) {
        els.participantSearch.addEventListener('input', (e) => {
            state.searchTerm = e.target.value;
            renderParticipants();
        });
    }

    // Demo button
    if (els.demoBtn) els.demoBtn.addEventListener('click', loadDemo);

    // Share button
    if (els.shareBtn) els.shareBtn.addEventListener('click', shareLink);

    // AI Smart Suggestions button
    if (els.aiSuggestBtn) {
        els.aiSuggestBtn.addEventListener('click', getAISmartSuggestions);
    }

    // Theme toggle
    if (els.toggleTheme) {
        els.toggleTheme.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            toast('Theme toggled', 'info');
        });
    }

    // Clear all button
    if (els.clearAllBtn) {
        els.clearAllBtn.addEventListener('click', () => {
            if (state.participants.length === 0) {
                toast('No participants to clear', 'info');
                return;
            }
            els.clearAllModal.classList.remove('hidden');
        });
    }

    // Duration select
    if (els.durationSelect) {
        els.durationSelect.addEventListener('change', () => {
            state.duration = parseInt(els.durationSelect.value);
            calculateAndRenderSuggestions();
        });
    }

    // Days select
    if (els.daysSelect) {
        els.daysSelect.addEventListener('change', () => {
            state.days = parseInt(els.daysSelect.value);
            updateViewDayOptions();
            calculateAndRenderSuggestions();
        });
    }

    // Max suggestions
    if (els.maxSuggestions) {
        els.maxSuggestions.addEventListener('change', () => {
            state.maxSuggestions = parseInt(els.maxSuggestions.value);
            calculateAndRenderSuggestions();
        });
    }

    // Exclude lunch
    if (els.excludeLunch) {
        els.excludeLunch.addEventListener('change', () => {
            state.excludeLunch = els.excludeLunch.checked;
            render();
        });
    }

    // View day select
    if (els.viewDaySelect) {
        els.viewDaySelect.addEventListener('change', () => {
            state.currentViewDay = parseInt(els.viewDaySelect.value);
            renderHeatmap();
        });
    }

    // Refresh suggestions
    if (els.refreshSuggestionsBtn) {
        els.refreshSuggestionsBtn.addEventListener('click', () => {
            state.cache = {};
            calculateAndRenderSuggestions();
            scheduleAISmartSuggestions('refresh');
            toast('✓ Suggestions refreshed', 'success');
        });
    }

    // Date format
    if (els.dateFormatSelect) {
        els.dateFormatSelect.addEventListener('change', () => {
            state.dateFormat = els.dateFormatSelect.value;
            calculateAndRenderSuggestions();
        });
    }

    // Time format
    if (els.timeFormatSelect) {
        els.timeFormatSelect.addEventListener('change', () => {
            state.timeFormat = els.timeFormatSelect.value;
            render();
        });
    }

    // Time range
    if (els.timeRangeStart) {
        els.timeRangeStart.addEventListener('change', () => {
            state.timeRangeStart = parseInt(els.timeRangeStart.value);
            if (state.timeRangeStart >= state.timeRangeEnd) {
                state.timeRangeEnd = Math.min(state.timeRangeStart + 1, 24);
                els.timeRangeEnd.value = state.timeRangeEnd;
            }
            renderHeatmap();
        });
    }

    if (els.timeRangeEnd) {
        els.timeRangeEnd.addEventListener('change', () => {
            state.timeRangeEnd = parseInt(els.timeRangeEnd.value);
            if (state.timeRangeEnd <= state.timeRangeStart) {
                state.timeRangeStart = Math.max(state.timeRangeEnd - 1, 0);
                els.timeRangeStart.value = state.timeRangeStart;
            }
            renderHeatmap();
        });
    }

    // Undo/Redo
    if (els.undoBtn) els.undoBtn.addEventListener('click', performUndo);
    if (els.redoBtn) els.redoBtn.addEventListener('click', performRedo);

    // Bulk import
    if (els.bulkImportBtn) {
        els.bulkImportBtn.addEventListener('click', () => {
            els.bulkModal.classList.remove('hidden');
            if (els.bulkTextarea) els.bulkTextarea.focus();
        });
    }

    if (els.closeBulkModal) {
        els.closeBulkModal.addEventListener('click', () => {
            els.bulkModal.classList.add('hidden');
        });
    }

    if (els.bulkImportCancel) {
        els.bulkImportCancel.addEventListener('click', () => {
            els.bulkModal.classList.add('hidden');
        });
    }

    if (els.bulkImportConfirm) {
        els.bulkImportConfirm.addEventListener('click', bulkImport);
    }

    // Edit modal
    if (els.editConfirm) els.editConfirm.addEventListener('click', saveEdit);

    if (els.editCancel) {
        els.editCancel.addEventListener('click', () => {
            els.editModal.classList.add('hidden');
            currentEditId = null;
        });
    }

    // Clear all modal
    if (els.clearAllCancel) {
        els.clearAllCancel.addEventListener('click', () => {
            els.clearAllModal.classList.add('hidden');
        });
    }

    if (els.clearAllConfirm) {
        els.clearAllConfirm.addEventListener('click', () => {
            state.participants = [];
            render();
            resetAIInsights();
            toast('All participants cleared', 'info');
            els.clearAllModal.classList.add('hidden');
        });
    }

    // Remove participant modal
    if (els.removeParticipantCancel) {
        els.removeParticipantCancel.addEventListener('click', () => {
            els.removeParticipantModal.classList.add('hidden');
            pendingRemoveId = null;
        });
    }

    if (els.removeParticipantConfirm) {
        els.removeParticipantConfirm.addEventListener('click', () => {
            if (pendingRemoveId) {
                removeParticipant(pendingRemoveId);
                toast('Participant removed', 'info');
            }
            els.removeParticipantModal.classList.add('hidden');
            pendingRemoveId = null;
        });
    }

    // Settings panel
    if (els.settingsToggleFloating && els.settingsPanel) {
        const openPanel = () => {
            els.settingsPanel.classList.remove('hidden');
            requestAnimationFrame(() => {
                els.settingsPanel.classList.remove('opacity-0', 'scale-95');
                els.settingsPanel.classList.add('opacity-100', 'scale-100');
                els.settingsToggleFloating.setAttribute('aria-expanded', 'true');
            });
        };

        const closePanel = () => {
            els.settingsPanel.classList.add('opacity-0', 'scale-95');
            els.settingsPanel.classList.remove('opacity-100', 'scale-100');
            els.settingsToggleFloating.setAttribute('aria-expanded', 'false');
            setTimeout(() => {
                if (els.settingsToggleFloating.getAttribute('aria-expanded') === 'false') {
                    els.settingsPanel.classList.add('hidden');
                }
            }, 160);
        };

        const togglePanel = () => {
            const expanded = els.settingsToggleFloating.getAttribute('aria-expanded') === 'true';
            if (expanded) closePanel(); else openPanel();
        };

        els.settingsToggleFloating.addEventListener('click', togglePanel);

        if (els.closeSettingsPanel) {
            els.closeSettingsPanel.addEventListener('click', closePanel);
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!els.settingsPanel.classList.contains('hidden')) {
                if (!els.settingsPanel.contains(e.target) && e.target !== els.settingsToggleFloating) {
                    closePanel();
                }
            }
        });
    }

    // Escape key handlers
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (els.bulkModal && !els.bulkModal.classList.contains('hidden')) {
                els.bulkModal.classList.add('hidden');
            }
            if (els.editModal && !els.editModal.classList.contains('hidden')) {
                els.editModal.classList.add('hidden');
                currentEditId = null;
            }
            if (els.clearAllModal && !els.clearAllModal.classList.contains('hidden')) {
                els.clearAllModal.classList.add('hidden');
            }
            if (els.removeParticipantModal && !els.removeParticipantModal.classList.contains('hidden')) {
                els.removeParticipantModal.classList.add('hidden');
                pendingRemoveId = null;
            }
            if (els.settingsPanel && !els.settingsPanel.classList.contains('hidden')) {
                els.settingsPanel.classList.add('hidden');
                els.settingsToggleFloating.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Modal backdrop clicks
    if (els.bulkModal) {
        els.bulkModal.addEventListener('click', (e) => {
            if (e.target === els.bulkModal) {
                els.bulkModal.classList.add('hidden');
            }
        });
    }

    if (els.editModal) {
        els.editModal.addEventListener('click', (e) => {
            if (e.target === els.editModal) {
                els.editModal.classList.add('hidden');
                currentEditId = null;
            }
        });
    }

    if (els.clearAllModal) {
        els.clearAllModal.addEventListener('click', (e) => {
            if (e.target === els.clearAllModal) {
                els.clearAllModal.classList.add('hidden');
            }
        });
    }

    if (els.removeParticipantModal) {
        els.removeParticipantModal.addEventListener('click', (e) => {
            if (e.target === els.removeParticipantModal) {
                els.removeParticipantModal.classList.add('hidden');
                pendingRemoveId = null;
            }
        });
    }
}
// ==================== INITIALIZE APP ====================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose for debugging
window.TimeSync = {
    version: '2.1',
    state,
    history,
    exportState: () => JSON.stringify(state, null, 2),
    importState: (json) => {
        try {
            const data = JSON.parse(json);
            Object.assign(state, data);
            render();
            scheduleAISmartSuggestions('import');
            toast('State imported from console', 'success');
        } catch (e) {
            console.error('Invalid JSON:', e);
        }
    },
    clearCache: () => {
        state.cache = {};
        console.log('Cache cleared');
    },
    stats: () => {
        console.log('=== TimeSync v2.1 Statistics ===');
        console.log('Participants:', state.participants.length);
        console.log('Duration:', state.duration, 'minutes');
        console.log('Days:', state.days);
        console.log('Cache size:', Object.keys(state.cache).length);
        console.log('History:', history.past.length, 'actions');
        console.log('================================');
    }
};

console.log(
    '%c🚀 TimeSync v2.1'  +
    'Type TimeSync.stats() for debug info',
    'color: #14b8a6; font-size: 20px; font-weight: bold;',
    'color: #64748b; font-size: 12px;'
);
