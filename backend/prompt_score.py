from google import genai
import os
from detect_pii import mask_pii
import time
import openai


_gemini_client = None
_openai_initialized = False

def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY environment variable.")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client

def get_openai_client():
    global _openai_initialized
    if not _openai_initialized:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("Missing OPENAI_API_KEY environment variable.")
        openai.api_key = api_key
        _openai_initialized = True
    return openai

def build_scoring_prompt(safe_prompt: str) -> str:
    """
    Build the scoring prompt text for both Gemini and OpenAI calls.
    """
    return (
        "You are an expert AI prompt evaluator. Your task is to assess the quality of a given prompt based on the following criteria:\n"
        "1. Clarity: Is the prompt clear, structured, unambiguous, and easy to understand?\n"
        "2. Specificity: Does the prompt include sufficient details and precise instructions?\n"
        "3. Usefulness: Would the prompt likely lead to a high-quality, relevant response from LLM's?\n"
        "4. Creativity: Does the prompt encourage innovative and thoughtful answers? (Remember, even concise prompts can be high quality if they are well-crafted.)\n\n"
        "Important: Please ignore any occurrence of 'XXXX' in the prompt. These placeholders represent redacted sensitive information and should not be considered when judging the prompt's clarity, detail, usefulness, or creativity.\n\n"
        "After evaluating the prompt on these dimensions, assign it a rating of 'low', 'medium', or 'high'. Be a little strict. "
        "Respond with only one word, without any additional commentary.\n\n"
        f"Prompt: {safe_prompt}"
    )

def fallback_rate_prompt_quality(prompt: str, safe_prompt: str) -> dict:
    """
    Fall back to OpenAI's GPT-4o-mini for prompt quality evaluation.
    """
    # Ensure OpenAI client is initialized
    get_openai_client()
    scoring_prompt = build_scoring_prompt(safe_prompt)
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": scoring_prompt}],
            max_tokens=100,
            temperature=0.7
        )
        score = response['choices'][0]['message']['content'].strip().lower()
        if score not in {"low", "medium", "high"}:
            score = "unknown"
        return {"score": score, "masked_prompt": safe_prompt}
    except Exception as e:
        print(f"OpenAI fallback error in rate_prompt_quality: {e}")
        return {"score": "unknown", "masked_prompt": safe_prompt}

def rate_prompt_quality(prompt: str) -> dict:
    """
    Evaluate the prompt's quality using Gemini. If Gemini fails after retries, fallback to OpenAI GPT-4o-mini.
    """
    client = get_gemini_client()
    # Mask any PII from the input prompt.
    safe_prompt = mask_pii(prompt)
    scoring_prompt = build_scoring_prompt(safe_prompt)
    
    max_retries = 2
    retry_delay = 0.3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=scoring_prompt
            )
            score = response.text.strip().lower()
            if score not in {"low", "medium", "high"}:
                score = "unknown"
            return {"score": score, "masked_prompt": safe_prompt}
        except Exception as e:
            print(f"Error from Gemini on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print("Gemini API unavailable after retries. Falling back to GPT-4o-mini...")
                return fallback_rate_prompt_quality(prompt, safe_prompt)