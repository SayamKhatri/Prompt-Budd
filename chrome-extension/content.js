const BASE_URL = "http://localhost:8000";
console.log("Extension injected...");

let debounceTimer;
let lastScoredPrompt = "";
let promptHistory = [];
let scoreHistory = [];
const MAX_HISTORY = 5;

// Global flags for detection settings and prompt type
let scoreDetectionEnabled = true;
let piiDetectionEnabled = true;
let promptType = "short";  // "short" or "descriptive"

function findActiveTextbox() {
  const box = document.querySelector("#prompt-textarea.ProseMirror");
  if (box && box.offsetParent !== null && box.isContentEditable) {
    return box;
  }
  return null;
}

/* ------------------ Horizontal Pipe Score Meter Popup (Top, attached to icon) ------------------ */

/**
 * Compute & apply top/left on #score-pipe-popup
 * so it always sits just above the fixed icon.
 */
function repositionScorePipePopup() {
  const popup = document.getElementById("score-pipe-popup");
  if (!popup) return;

  const icon = document.getElementById("smart-suggest-img");
  if (!icon) {
    // fallback if icon not found
    popup.style.position = "fixed";
    popup.style.bottom   = "70px";
    popup.style.right    = "40px";
    return;
  }

  const iconRect   = icon.getBoundingClientRect();
  const gap        = 10;
  const { width: pw, height: ph } = popup.getBoundingClientRect();

  let left = iconRect.left;
  let top  = iconRect.top - ph - gap;

  // clamp horizontally
  if (left + pw > window.innerWidth - 10) {
    left = window.innerWidth - pw - 10;
  } else if (left < 10) {
    left = 10;
  }

  popup.style.position = "fixed";
  popup.style.left     = left + "px";
  popup.style.top      = top  + "px";
}

function showScorePipePopup(score) {
  removeScorePipePopup(); // Remove old popup

  const popup = document.createElement("div");
  popup.id = "score-pipe-popup";
  popup.className = "score-pipe-popup";
  popup.innerHTML = `
    <div class="pipe-popup-title">Score Meter</div>
    <div class="pipe-popup-meter">
      <div class="pipe-segment"></div>
      <div class="pipe-segment"></div>
      <div class="pipe-segment"></div>
      <div class="pipe-segment"></div>
      <div class="pipe-segment"></div>
    </div>
    <div class="pipe-popup-legend">Low / Medium / High</div>
  `;
  document.body.appendChild(popup);

  // Decide how many segments to fill
  let fillCount = 0;
  let fillColor = "#ccc";
  if (score === "low") {
    fillCount = 2; fillColor = "red";
  } else if (score === "medium") {
    fillCount = 3; fillColor = "orange";
  } else if (score === "high") {
    fillCount = 5; fillColor = "green";
  }
  popup.querySelectorAll(".pipe-segment").forEach((seg, i) => {
    seg.style.backgroundColor = (i < fillCount) ? fillColor : "#ddd";
  });

  // Position once now, then keep it anchored on resize
  repositionScorePipePopup();
  window.addEventListener("resize", repositionScorePipePopup);
}

function removeScorePipePopup() {
  const old = document.getElementById("score-pipe-popup");
  if (old) old.remove();
  window.removeEventListener("resize", repositionScorePipePopup);
}



/* ------------------ PII Detection Functions ------------------ */
function showPIIPopup() {
  if (document.getElementById("pii-tag")) return;
  const imgBtn = document.getElementById("smart-suggest-img");
  if (!imgBtn) return;
  imgBtn.style.position = "relative";
  const tag = document.createElement("div");
  tag.id = "pii-tag";
  tag.className = "pii-tag";
  tag.innerText = "PII Detected!";
  imgBtn.appendChild(tag);
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

/* ------------------ Score Prompt Function ------------------ */
function scorePrompt(prompt) {
  if (!scoreDetectionEnabled) {
    removeScorePipePopup();
    return;
  }
  if (!prompt || prompt.trim() === "") {
    removeScorePipePopup();
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
        showScorePipePopup(score);
      } else {
        removeScorePipePopup();
      }
    })
    .catch(err => {
      console.error("Scoring error:", err);
    });
}

/* ------------------ LLM Suggestion Function ------------------ */
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

