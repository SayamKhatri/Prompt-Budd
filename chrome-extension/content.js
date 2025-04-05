const BASE_URL = "http://localhost:8000";
console.log("Extension injected...");

let debounceTimer;
let lastScoredPrompt = "";
let promptHistory = [];
let scoreHistory = [];
const MAX_HISTORY = 5;

// Global flags for detection settings
let scoreDetectionEnabled = true;
let piiDetectionEnabled = true;

function findActiveTextbox() {
  const box = document.querySelector("#prompt-textarea.ProseMirror");
  if (box && box.offsetParent !== null && box.isContentEditable) {
    return box;
  }
  return null;
}

function showScoreTag(score) {
  const existing = document.getElementById("quality-score-tag");
  if (existing) existing.remove();

  if (!["low", "medium", "high"].includes(score)) return;

  const tag = document.createElement("div");
  tag.id = "quality-score-tag";
  tag.className = "score-tag";
  tag.innerText =
    score === "high" ? "🟩 HIGH" :
    score === "medium" ? "🟨 MEDIUM" :
    "🟥 LOW";

  document.body.appendChild(tag);
}

function removeScoreTag() {
  const tag = document.getElementById("quality-score-tag");
  if (tag) tag.remove();
  lastScoredPrompt = "";
}

/* ---------- New: PII Detection Functions ---------- */
function showPIIPopup() {
  if (document.getElementById("pii-tag")) return;
  
  const btn = document.getElementById("smart-suggest-btn");
  if (!btn) return;
  
  btn.style.position = "relative";
  
  const tag = document.createElement("div");
  tag.id = "pii-tag";
  tag.className = "pii-tag";
  tag.innerText = "PII Detected!";
  
  btn.appendChild(tag);
}

function removePIIPopup() {
  const tag = document.getElementById("pii-tag");
  if (tag) tag.remove();
}

function detectPII(prompt) {
  if (!piiDetectionEnabled) {
    removePIIPopup();
    return;
  }
  fetch(`${BASE_URL}/detect-pii`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: prompt })
  })
    .then(res => res.json())
    .then(data => {
      if (data.pii === true) {
        showPIIPopup();
      } else {
        removePIIPopup();
      }
    })
    .catch(err => {
      console.error("Error in detect-pii:", err);
    });
}
/* ---------- End PII Detection ---------- */

function scorePrompt(prompt) {
  if (!scoreDetectionEnabled) {
    removeScoreTag();
    return;
  }
  if (!prompt || prompt.trim() === "") {
    removeScoreTag();
    return;
  }
  const cleaned = prompt.trim();
  if (cleaned === lastScoredPrompt) return;

  lastScoredPrompt = cleaned;

  fetch(`${BASE_URL}/prompt-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: cleaned })
  })
    .then(res => res.json())
    .then(data => {
      const score = data.score || "unknown";
      if (["low", "medium", "high"].includes(score)) {
        scoreHistory.unshift({ prompt: cleaned, score });
        if (scoreHistory.length > MAX_HISTORY) scoreHistory.pop();
        updateScoreHistoryUI();
      }
      showScoreTag(score);
    })
    .catch(err => {
      console.error("Scoring error:", err);
    });
}

function checkAndUpdateLLMSuggestion() {
  if (promptHistory.length === 0) return;
  fetch(`${BASE_URL}/prompt_classifier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompts: promptHistory })
  })
    .then(res => res.json())
    .then(data => {
      const llmContainer = document.getElementById("llm-suggestion-line");
      if (llmContainer) {
        if (data.suggested_llm && data.suggested_llm !== "Unknown") {
          llmContainer.innerHTML = `
            <strong>Suggested LLM:</strong> ${data.suggested_llm}
            <br><small>${data.reason || "No additional details"}</small>
          `;
        } else {
          llmContainer.innerHTML = `
            <strong>Suggested LLM:</strong> <em>No strong signal</em>
          `;
        }
      }
    })
    .catch(err => {
      console.error("🔥 Failed to get LLM suggestion:", err);
    });
}

