"""
judge.py
--------
The central orchestrator — the "Oracle" judging agent.
 
Pipeline:
  1. Validate all messages (injection + claim extraction + claim verification).
  2. Determine disqualifications.
  3. Score the debate (LLM-based).
  4. Apply penalties.
  5. Compose final output JSON.
"""
 
import json
import re
import random
from agent import llm
from validators import validate_message
from scorer import compute_penalties, score_debate, compute_final_scores
 
# ──────────────────────────────────────────────
# DISQUALIFICATION LOGIC
# ──────────────────────────────────────────────
 
DISQ_THRESHOLD_CONTRADICTED = 4    # 4+ contradicted claims → disqualify
 
DISQ_SUMMARY_SYSTEM = """
You are a strict debate judge reviewing disqualification candidates.
You will be given a team's validation report.
Based on the severity and pattern of violations, decide if disqualification is warranted.
 
Consider:
  - Were factual errors clearly deliberate (contradicted claims)?
  - Was there any prompt injection attempt?
 
Respond ONLY with a JSON object:
{
  "disqualify": true | false,
  "reason": "1 sentence justification"
}
No markdown, no extra text.
"""
 
 
def _should_disqualify(team_id: str, validation_results: list[dict], penalties: dict) -> tuple[bool, str]:
    """
    Determines if a team should be disqualified.
    First applies rule-based thresholds, then defers to LLM for edge cases.
    """
    # Aggregate stats for this team
    total_contradicted = sum(v["contradicted_count"] for v in validation_results if v["team_id"] == team_id)
    any_injection = any(
        v["injection_check"].get("injection_detected", False)
        for v in validation_results
        if v["team_id"] == team_id
    )
 
    # Hard rules
    if any_injection:
        return True, "Prompt injection or manipulation attempt detected in team's messages."
 
    if total_contradicted >= DISQ_THRESHOLD_CONTRADICTED:
        return True, (
            f"Team made {total_contradicted} contradicted claim(s) — "
            "evidence of deliberate misinformation."
        )
 
    # Soft rule: ask LLM for ambiguous cases (2+ contradicted)
    if total_contradicted >= 2:
        team_vals = [v for v in validation_results if v["team_id"] == team_id]
        report = {
            "team_id": team_id,
            "total_contradicted": total_contradicted,
            "details": [
                {
                    "claim": c["claim"],
                    "verdict": c["validation"].get("verdict"),
                    "url_provided": c["url"] is not None,
                }
                for v in team_vals for c in v["claims"]
            ],
        }
        prompt = f"Team validation report:\n{json.dumps(report, indent=2)}"
        raw = llm(prompt, system=DISQ_SUMMARY_SYSTEM, max_tokens=300)
        try:
            clean = re.sub(r"```json|```", "", raw).strip()
            result = json.loads(clean)
            return result.get("disqualify", False), result.get("reason", "")
        except Exception:
            pass
 
    return False, ""
 
 
# ──────────────────────────────────────────────
# REMARKS GENERATION
# ──────────────────────────────────────────────
 
REMARKS_SYSTEM = """
You are a debate judge writing post-match remarks.
You will be given the full debate context, scores, and claim validation results.
 
Write remarks covering:
  1. Who won and why (the upper hand they had).
  2. Key strengths per team.
  3. Areas of improvement for each team.
  4. Overall debate quality.
 
Keep it analytical, fair, and professional. 1-2 sentences total.
Respond with plain text only (no JSON, no markdown headers).
"""
 
 
def _generate_remarks(
    topic: str,
    description: str,
    for_team: str,
    against_team: str,
    conversations: list[dict],
    final_scores: dict,
    llm_score_data: dict,
    disqualified: list[str],
) -> str:
    transcript = "\n".join(
        f"[Team {c['teamId']}]: {c['message']}"
        for c in conversations
    )
    score_text = json.dumps(final_scores)
    reasoning = {
        tid: llm_score_data.get("team_scores", {}).get(tid, {}).get("reasoning", "")
        for tid in [for_team, against_team]
    }
    notable = llm_score_data.get("notable_moments", "")
 
    prompt = (
        f"Topic: {topic}\n"
        f"Topic Background: {description}\n"
        f"FOR: {for_team} | AGAINST: {against_team}\n"
        f"Disqualified teams: {disqualified}\n"
        f"Final scores: {score_text}\n"
        f"LLM reasoning per team: {json.dumps(reasoning)}\n"
        f"Notable moments: {notable}\n\n"
        f"Transcript:\n{transcript}"
    )
    return llm(prompt, system=REMARKS_SYSTEM, max_tokens=600)
 
 
# ──────────────────────────────────────────────
# SUMMARY GENERATION
# ──────────────────────────────────────────────
 
def _build_validation_summary(validation_results: list[dict]) -> dict:
    """Builds a human-readable validation summary per team."""
    summary = {}
    for v in validation_results:
        tid = v["team_id"]
        if tid not in summary:
            summary[tid] = {
                "total_claims": 0,
                "supported_with_url": 0,
                "supported_no_url": 0,
                "contradicted": 0,
                "insufficient": 0,
                "injection_detected": False,
                "claim_details": [],
            }
        s = summary[tid]
        s["total_claims"] += v["total_claims"]
        s["supported_with_url"] += v.get("supported_with_url_count", 0)
        s["supported_no_url"] += v.get("supported_no_url_count", 0)
        s["contradicted"] += v["contradicted_count"]
        s["insufficient"] += v["insufficient_count"]
        if v["injection_check"].get("injection_detected"):
            s["injection_detected"] = True
 
        for c in v["claims"]:
            s["claim_details"].append({
                "claim": c["claim"],
                "url_provided": c["url"] is not None,
                "verdict": c["validation"].get("verdict"),
                "confidence": c["validation"].get("confidence"),
                "explanation": c["validation"].get("explanation"),
                "penalized": c["penalty_flag"],
            })
 
    return summary
 
 
