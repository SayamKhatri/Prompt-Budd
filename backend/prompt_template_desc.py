from groq import Groq
import os
import openai
from dotenv import load_dotenv
import time

load_dotenv()
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GROQ_API_KEY environment variable.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

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

def fallback_enhance_prompt(prompt: str, summary: str = "") -> str:
    """
    Fall back to OpenAI's GPT-4o-mini for prompt enhancement.
    """
    get_openai_client()  


    messages = [
        {
            "role": "system",

            "content": (
                "You are an expert in prompt engineering. Your task is to transform a vague or simple user prompt into a structured format that specifies "
                "the objective, desired output format, and any ethical caveats. If the prompt is harmful or unethical, respond only with: 'I cannot optimize it.' "
                "Return only the structured format without any additional commentary. \n\n"
                "You will also receive a brief summary of the user's previous prompts intended for context continuity. However, your primary focus (at least 90%) "
                "must remain solely on the current prompt. If the historical summary is unrelated, ignore it completely. Only if there is meaningful continuity should you"
                "incorporate elements of the summary into the enhanced output."
            )
        },


        {
            "role": "user",
            "content": (
                f"Basic prompt: \"{prompt}\"\n\n"
                f"History summary of past 5 prompts: {summary}\n\n"
                "Please convert it into the following structured format in first-person language:\n"
                "Goal: What do I want the AI to do?\n"
                "Return format: Should the answer be in text, table, code, etc.?\n"
                "Warning: Any ethical issues or caveats to consider?\n"
                "Context dump: Any additional assumptions, background, or information that could help the AI (optional)."
            )
        }
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=800,
            temperature=0.7
        )

        if response['choices'] and response['choices'][0]['message']:
            return response['choices'][0]['message']['content'].strip()
        else:
            return "Unexpected response format from OpenAI fallback."
    except Exception as e:
        print(f"OpenAI fallback error: {e}")
        return "Service currently unavailable. Please try again later."

def enhance_prompt_with_groq(prompt: str, summary: str = ""):
    client = get_groq_client()
    messages = [
        {
            "role": "system",

            "content": (
                "You are an expert in prompt engineering. Your task is to transform a vague or simple user prompt into a structured format that specifies "
                "the objective, desired output format, and any ethical caveats. If the prompt is harmful or unethical, respond only with: 'I cannot optimize it.' "
                "Return only the structured format without any additional commentary. \n\n"
                "You will also receive a brief summary of the user's previous prompts intended for context continuity. However, your primary focus (at least 90%) "
                "must remain solely on the current prompt. If the historical summary is unrelated, ignore it completely. Only if there is meaningful continuity should you"
                "incorporate elements of the summary into the enhanced output."
            )
        },


        {
            "role": "user",
            "content": (
                f"Basic prompt: \"{prompt}\"\n\n"
                f"History summary of past 5 prompts: {summary}\n\n"
                "Please convert it into the following structured format in first-person language:\n"
                "Goal: What do I want the AI to do?\n\n"
                "Return format: Should the answer be in text, table, code, etc.?\n\n"
                "Warning: Any ethical issues or caveats to consider?\n\n"
                "Context dump: Any additional assumptions, background, or information that could help the AI (optional)."
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
                return response.choices[0].message.content
            else:
                return "Unexpected response format from Groq."
        except Exception as e:
            print(f"Groq API error on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2  
            else:
                # Fallback to the OpenAI model.
                print("Groq API unavailable after retries. Falling back to GPT-4o-mini...")
                return fallback_enhance_prompt(prompt, summary)

