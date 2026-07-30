const termContainer = document.getElementById('terminal-container');
const aiPromptInput = document.getElementById('ai-prompt-input');
const btnGenerate = document.getElementById('btn-generate');

const settingsModal = document.getElementById('settings-modal');
const apiKeyInput = document.getElementById('api-key-input');
const btnSaveKey = document.getElementById('btn-save-key');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCloseSettingsX = document.getElementById('btn-close-settings-x');
const btnSettings = document.getElementById('btn-settings');
const linkAiStudio = document.getElementById('link-ai-studio');

const confirmModal = document.getElementById('confirm-modal');
const confirmExplanation = document.getElementById('confirm-explanation');
const confirmCommandCode = document.getElementById('confirm-command-code');
const btnCancelExecution = document.getElementById('btn-cancel-execution');
const btnConfirmExecution = document.getElementById('btn-confirm-execution');
const btnCloseConfirmX = document.getElementById('btn-close-confirm-x');

const logViewerModal = document.getElementById('log-viewer-modal');
const logViewerTitle = document.getElementById('log-viewer-title');
const logViewerBody = document.getElementById('log-viewer-body');
const btnCloseLog = document.getElementById('btn-close-log');
const logList = document.getElementById('log-list');


let terminal;
let fitAddon;
let pendingAiCommand = null;
let pendingAiPrompt = null;

// Comprehensive ANSI / Control Code Stripper for log viewing
function stripAnsi(str) {
  if (!str) return '';
  return str
    .replace(/\x1B\][0-9];[^\x07\x1B]*(\x07|\x1B\\)/g, '')
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\[\?2004[hl]/g, '')
    .replace(/\x1B[()][A-B0-9]/g, '')
    .replace(/\r/g, '');
}

// Initialize Terminal
function initTerminal() {
  terminal = new Terminal({
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", "Fira Code", "Ubuntu Mono", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    theme: {
      background: '#141414',
      foreground: '#e1e1e6',
      cursor: '#528bff',
      selectionBackground: 'rgba(82, 139, 255, 0.3)',
      black: '#141414',
      blue: '#528bff',
      cyan: '#00d2ff',
      green: '#50fa7b',
      magenta: '#ff79c6',
      red: '#ff5555',
      white: '#f8f8f2',
      yellow: '#f1fa8c'
    }
  });

  fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(termContainer);
  
  // Ensure CSS layout has fully settled before fitting
  setTimeout(() => {
    fitAddon.fit();
    window.electronAPI.initPty(terminal.cols, terminal.rows);
  }, 10);

  // Send input to backend PTY
  terminal.onData((data) => {
    window.electronAPI.writePty(data);
  });

  // Receive output from PTY
  window.electronAPI.onPtyData((data) => {
    terminal.write(data);
  });

  // Resizing
  window.addEventListener('resize', () => {
    fitAddon.fit();
    window.electronAPI.resizePty(terminal.cols, terminal.rows);
  });
}

// UI Event Listeners
linkAiStudio.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.openExternalLink(linkAiStudio.href);
});

btnSettings.addEventListener('click', async () => {
  const currentKey = await window.electronAPI.getApiKey();
  apiKeyInput.value = currentKey || '';
  settingsModal.classList.remove('hidden');
});

function closeSettings() {
  settingsModal.classList.add('hidden');
}
btnCloseSettings.addEventListener('click', closeSettings);
if (btnCloseSettingsX) btnCloseSettingsX.addEventListener('click', closeSettings);

btnSaveKey.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  await window.electronAPI.setApiKey(key);
  settingsModal.classList.add('hidden');
});

// AI Command Generation
btnGenerate.addEventListener('click', generateCommand);
aiPromptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generateCommand();
});

async function generateCommand() {
  const prompt = aiPromptInput.value.trim();
  if (!prompt) return;

  const apiKey = await window.electronAPI.getApiKey();
  if (!apiKey) {
    settingsModal.classList.remove('hidden');
    return;
  }

  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Thinking...';
  
  try {
    const result = await window.electronAPI.generateCommand(prompt);
    
    pendingAiPrompt = prompt;
    pendingAiCommand = result.command;
    
    confirmExplanation.textContent = result.explanation || "No explanation provided.";
    confirmCommandCode.textContent = result.command;
    
    confirmModal.classList.remove('hidden');
  } catch (error) {
    alert("Error generating command: " + error.message);
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = '<span>Generate</span> <kbd class="key-badge">↵</kbd>';
  }
}

// Execution Confirmation
function closeConfirm() {
  confirmModal.classList.add('hidden');
  pendingAiCommand = null;
  pendingAiPrompt = null;
}

btnCancelExecution.addEventListener('click', closeConfirm);
if (btnCloseConfirmX) btnCloseConfirmX.addEventListener('click', closeConfirm);

btnConfirmExecution.addEventListener('click', () => {
  if (pendingAiCommand && pendingAiPrompt) {
    window.electronAPI.executeAiCommand(pendingAiPrompt, pendingAiCommand);
    
    terminal.focus();
    aiPromptInput.value = '';
    
    pendingAiCommand = null;
    pendingAiPrompt = null;
    confirmModal.classList.add('hidden');
    
    setTimeout(loadLogs, 1000);
  }
});

// Logs Management with SVG Icons
async function loadLogs() {
  const logs = await window.electronAPI.listLogs();
  logList.innerHTML = '';
  
  if (logs.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No logs recorded yet';
    li.classList.add('empty-state');
    logList.appendChild(li);
    return;
  }
  
  logs.sort((a, b) => b.localeCompare(a));
  
  logs.forEach(filename => {
    const li = document.createElement('li');
    const dateText = filename.replace('session_', '').replace('.md', '');
    
    li.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>
      <span>${dateText}</span>
    `;
    
    li.addEventListener('click', () => openLogViewer(filename));
    logList.appendChild(li);
  });
}

async function openLogViewer(filename) {
  try {
    const content = await window.electronAPI.readLog(filename);
    logViewerTitle.textContent = filename;
    
    const cleanContent = stripAnsi(content);
    logViewerBody.textContent = cleanContent;
    
    logViewerModal.classList.remove('hidden');
  } catch (error) {
    alert("Error reading log file: " + error.message);
  }
}

btnCloseLog.addEventListener('click', () => {
  logViewerModal.classList.add('hidden');
});

// Initialize on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  const scriptXterm = document.createElement('script');
  scriptXterm.src = './node_modules/xterm/lib/xterm.js';
  scriptXterm.onload = () => {
    const scriptFit = document.createElement('script');
    scriptFit.src = './node_modules/xterm-addon-fit/lib/xterm-addon-fit.js';
    scriptFit.onload = () => {
      initTerminal();
    };
    document.body.appendChild(scriptFit);
  };
  document.body.appendChild(scriptXterm);
  
  // Check API Key
  window.electronAPI.getApiKey().then(apiKey => {
    if (!apiKey) {
      settingsModal.classList.remove('hidden');
    }
  });

  // Load logs in sidebar
  loadLogs();
});
