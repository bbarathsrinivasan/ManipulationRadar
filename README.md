# 🛡️ Manipulation Radar

<div align="center">

**A Chrome extension that detects manipulation patterns in AI conversations**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=google-chrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📋 Table of Contents

- [What It Does](#-what-it-does)
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Technical Stack](#-technical-stack)
- [Current Implementation](#-current-implementation)
- [Future Enhancements](#-future-enhancements)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Contributing](#-contributing)

---

## 🎯 What It Does

**Manipulation Radar** is a Chrome extension that monitors AI conversations in real-time to help users identify when AI responses use manipulative techniques. It provides trust scores and detailed flags to enable more informed interactions with AI assistants.

### Supported Platforms
- ✅ **ChatGPT** (chat.openai.com)
- ✅ **Claude** (claude.ai)

---

## ✨ Features

### 🔍 Real-Time Detection
- **Live Monitoring**: Automatically detects and analyzes AI responses as they appear
- **5 Manipulation Types**: Identifies sycophancy, flattery, persuasion, emotional manipulation, and authority appeals
- **Trust Score**: Calculates a 0-100 trust score for each response

### 📊 Visual Dashboard
- **Collapsible Sidebar**: Starts expanded, can be collapsed to a draggable icon
- **Animated Trust Scores**: Color-coded scores with smooth animations
  - 🟢 **Green (90-100)**: Highly Trustworthy
  - 🟡 **Yellow (70-89)**: Moderately Trustworthy
  - 🟠 **Orange (50-69)**: Low Trust
  - 🔴 **Red (0-49)**: High Risk
- **Recent Flags**: Displays manipulation flags with severity indicators
- **Statistics**: Detailed breakdown of detected patterns

### ⚙️ Customization
- **Settings Popup**: Enable/disable extension and adjust sensitivity
- **Persistent Preferences**: Remembers sidebar state and icon position
- **Draggable Icon**: Position the collapsed icon anywhere on the right edge

---

## 🚀 Installation

### Prerequisites
- Node.js 18+ and npm
- Chrome browser

### Build Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ManipulationRadar
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create extension icons**
   - Open `icons/generate-icons.html` in a browser
   - Right-click each canvas and save as:
     - `icon16.png` (16x16 pixels)
     - `icon48.png` (48x48 pixels)
     - `icon128.png` (128x128 pixels)
   - Or use the SVG template at `icons/icon-template.svg` and convert to PNG

4. **Build the extension**
   ```bash
   npm run build
   ```

5. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top-right)
   - Click **"Load unpacked"**
   - Select the `dist` folder from this project

---

## 📖 Usage

### Getting Started

1. **Navigate to ChatGPT or Claude**
   - Visit [ChatGPT](https://chat.openai.com) or [Claude](https://claude.ai)

2. **Sidebar Appears**
   - The Manipulation Radar sidebar appears on the right side by default
   - Shows trust score and recent flags in real-time

3. **Interact with the Sidebar**
   - **Collapse**: Click the X button in the header to collapse to icon
   - **Expand**: Click the icon button to expand the sidebar
   - **Reposition**: Drag the icon vertically to your preferred position
   - **View Details**: Click "Details" to see statistics

4. **Monitor Conversations**
   - As you chat with AI, responses are automatically analyzed
   - Trust scores update in real-time
   - Manipulation flags appear in the Recent Flags section

### Settings

Click the extension icon in Chrome's toolbar to access settings:
- **Extension Status**: Enable/disable monitoring
- **Detection Sensitivity**: Adjust between Low, Medium, and High

---

## 🛠️ Technical Stack

| Category | Technology |
|----------|-----------|
| **Frontend Framework** | React 18 |
| **Build Tool** | Vite 5 |
| **Styling** | Tailwind CSS 3 |
| **Animations** | Framer Motion 10 |
| **Extension Framework** | Chrome Extension Manifest V3 |
| **Build Plugin** | @crxjs/vite-plugin |
| **Detection Engine** | Pattern-based (Regex) |

---

## 🔧 Current Implementation

### Detection System
- **Client-Side Pattern Detection**: Uses regex patterns to identify manipulation techniques
- **Real-Time DOM Monitoring**: Observes page changes to detect new AI messages
- **5 Detection Categories**:
  - 🔄 **Sycophancy**: Excessive agreement and validation
  - 💬 **Flattery**: Excessive praise and compliments
  - 🎯 **Persuasion**: Manipulative language and pressure tactics
  - 😢 **Emotional Manipulation**: Guilt-tripping and emotional appeals
  - 👔 **Authority Appeals**: False expertise claims

### UI Components
- **Collapsible Sidebar**: React component with Framer Motion animations
- **Settings Popup**: Configuration interface with Chrome storage integration
- **Service Worker**: Background script for extension lifecycle management

### State Management
- **Chrome Storage API**: Persists user preferences
- **Local Storage**: Remembers sidebar state and icon position
- **Real-Time Updates**: React state updates on new message detection

---

## 🚧 Future Enhancements

### Planned Features

#### 🔮 Backend Integration
- **Supabase Edge Functions**: Advanced AI-powered analysis
- **Hybrid Detection**: Fast client-side + deep AI analysis for borderline cases
- **Cloud Storage**: Sync settings across devices

#### 💡 Prompt Suggestions
- **Better Prompts**: Help users write prompts that reduce manipulation
- **Context-Aware Suggestions**: Based on detected patterns
- **Prompt Templates**: Pre-built templates for common use cases

#### 📈 Enhanced Analytics
- **Historical Trends**: Track trust scores over time
- **Pattern Analysis**: Identify which manipulation types are most common
- **Export Reports**: Generate reports of AI interactions

---

## 📁 Project Structure

```
ManipulationRadar/
├── src/
│   ├── background/          # Service worker
│   │   └── background.js
│   ├── content/            # Content scripts
│   │   ├── content.js      # Main content script
│   │   ├── Sidebar.jsx     # Collapsible sidebar component
│   │   └── content.css     # Content styles
│   ├── lib/                # Core logic
│   │   ├── detectors.js    # Pattern matching engine
│   │   └── scorer.js       # Trust score calculator
│   ├── popup/              # Extension popup
│   │   ├── Popup.jsx       # Settings component
│   │   ├── popup.jsx       # Entry point
│   │   └── popup.html      # Popup HTML
│   └── styles.css          # Global styles
├── icons/                  # Extension icons
├── manifest.json           # Chrome extension manifest
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS config
├── package.json            # Dependencies
└── README.md               # This file
```

---

## 💻 Development

### Development Mode

Run the development server with hot reload:

```bash
npm run dev
```

The extension will automatically reload when you make changes.

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### Project Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

---

## 🎨 Design Philosophy

Manipulation Radar is designed with the following principles:

- **Non-Intrusive**: Collapsible sidebar that doesn't interfere with normal browsing
- **Real-Time**: Instant feedback as AI responses appear
- **Transparent**: Clear trust scores and detailed flag explanations
- **Customizable**: User-controlled positioning and sensitivity settings
- **Performant**: Lightweight client-side detection for fast analysis

---

## 📊 Use Case

**Manipulation Radar** helps users:

- ✅ **Identify Manipulation**: Recognize when AI uses manipulative language
- ✅ **Make Informed Decisions**: Understand the trustworthiness of AI responses
- ✅ **Improve Interactions**: Learn to write better prompts that reduce manipulation
- ✅ **Stay Aware**: Maintain awareness of AI behavior patterns

Perfect for:
- Researchers studying AI behavior
- Users who want transparent AI interactions
- Educators teaching about AI ethics
- Anyone concerned about AI manipulation

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
- Extension built with [@crxjs/vite-plugin](https://github.com/crxjs/chrome-extension-tools)

---

<div align="center">

**Made with ❤️ for transparent AI interactions**

[Report Bug](https://github.com/your-repo/issues) · [Request Feature](https://github.com/your-repo/issues) · [Documentation](https://github.com/your-repo/wiki)

</div>
