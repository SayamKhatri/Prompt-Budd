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
                "Goal: What do I want the AI to do?\n"
                "Return format: Should the answer be in text, table, code, etc.?\n"
                "Warning: Any ethical issues or caveats to consider?\n"
                "Context dump: Any additional assumptions, background, or information that could help the AI (optional)."
            )
        }
    ]

    max_retries = 3
    retry_delay = 0.5  
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                # model= "llama-3.1-8b-instant",
                model="llama-3.3-70b-specdec",   
                # model= 'deepseek-r1-distill-qwen-32b',
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
                return "Service currently unavailable. Please try again later."

