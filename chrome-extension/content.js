console.log("Extension injected... using #prompt-textarea for ChatGPT");

function findActiveTextbox() {
  const box = document.querySelector("#prompt-textarea.ProseMirror");
  if (box && box.offsetParent !== null && box.isContentEditable) {
    console.log("Found ChatGPT input box by ID and class");
    return box;
  }
  return null;
}

function createFloatingButton() {
  if (document.getElementById("smart-suggest-btn")) {
    console.log("Button already exists");
    return;
  }

  const btn = document.createElement("button");
  btn.innerText = "✨ Suggest Prompt";
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
      alert("Couldn't find textbox. Try typing something first.");
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
          inputBox.innerText = "";
          document.execCommand("insertText", false, suggestions[0]);
        } else {
          alert("⚠️ No suggestions found.");
        }
      })
      .catch((err) => {
        alert("Error contacting backend.");
        console.error(err);
      });
  });

  document.body.appendChild(btn);
  console.log("Floating button added");
}

window.addEventListener("load", () => {
  setTimeout(() => {
    const box = findActiveTextbox();
    if (box) {
      createFloatingButton();
    } else {
      console.log("No input box found (fallback)");
    }
  }, 3000);
});
