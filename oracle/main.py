"""
main.py
-------
FastAPI backend for JudgeBot.
POST /judge  →  accepts debate payload, returns judging result.
"""
 
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
import traceback
 
from judge import run_judge

app = FastAPI(
    title="JudgeBot — Debate Oracle",
    description="An agentic debate judging system with claim verification.",
    version="1.0.0",
)
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
 
 
# ──────────────────────────────────────────────
# REQUEST SCHEMA
# ──────────────────────────────────────────────
 
class ConversationEntry(BaseModel):
    teamId: str
    message: str
    timestamp: str = None
 
class DebateRequest(BaseModel):
    matchId: str = Field(..., example="match-001")
    topic: str = Field(..., example="The impact of AI on jobs")
    description: str = Field(default="", example="Brief background on the topic.")
    for_the_motion: str = Field(..., example="A")
    against_the_motion: str = Field(..., example="B")
    conversations: List[ConversationEntry]
 
 
# ──────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────
 
@app.post("/judge")
def judge_debate(request: DebateRequest):
    """
    Main judging endpoint. Accepts a structured debate and returns:
    - Winner, scores, penalties, claim validation details, and judge remarks.
    """
    try:
        payload = request.model_dump()
        result = run_judge(payload)
        print(result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Judging pipeline error: {str(e)}\n{traceback.format_exc()}")
 
 
@app.get("/health")
async def health():
    return {"status": "ok", "service": "JudgeBot"}
 
 
# ──────────────────────────────────────────────
# RUN
# ──────────────────────────────────────────────
 
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_config="log_config.json")
 