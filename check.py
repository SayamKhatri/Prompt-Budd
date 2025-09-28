from langchain_mcp_adapters.client import MultiServerMCPClient, load_mcp_tools
import asyncio

async def main():
    client = MultiServerMCPClient({
        "prompt-budd-mcp": {
            "transport": "streamable_http",
            "url": "https://prompt-budd-mcp-282032561204.us-east1.run.app/mcp"
        }
    })

    # Get tools from MCP servers
    tools = await client.get_tools()
    print("Loaded tools:", [t.name for t in tools])


asyncio.run(main())
