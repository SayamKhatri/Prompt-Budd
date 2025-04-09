from google import genai
from dotenv import load_dotenv
import os
from detect_pii import mask_pii
load_dotenv()

api_key = os.environ["GEMINI_API_KEY"]
client = genai.Client(api_key=api_key)


def rate_prompt_quality(prompt: str) -> dict:

    # Mask any PII from the input prompt.
    safe_prompt = mask_pii(prompt)

    scoring_prompt = (
        "You are an expert AI prompt evaluator. Your task is to assess the quality of a given prompt based on the following criteria:\n"
        "1. Clarity: Is the prompt clear, unambiguous, and easy to understand?\n"
        "2. Specificity: Does the prompt include sufficient details and precise instructions?\n"
        "3. Usefulness: Would the prompt likely lead to a high-quality, relevant response from LLM's?\n"
        "4. Creativity: Does the prompt encourage innovative and thoughtful answers? (Remember, even concise prompts can be high quality if they are well-crafted.)\n\n"
        "Important: Please ignore any occurrence of 'XXXX' in the prompt. These placeholders represent redacted sensitive information and should not be considered when judging the prompt's clarity, detail, usefulness, or creativity.\n\n"
        "After evaluating the prompt on these dimensions, assign it a rating of 'low', 'medium', or 'high'. "
        "Respond with only one word, without any additional commentary.\n\n"
        f"Prompt: {safe_prompt}"
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=scoring_prompt
        )
        score = response.text.strip().lower()
        if score not in {"low", "medium", "high"}:
            score = "unknown"
    except Exception as e:
        print("Error from Gemini:", e)
        score = "unknown"

    return {"score": score, "masked_prompt": safe_prompt}
