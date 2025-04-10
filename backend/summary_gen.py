# summary_gen.py
from groq import Groq
import os
from dotenv import load_dotenv
import time
import openai

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GROQ_API_KEY environment variable.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

# --- OpenAI Client Setup (for fallback) ---
_openai_initialized = False

def get_openai_client():
    global _openai_initialized
    if not _openai_initialized:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("Missing OPENAI_API_KEY environment variable.")
        openai.api_key = api_key
        _openai_initialized = True
    return openai


def fallback_generate_summary(prompt_text: str, messages: list) -> str:
    """
    Fall back to OpenAI's GPT-4o-mini for summary generation.
    """
    get_openai_client()  # Ensure OpenAI is initialized
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=150,
            temperature=0.7
        )
        if response['choices'] and response['choices'][0]['message']:
            return response['choices'][0]['message']['content'].strip()
        else:
            return ""
    except Exception as e:
        print(f"OpenAI fallback error in summary generation: {e}")
        return ""


def generate_summary(prompts: list[str]) -> str:
    """
    Generate a concise 1-2 sentence summary of the provided prompts.
    If the API call fails, return an empty string.
    """
    client = get_groq_client()

    prompt_text = "\n".join(prompts)

    messages = [
    {
        "role": "system",
        "content": (
            "You are an expert prompt summarizer. Your task is to review several user prompts that form a continuous chain of thought "
            "and generate a concise, objective summary in 1-2 sentences. This summary will help another LLM retain context. "
            "Do not add any interpretation or commentary beyond what is provided."
        )
    },
    {
        "role": "user",
        "content": (
            "Generate a concise 1-1.5 sentence summary that captures the key ideas and objectives of the following user prompts without altering their original goal.\n"
            "Format your response exactly as follows: 'The user was previously trying to [your summary].'\n"
            "Do not include any extra text or commentary.\n\n"
            f"User Prompts:\n{prompt_text}"
        )
    }
    ]   

    max_retries = 3
    retry_delay = 0.5  
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-specdec",
                messages=messages,
                temperature=0.7
            )
            if response.choices and response.choices[0].message:
                summary = response.choices[0].message.content.strip()
                return summary
            else:
                return ""
        except Exception as e:
            print(f"Groq API error in summary generation on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2  # exponential backoff
            else:
                print("Groq API unavailable after retries. Falling back to GPT-4o-mini...")
                return fallback_generate_summary(prompt_text, messages)
