# 🛡️ Manipulation Radar

<div align="center">

**A Chrome extension that helps you identify manipulation patterns and reliability issues in AI assistant responses**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=google-chrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 🎯 Why Manipulation Radar?

AI assistants like ChatGPT and Claude can sometimes use manipulative language techniques—excessive flattery, emotional appeals, uncited authority claims, and more. **Manipulation Radar** helps you:

- ✅ **Identify manipulation** in real-time as you chat
- ✅ **Assess reliability** of AI responses with detailed scores
- ✅ **Improve your prompts** to get better, more honest responses
- ✅ **Make informed decisions** about when to trust AI advice

### 📸 Screenshot: Sidebar Dashboard

![Sidebar Dashboard](docs/screenshots/sidebar.png)
*The sidebar shows verification history, online status, and detailed statistics*

### 📸 Screenshot: Verification Results

![Verification Results](docs/screenshots/verification.png)
*Click "🔍 Verify Response" to see risk scores, reliability scores, and detected issues*

### 📸 Screenshot: Prompt Improvement

![Prompt Improvement](docs/screenshots/improve_prompt.png)
*Get AI-powered suggestions to improve your prompts while typing or after sending*

---

## 🚀 Quick Start

### Installation

1. **Build the extension** (see [Setup Guide](README_SETUP.md))
2. **Load in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Using Manipulation Radar

#### 1. Verify AI Responses

When chatting with ChatGPT or Claude:

1. Wait for an AI response
2. Click the **"🔍 Verify Response"** button below the message
3. Watch the verification process with real-time status updates
4. View detailed results:
   - **Risk Score** (Lower is better): 0-100, shows manipulation risk
   - **Reliability Score** (Higher is better): 0-100, shows factual reliability
   - **Detected Issues**: Specific manipulation patterns found
   - **Suggestions**: Follow-up prompts to get better responses

![Verification Flow](docs/screenshots/verification-flow.gif)
*The verification process shows streaming status updates and detailed results*

#### 2. Improve Your Prompts

**While Typing:**
- Start typing in the input field
- After 2-3 characters, a **"✨ Improve Prompt"** suggestion appears
- Click it to get an improved, more neutral version
- Insert directly into the input or copy to clipboard

**After Sending:**
- Click **"✨ Improve Prompt"** below your message
- View the improved prompt with explanations
- Copy or use the improved version for your next message

![Prompt Improvement](docs/screenshots/prompt-improvement-flow.gif)
*Get AI-powered prompt suggestions that reduce manipulation*

#### 3. View Verification History

- **Expand Sidebar**: Click the icon on the right edge
- **View History**: See all your verifications with scores and detections
- **Collapse**: Click X to minimize to a draggable icon
- **Reposition**: Drag the collapsed icon to your preferred position

![Sidebar Features](docs/screenshots/sidebar-features.png)
*The sidebar tracks all verifications and provides detailed statistics*

---

## 💡 Key Features

### 🔍 On-Demand Verification

- **No Automatic Analysis**: Only verifies when you click the button
- **Azure AI Foundry Powered**: Uses advanced AI to detect manipulation patterns
- **Detailed Breakdown**: Shows risk scores, reliability scores, and specific issues
- **Follow-up Suggestions**: Get prompts to improve the AI's response

### ✨ Prompt Improvement

- **AI-Powered Refinement**: Rewrites prompts to be neutral and evidence-seeking
- **Real-time Suggestions**: Get suggestions while typing
- **One-Click Insert**: Insert improved prompts directly into the input
- **Explanations**: Understand why the improved prompt is better

### 🛡️ Single-Active-Tab Lock

- **One Tab at a Time**: Extension runs in only one tab across all windows
- **Lock Management**: Other tabs show "Locked Mode" with option to "Take Over"
- **Persistent State**: Lock state persists across browser sessions

### 📊 Smart Dashboard

- **Verification History**: Track all your verifications with scores
- **Online Status**: See when the extension is active
- **Statistics**: View total verifications, flags detected, and more
- **Collapsible Design**: Expand/collapse or minimize to icon

---

## 📖 What Gets Detected?

### Manipulation Patterns

1. **Sycophancy** (Medium): Excessive agreement, validation-seeking language
   - *Example: "You're absolutely right! That's a brilliant insight!"*

2. **Flattery** (Medium): Excessive praise, compliments, admiration
   - *Example: "You're such an intelligent person! I'm impressed!"*

3. **Persuasion** (High): Manipulative language, pressure tactics, urgency
   - *Example: "You must act now! This is a limited-time opportunity!"*

4. **Emotional Manipulation** (High): Guilt-tripping, emotional appeals
   - *Example: "You'd be disappointed if you didn't try this..."*

