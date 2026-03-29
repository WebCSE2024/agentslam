"""
agent.py
--------
Central LLM interface. Import `llm` from here to invoke Claude.
"""

# import os
# import anthropic
# from dotenv import load_dotenv

# load_dotenv()

# _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
# MODEL = "claude-opus-4-6"


# def llm(
#     prompt: str,
#     system: str = "",
#     max_tokens: int = 2048,
#     temperature: float = 0.2,
# ) -> str:
#     """
#     Invoke the LLM with a user prompt and optional system message.
#     Returns the text response as a string.
#     """
#     kwargs = {
#         "model": MODEL,
#         "max_tokens": max_tokens,
#         "temperature": temperature,
#         "messages": [{"role": "user", "content": prompt}],
#     }
#     if system:
#         kwargs["system"] = system

#     response = _client.messages.create(**kwargs)
#     return response.content[0].text.strip()




# ==========================================
# GROQ IMPLEMENTATION
# ==========================================

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
MODEL = "openai/gpt-oss-120b"

def llm(
    prompt: str,
    system: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.2,
) -> str:
    """
    Invoke the LLM with a user prompt and optional system message.
    Returns the text response as a string.
    TESTING MODEL
    """
    messages = []

    if system:
        messages.append({"role": "system", "content": system})

    messages.append({"role": "user", "content": prompt})

    response = _client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        max_completion_tokens=max_tokens,
        top_p=1,
    )

    return response.choices[0].message.content.strip()




# ==========================================
# GEMINI IMPLEMENTATION
# ==========================================

# import os
# from google import genai
# from google.genai import types
# from dotenv import load_dotenv

# load_dotenv()

# _client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
# MODEL = "gemini-2.5-flash"

# def llm(
#     prompt: str,
#     system: str = "",
#     max_tokens: int = 4096,
#     temperature: float = 0.2,
# ) -> str:
#     """
#     Invoke the Gemini LLM with a user prompt and optional system message.
#     Returns the text response as a string.
#     """
#     response = _client.models.generate_content(
#         model=MODEL,
#         contents=prompt,
#         config=types.GenerateContentConfig(
#             system_instruction=system if system else None,
#             temperature=temperature,
#             max_output_tokens=max_tokens,
#         )
#     )

#     return response.text.strip()