function observeInputBox() {
  const box = findActiveTextbox();
  if (!box) return;

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const current = box.innerText.trim();
      if (!current) {
        removeScoreTag();
        removePIIPopup();
        return;
      }
      scorePrompt(current);
      detectPII(current);
    }, 700);
  });
  observer.observe(box, {
    characterData: true,
    childList: true,
    subtree: true,
  });

  box.addEventListener("keydown", (event) => {
    const isEnter = event.key === "Enter";
    const plainEnter = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (isEnter && plainEnter) {
      setTimeout(() => {
        const submitted = lastScoredPrompt;
        if (!submitted) return;
        if (!promptHistory.length || promptHistory[0] !== submitted) {
          promptHistory.unshift(submitted);
          if (promptHistory.length > MAX_HISTORY) promptHistory.pop();
          checkAndUpdateLLMSuggestion();
        }
      }, 300);
    }
  });

  console.log("👁️ Observer & Enter key capture initialized");
}

function updateScoreHistoryUI() {
  const historyList = document.getElementById("score-history-list");
  if (!historyList) return;
  historyList.innerHTML = "";

  scoreHistory.forEach((item) => {
    const li = document.createElement("li");
    li.style.marginBottom = "8px";

    const scoreColor = item.score === "high" ? "#4caf50" :
                       item.score === "medium" ? "#ff9800" : "#f44336";

    li.innerHTML = `
      <div style="font-size: 13px;">
        <span style="font-weight: bold; color: ${scoreColor};">
          [${item.score.toUpperCase()}]
        </span>
        <span style="margin-left: 5px;">${truncatePrompt(item.prompt, 40)}</span>
      </div>
    `;
    historyList.appendChild(li);
  });
}

function truncatePrompt(prompt, maxLength) {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + "...";
}

/* ------------------ Create Vertical Layout for the Panel ------------------ */

