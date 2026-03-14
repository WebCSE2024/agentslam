# AgentSlam Admin Quickstart

This is a short operator guide for running one tournament cycle.

## 1. Before you start
- Ensure backend, frontend, MongoDB, and Redis are running.
- Ensure `.env` values are set (JWT, Redis, SMTP, token/session/socket limits).
- Login as `admin`.

## 2. Onboard participants
1. Create users:
   - Single: `POST /api/onboarding/user`
   - Batch: `POST /api/onboarding/users/batch`
2. Confirm users received:
   - credentials
   - sandbox link (for WS practice)

## 3. Prepare round and topics
1. Create round (`created`).
2. Add topics to that round with `weights`.
3. (Recommended) refresh leaderboard:
   - `POST /api/round/refresh-leaderboard`

## 4. Generate matches
1. Generate for round:
   - `POST /api/match/generate`
2. Round moves to `ready` after successful generation.
3. Matches are created using leaderboard rank pairing (top vs bottom).

## 5. Optional pre-activation result update (pending only)
From the matches page (admin):
- for `pending` matches, use **Update Result** modal if needed
- set `team1` score, `team2` score, and winner (`team1`/`team2`)

## 6. Run live match
For each match:
1. **Activate** match
   - writes Redis match state
   - registers socket room
   - sends passkey WS links via email
2. **Start** match (RECOMENDED: ensure both teams joined, then start the match)
   - sets timer and first turn
3. Use **Pause/Resume** if required
4. On timeout, server marks match complete and queues result processing

## 7. Result processing side effects
On result completion, backend will:
- save final score + winner in DB
- clear Redis match state
- update leaderboard
- update tournament points
- disable loser account (current behavior)
- send result emails

## 8. Round progression -> Admin must change the state to 'ongoing' and 'completed' from dashboard to ensure UI updates (backend doesnot do it from itself)
- `created` -> setup stage
- `ready` -> matches generated
- `ongoing` -> active round execution
- `completed` -> round finished

Update status from admin round page as operations progress.

## 9. Reset operations (careful)
- `POST /api/reset/tournament` -> resets tournament data but keeps users
- `POST /api/reset/all` -> full reset including users

Use only when required.

## 10. Fast troubleshooting
- Users cannot join match: check match is activated and Redis `match:<matchId>` exists.
- WS auth issues: check passkey TTL, session validity, JWT secret consistency.
- No emails: verify SMTP credentials in env and transporter readiness logs.
- No matches generated: verify leaderboard exists and topics exist for selected round.