/* ------------------ Observer Function ------------------ */
function observeInputBox() {
  const box = findActiveTextbox();
  if (!box) return;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const current = box.innerText.trim();
      if (!current) {
        removeScorePipePopup();
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

/* ------------------ Update Score History UI with Mini Pipe Meter & Copy Icon ------------------ */
function updateScoreHistoryUI() {
  const historyList = document.getElementById("score-history-list");
  if (!historyList) return;
  historyList.innerHTML = "";
  scoreHistory.forEach((item) => {
    let fillCount = 0;
    let fillColor = "#ccc";
    if (item.score === "low") {
      fillCount = 2;
      fillColor = "red";
    } else if (item.score === "medium") {
      fillCount = 3;
      fillColor = "orange";
    } else if (item.score === "high") {
      fillCount = 5;
      fillColor = "green";
    }
    const li = document.createElement("li");
    li.style.marginBottom = "8px";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    let meterHTML = "";
    for (let i = 0; i < 5; i++) {
      const color = i < fillCount ? fillColor : "#ddd";
      meterHTML += `<div class="mini-segment" style="background-color:${color};"></div>`;
    }
    li.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="prompt-text" style="font-size: 13px;">${truncatePrompt(item.prompt, 40)}</span>
        <div class="mini-pipe-meter">${meterHTML}</div>
      </div>
      <span class="copy-icon" title="Copy prompt" style="cursor: pointer; font-size: 16px;">📋</span>
    `;
    li.querySelector(".copy-icon").addEventListener("click", () => {
      navigator.clipboard.writeText(item.prompt)
        .then(() => { alert("Prompt copied!"); })
        .catch((err) => { console.error("Copy failed:", err); });
    });
    historyList.appendChild(li);
  });
}

function truncatePrompt(prompt, maxLength) {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + "...";
}

/* ------------------ Create Prompt Buddy Playground Panel (Tabbed Layout) ------------------ */
function createDropdownPanel() {
  if (document.getElementById("buddy-panel")) return;
  const panel = document.createElement("div");
  panel.id = "buddy-panel";
  panel.classList.add("buddy-panel");
  panel.style.display = "none"; // hidden by default
  panel.innerHTML = `
    <div class="buddy-header">
      <div class="buddy-title">Prompt Buddy Playground</div>
      <div class="header-icons">
        <div id="buddy-gear-btn" class="buddy-gear-btn" title="Settings">⚙️</div>
        <div id="buddy-close-btn" class="buddy-close-btn" title="Close">✕</div>
      </div>
    </div>
    <div class="buddy-tabs">
      <button class="buddy-tab active-tab" id="tab-llm">Suggested LLM</button>
      <button class="buddy-tab" id="tab-history">Score History</button>
    </div>
    <div class="buddy-content" id="buddy-content">
      <div id="content-llm">
        <div id="llm-suggestion-line">
          <strong>Suggested LLM:</strong> <em>Waiting...</em>
        </div>
      </div>
      <div id="content-history" style="display: none;">
        <ul id="score-history-list" class="buddy-section-list"></ul>
      </div>
    </div>
    <div class="buddy-section" id="section-settings" style="display: none;">
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
      <div class="buddy-switch-row" style="margin-top:10px;">
        <span class="buddy-switch-label" style="font-weight:bold;">Prompt Type:</span>
        <label style="margin-left: 10px;">
          <input type="radio" name="promptType" value="short" checked> Short
        </label>
        <label style="margin-left: 10px;">
          <input type="radio" name="promptType" value="descriptive"> Descriptive
        </label>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  document.getElementById("buddy-close-btn").addEventListener("click", () => {
    panel.style.display = "none";
  });
  document.getElementById("buddy-gear-btn").addEventListener("click", () => {
    const settings = document.getElementById("section-settings");
    settings.style.display = (settings.style.display === "none") ? "block" : "none";
  });
  document.getElementById("tab-llm").addEventListener("click", () => {
    document.getElementById("content-llm").style.display = "block";
    document.getElementById("content-history").style.display = "none";
    document.getElementById("tab-llm").classList.add("active-tab");
    document.getElementById("tab-history").classList.remove("active-tab");
  });
  document.getElementById("tab-history").addEventListener("click", () => {
    document.getElementById("content-history").style.display = "block";
    document.getElementById("content-llm").style.display = "none";
    document.getElementById("tab-history").classList.add("active-tab");
    document.getElementById("tab-llm").classList.remove("active-tab");
  });
  document.getElementById("toggle-score-detection").addEventListener("change", function(){
    scoreDetectionEnabled = this.checked;
    if (!scoreDetectionEnabled) {
      removeScorePipePopup();
      removeScorePipePopup(); // ensure removal of any score popup
    }
  });
  document.getElementById("toggle-pii-detection").addEventListener("change", function(){
    piiDetectionEnabled = this.checked;
    if (!piiDetectionEnabled) {
      removePIIPopup();
    }
  });
  document.querySelectorAll('input[name="promptType"]').forEach((elem) => {
    elem.addEventListener("change", function() {
      promptType = this.value;
    });
  });
}

function toggleDropdownPanel() {
  const panel = document.getElementById("buddy-panel");
  if (!panel) return;

  // Toggle display
  const isHidden = (panel.style.display === "none" || !panel.style.display);
  panel.style.display = isHidden ? "block" : "none";

  if (isHidden) {
    // Now that it's visible, measure and position relative to the icon
    setTimeout(() => {
      const icon = document.getElementById("smart-suggest-img");
      if (!icon) return;

      const iconRect = icon.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const gap = 10;

      // By default, place the panel below the icon
      let left = iconRect.left; 
      let top = iconRect.bottom + gap;

      // If going off screen to the right, clamp
      if (left + panelWidth > window.innerWidth - 10) {
        left = window.innerWidth - panelWidth - 10;
      }
      // If going off screen at the bottom, place it above the icon instead
      if (top + panelHeight > window.innerHeight - 10) {
        top = iconRect.top - panelHeight - gap;
      }

      panel.style.position = "fixed";
      panel.style.left = left + "px";
      panel.style.top = top + "px";
    }, 0);
  }
}


/* ------------------ Floating Button & Draggable Icon ------------------ */

function createFloatingButton() {
  if (document.getElementById("prompt-buddy-container")) return;
  
  const container = document.createElement("div");
  container.id = "prompt-buddy-container";
  container.style.width = "56px";
  container.style.height = "56px";
  container.style.position = "fixed";
  container.style.bottom = "20px";
  container.style.right = "0px"; // Sticks to right edge
  container.style.top = "200px"; // Fixed vertical position (adjust as needed)
  container.style.overflow = "hidden";
  container.style.borderRadius = "8px";
  container.style.transition = "width 0.3s ease";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.zIndex = "99999";
  // Remove draggable event listeners (previous mousedown events are removed)
  
  const imgBtn = document.createElement("img");
  imgBtn.id = "smart-suggest-img";
  imgBtn.src = chrome.runtime.getURL("icons/logo.png");
  imgBtn.alt = "Prompt Buddy";
  imgBtn.style.width = "56px";
  imgBtn.style.height = "56px";
  imgBtn.style.borderRadius = "8px";
  imgBtn.style.flexShrink = "0";
  imgBtn.style.cursor = "pointer";
  
  const kebabContainer = document.createElement("div");
  kebabContainer.id = "kebab-container";
  kebabContainer.style.width = "24px";
  kebabContainer.style.height = "56px";
  kebabContainer.style.display = "flex";
  kebabContainer.style.alignItems = "center";
  kebabContainer.style.justifyContent = "center";
  kebabContainer.style.background = "linear-gradient(180deg, #333 0%, #111 100%)";
  kebabContainer.style.opacity = "0";
  kebabContainer.style.transition = "opacity 0.3s ease";
  kebabContainer.style.flexShrink = "0";
  
  const kebabBtn = document.createElement("button");
  kebabBtn.id = "kebab-menu-btn";
  kebabBtn.innerText = "⋮";
  kebabBtn.style.width = "100%";
  kebabBtn.style.height = "100%";
  kebabBtn.style.border = "none";
  kebabBtn.style.background = "transparent";
  kebabBtn.style.color = "#fff";
  kebabBtn.style.fontSize = "18px";
  kebabBtn.style.cursor = "pointer";
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdownPanel();
  });
  kebabContainer.appendChild(kebabBtn);
  
  container.appendChild(imgBtn);
  container.appendChild(kebabContainer);
  
  container.addEventListener("mouseenter", () => {
    container.style.width = "80px";
    kebabContainer.style.opacity = "1";
  });
  container.addEventListener("mouseleave", () => {
    container.style.width = "56px";
    kebabContainer.style.opacity = "0";
  });
  
  imgBtn.addEventListener("click", () => {
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
    const endpoint = (promptType === "descriptive")
      ? `${BASE_URL}/suggest-templates-descriptive`
      : `${BASE_URL}/suggest-templates`;
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: originalPrompt })
    })
      .then((res) => res.json())
      .then((data) => {
        const suggestions = data.templates || [];
        if (suggestions.length > 0) {
          const newPrompt = suggestions;
          inputBox.innerText = newPrompt;
          inputBox.focus();
          removeScorePipePopup();
          scorePrompt(newPrompt);
        }
      })
      .catch((err) => {
        console.error("Error fetching prompt suggestion:", err);
      });
  });
  
  document.body.appendChild(container);
}



