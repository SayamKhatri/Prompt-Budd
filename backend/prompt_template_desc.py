from groq import Groq
import os
from dotenv import load_dotenv

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GROQ_API_KEY environment variable.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client


def enhance_prompt_with_groq(prompt: str):
    client = get_groq_client()
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert in prompt engineering. "
                "Your job is to take a vague or simple user prompt and convert it into a structured format. "
                "If the prompt is harmful or unethical, respond with: 'I cannot optimize it.' "
                "Do not return anything other than the structure given."
            )
        },
        {
            "role": "user",
            "content": (
                f"Basic prompt: \"{prompt}\"\n\n"
                "Please convert it into the following structure in first-person language:\n"
                "1. Goal: What do I want the AI to do?\n"
                "2. Return format: Should the answer be in text, table, code, etc.?\n"
                "3. Warning: Any ethical issues or caveats to consider?\n"
                "4. Context dump: Assumptions, background, or extra info that could help the AI."
            )
        }
    ]

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",  
        messages=messages,
        temperature=0.7
    )

    return response.choices[0].message.content


