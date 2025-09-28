from mcp.server.fastmcp import FastMCP
from backend.prompt_template_desc import enhance_prompt_with_groq
from backend.prompt_templates_short import suggest_prompt_templates
from dotenv import load_dotenv
load_dotenv() 

mcp = FastMCP('prompt-budd-mcp',host='0.0.0.0', port=8000)

@mcp.tool()
def prompt_enhance(prompt: str):
    """ 
    Generate a short, optimized prompt template.

    Args:
        prompt (str): Raw input prompt.

    Returns:
        dict with key "templates": list[str]  
        
    """
    try:
        templates = suggest_prompt_templates(prompt)
        if isinstance(templates, str):
            templates = [templates]
        return {"templates": templates}
    
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
def prompt_enhance_descriptive(prompt: str):
    """
    Generate a descriptive, structured prompt template.

    Args:
        prompt (str): Raw input prompt.

    Returns:
        dict with one key:
          - "templates" (str): A descriptive template string 
    """
    try:
        templates = enhance_prompt_with_groq(prompt, summary='')
        if isinstance(templates, str):
            templates = [templates]
        return {"templates": templates}

    except Exception as e:
        return {"error": str(e)}

if __name__ == '__main__':
    mcp.run(transport='streamable-http')