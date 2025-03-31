console.log("Extension injected...");

let debounceTimer;
let lastScoredPrompt = "";
let promptHistory = [];
let scoreHistory = [];
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

/* ------------------ UI Creation with Side-by-Side Sections ------------------ */

function createDropdownPanel() {
  if (document.getElementById("buddy-panel")) return;

  const panel = document.createElement("div");
  panel.id = "buddy-panel";
  panel.classList.add("buddy-panel");
  panel.style.display = "none"; // hidden by default

  // Side-by-side layout for Suggested LLM and Score History
  panel.innerHTML = `
    <div class="buddy-header">
      <div class="buddy-title">Prompt Buddy</div>
      <div id="buddy-close-btn" class="buddy-close-btn">✕</div>
    </div>
    <div class="buddy-body">
      <div class="buddy-row">
        <div class="buddy-col">
          <div class="buddy-section" id="section-llm">
            <button class="buddy-section-toggle" id="toggle-llm">Suggested LLM</button>
            <div class="buddy-section-content" id="content-llm" style="display: none;">
              <div id="llm-suggestion-line">
                <strong>Suggested LLM:</strong> <em>Waiting...</em>
              </div>
            </div>
          </div>
        </div>
        <div class="buddy-col">
          <div class="buddy-section" id="section-history">
            <button class="buddy-section-toggle" id="toggle-history">Score History</button>
            <div class="buddy-section-content" id="content-history" style="display: none;">
              <ul id="score-history-list" class="buddy-section-list"></ul>
            </div>
          </div>
        </div>
      </div>
      <div class="buddy-row">
        <div class="buddy-col" style="width: 100%;">
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
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Close panel functionality
  document.getElementById("buddy-close-btn").addEventListener("click", () => {
    panel.style.display = "none";
  });

  // Toggle section functionality
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

/* 
  Floating button container for the rectangular "Prompt Buddy" button and its kebab menu.
*/
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

/* ------------------ CSS Injection for a Modern Teal Theme & Stylish Score Pop-up ------------------ */
const style = document.createElement("style");
style.innerHTML = `
  /* Container for the floating Prompt Buddy button and kebab menu */
  #prompt-buddy-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: inline-flex;
    align-items: center;
    background: linear-gradient(45deg, #2ecc71, #27ae60);
    border-radius: 24px;
    overflow: hidden;
    z-index: 99999;
  }
  /* Main Prompt Buddy button */
  #smart-suggest-btn {
    background: none;
    border: none;
    color: #fff;
    font-weight: bold;
    font-size: 15px;
    padding: 12px 20px;
    cursor: pointer;
  }
  /* Kebab menu button */
  #kebab-menu-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #fff;
    font-size: 18px;
    padding: 0 16px;
    display: none;
    cursor: pointer;
  }
  /* Show kebab menu on hover over container */
  #prompt-buddy-container:hover #kebab-menu-btn {
    display: inline-block;
  }

  /* Buddy Panel Styles */
  .buddy-panel {
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 500px;
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
    background: linear-gradient(45deg, #2ecc71, #27ae60);
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
  .buddy-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 16px;
  }
  .buddy-col {
    flex: 1;
    min-width: 0;
  }
  .buddy-section {
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin-bottom: 0;
  }
  .buddy-section-toggle {
    width: 100%;
    background-color: #27ae60;
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
    background-color: #1e8449;
  }
  .buddy-section-content {
    background-color: #fafafa;
    padding: 12px;
    margin-top: 8px;
    border: 1px solid #eee;
    border-radius: 6px;
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

  /* Stylish Score Pop-up as a Chat Notification */
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
`;
document.head.appendChild(style);
