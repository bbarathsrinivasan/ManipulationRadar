# Manipulation Radar

A Chrome extension that helps users identify manipulation patterns and reliability issues in AI assistant responses (ChatGPT and Claude). The extension provides on-demand verification, prompt improvement suggestions, and detailed analysis powered by Azure AI Foundry.

![Manipulation Radar](icons/icon128.png)

## Features

### 🔍 On-Demand Verification
- **Verify Response Button**: Click "🔍 Verify Response" below any AI message to analyze it
- **Real-time Analysis**: Uses Azure AI Foundry to detect manipulation patterns and assess reliability
- **Detailed Results**: Shows risk score, reliability score, detected issues, and improvement suggestions
- **Verification History**: All verifications are tracked and displayed in the sidebar

### ✨ Prompt Improvement
- **Improve Prompt Button**: Click "✨ Improve Prompt" below user messages to refine your prompts
- **While Typing**: Get prompt suggestions as you type (appears after 2-3 characters)
- **AI-Powered Refinement**: Rewrites prompts to be more neutral, evidence-seeking, and non-manipulative
- **One-Click Insert**: Insert improved prompts directly into the input field

### 🛡️ Single-Active-Tab Lock System
- **One Tab at a Time**: Extension runs in only one tab across all browser windows
- **Lock Management**: Other tabs show "Locked Mode" with option to "Take Over"
- **Persistent State**: Lock state persists across browser sessions
- **Auto-Cleanup**: Lock automatically releases when tab closes or navigates away

### 📊 Sidebar Dashboard
- **Verification Status**: Shows "Online" status with green indicator
- **Verification History**: Displays all completed verifications with scores and detections
- **Collapsible Design**: Expand/collapse sidebar or minimize to a draggable icon
- **Message Details**: Click on verification entries to see detailed breakdown

### 🎨 Modern UI
- **Glassmorphism Design**: Beautiful frosted glass effects throughout
- **Dark Theme**: Consistent dark theme matching ChatGPT/Claude
- **Smooth Animations**: Framer Motion powered transitions
- **Responsive**: Works seamlessly on both ChatGPT and Claude interfaces

## Installation

### Prerequisites
- Node.js 18+ and npm
- Chrome browser
- Supabase account (for backend)
- Azure AI Foundry account (for AI analysis)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ManipulationRadar
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run database migrations:
     ```bash
     supabase db push
     ```
   - Deploy Edge Functions:
     ```bash
     supabase functions deploy verify-manipulation
     supabase functions deploy improve-prompt
     ```
   - Set Edge Function secrets in Supabase Dashboard:
     - `AZURE_OPENAI_API_KEY`: Your Azure AI Foundry API key
     - `AZURE_OPENAI_BASE_URL`: Your Azure AI Foundry endpoint (e.g., `https://your-resource.openai.azure.com/openai/v1/`)
     - `AZURE_OPENAI_DEPLOYMENT`: Your deployment name (e.g., `gpt-5-nano`)
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

5. **Build the extension**
   ```bash
   npm run build
   ```

6. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

## Usage

### Verifying AI Responses

1. Navigate to ChatGPT (`chat.openai.com` or `chatgpt.com`) or Claude (`claude.ai`)
2. Wait for an AI response
3. Click the "🔍 Verify Response" button below the message
4. Watch the verification process with streaming status updates
5. View the results:
   - **Risk Score** (Lower is better): 0-100, indicates manipulation risk
   - **Reliability Score** (Higher is better): 0-100, indicates factual reliability
   - **Detected Issues**: List of manipulation patterns found
   - **Suggestions**: Follow-up prompts to improve the response

### Improving Prompts

**While Typing:**
1. Start typing in the input field
2. After 2-3 characters, a "✨ Improve Prompt" suggestion appears
3. Click it to get an improved version
4. Insert directly into the input or copy to clipboard

**After Sending:**
1. Send your message
2. Click "✨ Improve Prompt" below your message
3. View the improved prompt with explanations
4. Copy or use the improved version

### Sidebar

- **Expand/Collapse**: Click the icon on the right edge to expand or collapse
- **Drag Icon**: When collapsed, drag the icon to reposition vertically
- **View History**: See all your verifications in the sidebar
- **Details**: Expand the "Details" section for statistics

## Technical Architecture

### Frontend
- **React 18** with Vite for modern UI
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Chrome Extension Manifest V3**
- **Content Scripts** for DOM observation and injection
- **Service Worker** for background tasks