# ──────────────────────────────────────────────
# MAIN ORCHESTRATOR
# ──────────────────────────────────────────────
 
def run_judge(payload: dict) -> dict:
    """
    Full agentic judging pipeline.
 
    Args:
        payload: The decoded request JSON.
 
    Returns:
        Final output JSON dict.
    """
    match_id = payload["matchId"]
    topic = payload["topic"]
    description = payload.get("description", "")
    for_team = payload["for_the_motion"]
    against_team = payload["against_the_motion"]
    conversations = payload["conversations"]
 
    team_ids = list({c["teamId"] for c in conversations})
 
    # ── STEP 1: Validate all messages ────────────────────────────────────
    validation_results = []
    for convo in conversations:
        result = validate_message(convo["teamId"], convo["message"])
        validation_results.append(result)
 
    # ── STEP 2: Compute penalties ─────────────────────────────────────────
    penalties = compute_penalties(validation_results)
 
    # ── STEP 3: Check disqualifications ───────────────────────────────────
    disqualified = []
    disqualification_reasons = {}
    for tid in team_ids:
        disq, reason = _should_disqualify(tid, validation_results, penalties)
        if disq:
            disqualified.append(tid)
            disqualification_reasons[tid] = reason
 
    # ── STEP 4: Score (even disqualified teams get scored for transparency) ─
    llm_score_data = score_debate(
        topic=topic,
        description=description,
        for_team=for_team,
        against_team=against_team,
        conversations=conversations,
        validation_results=validation_results,
    )
 
    # ── STEP 5: Apply penalties to scores ─────────────────────────────────
    final_scores = compute_final_scores(llm_score_data, penalties, team_ids)
 
    # Override disqualified teams to 0 (severe violation), and assure valid bounds > 50
    for tid in team_ids:
        if tid in disqualified:
            final_scores[tid] = 0
        else:
            final_scores[tid] = max(51, final_scores.get(tid, 51))
 
    # ── STEP 6: Determine winner ───────────────────────────────────────────
    def _get_tiebreaker(t):
        p = penalties.get(t, {}).get("total_penalty", 1000)
        s = llm_score_data.get("team_scores", {}).get(t, {}).get("raw_score", 50)
        # Criteria hierarchy: 1. Final Score  2. Lowest penalty (least egregious)  3. Base LLM Score
        return (final_scores.get(t, 0), -p, s)
 
    winner = max(team_ids, key=_get_tiebreaker) if team_ids else random.choice([for_team, against_team])

    # Situation 1: If both teams were disqualified, the tiebreaker winner gets 50, loser remains at 0
    active_teams = [t for t in team_ids if t not in disqualified]
    if len(active_teams) == 0 and team_ids:
        final_scores[winner] = 50
 
    # ── STEP 7: Generate remarks ───────────────────────────────────────────
    remarks = _generate_remarks(
        topic=topic,
        description=description,
        for_team=for_team,
        against_team=against_team,
        conversations=conversations,
        final_scores=final_scores,
        llm_score_data=llm_score_data,
        disqualified=disqualified,
    )
 
    # ── STEP 8: Build validation summary ──────────────────────────────────
    val_summary = _build_validation_summary(validation_results)
 
    # ── STEP 9: Compose output ─────────────────────────────────────────────
    # Server expects strict object for scores: {"team1": X, "team2": Y}
    scores_obj = {
        "team1": final_scores.get("team1", 50),
        "team2": final_scores.get("team2", 50)
    }
 
    # Penalty breakdown per team
    penalty_breakdown = {
        tid: {
            "contradicted_penalty": penalties.get(tid, {}).get("contradicted_penalty", 0),
            "total_penalty": penalties.get(tid, {}).get("total_penalty", 0),
        }
        for tid in team_ids
    }
 
    # Dimension scores from LLM
    dimension_scores = {
        tid: {
            "persuasiveness": llm_score_data.get("team_scores", {}).get(tid, {}).get("persuasiveness", "N/A"),
            "logic": llm_score_data.get("team_scores", {}).get(tid, {}).get("logic", "N/A"),
            "structural_clarity": llm_score_data.get("team_scores", {}).get(tid, {}).get("structural_clarity", "N/A"),
            "agility": llm_score_data.get("team_scores", {}).get(tid, {}).get("agility", "N/A"),
            "pre_penalty_score": llm_score_data.get("team_scores", {}).get(tid, {}).get("raw_score", "N/A"),
        }
        for tid in team_ids
    }
    
    judge_result = {
        "disqualification": disqualified,
        "disqualification_reasons": disqualification_reasons,
        "dimension_scores": dimension_scores,
        "penalty_breakdown": penalty_breakdown,
        "validation_summary": val_summary,
        "debate_quality": llm_score_data.get("debate_quality", "unknown"),
        "notable_moments": llm_score_data.get("notable_moments", ""),
        "remarks": remarks
    }

    output = {
        "match_id": match_id,
        "topic": topic,
        "winner": winner,
        "scores": scores_obj,
        "judgeResult": judge_result
    }
 
    return output
 