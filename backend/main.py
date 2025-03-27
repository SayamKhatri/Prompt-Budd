from prompt_templates import suggest_prompt_templates
from fastapi import FastAPI
from prompt_templates import suggest_prompt_templates
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or set to ["http://localhost:3000"] if you want to limit
    allow_credentials=True,
    allow_methods=["*"],  # ✅ allow OPTIONS, POST, GET, etc.
    allow_headers=["*"],  # ✅ allow all headers including Content-Type
)
class PromptRequest(BaseModel):
    prompt: str

@app.post("/suggest-templates")
async def suggest_templates(request: PromptRequest):
    suggestions = suggest_prompt_templates(request.prompt)
    return {"templates": suggestions}
