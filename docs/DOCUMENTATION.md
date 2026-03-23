# AgentSlam — User Manual and System Documentation

## 1) Project objective
AgentSlam is a debate tournament platform where admins run rounds and matches, and users participate in live socket-based debate sessions.

Core goals:
- onboard participants safely
- run tournament rounds with curated topics
- generate fair pairings from leaderboard
- run timed live debates with turn switching
- auto/process results and update leaderboard
- keep all state synchronized across DB + Redis + WebSocket + email

---

## 2) Roles
- **Admin**
  - creates users, rounds, topics
  - refreshes leaderboard
  - generates matches
  - activates/starts/pauses/resumes matches
  - can manually set match result
- **User**
  - logs in with credentials sent by admin/onboarding flow
  - joins activated match via WS link + passkey
  - sends debate messages when it is their turn

---

## 3) Tournament flow (high level)
1. **Onboard users** (single or batch)
2. **Users receive credentials + sandbox link** (email in production flow)
3. **Create round(s)**
4. **Create topic(s)** for each round
5. **Ensure leaderboard is loaded/refreshed**
6. **Generate matches** for selected round
7. **Activate match** (Redis state + socket room + passkey WS emails)
8. **Start match** (timer + turn + live socket updates)
9. **Pause/Resume** if needed
10. **Finish match** (timeout/manual result)
11. **Update leaderboard + user status + emails**
12. Continue to next round

---

## 4) Onboarding: credentials + sandbox

### 4.1 Why sandbox exists
Sandbox provides a safe WebSocket practice environment before real match participation.

Benefits:
- verify user can connect to WS
- validate token-based socket auth flow
- test client message format and limits
- avoid impacting real match state

### 4.2 Onboarding flow
- Admin calls onboarding endpoints:
  - `POST /api/onboarding/user`
  - `POST /api/onboarding/users/batch`
- Backend validates role/email/admission number and uniqueness.
- Backend creates user record in DB.
- Backend creates sandbox token and sandbox URL.
- Production branch sends onboarding email with credentials + sandbox URL.

### 4.3 Sandbox runtime behavior
- Connect path: `/ws-sandbox?payload=<sandbox_token>`
- Token type must be `sandbox`.
- Rate-limited by Redis.
- Auto disconnect after configured sandbox duration.
- Accepts only sandbox message type and echoes response.

---

## 5) Round, Topic, Match entities and relationships

### 5.1 Round
Input fields:
- `roundName` (required)
- `roundStatus` (optional, defaults to `created`)

Round statuses:
- `created`
- `ready`
- `ongoing`
- `completed`

### 5.2 Topic
Input fields:
- `title` (required)
- `description` (optional)
- `round` (required, round id)
- `weights` (required)

Relationship:
- many topics belong to one round

### 5.3 Match
Created from leaderboard + round topics.

Important fields:
- `opponents.team1.user`
- `opponents.team2.user`
- `opponents.team1.topicType` (`pros`/`cons`)
- `opponents.team2.topicType` (`pros`/`cons`)
- `topic`
- `round`
- `matchStatus`
- `scores.team1`, `scores.team2`
- `winner`
- `conversations[]`

Relationship:
- one match belongs to one round and one topic
- one match has two opponent users

---

## 6) Round status and client-side admin flow

### 6.1 Round status usage
- **created**: round created, topics can be managed
- **ready**: matches generated and round prepared
- **ongoing**: tournament actively running in that round
- **completed**: round finished

### 6.2 Admin updates affecting client
- Round APIs update server DB state.
- Client round pages reflect current `roundStatus`.
- Current round card/summary uses status and timestamps.

---

## 7) Match creation and lifecycle

### 7.1 How matches are generated
Endpoint: `POST /api/match/generate`

Logic summary:
- requires admin + `currRoundId`
- validates round exists and status is `created`
- reads leaderboard from Redis
- fetches round topics (sorted by `weights` descending)
- pairs users from top-vs-bottom ranking
- randomly assigns pros/cons
- creates match documents in DB
- updates round status to `ready`

If odd participant count:
- last unpaired entry is excluded from current generation pass

### 7.2 Match statuses
- `pending` (not activated)
- `active` (activated, redis/socket state prepared)
- `started` (live debate + timer)
- `paused` (timer halted, remaining time stored)
- `completed` (finalized result)

### 7.3 Admin lifecycle actions
- `POST /api/match/activate/:matchId`
- `POST /api/match/start/:matchId`
- `POST /api/match/pause/:matchId`
- `POST /api/match/resume/:matchId`
- `POST /api/match/result/:matchId` (manual result)

---

## 8) Redis + Socket state behavior

### 8.1 Redis match hash
On activation/start/pause/resume, Redis hash `match:<matchId>` stores:
- team identity mapping (`team1`, `team2`)
- topic and description
- round name
- pros/cons side mapping
- `status`
- `turn`
- `finishTime`
- `remainingTime`