function createDropdownPanel() {
  if (document.getElementById("buddy-panel")) return;

  const panel = document.createElement("div");
  panel.id = "buddy-panel";
  panel.classList.add("buddy-panel");
  panel.style.display = "none"; // hidden by default

  // Vertical stacking: 3 sections (Suggested LLM, Score History, Settings) in a single column
  panel.innerHTML = `
    <div class="buddy-header">
      <div class="buddy-title">Prompt Buddy Playground</div>
      <div id="buddy-close-btn" class="buddy-close-btn">✕</div>
    </div>
    <div class="buddy-body">
      <!-- Suggested LLM Section -->
      <div class="buddy-section" id="section-llm">
        <button class="buddy-section-toggle" id="toggle-llm">Suggested LLM</button>
        <div class="buddy-section-content" id="content-llm" style="display: none;">
          <div id="llm-suggestion-line">
            <strong>Suggested LLM:</strong> <em>Waiting...</em>
          </div>
        </div>
      </div>

      <!-- Score History Section -->
      <div class="buddy-section" id="section-history">
        <button class="buddy-section-toggle" id="toggle-history">Score History</button>
        <div class="buddy-section-content" id="content-history" style="display: none;">
          <ul id="score-history-list" class="buddy-section-list"></ul>
        </div>
      </div>

      <!-- Settings Section -->
      <div class="buddy-section" id="section-settings">
        <button class="buddy-section-toggle" id="toggle-settings">Settings</button>
        <div class="buddy-section-content" id="content-settings" style="display: none;">
          <div class="buddy-switch-row">
            <label class="buddy-switch">
              <input type="checkbox" id="toggle-score-detection" checked>
              <span class="buddy-slider round"></span>
            </label>
            <span class="buddy-switch-label">Score Detection</span>
          </div>
          <div class="buddy-switch-row">
            <label class="buddy-switch">
              <input type="checkbox" id="toggle-pii-detection" checked>
              <span class="buddy-slider round"></span>
            </label>
            <span class="buddy-switch-label">PII Detection</span>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Close panel
  document.getElementById("buddy-close-btn").addEventListener("click", () => {
    panel.style.display = "none";
  });

  // Collapsible toggles
  document.getElementById("toggle-llm").addEventListener("click", () => {
    const contentLLM = document.getElementById("content-llm");
    contentLLM.style.display = (contentLLM.style.display === "none") ? "block" : "none";
  });
  document.getElementById("toggle-history").addEventListener("click", () => {
    const contentHistory = document.getElementById("content-history");
    contentHistory.style.display = (contentHistory.style.display === "none") ? "block" : "none";
  });
  document.getElementById("toggle-settings").addEventListener("click", () => {
    const contentSettings = document.getElementById("content-settings");
    contentSettings.style.display = (contentSettings.style.display === "none") ? "block" : "none";
  });

  // Attach toggles
  document.getElementById("toggle-score-detection").addEventListener("change", function(){
    scoreDetectionEnabled = this.checked;
    if (!scoreDetectionEnabled) {
      removeScoreTag();
    }
  });
  document.getElementById("toggle-pii-detection").addEventListener("change", function(){
    piiDetectionEnabled = this.checked;
    if (!piiDetectionEnabled) {
      removePIIPopup();
    }
  });
}

function toggleDropdownPanel() {
  const panel = document.getElementById("buddy-panel");
  if (!panel) return;
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

/* ------------------ Floating Button & Kebab ------------------ */
function createFloatingButton() {
  if (document.getElementById("prompt-buddy-container")) return;

  const container = document.createElement("div");
  container.id = "prompt-buddy-container";

  const btn = document.createElement("button");
  btn.id = "smart-suggest-btn";
  btn.innerText = "💡 Prompt Buddy";
  btn.addEventListener("click", () => {
    const inputBox = findActiveTextbox();
    if (!inputBox) {
      alert("Couldn't find textbox.");
      return;
    }
    const originalPrompt = inputBox.innerText.trim();
    if (!originalPrompt) {
      alert("⚠️ Please type something into ChatGPT first.");
      return;
    }
    fetch(`${BASE_URL}/suggest-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: originalPrompt })
    })
      .then((res) => res.json())
      .then((data) => {
        const suggestions = data.templates || [];
        if (suggestions.length > 0) {
          const newPrompt = suggestions[0];
          inputBox.innerText = newPrompt;
          inputBox.focus();
          removeScoreTag();
          scorePrompt(newPrompt);
        }
      })
      .catch((err) => {
        console.error("Error fetching prompt suggestion:", err);
      });
  });

  const kebabBtn = document.createElement("button");
  kebabBtn.id = "kebab-menu-btn";
  kebabBtn.innerText = "⋮";
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdownPanel();
  });

  container.appendChild(btn);
  container.appendChild(kebabBtn);
  document.body.appendChild(container);
}

/* ------------------ Initialization & Re-injection ------------------ */
window.addEventListener("load", () => {
  setTimeout(() => {
    const box = findActiveTextbox();
    if (box) {
      createFloatingButton();
      createDropdownPanel();
      observeInputBox();
      updateScoreHistoryUI();
    } else {
      console.log("❌ No input box found.");
    }
  }, 3000);
});

// let currentURL = window.location.href;
// setInterval(() => {
//   if (window.location.href !== currentURL) {
//     currentURL = window.location.href;
//     // Remove existing UI
//     const container = document.getElementById("prompt-buddy-container");
//     if (container) container.remove();
//     const panel = document.getElementById("buddy-panel");
//     if (panel) panel.remove();
//     removeScoreTag();
//     removePIIPopup();
//     // Reset state
//     lastScoredPrompt = "";
//     promptHistory = [];
//     scoreHistory = [];
//     // Re-initialize after a short delay
//     setTimeout(() => {
//       if (findActiveTextbox()) {
//         createFloatingButton();
//         createDropdownPanel();
//         observeInputBox();
//         updateScoreHistoryUI();
//       }
//     }, 3000);
//   }
// }, 1000);

