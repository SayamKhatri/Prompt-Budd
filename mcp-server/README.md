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