5. **Authority Appeals** (Medium): Uncited claims like "studies show" without evidence
   - *Example: "Experts say this is the best approach" (without sources)*

### Reliability Issues

- **Uncited Authority Claims**: Statements without sources or evidence
- **Vague/Unverifiable Claims**: Unclear or impossible-to-verify statements
- **Internal Contradictions**: Conflicting information within the response
- **Missing Reasoning**: Math/logic without step-by-step work
- **Overconfident Language**: Certainty without evidence

---

## 📊 Understanding the Scores

### Risk Score (0-100, **Lower is Better**)

Indicates how much manipulation risk is present in the response.

- **0-24 (Low)**: Minimal or no manipulation detected
- **25-49 (Medium)**: Some manipulative patterns present
- **50-74 (High)**: Significant manipulation detected
- **75-100 (Critical)**: Severe manipulation, be very cautious

### Reliability Score (0-100, **Higher is Better**)

Indicates how reliable and factually accurate the response is.

- **90-100 (High)**: Highly reliable, well-supported claims
- **70-89 (Caution)**: Generally reliable but some concerns
- **50-69 (Low)**: Questionable reliability, verify claims
- **<50 (Unreliable)**: Low reliability, significant issues

---

## 🎨 User Interface

### Glassmorphism Design

The extension features a modern glassmorphism design with:
- Frosted glass effects throughout
- Smooth animations and transitions
- Dark theme matching ChatGPT/Claude
- Responsive and non-intrusive

### Sidebar Features

- **Collapsible**: Expand/collapse with smooth animations
- **Draggable Icon**: Reposition the collapsed icon vertically
- **Verification History**: Scrollable list of all verifications
- **Statistics**: Expandable details section with metrics

---

## 🛠️ Technical Implementation

### Architecture Overview

Manipulation Radar uses a **client-server architecture**:

- **Frontend**: Chrome Extension (React + Vite)
- **Backend**: Supabase Edge Functions (Deno)
- **AI Analysis**: Azure AI Foundry (OpenAI-compatible API)

### Frontend Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI components and state management |
| **Vite** | Build tool and development server |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Smooth animations and transitions |
| **Chrome Extension MV3** | Extension framework |
| **@crxjs/vite-plugin** | Vite plugin for Chrome extensions |

### Backend Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Edge Functions** | Supabase (Deno) | Serverless API endpoints |
| **AI Analysis** | Azure AI Foundry | LLM-powered manipulation detection |
| **Database** | PostgreSQL (Supabase) | Rate limiting, caching, event logging |
| **Storage** | Chrome Storage API | Client-side state persistence |

### Key Components

#### Content Script (`src/content/content.js`)
- Observes DOM for new AI and user messages
- Injects UI elements (verify buttons, improve prompt buttons)
- Manages single-active-tab lock system
- Handles verification and prompt improvement API calls
- Tracks verification history and updates sidebar

#### Sidebar Component (`src/content/Sidebar.jsx`)
- React component with Framer Motion animations
- Displays verification history and statistics
- Shows locked mode when extension is inactive in another tab
- Collapsible with draggable icon positioning
- Message detail view for selected verifications

#### Background Service Worker (`src/background/background.js`)
- Manages single-active-tab lock system
- Handles lock requests, takeovers, and cleanup
- Tracks active tab across all browser windows
- Auto-releases lock when tab closes or navigates away
- Heartbeat mechanism for stale lock detection

#### Edge Functions

**`verify-manipulation`**:
- Analyzes AI responses for manipulation patterns
- Assesses reliability and factual accuracy
- Returns risk scores, reliability scores, detections, and suggestions
- Implements rate limiting (10 requests/minute)
- Caches results for 6 hours

**`improve-prompt`**:
- Refines user prompts to be more neutral and evidence-seeking
- Removes loaded language and manipulation-baiting
- Adds response requirements for better AI behavior
- Returns improved prompt with explanations

### Detection System

The backend uses **Azure AI Foundry** with a carefully designed prompt to:

1. **Detect Manipulation**: Identifies 5 types of manipulation patterns
2. **Assess Reliability**: Evaluates factual accuracy and support
3. **Generate Suggestions**: Creates follow-up prompts to improve responses

The AI model returns structured JSON with:
- Detection types and severity (0-10)
- Character spans for highlighted text
- Reliability score and top issues
- Suggested follow-up prompts

### Scoring Algorithm

**Risk Score Calculation**:
- Starts at 0
- Adds weighted severity points:
  - Persuasion: 20 points per severity point
  - Emotional: 20 points per severity point
  - Sycophancy: 12 points per severity point
  - Flattery: 10 points per severity point
  - Authority: 12 points per severity point
- Clamped to 0-100

