# Prompt-Budd MCP Server

Use Prompt-Budd’s prompt enhancement in any MCP-compatible client.

## Remote MCP Server

Use the remote URL directly in MCP clients (no local install required): 

```
https://YOUR-CLOUD-RUN-URL/mcp/            # no auth required

```

## Connect to Cursor

Add a remote MCP in Cursor via **command** using `mcp-remote`, pointing at your URL (pattern mirrors Tavily’s). 

```json
{
  "mcpServers": {
    "prompt-budd-remote": {
      "command": "npx -y mcp-remote https://YOUR-CLOUD-RUN-URL/mcp/?apiKey=<your-api-key>",
      "env": {}
    }
  }
}
```

## Connect to Claude Desktop

Add a new **Integration** in Claude Desktop and paste the same remote URL (with your key if used). 

```
https://YOUR-CLOUD-RUN-URL/mcp/?apiKey=<your-api-key>
```

## OpenAI (Remote MCP Tool)

Example of letting OpenAI models use a remote MCP server (pattern adapted from Tavily). 

```python
from openai import OpenAI
client = OpenAI()

resp = client.responses.create(
    model="gpt-4.1",
    tools=[{
        "type": "mcp",
        "server_label": "prompt-budd",
        "server_url": "https://YOUR-CLOUD-RUN-URL/mcp/?apiKey=<your-api-key>",
        "require_approval": "never"
    }],
    input="Do you have access to the prompt-budd MCP server?"
)
print(resp.output_text)
```

## Clients that don’t support remote MCPs

Use **mcp-remote** as a lightweight bridge to connect stdio-only clients to your remote server. 

```json
{
  "prompt-budd-remote": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://YOUR-CLOUD-RUN-URL/mcp/?apiKey=<your-api-key>"]
  }
}
```


