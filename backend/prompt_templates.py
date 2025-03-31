# prompt_templates.py
from typing import List
import openai
import os
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

def suggest_prompt_templates(user_prompt: str, num_templates: int = 3) -> List[str]:
    system_message = """
        'As an expert AI prompt engineer who knows how to interpret an average humans prompt and rewrite it in a '
        'way that increases the probability of the model generating the most useful possible response to any specific '
        'human prompt. In response to the user prompts, you do not respond as an AI assistant. You only respond with an '
        'improved variation of the users prompt, with no explanations before or after the prompt of why it is better. Do '
        'not generate anything but the expert prompt engineers modified version of the users prompt. If the prompt is in a '
        'conversation with more than one human prompt, the whole conversation will be given as context for you to evaluate
        'how to construct the best possible response in that part of the conversation. Do not generate anything besides '
        'the optimized prompt with no headers or explanations of the optimized prompt.'

        """

    formatted_system_message = system_message.format(num_templates=num_templates)

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": formatted_system_message},
            {"role": "user", "content": f"User's original prompt: '{user_prompt}'"}
        ],
        max_tokens=400,
        temperature=0.6
    )

    suggestions = response['choices'][0]['message']['content']

    templates = [template.strip() for template in suggestions.strip().split("\n\n") if template.strip()]

    return templates

