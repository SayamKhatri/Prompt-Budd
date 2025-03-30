console.log("Extension injected...");

let debounceTimer;
let lastScoredPrompt = "";

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
    }, 700); // shorter debounce for better feel
  });

  observer.observe(box, {
    characterData: true,
    childList: true,
    subtree: true,
  });

  console.log("🔍 Mutation observer for real-time scoring active");
}

function createFloatingButton() {
  if (document.getElementById("smart-suggest-btn")) return;

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

          removeScoreTag(); // reset scoring
          scorePrompt(newPrompt);
        }
      })
      .catch((err) => {
        console.error("Error fetching prompt suggestion:", err);
      });
  });

  document.body.appendChild(btn);
  console.log("✅ Prompt Buddy button added");
}

window.addEventListener("load", () => {
  setTimeout(() => {
    const box = findActiveTextbox();
    if (box) {
      createFloatingButton();
      observeInputBox();
    } else {
      console.log("❌ No input box found.");
    }
  }, 3000);
});
