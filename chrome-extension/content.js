console.log("Extension injected...");

let debounceTimer;
let lastScoredPrompt = "";
let promptHistory = [];
let scoreHistory = []; // Store last 5 (prompt + score)
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

  // Basic styling for the floating tag
  tag.style.position = "fixed";
  tag.style.bottom = "60px";
  tag.style.right = "20px";
  tag.style.padding = "8px 12px";
  tag.style.borderRadius = "6px";
  tag.style.fontWeight = "bold";
  tag.style.fontSize = "14px";
  tag.style.backgroundColor = "white";
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
        // Keep a small history of (prompt, score)
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

  // Call the prompt_classifier endpoint to get LLM suggestions
  fetch("http://localhost:8000/prompt_classifier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompts: promptHistory })
  })
    .then(res => res.json())
    .then(data => {
      const line = document.getElementById("llm-suggestion-line");
      if (line) {
        if (data.suggested_llm && data.suggested_llm !== "Unknown") {
          line.innerHTML = `
            <div class="buddy-section-content">
              <strong>Suggested LLM:</strong> ${data.suggested_llm}
              <br><small>${data.reason || ""}</small>
            </div>
          `;
        } else {
          line.innerHTML = `
            <div class="buddy-section-content">
              <strong>Suggested LLM:</strong> <em>No strong signal</em>
            </div>
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

  // Enter key detection
  box.addEventListener("keydown", (event) => {
    const isEnter = event.key === "Enter";
    const plainEnter = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (isEnter && plainEnter) {
      setTimeout(() => {
        const submitted = lastScoredPrompt;
        if (!submitted) return;
        // Keep track of prompt history for LLM suggestion
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

// Update the Score History UI
function updateScoreHistoryUI() {
  const historyList = document.getElementById("score-history-list");
  if (!historyList) return;

  // Clear existing
  historyList.innerHTML = "";

  // Render the last 5 scored prompts
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

// Helper to truncate a prompt if too long
function truncatePrompt(prompt, maxLength) {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + "...";
}

/* ------------------ UI Creation ------------------ */

function createDropdownPanel() {
  // Create the panel only once
  if (document.getElementById("buddy-panel")) return;

  // Panel container
  const panel = document.createElement("div");
  panel.id = "buddy-panel";
  panel.classList.add("buddy-panel"); // For CSS styling
  panel.style.display = "none"; // hidden by default

  // Panel inner HTML (inspired by the “card” style from your screenshot)
  panel.innerHTML = `
    <div class="buddy-header">
      <div class="buddy-title">Prompt Buddy</div>
      <div id="buddy-close-btn" class="buddy-close-btn">✕</div>
    </div>

    <div class="buddy-body">
      <!-- Suggested LLM Section -->
      <div class="buddy-section">
        <h4 class="buddy-section-title">Suggested LLM</h4>
        <div id="llm-suggestion-line" class="buddy-section-content">
          <strong>Suggested LLM:</strong> <em>Waiting...</em>
        </div>
      </div>

      <!-- Score History Section -->
      <div class="buddy-section">
        <h4 class="buddy-section-title">Score History</h4>
        <ul id="score-history-list" class="buddy-section-list"></ul>
      </div>

      <!-- Pop-up / Prompt Buddy Tools -->
      <div class="buddy-section">
        <h4 class="buddy-section-title">Prompt Buddy Tools</h4>
        <p style="font-size: 13px; margin-bottom: 8px;">
          Use the <strong>Prompt Buddy</strong> button to auto-suggest templates 
          based on your current prompt.
        </p>
        <p style="font-size: 12px; color: #555;">
          (This preserves your existing pop-up feature.)
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Close panel when clicking the "✕" in the header
  const closeBtn = panel.querySelector("#buddy-close-btn");
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
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
  btn.style.right = "20px";
  btn.style.zIndex = "99999";
  btn.style.padding = "10px 16px";
  btn.style.borderRadius = "8px";
  btn.style.border = "none";
  btn.style.backgroundColor = "#10a37f";
  btn.style.color = "white";
  btn.style.fontWeight = "bold";
  btn.style.fontSize = "14px";
  btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  btn.style.cursor = "pointer";
  btn.style.marginRight = "32px"; // Leave space for the kebab

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
          inputBox.innerText = "";
          document.execCommand("insertText", false, newPrompt);
          removeScoreTag();
          scorePrompt(newPrompt);
        }
      })
      .catch((err) => {
        console.error("Error fetching prompt suggestion:", err);
      });
  });

  // Three vertical dots (kebab menu) for toggling the panel
  const kebabBtn = document.createElement("button");
  kebabBtn.id = "kebab-menu-btn";
  kebabBtn.innerText = "⋮"; // Could use an icon if you prefer
  kebabBtn.style.position = "fixed";
  kebabBtn.style.bottom = "20px";
  kebabBtn.style.right = "20px";
  kebabBtn.style.zIndex = "99999";
  kebabBtn.style.padding = "6px 10px";
  kebabBtn.style.borderRadius = "4px";
  kebabBtn.style.border = "none";
  kebabBtn.style.backgroundColor = "#10a37f";
  kebabBtn.style.color = "white";
  kebabBtn.style.fontSize = "18px";
  kebabBtn.style.cursor = "pointer";

  kebabBtn.addEventListener("click", () => {
    toggleDropdownPanel();
  });

  document.body.appendChild(btn);
  document.body.appendChild(kebabBtn);
}

/* ------------------ Initialize on page load ------------------ */

window.addEventListener("load", () => {
  setTimeout(() => {
    const box = findActiveTextbox();
    if (box) {
      createFloatingButton();
      createDropdownPanel(); // create panel (hidden by default)
      observeInputBox();
      updateScoreHistoryUI(); // Ensure the list is blank initially
    } else {
      console.log("❌ No input box found.");
    }
  }, 3000);
});

/* ------------------ OPTIONAL: Some CSS to match the “card-like” style ------------------ */
// You can either place this in a separate CSS file or inject via JS.
// Below is minimal inline style injection if you prefer:

const style = document.createElement("style");
style.innerHTML = `
  .buddy-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 300px;
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-family: sans-serif;
    font-size: 14px;
    color: #333;
    z-index: 99999;
  }

  .buddy-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
    background-color: #f9f9f9;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
  }

  .buddy-title {
    font-size: 16px;
    font-weight: 600;
  }

  .buddy-close-btn {
    cursor: pointer;
    font-size: 16px;
    color: #999;
  }
  .buddy-close-btn:hover {
    color: #666;
  }

  .buddy-body {
    padding: 12px 16px;
  }

  .buddy-section {
    margin-bottom: 16px;
  }

  .buddy-section-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px 0;
    border-left: 4px solid #10a37f;
    padding-left: 8px;
  }

  .buddy-section-content {
    font-size: 13px;
    color: #444;
    background-color: #fafafa;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #eee;
  }

  .buddy-section-list {
    list-style-type: none;
    padding-left: 0;
    margin: 0;
  }
`;
document.head.appendChild(style);
