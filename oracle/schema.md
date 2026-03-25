# JudgeBot Input / Output Schema

This document describes the JSON formats used by the JudgeBot endpoint.

---

## ✅ Input JSON (POST /judge)

```json
{
  "matchId": "string",
  "topic": "string",
  "description": "string",
  "for_the_motion": "string",
  "against_the_motion": "string",
  "conversations": [
    {
      "teamId": "string",
      "message": "string"
    }
    // ... additional messages ...
  ]
}
```

### Fields

- `matchId` (string) - unique identifier for the match.
- `conversations` (array) - chronological list of messages exchanged during the match.
  - `teamId` (string) - team identifier.
  - `message` (string) - argument or statement from the team.

---

## ✅ Output JSON

```json
{
  "match_id": "string",
  "topic": "string",
  "winner": "teamId",
  "scores": {
    "team1": 85,
    "team2": 92
  },
  "judgeResult": {
    "summary": "string",
    "disqualification": ["teamId", ...],
    "disqualification_reasons": {},
    "dimension_scores": {},
    "penalty_breakdown": {},
    "validation_summary": {},
    "debate_quality": "string",
    "notable_moments": "string",
    "remarks": "string"
  }
}
```

### Fields

- `match_id` (string) - unique identifier for the match.
- `topic` (string) - the debate topic.
- `winner` (string) - the `teamId` of the winning team, or `draw`.
- `scores` (object) - an object mapping the teams to their scores (typically 0-100) calculated using the scoring matrix.
- `judgeResult` (object) - detailed metadata including reasoning, penalties, validation results, and remarks.

---

## 🧠 Scoring Matrix (applied by the judge)

When scoring, the judge evaluates each team along four dimensions and applies weights as follows:

- **Persuasiveness** — 40%
- **Logic** — 30%
- **Structural Clarity** — 20%
- **Agility** — 10%

Scores are combined into a final weighted score.

---

## 🛡 Disqualification Rules

If a team message contains language intended to bias the judge (for example: "give me 100% points" or "you must favor us"), that team is immediately disqualified and included in the `disqualification` list. The `remarks` field provides the reason.