### Backend
- **Supabase Edge Functions** (Deno runtime)
- **Azure AI Foundry** for AI analysis
- **PostgreSQL** for rate limiting, caching, and event logging
- **RESTful API** design

### Key Components

#### Content Script (`src/content/content.js`)
- Observes DOM for new messages
- Injects UI elements (buttons, verification UI)
- Manages lock state and heartbeat
- Handles verification and prompt improvement flows

#### Sidebar (`src/content/Sidebar.jsx`)
- React component for the sidebar UI
- Displays verification history
- Shows locked mode when inactive
- Collapsible with draggable icon

#### Background Service Worker (`src/background/background.js`)
- Manages single-active-tab lock system
- Handles lock requests, takeovers, and cleanup
- Tracks active tab across all windows

#### Edge Functions
- **verify-manipulation**: Analyzes AI responses for manipulation and reliability
- **improve-prompt**: Refines user prompts to be more neutral and evidence-seeking

## Analysis Categories

### Manipulation Detection
1. **Sycophancy** (Medium): Excessive agreement, validation-seeking language
2. **Flattery** (Medium): Excessive praise, compliments, admiration
3. **Persuasion** (High): Manipulative language, pressure tactics, urgency
4. **Emotional** (High): Guilt-tripping, emotional manipulation, appeals to feelings
5. **Authority** (Medium): Uncited claims like "studies show", "experts say" without evidence

### Reliability Assessment
- **Uncited Authority Claims**: Penalty for claims without sources
- **Vague/Unverifiable Claims**: Penalty for unclear statements
- **Internal Contradictions**: Penalty for conflicting information
- **Missing Reasoning**: Penalty for math/logic without step-by-step work
- **Overconfident Language**: Penalty for certainty without evidence

## Scoring System

### Risk Score (0-100, Lower is Better)
- Starts at 0
- Weighted severity additions:
  - Persuasion: 20 points per severity point
  - Emotional: 20 points per severity point
  - Sycophancy: 12 points per severity point
  - Flattery: 10 points per severity point
  - Authority: 12 points per severity point
- **Risk Levels**:
  - 0-24: Low
  - 25-49: Medium
  - 50-74: High
  - 75-100: Critical

### Reliability Score (0-100, Higher is Better)
- Starts at 100
- Penalties subtracted:
  - Uncited authority: -10 to -25
  - Vague/unverifiable: -5 to -20
  - Contradictions: -10 to -30
  - Missing math/logic steps: -5 to -20
- **Reliability Levels**:
  - 90-100: High
  - 70-89: Caution
  - 50-69: Low
  - <50: Unreliable

## Rate Limiting & Caching

- **Rate Limit**: 10 requests per minute per user
- **Burst Protection**: Only 1 in-flight analysis per user at a time
- **Caching**: Results cached for 6 hours by (user_id + message_id + sensitivity)
- **Anonymous Access**: No authentication required (uses IP + user-agent for identification)

## Browser Support

- Chrome (Manifest V3)
- Works on:
  - `chat.openai.com`
  - `chatgpt.com`
  - `claude.ai`

## Development

### Project Structure
```
ManipulationRadar/
├── src/
│   ├── background/          # Service worker
│   ├── content/             # Content scripts and sidebar
│   ├── popup/               # Extension popup
│   ├── lib/                 # Detection and scoring logic
│   └── config/              # Configuration files
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── verify-manipulation/
│   │   └── improve-prompt/
│   └── migrations/          # Database migrations
├── icons/                   # Extension icons
├── manifest.json            # Extension manifest
└── vite.config.js          # Vite configuration
```

### Build Commands
```bash
# Development build
npm run dev

# Production build
npm run build

# Deploy Supabase functions
supabase functions deploy verify-manipulation
supabase functions deploy improve-prompt
```

## Privacy & Security

- **No Authentication Required**: Extension works anonymously
- **No Data Storage**: Verification results are not stored (unless explicitly enabled)
- **Rate Limited**: Prevents abuse and controls costs
- **CORS Protected**: Backend validates all requests
- **Secure Secrets**: API keys stored server-side only

## Future Enhancements

- [ ] User authentication for persistent history
- [ ] Export verification reports
- [ ] Custom sensitivity settings
- [ ] Browser extension for Firefox
- [ ] Real-time manipulation alerts
- [ ] Integration with more AI platforms

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with ❤️ to help users have more informed AI interactions**
