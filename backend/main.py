from prompt_templates import suggest_prompt_templates
from fastapi import FastAPI
from prompt_templates import suggest_prompt_templates
from pydantic import BaseModel

app = FastAPI()

class PromptRequest(BaseModel):
    prompt: str

@app.post("/suggest-templates")
async def suggest_templates(request: PromptRequest):
    suggestions = suggest_prompt_templates(request.prompt)
    return {"templates": suggestions}
