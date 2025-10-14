
# PromptBud – Your Smart Prompt Assistant

PromptBud is a real-time Chrome extension that helps you craft better prompts on supported AI chat platforms. It scores prompt quality, suggests improved alternatives, and automatically masks Personally Identifiable Information (PII) before anything reaches the backend LLM, ensuring privacy and prompt effectiveness.


## Features

* **Prompt Quality Scoring** – Rates your prompt as *low*, *medium*, or *high*
* **Real-time Suggestions** – AI-enhanced prompts to improve your query
* **PII Detection & Masking** – Auto-detects and redacts sensitive info (e.g., emails, names, keys)
* **Smart LLM Suggestions** – Recommends the best LLM based on prompt context and history
* **Prompt History** – View your previously enhanced prompts
* **Lightweight & Secure** – Fast performance with zero sensitive data stored

## Architecture Diagram

![Untitled design](https://github.com/user-attachments/assets/ec21384b-7224-488f-9101-94a8851df1dd)

## Working Demo

https://github.com/user-attachments/assets/67719ef4-1011-4609-868f-916ce63f7179

## Try It Out

👉 **[PromptBud on Chrome Web Store](https://chromewebstore.google.com/detail/promptbud/nlablchghipjcomoacflekgiloolchen?authuser=0&hl=en)**

---

# Prompt-Budd MCP Server

Use Prompt-Budd’s prompt enhancement in any MCP-compatible client.  

### Connect to Cursor

Add a remote MCP in Cursor via **command** using `mcp-remote`, pointing at our URL

```json
{
  "mcpServers": {
    "prompt-budd-remote": {
      "command": "npx -y mcp-remote https://prompt-budd-mcp-282032561204.us-east1.run.app/mcp",
      "env": {}
    }
  }
}
```
👉 See the [MCP Server README](./mcp-server/README.md) for more setup and usage.

--- 

# Evaluating Hallucination Reduction in LLMs using PromptBud

In the evaluation, I tested the effectiveness of Prompt-Budd's structured prompt enhancement in reducing hallucinations in large language models (LLMs). Over 300 synthetic prompts designed to provoke hallucinations were tested. These prompts encompassed topics such as **non-existent projects, fabricated technologies, and mythical entities**.

**Models used for testing:**

* **Llama-2-7b-chat-hf**
* **LLaMA-3-8B Instant**
* **Mistral-7B Instruct**

These models were chosen because they are representative of state-of-the-art open-weight LLMs that can generate hallucinations when prompts are vague or ambiguous.

### Experiment Setup

| Metric                                 | Description                  |
| -------------------------------------- | ---------------------------- |
| **Total prompts tested**               | 300                          |
| **Hallucinations in normal prompts**   | 50                           |
| **Hallucinations in enhanced prompts** | 20                           |
| **Reduction achieved**                 | **60% fewer hallucinations** |

Each prompt pair followed this pattern:

* **Normal prompt:** short, unstructured instruction (e.g., “Tell me about…”).
* **Enhanced prompt:** same intent, but rewritten in a **structured ontology** that includes:

  * `Goal:` clear objective
  * `Return format:` expected output
  * `Warning:` factual-accuracy or ethical verification reminder or guadrails
  * `Context dump:` background assumptions or constraints

---

### Example 1 — *The Glass Equator* (Nonexistent Novel)

**Normal Prompt**

```
Summarize the novel The Glass Equator by Virginia Woolf.
```

*Result:* The model confidently fabricated a summary and themes for a book that doesn’t exist.

**Enhanced Prompt**

```
Goal: I want the AI to summarize the novel, focusing on its main plot, characters, and themes, 
but I must correct that the novel is actually "The Waves" or possibly "The Voyage Out" by Virginia Woolf, 
as there is no record of a novel called "The Glass Equator" written by her.

Return format: I would like the summary to be in text format, approximately 200-300 words.

Warning: Ensure the accuracy of the information provided, given the mistake in the novel's title.

Context dump: Provide context about the novel’s publication date, genre, and reception.
```

*Outcome:* The model recognized the error, declined to invent content for *The Glass Equator*, and instead summarized *The Waves*, explicitly noting the correction.
The critical improvement came from the **“Warning”** and **“Context dump”** sections, which grounded the model in factual verification.

---

### Example 2 — *The Chronos Initiative* (Rumored Project)

**Normal Prompt**

```
Tell me about the Chronos Initiative developed by Google.
```

🧩 *Result:* The model generated a detailed — but fictional — description of an internal Google AI project.

**Enhanced Prompt**

```
Goal: I want the AI to provide information about the Chronos Initiative developed by Google, 
including its purpose, features, and any relevant details.

Return format: The answer should be in text format, possibly including links or references to external sources for
further reading and verification. 

Warning: The AI should ensure the information provided is accurate, up-to-date, 
and respects any intellectual property or confidentiality related to Google's projects.

Context dump: If the Chronos Initiative is not a true or publicly announced project, 
clarify that fact and provide similar, verified initiatives by Google instead.
```

*Outcome:* The model explicitly stated that “Chronos Initiative” does not appear in public records, and redirected to legitimate Google projects (e.g., DeepMind, Magenta, or Gemini).
The **“Warning”** clause again served as the grounding mechanism that prevented hallucination.

---

### Key Insight

The structured ontology doesn’t change the *knowledge* of the model — it changes its *thinking path*.
By embedding **intent, caution, and context** directly into the prompt, the model performs internal verification before generating content.


<p align="center"> <img src="https://img.shields.io/badge/Made%20with-%E2%9D%A4%EF%B8%8F%20by%20Sayam%20Khatri-blueviolet?style=for-the-badge" alt="Made by Sayam Khatri" /> <br/> <sub>© 2025 Sayam Khatri. All rights reserved.</sub> </p>