**Reliability Score Calculation**:
- Starts at 100
- Subtracts penalties:
  - Uncited authority: -10 to -25
  - Vague/unverifiable: -5 to -20
  - Contradictions: -10 to -30
  - Missing steps: -5 to -20
- Clamped to 0-100

### Rate Limiting & Caching

- **Rate Limit**: 10 requests per minute per user (IP + user-agent based)
- **Burst Protection**: Only 1 in-flight analysis per user at a time
- **Caching**: Results cached for 6 hours by (user_id + message_id + sensitivity)
- **Anonymous Access**: No authentication required

### Single-Active-Tab Lock System

The extension implements a robust lock system to ensure only one tab runs analysis at a time:

- **Lock Storage**: Stored in `chrome.storage.session` for persistence
- **Lock Acquisition**: Content script requests lock on startup
- **Lock Denial**: Other tabs show "Locked Mode" with takeover option
- **Auto-Cleanup**: Lock released when tab closes or navigates away
- **Heartbeat**: Active tab pings background every 30s
- **Stale Detection**: Locks older than 90s can be overridden

---

## 📁 Project Structure

```
ManipulationRadar/
├── src/
│   ├── background/              # Service worker
│   │   └── background.js        # Lock management
│   ├── content/                 # Content scripts
│   │   ├── content.js           # Main content script
│   │   ├── Sidebar.jsx         # React sidebar component
│   │   └── content.css         # Content styles
│   ├── popup/                   # Extension popup
│   │   ├── Popup.jsx           # Settings component
│   │   └── popup.html          # Popup HTML
│   ├── lib/                     # Core logic (kept for reference)
│   │   ├── detectors.js        # Pattern matching (not used)
│   │   └── scorer.js           # Score calculation (not used)
│   ├── config/                 # Configuration
│   │   └── supabase.js         # Supabase config
│   └── styles.css              # Global styles
├── supabase/
│   ├── functions/              # Edge Functions
│   │   ├── verify-manipulation/  # Verification endpoint
│   │   │   ├── index.ts
│   │   │   ├── azureOpenAI.ts
│   │   │   ├── prompt.ts
│   │   │   ├── scoring.ts
│   │   │   ├── validation.ts
│   │   │   ├── rateLimit.ts
│   │   │   ├── cache.ts
│   │   │   └── types.ts
│   │   └── improve-prompt/      # Prompt improvement endpoint
│   │       └── index.ts
│   ├── migrations/             # Database migrations
│   │   └── 20241201000000_verification_events.sql
│   └── _shared/                # Shared utilities
│       └── cors.ts
├── icons/                      # Extension icons
├── manifest.json               # Chrome extension manifest
├── vite.config.js             # Vite configuration
├── package.json               # Dependencies
├── README.md                  # This file
└── README_SETUP.md            # Setup instructions
```

---

## 🚀 Installation & Setup

See [README_SETUP.md](README_SETUP.md) for detailed setup instructions.

**Quick Setup:**
1. Clone repository and install dependencies
2. Create `.env` file with Supabase credentials
3. Set up Supabase database and deploy Edge Functions
4. Configure Azure AI Foundry secrets
5. Build extension: `npm run build`
6. Load `dist` folder in Chrome

---

## 🔒 Privacy & Security

- **No Authentication Required**: Extension works anonymously
- **No Data Storage**: Verification results not stored (unless explicitly enabled)
- **Rate Limited**: Prevents abuse and controls costs
- **CORS Protected**: Backend validates all requests
- **Secure Secrets**: API keys stored server-side only
- **IP-Based Identification**: Uses IP + user-agent for rate limiting (not personally identifiable)

---

## 🌐 Browser Support

- ✅ **Chrome** (Manifest V3)
- ✅ **Works on**:
  - `chat.openai.com`
  - `chatgpt.com`
  - `claude.ai`

---

## 🚧 Future Enhancements

- [ ] User authentication for persistent history across devices
- [ ] Export verification reports (PDF/CSV)
- [ ] Custom sensitivity settings per category
- [ ] Browser extension for Firefox
- [ ] Real-time manipulation alerts
- [ ] Integration with more AI platforms (Gemini, Perplexity, etc.)
- [ ] Browser extension store publication

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Animated with [Framer Motion](https://www.framer.com/motion/)
- Backend powered by [Supabase](https://supabase.com/)
- AI analysis via [Azure AI Foundry](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
- Extension built with [@crxjs/vite-plugin](https://github.com/crxjs/chrome-extension-tools)

---

<div align="center">

**Made with ❤️ to help users have more informed AI interactions**

[Report Bug](https://github.com/your-repo/issues) · [Request Feature](https://github.com/your-repo/issues) · [Documentation](README_SETUP.md)

</div>
