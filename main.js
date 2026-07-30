const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pty = require('node-pty');
const { GoogleGenAI } = require('@google/genai');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'aiterm-desktop');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const LOGS_DIR = path.join(os.homedir(), '.ai_terminal_logs');

// Ensure directories exist
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

let mainWindow;
let ptyProcess;
let capturingExecution = false;
let currentExecutionMeta = null;
let currentCapturedOutput = "";
let currentExitCodeMarker = "";

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to read config:", e);
    }
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getLogFileForToday() {
  const dateStr = new Date().toISOString().split('T')[0];
  return path.join(LOGS_DIR, `session_${dateStr}.md`);
}

function stripAnsi(str) {
  if (!str) return '';
  return str
    // OSC escape sequences (e.g. \x1b]0;title\x07 or \x1b]0;title\x1b\\)
    .replace(/\x1B\][0-9];[^\x07\x1B]*(\x07|\x1B\\)/g, '')
    // CSI escape sequences (colors, cursor movements, modes)
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    // Bracketed paste mode and character set sequences
    .replace(/\[\?2004[hl]/g, '')
    .replace(/\x1B[()][A-B0-9]/g, '')
    .replace(/\r/g, '');
}

function appendToLog(meta, output, exitCode) {
  const logFile = getLogFileForToday();
  const timestamp = new Date().toISOString();
  
  const cleanOutput = stripAnsi(output);
    
  const logEntry = `
## [${timestamp}] AI Execution
**Original Prompt:** ${meta.prompt}
**Executed Command:** \`${meta.command}\`
**Exit Code:** \`${exitCode}\`

<details><summary><b>Output:</b></summary>

\`\`\`
${cleanOutput.trim() || 'No output.'}
\`\`\`
</details>

---
`;
  fs.appendFileSync(logFile, logEntry, 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#141414',
    title: 'Pluto',
    icon: path.join(__dirname, 'icon.png'),
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  mainWindow.loadFile('index.html');
  
  // Remove default menu
  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  // IPC: Window Controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // IPC: Config
  ipcMain.handle('config:get-api-key', () => {
    return loadConfig().gemini_api_key;
  });

  ipcMain.handle('config:set-api-key', (event, key) => {
    const config = loadConfig();
    config.gemini_api_key = key;
    saveConfig(config);
    return true;
  });

  // IPC: Logs
  ipcMain.handle('logs:list', () => {
    try {
      const files = fs.readdirSync(LOGS_DIR);
      return files.filter(f => f.endsWith('.md'));
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('logs:read', (event, filename) => {
    try {
      return fs.readFileSync(path.join(LOGS_DIR, filename), 'utf-8');
    } catch (e) {
      throw new Error("Unable to read log file.");
    }
  });

  // IPC: AI Generation
  ipcMain.handle('ai:generate', async (event, prompt) => {
    const apiKey = loadConfig().gemini_api_key;
    if (!apiKey) throw new Error("API Key not configured.");
    
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Using gemini-2.5-flash with system instruction demanding JSON output
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `User Prompt: ${prompt}`,
      config: {
        systemInstruction: "You are an expert Linux terminal command generator. You MUST respond with purely JSON without markdown backticks wrapping it. The JSON must contain exactly two fields: 'command' (the raw executable shell command, ready to be pasted) and 'explanation' (a very brief 1-sentence explanation of what it does).",
        responseMimeType: "application/json"
      }
    });

    try {
      const rawText = response.text || "{}";
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanedText);
      return {
        command: result.command || "echo 'Could not generate command'",
        explanation: result.explanation || ""
      };
    } catch (error) {
      console.error("AI parse error:", error, "Raw response:", response.text);
      throw new Error("Failed to parse AI response.");
    }
  });

  // IPC: PTY Management
  ipcMain.on('pty:init', (event, { cols, rows }) => {
    if (ptyProcess) return; // Already initialized

    const shellCmd = '/bin/bash';
    ptyProcess = pty.spawn(shellCmd, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: process.env.HOME,
      env: process.env
    });

    ptyProcess.onData((data) => {
      // Stream directly to UI
      mainWindow.webContents.send('pty:data', data);
      
      // Capture data if an AI command is currently executing
      if (capturingExecution) {
        currentCapturedOutput += data;
        
        // We look for our special exit code marker
        const exitMarkerRegex = /__AITERM_EXIT__:(\d+)/;
        const match = currentCapturedOutput.match(exitMarkerRegex);
        if (match) {
          const exitCode = match[1];
          // Strip the exit command and marker from output
          let finalOutput = currentCapturedOutput.replace(/echo -e "\\n__AITERM_EXIT__:\$\?"/g, '');
          finalOutput = finalOutput.replace(exitMarkerRegex, '');
          
          appendToLog(currentExecutionMeta, finalOutput, exitCode);
          
          capturingExecution = false;
          currentExecutionMeta = null;
          currentCapturedOutput = "";
        }
      }
    });
  });

  ipcMain.on('pty:write', (event, data) => {
    if (ptyProcess) ptyProcess.write(data);
  });

  ipcMain.on('pty:resize', (event, { cols, rows }) => {
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch (e) {
        // Ignore resize errors if pty is dead
      }
    }
  });

  // IPC: AI Command Execution Pipeline
  ipcMain.on('ai:execute', (event, { prompt, command }) => {
    if (!ptyProcess) return;
    
    capturingExecution = true;
    currentExecutionMeta = { prompt, command };
    currentCapturedOutput = "";
    
    // Write command to PTY and append our exit code trap
    // We send a newline, then the command, then we trap the exit code.
    const runSequence = `${command}\necho -e "\\n__AITERM_EXIT__:$?"\n`;
    ptyProcess.write(runSequence);
  });

  // IPC: External Link
  ipcMain.on('app:open-external', (event, url) => {
    shell.openExternal(url);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
