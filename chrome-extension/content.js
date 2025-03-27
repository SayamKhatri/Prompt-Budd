alert("✅ Your Chrome Extension is injecting correctly!");

console.log("✅ Extension running at: " + window.location.href);




// console.log("✅ content.js is running");

// function createFloatingButton() {
//   if (document.getElementById("suggest-prompt-floating")) return;

//   const btn = document.createElement("button");
//   btn.innerText = "✨ Suggest Prompt";
//   btn.id = "suggest-prompt-floating";
//   btn.style.position = "fixed";
//   btn.style.bottom = "20px";
//   btn.style.right = "20px";
//   btn.style.zIndex = "9999";
//   btn.style.padding = "10px 16px";
//   btn.style.borderRadius = "8px";
//   btn.style.border = "none";
//   btn.style.backgroundColor = "#10a37f";
//   btn.style.color = "white";
//   btn.style.fontWeight = "bold";
//   btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
//   btn.style.cursor = "pointer";

//   btn.addEventListener("click", () => {
//     const selection = window.getSelection().toString();
//     const prompt = selection || prompt("Type a prompt to improve:", "");

//     if (!prompt || !prompt.trim()) return;

//     fetch("http://localhost:8000/suggest-templates", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ prompt: prompt.trim() })
//     })
//       .then(res => res.json())
//       .then(data => {
//         const templates = data.templates;
//         alert("✨ Suggested Prompt Templates:\n\n" + templates.join("\n\n"));
//       })
//       .catch(err => {
//         alert("❌ Backend error. Is FastAPI running?");
//         console.error(err);
//       });
//   });

//   document.body.appendChild(btn);
// }

// window.addEventListener("load", () => {
//   console.log("✅ Page loaded");
//   setTimeout(createFloatingButton, 3000); // wait for page render
// });
