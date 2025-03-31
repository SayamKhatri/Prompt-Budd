console.log("Extension injected...");

let debounceTimer;
let lastScoredPrompt = "";
let promptHistory = [];
let scoreHistory = []; // To store last 5 (prompt, score)
const MAX_HISTORY = 5;

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
  tag.innerText =
    score === "high" ? "🟩 HIGH" :
    score === "medium" ? "🟨 MEDIUM" :
    "🟥 LOW";

  tag.style.position = "fixed";
  tag.style.bottom = "60px";
  tag.style.right = "20px";
  tag.style.padding = "8px 12px";
  tag.style.borderRadius = "6px";
  tag.style.fontWeight = "bold";
  tag.style.fontSize = "14px";
  tag.style.backgroundColor = "#fff";
  tag.style.color = "#111";
  tag.style.border = "1px solid #ddd";
  tag.style.zIndex = "99999";
  tag.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
  document.body.appendChild(tag);
}

function removeScoreTag() {
  const tag = document.getElementById("quality-score-tag");
  if (tag) tag.remove();
  lastScoredPrompt = "";
}

function scorePrompt(prompt) {
  if (!prompt || prompt.trim() === "") {
    removeScoreTag();
    return;
  }
  const cleaned = prompt.trim();
  if (cleaned === lastScoredPrompt) return;
  lastScoredPrompt = cleaned;
  fetch("http://localhost:8000/prompt-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: cleaned })
  })
    .then(res => res.json())
    .then(data => {
      const score = data.score || "unknown";
      if (["low", "medium", "high"].includes(score)) {
        // Save prompt and its score in history
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
  fetch("http://localhost:8000/prompt_classifier", {
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
        return;
      }
      scorePrompt(current);
    }, 700);
  });
  observer.observe(box, {
    characterData: true,
    childList: true,
    subtree: true,
  });
  // Enter key detection: update history & LLM suggestion
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

/* ------------------ UI Creation with Interactive Sections ------------------ */

