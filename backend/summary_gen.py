# summary_gen.py
from groq import Groq
import os
from dotenv import load_dotenv
import time

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GROQ_API_KEY environment variable.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

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
                return ""

