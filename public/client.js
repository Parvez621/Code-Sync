import { nanoid } from 'https://cdn.jsdelivr.net/npm/nanoid/nanoid.js';

const socket = io();
let editor = null;
const decorations = {};
const userColors = {};
const activeUsers = new Set();
let suppressNextChange = false;

// Monaco Editor Setup
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' } });
require(['vs/editor/editor.main'], () => {
  editor = monaco.editor.create(document.getElementById('editorContainer'), {
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    language: 'javascript'
  });

  editor.onDidChangeModelContent(() => {
    if (suppressNextChange) {
      suppressNextChange = false;
      return;
    }
    const code = editor.getValue();
    socket.emit('code-change', { roomId, code, lang: languageSelect.value });
  });

  editor.onDidChangeCursorPosition(() => {
    socket.emit("presence", {
      roomId,
      username,
      position: editor.getPosition()
    });
  });
});

// DOM Elements
const homePage = document.getElementById("homePage");
const editorPage = document.getElementById("editorPage");
const joinBtn = document.getElementById("joinBtn");
const createBtn = document.getElementById("createNewBtn");
const leaveBtn = document.getElementById("leaveBtn");
const runBtn = document.getElementById("runBtn");
const astBtn = document.getElementById("astBtn");
const sendBtn = document.getElementById("sendBtn");
const roomIdInput = document.getElementById("roomIdInput");
const usernameInput = document.getElementById("usernameInput");
const languageSelect = document.getElementById("languageSelect");
const versionSelect = document.getElementById("versionSelect");
const inputArea = document.getElementById("inputArea");
const chatArea = document.getElementById("chatArea");
const chatInput = document.getElementById("chatInput");
const outputArea = document.getElementById("outputArea");
const clientsList = document.getElementById("clientsList");

let username = "";
let roomId = "";
const MAX_USERS = 5;

// Room Actions
createBtn.addEventListener("click", () => {
  roomIdInput.value = nanoid(8);
});

joinBtn.addEventListener("click", () => {
  roomId = roomIdInput.value.trim();
  username = usernameInput.value.trim();
  if (!roomId || !username) return alert("Room ID & Username required!");

  homePage.style.display = "none";
  editorPage.style.display = "flex";
  socket.emit("join", { roomId, username });
});

leaveBtn.addEventListener("click", () => {
  socket.emit("leave", { roomId, username });
  window.location.reload();
});

// Run Code
runBtn.addEventListener("click", async () => {
  const code = editor.getValue();
  const input = inputArea.value;
  const language = languageSelect.value;
  const versionIndex = versionSelect.value;

  try {
    const response = await fetch('/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, versionIndex, stdin: input })
    });

    const result = await response.json();
    outputArea.value = result.output || result.error || "No output.";
  } catch (err) {
    outputArea.value = "Error executing code.";
    console.error(err);
  }
});

// Generate AST
astBtn.addEventListener("click", async () => {
  const code = editor.getValue();
  const language = languageSelect.value;

  try {
    const response = await fetch('/generate-ast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language })
    });

    const data = await response.json();
    if (!data || !data.name) throw new Error("Invalid AST data");
    localStorage.setItem('astData', JSON.stringify(data));
    window.open('ast.html', '_blank');
  } catch (err) {
    alert("AST generation failed");
    console.error("AST Error:", err);
  }
});

// Chat
sendBtn.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit("chat-message", { username, message: msg, roomId });
    chatInput.value = "";
  }
});

// Socket Events
socket.on("chat-message", ({ username, message }) => {
  const msgDiv = document.createElement("div");
  msgDiv.innerHTML = `<strong>${username}:</strong> ${message}`;
  chatArea.appendChild(msgDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
});

socket.on("joined", ({ clients }) => {
  updateClientList(clients);
  clients.forEach(client => activeUsers.add(client));
  if (clients.length >= MAX_USERS) alert('Room full!');
});

socket.on("disconnected", ({ clients }) => {
  updateClientList(clients);
  [...activeUsers].forEach(user => {
    if (!clients.includes(user)) {
      removeUserCursor(user);
      activeUsers.delete(user);
    }
  });
});

socket.on("code-change", ({ code }) => {
  if (editor.getValue() !== code) {
    suppressNextChange = true;
    editor.setValue(code);
  }
});

// Remote Cursor
socket.on("presence", ({ username: remoteUser, position }) => {
  if (!editor || remoteUser === username) return;

  const safeName = remoteUser.replace(/\s/g, '_');
  if (!userColors[safeName]) {
    userColors[safeName] = getRandomColor();
  }

  const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
  const decoration = {
    range,
    options: {
      className: "remote-cursor",
      afterContentClassName: `cursor-label-${safeName}`
    }
  };

  injectCursorLabel(remoteUser, userColors[safeName]);
  decorations[remoteUser] = editor.deltaDecorations(decorations[remoteUser] || [], [decoration]);

  const labelClass = `cursor-label-${safeName}`;
  const labelEls = document.querySelectorAll(`.${labelClass}`);
  labelEls.forEach(el => el.classList.remove("fade"));
  clearTimeout(decorations[`fadeTimeout_${safeName}`]);
  decorations[`fadeTimeout_${safeName}`] = setTimeout(() => {
    labelEls.forEach(el => el.classList.add("fade"));
  }, 3000);
});

// Helpers
function injectCursorLabel(user, bgColor) {
  const safeName = user.replace(/\s/g, '_');
  const styleId = `cursor-label-style-${safeName}`;
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    .cursor-label-${safeName}::after {
      content: "${user}";
      position: absolute;
      top: 1.2em;
      left: 0;
      background-color: ${bgColor};
      color: white;
      padding: 2px 6px;
      font-size: 12px;
      border-radius: 4px;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .cursor-label-${safeName}.fade::after {
      opacity: 0;
    }
  `;
  document.head.appendChild(style);
}

function removeUserCursor(user) {
  const safeName = user.replace(/\s/g, '_');
  const styleEl = document.getElementById(`cursor-label-style-${safeName}`);
  if (styleEl) styleEl.remove();
  if (decorations[user]) {
    editor.deltaDecorations(decorations[user], []);
    delete decorations[user];
  }
}

function updateClientList(clients) {
  clientsList.innerHTML = "";
  const box = document.createElement("div");
  box.className = "leftBox";

  clients.forEach((client, index) => {
    const userLine = document.createElement("div");
    userLine.textContent = `USER ${index + 1} = ${client}`;
    box.appendChild(userLine);
  });

  clientsList.appendChild(box);
}

languageSelect.addEventListener("change", () => {
  const selectedLang = languageSelect.value;
  const langMap = { python3: "python", cpp: "cpp", c: "c", java: "java" };
  monaco.editor.setModelLanguage(editor.getModel(), langMap[selectedLang] || "javascript");
});

function getRandomColor() {
  const palette = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'];
  return palette[Math.floor(Math.random() * palette.length)];
}
