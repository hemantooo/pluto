<div align="center">
  <img src="icon.png" alt="Pluto Logo" width="120" />
  
  # Pluto Terminal

  **An agentic AI-powered terminal for Linux that simplifies command-line tasks with automated audit logging.**
</div>

---

## 🚀 Features

- **🧠 AI Command Generation**: Never memorize complex Linux commands again. Simply ask Pluto what you want to do (e.g., *"find files larger than 100MB"*), and it will instantly generate the exact executable command.
- **📝 Automated Audit Logging**: Every command executed via the AI prompt is automatically logged along with the prompt, the output, and the exit code. Logs are formatted as Markdown and securely saved to `~/.ai_terminal_logs`.
- **💻 Native Shell Integration**: Built on top of `node-pty` and `xterm.js`, Pluto hooks directly into your native `/bin/bash` subshell, supporting all standard Linux terminal features, colors, and keybindings.
- **🎨 Modern UI**: A sleek, dark-themed, glassmorphic UI inspired by modern developer tools (like Warp), featuring a custom floating AI prompt bar and native Linux Wayland CSD (Client-Side Decorations) support.

---

## 📥 Installation

There are two ways to install Pluto Terminal on your Ubuntu/Debian machine:

### Option 1: Install from Pre-compiled Binary (Recommended)
1. Go to the [Releases page](../../releases) on this GitHub repository.
2. Download the latest `.deb` package (e.g., `pluto_0.1.0_amd64.deb`).
3. Install the package using `apt`:
   ```bash
   sudo apt install ./pluto_0.1.0_amd64.deb
   ```
4. You can now launch "Pluto" directly from your application launcher!

### Option 2: Build from Source
If you prefer to compile the application yourself, ensure you have Node.js and `npm` installed.

1. Clone the repository:
   ```bash
   git clone https://github.com/hemantooo/pluto.git
   cd pluto
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Rebuild native Node dependencies (`node-pty`) for Electron:
   ```bash
   npm run rebuild
   ```
4. **(Optional)** Run the app in development mode:
   ```bash
   npm start
   ```
5. Package the `.deb` installer using `electron-builder`:
   ```bash
   npm run dist
   ```
   *The installer will be generated in the `dist/` folder.*

---

## 🛠️ Configuration & Usage

When you open Pluto Terminal for the first time, you need to configure your **Google Gemini API Key** for the AI generation to work.

1. Open Pluto Terminal.
2. Click the **⚙️ Settings** button in the bottom left corner.
3. Paste your Gemini API Key (you can get a free one from [Google AI Studio](https://aistudio.google.com/)).
4. Click **Save Key**. 
   *(Your key is stored securely in `~/.config/aiterm-desktop/config.json`)*

**To use the AI Prompt:**
1. Type a natural language request in the floating bar at the bottom.
2. Press `Enter`.
3. Review the generated command and the brief explanation.
4. Click **Execute Command** to run it safely in the terminal!

---

## 💻 Tech Stack
- **Framework**: Electron (Main & Renderer IPC Architecture)
- **UI & Styling**: Vanilla HTML/JS, Custom CSS Flexbox, Glassmorphism
- **Terminal Emulator**: `xterm.js` & `xterm-addon-fit`
- **Shell Wrapper**: `node-pty`
- **AI Engine**: `@google/genai` SDK (Gemini 2.5 Flash)

---

<div align="center">
  <i>Built for Linux desktop power users.</i>
</div>
