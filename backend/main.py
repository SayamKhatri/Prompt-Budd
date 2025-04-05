from fastapi import FastAPI
from prompt_templates_short import suggest_prompt_templates
from prompt_score import rate_prompt_quality
from prompt_classifier import classify_llm_for_prompts  
from prompt_template_desc import enhance_prompt_with_groq
from detect_pii import contains_pii
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str

class PromptListRequest(BaseModel):  
    prompts: List[str]

class PiiRequest(BaseModel):           
    text: str

@app.post("/suggest-templates")
async def suggest_templates(request: PromptRequest):
    suggestions = suggest_prompt_templates(request.prompt)
    return {"templates": suggestions}

@app.post("/prompt-score")
async def get_prompt_score(request: PromptRequest):
    score = rate_prompt_quality(request.prompt)
    return {"score": score}

@app.post("/prompt_classifier") 
async def suggest_llm_model(request: PromptListRequest):
    result = classify_llm_for_prompts(request.prompts)
    return result

@app.post("/detect-pii")              
async def detect_pii_route(request: PiiRequest):
    found = contains_pii(request.text)
    return {"pii": found}

@app.post("/suggest-templates-descriptive")
async def suggest_templates(request: PromptRequest):
    suggestions = enhance_prompt_with_groq(request.prompt)
    return {"templates": suggestions}