/* ------------------ On Load ------------------ */
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

/* ------------------ Inject CSS ------------------ */
const style = document.createElement("style");
style.innerHTML = `
  /* Floating Container for Icon & Kebab */
  #prompt-buddy-container {
    position: fixed;
    bottom: 20px;
    right: 0px; /* stick to right edge */
    width: 56px;
    height: 56px;
    overflow: hidden;
    border-radius: 8px;
    display: flex;
    align-items: center;
    transition: width 0.3s ease;
    z-index: 99999;
    background: transparent;
  }
  #prompt-buddy-container:hover {
    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
  }
  
  /* Icon Image */
  #smart-suggest-img {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    display: block;
    flex-shrink: 0;
    cursor: pointer;
  }
  
  /* Kebab Container */
  #kebab-container {
    width: 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #333 0%, #111 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
    flex-shrink: 0;
  }
  
  /* Kebab Button */
  #kebab-menu-btn {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
  }
  
  /* Buddy Panel */
  .buddy-panel {
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 380px;
    background-color: #fdfdfd;
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
    background: linear-gradient(45deg, #8E2DE2, #FF62A5);
    color: #fff;
    padding: 14px 16px;
  }
  .buddy-title {
    font-size: 16px;
    font-weight: bold;
  }
  .header-icons {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .buddy-gear-btn {
    cursor: pointer;
    font-size: 16px;
  }
  .buddy-close-btn {
    cursor: pointer;
    font-size: 18px;
  }
  .buddy-body {
    padding: 14px;
    background-color: #fafafa;
  }
  /* Buddy Tabs */
  .buddy-tabs {
    display: flex;
    border-bottom: 1px solid #ddd;
  }
  .buddy-tab {
    flex: 1;
    padding: 10px;
    background: linear-gradient(45deg, #8E2DE2, #FF62A5);
    border: none;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    transition: opacity 0.3s;
  }
  .buddy-tab:hover {
    opacity: 0.9;
  }
  .active-tab {
    background: #fff;
    color: #333;
    border-bottom: 2px solid #8E2DE2;
  }
  .buddy-content {
    padding: 12px;
  }
  /* Buddy Section for Settings */
  .buddy-section {
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin-top: 12px;
  }
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
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
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
  
  /* Horizontal Pipe Score Meter Popup (attached to icon) */
  #score-pipe-popup {
    position: fixed;
    width: 240px;
    padding: 12px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    font-family: 'Roboto', sans-serif;
    color: #333;
    z-index: 99999;
    opacity: 0;
    transform: translateY(10px);
    animation: pipePopupFadeIn 0.4s forwards;
  }
  @keyframes pipePopupFadeIn {
    to { opacity: 1; transform: translateY(0); }
  }
  .pipe-popup-title {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 6px;
    text-align: center;
  }
  .pipe-popup-meter {
    display: flex;
    flex-direction: row;
    justify-content: center;
    margin-bottom: 6px;
  }
  .pipe-segment {
    width: 12px;
    height: 20px;
    border-radius: 4px;
    background-color: #ddd;
    margin-right: 4px;
    transition: background-color 0.3s;
  }
  .pipe-popup-legend {
    font-size: 12px;
    color: #666;
    text-align: center;
  }
  
  /* Mini Pipe Meter for Score History */
  .mini-pipe-meter {
    display: flex;
    flex-direction: row;
    margin-top: 4px;
  }
  .mini-segment {
    width: 8px;
    height: 14px;
    border-radius: 3px;
    background-color: #ddd;
    margin-right: 3px;
    transition: background-color 0.3s;
  }
  
  /* PII Popup */
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
    0% { opacity: 0; transform: translate(-110%, -50%); }
    100% { opacity: 1; transform: translate(-100%, -50%); }
  }
`;
document.head.appendChild(style);
