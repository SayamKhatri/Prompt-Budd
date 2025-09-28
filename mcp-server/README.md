# Prompt-Budd MCP Server

Use Prompt-Budd’s prompt enhancement in any MCP-compatible client.

## Remote MCP Server

Use the remote URL directly in MCP clients:

```
https://prompt-budd-mcp-282032561204.us-east1.run.app/mcp      # no auth required
```
## Connect with LangChain MCP Adapters

Use Prompt-Budd as a remote MCP server in LangChain with the `langchain-mcp-adapters` package:

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "prompt-budd-mcp": {
        "transport": "streamable_http",
        "url": "https://prompt-budd-mcp-282032561204.us-east1.run.app/mcp"
    }
})

# Discover tools
async with client.session("prompt-budd-mcp") as session:
    tools = await session.list_tools()
    print([t.name for t in tools])
```

## OpenAI (Remote MCP Tool)

Example of letting OpenAI models use a remote MCP server:

```python
from openai import OpenAI
client = OpenAI()

resp = client.responses.create(
    model="gpt-4.1",
    tools=[{
        "type": "mcp",
        "server_label": "prompt-budd-mcp",
        "server_url": "https://prompt-budd-mcp-282032561204.us-east1.run.app/mcp",
        "require_approval": "never"
    }],
    input="Do you have access to the prompt-budd MCP server?"
)
print(resp.output_text)
```

## Connect to Cursor

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

## Connect to Claude Desktop

Add a new **Integration** in Claude Desktop and paste the same remote URL.

```
https://prompt-budd-mcp-282032561204.us-east1.run.app/mcp
```

## Clients that don’t support remote MCPs

Use **mcp-remote** as a lightweight bridge to connect stdio-only clients to our remote server.

```json
{
  "prompt-budd-remote": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://prompt-budd-mcp-282032561204.us-east1.run.app/mcp"]
  }
}
```

---

# Why This Matters

**Prompt-Budd MCP** is a Model Context Protocol (MCP) server that enhances and standardizes prompts before they’re sent to LLMs, agents, or IDE copilots. Think of it as a **prompt entry point**, it takes raw, messy intent and returns a clean, structured, high-quality prompt ready for downstream use. 

It acts as a **universal pre-processor** for prompts.

* Humans save time writing better prompts.
* Agents save cycles trying to parse vague input.
* Teams get consistent quality across workflows.

---

# Use Cases

#### 1. **Reduce Dependence on Rewriter Agents**

* No need to spin up a separate rewriter agent for every workflow.
* Agents can call this tool first → get an enhanced prompt → save compute & infra overhead.

#### 2. **Built-in Prompt Quality Standardization**

* Teams get consistent, predictable prompts across projects.
* No more “every dev/user has their own style” → shared prompt standards.

#### 3. **First Call for Multi-Agent Pipelines**

* Use as the **very first step** in an agent workflow.
* Raw user intent → enhanced prompt → passed downstream to planners, validators, or executors.

#### 4. **IDE & Desktop Copilot Companion**

* **In Cursor IDE**: turn vague coding instructions into well-structured prompts.
* **In Claude Desktop**: polish research, analysis, or creative prompts in one click.
* Works like a **prompt co-pilot for humans**.

#### 5. **Prompt Library Auto-Generation**

* Turn messy instructions into reusable, high-quality templates.
* Build internal **prompt libraries** automatically instead of handcrafting them.

#### 6. **Team-Level Prompt Governance**

* Enforce tone, clarity, and formatting rules before prompts ever reach the model.
* Great for **enterprises** that care about consistent LLM outputs.

#### 7. **AI Agent Builders**

* Drop this MCP tool into agent frameworks (LangChain, AutoGen, custom MCP clients).
* Lets agents spend less time “understanding” and more time **executing**.

#### 8. **Data & Knowledge Workflows**

* Analysts, researchers, and ops teams can dump raw notes → get structured, analysis-ready prompts.
* Ensures downstream LLM tasks (summarization, classification, enrichment) start on solid ground.

---