function createDropdownPanel() {
  if (document.getElementById("buddy-panel")) return;
  const panel = document.createElement("div");
  panel.id = "buddy-panel";
  panel.classList.add("buddy-panel");
  panel.style.display = "none"; // hidden by default
  panel.innerHTML = `
    <div class="buddy-header">
      <div class="buddy-title">Prompt Buddy</div>
      <div id="buddy-close-btn" class="buddy-close-btn">✕</div>
    </div>
    <div class="buddy-body">
      <!-- Suggested LLM Collapsible Section -->
      <div class="buddy-section" id="section-llm">
        <button class="buddy-section-toggle" id="toggle-llm">Suggested LLM</button>
        <div class="buddy-section-content" id="content-llm" style="display: none;">
          <div id="llm-suggestion-line">
            <strong>Suggested LLM:</strong> <em>Waiting...</em>
          </div>
        </div>
      </div>
      <!-- Score History Collapsible Section -->
      <div class="buddy-section" id="section-history">
        <button class="buddy-section-toggle" id="toggle-history">Score History</button>
        <div class="buddy-section-content" id="content-history" style="display: none;">
          <ul id="score-history-list" class="buddy-section-list"></ul>
        </div>
      </div>
      <!-- Prompt Buddy Tools (Static Info) -->
      <div class="buddy-section" id="section-tools">
        <h4 class="buddy-section-title">Prompt Buddy Tools</h4>
        <p style="font-size: 13px; margin-bottom: 8px;">
          Click the <strong>Prompt Buddy</strong> button to auto-suggest a prompt template.
        </p>
        <p style="font-size: 12px; color: #555;">
          (This preserves your existing pop-up feature.)
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  // Close panel
  document.getElementById("buddy-close-btn").addEventListener("click", () => {
    panel.style.display = "none";
  });
  // Toggle sections
  document.getElementById("toggle-llm").addEventListener("click", () => {
    const contentLLM = document.getElementById("content-llm");
    contentLLM.style.display = contentLLM.style.display === "none" ? "block" : "none";
  });
  document.getElementById("toggle-history").addEventListener("click", () => {
    const contentHistory = document.getElementById("content-history");
    contentHistory.style.display = contentHistory.style.display === "none" ? "block" : "none";
  });
}

function toggleDropdownPanel() {
  const panel = document.getElementById("buddy-panel");
  if (!panel) return;
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

function createFloatingButton() {
  if (document.getElementById("smart-suggest-btn")) return;
  // Main Prompt Buddy Button
  const btn = document.createElement("button");
  btn.innerText = "💡 Prompt Buddy";
  btn.id = "smart-suggest-btn";
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.right = "80px";
  btn.style.zIndex = "99999";
  btn.style.padding = "12px 20px";
  btn.style.borderRadius = "24px";
  btn.style.border = "none";
  btn.style.background = "linear-gradient(45deg, #6a11cb, #2575fc)";
  btn.style.color = "#fff";
  btn.style.fontWeight = "bold";
  btn.style.fontSize = "15px";
  btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  btn.style.cursor = "pointer";
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
    fetch("http://localhost:8000/suggest-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: originalPrompt })
    })
      .then((res) => res.json())
      .then((data) => {
        const suggestions = data.templates || [];
        if (suggestions.length > 0) {
          const newPrompt = suggestions[0];
          // FIX: Directly set the new prompt, focus the textbox, and update
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
  // Kebab (three vertical dots) button for toggling the panel
  const kebabBtn = document.createElement("button");
  kebabBtn.id = "kebab-menu-btn";
  kebabBtn.innerText = "⋮";
  kebabBtn.style.position = "fixed";
  kebabBtn.style.bottom = "20px";
  kebabBtn.style.right = "20px";
  kebabBtn.style.zIndex = "99999";
  kebabBtn.style.padding = "10px";
  kebabBtn.style.borderRadius = "50%";
  kebabBtn.style.border = "none";
  kebabBtn.style.background = "linear-gradient(45deg, #6a11cb, #2575fc)";
  kebabBtn.style.color = "#fff";
  kebabBtn.style.fontSize = "20px";
  kebabBtn.style.cursor = "pointer";
  kebabBtn.addEventListener("click", () => {
    toggleDropdownPanel();
  });
  document.body.appendChild(btn);
  document.body.appendChild(kebabBtn);
}

/* ------------------ Initialize on Page Load ------------------ */
window.addEventListener("load", () => {
  setTimeout(() => {
    const box = findActiveTextbox();
    if (box) {
      createFloatingButton();
      createDropdownPanel(); // Panel created hidden by default
      observeInputBox();
      updateScoreHistoryUI();
    } else {
      console.log("❌ No input box found.");
    }
  }, 3000);
});

/* ------------------ CSS Injection for a Modern, Production-Level UI ------------------ */
const style = document.createElement("style");
style.innerHTML = `
  /* Panel Styles */
  .buddy-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 320px;
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
    padding: 16px;
    background-color: #2575fc;
    color: #fff;
  }
  .buddy-title {
    font-size: 18px;
    font-weight: bold;
  }
  .buddy-close-btn {
    cursor: pointer;
    font-size: 20px;
  }
  .buddy-body {
    padding: 16px;
    background-color: #fafafa;
  }
  .buddy-section {
    margin-bottom: 16px;
  }
  .buddy-section-toggle {
    width: 100%;
    background-color: #6a11cb;
    border: none;
    color: #fff;
    padding: 10px;
    font-size: 15px;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.3s;
  }
  .buddy-section-toggle:hover {
    background-color: #5a0eaa;
  }
  .buddy-section-content {
    background-color: #fff;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    margin-top: 8px;
    font-size: 14px;
    color: #444;
  }
  .buddy-section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .buddy-section-list {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }
  /* Floating Button Styles */
  #smart-suggest-btn {
    position: fixed;
    bottom: 20px;
    right: 80px;
    z-index: 99999;
    padding: 12px 20px;
    border-radius: 24px;
    border: none;
    background: linear-gradient(45deg, #6a11cb, #2575fc);
    color: #fff;
    font-weight: bold;
    font-size: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    cursor: pointer;
  }
  #kebab-menu-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    padding: 10px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(45deg, #6a11cb, #2575fc);
    color: #fff;
    font-size: 20px;
    cursor: pointer;
  }
`;
document.head.appendChild(style);
