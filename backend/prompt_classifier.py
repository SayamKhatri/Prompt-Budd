# prompt_classifier.py

from typing import List, Dict
import openai
import os
import json
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

def classify_llm_for_prompts(prompts: List[str]) -> Dict[str, str]:
    """
    Analyze list of recent prompts and return suggested LLM with reason.
    """

    system_message = """
        You are an intelligent classifier agent that helps users choose the best large language model (LLM) based on their recent prompt behavior.

        Here are known LLM strengths:

        - ChatGPT (OpenAI): Excellent for coding, logic, reasoning, and structured explanations.
        - Claude (Anthropic): Great for creative writing, matching tone, empathetic or human-like responses.
        - Gemini (Google): Strong in advanced reasoning and complex, multimodal or multi-step tasks.
        - DeepSeek: Known for math-heavy and algorithmic prompts, especially cost-effective code reasoning.
        - Perplexity: Best for research-heavy prompts that benefit from web-search-like responses.
        - Grok (xAI): General-purpose model, especially good with social/contextual prompts and document processing.
        - Meta AI (LLaMA): Flexible open-source base model, decent at image prompts and general Q&A.

        Your task:
        1. Read the last 1 to 5 user prompts
        2. Infer the common theme (e.g. code-heavy, formal writing, creative, research, etc.)
        3. Based on that, suggest the best-fit LLM from the list above
        4. If prompts are mixed, still pick the closest match and explain why

        Return in **strict JSON** format, for example:
        {
        "suggested_llm": "Gemini",
        "reason": "Most recent prompts involve multi-step reasoning and analytical questions."
        }
        """

    joined_prompts = "\n".join([f"{i+1}. {p}" for i, p in enumerate(prompts)])

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": f"Recent user prompts:\n{joined_prompts}"}
            ],
            temperature=0.5,
            max_tokens=400
        )

        raw_output = response['choices'][0]['message']['content'].strip()

        try:
            parsed = json.loads(raw_output)
            return parsed
        except json.JSONDecodeError:
            return {
                "suggested_llm": "Unknown",
                "reason": "Could not parse LLM response properly."
            }

    except Exception as e:
        print("LLM classification error:", e)
        return {
            "suggested_llm": "Error",
            "reason": str(e)
        }


if __name__ == "__main__":
    recent_prompts = [
        "I have this python script, can you tell me the error",
        "It is still not working, how to make this better",
        "How to deploy this"
    ]
    
    result = classify_llm_for_prompts(recent_prompts)
    print(result)
