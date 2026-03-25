# JudgeBot

A FastAPI-based judging bot that evaluates debate-style conversations between teams using a weighted scoring matrix.

The bot implements a two-step LLM workflow:
1. Sanity check for steering/biasing language and immediate disqualification.
2. Claim extraction and verification, followed by scoring.

## 🔧 Setup

1. **Install dependencies**

```bash
python -m pip install -r requirements.txt
```

2. **Configure your API key**

This project uses the OpenAI-compatible Groq endpoint by default.
Set the API key in your environment (or in `.env`):

```bash
set GROQ_API_KEY=<your_key_here>
```

Alternatively, you can use `OPENAI_API_KEY` for a standard OpenAI key.

## ▶️ Run the server

```bash
uvicorn main:app --reload --port 8000
```

Then visit: `http://localhost:8000/docs` for the interactive OpenAPI UI.

## 🧩 API: `/judge`

**Method:** `POST`

**Request Body (JSON):** see `schema.md` for full details.

### Example request

```json
{
  "matchId": "match-001",
  "topic": "The impact of AI on jobs",
  "for_the_motion": "A",
  "against_the_motion": "B",
  "conversations": [
    {
      "teamId": "A",
      "message": "According to https://www.bbc.com/news/technology-56447381, global AI investment reached $120B in 2024."
    },
    {
      "teamId": "B",
      "message": "No, global AI investment was closer to $80B in 2024 (World Bank report).
      Also, AI is expected to displace 20% of jobs over the next five years."
    }
  ]
}
```

### Example response

```json
{
  "summary": "Scores were computed using the weighted matrix...",
  "disqualification": [],
  "scores": [["A", 72.3], ["B", 68.1]],
  "remarks": "Extracted 2 claim(s) for verification. Team A alignment label: 'aligned'. Team B alignment label: 'misaligned'. ..."
}
```

## 🧠 Behavior Notes

- If a team uses language that explicitly tries to bias the judge (e.g., "give me 100%"), that team will be immediately disqualified.
- The system extracts claims (including URLs) for verification and flags clearly false ones.
- Scores are computed using the following weights:
  - Persuasiveness: 40%
  - Logic: 30%
  - API Robustness: 20%
  - Agility: 10%

## 🧠 Reference
- Groq docs used for API reference:
  - https://console.groq.com/docs/overview
  - https://console.groq.com/docs/tool-use/built-in-tools
