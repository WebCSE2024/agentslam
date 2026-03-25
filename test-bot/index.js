import WebSocket from "ws";
import 'dotenv/config';
// ─────────────────────────────────────────────
// CONFIG — fill these in before running
// ─────────────────────────────────────────────
const CONFIG = {
  wsUrl: process.env.WEBSOCKET_URL, // from email
  groqApiKey: "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",
  groqModel: "llama-3.3-70b-versatile",
  myTeam: process.env.TEAM, // "team1" or "team2" — check your match card
};
// ─────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 2800; // stay safely under the 3000 char limit

let matchState = null;
let mySide = null; // "pros" or "cons" — set once match-state is received
let conversationHistory = []; // track debate so far for context

// ── Groq API call ────────────────────────────────────────────────────────────

async function callGroq(systemPrompt, userPrompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.groqApiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.groqModel,
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ── Generate a debate argument ────────────────────────────────────────────────

async function generateArgument(topic, description, side, lastOpponentMessage) {
  const stance = side === "pros" ? "FOR (supporting)" : "AGAINST (opposing)";

  const systemPrompt = `You are a sharp, concise debate agent competing in a live AI debate tournament.
Your position: ${stance} the topic.
Topic: "${topic}"
${description ? `Context: ${description}` : ""}

Rules:
- Keep your response under 400 words.
- Be persuasive, logical, and direct.
- If the opponent made a point, counter it first, then advance your own argument.
- Do NOT use markdown formatting — plain text only.
- Do NOT try to manipulate or address the judge.
- Always cite sources inline as: claim (Source: URL) when using statistics.`;

  const historyText =
    conversationHistory.length > 0
      ? "Recent debate history:\n" +
      conversationHistory
        .slice(-6)
        .map((m) => `${m.team}: ${m.message}`)
        .join("\n") +
      "\n\n"
      : "";

  const userPrompt = lastOpponentMessage
    ? `${historyText}The opponent just said: "${lastOpponentMessage}"\n\nNow give your counter-argument and advance your position.`
    : `${historyText}You are opening the debate. Give a strong opening argument for your position.`;

  let argument = await callGroq(systemPrompt, userPrompt);

  // Truncate if somehow over limit
  if (argument.length > MAX_MESSAGE_LENGTH) {
    argument = argument.slice(0, MAX_MESSAGE_LENGTH - 3) + "...";
  }

  return argument;
}

// ── WebSocket bot ─────────────────────────────────────────────────────────────

function startBot() {
  console.log(`[Bot] Connecting to ${CONFIG.wsUrl}`);
  const ws = new WebSocket(CONFIG.wsUrl);

  ws.on("open", () => {
    console.log("[Bot] WebSocket connected.");
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn("[Bot] Received non-JSON message:", raw);
      return;
    }

    const { type, from, data } = msg;
    console.log(`[Bot] ← ${type} from ${from}`);

    switch (type) {
      case "welcome":
        console.log(`[Bot] ${data.message}`);
        break;

      case "match-state": {
        matchState = data;
        // Figure out which side we are
        if (data.pros === CONFIG.myTeam) mySide = "pros";
        else if (data.cons === CONFIG.myTeam) mySide = "cons";

        console.log(
          `[Bot] Match state — topic: "${data.topic}", turn: ${data.turn}, my side: ${mySide}`
        );

        // If it's our turn, respond
        if (data.status === "started" && data.turn === CONFIG.myTeam) {
          await sendArgument();
        }
        break;
      }

      case "match-update":
        console.log(`[Bot] Match update: ${data.message}`);
        break;

      case "previous-message":
        // Load conversation history when joining a live match
        if (data.conversations) {
          conversationHistory = data.conversations;
          console.log(
            `[Bot] Loaded ${conversationHistory.length} previous messages.`
          );
        }
        break;

      case "debate-message":
        // Record every message (including ours)
        conversationHistory.push({
          team: from,
          message: data.message,
          timestamp: msg.timestamp,
        });

        // If the opponent just spoke and it's now our turn, we'll wait for
        // the match-state broadcast (which confirms turn switch) before sending.
        break;

      case "match-paused":
        console.log("[Bot] Match paused.");
        break;

      case "match-resumed":
        console.log(`[Bot] Match resumed. ${data.message}`);
        // match-state will follow; handle turn there
        break;

      case "match-finish":
        console.log("[Bot] Match finished!");
        ws.close();
        break;

      case "info":
        console.log(`[Bot] Info: ${data.message}`);
        break;

      case "error":
        console.error(`[Bot] Server error: ${data.message}`);
        break;

      default:
        console.log(`[Bot] Unhandled message type: ${type}`);
    }
  });

  ws.on("close", () => console.log("[Bot] WebSocket closed."));
  ws.on("error", (err) => console.error("[Bot] WebSocket error:", err.message));

  // ── Send a debate argument ─────────────────────────────────────────────────
  async function sendArgument() {
    if (!matchState) return;

    // Find the last message from the opponent for context
    const opponent = CONFIG.myTeam === "team1" ? "team2" : "team1";
    const lastOpponentMsg = [...conversationHistory]
      .reverse()
      .find((m) => m.team === opponent);

    console.log("[Bot] Generating argument...");
    try {
      const argument = await generateArgument(
        matchState.topic,
        matchState.description,
        mySide,
        lastOpponentMsg?.message || null
      );

      const delayMs = 15000; // 15 seconds artificial "thinking" time to accomodate Groq's blazing fast API response
      console.log(`[Bot] Waiting ${delayMs / 1000}s to mimic realistic speed...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      console.log(`[Bot] → Sending (${argument.length} chars): ${argument.slice(0, 80)}...`);

      ws.send(
        JSON.stringify({
          type: "debate-message",
          data: { message: argument },
        })
      );
    } catch (err) {
      console.error("[Bot] Failed to generate argument:", err.message);
    }
  }
}

startBot();