### 8.2 WebSocket behavior (real match)
Connect path:
- `/ws?matchId=<id>&passkey=<token>` or access cookie

Server behavior:
- verifies token and session
- checks match state from Redis
- assigns user team role (`team1`/`team2`/admin/viewer)
- sends welcome + current match state
- if match already started, sends previous conversation snapshot

Live debate behavior:
- only current turn can send (except admin)
- stores conversation in DB
- switches turn in Redis
- emits debate message and updated match state

### 8.3 Match end behavior
On timeout:
- mark match completed in Redis + DB
- broadcast finish event
- queue result processing job
- close match sockets

---

## 9) Email behavior

### 9.1 Onboarding email
Sent after user creation in production onboarding flow.
Includes:
- credentials
- role
- sandbox URL

### 9.2 Match activation email
On activation, each team receives passkey-based WS URL.

### 9.3 Match result email
After result processing, both participants receive match result summary.

---

## 10) Leaderboard: purpose and update rules

### 10.1 Why leaderboard is required
Leaderboard rank order is used to generate fair pairings:
- highest rank vs lowest rank
- second highest vs second lowest

Without leaderboard, match generation is blocked.

### 10.2 How leaderboard is built/regenerated
- Stored in Redis sorted set `leaderboard`
- Loader uses active users and `tournamentPoints`
- Refresh endpoint:
  - `POST /api/round/refresh-leaderboard`
  - clears and rebuilds leaderboard from DB

### 10.3 How leaderboard is updated after match result
- loser can be disabled and removed from leaderboard entry
- winner score is incremented in leaderboard
- points are synced to users in DB as tournament points updates

---

## 11) Generic server constants (from environment)

### Auth / session / token constants
- `SESSION_TTL_SECONDS=604800`
  - Redis login session TTL (7 days)
- `ACCESS_TOKEN_TTL=30m`
  - access token validity
- `REFRESH_TOKEN_TTL=7d`
  - refresh token validity
- `PASSKEY_TOKEN_TTL=24h`
  - match passkey token validity used in WS links
- `SANDBOX_TOKEN_TTL=45d`
  - sandbox token validity

### Match constant
- `MATCH_DURATION_MS=900000`
  - 5 minutes debate duration per match

### Socket limit constants
- `SOCKET_MAX_MESSAGE_SIZE=7168`
  - max WS frame payload accepted by server (bytes)
- `SOCKET_MAX_CHAT_MESSAGE_SIZE=3500`
  - max logical chat message size (bytes)
- `SOCKET_MESSAGE_LIMIT=5`
  - max messages in a rate-limit window
- `SOCKET_WINDOW_TIME_SEC=120`
  - window length in seconds
- `SANDBOX_MSG_LIMIT=8`
  - sandbox message limit per window
- `SANDBOX_MSG_WINDOW_SEC=600`
  - sandbox window length in seconds
- `SANDBOX_DURATION_MS=600000`
  - sandbox auto-disconnect timeout (10 min)

---

## 12) API index (quick reference)

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Onboarding
- `POST /api/onboarding/user`
- `POST /api/onboarding/users/batch`

### User
- `GET /api/user/profile`
- `GET /api/user`
- `GET /api/user/filter`
- `GET /api/user/info`
- `GET /api/user/info/:id`
- `POST /api/user/reset-password`
- `POST /api/user/change-status`

### Round
- `POST /api/round/create`
- `GET /api/round`
- `GET /api/round/summary`
- `GET /api/round/leaderboard`
- `POST /api/round/refresh-leaderboard`
- `GET /api/round/info`
- `GET /api/round/info/:roundId`
- `POST /api/round/update/:roundId`
- `POST /api/round/update-status/:roundId`
- `DELETE /api/round/delete/:roundId`

### Topic
- `POST /api/topic/create`
- `POST /api/topic/create/batch`
- `GET /api/topic/round/:round`
- `GET /api/topic/info/:topicId`
- `POST /api/topic/update/:topicId`
- `DELETE /api/topic/:topicId`

### Match
- `POST /api/match/generate`
- `POST /api/match/activate/:matchId`
- `POST /api/match/start/:matchId`
- `POST /api/match/pause/:matchId`
- `POST /api/match/resume/:matchId`
- `POST /api/match/result/:matchId`
- `GET /api/match`
- `GET /api/match/admin`
- `GET /api/match/round/:roundId`
- `GET /api/match/:matchId`

---

## 13) Suggested operational sequence for admins
1. Onboard users (single/batch)
2. Verify users can login/sandbox connect
3. Create round
4. Create topics for round
5. Refresh leaderboard
6. Generate matches
7. Activate each match
8. Start, monitor, pause/resume if needed
9. Confirm result processing and leaderboard update
10. Move round to ongoing/completed as appropriate

---

## 14) Notes
- This project keeps critical runtime state in Redis for low-latency socket interactions.
- MongoDB remains source of persistence and historical data.
- Socket and match state transitions should always be performed through admin lifecycle endpoints to avoid inconsistent state.