/* ------------------ Inject CSS for a Vertical "Card" Layout ------------------ */
const style = document.createElement("style");
style.innerHTML = `
  /* Floating Prompt Buddy Container */
  #prompt-buddy-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: inline-flex;
    align-items: center;
    background: linear-gradient(45deg, #2ecc71, #27ae60);
    border-radius: 24px;
    overflow: visible;
    z-index: 99999;
  }
  #smart-suggest-btn {
    background: none;
    border: none;
    color: #fff;
    font-weight: bold;
    font-size: 15px;
    padding: 12px 20px;
    cursor: pointer;
  }
  #kebab-menu-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #fff;
    font-size: 18px;
    padding: 0 16px;
    display: none;
    cursor: pointer;
  }
  #prompt-buddy-container:hover #kebab-menu-btn {
    display: inline-block;
  }

  /* Buddy Panel: narrower for a vertical card-like UI */
  .buddy-panel {
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 350px; /* narrower card style */
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: 'Roboto', sans-serif;
    font-size: 14px;
    color: #333;
    z-index: 99999;
    overflow: hidden;
  }
  .buddy-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: linear-gradient(45deg, #2ecc71, #27ae60);
    color: #fff;
  }
  .buddy-title {
    font-size: 16px;
    font-weight: bold;
  }
  .buddy-close-btn {
    cursor: pointer;
    font-size: 18px;
  }
  .buddy-body {
    padding: 14px;
    background-color: #fafafa;
  }

  /* Each buddy-section is stacked vertically */
  .buddy-section {
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin-bottom: 12px;
  }
  .buddy-section-toggle {
    width: 100%;
    background-color: #27ae60;
    border: none;
    color: #fff;
    padding: 10px;
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
    transition: background-color 0.3s;
  }
  .buddy-section-toggle:hover {
    background-color: #1e8449;
  }
  .buddy-section-content {
    background-color: #fafafa;
    padding: 12px;
    margin-top: 8px;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 13px;
    color: #444;
  }
  .buddy-section-list {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  /* Score Pop-up (top-right bubble) */
  .score-tag {
    position: fixed;
    bottom: 70px;
    right: 40px;
    padding: 10px 15px;
    background-color: #fff;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 99999;
    opacity: 0;
    transform: translateY(10px);
    animation: scorePopup 0.5s forwards;
  }
  @keyframes scorePopup {
    to { opacity: 1; transform: translateY(0); }
  }
  .score-tag::after {
    content: "";
    position: absolute;
    bottom: -10px;
    right: 20px;
    border-width: 10px 10px 0 10px;
    border-style: solid;
    border-color: #fff transparent transparent transparent;
  }

  /* PII Pop-up (attached to left of the button) */
  .pii-tag {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translate(-100%, -50%);
    padding: 10px 15px;
    background-color: #fff;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 100000;
    opacity: 0;
    animation: fadeInLeft 0.4s forwards;
  }
  .pii-tag::after {
    content: "";
    position: absolute;
    top: 50%;
    right: -10px;
    transform: translateY(-50%);
    border-width: 10px 0 10px 10px;
    border-style: solid;
    border-color: transparent transparent transparent #fff;
  }
  @keyframes fadeInLeft {
    0% {
      opacity: 0;
      transform: translate(-110%, -50%);
    }
    100% {
      opacity: 1;
      transform: translate(-100%, -50%);
    }
  }

  /* Toggle Switch (iOS style) */
  .buddy-switch-row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
  }
  .buddy-switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
  }
  .buddy-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .buddy-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 22px;
  }
  .buddy-slider:before {
    position: absolute;
    content: "";
    height: 16px; width: 16px;
    left: 3px; bottom: 3px;
    background-color: #fff;
    transition: .4s;
    border-radius: 50%;
  }
  input:checked + .buddy-slider {
    background-color: #27ae60;
  }
  input:focus + .buddy-slider {
    box-shadow: 0 0 1px #27ae60;
  }
  input:checked + .buddy-slider:before {
    transform: translateX(18px);
  }
  .buddy-switch-label {
    margin-left: 8px;
    font-size: 14px;
    vertical-align: middle;
  }
`;
document.head.appendChild(style);
