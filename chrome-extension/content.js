console.log("Extension injected...");

let debounceTimer;
let lastScoredPrompt = "";
let promptHistory = [];
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
      showScoreTag(score);
    })
    .catch(err => {
      console.error("Scoring error:", err);
    });
}

function checkAndUpdateLLMSuggestion() {
  if (promptHistory.length === 0) return;

  fetch("http://localhost:8000/suggest-llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompts: promptHistory })
  })
    .then(res => res.json())
    .then(data => {
      const line = document.getElementById("llm-suggestion-line");
      if (line) {
        if (data.suggested_llm && data.suggested_llm !== "Unknown") {
          line.innerHTML = `<strong>Suggested LLM:</strong> ${data.suggested_llm}<br><small>${data.reason}</small>`;
        } else {
          line.innerHTML = `<strong>Suggested LLM:</strong> <em>No strong signal</em>`;
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

  // Enter key detection: triggers prompt history update and LLM suggestion via prompt_classifier
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

function createDropdownPanel() {
  // Create the panel only once and keep it hidden initially.
  if (document.getElementById("buddy-panel")) return;

  const panel = document.createElement("div");
  panel.id = "buddy-panel";
  panel.style.position = "fixed";
  panel.style.bottom = "65px";
  panel.style.right = "20px";
  panel.style.width = "260px";
  panel.style.backgroundColor = "#fdfdfd";
  panel.style.border = "1px solid #ccc";
  panel.style.borderRadius = "10px";
  panel.style.padding = "12px";
  panel.style.fontSize = "13px";
  panel.style.zIndex = "99999";
  panel.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  panel.style.display = "none"; // hidden by default
  panel.innerHTML = `
    <strong>Prompt Buddy Panel</strong><br>
    <div id="llm-suggestion-line" style="margin-top: 6px;">
      <strong>Suggested LLM:</strong> <em>Waiting...</em>
    </div>
  `;

  document.body.appendChild(panel);
}

function toggleDropdownPanel() {
  const panel = document.getElementById("buddy-panel");
  if (panel) {
    panel.style.display = (panel.style.display === "none" ? "block" : "none");
  }
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

  // Settings button (gear icon) beside the main button
  const settingsBtn = document.createElement("button");
  settingsBtn.innerText = "⚙️";
  settingsBtn.id = "prompt-settings-btn";
  settingsBtn.style.position = "fixed";
  // Position it to the left of the main button with a small gap
  settingsBtn.style.bottom = "20px";
  settingsBtn.style.right = "140px";
  settingsBtn.style.zIndex = "99999";
  settingsBtn.style.padding = "10px";
  settingsBtn.style.borderRadius = "50%";
  settingsBtn.style.border = "none";
  settingsBtn.style.backgroundColor = "#10a37f";
  settingsBtn.style.color = "white";
  settingsBtn.style.fontSize = "16px";
  settingsBtn.style.cursor = "pointer";

  settingsBtn.addEventListener("click", () => {
    // Toggle the dropdown panel on settings click.
    toggleDropdownPanel();
  });

  document.body.appendChild(btn);
  document.body.appendChild(settingsBtn);
}

window.addEventListener("load", () => {
  setTimeout(() => {
    const box = findActiveTextbox();
    if (box) {
      createFloatingButton();
      createDropdownPanel(); // create panel (hidden by default)
      observeInputBox();
    } else {
      console.log("❌ No input box found.");
    }
  }, 3000);
});
